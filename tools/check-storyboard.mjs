#!/usr/bin/env node
// tools/check-storyboard.mjs — node F6 (lane F, owner UX).
//
// Every shot id in docs/STORYBOARD.md must resolve to a CSS selector that
// matches at least one element on the BUILT PAGE. That sentence hides three
// ways to pass while proving nothing, and this file is mostly the three
// answers.
//
// ── (1) "EVERY SHOT RESOLVES" IS TRUE OF ZERO SHOTS ─────────────────────────
//
// A parser that finds no shots iterates an empty list and exits 0. That is the
// for-loop-over-nothing that has cost this sprint more than any other shape. So
// the parse is checked before anything is resolved: at least MIN_SHOTS rows, ids
// contiguous from SB-01 with no gaps and no duplicates, and the DUR column
// summing to the total STORYBOARD.md declares in its own prose. A storyboard
// that parses to nothing is a LOUD failure, and the shot count is printed on
// every run so a silent drop from 13 to 2 is visible rather than green.
//
// ── (2) "MATCHING AT LEAST ONE ELEMENT" IS SATISFIED BY `body` ──────────────
//
// It is also satisfied by `div`. A selector that matches SOMETHING is not a
// selector that IDENTIFIES the shot, and the whole value of this file is that a
// person holding STORYBOARD.md can find the thing on screen. THE RULE, STATED
// HERE SO THE NEXT PERSON ARGUES WITH A RULE RATHER THAN WITH MY TASTE:
//
//   R1  SHAPE. The selector must contain an #id or an [attribute] selector.
//       A bare type selector (body, div, main) names a structural element the
//       platform provides, not something an author created for this shot.
//   R2  RESOLUTION. It must match at least one element in at least one declared
//       state, and the state that resolved it is reported.
//   R3  NON-STRUCTURAL. It must not match <html> or <body> themselves. A shot
//       anchored to the document is anchored to nothing.
//
// R1 and R3 both reject `body`, deliberately: the rule that matters most is the
// one worth stating twice.
//
// ── (3) IT MUST RUN AGAINST THE PAGE A JUDGE LOADS ──────────────────────────
//
// Against the SERVED page in a real Chrome, never a fixture written here. A
// document this file authored is not evidence about the page a judge loads —
// the same reason F4's dialog test drove the served page as well as its own
// fake document.
//
// ── "THE BUILT PAGE" IS NOT ONE PAGE ────────────────────────────────────────
//
// This is a state machine whose entire thesis is that the surface changes with
// state, so its storyboard checker has to know that. SB-10 and SB-11 live in
// the signature dialog and resolve only once that dialog is mounted; a fresh
// load is not in that state and never will be. Each shot is therefore resolved
// across DECLARED STATES and passes if it resolves in any of them, with the
// resolving state named in the output.
//
// ── AND THIS TOOL IS SUBJECT TO EVERY FAILURE IT CHECKS FOR ─────────────────
//
// Three instruments failed open in this project on one day, each written
// immediately after its author was burned by the thing it was meant to catch.
// So `--self-test` is built in rather than bolted on, and it follows D-90: it
// proves the tool can still return the NEGATIVE by making a selector WRONG
// WHILE THE ELEMENT STILL EXISTS. Deleting the element would only prove the
// tool notices missing elements, which is not the claim under test.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STORYBOARD = join(REPO, "docs", "STORYBOARD.md");
const MIN_SHOTS = 8;

const log = (s) => process.stdout.write(s + "\n");
const warn = (s) => process.stderr.write(s + "\n");

// ── parse ───────────────────────────────────────────────────────────────────

