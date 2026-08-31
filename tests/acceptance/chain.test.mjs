// tests/acceptance/chain.test.mjs — node S7, the SHA-256 hash chain over
// the day book.
//
// "The source field must be inside the digest, otherwise provenance is
// decoration." This file proves: (1) the real chain, produced by real
// sign+commit flows over a real HTTP server, recomputes and verifies
// end-to-end via GET /api/daybook using src/canonical.js — no second
// canonicaliser; (2) per D-108, the verifier returns the POSITIVE on the
// real, untampered chain — a detector that rejects everything is exactly
// as useless as one that rejects nothing; (3) flipping a single byte of
// one entry's `source` field is caught, AT THAT EXACT INDEX, not merely
// "somewhere"; (4) per D-100, an honestly re-serialised entry (key order,
// whitespace, a JSON round-trip) verifies IDENTICALLY to the original —
// the same discipline S6's five canonicalisation attacks proved for report
// content, one artifact over.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { createApp } from "../../server/index.mjs";
import { createSignGate } from "../../server/sign.mjs";
import { createChain, verifyChain, CHAIN_DIGEST_PREFIX, GENESIS_DIGEST } from "../../server/chain.mjs";
import { digest } from "../../src/canonical.js";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url));
const SCHEMA = JSON.parse(readFileSync(schemaPath, "utf8"));

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

let nextReportId = 1;
function freshReportId() {
  return `RP-CHAIN-${nextReportId++}`;
}

function openBody(reportId) {
  return {
    report_id: reportId,
    worst_case: "Submitting makes this report final.",
    violation_history_count: 0,
  };
}

async function withApp(gate, fn) {
  const app = createApp({ signGate: gate });
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
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona }),
  });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie").split(";")[0];
}

