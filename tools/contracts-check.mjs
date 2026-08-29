#!/usr/bin/env node
// Node G6 — the contracts conformance runner (owner QA).
//
// ajv-2020-12-validates every erp/contracts/*.schema.json against its own
// $schema and each schema's own `examples` against itself; recomputes every
// published digest in erp/contracts/policy-versions.json with
// src/canonical.js and asserts a byte-exact match including canonical_bytes;
// asserts every tool name in erp/contracts/tool-surface.contract.md resolves
// to a definition in src/tools.js; and runs CONTRACTS.md §11 CHECK 3b — the
// frozen policy over the frozen signed snapshot must reproduce the verdict
// the snapshot carries. Fails loudly (throws / exits 1) rather than
// reporting a recomputed value silently.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { canon, digest } from "../src/canonical.js";
import { validateReport } from "../src/policy.js";
import { ALL_TOOL_NAMES } from "../src/tools.js";

const CONTRACTS_DIR = "erp/contracts";
let failures = 0;

function fail(msg) {
  failures++;
  console.error(`FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`OK:   ${msg}`);
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

// ── Check 1: ajv-2020-12 validate every *.schema.json against itself,
//    its own `examples`, and reject every `x-invalidExamples[*].instance`.
//    NOTE: violation.schema.json's `x-lintFailingExamples` is schema-valid
//    by construction (CONTRACTS.md §11 check 1 note) and belongs to check 4,
//    not here — it is never touched by this loop.
//    NOTE: `x-elidedExample` (tool-export.schema.json) is a deliberate
//    one-state excerpt that is NOT a full instance of the schema and is
//    never validated as one (CONTRACTS.md, the C2 section).
const schemaFiles = readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith(".schema.json"))
  .sort()
  .map((f) => path.join(CONTRACTS_DIR, f));

if (schemaFiles.length === 0) fail("no *.schema.json files found under erp/contracts/");

const ajv = new Ajv2020({ allErrors: true, strict: false });

for (const file of schemaFiles) {
  const schema = readJson(file);
  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (e) {
    fail(`${file}: does not compile under ajv-2020-12 — ${e.message}`);
    continue;
  }
  ok(`${file}: compiles under ajv-2020-12`);

  // Presence of `examples` is NOT required by the accept predicate — it says
  // "validates each schema's examples against itself", not that every
  // schema must carry one. probe-verdict.schema.json (a runtime evidence
  // shape, not a frozen document instance) and tool-export.schema.json
  // (deliberately `x-elidedExample`, never `examples` — see the C2 section
  // of CONTRACTS.md) legitimately carry none.
  const examples = Array.isArray(schema.examples) ? schema.examples : [];
  if (examples.length === 0) {
    ok(`${file}: no top-level "examples" declared (not required)`);
  }
  examples.forEach((instance, i) => {
    if (!validate(instance)) {
      fail(`${file}: examples[${i}] fails validation against its own schema — ${ajv.errorsText(validate.errors)}`);
    } else {
      ok(`${file}: examples[${i}] valid`);
    }
  });

  const invalidExamples = Array.isArray(schema["x-invalidExamples"]) ? schema["x-invalidExamples"] : [];
  invalidExamples.forEach((entry, i) => {
    const instance = entry.instance;
    if (validate(instance)) {
      fail(`${file}: x-invalidExamples[${i}] ("${entry.why ?? "no reason given"}") unexpectedly PASSES validation`);
    } else {
      ok(`${file}: x-invalidExamples[${i}] correctly rejected`);
    }
  });
}

// ── Check: policy-versions.json digest lock — recompute, never report ──
const versionsDoc = readJson(path.join(CONTRACTS_DIR, "policy-versions.json"));
const policySchema = readJson(path.join(CONTRACTS_DIR, "policy.schema.json"));
const shippedPolicy = policySchema.examples[0];
const digestPrefix = versionsDoc.digest_prefix;

// The only version with a full frozen document is the shipped one
// (policy.schema.json examples[0], "2026-08.1"). "2026-08.2" — the demo-bump
// policy — has no separate example document; policy-versions.json's own
// entry narrates its derivation byte-for-byte: version -> "2026-08.2",
// effective_from -> "2026-08-29", and limits_cents.transport_per_line
// 15000 -> 5000, nothing else. That derivation is reproduced here exactly
// as narrated, not invented.
function documentForVersion(entry) {
  if (entry.version === shippedPolicy.version) return shippedPolicy;
  if (entry.version === "2026-08.2") {
    const doc = JSON.parse(JSON.stringify(shippedPolicy));
    doc.version = "2026-08.2";
    doc.effective_from = "2026-08-29";
    doc.limits_cents.transport_per_line = 5000;
    return doc;
  }
  return null;
}

for (const entry of versionsDoc.versions) {
  const doc = documentForVersion(entry);
  if (!doc) {
    fail(`policy-versions.json: no known derivation for version ${entry.version} — cannot recompute, refusing to trust the published digest`);
    continue;
  }
  const canonical = canon(doc);
  const bytes = Buffer.byteLength(canonical, "utf8");
  const computedDigest = digest(digestPrefix, doc);
  if (bytes !== entry.canonical_bytes) {
    fail(`policy-versions.json: ${entry.version} canonical_bytes mismatch — published ${entry.canonical_bytes}, recomputed ${bytes}`);
  } else {
    ok(`policy-versions.json: ${entry.version} canonical_bytes matches (${bytes})`);
  }
  if (computedDigest !== entry.digest) {
    fail(`policy-versions.json: ${entry.version} digest mismatch — published ${entry.digest}, recomputed ${computedDigest}`);
  } else {
    ok(`policy-versions.json: ${entry.version} digest matches (${computedDigest})`);
  }
}

// ── Check: every tool name in tool-surface.contract.md resolves to a
//    definition in src/tools.js ────────────────────────────────────────
// Imported, not grepped: T1 ported the definitions into src/page/tools/defs.js
// and left src/tools.js as a re-export facade (contract §2), so a literal
// `name: "..."` text scan of src/tools.js itself would silently find zero
// matches after that port. ALL_TOOL_NAMES is defs.js's own authoritative
// list, cross-checked against buildDefs() by assertCatalogue() so the two
// cannot drift — the right thing to resolve names against regardless of
// which file the implementation currently lives in.
const surfaceDoc = readFileSync(path.join(CONTRACTS_DIR, "tool-surface.contract.md"), "utf8");
const definedTools = new Set(ALL_TOOL_NAMES);
if (definedTools.size === 0) fail("src/tools.js: ALL_TOOL_NAMES is empty — cannot resolve anything against it");

const namedInSurfaceDoc = new Set(
  [...surfaceDoc.matchAll(/`([a-z][a-z0-9_]*)`/g)]
    .map((m) => m[1])
    .filter((name) => name.includes("_")), // tool names are all snake_case with an underscore; excludes stray backticked identifiers
);

if (namedInSurfaceDoc.size === 0) fail("tool-surface.contract.md: no backticked tool-shaped names found to check");

for (const name of [...namedInSurfaceDoc].sort()) {
  if (definedTools.has(name)) {
    ok(`tool-surface.contract.md: \`${name}\` resolves to a definition in src/tools.js`);
  } else {
    fail(`tool-surface.contract.md: \`${name}\` does not resolve to any definition in src/tools.js`);
  }
}