/** Rows look like: | `SB-01` | 1 | 10s | on screen | `selector` | yes | */
export function parseStoryboard(markdown) {
  const shots = [];
  for (const line of markdown.split("\n")) {
    const m = /^\|\s*`(SB-\d+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/.exec(line);
    if (!m) continue;
    const [, id, beat, dur, onScreen, selectorCell, still] = m;
    const sel = selectorCell.trim().replace(/^`|`$/g, "").trim();
    shots.push({
      id,
      beat: beat.trim(),
      seconds: Number((/(\d+)\s*s/.exec(dur) ?? [])[1] ?? NaN),
      onScreen: onScreen.trim(),
      selector: sel,
      still: /yes/i.test(still),
      cut: /\bCUT\b/.test(onScreen) || /\bCUT\b/.test(selectorCell),
    });
  }
  return shots;
}

/** The total the document declares in its own prose, e.g. "**Total: 162s**". */
export function declaredTotal(markdown) {
  const m = /\*\*Total:\s*(\d+)s\*\*/.exec(markdown);
  return m ? Number(m[1]) : null;
}

/** Structural checks on the PARSE, before anything is resolved. */
export function checkParse(shots, total) {
  const problems = [];
  if (shots.length === 0) {
    problems.push("parsed ZERO shots out of docs/STORYBOARD.md — the table did not match, " +
      "and a check over zero shots passes vacuously. This is the failure this assertion exists for.");
    return problems;
  }
  if (shots.length < MIN_SHOTS) {
    problems.push(`parsed only ${shots.length} shot(s); expected at least ${MIN_SHOTS}. ` +
      "A parse that silently drops rows turns every downstream check green.");
  }
  const ids = shots.map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push(`duplicate shot ids: ${ids.join(", ")}`);
  ids.forEach((id, i) => {
    const want = `SB-${String(i + 1).padStart(2, "0")}`;
    if (id !== want) problems.push(`shot ids are not contiguous: expected ${want} at position ${i + 1}, got ${id}`);
  });
  for (const s of shots) {
    if (!Number.isFinite(s.seconds)) problems.push(`${s.id}: no duration parsed`);
    if (!s.selector) problems.push(`${s.id}: no selector parsed`);
  }
  const sum = shots.reduce((n, s) => n + (Number.isFinite(s.seconds) ? s.seconds : 0), 0);
  if (total !== null && sum !== total) {
    problems.push(`durations sum to ${sum}s but STORYBOARD.md declares ${total}s — ` +
      "the parse and the document disagree, so one of them is wrong.");
  }
  return problems;
}

/** R1 and R3's syntactic half. Returns null when the shape is acceptable. */
export function checkSelectorShape(selector) {
  if (/^\s*$/.test(selector)) return "empty selector";
  if (!/[#[]/.test(selector)) {
    return `R1: "${selector}" contains no #id and no [attribute] — a bare type selector ` +
      "names a structural element the platform provides, not something authored for this shot " +
      "(`body` and `div` both match, and identify nothing)";
  }
  if (/^\s*(html|body)\s*$/i.test(selector)) return `R3: "${selector}" is the document itself`;
  return null;
}

// ── the page under test ─────────────────────────────────────────────────────

