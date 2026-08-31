import test from "node:test";
import assert from "node:assert/strict";
import { validateLine, toCents, toUsdCents, policyForAgent, LIMITS, POLICY_VERSION, parseDate } from "../src/policy.js";
import { makeWorld } from "./helpers.mjs";

const NOW = new Date(2026, 7, 28, 10, 0, 0);
const ctx = { now: NOW, receiptById: () => undefined, receiptHashUse: () => undefined, lineId: "ln_x", reportId: "RP-x" };

function mkLine(over = {}) {
  return {
    date: "2026-08-25", merchant: "Test Co", category: "meals",
    amountCents: 1000, usdCents: 1000, currency: "USD",
    attendees: undefined, nights: undefined, itemization: undefined,
    description: "d", receiptId: null, ...over,
  };
}
const codes = (vs) => vs.map((v) => v.code);

test("money conversion is integer-exact", () => {
  assert.equal(toCents(186.4), 18640);
  assert.equal(toCents(0.1 + 0.2), 30);
  assert.equal(toCents(1.005), 101);
  assert.equal(toCents(10.075), 1008);
  assert.equal(toCents(-5), null);
  assert.equal(toCents(Number.MAX_SAFE_INTEGER), null);
  assert.equal(toCents("186.40"), null);
  assert.equal(toUsdCents(3800, "EUR"), 4142); // 38.00 EUR @ 1.09
  assert.equal(toUsdCents(25, "CNY"), 4); // 3.5 cents rounds half up
  assert.equal(toUsdCents(Number.MAX_SAFE_INTEGER, "EUR"), null);
  assert.equal(toUsdCents(Number.MAX_SAFE_INTEGER + 1, "USD"), null);
  assert.equal(toUsdCents(1000, "AUD"), null);
});

test("missing fields block", () => {
  const vs = validateLine(mkLine({ merchant: null, category: "boats", amountCents: null, usdCents: null, date: "yesterday" }), ctx);
  const c = codes(vs);
  for (const want of ["MISSING_FIELD"]) assert.ok(c.includes(want));
  assert.ok(vs.filter((v) => v.code === "MISSING_FIELD").length >= 4);
  assert.ok(vs.every((v) => v.fix.length > 0), "every violation carries a fix hint");
});

test("date window: future and stale block, recent passes", () => {
  assert.ok(codes(validateLine(mkLine({ date: "2026-09-05" }), ctx)).includes("DATE_FUTURE"));
  assert.ok(codes(validateLine(mkLine({ date: "2026-04-01" }), ctx)).includes("DATE_STALE"));
  assert.ok(!codes(validateLine(mkLine({ date: "2026-08-25" }), ctx)).some((c) => c.startsWith("DATE")));
});

test("calendar dates reject impossible days instead of normalizing them", () => {
  assert.equal(parseDate("2026-02-30"), null);
  assert.ok(codes(validateLine(mkLine({ date: "2026-02-30" }), ctx)).includes("MISSING_FIELD"));
  assert.ok(parseDate("2024-02-29") instanceof Date);
});

test("meal cap scales with attendees", () => {
  const over = mkLine({ amountCents: 18640, usdCents: 18640, attendees: 1, itemization: [{ label: "Entrees", amountCents: 18640 }] });
  assert.ok(codes(validateLine(over, ctx)).includes("CAP_MEALS"));
  const fixed = mkLine({ amountCents: 18640, usdCents: 18640, attendees: 3, itemization: [{ label: "Entrees", amountCents: 18640 }] });
  assert.ok(!codes(validateLine(fixed, ctx)).includes("CAP_MEALS"));
});

test("meals ≥ $75 require itemization", () => {
  const vs = validateLine(mkLine({ amountCents: 9000, usdCents: 9000, attendees: 2 }), ctx);
  assert.ok(codes(vs).includes("ITEMIZATION_REQUIRED"));
  const ok = validateLine(mkLine({ amountCents: 9000, usdCents: 9000, attendees: 2, itemization: [{ label: "Entrees", amountCents: 9000 }] }), ctx);
  assert.ok(!codes(ok).includes("ITEMIZATION_REQUIRED"));
});

test("alcohol is caught in declared itemization, with the amount in the fix", () => {
  const vs = validateLine(
    mkLine({ itemization: [{ label: "Chianti (bottle)", amountCents: 3800 }, { label: "Entrees", amountCents: 6200 }], amountCents: 10000, usdCents: 10000, attendees: 2 }),
    ctx);
  const a = vs.find((v) => v.code === "ALCOHOL");
  assert.ok(a, "alcohol violation present");
  assert.equal(a.severity, "block");
  assert.match(a.fix, /38\.00/);
});