// ── Check 3b: the frozen snapshot must be committable under the frozen
//    policy (CONTRACTS.md §11 check 3b, node S3, hooked here by G6) ─────
const signatureSchema = readJson(path.join(CONTRACTS_DIR, "signature.schema.json"));
const snapshot = signatureSchema.examples[0].snapshot;

function adaptLine(l) {
  return {
    id: l.id,
    amountCents: l.amount_cents,
    usdCents: l.usd_cents,
    currency: l.currency,
    category: l.category,
    date: l.date,
    merchant: l.merchant,
    attendees: l.attendees,
    nights: l.nights,
    itemization: l.itemization ? l.itemization.map((it) => ({ label: it.label, amountCents: it.amount_cents })) : null,
    description: l.description,
    receiptId: l.receipt_id,
    _receiptSha256: l.receipt_sha256,
  };
}

const reportForCheck = {
  id: snapshot.report.id,
  project: snapshot.report.project,
  lines: snapshot.report.lines.map(adaptLine),
};
const sessionForCheck = {
  name: snapshot.report.owner,
  projects: [{ code: snapshot.report.project, name: snapshot.report.project, active: true }],
};
const receiptsByLine = new Map(reportForCheck.lines.map((l) => [l.receiptId, { sha256: l._receiptSha256, filename: l.receiptId }]));
// "now" is fixed rather than wall-clock: the frozen snapshot's dates are
// 2026-08-14 and the filing window is 90 days, so any fixed date in that
// window reproduces the same verdict without the check going stale as the
// calendar moves past the window (which wall-clock `now` eventually would).
const ctxForCheck = { now: new Date("2026-08-29T00:00:00"), receiptById: (id) => receiptsByLine.get(id) };