async function serveApp() {
  const { createHttpServer } = await import(resolve(REPO, "server", "index.mjs"));
  const server = createHttpServer();
  await new Promise((res, rej) => { server.once("error", rej); server.listen(0, "127.0.0.1", res); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

function chromeBinary() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  const candidates = process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`no Chrome found; set CHROME_BIN. Tried: ${candidates.join(", ")}`);
}

async function launchChrome(url) {
  const { flagsFor, launchLabel } = await import(resolve(REPO, "tools", "chrome.mjs"));
  const profile = join(tmpdir(), `outpocket-storyboard-${process.pid}-${Date.now()}`);
  const flags = flagsFor("cdp", { headless: true, port: 0, userDataDir: profile });
  // port 0 lets the OS choose; read the real one off Chrome's own stderr line.
  const proc = spawn(chromeBinary(), flags, { stdio: ["ignore", "ignore", "pipe"] });
  warn(launchLabel("cdp", flags));

  const wsUrl = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Chrome did not announce a DevTools endpoint in 15s")), 15000);
    let buf = "";
    proc.stderr.on("data", (d) => {
      buf += d.toString();
      const m = /ws:\/\/[^\s]+/.exec(buf);
      if (m) { clearTimeout(t); res(m[0]); }
    });
    proc.once("exit", (code) => { clearTimeout(t); rej(new Error(`Chrome exited early (${code})`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("CDP socket failed")); });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const n = ++id;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
  const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text ?? "evaluate failed");
    return r.result?.result?.value;
  };
  const goto = async (target) => {
    await send("Page.navigate", { url: target }, sessionId);
    for (let i = 0; i < 100; i++) {
      const ready = await evaluate("document.readyState === 'complete'").catch(() => false);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await evaluate("new Promise(r => setTimeout(r, 250))");
  };

  return {
    evaluate, goto,
    close: async () => { try { ws.close(); } catch {} proc.kill("SIGKILL"); try { rmSync(profile, { recursive: true, force: true }); } catch {} },
  };
}

// ── states ──────────────────────────────────────────────────────────────────
//
// Declared, named, and each one says how it is entered. A shot passes if it
// resolves in ANY of them, and the resolving state is reported so a reader can
// reproduce the frame.

const STATES = [
  { id: "s0-anon", how: "fresh load, signed out", enter: async () => {} },
  {
    id: "s1-emp-home", how: "signed in as chen through the page's own control",
    enter: async (page) => {
      await page.evaluate(`(async () => {
        document.querySelector('[data-login="chen"]')?.click();
        await new Promise(r => setTimeout(r, 400));
      })()`);
    },
  },
  {
    id: "s5-aud", how: "signed in as ruiz",
    enter: async (page) => {
      await page.evaluate(`(async () => {
        document.querySelector('[data-action="switch"]')?.click();
        document.querySelector('[data-login="ruiz"]')?.click();
        await new Promise(r => setTimeout(r, 400));
      })()`);
    },
  },
  {
    id: "sign-open", how: "the signature dialog mounted, as F7's provider mounts it",
    enter: async (page) => {
      await page.evaluate(`(async () => {
        document.querySelector('[data-login="chen"]')?.click();
        await new Promise(r => setTimeout(r, 400));
        const sd = globalThis.outpocketSignDialog;
        if (!sd) return;
        sd.mountSignDialog({
          doc: document,
          signRequest: {
            request_id: 'sg_' + '1'.repeat(16), report_id: 'RP-1018', persona_name: 'Chen Xiao',
            revision: 1, policy_version: 'x', snapshot_digest: 'sha256:' + 'a'.repeat(64),
            worst_case: 'your employer pays a claim that is not owed.',
            snapshot: { report: { id: 'RP-1018', lines: [{ usdCents: 1200 }] } },
          },
          confirmToken: '',
        });
        await new Promise(r => setTimeout(r, 100));
      })()`);
    },
  },
];

async function resolveInState(page, origin, state, shots) {
  await page.goto(origin + "/");
  await state.enter(page);
  const sels = JSON.stringify(shots.map((s) => s.selector));
  return page.evaluate(`(() => {
    const out = [];
    for (const sel of ${sels}) {
      let n = 0, structural = false;
      try {
        const found = document.querySelectorAll(sel);
        n = found.length;
        structural = [...found].some(e => e === document.documentElement || e === document.body);
      } catch { n = -1; }
      out.push({ n, structural });
    }
    return out;
  })()`);
}

// ── run ─────────────────────────────────────────────────────────────────────

async function run({ selfTest = false } = {}) {
  const markdown = readFileSync(STORYBOARD, "utf8");
  const shots = parseStoryboard(markdown);
  const total = declaredTotal(markdown);

  log(`check-storyboard: ${shots.length} shot(s) parsed from docs/STORYBOARD.md, ` +
    `durations ${shots.reduce((n, s) => n + (s.seconds || 0), 0)}s, declared ${total ?? "(none)"}s`);

  const parseProblems = checkParse(shots, total);
  if (parseProblems.length) {
    for (const p of parseProblems) warn(`  PARSE  ${p}`);
    warn("\nFAIL: the storyboard did not parse into a checkable shot list.");
    return 1;
  }

  const live = shots.filter((s) => !s.cut);
  const shapeProblems = [];
  for (const s of live) {
    const bad = checkSelectorShape(s.selector);
    if (bad) shapeProblems.push(`${s.id}  ${bad}`);
  }

  const app = await serveApp();
  const page = await launchChrome();
  const results = new Map(live.map((s) => [s.id, { hits: 0, state: null, structural: false, error: false }]));

  try {
    for (const state of STATES) {
      const counts = await resolveInState(page, app.origin, state, live);
      counts.forEach((c, i) => {
        const r = results.get(live[i].id);
        if (c.n === -1) r.error = true;
        if (c.structural) r.structural = true;
        if (c.n > 0 && r.hits === 0) { r.hits = c.n; r.state = state.id; }
      });
    }

    if (selfTest) {
      // D-90: prove the tool can still return the NEGATIVE — by making a
      // selector WRONG WHILE THE ELEMENT STILL EXISTS. Deleting the element
      // would only show the tool notices missing elements, which is not the
      // claim. #env-banner is on every page in every state; #env-bnner is not.
      const probe = [{ id: "SELFTEST", selector: "#env-bnner", seconds: 0 }];
      const counts = await resolveInState(page, app.origin, STATES[0], probe);
      const real = await resolveInState(page, app.origin, STATES[0],
        [{ id: "SELFTEST-OK", selector: "#env-banner", seconds: 0 }]);
      log("");
      log("SELF-TEST (D-90: a wrong selector, with the element still present)");
      log(`  #env-banner  matched ${real[0].n}  <- the element exists`);
      log(`  #env-bnner   matched ${counts[0].n}  <- one character wrong`);
      if (real[0].n < 1) { warn("  SELF-TEST FAILED: the tool cannot see an element that is there."); return 1; }
      if (counts[0].n !== 0) { warn("  SELF-TEST FAILED: the tool matched a selector that should match nothing."); return 1; }
      log("  ok — the tool distinguishes a right selector from a wrong one against the same DOM.");

      // THE OTHER TWO DEFENCES ARE ALSO INSTRUMENTS AND ALSO NEED PROVING.
      // The resolution check above is one of three; a self-test that covers
      // only the defence I happened to think of first is the same failing-open
      // shape it exists to prevent.
      log("");
      log("SELF-TEST (the parse guard: a storyboard with no shots must be LOUD)");
      const empty = checkParse(parseStoryboard("# not a storyboard\n\nno table here.\n"), null);
      log(`  zero-shot parse produced ${empty.length} problem(s)`);
      if (!empty.length) { warn("  SELF-TEST FAILED: a zero-shot storyboard passed the parse guard."); return 1; }
      const short = checkParse(parseStoryboard(markdown).slice(0, 2), 162);
      if (!short.length) { warn("  SELF-TEST FAILED: a truncated shot list passed the parse guard."); return 1; }
      log(`  truncated (2-shot) parse produced ${short.length} problem(s)`);
      log("  ok — a parse that finds nothing, or too little, fails loudly.");

      log("");
      log("SELF-TEST (R1/R3: a selector that matches everything must be REJECTED)");
      const rows = [["body", true], ["div", true], ["main", true],
                    ["#env-banner", false], ['[data-persona="chen"]', false]];
      for (const [sel, mustReject] of rows) {
        const verdict = checkSelectorShape(sel);
        const rejected = verdict !== null;
        log(`  ${String(sel).padEnd(24)} ${rejected ? "rejected" : "accepted"}`);
        if (rejected !== mustReject) {
          warn(`  SELF-TEST FAILED: "${sel}" should have been ${mustReject ? "rejected" : "accepted"}.`);
          return 1;
        }
      }
      log("  ok — a bare type selector cannot satisfy a shot, and a real one still can.");
    }
  } finally {
    await page.close();
    await app.close();
  }

  log("");
  log("SHOT   SELECTOR                              HITS  STATE");
  const failures = [];
  for (const s of live) {
    const r = results.get(s.id);
    const status = r.hits > 0 && !r.structural && !r.error;
    log(`${s.id}  ${s.selector.padEnd(36).slice(0, 36)}  ${String(r.hits).padStart(4)}  ${r.state ?? "-"}`);
    if (r.error) failures.push(`${s.id}: "${s.selector}" is not a valid CSS selector`);
    else if (r.structural) failures.push(`${s.id}: R3 — matches <html> or <body>; anchored to the document is anchored to nothing`);
    else if (!status) failures.push(`${s.id}: "${s.selector}" matched no element in any of ${STATES.map((x) => x.id).join(", ")}`);
  }

  for (const p of shapeProblems) failures.push(p);

  log("");
  if (!failures.length) {
    log(`OK: ${live.length} shot(s), every one resolving on the served page.`);
    return 0;
  }
  warn(`FAIL: ${failures.length} of ${live.length} shot(s) do not resolve:`);
  for (const f of failures) warn(`  ${f}`);
  warn("");
  warn("States driven: " + STATES.map((s) => `${s.id} (${s.how})`).join("; "));
  return 1;
}

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  log("usage: node tools/check-storyboard.mjs [--self-test]");
  process.exit(0);
}
process.exit(await run({ selfTest: argv.includes("--self-test") }));
