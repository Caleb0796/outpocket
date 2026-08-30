// tests/acceptance/sign-dialog.test.mjs — node F4 (lane F, owner UX).
//
// THE PREDICATE'S CENTRAL CLAUSE IS SATISFIED BY A LIE, SO IT IS NOT THE TEST
// THAT MATTERS. /you are certifying .+ if this is wrong, .+/i is matched by
// "You are certifying something. If this is wrong, something happens." — which
// passes the gate and discloses nothing. So the regex is asserted (it is the
// predicate) AND the disclosure is asserted separately: the sentence must NAME
// the report id, the line count and the total, read out of live dialog state,
// and TWO DIFFERENT REPORTS MUST PRODUCE DIFFERENT SENTENCES. A certification
// text identical across two reports is a ritual, not a disclosure.
//
// SAME FAMILY, TWICE MORE:
//   * "cannot be confirmed while empty" is asserted by DISPATCHING A CLICK and
//     proving no POST happened — not by reading a `disabled` attribute, which
//     is what the markup SAYS rather than what the page DOES. The two come
//     apart the moment anything re-enables the control, so there is also a test
//     that force-enables the button and calls the submit path directly.
//   * the request_id in the POST is asserted EQUAL to the one the dialog was
//     opened with. "A POST happened" does not exclude signing the wrong report,
//     which is the exact failure this product exists to prevent.
//
// THERE IS NO DOM IN NODE and no jsdom in this repo (ajv is the only
// dependency), so this file carries a small fake document — the same approach
// tests/acceptance/banner.test.mjs takes. It supports the four selector forms
// this dialog uses, sibling order, and real addEventListener/dispatchEvent,
// because a click that does not actually reach the handler would make the
// no-POST assertion vacuous. It is NOT evidence about a browser and nothing
// here claims it is; the browser reading is reported separately.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";  // the frozen contracts are draft 2020-12; plain Ajv is draft-07

import {
  renderSignDialog, certificationSentence, certifiedFacts, respondBody,
  submitDecision, canConfirm, restartSignRequest, ALREADY_ANSWERED_TEXT,
} from "../../src/page/ui/sign-dialog.js";

// ── the fake document ────────────────────────────────────────────────────────

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this._text = "";
    this.value = "";
    this.listeners = new Map();
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); if (k === "disabled") this.disabled = true; }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); if (k === "disabled") this.disabled = false; }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text; }
  get previousElementSibling() {
    if (!this.parent) return null;
    const i = this.parent.children.indexOf(this);
    return i > 0 ? this.parent.children[i - 1] : null;
  }
  matches(sel) {
    const attr = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(sel);
    if (attr) {
      const [, name, want] = attr;
      if (!this.attributes.has(name)) return false;
      return want === undefined || this.attributes.get(name) === want;
    }
    const cls = /^\.([\w-]+)$/.exec(sel);
    if (cls) return (this.getAttribute("class") ?? "").split(/\s+/).includes(cls[1]);
    return this.tagName === sel.toUpperCase();
  }
  querySelector(sel) {
    for (const c of this.children) {
      if (c.matches(sel)) return c;
      const deep = c.querySelector(sel);
      if (deep) return deep;
    }
    return null;
  }
  querySelectorAll(sel) {
    const out = [];
    for (const c of this.children) {
      if (c.matches(sel)) out.push(c);
      out.push(...c.querySelectorAll(sel));
    }
    return out;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  dispatchEvent(ev) { for (const fn of this.listeners.get(ev.type) ?? []) fn(ev); return true; }
  click() { return this.dispatchEvent({ type: "click", target: this }); }
}

const fakeDoc = { createElement: (tag) => new FakeNode(tag) };

// ── fixtures ─────────────────────────────────────────────────────────────────

function signRequestFor({ requestId, reportId, lines, worstCase, revision = 3 }) {
  return {
    request_id: requestId,
    report_id: reportId,
    persona_name: "Chen Xiao",
    revision,
    policy_version: "2026.08.1",
    snapshot_digest: "sha256:" + "a".repeat(64),
    worst_case: worstCase,
    violation_history_count: 0,
    snapshot: { kind: "outpocket.snapshot", ocf: 1, report: { id: reportId, lines } },
  };
}

const REPORT_A = signRequestFor({
  requestId: "sg_" + "1".repeat(16), reportId: "RP-1018",
  lines: [{ usdCents: 12_00 }, { usdCents: 400_55 }, { usdCents: 33_00 }],
  worstCase: "your employer pays a claim that is not owed, in your name, and unwinding it is an audit finding against you.",
});

