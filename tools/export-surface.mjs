#!/usr/bin/env node
// outpocket — the blind surface export (node T5, seat I2).
//
// Emits artifacts/tools.export.json: the six canonical surfaces, blind. Seat C1
// grades this file and evals/blind/tasks.md and NOTHING else — no repo, no source,
// no page. So everything a client agent's model could learn about our tool design
// must be inside it, and nothing that model could NOT see may leak into it. Per
// tool the export carries exactly name, description, inputSchema and annotations;
// erp/contracts/tool-export.schema.json sets additionalProperties:false on the tool
// object and keeps it false for that reason.
//
// The envelope is the frozen one (erp/contracts/tool-export.schema.json). `states`
// is an ARRAY. The older {freeze, chromiumMajor, capturedAt, states:{<id>:…}} shape
// is dead (EVAL.md §9); this generator can only build one, and the freeze wins.
//
// ── two traps this file exists to not fall into ────────────────────────────────
//
// 1. STATE IDS MUST AGREE AT 2/3. The compiler and export use the same ids:
//
//        export S2-emp-draft-clean (14 tools)  ==  compile.js internal S2
//        export S3-emp-draft-dirty (13 tools)  ==  compile.js internal S3
//
//    Every state names its `internal` id explicitly, and buildState() asserts that
//    the world it built landed there and compiled exactly MEMBERSHIP[internal].
//    The surface is read out of the real compiler, never transcribed.
//
// 2. `app_commit` MUST NOT BE `git rev-parse HEAD`. E5 fails when the committed
//    export differs from a freshly generated one (RISK.md §5). If app_commit tracked
//    HEAD, committing this artifact would move HEAD and the very next generation
//    would differ — the drift guard would false-alarm forever and be switched off.
//    It is instead the commit that last touched the sources the export is DERIVED
//    from, so it changes exactly when the export legitimately must be regenerated.
//    That set is measured, not guessed (see SOURCES): tool text and shape come from
//    defs.js, membership and state from compile.js, the inputSchema enums from
//    policy.js (CATEGORIES and Object.keys(FX) are interpolated into them), and the
//    digests from canonical.js. erp.js and samples.js only decide which state a
//    world REACHES, and a wrong turn there fails buildState()'s assertion loudly
//    rather than changing these bytes, so they are not provenance for this file.
//    tools/ is excluded on purpose: including this generator would re-create the
//    same bootstrapping loop that HEAD does.
//
// No wall clock and no environment value is read into the output, so two runs from
// one tree are byte-identical. The clock is pinned below and every date is a
// constant; measurement confirms no tool's description or inputSchema varies with
// ERP data or time (each tool projects identically in every state it appears in,
// asserted by assertNoDrift()).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createErp } from "../src/erp.js";
import { compileSurface, surfaceState, MEMBERSHIP } from "../src/page/tools/compile.js";
import { canon, digest } from "../src/canonical.js";
import { POLICY_VERSION, POLICY_DIGEST } from "../src/policy.js";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("artifacts/tools.export.json", ROOT);
const SCHEMA = new URL("erp/contracts/tool-export.schema.json", ROOT);

const SCHEMA_ID = "outpocket.tool_export/1";

// CONTRACTS.md §6: the digest kind for one state's `tools` array. This and nothing
// else is what surface_digest holds.
const DIGEST_KIND = "outpocket/surface/1";

// Provenance scope — see trap 2. Repo-relative, and deliberately not `src/`: a skin
// change under src/page/ui/ cannot alter these bytes and must not invalidate them.
const SOURCES = ["src/page/tools", "src/policy.js", "src/canonical.js"];

// A constant instant. Nothing in the output depends on it (assertNoDrift proves
// that), but the worlds below must land in the same states on any machine on any
// day, so the clock is pinned rather than left to drift into a policy window.
const FIXED_NOW = () => new Date(Date.UTC(2026, 7, 28, 17, 0, 0));
const LINE_DATE = "2026-08-24";

const utf8 = (s) => new TextEncoder().encode(s).length;
const die = (msg) => { throw new Error(msg); };

