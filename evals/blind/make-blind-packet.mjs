#!/usr/bin/env node
// evals/blind/make-blind-packet.mjs — node E4 (lane E, owner L2).
//
// Builds the ONLY thing C1 ever sees: a directory holding exactly two files,
// outside any git repository. Prints that directory's path on stdout and
// NOTHING ELSE on stdout, because the runbook binds it as
// `PACKET=$(node evals/blind/make-blind-packet.mjs)`. Every diagnostic goes to
// stderr. FORCE_COLOR=3 is injected into every seat here, so the path is
// written with a bare process.stdout.write of a string — never console.log of a
// value node might colourise into the pipe.
//
// ── THE ADMISSIBILITY CLAUSE IS THE POINT OF THIS FILE ───────────────────────
//
// C1 exists to answer one question: does the registration state machine
// communicate itself? We impose a rule on ourselves that flow control is never
// written into a description — the workflow IS the state machine — and that rule
// is exactly what removes the crutch a thin description would otherwise lean on.
//
// A GRADER TOLD THAT RULE IN ADVANCE WILL NEVER REPORT "I COULD NOT TELL WHAT
// ORDER TO CALL THESE IN." It will read the absence as intentional and score it
// as design. That single sentence in the brief would destroy the instrument
// while leaving every mechanical check green, which is why the failure is
// mechanical here rather than a promise in a charter.
//
// THE LEAK MATTERS MORE THAN THE SANDBOX. The greps for source paths cannot
// catch this, because it is not a leak of source — it is a leak of design
// intent, and it is invisible to every check that looks for file paths.
//
// ── AND IT IS SCANNED ACROSS EVERYTHING C1 READS, NOT JUST THE BRIEF ─────────
//
// E4's accept names evals/blind/prompts/c1.txt. L2's charter is wider and the
// wider rule is the correct one: no criterion the rubric grades may go into
// "c1.txt, OR ANYTHING ELSE C1 READS". The output schema is rendered into the
// same prompt by `codex exec --output-schema`, and tasks.md is copied into the
// packet, so all three are scanned. Passing the accept while contaminating the
// schema would satisfy the letter and destroy the instrument.
//
// ── D-90, AND IT IS THE LINE THIS FILE WOULD OTHERWISE DIE ON ────────────────
//
// "The brief contains no graded criterion" IS SATISFIED BY AN EMPTY BRIEF. It is
// satisfied by a missing brief. A negative control satisfiable by the subject
// being absent is not a control — so before concluding anything from a clean
// scan, every scanned file is asserted PRESENT and SUBSTANTIVE. A stub c1.txt
// must fail this program, not pass it.
//
// usage:
//   node evals/blind/make-blind-packet.mjs              build; print packet path
//   node evals/blind/make-blind-packet.mjs --self-test  prove every check FIRES
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPORT_SRC = join(REPO, "artifacts", "tools.export.json");
const TASKS_SRC = join(REPO, "evals", "blind", "tasks.md");
const PROMPT_SRC = join(REPO, "evals", "blind", "prompts", "c1.txt");
const SCHEMA_SRC = join(REPO, "evals", "blind", "rubric.schema.json");

// A brief shorter than this is a stub, and a stub passes a "contains no graded
// criterion" scan trivially. The floor is what makes the scan mean something.
const MIN_SUBSTANTIVE_BYTES = 600;

const err = (s) => process.stderr.write(s + "\n");

