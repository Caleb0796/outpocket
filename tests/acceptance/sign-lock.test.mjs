// tests/acceptance/sign-lock.test.mjs — node S12, the atomic sign lock.
//
// Report-content writes now run over the real HTTP routes. These tests prove
// those routes and the sign gate share one lock, while revision remains in
// the report aggregate rather than in a parallel lock-side counter.
//
// Proves:
//   - locks.mjs's own API: acquire/release/assertUnlocked/isLocked, with the
//     exact code/http shape a route handler forwards verbatim.
//   - expiry releases the lock (R-44's "advancing the clock past expires_at
//     releases the lock and permits a new sign request"), through a real
//     signGate + real HTTP server sharing one injected clock.
//   - the revision is server-owned by the report aggregate and advances only
//     through accepted report mutations.
//   - the atomic pairing: two concurrent HTTP opens for the SAME report_id
//     never both win, and a failed acquire leaves no residual lock state —
//     genuine concurrency over real sockets, not a single-threaded assertion
//     dressed up as one.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate } from "../../server/sign.mjs";
import { createReportLocks, LockError, LOCK_CODE, LOCK_HTTP } from "../../server/locks.mjs";

let nextReportId = 1;
function freshReportId() {
  return `RP-LOCK-${nextReportId++}`;
}

function openBody(reportId, overrides = {}) {
  return {
    report_id: reportId,
    worst_case: "Submitting makes this report final.",
    violation_history_count: 0,
    ...overrides,
  };
}

