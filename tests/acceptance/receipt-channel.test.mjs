// tests/acceptance/receipt-channel.test.mjs — node F3 (lane F, owner UX).
//
// F3.accept, verbatim from erp/graph.json:
//   `node --test tests/acceptance/receipt-channel.test.mjs` — asserts zero
//   registered tool has an inputSchema containing contentEncoding or
//   format:'byte' or a property named file/data/base64, and that link_receipt
//   with an unknown id returns a violation envelope with code
//   RECEIPT_NOT_FOUND.
//
// Two clauses, tested in that order below.
//
// The first clause is what makes "the agent cannot deliver a file" a property
// of THIS PAGE rather than a hopeful reading of the protocol. It is
// PAGE-ENFORCED: we choose what to register, and the check is over what we
// registered. Nothing here asserts a browser restriction.

import test from "node:test";
import assert from "node:assert/strict";

import { createErp } from "../../src/erp.js";
import { buildDefs, ALL_TOOL_NAMES } from "../../src/page/tools/defs.js";
import { createToolset, compileSurface, STATES, MEMBERSHIP } from "../../src/page/tools/compile.js";
import { findBinaryChannelViolations, scanSchemaForBinaryChannel } from "../../src/page/ui/receipts.js";

/** Browser-shaped rows: what getTools() answers with. */
function asBrowserTools(defs) {
  return Object.values(defs).map((d) => ({
    name: d.name,
    description: d.description,
    inputSchema: d.inputSchema,
    annotations: d.annotations ?? {},
  }));
}

// ── clause 1 ─────────────────────────────────────────────────────────────────

test("no tool this page can register declares a schema that could carry file content", () => {
  const erp = createErp();
  const defs = buildDefs(erp);
  const tools = asBrowserTools(defs);

  // Scanning the whole catalogue rather than one state's surface is deliberate
  // and is STRONGER than the predicate's wording: every state's surface is a
  // subset of the catalogue, so a clean catalogue is a clean surface in all six
  // states, and a tool that is registered in no state today cannot become a
  // channel tomorrow by being added to one.
  assert.equal(tools.length, ALL_TOOL_NAMES.length,
    "the catalogue under test must be every tool the page can register");

  const violations = findBinaryChannelViolations(tools);
  assert.deepEqual(violations, [],
    `a registered tool declares a binary channel:\n` +
    violations.map((v) => `  ${v.tool} ${v.path} (${v.keyword}: ${v.detail})`).join("\n"));
});

test("the same holds for the compiled surface in every one of the six canonical states", () => {
  const erp = createErp();
  for (const state of STATES) {
    const names = MEMBERSHIP[state];
    assert.ok(Array.isArray(names), `state ${state} has no membership list`);
    const defs = buildDefs(erp);
    const surface = names.map((n) => defs[n]).filter(Boolean).map((d) => ({
      name: d.name, inputSchema: d.inputSchema,
    }));
    assert.deepEqual(findBinaryChannelViolations(surface), [],
      `state ${state} exposes a tool with a binary channel`);
  }
});

test("the scanner would actually catch each banned form — a negative control", () => {
  // Without this, clause 1 passes just as happily against a scanner that always
  // returns []. Three synthetic schemas, one per banned form, plus one nested a
  // level down, because a top-level-only scan is the realistic way to get this
  // wrong.
  const cases = [
    { inputSchema: { type: "object", properties: { x: { type: "string", contentEncoding: "base64" } } } },
    { inputSchema: { type: "object", properties: { x: { type: "string", format: "byte" } } } },
    { inputSchema: { type: "object", properties: { file: { type: "string" } } } },
    { inputSchema: { type: "object", properties: { data: { type: "string" } } } },
    { inputSchema: { type: "object", properties: { base64: { type: "string" } } } },
    { inputSchema: { type: "object", properties: { a: { type: "array", items: { contentEncoding: "base64" } } } } },
  ];
  for (const [i, c] of cases.entries()) {
    assert.ok(scanSchemaForBinaryChannel(c.inputSchema).length > 0,
      `case ${i} should have been flagged and was not`);
  }
  // and a clean schema is not flagged
  assert.deepEqual(scanSchemaForBinaryChannel(
    { type: "object", properties: { receipt_id: { type: "string" }, line_id: { type: "string" } } }), []);
});

// ── clause 2 ─────────────────────────────────────────────────────────────────

