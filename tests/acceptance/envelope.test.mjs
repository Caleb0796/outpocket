// Node S4. `server/index.mjs` has no expense-write HTTP routes yet — S2
// (per-request authz) and T2 (the tool surface's server wiring) build those,
// downstream of this node. What every one of those routes will call into is
// src/policy.js's validateLine()/validateReport() (S3) followed by this
// node's buildViolationEnvelope() (server/envelope.mjs). So "every write
// route" is exercised here as every rule the policy engine can raise across
// every write operation (add/update a line, link a receipt, create/submit a
// report) — all 19 rule codes, R01 through R19, each producing a real
// envelope from a real policy-engine call, each validated against the frozen
// schema.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { validateLine, validateReport } from "../../src/policy.js";
import { buildViolationEnvelope } from "../../server/envelope.mjs";

const schemaPath = fileURLToPath(new URL("../../erp/contracts/violation.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function assertValid(envelope, label) {
  const ok = validate(envelope);
  assert.ok(ok, `${label}: ${ajv.errorsText(validate.errors)}`);
  for (const key of ["code", "severity", "field", "fix", "candidates"]) {
    assert.ok(Object.hasOwn(envelope, key), `${label}: envelope missing required key '${key}'`);
  }
}

const NOW = new Date(2026, 7, 28, 10, 0, 0);
const baseLineCtx = { now: NOW, receiptById: () => undefined, receiptHashUse: () => undefined, lineId: "ln_x", reportId: "RP-x" };

function mkLine(over = {}) {
  return {
    date: "2026-08-25", merchant: "Test Co", category: "meals",
    amountCents: 1000, usdCents: 1000, currency: "USD",
    attendees: undefined, nights: undefined, itemization: undefined,
    description: "d", receiptId: null, ...over,
  };
}

function findEnvelope(violations, code, entityCtx) {
  const violation = violations.find((v) => v.code === code);
  assert.ok(violation, `expected a ${code} violation from this scenario`);
  return buildViolationEnvelope(violation, entityCtx);
}

// ── One real scenario per rule, R01..R19 ───────────────────────────────
const envelopes = {};

// R01 MISSING_FIELD (line.merchant)
{
  const vs = validateLine(mkLine({ merchant: null }), baseLineCtx);
  envelopes.R01 = findEnvelope(vs, "MISSING_FIELD", { entity: "line", entityId: "ln_1" });
}

// R02 DATE_FUTURE
{
  const vs = validateLine(mkLine({ date: "2026-09-05" }), baseLineCtx);
  envelopes.R02 = findEnvelope(vs, "DATE_FUTURE", { entity: "line", entityId: "ln_2" });
}

// R03 DATE_STALE
{
  const vs = validateLine(mkLine({ date: "2026-04-01" }), baseLineCtx);
  envelopes.R03 = findEnvelope(vs, "DATE_STALE", { entity: "line", entityId: "ln_3" });
}

// R04 CURRENCY_UNSUPPORTED
{
  const vs = validateLine(mkLine({ category: "transport", currency: "AUD", amountCents: 3000, usdCents: null }), baseLineCtx);
  envelopes.R04 = findEnvelope(vs, "CURRENCY_UNSUPPORTED", { entity: "line", entityId: "ln_4" });
}

// R05 CAP_MEALS
{
  const line = mkLine({ amountCents: 18640, usdCents: 18640, attendees: 1, itemization: [{ label: "Entrees", amountCents: 18640 }], receiptId: "rc_1" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_1" ? { sha256: "a".repeat(64), filename: "meal.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R05 = findEnvelope(vs, "CAP_MEALS", { entity: "line", entityId: "ln_5", observed: 18640, limit: 8000 });
}

// R06 CAP_LODGING
{
  const line = mkLine({ category: "lodging", amountCents: 49800, usdCents: 49800, nights: 1, receiptId: "rc_2" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_2" ? { sha256: "b".repeat(64), filename: "folio.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R06 = findEnvelope(vs, "CAP_LODGING", { entity: "line", entityId: "ln_6", observed: 49800, limit: 26000 });
}

// R07 CAP_TRANSPORT — matches erp/CONTRACTS.md §4's worked instance exactly.
{
  const line = mkLine({ category: "transport", amountCents: 21240, usdCents: 21240, receiptId: "rc_3" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_3" ? { sha256: "c".repeat(64), filename: "cab.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R07 = findEnvelope(vs, "CAP_TRANSPORT", { entity: "line", entityId: "ln_4", observed: 21240, limit: 15000 });
}

// R08 CAP_SUPPLIES
{
  const line = mkLine({ category: "supplies", amountCents: 25000, usdCents: 25000, receiptId: "rc_4" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_4" ? { sha256: "d".repeat(64), filename: "office.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R08 = findEnvelope(vs, "CAP_SUPPLIES", { entity: "line", entityId: "ln_8", observed: 25000, limit: 20000 });
}

// R09 AIRFARE_REVIEW (warn)
{
  const line = mkLine({ category: "airfare", amountCents: 150000, usdCents: 150000, receiptId: "rc_5" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_5" ? { sha256: "e".repeat(64), filename: "air.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R09 = findEnvelope(vs, "AIRFARE_REVIEW", { entity: "line", entityId: "ln_9" });
}

// R10 ITEMIZATION_REQUIRED
{
  const line = mkLine({ amountCents: 9000, usdCents: 9000, attendees: 2, receiptId: "rc_6" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_6" ? { sha256: "f".repeat(64), filename: "dinner.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R10 = findEnvelope(vs, "ITEMIZATION_REQUIRED", { entity: "line", entityId: "ln_10" });
}

// R11 ITEMIZATION_GAP (warn)
{
  const line = mkLine({ amountCents: 10000, usdCents: 10000, attendees: 2, itemization: [{ label: "Entrees", amountCents: 5000 }], receiptId: "rc_7" });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_7" ? { sha256: "0".repeat(64), filename: "gap.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R11 = findEnvelope(vs, "ITEMIZATION_GAP", { entity: "line", entityId: "ln_11" });
}

// R12 ALCOHOL
{
  const line = mkLine({
    itemization: [{ label: "Chianti (bottle)", amountCents: 3800 }, { label: "Entrees", amountCents: 6200 }],
    amountCents: 10000, usdCents: 10000, attendees: 2, receiptId: "rc_8",
  });
  const ctx = { ...baseLineCtx, receiptById: (id) => (id === "rc_8" ? { sha256: "1".repeat(64), filename: "wine.pdf" } : undefined) };
  const vs = validateLine(line, ctx);
  envelopes.R12 = findEnvelope(vs, "ALCOHOL", { entity: "line", entityId: "ln_12" });
}

// R13 DESC_REQUIRED
{
  const vs = validateLine(mkLine({ category: "other", description: null, amountCents: 2000, usdCents: 2000 }), baseLineCtx);
  envelopes.R13 = findEnvelope(vs, "DESC_REQUIRED", { entity: "line", entityId: "ln_13" });
}

// R14 RECEIPT_REQUIRED
{
  const vs = validateLine(mkLine({ amountCents: 2500, usdCents: 2500 }), baseLineCtx);
  envelopes.R14 = findEnvelope(vs, "RECEIPT_REQUIRED", { entity: "line", entityId: "ln_14", observed: 2500, limit: 2500 });
}

// R15 RECEIPT_DUP
{
  const line = mkLine({ amountCents: 3000, usdCents: 3000, receiptId: "rc_dup" });
  const ctx = {
    ...baseLineCtx,
    lineId: "ln_15",
    reportId: "RP-9",
    receiptById: (id) => (id === "rc_dup" ? { sha256: "2".repeat(64), filename: "dup.pdf" } : undefined),
    receiptHashUse: (hash) => (hash === "2".repeat(64) ? { lineId: "ln_other", reportId: "RP-9" } : undefined),
  };
  const vs = validateLine(line, ctx);
  envelopes.R15 = findEnvelope(vs, "RECEIPT_DUP", { entity: "line", entityId: "ln_15" });
}

// R16 EMPTY_REPORT
{
  const report = { id: "RP-16", project: "FALCON", lines: [] };
  const session = { name: "chen", projects: [{ code: "FALCON", name: "Falcon", active: true }] };
  const result = validateReport(report, session, { now: NOW, receiptById: () => undefined });
  envelopes.R16 = findEnvelope(result.reportViolations, "EMPTY_REPORT", { entity: "report", entityId: report.id });
}

// R17 PROJECT_SCOPE
{
  const report = { id: "RP-17", project: "UNKNOWN", lines: [] };
  const session = { name: "chen", projects: [{ code: "FALCON", name: "Falcon", active: true }] };
  const result = validateReport(report, session, { now: NOW, receiptById: () => undefined });
  envelopes.R17 = findEnvelope(result.reportViolations, "PROJECT_SCOPE", { entity: "report", entityId: report.id });
}

// R18 PROJECT_INACTIVE
{
  const report = { id: "RP-18", project: "KESTREL", lines: [] };
  const session = { name: "chen", projects: [{ code: "KESTREL", name: "Kestrel", active: false }] };
  const result = validateReport(report, session, { now: NOW, receiptById: () => undefined });
  envelopes.R18 = findEnvelope(result.reportViolations, "PROJECT_INACTIVE", { entity: "report", entityId: report.id });
}

// R19 REPORT_REVIEW (warn)
{
  const report = {
    id: "RP-19", project: "FALCON",
    lines: [
      { id: "ln_20", date: "2026-08-25", merchant: "Air Co", category: "airfare", amountCents: 118000, usdCents: 118000, currency: "USD", receiptId: "rc_20" },
      { id: "ln_21", date: "2026-08-25", merchant: "Air Co 2", category: "airfare", amountCents: 110000, usdCents: 110000, currency: "USD", receiptId: "rc_21" },
    ],
  };
  const session = { name: "chen", projects: [{ code: "FALCON", name: "Falcon", active: true }] };
  const ctx = { now: NOW, receiptById: (id) => (["rc_20", "rc_21"].includes(id) ? { sha256: id, filename: `${id}.pdf` } : undefined) };
  const result = validateReport(report, session, ctx);
  envelopes.R19 = findEnvelope(result.reportViolations, "REPORT_REVIEW", { entity: "report", entityId: report.id });
}

test("every rule code, R01..R19, produces a schema-valid envelope with code/severity/field/fix/candidates present", () => {
  const codes = Object.keys(envelopes);
  assert.equal(codes.length, 19, "one scenario per rule");
  for (const rule of codes) {
    assertValid(envelopes[rule], rule);
  }
});

test("the CAP_TRANSPORT envelope's structural fields match erp/CONTRACTS.md §4's worked instance — `fix` verbatim, `message` in the policy engine's own wording", () => {
  const e = envelopes.R07;
  assert.equal(e.schema, "outpocket.violation/1");
  assert.equal(e.code, "CAP_TRANSPORT");
  assert.equal(e.rule_id, "R07");
  assert.equal(e.severity, "block");
  assert.equal(e.entity, "line");
  assert.equal(e.entity_id, "ln_4");
  assert.equal(e.field, "amount");
  // src/policy.js's own message wording ("exceeds ... cap"), not a retype of
  // the schema's illustrative prose ("is above ... limit") — only `fix` was
  // required to match verbatim, since that string is what x-fixLint grades.
  assert.equal(e.message, "$212.40 exceeds the $150.00 per-trip transport cap.");
  assert.equal(e.fix, "A trip above the limit needs a written exception from your approver before it can be filed.");
  assert.equal(e.fix_class, "human_exception_required");
  assert.deepEqual(e.candidates, []);
  assert.equal(e.policy_version, "2026-08.1");
  assert.equal(e.observed, 21240);
  assert.equal(e.limit, 15000);
});

test("human_exception_required and not_reimbursable envelopes always carry empty candidates — schema-enforced, and enforced here too", () => {
  const lockedClasses = new Set(["human_exception_required", "not_reimbursable"]);
  for (const [rule, envelope] of Object.entries(envelopes)) {
    if (lockedClasses.has(envelope.fix_class)) {
      assert.deepEqual(envelope.candidates, [], `${rule} (${envelope.fix_class}) must carry empty candidates`);
    }
  }
});

test("severity is a closed enum (block|warn) across every emitted envelope", () => {
  for (const envelope of Object.values(envelopes)) {
    assert.ok(["block", "warn"].includes(envelope.severity));
  }
});

test("the same (violation, ctx) input produces a byte-identical envelope on two separate calls", () => {
  const violation = {
    code: "RECEIPT_REQUIRED", severity: "block", field: "receipt",
    message: "Lines at/above $25.00 need a linked receipt. The employee attaches the file in the page; then link it to this line.",
    fix: "Once a receipt file appears in list_receipts, call link_receipt with this line's id.",
  };
  const ctx = {
    entity: "line", entityId: "ln_3",
    candidates: [
      { value: "rc_2", label: "cafe-bruno-0814.pdf (unlinked)", origin: "existing_entity" },
      { value: "rc_5", label: "hotel-folio.pdf (unlinked)", origin: "existing_entity" },
    ],
    observed: 18640, limit: 2500,
  };
  const first = buildViolationEnvelope(violation, ctx);
  const second = buildViolationEnvelope(violation, ctx);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assertValid(first, "RECEIPT_REQUIRED with candidates");
});

test("RECEIPT_REQUIRED (attach_evidence) is the schema's own worked example for a non-empty candidates array", () => {
  const violation = {
    code: "RECEIPT_REQUIRED", severity: "block", field: "receipt",
    message: "Lines at or above $25.00 need a linked receipt file.",
    fix: "The employee attaches the file in the page; then link an id from list_receipts to this line.",
  };
  const envelope = buildViolationEnvelope(violation, {
    entity: "line", entityId: "ln_3",
    candidates: [
      { value: "rc_2", label: "cafe-bruno-0814.pdf (unlinked)", origin: "existing_entity" },
      { value: "rc_5", label: "hotel-folio.pdf (unlinked)", origin: "existing_entity" },
    ],
    observed: 18640, limit: 2500,
  });
  assertValid(envelope, "RECEIPT_REQUIRED worked example");
  assert.equal(envelope.candidates.length, 2);
});
