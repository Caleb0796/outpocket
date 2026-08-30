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

/**
 * THE PARSER IS HEADER-DRIVEN, AND THAT IS THE FIX FOR A DEFECT L2 FOUND IN IT.
 *
 * The first version matched columns POSITIONALLY with an unanchored six-group
 * regex. Measured, both placements: a SURFACE column APPENDED as a 7th is
 * matched by none of the groups and SILENTLY IGNORED — so D-94 would have
 * landed as decoration, off-page shots would have gone on being resolved as
 * page selectors, and if those selectors happened to resolve, F6 would have
 * gone GREEN ON SHOTS THAT WERE STILL MISCATEGORISED. Exit 0 discovering
 * nothing, on the instrument built to prevent exactly that. Inserted as a 3rd
 * column it broke loudly instead ("no duration parsed"), which is luck, not
 * design: the same parser gave opposite behaviour for the same edit depending
 * on where it was made.
 *
 * So columns are now resolved BY NAME from the table's own header row. Adding a
 * column anywhere is safe, a REQUIRED column going missing is loud, and an
 * unrecognised column is reported rather than ignored. A parser that tolerates
 * schema drift will tolerate every future schema change too, including the one
 * that matters.
 */
export const REQUIRED_COLUMNS = Object.freeze(["SHOT", "DUR", "SELECTOR", "SURFACE"]);

/** Surfaces a shot may be filmed on. `page` is the only one this tool resolves. */
export const PAGE_SURFACE = "page";
export const OFF_PAGE_SURFACES = Object.freeze(["agent-client", "terminal"]);

const cells = (line) => line.split("|").slice(1, -1).map((c) => c.trim());