test("alcohol lexicon uses word boundaries (no 'Winehouse' false positive)", () => {
  const vs = validateLine(mkLine({ itemization: [{ label: "Winehouse Cafe pastry", amountCents: 900 }], amountCents: 900, usdCents: 900 }), ctx);
  assert.ok(!codes(vs).includes("ALCOHOL"));
});

test("lodging cap scales with nights", () => {
  const one = mkLine({ category: "lodging", amountCents: 49800, usdCents: 49800, nights: 1 });
  assert.ok(codes(validateLine(one, ctx)).includes("CAP_LODGING"));
  const two = mkLine({ category: "lodging", amountCents: 49800, usdCents: 49800, nights: 2 });
  assert.ok(!codes(validateLine(two, ctx)).includes("CAP_LODGING"));
});

test("transport/supplies caps block; airfare only warns", () => {
  assert.ok(codes(validateLine(mkLine({ category: "transport", amountCents: 20000, usdCents: 20000 }), ctx)).includes("CAP_TRANSPORT"));
  assert.ok(codes(validateLine(mkLine({ category: "supplies", amountCents: 25000, usdCents: 25000 }), ctx)).includes("CAP_SUPPLIES"));
  const air = validateLine(mkLine({ category: "airfare", amountCents: 150000, usdCents: 150000 }), ctx).find((v) => v.code === "AIRFARE_REVIEW");
  assert.equal(air?.severity, "warn");
});

test("itemization gap warns when sum drifts from amount", () => {
  const vs = validateLine(mkLine({ amountCents: 10000, usdCents: 10000, itemization: [{ label: "Entrees", amountCents: 5000 }] }), ctx);
  const gap = vs.find((v) => v.code === "ITEMIZATION_GAP");
  assert.equal(gap?.severity, "warn");
});

test("`other` requires a description", () => {
  const vs = validateLine(mkLine({ category: "other", description: null }), ctx);
  assert.ok(codes(vs).includes("DESC_REQUIRED"));
});

test("receipt required at/above $25, not below", () => {
  assert.ok(codes(validateLine(mkLine({ amountCents: 2500, usdCents: 2500 }), ctx)).includes("RECEIPT_REQUIRED"));
  assert.ok(!codes(validateLine(mkLine({ amountCents: 1820, usdCents: 1820 }), ctx)).includes("RECEIPT_REQUIRED"));
});

test("policy JSON fits the official 1500-char output budget and carries its version", () => {
  const s = JSON.stringify(policyForAgent());
  assert.ok(s.length <= 1500, `policy JSON is ${s.length} chars`);
  assert.ok(s.includes(POLICY_VERSION));
});

// integration-level: unsupported currency + EUR conversion through the erp normalizer
test("currency: EUR converts, unsupported blocks", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  w.erp.createReport({ title: "fx", project: "FALCON" }, "test");
  const { verdict: vEur, line } = w.erp.addLine({ date: w.dates.berlin, merchant: "Flughafen Transfer", category: "transport", amount: 38.0, currency: "EUR" }, "test");
  assert.equal(line.usdCents, 4142);
  assert.ok(!codes(vEur.lineViolations.get(line.id)).includes("CURRENCY_UNSUPPORTED"));
  const { verdict: vBad, line: l2 } = w.erp.addLine({ date: w.dates.cab, merchant: "Sydney Cab", category: "transport", amount: 30.0, currency: "AUD" }, "test");
  assert.ok(codes(vBad.lineViolations.get(l2.id)).includes("CURRENCY_UNSUPPORTED"));
});

test("report level: empty, project scope/inactive, large-total warn", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  // create against active project then inspect empty-report verdict
  w.erp.createReport({ title: "t", project: "FALCON" }, "test");
  let vd = w.erp.verdict();
  assert.ok(vd.reportViolations.some((v) => v.code === "EMPTY_REPORT"));
  // closed & out-of-scope projects are refused at create time (403 semantics)
  assert.throws(() => w.erp.createReport({ title: "t", project: "KESTREL" }, "test"), /PROJECT_INACTIVE|closed/);
  assert.throws(() => w.erp.createReport({ title: "t", project: "VULCAN" }, "test"), /not in/);
  // large total warns but does not block
  w.erp.addLine({ date: w.dates.cab, merchant: "Air Co", category: "airfare", amount: 1180.0, description: "BOS-SFO" }, "test");
  w.erp.addLine({ date: w.dates.cab, merchant: "Air Co 2", category: "airfare", amount: 1100.0, description: "SFO-BOS" }, "test");
  vd = w.erp.verdict();
  const warn = vd.reportViolations.find((v) => v.code === "REPORT_REVIEW");
  assert.equal(warn?.severity, "warn");
});
