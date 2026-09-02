// tests/acceptance/sign-state.test.mjs — node S5, the human sign gate.
//
// curl-level (real http.Server, real cookies) proof of:
//   - N-15  neg-commit-without-human       (E_NOT_SIGNED, R-1's repair)
//   - N-16  neg-respond-without-click      (confirm_token, both arms honestly)
//   - N-21  neg-decline-to-unlock          (E_ALREADY_ANSWERED, the one-shot guard)
//   - the ticket's full property list (R-13: distinct from confirm_token)
//   - the two-call handshake shape and the suspend arm, through
//     src/page/sign-bridge.js
//
// R-43/contingencies[4]: the shipped mode is the two-call HANDSHAKE. This
// file also drives the SUSPEND arm once, against this same real server (no
// browser, no CDP, no timeout imposed by anything but the test itself) to
// prove the switch is real code and not a comment. Timing windows below are
// scaled down from the 2s/300s real-world figures (poll interval, expiry
// buffer) to keep the suite fast; the qualitative behaviour asserted is
// identical — "not yet settled" then "settled only after the POST".
//
// NOTE ON SCOPE (kb/pits/S5.md GRADE carries this in full): erp/graph.json's
// S5 accept text also names `node harness/drive.mjs --scenario sign`.
// harness/** belongs to node H*/V* (owner I1) and is not in S5's declared
// outputs or in S lane's file ownership — S5's charter lists harness/**
// under "you must never touch", and no `--scenario sign` exists in
// harness/drive.mjs today (it only loads named CDP flow files via
// --fallback --scenario <name>, a different mechanism gated on H3's own
// undelivered output). Rather than edit a file outside this node's
// ownership to manufacture a pass, this file proves the identical claims —
// the handshake shape, the suspend arm, every ticket property, the orphan
// path — through S5's own owned surface: server/sign.mjs over real HTTP,
// and src/page/sign-bridge.js over real fetch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate, REQUEST_ID_RE, CONFIRM_TOKEN_RE, TICKET_RE } from "../../server/sign.mjs";
import { digest } from "../../src/canonical.js";
import { createSignBridge, SIGN_MODE } from "../../src/page/sign-bridge.js";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url));
const SCHEMA = JSON.parse(readFileSync(schemaPath, "utf8"));
const SNAPSHOT_PREFIX = "outpocket/snapshot/1";

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

let nextReportId = 1;
function freshReportId() {
  return `RP-TEST-${nextReportId++}`;
}

/** The public sign-open body. Report content and policy claims are server-owned. */
function openBody(reportId, overrides = {}) {
  return {
    report_id: reportId,
    worst_case: "Submitting this report makes the expense record final.",
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

// The gate binds tickets/confirm_tokens to the raw `sid` cookie value, not
// the display persona — pull it back out of the Set-Cookie pair the same
// way the server parses it (sid=<hex>), so tests can call
// peekConfirmTokenForDialog / peekOpenRequestId (test-only stand-ins for
// reading the rendered dialog's DOM — see server/sign.mjs) with the right
// session id.
function cookieToSid(cookiePair) {
  return cookiePair.split("=")[1];
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

async function getJson(base, path, cookie) {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function createDraft(base, cookie, { amountCents = 1820 } = {}) {
  const created = await postJson(base, "/api/reports", cookie, {
    title: "Sign gate fixture",
    project: "FALCON",
  });
  assert.equal(created.status, 201, `report creation must succeed: ${JSON.stringify(created.body)}`);
  const reportId = created.body.report_id;
  const added = await postJson(base, `/api/reports/${reportId}/lines`, cookie, {
    date: "2026-08-20",
    merchant: "Heron Cafeteria",
    category: "meals",
    amount_cents: amountCents,
    currency: "USD",
    attendees: 1,
    description: "Lunch",
  });
  assert.equal(added.status, 201, `line creation must succeed: ${JSON.stringify(added.body)}`);
  return { reportId, report: added.body.report };
}

function respondBody(sr, { decision, reason = null, confirmToken }) {
  const body = {
    schema: "outpocket.sign_respond_request/1",
    request_id: sr.request_id,
    decision,
    reason,
    method: "click",
    acknowledged_digest: sr.snapshot_digest,
    acknowledged_revision: sr.revision,
  };
  if (confirmToken !== undefined) body.confirm_token = confirmToken;
  return body;
}

/** Opens a sign request as `chen`, over raw HTTP. Returns everything a test typically needs. */
async function openAsChen(base, gate, reportId) {
  const cookie = await login(base, "chen");
  const sid = cookieToSid(cookie);
  if (reportId === undefined) ({ reportId } = await createDraft(base, cookie));
  const { status, body } = await postJson(base, "/api/sign", cookie, openBody(reportId));
  assert.equal(status, 200, `open must succeed: ${JSON.stringify(body)}`);
  const sr = body.sign_request;
  const confirmToken = gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: sid });
  return { cookie, sid, reportId, signRequest: sr, ticket: body.ticket, confirmToken };
}

// ── clause (iii): the raw HTTP shape of an opened sign request ─────────────
test("POST /api/sign returns a schema-conformant sign_request with request_id INSIDE the digested snapshot; confirm_token/ticket never leak into it or into GET", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, signRequest: sr, ticket } = await openAsChen(base, gate);

    assert.match(sr.request_id, REQUEST_ID_RE);
    assert.match(ticket, TICKET_RE);
    assert.equal(sr.snapshot.request_id, sr.request_id, "request_id is inside the projection (R-1)");
    assert.equal(
      digest(SNAPSHOT_PREFIX, sr.snapshot),
      sr.snapshot_digest,
      "src/canonical.js digest('outpocket/snapshot/1', snapshot) reproduces the issued digest",
    );
    assert.ok(!Object.hasOwn(sr, "confirm_token"));
    assert.ok(!Object.hasOwn(sr, "ticket"));

    const fetched = await getJson(base, `/api/sign/${sr.request_id}`, cookie);
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body, sr, "GET /api/sign/{request_id} returns exactly what any caller holding the session cookie can already read");
    assert.ok(!Object.hasOwn(fetched.body, "confirm_token"));
  });
});