async function withApp(signGate, fn) {
  const app = createApp({ signGate });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function login(base, persona) {
  const res = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  assert.equal(res.status, 200, `login as ${persona} must succeed`);
  return res.headers.get("set-cookie").split(";")[0];
}

async function postJson(base, path, cookie, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function addLine(base, cookie, reportId, merchant) {
  return postJson(base, `/api/reports/${reportId}/lines`, cookie, {
    date: "2026-08-20",
    merchant,
    category: "meals",
    amount_cents: 1820,
    currency: "USD",
    attendees: 1,
    description: "Lunch",
  });
}

async function createDraft(base, cookie) {
  const created = await postJson(base, "/api/reports", cookie, {
    title: "Lock fixture",
    project: "FALCON",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const reportId = created.body.report_id;
  const added = await addLine(base, cookie, reportId, "Heron Cafeteria");
  assert.equal(added.status, 201, JSON.stringify(added.body));
  return { reportId, report: added.body.report };
}

/** What a real mutating write route (S2/S4, not this node) will do as its first line. */
function guardMutation(locks, reportId) {
  try {
    locks.assertUnlocked(reportId);
    return { blocked: false };
  } catch (err) {
    if (!(err instanceof LockError)) throw err;
    return { blocked: true, status: err.http, body: { error: err.code } };
  }
}

// ── locks.mjs's own API ─────────────────────────────────────────────────
test("acquire/assertUnlocked/isLocked/release: the core lock, unit-level", () => {
  const locks = createReportLocks();
  const reportId = freshReportId();

  assert.equal(locks.isLocked(reportId), false);
  locks.assertUnlocked(reportId); // does not throw

  const future = new Date(Date.now() + 60_000).toISOString();
  locks.acquire(reportId, "holder-a", future);
  assert.equal(locks.isLocked(reportId), true);

  assert.throws(
    () => locks.assertUnlocked(reportId),
    (err) => err instanceof LockError && err.code === LOCK_CODE && err.code === "E_SIGN_IN_PROGRESS" && err.http === LOCK_HTTP && err.http === 423,
  );

  // a different holder cannot acquire while it is held
  assert.throws(() => locks.acquire(reportId, "holder-b", future), (err) => err instanceof LockError && err.http === 423);

  // release by the wrong holder is a no-op
  locks.release(reportId, "holder-b");
  assert.equal(locks.isLocked(reportId), true, "wrong-holder release must not clear someone else's lock");

  // the same holder re-acquiring (a retry) is not a conflict
  locks.acquire(reportId, "holder-a", future);
  assert.equal(locks.isLocked(reportId), true);

  locks.release(reportId, "holder-a");
  assert.equal(locks.isLocked(reportId), false);
  locks.assertUnlocked(reportId); // does not throw
});

test("expiry lazily releases the lock — an injectable clock, no timers", () => {
  let clock = new Date(2026, 0, 1, 10, 0, 0);
  const locks = createReportLocks({ now: () => clock });
  const reportId = freshReportId();

  const expiresAt = new Date(clock.getTime() + 5_000).toISOString();
  locks.acquire(reportId, "holder", expiresAt);
  assert.equal(locks.isLocked(reportId), true);

  clock = new Date(clock.getTime() + 4_000); // before expiry
  assert.equal(locks.isLocked(reportId), true);

  clock = new Date(clock.getTime() + 2_000); // now past expiry
  assert.equal(locks.isLocked(reportId), false, "advancing the clock past expires_at releases the lock");
  locks.assertUnlocked(reportId); // does not throw

  // permits a fresh acquire under a new holder
  locks.acquire(reportId, "holder-2", new Date(clock.getTime() + 5_000).toISOString());
  assert.equal(locks.isLocked(reportId), true);
});

test("the lock object carries no parallel report revision authority", () => {
  const locks = createReportLocks();
  assert.deepEqual(Object.keys(locks).sort(), ["acquire", "assertUnlocked", "isLocked", "release"]);
});

// ── R-44's literal clause, over a real signGate + real HTTP server ───────
test("open() takes the report lock synchronously: a real mutation is refused 423, and decline releases it", async () => {
  const gate = createSignGate({ ttlMs: 5_000 });
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie);

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200);
    assert.match(opened.body.ticket, /^tk_[0-9a-f]{32}$/);

    // Before the continuation call: any mutating request for this report_id
    // must be refused, exactly the shape a real write route would return.
    const guard = guardMutation(gate.locks, reportId);
    assert.equal(guard.blocked, true);
    assert.equal(guard.status, 423);
    assert.deepEqual(guard.body, { error: "E_SIGN_IN_PROGRESS" });
    const blockedWrite = await addLine(base, cookie, reportId, "Blocked Cafe");
    assert.equal(blockedWrite.status, 423);
    assert.equal(blockedWrite.body.error, "E_SIGN_IN_PROGRESS");

    // Decline releases it immediately (recovery path, not commit-only).
    const declined = await postJson(base, `/api/sign/${opened.body.sign_request.request_id}/respond`, cookie, {
      schema: "outpocket.sign_respond_request/1",
      request_id: opened.body.sign_request.request_id,
      decision: "declined",
      reason: "changed my mind",
      method: "click",
      acknowledged_digest: opened.body.sign_request.snapshot_digest,
      acknowledged_revision: opened.body.sign_request.revision,
      confirm_token: gate.peekConfirmTokenForDialog(opened.body.sign_request.request_id, {
        sessionId: cookie.split("=")[1],
      }),
    });
    assert.equal(declined.status, 200);
    assert.equal(guardMutation(gate.locks, reportId).blocked, false, "decline frees the report lock");
    const acceptedWrite = await addLine(base, cookie, reportId, "Released Cafe");
    assert.equal(acceptedWrite.status, 201, JSON.stringify(acceptedWrite.body));

    // A fresh sign request can now be opened for the same report.
    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(reopened.status, 200);
    assert.equal(guardMutation(gate.locks, reportId).blocked, true, "the new open re-locks it");
  });
});

test("expiry (server-owned clock) releases the lock and permits a new sign request", async () => {
  let clock = new Date(2026, 0, 1, 10, 0, 0);
  const gate = createSignGate({ now: () => clock, ttlMs: 5_000 });
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie);

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200);
    assert.equal(guardMutation(gate.locks, reportId).blocked, true);

    clock = new Date(clock.getTime() + 6_000); // past the 5s ttl
    assert.equal(guardMutation(gate.locks, reportId).blocked, false, "expiry releases the lock");

    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(reopened.status, 200, "a new sign request is permitted after expiry");
  });
});

test("revision is carried from the server aggregate and advances only after accepted mutations", async () => {
  const gate = createSignGate({ ttlMs: 5_000 });
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie);

    assert.equal((await addLine(base, cookie, reportId, "Second Cafe")).status, 201);
    assert.equal((await addLine(base, cookie, reportId, "Third Cafe")).status, 201);

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200);
    assert.equal(opened.body.sign_request.revision, 3);

    const request_id = opened.body.sign_request.request_id;
    const sid = cookie.split("=")[1];
    await postJson(base, `/api/sign/${request_id}/respond`, cookie, {
      schema: "outpocket.sign_respond_request/1",
      request_id,
      decision: "declined",
      reason: null,
      method: "click",
      acknowledged_digest: opened.body.sign_request.snapshot_digest,
      acknowledged_revision: opened.body.sign_request.revision,
      confirm_token: gate.peekConfirmTokenForDialog(request_id, { sessionId: sid }),
    });

    const fourth = await addLine(base, cookie, reportId, "Fourth Cafe");
    assert.equal(fourth.status, 201);

    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.sign_request.revision, 4, "the counter's new value is carried automatically into the next sign request");
  });
});