// ── the graded criteria, each with the reason it is forbidden ────────────────
//
// Named individually so a failure says WHICH criterion leaked and why that
// particular one destroys the instrument. A generic "contamination detected"
// would be a message nobody can act on.
const CRITERIA = [
  {
    id: "workflow-order",
    why: "the descriptions-must-not-encode-workflow-order rule. A grader told this reads missing ordering prose as intentional and will never report that it could not tell what order to call things in — which is the one finding C1 exists to produce.",
    patterns: [
      /flow\s*(control|prose)/i,
      /workflow\s*order/i,
      /order\s+(?:of|in\s+which)[^.\n]{0,40}call/i,
      /(?:must|should)\s+not[^.\n]{0,60}\border\b/i,
      /(?:registration\s+)?state\s+machine\s+is\s+the\s+workflow/i,
      // Narrowed after its own self-test caught it firing on this project's
      // schema text "one record per task, in task order" — the ordering of the
      // TASK LIST, which has nothing to do with tool call order. A detector
      // that fires on innocent text is as useless as one that fires on nothing,
      // and it is worse, because someone will eventually widen the exemption
      // instead of the pattern. "tool" adjacency is what makes it a claim about
      // the surface rather than about any list.
      /tool\s+descriptions?[^.\n]{0,60}\b(?:sequence|ordering|order)\b/i,
    ],
  },
  {
    id: "budget-500-1500",
    why: "the 500/1500-character description and output budgets. A grader given our numbers grades against our numbers instead of reporting what it actually could not use.",
    patterns: [
      /\b1?500\b[^.\n]{0,40}(?:char|byte|budget|limit|cap)/i,
      /(?:char|byte|budget|limit|cap)[^.\n]{0,40}\b1?500\b/i,
      /\b(?:DESC_BUDGET|OUTPUT_BUDGET)\b/,
    ],
  },
  {
    id: "iframe",
    why: "the iframe rule. It is a fact about our page architecture and tells C1 it is grading a specific known implementation.",
    patterns: [/iframe/i],
  },
  {
    id: "origin-agent-cluster",
    why: "the Origin-Agent-Cluster rule. Same class: it identifies the deployment and grades nothing about the tool surface.",
    patterns: [/origin[-\s]?agent[-\s]?cluster/i],
  },
];

/** scanForCriteria(text) -> [{id, why, matched}] */
export function scanForCriteria(text) {
  const hits = [];
  for (const c of CRITERIA) {
    for (const p of c.patterns) {
      const m = p.exec(text);
      if (m) { hits.push({ id: c.id, why: c.why, matched: m[0] }); break; }
    }
  }
  return hits;
}

/**
 * checkAdmissibility(files) -> string[] of problems.
 * files: [{label, path}] — every file C1 will read.
 *
 * TWO checks, and the order is deliberate: substantive FIRST, then clean.
 * A clean scan over an absent or stub file is not evidence of anything.
 */
export function checkAdmissibility(files) {
  const problems = [];
  for (const f of files) {
    if (!existsSync(f.path)) {
      problems.push(`${f.label}: MISSING at ${f.path} — a scan over a file that is not there passes vacuously`);
      continue;
    }
    const text = readFileSync(f.path, "utf8");
    if (text.trim().length < MIN_SUBSTANTIVE_BYTES) {
      problems.push(`${f.label}: only ${text.trim().length} bytes of content, under the ${MIN_SUBSTANTIVE_BYTES}-byte floor. ` +
        "A stub satisfies 'contains no graded criterion' trivially (D-90), so it is rejected rather than passed.");
      continue;
    }
    for (const hit of scanForCriteria(text)) {
      problems.push(`${f.label}: LEAKS "${hit.id}" (matched ${JSON.stringify(hit.matched)}) — ${hit.why}`);
    }
  }
  return problems;
}