const recomputedVerdict = validateReport(reportForCheck, sessionForCheck, ctxForCheck);
const recomputedViolations = [...recomputedVerdict.lineViolations.values()].flat().concat(recomputedVerdict.reportViolations);

// The policy document's rules[] gives the code -> rule_id mapping the real
// server uses to build the full violation envelope from policy.js's raw
// findings; used here only to build the identifying quadruple.
const codeToRuleId = new Map(shippedPolicy.rules.map((r) => [r.code, r.id]));
function quadrupleKey(entity, entityId, code, severity) {
  const ruleId = codeToRuleId.get(code) ?? code;
  return `${entity}|${entityId}|${ruleId}|${severity}`;
}
const recomputedQuadruples = new Set();
for (const [lineId, vs] of recomputedVerdict.lineViolations) {
  for (const violation of vs) recomputedQuadruples.add(quadrupleKey("line", lineId, violation.code, violation.severity));
}
for (const violation of recomputedVerdict.reportViolations) {
  recomputedQuadruples.add(quadrupleKey("report", null, violation.code, violation.severity));
}

const expectedVerdict = snapshot.verdict;
const expectedQuadruples = new Set(
  (expectedVerdict.violations ?? []).map((v) => `${v.entity}|${v.entity_id}|${v.rule_id}|${v.severity}`),
);

if (recomputedVerdict.blocking !== expectedVerdict.blocking) {
  fail(`CHECK 3b: blocking mismatch — snapshot carries ${expectedVerdict.blocking}, frozen policy over frozen snapshot recomputes ${recomputedVerdict.blocking} (${recomputedViolations.filter((v) => v.severity === "block").map((v) => v.code).join(", ") || "none"})`);
} else {
  ok(`CHECK 3b: blocking matches (${recomputedVerdict.blocking})`);
}

if (recomputedVerdict.warnings !== expectedVerdict.warning) {
  fail(`CHECK 3b: warning mismatch — snapshot carries ${expectedVerdict.warning}, frozen policy over frozen snapshot recomputes ${recomputedVerdict.warnings} (${recomputedViolations.filter((v) => v.severity === "warn").map((v) => v.code).join(", ") || "none"})`);
} else {
  ok(`CHECK 3b: warning matches (${recomputedVerdict.warnings})`);
}

const quadSetsEqual =
  recomputedQuadruples.size === expectedQuadruples.size &&
  [...recomputedQuadruples].every((q) => expectedQuadruples.has(q));
if (!quadSetsEqual) {
  fail(
    `CHECK 3b: identifying-quadruple set mismatch — snapshot: [${[...expectedQuadruples].join("; ")}], recomputed: [${[...recomputedQuadruples].join("; ")}]`,
  );
} else {
  ok(`CHECK 3b: identifying-quadruple set matches (${recomputedQuadruples.size} violation(s))`);
}

console.log("");
if (failures > 0) {
  console.error(`contracts-check: ${failures} failure(s)`);
  process.exit(1);
} else {
  console.log("contracts-check: all checks green");
  process.exit(0);
}