// ── the two-call handshake shape, through src/page/sign-bridge.js ──────────
test("handshake mode: execute() resolves within 2s carrying exactly {status:'awaiting_signature', ticket} — no confirm_token, snapshot_digest or revision", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });
    const { reportId } = await createDraft(base, cookie);

    const t0 = Date.now();
    const result = await bridge.beginSign(openBody(reportId));
    const elapsed = Date.now() - t0;

    assert.ok(elapsed < 2000, `handshake open must resolve well within 2s (took ${elapsed}ms)`);
    assert.deepEqual(Object.keys(result).sort(), ["status", "ticket"]);
    assert.equal(result.status, "awaiting_signature");
    assert.match(result.ticket, TICKET_RE);
  });
});

test("handshake mode: continuation on an OPEN record returns the awaiting status, never answers it — and the SECOND tool call, after the human's click, returns the server's own sign_response", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, sid, reportId, signRequest: sr, ticket, confirmToken } = await openAsChen(base, gate);
    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });

    const stillOpen = await bridge.continueSign(ticket, reportId);
    assert.equal(stillOpen.status, "awaiting_signature", "continuing an open record never answers it");

    const answered = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(answered.status, 200);

    const second = await bridge.continueSign(ticket, reportId);
    assert.equal(second.state, "answered");
    assert.equal(second.decision, "signed");
    assert.equal(second.signed_by, "Chen Xiao", "signed_by is resolved server-side from the session, never client-supplied");
    void sid;
  });
});