/** True when `dir` is inside a git work tree. Asks git, then falls back to walking up. */
export function isInsideGitRepo(dir) {
  try {
    const out = execFileSync("git", ["-C", dir, "rev-parse", "--is-inside-work-tree"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out === "true") return true;
  } catch { /* not a repo, or no git — fall through to the structural walk */ }
  let d = resolve(dir);
  for (;;) {
    if (existsSync(join(d, ".git"))) return true;
    const up = dirname(d);
    if (up === d) return false;
    d = up;
  }
}

/**
 * assertPacketShape(dir) -> entries. EXACTLY two plain files, nothing else.
 *
 * Exported as its own function rather than left inline inside buildPacket, so
 * the self-test can drive it with one, two and three files. An invariant only
 * reachable through a successful build is an invariant nothing ever proves can
 * fail.
 */
export function assertPacketShape(dir) {
  const entries = readdirSync(dir).sort();
  if (entries.length !== 2) {
    throw new Error(`packet holds ${entries.length} entr(ies) [${entries.join(", ")}], expected exactly 2`);
  }
  for (const e of entries) {
    if (!statSync(join(dir, e)).isFile()) throw new Error(`packet entry ${e} is not a plain file`);
  }
  return entries;
}

/** Reports, without blocking, which repo identifiers the export carries. */
function reportExportIdentifiers(exportPath) {
  const text = readFileSync(exportPath, "utf8");
  const found = new Map();
  for (const m of text.matchAll(/outpocket|countinghouse|\/Users\/[A-Za-z0-9_.-]*/gi)) {
    found.set(m[0].toLowerCase(), (found.get(m[0].toLowerCase()) ?? 0) + 1);
  }
  if (found.size === 0) { err("  export identifiers: none"); return; }
  err("  EXPORT CARRIES REPO IDENTIFIERS, AND THIS IS REPORTED RATHER THAN BLOCKED:");
  for (const [tok, n] of found) err(`    ${JSON.stringify(tok)} x${n}`);
  err("  Neither is removable and neither is a mistake:");
  err("    - the envelope's own schema id is frozen in erp/contracts/tool-export.schema.json;");
  err("    - the product name is what a real agent reads in the descriptions, and stripping it");
  err("      would make C1 grade a surface we do not ship.");
  err("  CONSEQUENCE, STATED RATHER THAN PATCHED: the packet is NOT identifier-free, so blindness");
  err("  rests on the transcript check (zero tool calls outside the packet), which DETECTS a breach");
  err("  rather than preventing one. E4's accept greps the brief, not the export, and that is why.");
}

// ── build ───────────────────────────────────────────────────────────────────

export function buildPacket({ intoDir = null } = {}) {
  const problems = checkAdmissibility([
    { label: "prompts/c1.txt", path: PROMPT_SRC },
    { label: "tasks.md", path: TASKS_SRC },
    { label: "rubric.schema.json", path: SCHEMA_SRC },
  ]);
  if (problems.length) {
    err("ADMISSIBILITY FAILED — the packet was not built.");
    for (const p of problems) err(`  ${p}`);
    err("");
    err("Nothing C1 reads may carry a criterion the rubric grades. Fix the file, not this check.");
    const e = new Error("admissibility");
    e.problems = problems;
    throw e;
  }

  for (const p of [EXPORT_SRC, TASKS_SRC]) {
    if (!existsSync(p)) throw new Error(`packet input missing: ${p}`);
  }

  const dir = intoDir ?? mkdtempSync(join(tmpdir(), "blind-packet-"));
  mkdirSync(dir, { recursive: true });
  for (const entry of readdirSync(dir)) rmSync(join(dir, entry), { recursive: true, force: true });

  if (isInsideGitRepo(dir)) {
    throw new Error(`packet directory ${dir} is INSIDE a git repository — ` +
      "a repo is a source tree, and the whole point of the packet is that there is not one");
  }

  copyFileSync(EXPORT_SRC, join(dir, "tools.export.json"));
  copyFileSync(TASKS_SRC, join(dir, "tasks.md"));

  return { dir, entries: assertPacketShape(dir) };
}

// ── self-test: every check above must be shown to FIRE ──────────────────────

function selfTest() {
  let pass = 0, fail = 0;
  const ok = (m) => { err(`  ok    ${m}`); pass += 1; };
  const bad = (m) => { err(`  FAIL  ${m}`); fail += 1; };

  err("make-blind-packet --self-test");
  err("");
  err("(1) THE ADMISSIBILITY SCAN MUST FIRE ON EACH GRADED CRITERION");
  const clean = readFileSync(PROMPT_SRC, "utf8");
  const injections = {
    "workflow-order": "Note: descriptions here deliberately do not encode workflow order.",
    "budget-500-1500": "Each description is held under a 500 character budget.",
    "iframe": "The page under test runs inside an iframe.",
    "origin-agent-cluster": "The deployment does not set the Origin-Agent-Cluster header.",
  };
  for (const [id, sentence] of Object.entries(injections)) {
    const hits = scanForCriteria(clean + "\n" + sentence);
    if (hits.some((h) => h.id === id)) ok(`"${id}" injected into the REAL brief is DETECTED`);
    else bad(`"${id}" injected into the real brief was NOT detected — the clause is failing open`);
  }

  err("");
  err("(2) THE REAL FILES MUST PASS — or every result above is satisfied by a scan that always fires");
  const realProblems = checkAdmissibility([
    { label: "prompts/c1.txt", path: PROMPT_SRC },
    { label: "tasks.md", path: TASKS_SRC },
    { label: "rubric.schema.json", path: SCHEMA_SRC },
  ]);
  if (realProblems.length === 0) ok("c1.txt, tasks.md and rubric.schema.json are all admissible today");
  else { bad("the real files did not pass:"); for (const p of realProblems) err(`          ${p}`); }

  err("");
  err("(3) D-90: A STUB OR MISSING BRIEF MUST BE REJECTED, NOT PASSED");
  const tmp = mkdtempSync(join(tmpdir(), "blind-selftest-"));
  try {
    const stub = join(tmp, "stub.txt");
    writeFileSync(stub, "grade the surface.\n");
    const stubProblems = checkAdmissibility([{ label: "stub", path: stub }]);
    if (stubProblems.length) ok("a STUB brief is REJECTED (it contains no criterion, and that is exactly why)");
    else bad("a stub brief PASSED — 'contains no graded criterion' is satisfied by containing nothing");

    const goneProblems = checkAdmissibility([{ label: "absent", path: join(tmp, "no-such-file.txt") }]);
    if (goneProblems.length) ok("a MISSING brief is REJECTED rather than scanned vacuously");
    else bad("a missing brief PASSED — the scan ran over nothing and returned clean");

    err("");
    err("(4) THE PACKET SHAPE CHECK MUST FIRE — driven directly, with 1, 2 and 3 files");
    for (const [n, mustThrow] of [[1, true], [2, false], [3, true]]) {
      const d = join(tmp, `shape-${n}`);
      mkdirSync(d, { recursive: true });
      for (const e of readdirSync(d)) rmSync(join(d, e), { force: true });
      for (let i = 0; i < n; i++) writeFileSync(join(d, `f${i}.txt`), "x");
      let threw = false;
      try { assertPacketShape(d); } catch { threw = true; }
      if (threw === mustThrow) ok(`${n} file(s) -> ${mustThrow ? "REJECTED" : "accepted"}`);
      else bad(`${n} file(s) -> ${threw ? "rejected" : "accepted"}, expected the opposite`);
    }
    const dirCase = join(tmp, "shape-dir");
    mkdirSync(join(dirCase, "subdir"), { recursive: true });
    writeFileSync(join(dirCase, "f.txt"), "x");
    let dirThrew = false;
    try { assertPacketShape(dirCase); } catch { dirThrew = true; }
    if (dirThrew) ok("two entries where one is a DIRECTORY is rejected (count alone would have passed)");
    else bad("a directory counted as one of the two files");

    const inRepo = join(REPO, ".blind-packet-selftest");
    let repoCaught = false;
    try { buildPacket({ intoDir: inRepo }); } catch (e) {
      repoCaught = /INSIDE a git repository/.test(String(e.message));
    } finally { rmSync(inRepo, { recursive: true, force: true }); }
    if (repoCaught) ok("building INSIDE the git repo is refused");
    else bad("building inside the git repo was allowed — the not-in-a-repo clause is failing open");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  err("");
  if (fail) { err(`SELF-TEST FAILED: ${fail} of ${pass + fail} case(s)`); return 1; }
  err(`SELF-TEST OK: ${pass}/${pass} — every clause was shown to fire, and the real files still pass.`);
  return 0;
}

// ── entry ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  err("usage: node evals/blind/make-blind-packet.mjs [--self-test]");
  process.exit(0);
}
if (argv.includes("--self-test")) {
  process.exit(selfTest());
}

try {
  const { dir, entries } = buildPacket();
  err(`blind packet: ${entries.length} file(s) at ${dir}`);
  for (const e of entries) err(`  ${e}`);
  reportExportIdentifiers(EXPORT_SRC);
  // stdout carries the path and nothing else — the runbook binds $(...) to it.
  process.stdout.write(dir + "\n");
} catch (e) {
  if (!e.problems) err(`FAIL: ${e.message}`);
  process.exit(1);
}