/** Find the shot table's header row and map COLUMN NAME -> index. */
export function parseHeader(markdown) {
  for (const line of markdown.split("\n")) {
    if (!/^\|/.test(line)) continue;
    const names = cells(line).map((c) => c.replace(/\*|`/g, "").trim().toUpperCase());
    if (names[0] === "SHOT") {
      const index = {};
      names.forEach((n, i) => { if (n) index[n] = i; });
      return { index, names };
    }
  }
  return null;
}

export function parseStoryboard(markdown) {
  const header = parseHeader(markdown);
  if (!header) return { shots: [], header: null };

  const at = (row, name) => {
    const i = header.index[name];
    return i === undefined ? null : (row[i] ?? null);
  };

  const shots = [];
  for (const line of markdown.split("\n")) {
    if (!/^\|\s*`SB-\d+`/.test(line)) continue;
    const row = cells(line);
    const id = (at(row, "SHOT") ?? "").replace(/`/g, "").trim();
    if (!/^SB-\d+$/.test(id)) continue;
    const onScreen = at(row, "ON SCREEN") ?? "";
    const surfaceCell = at(row, "SURFACE");
    shots.push({
      id,
      beat: (at(row, "BEAT") ?? "").trim(),
      seconds: Number((/(\d+)\s*s/.exec(at(row, "DUR") ?? "") ?? [])[1] ?? NaN),
      onScreen: onScreen.trim(),
      selector: (at(row, "SELECTOR") ?? "").replace(/^`|`$/g, "").trim(),
      still: /yes/i.test(at(row, "STILL") ?? ""),
      surface: surfaceCell === null ? null : surfaceCell.replace(/`/g, "").trim(),
      cut: /\bCUT\b/.test(onScreen),
    });
  }
  return { shots, header };
}

/** The total the document declares in its own prose, e.g. "**Total: 162s**". */
export function declaredTotal(markdown) {
  const m = /\*\*Total:\s*(\d+)s\*\*/.exec(markdown);
  return m ? Number(m[1]) : null;
}

/** Structural checks on the PARSE, before anything is resolved. */
export function checkParse(shots, total, header = null) {
  const problems = [];

  // The header is checked BEFORE the rows, because a missing column is why the
  // rows would look fine while meaning something else.
  if (!header) {
    problems.push("no shot-table header row found (expected a row starting `| SHOT |`) — " +
      "without it columns cannot be resolved by name and would have to be guessed by position, " +
      "which is the defect this parser replaced");
  } else {
    for (const col of REQUIRED_COLUMNS) {
      if (header.index[col] === undefined) {
        problems.push(`the shot table has no ${col} column (D-94). Columns found: ${header.names.filter(Boolean).join(", ")}. ` +
          (col === "SURFACE"
            ? `Every shot must declare where it is FILMED: \`${PAGE_SURFACE}\` for a shot on our own page, ` +
              `or one of ${OFF_PAGE_SURFACES.join(", ")} for a shot that is not. Without the column this tool ` +
              "resolves every shot as a page selector, which is how three off-page shots came to carry page selectors."
            : ""));
      }
    }
  }
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
  const KNOWN = new Set([PAGE_SURFACE, ...OFF_PAGE_SURFACES]);
  for (const s of shots) {
    if (!Number.isFinite(s.seconds)) problems.push(`${s.id}: no duration parsed`);
    if (!s.selector) problems.push(`${s.id}: no selector parsed`);
    if (s.surface !== null && !KNOWN.has(s.surface)) {
      problems.push(`${s.id}: surface "${s.surface}" is not one of ${[...KNOWN].join(", ")} — ` +
        "a surface this tool does not recognise is a surface it cannot reason about, " +
        "and defaulting it to `page` is how a miscategorised shot passes");
    }
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
    id: "sign-open",
    how: "an agent's submit_expense_report, through F7's provider and S5's openForDialog — " +
      "a REAL server-issued sign request and confirm_token, not a fabricated one",
    // THIS STATE USED TO LIE, AND THE LIE WAS IN ITS OWN `how` STRING.
    //
    // It called mountSignDialog() directly with a hand-written signRequest —
    // request_id 'sg_111…', snapshot_digest 'sha256:aaa…', a fabricated report —
    // and `confirmToken: ''`. That empty string is LITERALLY the F7 defect I3
    // found: the exact state a real click could not complete from. So the
    // checker mounted the dialog in the broken configuration, reported SB-10
    // and SB-11 as resolving, and described itself as mounting "as F7's
    // provider mounts it" — which F7's provider does not do and never did.
    // Found by QA. It is D-105 in my own instrument: a present, well-reasoned
    // sentence that stops the next reader from checking.
    //
    // It now drives the real thing, and it turned out to be eight lines rather
    // than the H-lane job it looked like. THE ONE TRAP: submit_expense_report
    // CORRECTLY SUSPENDS until the human decides, so the call must NOT be
    // awaited — awaiting it hangs forever, which is the tool behaving exactly
    // as designed. That is why the promise is fired and deliberately floated.
    //
    // What this now proves is strictly more than before: not merely that the
    // selectors exist, but that the REAL pipeline produces the frame — agent
    // calls the tool, F7's provider opens the record through S5, the server
    // issues a digest and a session-scoped confirm_token, and F4's dialog
    // renders them. If any link breaks, this state mounts nothing and SB-10/
    // SB-11 fail to resolve, which is the correct outcome rather than a green.
    enter: async (page) => {
      const report = await page.evaluate(`(async () => {
        document.querySelector('[data-login="chen"]')?.click();
        await new Promise(r => setTimeout(r, 600));
        const t = globalThis.outpocketTools;
        if (!t) return { ok: false, why: 'no tool surface on the page' };
        await t.executeTool('create_expense_report',
          { title: 'Boston client workshop', project: 'FALCON' }, { source: 'agent' });
        await t.executeTool('add_expense_line', {
          date: '2026-08-20', merchant: 'Blue Bottle', category: 'meals',
          amount: 12.00, currency: 'USD', attendees: 1, description: 'Coffee with the client',
        }, { source: 'agent' });
        await new Promise(r => setTimeout(r, 400));
        const state = t.state();
        if (state !== 'S3') return { ok: false, why: 'draft is not clean; state ' + state };

        // FIRED, NOT AWAITED — see above.
        const pending = t.executeTool('submit_expense_report', {}, { source: 'agent' });
        pending.catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        const token = document.querySelector('[data-confirm-token]')?.value ?? '';
        return {
          ok: Boolean(document.querySelector('[data-worst-case]')),
          state,
          realToken: /^ct_[0-9a-f]{32}$/.test(token),
          digest: document.querySelector('[data-snapshot-digest]')?.getAttribute('data-snapshot-digest') ?? null,
        };
      })()`);

      // Reported, not silently tolerated: a state that half-entered would
      // otherwise produce a confident resolution of the wrong page.
      // THE POSITIVE IS PRINTED TOO, NOT ONLY THE FAILURE. A state that only
      // speaks up when it breaks leaves the green carrying no evidence — which
      // is exactly how this state's old `how` string went unchallenged. Every
      // run now says what the real pipeline produced.
      if (report?.ok && report.realToken) {
        log(`  sign-open: real pipeline OK — agent submit -> F7 provider -> S5 openForDialog; ` +
          `server digest ${String(report.digest).slice(0, 20)}…, confirm_token is a real ct_ token`);
      }

      if (!report?.ok) {
        warn(`  sign-open: the real signature pipeline did not mount a dialog (${report?.why ?? "unknown"}) — ` +
          "SB-10 and SB-11 will not resolve, and that is the honest result rather than a fabricated frame");
      } else if (!report.realToken) {
        warn("  sign-open: the dialog mounted but its confirm_token is not a real server-issued ct_ token — " +
          "this is the configuration a real click cannot complete from (the F7 defect), so the frame is not filmable");
      }
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


/**
 * The self-tests that need no browser, RUN BEFORE THE DOCUMENT IS CHECKED.
 *
 * They used to sit after the parse gate, which meant that the moment the
 * storyboard failed to parse the tool's own proof of correctness became
 * unreachable — the instrument could only demonstrate it worked while its
 * subject was already valid, which is precisely backwards. An instrument's
 * self-test is about the INSTRUMENT and must not be gated on the subject.
 */
function pureSelfTests(markdown, header) {
  log("");
  log("SELF-TEST (the parse guard: a storyboard with no shots must be LOUD)");
  const emptyParsed = parseStoryboard("# not a storyboard\n\nno table here.\n");
  const empty = checkParse(emptyParsed.shots, null, emptyParsed.header);
  log(`  zero-shot parse produced ${empty.length} problem(s)`);
  if (!empty.length) { warn("  SELF-TEST FAILED: a zero-shot storyboard passed the parse guard."); return 1; }
  const short = checkParse(parseStoryboard(markdown).shots.slice(0, 2), 162, header);
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

  // THE DEFECT L2 FOUND, SELF-TESTED IN BOTH PLACEMENTS. The old positional
  // regex saw an APPENDED column as nothing at all and an INSERTED one as a
  // broken duration — opposite behaviour for the same edit depending only on
  // where it was made. A header-driven parser must see it either way, and this
  // is the assertion that proves it does.
  log("");
  log("SELF-TEST (D-94: a SURFACE column must be seen wherever it is placed)");
  const HEAD_APPENDED = "| SHOT | BEAT | DUR | ON SCREEN | SELECTOR | STILL | SURFACE |";
  const ROW_APPENDED  = "| `SB-01` | 1 | 10s | the agent is refused | `[data-x]` | yes | agent-client |";
  const HEAD_INSERTED = "| SHOT | BEAT | SURFACE | DUR | ON SCREEN | SELECTOR | STILL |";
  const ROW_INSERTED  = "| `SB-01` | 1 | agent-client | 10s | the agent is refused | `[data-x]` | yes |";
  for (const [where, md] of [["appended (7th)", `${HEAD_APPENDED}\n|---|\n${ROW_APPENDED}`],
                 ["inserted (3rd)", `${HEAD_INSERTED}\n|---|\n${ROW_INSERTED}`]]) {
    const got = parseStoryboard(md).shots[0];
    log(`  ${where.padEnd(15)} surface=${JSON.stringify(got?.surface)} dur=${got?.seconds}s selector=${JSON.stringify(got?.selector)}`);
    if (got?.surface !== "agent-client") {
      warn(`  SELF-TEST FAILED: a SURFACE column ${where} was not seen — this is the defect D-94 would have landed as decoration through.`);
      return 1;
    }
    if (got.seconds !== 10 || got.selector !== "[data-x]") {
      warn(`  SELF-TEST FAILED: adding a column ${where} corrupted another field.`);
      return 1;
    }
  }
  log("  ok — column position no longer changes what the tool reads.");

  log("");
  log("SELF-TEST (an unrecognised surface is refused, not defaulted to `page`)");
  const bogus = parseStoryboard(`${HEAD_APPENDED}\n|---|\n` +
    "| `SB-01` | 1 | 10s | something happens | `[data-x]` | yes | whiteboard |");
  const bogusProblems = checkParse(bogus.shots, null, bogus.header);
  if (!bogusProblems.some((p) => /whiteboard/.test(p))) {
    warn("  SELF-TEST FAILED: an unknown surface was accepted, and an unrecognised surface defaulted to `page` is how a miscategorised shot passes.");
    return 1;
  }
  log("  ok — an unknown surface is named and refused.");

  return 0;
}

async function run({ selfTest = false } = {}) {
  const markdown = readFileSync(STORYBOARD, "utf8");
  const { shots, header } = parseStoryboard(markdown);
  const total = declaredTotal(markdown);

  log(`check-storyboard: ${shots.length} shot(s) parsed from docs/STORYBOARD.md, ` +
    `durations ${shots.reduce((n, s) => n + (s.seconds || 0), 0)}s, declared ${total ?? "(none)"}s, ` +
    `columns [${header ? header.names.filter(Boolean).join(", ") : "(no header)"}]`);

  if (selfTest) {
    const rc = pureSelfTests(markdown, header);
    if (rc !== 0) return rc;
  }

  const parseProblems = checkParse(shots, total, header);
  if (parseProblems.length) {
    for (const p of parseProblems) warn(`  PARSE  ${p}`);
    warn("\nFAIL: the storyboard did not parse into a checkable shot list.");
    return 1;
  }

  const live = shots.filter((s) => !s.cut);

  // THE BRANCH. A shot filmed on the agent's client window or in a terminal is
  // not resolvable as a CSS selector against our page, and pretending otherwise
  // is what put page selectors on three off-page shots in the first place.
  const pageShots = live.filter((s) => s.surface === PAGE_SURFACE);
  const offPageShots = live.filter((s) => s.surface !== PAGE_SURFACE);

  const shapeProblems = [];
  for (const s of pageShots) {
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
      // The parser, R1/R3 and D-94 self-tests are NOT here: they need no
      // browser, so they run in pureSelfTests() before the parse gate. Keeping
      // them here would have made them unreachable the moment the storyboard
      // failed to parse — an instrument that can only prove itself while its
      // subject is already valid.
    }
  } finally {
    await page.close();
    await app.close();
  }

  log("");
  log("SHOT   SURFACE        SELECTOR                            HITS  STATE");
  const failures = [];
  for (const s of live) {
    const r = results.get(s.id);
    const onPage = s.surface === PAGE_SURFACE;
    log(`${s.id}  ${String(s.surface ?? "(none)").padEnd(13)}  ${s.selector.padEnd(34).slice(0, 34)}  ${String(r.hits).padStart(4)}  ${r.state ?? "-"}`);

    if (onPage) {
      const status = r.hits > 0 && !r.structural && !r.error;
      if (r.error) failures.push(`${s.id}: "${s.selector}" is not a valid CSS selector`);
      else if (r.structural) failures.push(`${s.id}: R3 — matches <html> or <body>; anchored to the document is anchored to nothing`);
      else if (!status) failures.push(`${s.id}: "${s.selector}" matched no element in any of ${STATES.map((x) => x.id).join(", ")}`);
    } else {
      // OFF-PAGE SHOTS ARE NOT SKIPPED, THEY ARE ASSERTED IN THE OPPOSITE
      // DIRECTION. A silently skipped shot is the exemption that hides the bug.
      // The trap this catches is real and was found in SB-07: a shot declared
      // agent-client while carrying `#agent-banner`, which IS our page and DOES
      // resolve — so it passed as a page shot and would have passed again with
      // the wrong surface recorded beside it.
      if (r.hits > 0) {
        failures.push(`${s.id}: declared surface "${s.surface}" but its selector "${s.selector}" ` +
          `resolves on OUR page (${r.hits} element(s) in ${r.state}). A shot filmed on ${s.surface} ` +
          "cannot be anchored to an element of the page it is not filmed on — that contradiction is " +
          "how a miscategorised shot reads as green.");
      }
      if (!s.onScreen || s.onScreen.length < 10) {
        failures.push(`${s.id}: an off-page shot must describe what is on screen, since no selector can be checked for it`);
      }
    }
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
