// tools/chrome.mjs — H1. The one place that launches Chrome, so that every graded run in
// this repository is LABELLED with the scenario that produced it.
//
//   node tools/chrome.mjs --scenario cdp    --print-flags
//   node tools/chrome.mjs --scenario manual --print-flags
//   node tools/chrome.mjs --scenario none   --print-flags
//   node tools/chrome.mjs --scenario cdp --url https://example.test/
//
// THE FLAG CONVENTION IS A HOUSE RULE ABOUT OUR OWN CONFIGURATION. It is NOT a claim about
// the browser. MEASURED 2026-08-28 on Chrome 152.0.7977.64, --headless=new, a clean dedicated
// --user-data-dir per launch, page over http://localhost (erp/FACTS.md IR-16(a), CONFIRMED):
// `--enable-features=WebMCP` and `--enable-features=WebMCPTesting` are INTERCHANGEABLE —
// either one gives `typeof document.modelContext === 'object'` and registerTool succeeds.
// A graded run made under the other name is an UNLABELLED run, not a broken one. What the
// convention buys is only this: a launcher log says which scenario produced a run.
//
// WHAT IS A REAL FAILURE MODE, and the reason this file is worth its hours: NO flag at all.
// IR-16(b) — with no flag `document.modelContext` is `undefined`, headless included. That is a
// silently toolless page and hours of false debugging. `--scenario none` makes that arm a
// named, logged launch instead of something a seat improvises at the shell, because H2's
// evidence file needs a `noFlagPageApiAbsent` reading taken the same way as the positive one.
//
// Do NOT grade flag-presence off the CDP `WebMCP.enable` call: it returns OK even with no page
// API at all, which is exactly how the now-retracted IR-16(b) claim got published. Probe
// `typeof document.modelContext` instead.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

// Each scenario owns its feature-flag spelling, its default headless-ness, and its own default
// debugging port — distinct ports so the positive arm and the `none` control can be launched
// side by side without one silently attaching to the other's browser.
export const SCENARIOS = {
  cdp: { feature: "WebMCP", headless: true, port: 9222 },
  manual: { feature: "WebMCPTesting", headless: false, port: 9223 },
  none: { feature: null, headless: true, port: 9224 },
};

export function scenarioNames() {
  return Object.keys(SCENARIOS);
}

// A clean dedicated profile per launch, which is the condition the IR-16 measurement was taken
// under. A launcher that reuses the developer's real profile is measuring a different browser.
// This only COMPUTES the path; nothing is created until an actual launch, so --print-flags
// stays a side-effect-free dry run.
function defaultProfileDir(scenario) {
  return path.join(os.tmpdir(), `outpocket-chrome-${scenario}-${process.pid}-${Date.now()}`);
}

export function flagsFor(scenario, opts = {}) {
  const spec = SCENARIOS[scenario];
  if (!spec) throw new Error(`unknown --scenario ${scenario}; known: ${scenarioNames().join(", ")}`);

  const headless = opts.headless ?? spec.headless;
  const port = opts.port ?? spec.port;
  const flags = [`--user-data-dir=${opts.userDataDir ?? defaultProfileDir(scenario)}`];

  // The labelling flag. `none` deliberately emits nothing here: its whole job is to be the
  // negative control, and a control that mentions the feature is not one.
  if (spec.feature) flags.push(`--enable-features=${spec.feature}`);

  if (headless) flags.push("--headless=new");
  flags.push(`--remote-debugging-port=${port}`);
  flags.push("--no-first-run");
  flags.push("--no-default-browser-check");
  if (opts.url) flags.push(opts.url);
  return flags;
}

// A one-line launch record. This is the artifact the convention exists to produce: it names the
// scenario, so a run can never be graded without its label. Goes to stderr, so --print-flags
// keeps stdout to nothing but flags.
export function launchLabel(scenario, flags) {
  const feature = SCENARIOS[scenario].feature;
  return `outpocket-chrome scenario=${scenario} flag=${feature ? `--enable-features=${feature}` : "(none)"} flags=${flags.length}`;
}

function resolveBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates =
    process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(`no Chrome found; set CHROME_BIN. Tried: ${candidates.join(", ")}`);
}

function parseArgv(argv) {
  const out = { printFlags: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--print-flags") out.printFlags = true;
    else if (a === "--scenario") out.scenario = argv[++i];
    else if (a === "--url") out.url = argv[++i];
    else if (a === "--port") out.port = Number(argv[++i]);
    else if (a === "--user-data-dir") out.userDataDir = argv[++i];
    else if (a === "--headed") out.headless = false;
    else if (a === "--headless") out.headless = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

function main(argv) {
  const opts = parseArgv(argv);
  if (!opts.scenario) {
    throw new Error(`--scenario is required; one of: ${scenarioNames().join(", ")}`);
  }
  const flags = flagsFor(opts.scenario, opts);

  if (opts.printFlags) {
    // Plain strings, one flag per line, via process.stdout.write. NEVER console.log of an
    // inspected value: every resident seat exports FORCE_COLOR=3 (kb/pits/L0.md), which makes
    // util.inspect emit SGR codes even into a pipe, and NO_COLOR=1 does not suppress it. Any
    // predicate that greps this output would then fail in a seat and pass in a bare shell.
    // Nothing else goes to stdout here — in particular no help banner, which would put the
    // string "WebMCPTesting" into the cdp scenario's output and break its own label.
    process.stdout.write(flags.join("\n") + "\n");
    return 0;
  }

  const bin = resolveBinary();
  const profile = flags.find((f) => f.startsWith("--user-data-dir=")).slice("--user-data-dir=".length);
  fs.mkdirSync(profile, { recursive: true });
  process.stderr.write(launchLabel(opts.scenario, flags) + "\n");
  const child = spawn(bin, flags, { stdio: "inherit" });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
  return null; // the child owns the exit code
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const rc = main(process.argv.slice(2));
    if (rc !== null) process.exit(rc);
  } catch (err) {
    process.stderr.write(`tools/chrome.mjs: ${err.message}\n`);
    process.exit(2);
  }
}