const REPORT_B = signRequestFor({
  requestId: "sg_" + "2".repeat(16), reportId: "RP-1099",
  lines: [{ usdCents: 8_10 }],
  worstCase: "your employer pays a claim that is not owed, in your name, and unwinding it is an audit finding against you.",
});

const TOKEN = "ct_" + "b".repeat(32);

/** A fetch spy: records every call, answers with whatever is queued. */
function spyFetch(responses = []) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const next = responses.shift() ?? { status: 200, payload: { ok: true } };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.payload,
    };
  };
  impl.calls = calls;
  return impl;
}

// ── the predicate's own clause ───────────────────────────────────────────────

test("the element immediately preceding [data-signature-line] matches the predicate's regex and is non-empty", () => {
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN });
  const line = root.querySelector("[data-signature-line]");
  assert.ok(line, "no [data-signature-line]");

  const preceding = line.previousElementSibling;
  assert.ok(preceding, "[data-signature-line] has no preceding element");
  assert.ok(preceding.hasAttribute("data-worst-case"),
    "the element immediately preceding the signature line is not [data-worst-case]");
  assert.ok(preceding.textContent.trim().length > 0, "the worst-case element is empty");
  assert.match(preceding.textContent, /you are certifying .+ if this is wrong, .+/i);
});

// ── the clause the predicate does not make: is it a DISCLOSURE? ──────────────

test("the certification sentence NAMES the report, the line count and the total", () => {
  const sentence = certificationSentence(REPORT_A);
  const facts = certifiedFacts(REPORT_A);
  assert.equal(facts.reportId, "RP-1018");
  assert.equal(facts.lineCount, 3);
  assert.equal(facts.totalCents, 445_55);

  assert.ok(sentence.includes("RP-1018"), "sentence does not name the report");
  assert.ok(sentence.includes("3 lines"), "sentence does not state the line count");
  assert.ok(sentence.includes("$445.55"), "sentence does not state the total");
  assert.ok(sentence.includes(REPORT_A.worst_case), "sentence does not carry the worst case");
});

test("TWO DIFFERENT REPORTS PRODUCE DIFFERENT SENTENCES — a ritual would produce one", () => {
  const a = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN })
    .querySelector("[data-worst-case]").textContent;
  const b = renderSignDialog(fakeDoc, { signRequest: REPORT_B, confirmToken: TOKEN })
    .querySelector("[data-worst-case]").textContent;

  assert.notEqual(a, b, "the certification text is identical across two different reports");
  // and both still satisfy the predicate, so the difference is not bought by
  // breaking the gate
  assert.match(a, /you are certifying .+ if this is wrong, .+/i);
  assert.match(b, /you are certifying .+ if this is wrong, .+/i);
  // named differently in the specific ways that matter
  assert.ok(a.includes("RP-1018") && !a.includes("RP-1099"));
  assert.ok(b.includes("RP-1099") && !b.includes("RP-1018"));
  assert.ok(b.includes("1 line,"), "singular line count is not pluralised correctly");
});

// ── cannot be confirmed while empty: what the page DOES ─────────────────────

test("a real click on confirm posts NOTHING while the worst-case element is empty", async () => {
  // No worst_case => certificationSentence returns null => the element renders
  // empty. Undisclosable means unsignable.
  const undisclosed = { ...REPORT_A, worst_case: null };
  const fetchImpl = spyFetch();
  const root = renderSignDialog(fakeDoc, { signRequest: undisclosed, confirmToken: TOKEN, fetchImpl });

  assert.equal(root.querySelector("[data-worst-case]").textContent, "");
  assert.equal(canConfirm(root), false);

  root.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(fetchImpl.calls, [], "a click posted while the dialog disclosed nothing");
});

test("and it still posts nothing when the button is force-enabled — the guard is in the code, not the attribute", async () => {
  // This is the test that matters. `disabled` states an intention; anything can
  // remove it — a stylesheet, a later script, a judge with devtools. The refusal
  // has to live on the path that sends the request.
  const undisclosed = { ...REPORT_A, worst_case: null };
  const fetchImpl = spyFetch();
  const root = renderSignDialog(fakeDoc, { signRequest: undisclosed, confirmToken: TOKEN, fetchImpl });

  root.querySelector("[data-sign-confirm]").removeAttribute("disabled");
  const result = await submitDecision(root, { signRequest: undisclosed, decision: "signed", fetchImpl, doc: fakeDoc });

  assert.equal(result.posted, false);
  assert.equal(result.refused, "no-disclosure");
  assert.deepEqual(fetchImpl.calls, [], "the submit path posted with nothing disclosed");
});

