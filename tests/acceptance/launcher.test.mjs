// H1 — acceptance for tools/chrome.mjs.
//
// WHAT THIS FILE ASSERTS, AND WHAT IT DOES NOT.
// It asserts a HOUSE RULE ABOUT OUR OWN CONFIGURATION: `--scenario cdp` emits the flag
// spelled `--enable-features=WebMCP`, `--scenario manual` emits
// `--enable-features=WebMCPTesting`, so that a launcher log says which scenario produced a run.
//
// It is NOT a claim about the browser. MEASURED 2026-08-28 (erp/FACTS.md IR-16(a),
// CONFIRMED): on Chrome 152.0.7977.64 the two flag names are INTERCHANGEABLE — either one
// gives `typeof document.modelContext === 'object'` and registerTool succeeds. A graded run
// made under the other name is an UNLABELLED run, not a broken one.
//
// What IS a real failure mode, and the reason this node exists, is NO flag at all:
// IR-16(b) — with no flag the page API is `undefined`, headless included. That is a silently
// toolless page and hours of false debugging, which is why `--scenario none` exists below as
// a named negative control rather than as something a seat improvises at the shell.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEMO_STEP_DELAY_MS,
  demoBannerText,
  labelAsDemo,
  runDemo,
} from "../../src/page/demo-mode.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Quoted VERBATIM from erp/graph.json H1.accept. The drift guard at the bottom of this file
// proves they are still verbatim; do not edit either string without re-running it.
const CMD_CDP = "node tools/chrome.mjs --scenario cdp --print-flags";
const CMD_MANUAL = "node tools/chrome.mjs --scenario manual --print-flags";

// Run the literal command string, from the repo root, the way the accept predicate reads it.
function run(cmd, env = {}) {
  const r = spawnSync("sh", ["-c", cmd], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ...env } });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", lines: (r.stdout ?? "").split("\n") };
}

test("cdp scenario prints --enable-features=WebMCP", () => {
  const r = run(CMD_CDP);
  assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr}`);
  assert.ok(
    r.lines.some((l) => l.includes("--enable-features=WebMCP")),
    `no line contained --enable-features=WebMCP; stdout was:\n${r.stdout}`,
  );
});

test("cdp scenario prints WebMCPTesting nowhere", () => {
  // `--enable-features=WebMCP` is a PREFIX of `--enable-features=WebMCPTesting`, so the
  // assertion above passes even if cdp emitted the manual spelling. This is the half of the
  // predicate that actually pins the label down. Asserted over the whole of stdout, not just
  // the flag line, so a help banner naming both scenarios cannot sneak the string back in.
  const r = run(CMD_CDP);
  assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr}`);
  assert.ok(!r.stdout.includes("WebMCPTesting"), `stdout mentioned WebMCPTesting:\n${r.stdout}`);
});

test("manual scenario prints --enable-features=WebMCPTesting", () => {
  const r = run(CMD_MANUAL);
  assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr}`);
  assert.ok(
    r.lines.some((l) => l.includes("--enable-features=WebMCPTesting")),
    `no line contained --enable-features=WebMCPTesting; stdout was:\n${r.stdout}`,
  );
});

test("printed flags carry no SGR escape codes", () => {
  // kb/pits/L0.md: every resident seat runs with FORCE_COLOR=3 exported by its harness, which
  // forces colour even into a pipe, and NO_COLOR=1 does not suppress it. Any predicate that
  // greps a colourising tool's output then fails inside a seat and passes in a bare shell.
  // This makes the launcher's freedom from that a TESTED property: it prints plain strings via
  // process.stdout.write, never an inspected value. Run under an explicit FORCE_COLOR=3 so the
  // guard holds in a bare shell too.
  const SGR = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m");
  // Prove the guard is not vacuous before trusting a negative from it: a "must not appear"
  // assertion whose pattern can never match is indistinguishable from a passing test.
  assert.ok(SGR.test(String.fromCharCode(27) + "[31mred" + String.fromCharCode(27) + "[0m"), "the SGR guard pattern is broken");
  for (const cmd of [CMD_CDP, CMD_MANUAL]) {
    const r = run(cmd, { FORCE_COLOR: "3" });
    assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr}`);
    assert.ok(
      !SGR.test(r.stdout),
      `stdout carried SGR codes under FORCE_COLOR=3:\n${JSON.stringify(r.stdout)}`,
    );
  }
});