// ── the atomic pairing, under genuine concurrency ────────────────────────
// S2 (server/authz.mjs) now gates POST /api/sign to `employee` sessions
// only, so this race is between two INDEPENDENT chen sessions (two logins,
// two cookies, same persona) rather than chen-vs-ruiz — an auditor session
// racing this endpoint gets 403 deterministically now, which is S2's own
// property, not this node's. What S12 owns and this test still proves is
// unchanged: two sessions that are BOTH authorized never both win the lock.
test("two concurrent opens for the SAME report_id never both win, and the loser leaves no residual lock", async () => {
  const gate = createSignGate({ ttlMs: 30_000 });
  await withApp(gate, async (base) => {
    const cookieA = await login(base, "chen");
    const cookieB = await login(base, "chen");
    const { reportId } = await createDraft(base, cookieA);

    const [a, b] = await Promise.all([
      postJson(base, "/api/sign", cookieA, openBody(reportId)),
      postJson(base, "/api/sign", cookieB, openBody(reportId)),
    ]);

    const outcomes = [a, b];
    const winners = outcomes.filter((r) => r.status === 200);
    const losers = outcomes.filter((r) => r.status !== 200);

    assert.equal(winners.length, 1, `exactly one concurrent open must win: ${JSON.stringify(outcomes)}`);
    assert.equal(losers.length, 1);
    // The loser is rejected by one of the two layers guarding this — S5's
    // own request-uniqueness bookkeeping (409 E_SIGN_ALREADY_OPEN) or S12's
    // lock itself (423 E_SIGN_IN_PROGRESS) — either is "did not double-open".
    assert.ok(
      [409, 423].includes(losers[0].status),
      `loser must be rejected, not silently ignored: got ${losers[0].status}`,
    );

    assert.equal(gate.locks.isLocked(reportId), true, "exactly one lock is held after the race, not zero and not a leaked second one");
    assert.equal(guardMutation(gate.locks, reportId).blocked, true);

    const winnerRequestId = winners[0].body.sign_request.request_id;
    const winnerSid = (winners[0] === a ? cookieA : cookieB).split("=")[1];
    const declined = await postJson(base, `/api/sign/${winnerRequestId}/respond`, winners[0] === a ? cookieA : cookieB, {
      schema: "outpocket.sign_respond_request/1",
      request_id: winnerRequestId,
      decision: "declined",
      reason: null,
      method: "click",
      acknowledged_digest: winners[0].body.sign_request.snapshot_digest,
      acknowledged_revision: winners[0].body.sign_request.revision,
      confirm_token: gate.peekConfirmTokenForDialog(winnerRequestId, { sessionId: winnerSid }),
    });
    assert.equal(declined.status, 200);
    assert.equal(gate.locks.isLocked(reportId), false, "releasing the sole winner's lock leaves nothing behind — the loser never held it");
  });
});

// ── failure atomicity: a rejected acquire leaves no partial signGate state ─
test("a locks.acquire rejection leaves no sign-request record behind", () => {
  const reportId = freshReportId();
  const poisonedLocks = createReportLocks();
  poisonedLocks.acquire(reportId, "someone-else", new Date(Date.now() + 60_000).toISOString());

  const gate = createSignGate({ locks: poisonedLocks });
  assert.throws(
    () =>
      gate.open({
        sessionId: "sid-x",
        personaId: "chen",
        personaName: "Chen Xiao",
        reportId,
        revision: 0,
        policyVersion: "2026-08.1",
        policyDigest: "sha256:" + "0".repeat(64),
        report: { id: reportId },
        verdict: { worst: null, count: 0 },
        worstCase: null,
        violationHistoryCount: 0,
      }),
    (err) => err instanceof LockError,
  );

  // Nothing else was created — get() on any plausible id still 404s, and
  // the report is not marked open-by-report internally (peekOpenRequestId
  // finds nothing for this session).
  assert.equal(gate.peekOpenRequestId(reportId, { sessionId: "sid-x" }), null);
});