// ── the POST ────────────────────────────────────────────────────────────────

const ajv = new Ajv2020({ strict: false, allErrors: true });
const signatureSchema = JSON.parse(readFileSync(
  fileURLToPath(new URL("../../erp/contracts/signature.schema.json", import.meta.url)), "utf8"));

// Compile against the WHOLE frozen document and resolve the definition by $ref.
// Compiling the sub-schema in isolation drops the root's $defs, so an internal
// $ref (sign_respond_request references #/$defs/digest) cannot resolve — and it
// fails as an async uncaught exception AFTER the tests report, which reads like
// a passing run with noise attached.
ajv.addSchema(signatureSchema, "signature");
const validateRespond = ajv.getSchema("signature#/$defs/sign_respond_request");
assert.ok(validateRespond, "could not resolve sign_respond_request out of the frozen schema");

test("confirming POSTs to /api/sign/{request_id}/respond a body that validates against the frozen schema", async () => {
  const fetchImpl = spyFetch([{ status: 200, payload: { schema: "outpocket.sign_response/1", decision: "signed" } }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  root.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(fetchImpl.calls.length, 1);
  const [call] = fetchImpl.calls;

  // the URL carries the request_id the dialog was OPENED with
  assert.equal(call.url, `/api/sign/${REPORT_A.request_id}/respond`);

  const body = call.body;
  assert.ok(validateRespond(body),
    `body failed the frozen sign_respond_request: ${JSON.stringify(validateRespond.errors)}`);

  // EXACTLY EIGHT FIELDS. additionalProperties:false makes a ninth invalid and
  // `required` makes a missing eighth invalid; assert the count too, so a field
  // silently going away is caught here and not at the server.
  assert.deepEqual(Object.keys(body).sort(), [
    "acknowledged_digest", "acknowledged_revision", "confirm_token",
    "decision", "method", "reason", "request_id", "schema",
  ]);

  // NO signed_by, NO at, and NO KEY FOR EITHER — the server takes both from the
  // session cookie and its own clock.
  assert.ok(!("signed_by" in body), "the dialog authored signed_by");
  assert.ok(!("at" in body), "the dialog authored a timestamp");
});

test("THE request_id IN THE BODY EQUALS THE ONE THE DIALOG WAS OPENED WITH", async () => {
  // Not merely well-formed. A dialog that posts a syntactically valid id for a
  // DIFFERENT report signs the wrong report, which is the failure this product
  // exists to prevent, and "a POST happened" does not exclude it. Two dialogs
  // are open in this test so that a mix-up has something to mix up with.
  const fetchA = spyFetch([{ status: 200, payload: {} }]);
  const fetchB = spyFetch([{ status: 200, payload: {} }]);
  const rootA = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl: fetchA });
  const rootB = renderSignDialog(fakeDoc, { signRequest: REPORT_B, confirmToken: TOKEN, fetchImpl: fetchB });

  rootB.querySelector("[data-sign-confirm]").click();
  rootA.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(fetchA.calls[0].body.request_id, REPORT_A.request_id);
  assert.equal(fetchA.calls[0].url, `/api/sign/${REPORT_A.request_id}/respond`);
  assert.equal(fetchB.calls[0].body.request_id, REPORT_B.request_id);
  assert.equal(fetchB.calls[0].url, `/api/sign/${REPORT_B.request_id}/respond`);
  assert.notEqual(fetchA.calls[0].body.request_id, fetchB.calls[0].body.request_id);

  // and the acknowledged digest/revision are this dialog's, not the other's
  assert.equal(fetchA.calls[0].body.acknowledged_revision, REPORT_A.revision);
});

test("the confirm_token is read out of THIS dialog's rendered DOM, not from a closure", async () => {
  const fetchImpl = spyFetch([{ status: 200, payload: {} }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  // Overwrite the token IN THE DOM after render. If the module were reading a
  // captured variable, the POST would carry the original and this would fail —
  // which is exactly the difference the accept is asking about.
  const planted = "ct_" + "c".repeat(32);
  root.querySelector("[data-confirm-token]").value = planted;

  root.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(fetchImpl.calls[0].body.confirm_token, planted,
    "the posted confirm_token did not come from the rendered DOM");
});

test("the confirm_token appears exactly once in the dialog and is not echoed into another attribute", () => {
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN });
  const holders = root.querySelectorAll("[data-confirm-token]");
  assert.equal(holders.length, 1);
  assert.equal(holders[0].value, TOKEN);
  // not in any attribute value anywhere, and not in visible text
  const attrValues = [];
  const walk = (n) => { for (const [, v] of n.attributes) attrValues.push(v); n.children.forEach(walk); };
  walk(root);
  assert.ok(!attrValues.includes(TOKEN), "the confirm_token was echoed into an attribute value");
  assert.ok(!root.textContent.includes(TOKEN), "the confirm_token is rendered as visible text");
});