// ── the suspend arm (this node's own negative control) ─────────────────────
test("suspend mode: execute() stays unresolved while the record is open, and resolves only after the same POST /respond (V4's arm, unrunnable against a client with a real timeout)", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookieToSid(cookie);
    const { reportId } = await createDraft(base, cookie);
    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.SUSPEND, pollIntervalMs: 25, headers: { Cookie: cookie } });

    const pending = bridge.beginSign(openBody(reportId));
    const sentinel = Symbol("still-pending");
    const raced = await Promise.race([pending, new Promise((resolve) => setTimeout(() => resolve(sentinel), 150))]);
    assert.equal(raced, sentinel, "execute() must still be unresolved shortly after the call — nothing here imposes a timeout");

    const requestId = gate.peekOpenRequestId(reportId, { sessionId: sid });
    assert.ok(requestId, "the record exists server-side even though the caller never saw a ticket");
    const confirmToken = gate.peekConfirmTokenForDialog(requestId, { sessionId: sid });
    const sr = gate.get(requestId, { sessionId: sid });

    const answered = await postJson(base, `/api/sign/${requestId}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(answered.status, 200);

    const result = await pending;
    assert.equal(result.state, "answered");
    assert.equal(result.decision, "signed");
  });
});

// ── N-15: neg-commit-without-human ──────────────────────────────────────────
test("N-15 neg-commit-without-human: a synthesised sign_response POSTed straight to commit is refused 409 E_NOT_SIGNED, and signed_by/at are never influenced by the request body", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, sid, reportId, signRequest: sr, confirmToken } = await openAsChen(base, gate);

    // The pre-R-1 attack: never call /respond at all. Go straight to commit
    // with a forged, attacker-chosen `signature`-shaped payload — a field
    // commit_request no longer even has.
    const forged = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
      schema: "outpocket.commit_request/1",
      request_id: sr.request_id,
      report_id: reportId,
      signature: { signed_by: "attacker", at: "2020-01-01T00:00:00.000Z", decision: "signed", method: "click" },
      signed_by: "attacker",
      at: "2020-01-01T00:00:00.000Z",
    });
    assert.equal(forged.status, 400);
    assert.deepEqual(forged.body, {
      error: "E_BAD_REQUEST",
      message: "commit request has unknown field(s): signature, signed_by, at",
    });

    const unsigned = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
      schema: "outpocket.commit_request/1",
      request_id: sr.request_id,
      report_id: reportId,
    });
    assert.equal(unsigned.status, 409);
    assert.deepEqual(unsigned.body, {
      error: "E_NOT_SIGNED",
      message: "sign request is open, not answered+signed",
    });

    // Prove the forged fields had zero effect: the record can still be
    // answered legitimately, and the REAL signed_by/at are the session's own
    // name and a genuine recent server timestamp — nothing from the body
    // above.
    const answered = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(answered.status, 200);
    assert.equal(answered.body.signed_by, "Chen Xiao");
    assert.notEqual(answered.body.signed_by, "attacker");
    assert.notEqual(answered.body.at, "2020-01-01T00:00:00.000Z");
    assert.ok(Date.now() - Date.parse(answered.body.at) < 5000, "at is a genuine, recent server timestamp");

    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, { schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId });
    assert.equal(committed.status, 200);
    assert.equal(committed.body.status, "committed");
    void sid;
  });
});

test("a committed request replays the identical result without appending the chain again", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, confirmToken } = await openAsChen(base, gate);
    const answered = await postJson(
      base,
      `/api/sign/${sr.request_id}/respond`,
      cookie,
      respondBody(sr, { decision: "signed", confirmToken }),
    );
    assert.equal(answered.status, 200);
    const body = { schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId };

    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, body);
    assert.equal(committed.status, 200);
    const chainAfterCommit = clone(gate.chain.list());
    assert.equal(chainAfterCommit.length, 1);

    const replayed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, body);
    assert.equal(replayed.status, 200);
    assert.deepEqual(replayed.body, committed.body);
    assert.equal(replayed.body.confirmation, committed.body.confirmation);
    assert.deepEqual(gate.chain.list(), chainAfterCommit, "an idempotent replay must not publish another chain entry");

    const otherSession = await login(base, "chen");
    const crossSession = await postJson(base, `/api/reports/${reportId}/commit`, otherSession, body);
    assert.equal(crossSession.status, 404);
    assert.equal(crossSession.body.error, "E_SIGN_REQUEST_UNKNOWN");

    const differentRequest = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
      ...body,
      request_id: "sg_" + "0".repeat(16),
    });
    assert.equal(differentRequest.status, 404);
    assert.equal(differentRequest.body.error, "E_SIGN_REQUEST_UNKNOWN");
  });
});

test("POST /respond enforces the frozen eight-field request and still accepts the page body", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, signRequest: sr, confirmToken } = await openAsChen(base, gate);
    const pageBody = respondBody(sr, { decision: "signed", confirmToken });
    const cases = [
      ["schema", Object.fromEntries(Object.entries(pageBody).filter(([key]) => key !== "schema"))],
      ["schema", { ...pageBody, schema: "outpocket.sign_respond_request/0" }],
      ["request_id", { ...pageBody, request_id: "sg_bad" }],
      ["method", Object.fromEntries(Object.entries(pageBody).filter(([key]) => key !== "method"))],
      ["method", { ...pageBody, method: "keyboard" }],
      ["unknown_field", { ...pageBody, unknown_field: true }],
      ["decision", { ...pageBody, decision: "approved" }],
      ["reason", { ...pageBody, reason: { text: "no" } }],
      ["reason", { ...pageBody, reason: "x".repeat(301) }],
      ["acknowledged_digest", { ...pageBody, acknowledged_digest: null }],
      ["acknowledged_revision", { ...pageBody, acknowledged_revision: -1 }],
      ["confirm_token", { ...pageBody, confirm_token: 42 }],
    ];

    for (const [field, body] of cases) {
      const rejected = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, body);
      assert.equal(rejected.status, 400, `${field}: ${JSON.stringify(rejected.body)}`);
      assert.equal(rejected.body.error, "E_BAD_REQUEST");
      assert.match(rejected.body.message, new RegExp(field));
    }

    const accepted = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, pageBody);
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    assert.equal(accepted.body.decision, "signed");
    assert.equal(accepted.body.method, "click");
  });
});

// ── N-16: neg-respond-without-click, both arms honestly ────────────────────
test("N-16 neg-respond-without-click, KNOWN-OPEN arm: with no confirm_token required, the attack commits — HTTP 200, a chain entry attesting Chen Xiao at a genuine server time", async () => {
  const gate = createSignGate({ requireConfirmToken: false });
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr } = await openAsChen(base, gate);

    // Never render the dialog. Echo the digest/revision the server just
    // issued, straight from curl plus the session cookie — no confirm_token
    // in the body at all.
    const responded = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed" }));
    assert.equal(responded.status, 200, "known-open: the vulnerable body is accepted");
    assert.ok(!Object.hasOwn(responded.body, "confirm_token"));

    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, { schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId });
    assert.equal(committed.status, 200);
    assert.equal(committed.body.status, "committed");
    assert.equal(committed.body.chain_entry.source, "human");
    assert.equal(committed.body.chain_entry.actor, "Chen Xiao");
    assert.ok(Date.now() - Date.parse(committed.body.chain_entry.at) < 5000);
  });
});

test("N-16 neg-respond-without-click, ENFORCED arm (shipped default): the same attack is refused 403 E_NO_CONFIRM_TOKEN, and the record is untouched", async () => {
  const gate = createSignGate(); // requireConfirmToken: true — the shipped default
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, confirmToken } = await openAsChen(base, gate);

    const attack = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed" }));
    assert.equal(attack.status, 403);
    assert.equal(attack.body.error, "E_NO_CONFIRM_TOKEN");

    const wrongToken = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken: "ct_" + "0".repeat(32) }));
    assert.equal(wrongToken.status, 403);
    assert.equal(wrongToken.body.error, "E_NO_CONFIRM_TOKEN");

    // The record is still `open` — a legitimate respond, with the real
    // confirm_token, still succeeds afterward.
    const legit = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(legit.status, 200);
    assert.equal(legit.body.state, "answered");
  });
});

// ── N-21: neg-decline-to-unlock, and the one-shot guard (E_ALREADY_ANSWERED) ─
test("N-21 neg-decline-to-unlock: a caller holding confirm_token can decline before the human signs, but cannot overwrite the record — and can only cancel, never forge, a signature", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, ticket, confirmToken } = await openAsChen(base, gate);
    const bridge = createSignBridge({ baseUrl: base, mode: SIGN_MODE.HANDSHAKE, headers: { Cookie: cookie } });

    const declined = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "declined", reason: "not my report", confirmToken }));
    assert.equal(declined.status, 200);
    assert.equal(declined.body.decision, "declined");

    const before = await bridge.continueSign(ticket, reportId);
    assert.equal(before.state, "answered");
    assert.equal(before.decision, "declined");

    // The human's genuine click arrives second, same request_id.
    const secondAnswer = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(secondAnswer.status, 409);
    assert.equal(secondAnswer.body.error, "E_ALREADY_ANSWERED");

    const after = await bridge.continueSign(ticket, reportId);
    assert.deepEqual(after, before, "the record is byte-unchanged after the refused second respond");

    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, { schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId });
    assert.equal(committed.status, 200, "E_DECLINED is HTTP 200 — not an error condition");
    assert.equal(committed.body.status, "rejected");
    assert.equal(committed.body.error.code, "E_DECLINED");
    assert.equal(committed.body.confirmation, null, "nothing is attested — the day book is strictly emptier, never falsely richer");

    // Recovery: the draft is released, and a NEW sign request can be opened
    // for the same report immediately.
    const reopened = await openAsChen(base, gate, reportId);
    assert.match(reopened.signRequest.request_id, REQUEST_ID_RE);
    assert.notEqual(reopened.signRequest.request_id, sr.request_id);
  });
});

test("the one-shot guard also refuses a second respond after SIGNING (not just after declining)", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, signRequest: sr, confirmToken } = await openAsChen(base, gate);
    const first = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(first.status, 200);
    const second = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(second.status, 409);
    assert.equal(second.body.error, "E_ALREADY_ANSWERED");
  });
});

// ── the ticket's full property list (R-13: distinct from confirm_token) ────
test("ticket: rejected when presented from another session", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { reportId, ticket } = await openAsChen(base, gate);
    const ruizCookie = await login(base, "ruiz");
    const res = await postJson(base, "/api/sign/continue", ruizCookie, { ticket, report_id: reportId });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "E_NO_CONFIRM_TOKEN");
  });
});

test("ticket: rejected when presented for another report", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, ticket } = await openAsChen(base, gate);
    const res = await postJson(base, "/api/sign/continue", cookie, { ticket, report_id: freshReportId() });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "E_NO_CONFIRM_TOKEN");
  });
});

test("ticket: rejected after expiry, and the report's request-slot releases so a NEW sign request can be opened (the orphan path)", async () => {
  let current = new Date("2026-08-29T09:00:00.000Z");
  const gate = createSignGate({ now: () => current, ttlMs: 1000 });
  await withApp(gate, async (base) => {
    const { cookie, reportId, ticket } = await openAsChen(base, gate);

    // Before expiry, a second open for the same report is refused — this is
    // S5's own request-uniqueness bookkeeping, not S12's report-mutation
    // lock (see server/sign.mjs NOT THIS NODE).
    const tooSoon = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(tooSoon.status, 409);
    assert.equal(tooSoon.body.error, "E_SIGN_ALREADY_OPEN");

    current = new Date(current.getTime() + 2000); // past ttlMs

    const afterExpiry = await postJson(base, "/api/sign/continue", cookie, { ticket, report_id: reportId });
    assert.equal(afterExpiry.status, 403);
    assert.equal(afterExpiry.body.error, "E_NO_CONFIRM_TOKEN");

    const reopened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(reopened.status, 200, "the slot released — a new sign request can be opened after expiry");
  });
});

test("ticket: rejected after terminal consumption (committed)", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, ticket, confirmToken } = await openAsChen(base, gate);
    await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, { schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId });
    assert.equal(committed.status, 200);

    const after = await postJson(base, "/api/sign/continue", cookie, { ticket, report_id: reportId });
    assert.equal(after.status, 403);
    assert.equal(after.body.error, "E_NO_CONFIRM_TOKEN");
  });
});

test("ticket: idempotent and side-effect-free under concurrent continuation calls", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, ticket, confirmToken } = await openAsChen(base, gate);

    const [a, b] = await Promise.all([
      postJson(base, "/api/sign/continue", cookie, { ticket, report_id: reportId }),
      postJson(base, "/api/sign/continue", cookie, { ticket, report_id: reportId }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(a.body, { status: "awaiting_signature", ticket });
    assert.deepEqual(b.body, a.body);

    // No side effect: the record is still open and answerable normally.
    const answered = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(answered.status, 200);
  });
});

test("confirm_token rejected in the ticket position, and the ticket rejected in the confirm_token position — both 403 E_NO_CONFIRM_TOKEN", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, ticket, confirmToken } = await openAsChen(base, gate);
    assert.match(confirmToken, CONFIRM_TOKEN_RE);
    assert.match(ticket, TICKET_RE);

    const confirmTokenAsTicket = await postJson(base, "/api/sign/continue", cookie, { ticket: confirmToken, report_id: reportId });
    assert.equal(confirmTokenAsTicket.status, 403);
    assert.equal(confirmTokenAsTicket.body.error, "E_NO_CONFIRM_TOKEN");

    const ticketAsConfirmToken = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken: ticket }));
    assert.equal(ticketAsConfirmToken.status, 403);
    assert.equal(ticketAsConfirmToken.body.error, "E_NO_CONFIRM_TOKEN");

    // Neither swap mutated or answered the record.
    const legit = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(legit.status, 200);
  });
});

test("losing or omitting the ticket cannot mutate or answer the record", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const { cookie, reportId, signRequest: sr, confirmToken } = await openAsChen(base, gate);

    const noTicket = await postJson(base, "/api/sign/continue", cookie, { report_id: reportId });
    assert.equal(noTicket.status, 403);
    assert.equal(noTicket.body.error, "E_NO_CONFIRM_TOKEN");

    const answered = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(answered.status, 200, "the record is still answerable — omitting the ticket was a pure no-op");
  });
});

// ── a malformed POST /api/sign used to take the whole process down ─────────
// L1's original body left report and the former client verdict undefined;
// digest() then rejected the snapshot. The verdict no longer comes from the
// body, but a missing report must still stop before canonicalisation and the
// process must still answer the next request.
//
// Per D-90: a test that only checks the malformed call's own status code
// passes against a server that answered 400 and then died on the very next
// request — so this asserts the SERVER IS STILL ALIVE after, over the SAME
// connection pool, not just that one response looked right. Per D-100: also
// prove the validator isn't stuck shut by immediately sending a genuinely
// well-formed body afterward and requiring it to succeed.
test("a malformed POST /api/sign returns 400, authority claims are rejected, and an ID-only request still works right after", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const malformed = await postJson(base, "/api/sign", cookie, {});
    assert.equal(malformed.status, 400, `expected 400, the server must not crash on this: ${JSON.stringify(malformed)}`);
    assert.equal(malformed.body.error, "E_BAD_SIGN_REQUEST");
    assert.match(malformed.body.message, /report_id/);

    const unknown = await postJson(base, "/api/sign", cookie, openBody(freshReportId()));
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.error, "E_REPORT_NOT_FOUND");

    // D-90: prove the server is ALIVE, not merely that one response looked
    // right — a real request, over a real connection, must still resolve.
    const alive = await postJson(base, "/api/me", cookie, {});
    // /api/me is GET-only in this server, so a POST here answers with
    // whatever that route emits for a wrong method (its own concern) — the
    // only thing THIS assertion needs is a real HTTP response at all,
    // proving the process did not exit. A dead process gives fetch() a
    // connection-refused rejection, not any status code.
    assert.ok(typeof alive.status === "number", "the server must still be answering requests at all");

    // Same check with a plain GET too, the ordinary way anything alive
    // would be probed.
    const meRes = await fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
    assert.equal(meRes.status, 200, "GET /api/me must still succeed — the process is alive, not merely accepting TCP connections");

    const claimedDraft = await createDraft(base, cookie);
    const claimed = await postJson(base, "/api/sign", cookie, openBody(claimedDraft.reportId, {
      report: claimedDraft.report,
      revision: 999,
      policy_version: "1900-01.9",
      policy_digest: `sha256:${"f".repeat(64)}`,
      verdict: { blocking: 0, violations: [], warning: 0 },
    }));
    assert.equal(claimed.status, 400);
    assert.equal(claimed.body.error, "E_BAD_SIGN_REQUEST");
    assert.match(claimed.body.message, /client authority field/);

    const serverDraft = await createDraft(base, cookie);
    const serverOwned = await postJson(base, "/api/sign", cookie, openBody(serverDraft.reportId));
    assert.equal(serverOwned.status, 200, JSON.stringify(serverOwned.body));
    assert.equal(serverOwned.body.sign_request.revision, serverDraft.report.revision);
    assert.equal(serverOwned.body.sign_request.snapshot.policy_version, REAL_POLICY_VERSION);
    assert.equal(serverOwned.body.sign_request.snapshot.policy_digest, REAL_POLICY_DIGEST);
    assert.deepEqual(serverOwned.body.sign_request.snapshot.verdict, { blocking: 0, violations: [], warning: 0 });

    // D-100: the validator is not stuck shut — a genuinely well-formed body
    // sent immediately after all of the above still opens a real record.
    const wellFormedDraft = await createDraft(base, cookie);
    const wellFormed = await postJson(base, "/api/sign", cookie, openBody(wellFormedDraft.reportId));
    assert.equal(wellFormed.status, 200, `a well-formed request must still succeed: ${JSON.stringify(wellFormed)}`);
    assert.match(wellFormed.body.sign_request.request_id, REQUEST_ID_RE);

    const nullDraft = await createDraft(base, cookie);
    const nullPolicy = await postJson(base, "/api/sign", cookie, openBody(nullDraft.reportId, { policy_version: null, policy_digest: null }));
    assert.equal(nullPolicy.status, 400);
    assert.equal(nullPolicy.body.error, "E_BAD_SIGN_REQUEST");
  });
});

test("POST /api/sign rejects client verdict, policy identity, report and revision fields", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId, report } = await createDraft(base, cookie);
    const body = openBody(reportId, {
      report,
      revision: 999,
      policy_version: "1900-01.9",
      policy_digest: `sha256:${"f".repeat(64)}`,
      verdict: { blocking: 999, violations: [], warning: 999 },
    });
    const opened = await postJson(base, "/api/sign", cookie, body);
    assert.equal(opened.status, 400, JSON.stringify(opened.body));
    assert.equal(opened.body.error, "E_BAD_SIGN_REQUEST");
    assert.match(opened.body.message, /report, revision, policy_version, policy_digest, verdict/);
  });
});

test("POST /api/sign rejects a server-stored $50,000 meal with 422 E_NOT_CLEAN", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie, { amountCents: 5_000_000 });
    const refused = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(refused.status, 422);
    assert.deepEqual(refused.body, {
      error: "E_NOT_CLEAN",
      message: `report ${reportId} has 3 blocking policy violation(s)`,
    });
    assert.equal(gate.peekOpenRequestId(reportId, { sessionId: cookieToSid(cookie) }), null);
    assert.equal(gate.locks.isLocked(reportId), false);
    assert.deepEqual(gate.chain.list(), []);
  });
});

test("a snapshot digest construction failure leaves no request, lock or chain state", () => {
  const reportId = freshReportId();
  const report = clone(SCHEMA.examples[0].snapshot.report);
  report.id = reportId;
  report.owner = "chen";
  report.status = "draft";
  const gate = createSignGate({
    evaluateVerdict: () => ({ blocking: 0, violations: [undefined], warning: 0 }),
    getLiveReport: (id) => id === reportId ? report : null,
    prepareReportCommit: () => () => {},
  });
  assert.throws(
    () => gate.open({
      sessionId: "session-digest-failure",
      personaId: "chen",
      personaName: "Chen Xiao",
      reportId,
      worstCase: "No mutation should publish.",
      violationHistoryCount: 0,
    }),
    /E_CANON_TYPE/,
  );
  assert.equal(gate.peekOpenRequestId(reportId, { sessionId: "session-digest-failure" }), null);
  assert.equal(gate.locks.isLocked(reportId), false);
  assert.deepEqual(gate.chain.list(), []);
});

test("the server supplies complete line provenance before signing and commit", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookieToSid(cookie);
    const { reportId } = await createDraft(base, cookie);
    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const sr = opened.body.sign_request;
    for (const line of sr.snapshot.report.lines) {
      assert.equal(Object.keys(line.provenance).length, 10);
      assert.equal(Object.values(line.provenance).filter((source) => source === "agent").length, 7);
      assert.equal(Object.values(line.provenance).filter((source) => source === "unset").length, 3);
    }
    const confirmToken = gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: sid });
    const responded = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
    assert.equal(responded.status, 200);
    const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
      schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId,
    });
    assert.equal(committed.status, 200, JSON.stringify(committed.body));
    assert.deepEqual(committed.body.artifact.provenance_summary, {
      agent_fields: 7, human_fields: 0, seed_fields: 0, total_fields: 10,
    });
    assert.equal(gate.chain.list().length, 1);
  });
});

test("a legacy report with no provenance map can still be signed and committed", () => {
  const reportId = freshReportId();
  const liveReport = { ...clone(SCHEMA.examples[0].snapshot.report), id: reportId, owner: "chen", status: "draft" };
  for (const line of liveReport.lines) delete line.provenance;
  let publishes = 0;
  const gate = createSignGate({
    getLiveReport: (id) => id === reportId ? liveReport : null,
    prepareReportCommit: () => () => { publishes += 1; },
  });
  const sessionId = "legacy-no-provenance";
  const { signRequest: sr } = gate.open({
    sessionId,
    personaId: "chen",
    personaName: "Chen Xiao",
    reportId,
  });
  assert.ok(sr.snapshot.report.lines.every((line) =>
    Object.values(line.provenance).every((source) => source === "unset")));
  gate.respond({
    requestId: sr.request_id,
    sessionId,
    decision: "signed",
    reason: null,
    method: "click",
    acknowledgedDigest: sr.snapshot_digest,
    acknowledgedRevision: sr.revision,
    confirmToken: gate.peekConfirmTokenForDialog(sr.request_id, { sessionId }),
  });

  const committed = gate.commit({ requestId: sr.request_id, reportId, sessionId });
  assert.equal(committed.status, "committed");
  assert.equal(publishes, 1);
  assert.deepEqual(committed.artifact.provenance_summary, {
    agent_fields: 0, human_fields: 0, seed_fields: 0,
    total_fields: liveReport.lines.length * 10,
  });
});

// ── D-118: x-policyBinding.theFix(a) — E_POLICY_DIGEST_MOVED / E_POLICY_VERSION_MOVED ──
// PM's binding half (D-108): prove a LEGITIMATE commit still succeeds, not
// only that the new refusal fires — here the false-positive direction
// breaks the product. Every test below shares one committed-flow helper so
// the only thing that varies between "moved" and "not moved" is the
// served-policy value the gate is asked to compare against — never the
// shape of the request.
import { POLICY_DOCUMENT } from "../../src/policy.js";
import { digest as ocfDigest } from "../../src/canonical.js";

const REAL_POLICY_VERSION = POLICY_DOCUMENT.version;
const REAL_POLICY_DIGEST = ocfDigest("outpocket/policy/1", POLICY_DOCUMENT);
const MOVED_POLICY_DIGEST = `sha256:${"1".repeat(64)}`;

/** Drives open -> respond(signed) -> commit, with an injectable getServedPolicy. Returns the commit's {status, body}. */
async function signAndCommit(base, gate, { servedAtCommit } = {}) {
  const cookie = await login(base, "chen");
  const sid = cookieToSid(cookie);
  const { reportId } = await createDraft(base, cookie);

  const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
  assert.equal(opened.status, 200, `open must succeed: ${JSON.stringify(opened.body)}`);
  const sr = opened.body.sign_request;
  const confirmToken = gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: sid });

  const responded = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, respondBody(sr, { decision: "signed", confirmToken }));
  assert.equal(responded.status, 200, `respond must succeed: ${JSON.stringify(responded.body)}`);

  if (servedAtCommit !== undefined) gate.__setServedPolicyForTest(servedAtCommit);

  return postJson(base, `/api/reports/${reportId}/commit`, cookie, {
    schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId,
  });
}

function makeGateWithMutableServedPolicy(initial) {
  let served = initial;
  const gate = createSignGate({ getServedPolicy: () => served });
  gate.__setServedPolicyForTest = (v) => { served = v; };
  return gate;
}

test("D-118 / D-108 binding half: a LEGITIMATE commit still succeeds when the served policy is unchanged", async () => {
  const gate = makeGateWithMutableServedPolicy({ version: REAL_POLICY_VERSION, digest: REAL_POLICY_DIGEST });
  await withApp(gate, async (base) => {
    const committed = await signAndCommit(base, gate);
    assert.equal(committed.status, 200, `a legitimate, policy-unmoved commit must still succeed: ${JSON.stringify(committed.body)}`);
    assert.equal(committed.body.status, "committed");
  });
});

test("D-118: a same-version CONTENT swap between sign and commit is refused 409 E_POLICY_DIGEST_MOVED", async () => {
  const gate = makeGateWithMutableServedPolicy({ version: REAL_POLICY_VERSION, digest: REAL_POLICY_DIGEST });
  await withApp(gate, async (base) => {
    const committed = await signAndCommit(base, gate, {
      // the swap: same version, different digest, discovered only at commit.
      servedAtCommit: { version: REAL_POLICY_VERSION, digest: MOVED_POLICY_DIGEST },
    });
    assert.equal(committed.status, 409, `expected 409, the exact attack x-policyBinding.theAttack describes: ${JSON.stringify(committed.body)}`);
    assert.equal(committed.body.error, "E_POLICY_DIGEST_MOVED");
    assert.match(committed.body.message, /policy content moved/);
    assert.deepEqual(Object.keys(committed.body).sort(), ["error", "message"]);
  });
});

test("D-118: a policy VERSION change between sign and commit is refused 409 E_POLICY_VERSION_MOVED (checked before DIGEST_MOVED)", async () => {
  const gate = makeGateWithMutableServedPolicy({ version: REAL_POLICY_VERSION, digest: REAL_POLICY_DIGEST });
  await withApp(gate, async (base) => {
    const committed = await signAndCommit(base, gate, {
      servedAtCommit: { version: "2026-09.1", digest: MOVED_POLICY_DIGEST },
    });
    assert.equal(committed.status, 409, JSON.stringify(committed.body));
    assert.equal(committed.body.error, "E_POLICY_VERSION_MOVED", "version-name changes get their own code, not DIGEST_MOVED, even though the digest also differs");
    assert.match(committed.body.message, /policy version moved/);
    assert.deepEqual(Object.keys(committed.body).sort(), ["error", "message"]);
  });
});

test("D-118: null client policy fields are rejected instead of becoming signing authority", async () => {
  const gate = makeGateWithMutableServedPolicy({ version: REAL_POLICY_VERSION, digest: REAL_POLICY_DIGEST });
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie);
    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId, { policy_version: null, policy_digest: null }));
    assert.equal(opened.status, 400);
    assert.equal(opened.body.error, "E_BAD_SIGN_REQUEST");
  });
});

test("D-118: the default gate rejects an arbitrary client policy digest", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const { reportId } = await createDraft(base, cookie);
    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId, {
      policy_version: "1900-01.9",
      policy_digest: `sha256:${"f".repeat(64)}`,
    }));
    assert.equal(opened.status, 400, JSON.stringify(opened.body));
    assert.equal(opened.body.error, "E_BAD_SIGN_REQUEST");
  });
});

// ── QA's unmeasured adversarial case: is validation-vs-authorization decidable from the outside? ──
// L1's ask: nobody without write authorization could send a well-formed-
// SHAPED body with garbage CONTENT to find out. This node is in exactly
// the right place to answer it directly: authorizeWrite() runs BEFORE
// readJsonBody() on POST /api/sign (server/index.mjs), so the two failure
// classes never share a status code — an unauthorized caller ALWAYS gets
// 403 regardless of body content, and an authorized caller's body content
// is what determines 400/409/200. The boundary is decidable from the
// outside: 403 means role, never content; 400/409 means content, never role.
test("YES, decidable from the outside: an unauthorized session gets 403 regardless of body content, and body content never surfaces as 403", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const ruizCookie = await login(base, "ruiz");
    const chenCookie = await login(base, "chen");

    // Garbage-shaped-but-well-formed-JSON body, from a session with NO
    // write access: must be 403, and the code must be the authz code, not
    // anything content-related.
    const unauthorized = await postJson(base, "/api/sign", ruizCookie, { this_is: "garbage", report: 12345, verdict: "not an object" });
    assert.equal(unauthorized.status, 403);
    assert.equal(unauthorized.body.error, "E_ROLE_FORBIDDEN");

    // The SAME garbage body, from a session WITH write access: must NOT be
    // 403 — it reaches content validation instead (E_BAD_SIGN_REQUEST,
    // since report/verdict here are the wrong type but not undefined —
    // this module validates presence, not deep shape, and that is a
    // separate, honestly-scoped gap noted rather than silently patched
    // here, since D-118 is about policy identity, not payload schema
    // validation).
    const authorized = await postJson(base, "/api/sign", chenCookie, { report_id: freshReportId(), this_is: "garbage", report: 12345, verdict: "not an object", policy_version: "x", policy_digest: "y" });
    assert.notEqual(authorized.status, 403, `an authorized session's body content must never surface as 403: ${JSON.stringify(authorized.body)}`);
  });
});
