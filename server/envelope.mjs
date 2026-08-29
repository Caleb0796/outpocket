// server/envelope.mjs — the deterministic violation envelope, on every write tool.
//
// Node S4. Contract: erp/contracts/violation.schema.json (FROZEN, singular
// filename — sha256sum -c erp/contracts/FREEZE.md). Shape: {schema, code,
// rule_id, severity, entity, entity_id, field, message, fix, fix_class,
// candidates, policy_version, observed?, limit?}.
//
// This module does not compute violations — src/policy.js (S3) does that, in
// the bare shape {code, severity, field, message, fix}. This is the one
// place that shape is lifted into the full, schema-conformant envelope:
// `rule_id` and `fix_class` are looked up from the versioned policy document
// (POLICY_DOCUMENT.rules), never re-typed here, so a rule cannot drift
// between what enforces it and what the envelope claims enforced it.
//
// HANDOVER §5: originality here is retracted. Oracle Expenses REST returns
// per-field expenseErrors and UCP has an isomorphic envelope. Built because
// the workflow requires it, not because it is novel.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { POLICY_DOCUMENT, POLICY_VERSION } from "../src/policy.js";

const RULE_BY_CODE = new Map(POLICY_DOCUMENT.rules.map((r) => [r.code, r]));

// x-fixLint, read from the frozen schema rather than re-typed here, so a
// deviation-ticketed change to the banned list is picked up without a code
// edit. `fix` MUST NOT teach a restructuring of the claim that leaves the
// claimed total unchanged — splitting one over-cap line into two under-cap
// lines makes every line compliant while the report is still fraud.
const violationSchemaPath = fileURLToPath(new URL("../erp/contracts/violation.schema.json", import.meta.url));
const VIOLATION_SCHEMA = JSON.parse(readFileSync(violationSchemaPath, "utf8"));
const BANNED_FIX_SUBSTRINGS = VIOLATION_SCHEMA["x-fixLint"].bannedSubstrings;

/** lintFix(fix) -> { ok, matched } — case-insensitive substring scan over `fix` only. */
export function lintFix(fix) {
  const lower = fix.toLowerCase();
  const matched = BANNED_FIX_SUBSTRINGS.filter((s) => lower.includes(s.toLowerCase()));
  return { ok: matched.length === 0, matched };
}

export class EnvelopeError extends Error {
  constructor(detail) {
    super(detail);
    this.name = "EnvelopeError";
  }
}

/**
 * buildViolationEnvelope(violation, ctx) -> outpocket.violation/1 envelope
 *
 * violation: {code, severity, field, message, fix} — src/policy.js's shape,
 *   as returned by validateLine()/validateReport().
 * ctx: {
 *   entity: 'report'|'line'|'receipt'|'surface',
 *   entityId: string|null,
 *   candidates?: [{value, label, origin}],   // default []
 *   observed?: integer|string|null,          // omitted when not given
 *   limit?: integer|null,                    // omitted when not given
 *   policyVersion?: string,                  // defaults to POLICY_VERSION
 * }
 *
 * Deterministic: the same (violation, ctx) always produces the same
 * envelope — no clock, no randomness, no ambient state.
 */
export function buildViolationEnvelope(violation, ctx) {
  if (!violation || typeof violation.code !== "string") throw new EnvelopeError("violation.code is required");
  if (!ctx || !ctx.entity) throw new EnvelopeError("ctx.entity is required");

  const rule = RULE_BY_CODE.get(violation.code);
  if (!rule) throw new EnvelopeError(`unknown violation code: ${violation.code}`);
  if (rule.severity !== violation.severity) {
    throw new EnvelopeError(`${violation.code}: policy engine severity '${violation.severity}' disagrees with the policy document's '${rule.severity}'`);
  }

  const candidates = ctx.candidates ?? [];
  if ((rule.fix_class === "human_exception_required" || rule.fix_class === "not_reimbursable") && candidates.length > 0) {
    throw new EnvelopeError(`${violation.code} is ${rule.fix_class} and must carry an empty candidates array — there is no self-service route past a cap or a non-reimbursable item`);
  }

  const lint = lintFix(violation.fix);
  if (!lint.ok) {
    throw new EnvelopeError(`${violation.code}: fix text names an evasive edit (banned substring(s): ${lint.matched.join(", ")}) — "${violation.fix}"`);
  }

  const envelope = {
    schema: "outpocket.violation/1",
    code: violation.code,
    rule_id: rule.id,
    severity: violation.severity,
    entity: ctx.entity,
    entity_id: ctx.entityId ?? null,
    field: violation.field,
    message: violation.message,
    fix: violation.fix,
    fix_class: rule.fix_class,
    candidates,
    policy_version: ctx.policyVersion ?? POLICY_VERSION,
  };
  if (ctx.observed !== undefined) envelope.observed = ctx.observed;
  if (ctx.limit !== undefined) envelope.limit = ctx.limit;
  return envelope;
}

/** buildViolationEnvelopes(violations, ctx) -> envelope[], one ctx shared across every violation. */
export function buildViolationEnvelopes(violations, ctx) {
  return violations.map((v) => buildViolationEnvelope(v, ctx));
}
