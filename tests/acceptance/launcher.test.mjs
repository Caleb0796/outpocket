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