// ── the six canonical states ───────────────────────────────────────────────────
// `internal` is written explicitly so a future rename cannot silently mislabel a surface.
const STATES = [
  {
    id: "S0-anon", internal: "S0",
    label: "Nobody is signed in",
    preconditions: { role: "none", open_report: "none", verdict: "n_a" },
    build: () => {},
  },
  {
    id: "S1-emp-home", internal: "S1",
    label: "Employee signed in, no report open",
    preconditions: { role: "employee", open_report: "none", verdict: "n_a" },
    build: (erp) => { erp.signIn("chen", "human"); },
  },
  {
    // 14 tools. The clean draft is S2 in both the compiler and export.
    id: "S2-emp-draft-clean", internal: "S2",
    label: "Employee with a clean draft open; the report can be submitted",
    preconditions: { role: "employee", open_report: "draft", verdict: "clean" },
    build: (erp) => {
      erp.signIn("chen", "human");
      erp.createReport({ title: "Cafeteria week", project: "FALCON" }, "export");
      erp.addLine({ date: LINE_DATE, merchant: "Heron Cafeteria", category: "meals", amount: 18.2, attendees: 1, description: "Lunch" }, "export");
      erp.addLine({ date: LINE_DATE, merchant: "T Pass", category: "transport", amount: 12.0, description: "Subway" }, "export");
    },
  },
  {
    // 13 tools. The dirty draft is S3 in both the compiler and export. One blocking violation
    // removes submit_expense_report and nothing else.
    id: "S3-emp-draft-dirty", internal: "S3",
    label: "Employee with a draft that carries a blocking violation",
    preconditions: { role: "employee", open_report: "draft", verdict: "dirty" },
    build: (erp) => {
      STATES[2].build(erp);
      erp.addLine({ date: LINE_DATE, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "export");
    },
  },
  {
    id: "S4-emp-submitted", internal: "S4",
    label: "Employee viewing a report already submitted; the surface has shrunk",
    preconditions: { role: "employee", open_report: "submitted", verdict: "n_a" },
    build: (erp) => { erp.signIn("chen", "human"); erp.openReport("RP-1017", "export"); },
  },
  {
    id: "S5-aud", internal: "S5",
    label: "Auditor signed in; every tool on this surface is read-only",
    preconditions: { role: "auditor", open_report: "none", verdict: "n_a" },
    build: (erp) => { erp.signIn("ruiz", "human"); },
  },
];

// Exactly the fields a client agent's model can see. `annotations` is omitted, not
// emitted empty, only when a definition carries none; reads and writes carry the
// explicit hints appropriate to their result text. R-20's write set remains
// `annotations?.readOnlyHint !== true`.
function project(def) {
  const tool = { name: def.name, description: def.description, inputSchema: def.inputSchema };
  if (def.annotations) tool.annotations = def.annotations;
  return tool;
}

// Build one state's world and read the surface out of the real compiler. Both
// assertions guard trap 1: the first catches a builder that lands somewhere else,
// the second catches a compiler that no longer agrees with the frozen membership.
function buildState(spec) {
  const erp = createErp({ now: FIXED_NOW });
  spec.build(erp);

  const reached = surfaceState(erp);
  if (reached !== spec.internal) {
    die(`${spec.id}: built a world in internal state ${reached}, expected ${spec.internal}. ` +
        `The builder no longer reaches the state this id names — the export would be mislabelled.`);
  }

  const tools = compileSurface(erp, {}).map(project);
  const got = tools.map((t) => t.name);
  const want = MEMBERSHIP[spec.internal];
  if (got.length !== want.length || got.some((n, i) => n !== want[i])) {
    die(`${spec.id}: compiled surface does not match MEMBERSHIP.${spec.internal}\n` +
        `  got:  ${got.join(",")}\n  want: ${want.join(",")}`);
  }
  return tools;
}

// description_bytes + schema_bytes + name bytes = total_bytes. The name bytes are
// inside the total but are not a field of their own; the frozen contract's worked
// example is 230 + 33 + 17 = 280, tokens = ceil(280/4) = 70.
function accountingFor(tools) {
  const description_bytes = tools.reduce((a, t) => a + utf8(t.description), 0);
  const schema_bytes = tools.reduce((a, t) => a + utf8(canon(t.inputSchema)), 0);
  const name_bytes = tools.reduce((a, t) => a + utf8(t.name), 0);
  const total_bytes = description_bytes + schema_bytes + name_bytes;
  return {
    tool_count: tools.length,
    description_bytes,
    schema_bytes,
    total_bytes,
    estimated_tokens: Math.ceil(total_bytes / 4),
  };
}

// The commit that last touched the sources this export is derived from. See trap 2.
function appCommit() {
  const root = fileURLToPath(ROOT);
  let sha;
  try {
    sha = execFileSync("git", ["log", "-1", "--format=%H", "--", ...SOURCES], { cwd: root, encoding: "utf8" }).trim();
  } catch (e) {
    die(`cannot read app_commit from git: ${e.message}`);
  }
  if (!/^[0-9a-f]{40}$/.test(sha)) die(`app_commit is not a 40-hex sha: ${JSON.stringify(sha)}`);

  // A dirty source tree means the bytes below do not correspond to the commit they
  // claim. Not fatal — other seats regenerate mid-edit — but never silent.
  const dirty = execFileSync("git", ["status", "--porcelain", "--", ...SOURCES], { cwd: root, encoding: "utf8" }).trim();
  if (dirty) {
    process.stderr.write(`WARNING: uncommitted changes under ${SOURCES.join(" ")} — app_commit ${sha.slice(0, 8)} does not describe these bytes:\n${dirty}\n`);
  }
  return sha;
}

// ── lints the export must satisfy on its own ───────────────────────────────────

// Nothing the client agent cannot see. The frozen key list is read from the
// contract rather than retyped, so a bump to the contract binds this scan.
function scanForbiddenKeys(doc, forbidden) {
  const hits = [];
  (function walk(node, path) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    for (const k of Object.keys(node)) {
      if (forbidden.includes(k)) hits.push(`${path}.${k}`);
      walk(node[k], `${path}.${k}`);
    }
  })(doc, "");
  return hits;
}