// ── R-34: the recovery ──────────────────────────────────────────────────────

test("409 E_ALREADY_ANSWERED renders the recovery string and offers a control that mints a NEW request_id", async () => {
  const fetchImpl = spyFetch([{ status: 409, payload: { error: "E_ALREADY_ANSWERED" } }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  const result = await submitDecision(root, { signRequest: REPORT_A, decision: "signed", fetchImpl, doc: fakeDoc });
  assert.equal(result.alreadyAnswered, true);

  // the literal string, rendered — not a transport error and not a silent no-op
  const status = root.querySelector("[data-sign-status]");
  assert.equal(status.textContent, ALREADY_ANSWERED_TEXT);
  assert.ok(status.hasAttribute("data-sign-already-answered"));

  // confirm is closed off: the record is one-shot, so retrying this id can only
  // fail again
  assert.ok(root.querySelector("[data-sign-confirm]").hasAttribute("disabled"));

  // and there is a control that starts a NEW one
  const restart = root.querySelector("[data-sign-restart]");
  assert.ok(restart, "no control offered to start a new signature request");

  const fresh = { ...REPORT_A, request_id: "sg_" + "9".repeat(16) };
  const mintFetch = spyFetch([{ status: 200, payload: { sign_request: fresh, ticket: "tk_" + "d".repeat(32) } }]);
  const minted = await restartSignRequest({ signRequest: REPORT_A, fetchImpl: mintFetch, doc: fakeDoc });

  assert.equal(mintFetch.calls[0].url, "/api/sign", "the restart did not open a new sign request");
  assert.notEqual(minted.signRequest.request_id, REPORT_A.request_id,
    "the restart reused the answered request_id — the record is one-shot and this can only fail again");
  assert.match(minted.signRequest.request_id, /^sg_[0-9a-f]{16}$/);
});

test("respondBody is the only place the body shape is decided, and it carries exactly eight keys", () => {
  const body = respondBody({
    requestId: REPORT_A.request_id, decision: "declined", reason: "the meal total looks wrong",
    confirmToken: TOKEN, acknowledgedDigest: REPORT_A.snapshot_digest, acknowledgedRevision: REPORT_A.revision,
  });
  assert.equal(Object.keys(body).length, 8);
  assert.ok(validateRespond(body), JSON.stringify(validateRespond.errors));
});

// ── controls: every assertion above must be able to FAIL ─────────────────────
//
// An assertion nobody has seen fail is a claim, not a check. Three of the ones
// above would pass against a broken implementation without these.

test("CONTROL — the frozen schema rejects the bodies this dialog must never send", () => {
  const good = respondBody({
    requestId: REPORT_A.request_id, decision: "signed", reason: null, confirmToken: TOKEN,
    acknowledgedDigest: REPORT_A.snapshot_digest, acknowledgedRevision: REPORT_A.revision,
  });
  assert.ok(validateRespond(good), "the good body must validate, or nothing below means anything");

  // the two the whole R-1 point turns on
  assert.ok(!validateRespond({ ...good, signed_by: "Chen Xiao" }),
    "the schema accepted signed_by — the no-forgery property is not enforced by the contract");
  assert.ok(!validateRespond({ ...good, at: "2026-08-30T00:00:00Z" }),
    "the schema accepted a client timestamp");

  // and eight means eight
  const seven = { ...good }; delete seven.confirm_token;
  assert.ok(!validateRespond(seven), "the schema accepted a seven-field body");
});

test("CONTROL — the DOM-order assertion would catch an element inserted between", () => {
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN });
  const line = root.querySelector("[data-signature-line]");
  assert.ok(line.previousElementSibling.hasAttribute("data-worst-case"));

  // splice something in between and prove the check notices
  const i = root.children.indexOf(line);
  const intruder = fakeDoc.createElement("p");
  intruder.textContent = "an advert for a credit card";
  intruder.parent = root;
  root.children.splice(i, 0, intruder);

  assert.ok(!line.previousElementSibling.hasAttribute("data-worst-case"),
    "an element was inserted between the consequence and the signature line and the check did not notice");
});