test("each scenario gets its own fresh --user-data-dir", () => {
  // The IR-16 measurement was taken with a clean dedicated --user-data-dir per launch. A
  // launcher that reuses the developer's real profile is measuring a different browser.
  for (const cmd of [CMD_CDP, CMD_MANUAL]) {
    const r = run(cmd);
    assert.ok(
      r.lines.some((l) => l.startsWith("--user-data-dir=")),
      `no --user-data-dir line for: ${cmd}\n${r.stdout}`,
    );
  }
});

test("none scenario is the negative control: no --enable-features at all", () => {
  // IR-16(b): with no flag the page API is `undefined`, headless included. H2's evidence file
  // needs a `noFlagPageApiAbsent` arm, and this is the launch it comes from.
  const r = run("node tools/chrome.mjs --scenario none --print-flags");
  assert.equal(r.status, 0, `exit ${r.status}; stderr: ${r.stderr}`);
  assert.ok(!r.stdout.includes("--enable-features"), `none scenario emitted a feature flag:\n${r.stdout}`);
  assert.ok(!r.stdout.includes("WebMCP"), `none scenario mentioned WebMCP:\n${r.stdout}`);
});

test("an unknown scenario fails loudly instead of guessing a flag", () => {
  // The whole value of the convention is that a log names the scenario. Silently defaulting a
  // typo to one of the two spellings makes a MISLABELLED run, which is worse than no run.
  const r = run("node tools/chrome.mjs --scenario cpd --print-flags");
  assert.notEqual(r.status, 0, `a typo'd scenario exited 0; stdout:\n${r.stdout}`);
  assert.ok(/cpd/.test(r.stderr), `error did not name the bad scenario; stderr:\n${r.stderr}`);
});

test("a missing --scenario fails rather than defaulting", () => {
  const r = run("node tools/chrome.mjs --print-flags");
  assert.notEqual(r.status, 0, `missing --scenario exited 0; stdout:\n${r.stdout}`);
  // Exit-non-zero alone is satisfied by a missing module, so this test would go green before
  // the launcher existed and prove nothing. Require the launcher's OWN diagnostic.
  assert.ok(/--scenario/.test(r.stderr), `error did not name --scenario; stderr:\n${r.stderr}`);
});

test("--print-flags needs no Chrome binary on disk", () => {
  // --print-flags is a dry run. It must not resolve or stat the browser, so this test — and
  // anything downstream of it — can run in CI, which has no Chrome and no display.
  const r = run(CMD_CDP, { CHROME_BIN: "/nonexistent/definitely/not/chrome" });
  assert.equal(r.status, 0, `exit ${r.status} with a bogus CHROME_BIN; stderr: ${r.stderr}`);
  assert.ok(r.stdout.includes("--enable-features=WebMCP"), r.stdout);
});