// G-13 (EVAL.md §8): a description may not encode workflow order. The registration
// state machine is the workflow; a tool that must not be called now does not exist
// now, so the prose never needs to sequence anything.
const FLOW_CONTROL = /\b(first|then|before|after) (call|use|invoke)\b/i;

// G-14: the 500-character description budget. This bound is our own enforcement of
// PUBLISHED Chrome guidance — it is guidance, not something the browser enforces,
// and it is never to be graded MEASURED. The schema caps max_description_bytes at
// 500 as well, and bytes exceed characters wherever a description carries an
// em-dash, so both are checked.
const DESC_BUDGET = 500;

// Every tool must project identically wherever it appears. If it did not, the same
// name would carry two descriptions in one file and C1 would be grading a surface
// no page ever shows.
function assertNoDrift(states) {
  const seen = new Map();
  for (const st of states) {
    for (const t of st.tools) {
      const c = canon(t);
      if (seen.has(t.name) && seen.get(t.name) !== c) {
        die(`${t.name} projects differently in ${st.state_id} than in an earlier state`);
      }
      seen.set(t.name, c);
    }
  }
  return seen.size;
}

function lint(doc) {
  const schema = JSON.parse(readFileSync(SCHEMA, "utf8"));

  const hits = scanForbiddenKeys(doc, schema["x-forbiddenKeys"].keys);
  if (hits.length) die(`forbidden keys in the export: ${hits.join(", ")}`);

  for (const st of doc.states) {
    for (const t of st.tools) {
      if (FLOW_CONTROL.test(t.description)) {
        die(`G-13: ${t.name} encodes workflow order in its description`);
      }
      if (t.description.length > DESC_BUDGET) die(`G-14: ${t.name} description is ${t.description.length} chars, over ${DESC_BUDGET}`);
      if (utf8(t.description) > DESC_BUDGET) die(`G-14: ${t.name} description is ${utf8(t.description)} bytes, over ${DESC_BUDGET}`);
      for (const k of Object.keys(t)) {
        if (!["name", "description", "inputSchema", "annotations"].includes(k)) die(`${t.name}: unexpected key ${k}`);
      }
      for (const k of Object.keys(t.annotations ?? {})) {
        if (k !== "readOnlyHint" && k !== "untrustedContentHint") die(`${t.name}: annotation ${k} does not exist`);
      }
    }
  }

  // Cross-check the per-state counts against the frozen contract's own table, so a
  // freeze bump that changes a surface fails here instead of shipping quietly. The
  // numbers are READ from the contract, never typed into this file.
  const required = schema["x-requiredStates"];
  for (const st of doc.states) {
    const want = required[st.state_id];
    if (typeof want !== "number") die(`${st.state_id} is not in the contract's x-requiredStates`);
    if (st.tools.length !== want) die(`${st.state_id}: ${st.tools.length} tools, contract requires ${want}`);
  }
  const missing = Object.keys(required).filter((k) => k !== "note" && !doc.states.some((s) => s.state_id === k));
  if (missing.length) die(`states required by the contract but absent: ${missing.join(", ")}`);
}

