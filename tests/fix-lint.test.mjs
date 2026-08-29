// Implements erp/contracts/violation.schema.json's x-fixLint check: `fix`
// must not teach a restructuring of the claim that leaves the claimed total
// unchanged. No JSON Schema keyword can catch this — it is a substring scan,
// case-insensitive, over `fix` only — so this test is the enforcement.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lintFix, buildViolationEnvelope, EnvelopeError } from "../server/envelope.mjs";

const schemaPath = fileURLToPath(new URL("../erp/contracts/violation.schema.json", import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const { bannedSubstrings } = schema["x-fixLint"];

test("the frozen banned-substring list is 19 entries", () => {
  assert.equal(bannedSubstrings.length, 19);
});

test("every x-lintFailingExamples instance is REJECTED by the lint, even though it is schema-valid", () => {
  const examples = schema["x-lintFailingExamples"];
  assert.ok(examples.length >= 1, "the schema must carry at least one lint-failing fixture");
  for (const { instance, why } of examples) {
    const result = lintFix(instance.fix);
    assert.equal(result.ok, false, `must reject "${instance.fix}" — ${why}`);
    assert.ok(result.matched.length > 0);
  }
});

test("the spike's live defect — countinghouse/src/policy.js:133 CAP_TRANSPORT — is exactly the string the lint must catch", () => {
  const liveDefect = "Split legitimate multi-trip charges into one line per trip.";
  const result = lintFix(liveDefect);
  assert.equal(result.ok, false);
  assert.ok(result.matched.includes("split"));
  assert.ok(result.matched.includes("one line per"));
});

test("every banned substring is individually caught, case-insensitively", () => {
  for (const substring of bannedSubstrings) {
    const fix = `Before. ${substring.toUpperCase()} After.`;
    const result = lintFix(fix);
    assert.equal(result.ok, false, `"${substring}" must be caught (case-insensitively)`);
  }
});

test("every schema examples[].fix is lint-clean — a schema-valid instance never fails the lint by accident", () => {
  for (const example of schema.examples) {
    assert.equal(lintFix(example.fix).ok, true, `examples[].fix "${example.fix}" must not trip the lint`);
  }
});

test("the port's CAP_TRANSPORT fix (S3's replacement for the live defect) passes the lint", () => {
  const ported = "A trip above the limit needs a written exception from your approver before it can be filed.";
  assert.equal(lintFix(ported).ok, true);
});

test("buildViolationEnvelope refuses to construct an envelope from a lint-failing fix", () => {
  const violation = {
    code: "CAP_TRANSPORT",
    severity: "block",
    field: "amount",
    message: "$212.40 is above the $150.00 per-trip transport limit.",
    fix: "Split legitimate multi-trip charges into one line per trip.",
  };
  assert.throws(
    () => buildViolationEnvelope(violation, { entity: "line", entityId: "ln_4" }),
    (e) => e instanceof EnvelopeError && /banned substring/.test(e.message),
  );
});