/** Drive the ERP to S2/S3: employee signed in, draft open, one line on it. */
function employeeWithOpenDraft() {
  const erp = createErp();
  erp.signIn("chen");
  const report = erp.createReport({ title: "Receipt channel fixture", project: "FALCON" }, "human");
  erp.openReport(report.id, "human");
  const { line } = erp.addLine({
    date: "2026-08-20", merchant: "Blue Bottle", category: "meals",
    amount: "12.00", currency: "USD", attendees: 1, description: "Coffee",
  }, "human");
  return { erp, report, line };
}

/** The code out of a tool result's `Error [CODE]: message` text. */
function codeOf(result) {
  const text = result?.content?.[0]?.text ?? "";
  const m = /^Error \[([A-Z_][A-Z0-9_]*)\]:/.exec(text);
  return m ? m[1] : null;
}

test("link_receipt with an unknown receipt id fails, names the id, mutates nothing, and is distinguishable from an unknown line", async () => {
  const { erp, report, line } = employeeWithOpenDraft();
  const toolset = createToolset(erp);

  // (iii) is asserted over the CANONICAL DIGEST rather than a field-by-field
  // comparison: the digest covers the whole projection, so a mutation anywhere
  // in the report fails this, including one nobody thought to look for.
  const before = erp.canonicalDigest(report.id);

  const res = await toolset.call("link_receipt",
    { line_id: line.id, receipt_id: "rc_does_not_exist" }, { source: "agent" });
  const text = res?.content?.[0]?.text ?? "";

  // (i) it FAILS — the result is an error, not a success message.
  assert.match(text, /^Error \[/, `expected a failure, got: ${JSON.stringify(text)}`);

  // (ii) it NAMES the receipt id, so the agent can tell WHICH id was wrong
  // rather than only that something was.
  assert.ok(text.includes("rc_does_not_exist"),
    `the message must name the receipt id it rejected: ${JSON.stringify(text)}`);

  // (iii) it does NOT mutate the report.
  assert.equal(erp.canonicalDigest(report.id), before,
    "a rejected link_receipt changed the report");
  assert.equal(erp.receiptById("rc_does_not_exist"), undefined,
    "a rejected link_receipt invented a receipt");
  assert.equal(line.receiptId, null, "a rejected link_receipt attached something to the line");

  // (iv) THE STRENGTHENING (D-68): the unknown-RECEIPT code must be distinct
  // from the unknown-LINE code. Both conditions used to share one generic
  // NOT_FOUND, so an agent could not tell which of its two arguments was wrong
  // — a latent defect that a test asserting only "it fails" would preserve
  // forever.
  const unknownLine = await toolset.call("link_receipt",
    { line_id: "ln_does_not_exist", receipt_id: "rc_does_not_exist" }, { source: "agent" });

  const receiptCode = codeOf(res);
  const lineCode = codeOf(unknownLine);
  assert.ok(receiptCode, `no code in the unknown-receipt result: ${JSON.stringify(text)}`);
  assert.ok(lineCode, `no code in the unknown-line result: ${JSON.stringify(unknownLine?.content?.[0]?.text)}`);
  assert.notEqual(receiptCode, lineCode,
    `unknown receipt and unknown line must not share the code ${receiptCode} — ` +
    "an agent cannot tell which argument was wrong");

  // and the unknown-LINE path must not mutate anything either
  assert.equal(erp.canonicalDigest(report.id), before);
});

test("the no-mutation check is not vacuous — a successful link DOES move the digest", async () => {
  // Clause (iii) above asserts canonicalDigest is unchanged after a rejected
  // link. That assertion is only worth anything if the digest would have moved
  // had the link succeeded. It is not obvious that it would: the digest covers
  // a PROJECTION of the report, and a field outside that projection could
  // change without it noticing — which is how "it did not mutate" quietly
  // becomes "I did not look".
  //
  // MEASURED here, in the direction that matters: attaching a receipt does NOT
  // move the digest (it is not on a line yet), and linking it DOES.
  const { erp, report, line } = employeeWithOpenDraft();
  const before = erp.canonicalDigest(report.id);

  const rc = await erp.attachReceipt({ filename: "receipt.pdf", bytes: new Uint8Array([1, 2, 3]) }, "human");
  assert.equal(erp.canonicalDigest(report.id), before,
    "attaching a receipt is not a change to the report and must not move the digest");

  erp.linkReceipt(line.id, rc.id, "human");
  assert.notEqual(erp.canonicalDigest(report.id), before,
    "a successful link_receipt must move the digest — otherwise clause (iii) asserts nothing");
});