async function postJson(base, path, cookie, body) {
  const res = await fetch(`${base}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function getJson(base, path, cookie) {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie } });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function createDraft(base, cookie) {
  const created = await postJson(base, "/api/reports", cookie, {
    title: "Chain fixture",
    project: "FALCON",
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const reportId = created.body.report_id;
  const added = await postJson(base, `/api/reports/${reportId}/lines`, cookie, {
    date: "2026-08-20",
    merchant: "Heron Cafeteria",
    category: "meals",
    amount_cents: 1820,
    currency: "USD",
    attendees: 1,
    description: "Lunch",
  });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  return reportId;
}

/** Drives one full open -> respond(signed) -> commit cycle for a fresh report. Returns the commit result. */
async function signAndCommitOnce(base, gate, cookie, sid) {
  const reportId = await createDraft(base, cookie);
  const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  const sr = opened.body.sign_request;
  const confirmToken = gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: sid });
  const responded = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, {
    schema: "outpocket.sign_respond_request/1", request_id: sr.request_id, decision: "signed", reason: null,
    method: "click", acknowledged_digest: sr.snapshot_digest, acknowledged_revision: sr.revision, confirm_token: confirmToken,
  });
  assert.equal(responded.status, 200, JSON.stringify(responded.body));
  const committed = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
    schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId,
  });
  assert.equal(committed.status, 200, JSON.stringify(committed.body));
  assert.equal(committed.body.status, "committed");
  return committed.body;
}

test("the real day book (GET /api/daybook, built from real commits) recomputes and verifies end-to-end via src/canonical.js — the real chain returns the POSITIVE (D-108)", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookie.split("=")[1];

    // THREE real commits — "verify every link" is true of a zero- or
    // one-entry chain too, so the count must be non-zero AND match what
    // the day book actually returned, not merely be present.
    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);

    const daybook = await getJson(base, "/api/daybook", cookie);
    assert.equal(daybook.status, 200);
    const entries = daybook.body.entries;
    assert.equal(daybook.body.head, entries.at(-1).entry_digest);
    assert.deepEqual(daybook.body.verification, { ok: true, brokenAtIndex: null, reason: null });
    console.log(`day book: ${entries.length} entr${entries.length === 1 ? "y" : "ies"}`);
    assert.ok(Array.isArray(entries) && entries.length > 0, "the entry count must be non-zero — a for-loop over nothing exits 0 and proves nothing");
    assert.equal(entries.length, 3, "the entry count must match what actually happened, not merely be non-zero");

    // Cross-check: verifyChain uses EXACTLY src/canonical.js's digest(),
    // never a second definition — recompute the first entry's digest by
    // hand with the same prefix and confirm it agrees.
    const { entry_digest, ...rest } = entries[0];
    assert.equal(digest(CHAIN_DIGEST_PREFIX, rest), entry_digest);

    // D-108: the verifier must return the POSITIVE on the real, untampered
    // chain. A detector that rejects everything is as useless as one that
    // rejects nothing — this is the check that catches that failure mode.
    const result = verifyChain(entries);
    assert.equal(result.ok, true, `the real chain must verify clean: ${JSON.stringify(result)}`);
    assert.equal(result.brokenAtIndex, null);
  });
});

test("flipping a single byte of one entry's `source` field is caught AT THAT EXACT INDEX, not merely somewhere", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookie.split("=")[1];

    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);

    const daybook = await getJson(base, "/api/daybook", cookie);
    const entries = daybook.body.entries;
    assert.equal(entries.length, 4);

    // Tamper the THIRD entry specifically (index 2) — not the first, not
    // the last, so "caught at the right index" is a real claim and not an
    // accident of always picking index 0.
    const targetIndex = 2;
    assert.equal(entries[targetIndex].source, "human", "test setup: this entry must actually carry 'human' to flip");
    const tampered = entries.map((e, i) => (i === targetIndex ? { ...e, source: "Human" } : e)); // one-byte case flip: h -> H

    const result = verifyChain(tampered);
    assert.equal(result.ok, false, "a single flipped byte in `source` must be caught");
    assert.equal(result.brokenAtIndex, targetIndex, `must name the EXACT tampered entry (${targetIndex}), not merely detect a problem`);

    // AND every entry BEFORE the tamper still links correctly — the chain
    // does not spuriously implicate an earlier, untouched entry.
    const untamperedPrefix = verifyChain(tampered.slice(0, targetIndex));
    assert.equal(untamperedPrefix.ok, true, "entries before the tamper must still verify on their own");

    // Confirm the ORIGINAL, untampered array still verifies clean — proves
    // the tamper (not some pre-existing corruption) is what broke it.
    assert.equal(verifyChain(entries).ok, true);
  });
});

test("D-100 / the S6 discipline applied one artifact over: an honestly re-serialised entry (key order, whitespace, a JSON round-trip) verifies IDENTICALLY — only real content changes are caught", async () => {
  const gate = createSignGate();
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookie.split("=")[1];
    await signAndCommitOnce(base, gate, cookie, sid);
    await signAndCommitOnce(base, gate, cookie, sid);

    const daybook = await getJson(base, "/api/daybook", cookie);
    const entries = daybook.body.entries;
    assert.equal(entries.length, 2);
    assert.equal(verifyChain(entries).ok, true, "baseline: the real chain verifies");

    // Attack 1: key order. Same values, keys written in reverse.
    const reordered = entries.map((e) => Object.fromEntries(Object.entries(e).reverse()));
    assert.equal(verifyChain(reordered).ok, true, "key order must not change verification");

    // Attack 2: whitespace / a full JSON round-trip through a differently
    // formatted encoding — by the time this is parsed back it is the
    // identical value, which is exactly the point.
    const roundTripped = JSON.parse(JSON.stringify(entries, null, 4));
    assert.equal(verifyChain(roundTripped).ok, true, "a JSON round-trip through different formatting must not change verification");

    // And the discriminating case: a REAL content change (not a
    // reformatting) in a non-source field is STILL caught — proving the
    // canonicalisation tolerance above isn't simply "accepts everything".
    const realChange = entries.map((e, i) => (i === 0 ? { ...e, actor: "Someone Else" } : e));
    const changedResult = verifyChain(realChange);
    assert.equal(changedResult.ok, false, "a genuine content change must still be caught");
    assert.equal(changedResult.brokenAtIndex, 0);
  });
});

// ── S7 x D-118: a REFUSED commit must not append a chain entry ──────────
// These two nodes were built independently against the same commit()
// baseline (S7 replaced the in-memory chain stand-in with real
// chain.append(); D-118 inserted the policy-identity check before S6's
// recon check) and this exact property — does the day book record a
// commit that did not happen — is the one no single-node suite could see,
// because neither existed against a commit() containing the other. Proven
// explicitly here, post-merge, rather than left as an accident of merge
// order: chain.append() must run strictly AFTER both refusal checks, so a
// 409 from EITHER one leaves the day book exactly as it was.
import { POLICY_DOCUMENT } from "../../src/policy.js";

test("S7 x D-118: a commit refused by E_POLICY_DIGEST_MOVED appends NOTHING to the day book", async () => {
  const realPolicy = { version: POLICY_DOCUMENT.version, digest: digest("outpocket/policy/1", POLICY_DOCUMENT) };
  let served = realPolicy;
  const gate = createSignGate({ getServedPolicy: () => served });
  await withApp(gate, async (base) => {
    const cookie = await login(base, "chen");
    const sid = cookie.split("=")[1];

    // One legitimate commit first, so there IS a day book to protect.
    await signAndCommitOnce(base, gate, cookie, sid);
    const before = (await getJson(base, "/api/daybook", cookie)).body.entries;
    assert.equal(before.length, 1);

    // Open a SECOND sign request signed under the real policy, then swap
    // the served policy out from under it before committing.
    const reportId = await createDraft(base, cookie);
    const opened = await postJson(base, "/api/sign", cookie, openBody(reportId));
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    const sr = opened.body.sign_request;
    const confirmToken = gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: sid });
    const responded = await postJson(base, `/api/sign/${sr.request_id}/respond`, cookie, {
      schema: "outpocket.sign_respond_request/1", request_id: sr.request_id, decision: "signed", reason: null,
      method: "click", acknowledged_digest: sr.snapshot_digest, acknowledged_revision: sr.revision, confirm_token: confirmToken,
    });
    assert.equal(responded.status, 200);

    served = { version: realPolicy.version, digest: `sha256:${"2".repeat(64)}` }; // the swap

    const refused = await postJson(base, `/api/reports/${reportId}/commit`, cookie, {
      schema: "outpocket.commit_request/1", request_id: sr.request_id, report_id: reportId,
    });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error, "E_POLICY_DIGEST_MOVED");

    const after = (await getJson(base, "/api/daybook", cookie)).body.entries;
    assert.equal(after.length, before.length, "a REFUSED commit must not append a chain entry — the day book must not record a commit that did not happen");
    assert.deepEqual(after, before, "not just the same length — byte-identical, nothing was touched");
  });
});

test("S7 x D-118: a commit refused by E_SNAPSHOT_MISMATCH appends NOTHING to the gate's day book", () => {
  const reportId = freshReportId();
  let liveReport = { ...clone(SCHEMA.examples[0].snapshot.report), id: reportId, owner: "chen", status: "draft" };
  const gate = createSignGate({
    getLiveReport: () => liveReport,
    prepareReportCommit: () => () => {},
  });
  const { signRequest: sr } = gate.open({
    sessionId: "chain-session",
    personaId: "chen",
    personaName: "Chen Xiao",
    reportId,
  });
  gate.respond({
    requestId: sr.request_id,
    sessionId: "chain-session",
    decision: "signed",
    reason: null,
    method: "click",
    acknowledgedDigest: sr.snapshot_digest,
    acknowledgedRevision: sr.revision,
    confirmToken: gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: "chain-session" }),
  });
  liveReport = { ...liveReport, title: "TAMPERED" };

  assert.throws(
    () => gate.commit({ requestId: sr.request_id, reportId, sessionId: "chain-session" }),
    (error) => error.code === "E_SNAPSHOT_MISMATCH" && error.http === 409,
  );
  assert.deepEqual(gate.chain.list(), []);
});

test("a digest failure in chain preparation leaves seq, head and entries untouched", () => {
  const chain = createChain({ now: () => new Date("2026-08-30T12:00:00.000Z") });
  assert.throws(
    () => chain.append({ kind: "commit", detail: undefined }),
    /E_CANON_TYPE/,
  );
  assert.deepEqual(chain.list(), []);
  assert.equal(chain.currentHead(), GENESIS_DIGEST);

  const first = chain.append({ kind: "commit", detail: "CH-0001" });
  assert.equal(first.seq, 1, "the failed preparation must not consume sequence 1");
  assert.equal(first.prev, GENESIS_DIGEST);
});

test("a report that becomes blocking before commit returns 422 E_NOT_CLEAN and appends nothing", () => {
  const reportId = freshReportId();
  let liveReport = { ...clone(SCHEMA.examples[0].snapshot.report), id: reportId, owner: "chen", status: "draft" };
  const gate = createSignGate({
    getLiveReport: () => liveReport,
    prepareReportCommit: () => () => {},
  });
  const { signRequest: sr } = gate.open({
    sessionId: "blocking-session",
    personaId: "chen",
    personaName: "Chen Xiao",
    reportId,
  });
  gate.respond({
    requestId: sr.request_id,
    sessionId: "blocking-session",
    decision: "signed",
    reason: null,
    method: "click",
    acknowledgedDigest: sr.snapshot_digest,
    acknowledgedRevision: sr.revision,
    confirmToken: gate.peekConfirmTokenForDialog(sr.request_id, { sessionId: "blocking-session" }),
  });
  liveReport = clone(liveReport);
  liveReport.lines[0].amount_cents = 5_000_000;
  liveReport.lines[0].usd_cents = 5_000_000;
  liveReport.total_usd_cents = liveReport.lines.reduce((sum, line) => sum + line.usd_cents, 0);

  assert.throws(
    () => gate.commit({ requestId: sr.request_id, reportId, sessionId: "blocking-session" }),
    (error) => error.code === "E_NOT_CLEAN" && error.http === 422,
  );
  assert.deepEqual(gate.chain.list(), []);
  assert.equal(gate.chain.currentHead(), GENESIS_DIGEST);
});