// ── serialisation ──────────────────────────────────────────────────────────────
// 2-space indent, object keys ascending by code point at every depth, so a human
// can read the diff. Array order is never touched: `tools` is in registration
// order and surface_digest is taken over that array. The digest is over the OCF-1
// canonical form of the parsed value, never over these bytes.
function pretty(value, depth = 0) {
  const pad = "  ".repeat(depth);
  const inner = "  ".repeat(depth + 1);
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return `[\n${value.map((v) => inner + pretty(v, depth + 1)).join(",\n")}\n${pad}]`;
  }
  const keys = Object.keys(value).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!keys.length) return "{}";
  return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${pretty(value[k], depth + 1)}`).join(",\n")}\n${pad}}`;
}

// ── build ──────────────────────────────────────────────────────────────────────
export function buildExport() {
  const states = STATES.map((spec) => {
    const tools = buildState(spec);
    return {
      state_id: spec.id,
      label: spec.label,
      preconditions: spec.preconditions,
      tools,
      accounting: accountingFor(tools),
      surface_digest: digest(DIGEST_KIND, tools),
    };
  });

  const distinct = assertNoDrift(states);
  const doc = {
    schema: SCHEMA_ID,
    app_commit: appCommit(),
    policy_version: POLICY_VERSION,
    policy_digest: POLICY_DIGEST,
    states,
    totals: {
      state_count: states.length,
      distinct_tool_count: distinct,
      max_description_bytes: Math.max(...states.flatMap((s) => s.tools.map((t) => utf8(t.description)))),
    },
  };
  lint(doc);
  return doc;
}

// ── check ──────────────────────────────────────────────────────────────────────
// Recompute every digest INDEPENDENTLY from the committed file's own tools arrays,
// re-run the lints against it, and regenerate to catch drift. A byte-identical-twice
// check passes happily against an empty surface, so the tool counts are asserted
// against the frozen contract too (inside lint()).
function check() {
  const raw = readFileSync(OUT, "utf8");
  const doc = JSON.parse(raw);
  const problems = [];

  if (doc.schema !== SCHEMA_ID) problems.push(`schema is ${doc.schema}, expected ${SCHEMA_ID}`);
  if (doc.states.length !== 6) problems.push(`${doc.states.length} states, expected 6`);

  for (const st of doc.states) {
    const recomputed = digest(DIGEST_KIND, st.tools);
    if (recomputed !== st.surface_digest) {
      problems.push(`${st.state_id}: surface_digest is ${st.surface_digest}, recomputes to ${recomputed}`);
    }
    const acct = accountingFor(st.tools);
    for (const k of Object.keys(acct)) {
      if (acct[k] !== st.accounting[k]) problems.push(`${st.state_id}: accounting.${k} is ${st.accounting[k]}, recomputes to ${acct[k]}`);
    }
  }

  try { lint(doc); } catch (e) { problems.push(e.message); }

  const fresh = pretty(buildExport()) + "\n";
  if (fresh !== raw) problems.push("the committed export differs from a freshly generated one (drift)");

  for (const st of doc.states) {
    const writes = st.tools.filter((t) => t.annotations?.readOnlyHint !== true).map((t) => t.name);
    process.stdout.write(`${st.state_id.padEnd(20)} ${String(st.tools.length).padStart(2)} tools  ${String(writes.length).padStart(2)} write  ${st.surface_digest.slice(0, 19)}…\n`);
  }
  if (problems.length) {
    process.stdout.write(`\nFAIL\n  ${problems.join("\n  ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`\nOK  6 states, ${doc.totals.distinct_tool_count} distinct tools, digests recomputed independently, no drift\n`);
}

if (process.argv.includes("--check")) {
  check();
} else {
  const text = pretty(buildExport()) + "\n";
  mkdirSync(new URL("artifacts/", ROOT), { recursive: true });
  writeFileSync(OUT, text);
  process.stderr.write(`wrote artifacts/tools.export.json (${utf8(text)} bytes)\n`);
  process.stdout.write(text);
}
