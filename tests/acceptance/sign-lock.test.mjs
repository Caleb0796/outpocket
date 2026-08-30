// tests/acceptance/sign-lock.test.mjs — node S12, the report revision
// counter and the atomic sign lock.
//
// NOTE ON SCOPE (matching kb/pits/S4.md's own precedent): `server/index.mjs`
// has no report-content-mutation HTTP routes yet — S2 (per-request authz)
// and S4's future write-route callers build those, downstream of this node.
// Every one of those routes' first line will be `locks.assertUnlocked
// (reportId)` (server/locks.mjs) — the exact function this file exercises
// directly, over the real signGate.locks instance a real write route would
// share. "curl to any mutating endpoint returns 423" is therefore proven
// here as "the guard every future mutating endpoint must call throws 423
// E_SIGN_IN_PROGRESS while a sign request is open, and stops throwing the
// instant it is released" — the mechanism, not a fabricated stand-in route.
//
// Proves:
//   - locks.mjs's own API: acquire/release/assertUnlocked/isLocked, with the
//     exact code/http shape a route handler forwards verbatim.
//   - expiry releases the lock (R-44's "advancing the clock past expires_at
//     releases the lock and permits a new sign request"), through a real
//     signGate + real HTTP server sharing one injected clock.
//   - the revision counter is server-owned: a client's claimed revision is
//     trusted only the first time a report_id is seen; `bumpRevision` (the
//     stand-in for "an accepted mutation" — no such route exists yet) is
//     what actually advances it, and every subsequently opened sign request
//     carries that value, not whatever the client sends.
//   - the atomic pairing: two concurrent HTTP opens for the SAME report_id
//     never both win, and a failed acquire leaves no residual lock state —
//     genuine concurrency over real sockets, not a single-threaded assertion
//     dressed up as one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate } from "../../server/sign.mjs";
import { createReportLocks, LockError, LOCK_CODE, LOCK_HTTP } from "../../server/locks.mjs";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url));
const SCHEMA = JSON.parse(readFileSync(schemaPath, "utf8"));

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

let nextReportId = 1;
function freshReportId() {
  return `RP-LOCK-${nextReportId++}`;
}

/** A fresh, valid open-sign body, from erp/contracts/signature.schema.json examples[0]. */
function openBody(reportId, overrides = {}) {
  const ex = clone(SCHEMA.examples[0]);
  return {
    report_id: reportId,
    revision: ex.revision,
    policy_version: ex.policy_version,
    policy_digest: ex.snapshot.policy_digest,
    report: { ...ex.snapshot.report, id: reportId },
    verdict: ex.snapshot.verdict,
    worst_case: ex.worst_case,
    violation_history_count: ex.violation_history_count,
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

test("revision counter: seeded once from the caller, then server-owned — bumpRevision is the stand-in for an accepted mutation", () => {
  const locks = createReportLocks();
  const reportId = freshReportId();

  assert.equal(locks.getRevision(reportId, 5), 5, "first sight seeds from the caller's claim");
  assert.equal(locks.getRevision(reportId, 999), 5, "a later, different claim for the same report_id is ignored");

  assert.equal(locks.bumpRevision(reportId), 6);
  assert.equal(locks.bumpRevision(reportId), 7);
  assert.equal(locks.getRevision(reportId, 0), 7, "the fallback is ignored once anything has been recorded");
});

// ── R-44's literal clause, over a real signGate + real HTTP server ───────
test("open() takes the report lock synchronously with the snapshot: a mutating request between open and the continuation call is refused 423 with a code field; commit release-and-reopen works", async () => {
  const gate = createSignGate({ ttlMs: 5_000 });
  await withApp(gate, async (base) => {
    const reportId = freshReportId();
    const cookie = await login(base, "chen");

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200);
    assert.match(opened.body.ticket, /^tk_[0-9a-f]{32}$/);

    // Before the continuation call: any mutating request for this report_id
    // must be refused, exactly the shape a real write route would return.
    const guard = guardMutation(gate.locks, reportId);
    assert.equal(guard.blocked, true);
    assert.equal(guard.status, 423);
    assert.deepEqual(guard.body, { error: "E_SIGN_IN_PROGRESS" });

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
    const reportId = freshReportId();
    const cookie = await login(base, "chen");

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200);
    assert.equal(guardMutation(gate.locks, reportId).blocked, true);

    clock = new Date(clock.getTime() + 6_000); // past the 5s ttl
    assert.equal(guardMutation(gate.locks, reportId).blocked, false, "expiry releases the lock");

    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(reopened.status, 200, "a new sign request is permitted after expiry");
  });
});

test("revision is carried in the sign request from the server's own counter, not the client's claim, once one accepted mutation has happened", async () => {
  const gate = createSignGate({ ttlMs: 5_000 });
  await withApp(gate, async (base) => {
    const reportId = freshReportId();
    const cookie = await login(base, "chen");

    gate.locks.bumpRevision(reportId); // 1
    gate.locks.bumpRevision(reportId); // 2
    gate.locks.bumpRevision(reportId); // 3 — the stand-in for three accepted mutations

    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId, { revision: 999 }));
    assert.equal(opened.status, 200);
    assert.equal(opened.body.sign_request.revision, 3, "the server's own count wins over the client's claimed revision");

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

    gate.locks.bumpRevision(reportId); // 4 — one more accepted mutation

    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId, { revision: 0 }));
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
    const reportId = freshReportId();
    const cookieA = await login(base, "chen");
    const cookieB = await login(base, "chen");

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