test("CONTROL — a click DOES post when the dialog discloses, so the no-post tests are not vacuous", async () => {
  // Tests 4 and 5 assert fetch was never called. That is only evidence if a
  // click on this fake button CAN reach the handler and CAN produce a call.
  const fetchImpl = spyFetch([{ status: 200, payload: {} }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });
  assert.equal(canConfirm(root), true);

  root.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 0));

  assert.equal(fetchImpl.calls.length, 1,
    "a disclosed dialog did not post on click — so 'it did not post' proves nothing elsewhere in this file");
});

// ── the invariant: a click never leaves the dialog silent ───────────────────
//
// THE DEFECT THESE COVER RENDERED NOTHING AT ALL. submitDecision's fetch was
// unwrapped and the click handler discarded the promise, so a POST that THREW —
// server down, network gone, request aborted — became an unhandled rejection
// and the dialog just sat there. Mid-take, with the camera rolling, and no way
// for the person signing to know why.
//
// Note WHICH case was silent, because it is the counter-intuitive one: a 4xx or
// 5xx always rendered a line, since the response came back and was read. ONLY A
// THROWN FETCH WAS SILENT — and a thrown fetch is precisely what a server that
// has just died produces. The failure mode was invisible in exactly the
// circumstance that produces it.

const statusOf = (root) => root.querySelector("[data-sign-status]")?.textContent ?? "";

test("a POST that THROWS leaves a readable status and offers a retry", async () => {
  const thrown = [];
  const fetchImpl = async () => { thrown.push(1); throw new TypeError("Failed to fetch"); };
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  const r = await submitDecision(root, { signRequest: REPORT_A, decision: "signed", fetchImpl, doc: fakeDoc });

  assert.equal(r.posted, false);
  assert.equal(r.refused, "unreachable");
  assert.ok(statusOf(root).length > 0, "the dialog rendered NOTHING after a failed POST");
  assert.match(statusOf(root), /nothing was signed/i,
    "the status must say plainly that nothing was signed");
  assert.match(statusOf(root), /still open|try again/i,
    "the status must tell the human what to do next");

  // a retry is offered ONLY here, because this is the one case where we know
  // nothing reached the server and the record is untouched
  assert.ok(root.querySelector("[data-sign-retry]"), "no retry offered after an unreachable server");
});

test("a REAL CLICK that throws is caught — the promise is not discarded", async () => {
  // This is the path the shoot actually exercises. The old handler called
  // submitDecision(...) with no catch, so this test would have left the status
  // empty and produced an unhandled rejection instead.
  const fetchImpl = async () => { throw new Error("connection refused"); };
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  root.querySelector("[data-sign-confirm]").click();
  await new Promise((r) => setTimeout(r, 10));

  assert.ok(statusOf(root).length > 0,
    "a click whose POST threw left the dialog silent — this is the shoot-stopping case");
  assert.match(statusOf(root), /nothing was signed/i);
});

test("a server refusal shows the SERVER'S OWN message, not our paraphrase of its code", async () => {
  // New refusal conditions land on this path faster than this file can learn
  // their names — E_POLICY_DIGEST_MOVED is arriving now. A bare code tells the
  // person at the camera nothing; the server already sends a sentence.
  const fetchImpl = spyFetch([{
    status: 409,
    payload: { error: "E_POLICY_DIGEST_MOVED", message: "the policy moved under this signature; re-open the report" },
  }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });

  await submitDecision(root, { signRequest: REPORT_A, decision: "signed", fetchImpl, doc: fakeDoc });

  const text = statusOf(root);
  assert.match(text, /E_POLICY_DIGEST_MOVED/, "the code must be visible for a bug report");
  assert.match(text, /the policy moved under this signature/,
    "the server's own explanation must be shown, not swallowed");
  assert.match(text, /nothing was signed/i);
  // and NO retry here — we do not know the record is untouched
  assert.equal(root.querySelector("[data-sign-retry]"), null,
    "a retry must not be offered for a refusal we cannot prove left the record open");
});

test("CONTROL — the success path still renders, so the checks above are not just 'any text'", async () => {
  const fetchImpl = spyFetch([{ status: 200, payload: { state: "answered", decision: "signed" } }]);
  const root = renderSignDialog(fakeDoc, { signRequest: REPORT_A, confirmToken: TOKEN, fetchImpl });
  await submitDecision(root, { signRequest: REPORT_A, decision: "signed", fetchImpl, doc: fakeDoc });
  assert.match(statusOf(root), /signed/i);
  assert.ok(!/nothing was signed/i.test(statusOf(root)),
    "the success path must not read like a failure");
});