test("the two quoted commands are still verbatim in erp/graph.json", () => {
  // erp/PATHS.md §0: the charters and the graph drifted into two vocabularies once already.
  // This makes that drift loud here instead of silent. Skipped when erp/ is absent (a clone
  // shipping only the runtime tree), because the graph is an authority, not a runtime dep.
  const graphPath = path.join(ROOT, "erp", "graph.json");
  if (!fs.existsSync(graphPath)) return;
  const g = JSON.parse(fs.readFileSync(graphPath, "utf8"));
  const h1 = g.nodes.find((n) => n.id === "H1");
  assert.ok(h1, "no node H1 in erp/graph.json");
  const spans = [...h1.accept.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  for (const cmd of [CMD_CDP, CMD_MANUAL]) {
    assert.ok(spans.includes(cmd), `H1.accept no longer quotes: ${cmd}\nspans: ${JSON.stringify(spans)}`);
  }
});

// F4a's three phases stay pinned here, but F4c makes the running phase a held
// sequence rather than a static sentence. The duration guard catches a future
// "fast test" default leaking into the filmed path; runDemo's test below uses
// the explicit zero-duration seam instead.
test("the seeded demo banner has exact start, working, and complete states", () => {
  assert.ok(DEMO_STEP_DELAY_MS >= 800 && DEMO_STEP_DELAY_MS <= 1000);
  assert.equal(
    demoBannerText(7, "start"),
    "Automated demo · seed 7 · Step 1 of 6 · Signing in as Chen… Nothing will be submitted.",
  );
  assert.equal(
    demoBannerText(7, "working"),
    "Automated demo · seed 7 · Step 2 of 6 · Building and checking a draft… Nothing will be submitted.",
  );
  assert.equal(
    demoBannerText(7, "complete", { reportId: "RP-1018" }),
    "Demo complete · seed 7 · report RP-1018 · Clean draft ready to review below. Nothing was submitted; signing still requires you.",
  );

  const attributes = new Map();
  const banner = {
    textContent: "stale running text",
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const doc = { getElementById: (id) => id === "agent-banner" ? banner : null };
  assert.equal(labelAsDemo(doc, 7, "complete", { reportId: "RP-1018" }), true);
  assert.equal(banner.textContent, demoBannerText(7, "complete", { reportId: "RP-1018" }));
  assert.equal(attributes.get("aria-live"), "polite");
  assert.equal(attributes.get("data-demo-progress"), "6/6");
});

// The real defect was temporal: a settled-state assertion could pass while no
// sampled frame ever showed S2. This fake keeps the production state counts and
// tool responses but removes only the waits, then records every DOM progress
// write. It therefore pins the 6 -> 13 -> 14 story without adding seconds to the
// suite or mistaking an eventual S3 result for a visible transition.
test("the seed 7 demo exposes each progress frame, report id, and S2 surface", async () => {
  const updates = [];
  const attributes = new Map();
  let bannerText = "";
  const banner = {
    get textContent() { return bannerText; },
    set textContent(value) { bannerText = value; },
    setAttribute(name, value) {
      attributes.set(name, value);
      if (name === "data-demo-progress") {
        updates.push({ text: bannerText, progress: value, live: attributes.get("aria-live") });
      }
    },
  };

  let state = "S0";
  const surfaces = {
    S0: ["get_signin_status", "explain_missing_tool"],
    S1: ["get_session_scope", "get_expense_policy", "list_expense_reports", "create_expense_report", "open_expense_report", "explain_missing_tool"],
    S2: ["get_session_scope", "get_expense_policy", "list_expense_reports", "create_expense_report", "open_expense_report", "get_open_report", "add_expense_line", "update_expense_line", "remove_expense_line", "list_receipts", "link_receipt", "validate_expense_report", "explain_missing_tool"],
  };
  surfaces.S3 = [...surfaces.S2.slice(0, -1), "submit_expense_report", "explain_missing_tool"];

  const calls = [];
  let createdArgs = null;
  const tools = {
    erp: { now: () => new Date(2026, 7, 30, 12, 0, 0) },
    state: () => state,
    names: () => surfaces[state],
    async executeTool(name, args) {
      calls.push(name);
      if (name === "get_session_scope") {
        return { content: [{ text: "Chen Xiao · role employee. Chargeable projects: FALCON (active); HERON (active); KESTREL (CLOSED)." }] };
      }
      if (name === "create_expense_report") {
        createdArgs = args;
        state = "S2";
        return { content: [{ text: "Draft RP-1018 created and opened for project HERON." }] };
      }
      if (name === "add_expense_line") {
        state = "S3";
        return { content: [{ text: "Line added. Policy check: clean." }] };
      }
      return { content: [{ text: "Validation complete. Policy check: clean." }] };
    },
  };
  const doc = {
    getElementById: (id) => id === "agent-banner" ? banner : null,
    querySelector: (selector) => selector === '[data-persona="chen"]'
      ? { click: () => { state = "S1"; } }
      : null,
  };

  const result = await runDemo({ seed: 7, tools, shell: null, doc, stepDelayMs: 0 });

  assert.equal(result.reachedState, "S3");
  assert.equal(result.reportId, "RP-1018");
  assert.equal(result.plan.project, "HERON");
  assert.equal(createdArgs.project, "HERON");
  assert.equal(result.steps.length, 7);
  assert.ok(result.steps.every((step) => step.ok));
  assert.deepEqual(calls, [
    "get_session_scope",
    "create_expense_report",
    "add_expense_line",
    "add_expense_line",
    "add_expense_line",
    "validate_expense_report",
  ]);
  assert.deepEqual(updates.map((update) => update.progress), ["1/6", "2/6", "3/6", "4/6", "5/6", "6/6", "6/6"]);
  assert.ok(updates.every((update) => update.live === "polite"));
  assert.equal(
    updates[1].text,
    "Automated demo · seed 7 · Step 2 of 6 · Creating a draft for project HERON… Nothing will be submitted.",
  );
  assert.equal(
    updates[2].text,
    "Automated demo · seed 7 · report RP-1018 · Step 3 of 6 · Adding a $15.90 coffee line… (surface: 13 tools, draft needs attention)",
  );
  assert.equal(
    updates[5].text,
    "Automated demo · seed 7 · report RP-1018 · Step 6 of 6 · Validating… (surface: 14 tools, ready to submit)",
  );
  assert.equal(
    updates[6].text,
    "Demo complete · seed 7 · report RP-1018 · Clean draft ready to review below. Nothing was submitted; signing still requires you.",
  );
});
