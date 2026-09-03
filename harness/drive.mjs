#!/usr/bin/env node
// H2 — the CDP driver. Enumerates tools, executes one, asserts on the result.
//
// Owner: I1. Declared outputs: harness/drive.mjs, evidence/H2-reachability.json.
// Accept: erp/graph.json -> nodes[id=H2].accept (verbatim in .team/contracts/H2.txt).
//
//   node harness/drive.mjs                       # reachability gate -> evidence/H2-reachability.json
//   node harness/drive.mjs --url <origin> --list  # one tool name per line on stdout, exit 0
//   node harness/drive.mjs --url <origin> --exec <name>   # invoke by name over CDP, exit 0
//   node harness/drive.mjs --smoke-login chen,ruiz        # a real login per persona, exit 0
//   node harness/drive.mjs --assert-flips 2,6,13,14       # the S0->S1->S3->S2 walk over CDP
//   node harness/drive.mjs --fallback --scenario happy    # the same walk, WebMCP disabled
//   node harness/drive.mjs --url "<origin>/?demo=1&seed=7" --dump-state  # H4: byte-stable state
//
// THREE MODES HERE EXIST BECAUSE A CONSUMER'S ACCEPT NAMED THEM AND NO NODE WAS TOLD TO BUILD
// THEM. --smoke-login is D-50 (F1.accept), --assert-flips is D-58 (T2.accept span 0),
// --fallback is D-61 (H3.accept). All three are specified in H2.notes, the PRODUCER, because
// harness/drive.mjs is H2's declared output and inventing a mode into the consumer's predicate
// is how the defect was created in the first place. `node tools/ready.mjs --check-modes` is
// the instrument PM bought after the third instance; it is what makes the class visible.
// See the block above modeSmokeLogin, and the one above modeFlipWalk, for what each does.
//
// Exit codes. 0 success. 2 THE TOOL WAS NOT FOUND — and only that; the browser's own
// -32602 is what produces it, never a name check of ours (see resolveToolName). 1 is
// everything else: a failed gate, a bad argument, a browser that would not start.
//
// ---------------------------------------------------------------------------------
// FOUR TRAPS, CARRIED OVER FROM V0 ON PURPOSE. One evidence format, one set of traps,
// two nodes — evidence/H2-reachability.json has the same shape as evidence/V0.json.
//
//  1. NO FLAG = NO SURFACE. MEASURED 2026-08-28 on Chrome 152.0.7977.64 with a clean
//     dedicated --user-data-dir per launch: with no --enable-features, document.modelContext
//     is `undefined`, headed AND under --headless=new (erp/FACTS.md IR-16(b), which
//     RETRACTED the older claim that --headless=new turns it on by itself). A driver that
//     omits the flag measures the flag, not the page API. So the graded arm carries the
//     flag and a second no-flag arm runs as a RECORDED negative control that MUST FAIL
//     this gate — that is accept clause (i), and it is what makes the positive arm a fact
//     about Chrome 152 rather than a fact about our command line.
//     The launcher is tools/chrome.mjs (H1), imported not reimplemented: `cdp` emits the
//     spelling that labels a CDP run, `none` is the control, and every launch gets a label.
//
//  2. getTools() RETURNS A PROMISE (IR-18). An un-awaited `.length` is `undefined`, so the
//     old `getTools().length === 1` compared undefined to 1 and could never hold on any
//     browser; and `!== 0` must NOT be substituted for it, because `!== 0` passes against
//     an empty surface. Every count below is `(await document.modelContext.getTools()).length`
//     under Runtime.evaluate awaitPromise:true. The un-awaited form is recorded beside it so
//     the trap stays visible in the artifact rather than only in this comment.
//
//  3. cdpDomainEnabled IS RECORDED AND NEVER ASSERTED ON. MEASURED: `WebMCP.enable` returns
//     OK in a launch with NO flag, NO tools and NO page API at all. It reads 'on' when the
//     feature is off. Nothing in this file branches on it, and the negative-control arm
//     records it too — that is the artifact carrying its own proof that the field is vacuous.
//     Do not feature-detect the domain with Schema.getDomains either; it does not list WebMCP.
//
//  4. THE ROUND TRIP IS THE ONLY DISCRIMINATOR. A real WebMCP.invokeTool whose MATCHING
//     WebMCP.toolResponded carries status:'Completed' (IR-17). A reachability file without a
//     completed round trip records an opinion, not a measurement.
//
// AND THE CALLING CONVENTION, which every revision of this driver's brief before 2026-08-29
// got wrong: EXECUTION GOES OVER THE CDP `WebMCP` DOMAIN. Runtime.evaluate keeps its two
// jobs — feature detection and reading page state — but it is NOT the executor.
// `document.modelContext.executeTool(name, args)` THROWS
// `TypeError: ... not of type 'RegisteredTool'`: from page JS it takes the descriptor handle
// out of getTools() and a JSON STRING of arguments. There is no by-name call from page JS.
// This file therefore invokes by name over CDP and never through Runtime.evaluate.
//
// chromeMajor comes from `<binary> --version`, never a user-agent string: a UA can be frozen,
// spoofed or reduced. `headless` is RECORDED AND NOT CONSTRAINED — MEASURED, --headless=new
// plus the flag behaves exactly as headed does, which is also what makes E6 (evals in CI,
// where there is no display) feasible at all.
//
// No agent is connected in any run this file makes. These are renderer-side readings only.

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// H1 is an INPUT to this node, so the launcher is imported rather than re-derived. Every
// launch below is therefore a labelled scenario: `cdp` carries --enable-features=WebMCP,
// `none` deliberately carries no feature flag at all and is the negative control.
const { flagsFor, launchLabel } = await import(resolve(REPO, 'tools', 'chrome.mjs'));

const OUT = join(REPO, 'evidence', 'H2-reachability.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The one-tool fixture the gate counts. Accept clauses (iii) and (v) are stated over "a page
// registering exactly 1 tool", and V5's probe origin registers five — so the gate needs its
// own page. It is a string here rather than a file because harness/drive.mjs and
// evidence/H2-reachability.json are this node's only declared outputs, and a seat writes only
// what it declared. Served from 127.0.0.1, which IS a secure context (unlike 192.168.x.x or
// .local, which yield a silent undefined). Registration is top-level document only; nothing
// in an iframe is ever discovered.
const FIXTURE_TOOL = 'h2_ping';
const FIXTURE_HTML = `<!doctype html>
<meta charset="utf-8"><title>H2 reachability fixture</title>
<body><h1>H2 reachability fixture</h1><pre id="s">boot</pre>
<script>
var s = document.getElementById('s');
if (typeof document.modelContext !== 'object') {
  s.textContent = 'NO PAGE API — this launch carried no --enable-features flag';
} else {
  document.modelContext.registerTool({
    name: ${JSON.stringify(FIXTURE_TOOL)},
    description: "Return a fixed string. The single tool the H2 reachability gate counts.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: async function () {
      return { content: [{ type: "text", text: "h2_ping ok" }] };
    }
  });
  s.textContent = 'registered ' + ${JSON.stringify(FIXTURE_TOOL)};
}
</script>`;

function chromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('no Chrome binary found; set CHROME_PATH');
}

// FROM THE BINARY, NEVER FROM A USER-AGENT STRING.
function binaryVersion(bin) {
  const raw = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim();
  const m = raw.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`cannot parse version from ${JSON.stringify(raw)}`);
  return { raw, major: Number(m[1]) };
}

function readV5Origin() {
  const f = join(REPO, 'evidence', 'V5-origin.txt');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return null;
}

// ---------------------------------------------------------------------------- CDP client
// JSON-RPC over one socket. Node 22 ships a stable global WebSocket, so this needs no
// dependency — package.json is L0's output and not this node's to grow.
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve: res, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        // A CDP error is carried on the rejection as `.cdp`, because the unknown-tool path
        // needs the raw {code:-32602, message:'Tool not found'} and not a flattened string.
        msg.error ? reject(Object.assign(new Error(msg.error.message), { cdp: msg.error })) : res(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = ++this.id;
    const frame = { id, method, params };
    if (sessionId) frame.sessionId = sessionId;
    this.ws.send(JSON.stringify(frame));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
    });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  close() { try { this.ws.close(); } catch {} }
}

// -------------------------------------------------------------------------------- launch
// scenario is 'cdp' (the flag) or 'none' (the negative control). tools/chrome.mjs owns which
// spelling each one emits; this file never writes --enable-features itself.
//
// `extraFlags` exists for ONE caller and is documented here rather than discovered in a diff.
// H3.accept requires a launch carrying `--disable-features=WebMCP`, and tools/chrome.mjs
// (H1, an INPUT to this node) has exactly three scenarios — cdp, manual, none — none of which
// emits a DISABLE. `none` emits no feature flag at all, which by IR-16(b) already leaves
// `document.modelContext` undefined, so `none` plus an explicit disable is belt AND braces:
// the feature is both un-enabled and positively turned off. Growing a fourth scenario in
// chrome.mjs would edit H1's artifact, and H1's own acceptance test asserts on which flag each
// scenario prints — so the extra flag is appended HERE, by the one caller that needs it, and
// it is printed on the launch line so no run is ever graded without its label.
async function launch(scenario, { headless, extraFlags = [] }) {
  const bin = chromeBinary();
  const dir = mkdtempSync(join(tmpdir(), `h2-${scenario}-`));
  const flags = flagsFor(scenario, { port: 0, userDataDir: dir, headless, url: 'about:blank' });
  // The url is last and must stay last; anything else goes in front of it.
  if (extraFlags.length) flags.splice(flags.length - 1, 0, ...extraFlags);
  process.stderr.write(launchLabel(scenario, flags) +
    (extraFlags.length ? ` extra=${extraFlags.join(' ')}` : '') + '\n');

  const child = spawn(bin, flags, { stdio: ['ignore', 'ignore', 'ignore'] });
  const portFile = join(dir, 'DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 300; i++) {
    if (existsSync(portFile)) {
      const [port, path] = readFileSync(portFile, 'utf8').split('\n');
      if (port && path) { wsUrl = `ws://127.0.0.1:${port.trim()}${path.trim()}`; break; }
    }
    await sleep(50);
  }
  if (!wsUrl) { child.kill('SIGKILL'); throw new Error('Chrome never wrote DevToolsActivePort'); }
  const cdp = await CDP.connect(wsUrl);
  return {
    cdp, flags, bin,
    flag: flags.find((f) => f.startsWith('--enable-features=')) ?? null,
    disableFlag: flags.find((f) => f.startsWith('--disable-features=')) ?? null,
    headless: flags.includes('--headless=new'),
    async close() {
      cdp.close();
      child.kill('SIGKILL');
      await sleep(150);
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

// Open a page and start collecting WebMCP events BEFORE navigating. Ordering is load-bearing:
// toolsAdded fires when the page registers, so a driver that enables the domain after load
// can miss the event entirely and then wrongly report an empty surface.
async function openPage(browser, url, { navTimeoutMs = 90000 } = {}) {
  const { cdp } = browser;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const surface = { toolsAddedEvents: [], toolsRemovedEvents: [], names: new Set(), frameIds: new Set() };
  cdp.on((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'WebMCP.toolsAdded') {
      surface.toolsAddedEvents.push(m.params);
      // MEASURED 2026-08-29: ONE event carries a `tools` ARRAY, and frameId sits on each tool
      // object, not on the envelope. Enumerate the surface from toolsAdded/toolsRemoved.
      for (const t of m.params.tools ?? []) {
        surface.names.add(t.name);
        if (t.frameId) surface.frameIds.add(t.frameId);
      }
    } else if (m.method === 'WebMCP.toolsRemoved') {
      surface.toolsRemovedEvents.push(m.params);
      for (const t of m.params.tools ?? []) surface.names.delete(t.name ?? t);
    }
  });

  // Trap 3: recorded, never asserted on. Nothing below branches on this value.
  let cdpDomainEnabled = false;
  try { await cdp.send('WebMCP.enable', {}, sessionId); cdpDomainEnabled = true; } catch { cdpDomainEnabled = false; }

  const loaded = new Promise((res) => {
    const off = cdp.on((m) => {
      if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) { off(); res(); }
    });
    // Render's free tier sleeps after 15 idle minutes; a cold start is tens of seconds.
    // Proceed on timeout and let the probes below speak rather than failing here.
    setTimeout(res, navTimeoutMs);
  });
  await cdp.send('Page.navigate', { url }, sessionId, navTimeoutMs);
  await loaded;

  const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId);
  return { sessionId, surface, cdpDomainEnabled, frameId: frameTree.frame.id };
}

// Runtime.evaluate keeps exactly two jobs: feature detection and reading page state.
async function evalInPage(cdp, sessionId, expression, awaitPromise = false) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) {
    return { ok: false, error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  }
  return { ok: true, value: r.result.value };
}

// Trap 2. THE AWAIT IS LOAD-BEARING. Polls, because registration is asynchronous and a page
// that has not registered yet is indistinguishable from one that never will — for a moment.
async function awaitedToolCount(cdp, sessionId, { deadlineMs = 20000 } = {}) {
  const deadline = Date.now() + deadlineMs;
  let count = 0;
  for (;;) {
    const r = await evalInPage(cdp, sessionId,
      '(async () => (await document.modelContext.getTools()).length)()', true);
    if (r.ok && Number.isInteger(r.value)) count = r.value;
    if (count > 0 || Date.now() > deadline) break;
    await sleep(250);
  }
  return count;
}

// Trap 4. invokeTool returns {invocationId} AND NOTHING ELSE; the answer arrives later on
// WebMCP.toolResponded, correlated by that id. status is Completed | Error | Canceled, and on
// Error the message is in exception.description — errorText is empty.
//
// A rejected send is a DIFFERENT path from a failed response: an unknown tool name is answered
// -32602 'Tool not found' by the browser at send time and never produces a toolResponded at
// all. Both are returned here, distinguished, because --exec turns exactly one of them into
// exit 2.
async function invokeTool(cdp, sessionId, frameId, toolName, input = {}, { timeoutMs = 30000 } = {}) {
  const responded = new Promise((res) => {
    const off = cdp.on((m) => {
      if (m.method === 'WebMCP.toolResponded' && m.sessionId === sessionId) { off(); res(m.params); }
    });
    setTimeout(() => { off(); res(null); }, timeoutMs);
  });

  let invocationId = null;
  try {
    // `input` MUST be an object over CDP. This is by NAME and over the WebMCP domain —
    // never document.modelContext.executeTool(name, args), which throws TypeError.
    ({ invocationId } = await cdp.send('WebMCP.invokeTool', { frameId, toolName, input }, sessionId, timeoutMs));
  } catch (e) {
    return { sendRejected: true, toolName, error: e.message, cdp: e.cdp ?? null, roundTrip: false };
  }

  const ev = await responded;
  if (!ev) {
    // The tool never answered. Release the CALLER so the rig cannot hang.
    // MEASURED: cancelInvocation frees this side only — the page's execute keeps running,
    // opts carries no AbortSignal, and the page never learns. Nothing here claims otherwise.
    try { await cdp.send('WebMCP.cancelInvocation', { invocationId }, sessionId, 5000); } catch {}
    return {
      sendRejected: false, toolName, invocationId, matched: false, status: null, output: null,
      note: 'no toolResponded within the timeout; the caller was released with WebMCP.cancelInvocation, ' +
            'which frees this side only — the page\'s execute keeps running and never learns.',
      roundTrip: false,
    };
  }
  return {
    sendRejected: false,
    toolName,
    invocationId,
    matched: ev.invocationId === invocationId,
    status: ev.status,
    output: ev.output !== undefined ? ev.output : null,
    exception: ev.exception ?? null,
    roundTrip: ev.invocationId === invocationId && ev.status === 'Completed',
  };
}

// V5's probe registers `probe_whoami`; the accept spells the same tool `--exec whoami`. So a
// short name is resolved against the LIVE enumerated surface, and the resolution is announced
// on stderr so nothing is silently substituted.
//
// A name that resolves to nothing is NOT rejected here. It is passed to the browser unchanged,
// so that the -32602 'Tool not found' which becomes exit 2 is the browser's answer and not our
// own guess. (Note it could not be our guess anyway: MEASURED, a revoked tool and a
// never-registered tool are indistinguishable — invokeTool answers -32602 for both.)
function resolveToolName(requested, names) {
  if (names.includes(requested)) return { name: requested, how: 'exact' };
  const suffix = names.filter((n) => n === `probe_${requested}` || n.endsWith(`_${requested}`));
  if (suffix.length === 1) return { name: suffix[0], how: `short name for ${suffix[0]}` };
  return { name: requested, how: 'unresolved — sent to the browser unchanged so its own -32602 decides' };
}

// ------------------------------------------------------------------------------ modes

async function modeList(url, { headless }) {
  const b = await launch('cdp', { headless });
  try {
    const { sessionId, surface } = await openPage(b, url);
    const count = await awaitedToolCount(b.cdp, sessionId);
    const names = [...surface.names];
    // Cross-check the two channels. The page-JS count and the CDP enumeration should agree;
    // if they do not, say so on stderr rather than silently trusting one of them.
    if (names.length !== count) {
      process.stderr.write(
        `drive: WARNING toolsAdded named ${names.length} tool(s) but (await getTools()).length is ${count}\n`);
    }
    process.stderr.write(`drive: ${url} — ${names.length} tool(s) from WebMCP.toolsAdded, ` +
      `(await getTools()).length = ${count}\n`);
    // STDOUT IS THE MACHINE SURFACE: one tool name per line and nothing else. Plain strings via
    // process.stdout.write, never console.log of an inspected value — every resident seat
    // exports FORCE_COLOR=3 (kb/pits/L0.md), which makes util.inspect emit SGR codes even into
    // a pipe, and NO_COLOR=1 does not suppress it.
    for (const n of names) process.stdout.write(n + '\n');
    return 0;
  } finally {
    await b.close();
  }
}

async function modeExec(url, requested, input, { headless }) {
  const b = await launch('cdp', { headless });
  try {
    const { sessionId, surface, frameId } = await openPage(b, url);
    await awaitedToolCount(b.cdp, sessionId);
    const names = [...surface.names];
    const { name, how } = resolveToolName(requested, names);
    process.stderr.write(`drive: --exec ${requested} -> ${name} (${how}); frameId ${frameId}\n`);

    const r = await invokeTool(b.cdp, sessionId, frameId, name, input);

    if (r.sendRejected) {
      // -32602 'Tool not found' — the browser's own answer, converted here into exit 2.
      // NOTHING goes to stdout on this path.
      const code = r.cdp?.code ?? null;
      process.stderr.write(`drive: tool not found: ${requested}` +
        (name !== requested ? ` (resolved to ${name})` : '') +
        ` — WebMCP.invokeTool answered ${code ?? '?'} ${JSON.stringify(r.error)}\n`);
      if (names.length) process.stderr.write(`drive: available: ${names.join(', ')}\n`);
      return code === -32602 ? 2 : 1;
    }
    if (!r.roundTrip) {
      process.stderr.write(`drive: no completed round trip for ${name}: ` +
        `status=${r.status} matched=${r.matched}` +
        (r.note ? ` — ${r.note}` : '') +
        (r.exception?.description ? ` — ${r.exception.description}` : '') + '\n');
      return 1;
    }
    // A CONTENT BLOCK on stdout, as JSON, and nothing else.
    process.stdout.write(JSON.stringify(r.output?.content ?? r.output, null, 2) + '\n');
    process.stderr.write(`drive: ${name} -> toolResponded status ${r.status} (invocationId ${r.invocationId})\n`);
    return 0;
  } finally {
    await b.close();
  }
}

// ------------------------------------------------------------------ --smoke-login (D-50)
//
// F1.accept has always run `node harness/drive.mjs --smoke-login chen,ruiz` and NO node was
// ever told to build it: the mode was specified in the CONSUMER and never in the producer,
// which is precisely the defect D-50 names. It is specified in H2.notes now, and built here.
//
// WHAT "A REAL LOGIN" MEANS, and why this drives a browser for something a two-line curl
// could fake: the session cookie is HttpOnly (server/index.mjs, S1's contract), so no
// harness-side HTTP client can prove the thing that matters. A real browser mints the cookie
// into a real cookie jar and the page's OWN same-origin fetch is what carries it back. Each
// persona gets a FRESH browser — launch() mkdtemps a new --user-data-dir per call, hence a
// fresh cookie jar — and each is proved in three beats:
//
//   1. ANONYMOUS FIRST. GET /api/me from the page returns 401. Without this beat, a 200 in
//      beat 3 could be a session left over from the previous persona and the mode would pass
//      while proving nothing. That is the `!== 0`-passes-against-an-empty-surface trap
//      (trap 2 above) wearing different clothes.
//   2. LOG IN, by the page's own affordance where one exists — two paths, below.
//   3. GET /api/me from the page returns 200 AND names the persona that was asked for.
//
// TWO PATHS, AND THE MODE ALWAYS SAYS WHICH ONE IT TOOK — kb/pits/L0.md: a green run and a
// degraded run must never be confusable for each other.
//
//   dom   — `[data-persona="<p>"]` exists, so it is CLICKED and the shell's own handler does
//           the login. This is the path that actually smoke-tests F1's shell.
//   fetch — no such element, so the login goes through a same-origin credentialed POST to
//           /api/login from the page context. Still a real browser and a real cookie jar,
//           but it proves the SERVER and not the shell.
//
// The fallback is not a hedge, because F1's accept pairs this mode with its own assertion
// that `[data-persona]` has length 2: when F1 is green those elements exist, so `dom` is the
// path taken. `fetch` is what lets this mode be built and verified before UX's shell exists.
// And `dom` is never silently downgraded — if the element is there and the click does not
// produce a session, that is a FAILURE, not a reason to quietly try the fetch instead.
//
// The persona name is NOT validated against a list here, deliberately, and for the same
// reason resolveToolName lets the browser produce its own -32602: the server owns the enum
// (chen, ruiz — frozen in erp/contracts/eval-case.schema.json) and answers E_BAD_PERSONA for
// anything else. A second copy of that enum in this file is a second place to get it wrong.

// Every request this mode makes goes through the PAGE, never through Node, because the
// browser's cookie jar is the thing under test.
async function pageJson(cdp, sessionId, expression) {
  const r = await evalInPage(cdp, sessionId, expression, true);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

const ME_EXPR = `(async () => {
  const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body: body };
})()`;

const loginExpr = (persona) => `(async () => {
  const r = await fetch('/api/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona: ${JSON.stringify(persona)} })
  });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body: body };
})()`;

// A TRUSTED click, dispatched through the Input domain at the element's centre, because that
// is what a judge's mouse produces; el.click() synthesises an event with isTrusted false.
// A zero-area element has no coordinate to click, so that case falls back to el.click() and
// says so rather than dispatching into empty space and reporting a mysterious timeout.
async function clickPersona(cdp, sessionId, persona) {
  const sel = `[data-persona=${JSON.stringify(persona)}]`;
  const box = await pageJson(cdp, sessionId, `(async () => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    const b = el.getBoundingClientRect();
    return { found: true, x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height };
  })()`);
  if (!box.found) return { found: false };
  if (box.w < 1 || box.h < 1) {
    await pageJson(cdp, sessionId,
      `(async () => { document.querySelector(${JSON.stringify(sel)}).click(); return true; })()`);
    return { found: true, how: 'el.click(), untrusted — the element has zero area' };
  }
  const at = { x: Math.round(box.x), y: Math.round(box.y), button: 'left', clickCount: 1 };
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...at }, sessionId);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...at }, sessionId);
  return { found: true, how: 'trusted Input.dispatchMouseEvent' };
}

// The shell's click handler is asynchronous, so beat 3 polls rather than reading once.
async function waitForSession(cdp, sessionId, { timeoutMs = 10000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = await pageJson(cdp, sessionId, ME_EXPR);
    if (last.status === 200) return last;
    if (Date.now() >= deadline) return last;
    await sleep(200);
  }
}

async function smokeOne(origin, persona, { headless }) {
  const b = await launch('cdp', { headless });
  try {
    const { sessionId } = await openPage(b, origin);

    // Beat 1 — this browser starts anonymous.
    const before = await pageJson(b.cdp, sessionId, ME_EXPR);
    if (before.status !== 401) {
      return { persona, ok: false, why: `GET /api/me BEFORE login returned ${before.status}, expected 401 — ` +
        `this browser did not start anonymous, so a 200 after login would prove nothing` };
    }

    // Beat 2 — log in, by the page's own affordance where there is one.
    const click = await clickPersona(b.cdp, sessionId, persona);
    let path;
    if (click.found) {
      path = 'dom';
      process.stderr.write(`drive: --smoke-login ${persona}: clicked [data-persona="${persona}"] via ${click.how}\n`);
    } else {
      path = 'fetch';
      process.stderr.write(`drive: --smoke-login ${persona}: NO [data-persona="${persona}"] ELEMENT on the page — ` +
        `falling back to a same-origin POST /api/login from the page context. ` +
        `That proves the SERVER, not F1's shell.\n`);
      const login = await pageJson(b.cdp, sessionId, loginExpr(persona));
      if (login.status !== 200) {
        return { persona, ok: false, path,
          why: `POST /api/login returned ${login.status} ${JSON.stringify(login.body)}` };
      }
    }

    // Beat 3 — a session exists and it names the persona that was asked for.
    const after = await waitForSession(b.cdp, sessionId);
    if (after?.status !== 200) {
      return { persona, ok: false, path, why: path === 'dom'
        ? `clicked [data-persona="${persona}"] but GET /api/me still returns ${after?.status} — ` +
          `the element exists and is not wired to a login`
        : `GET /api/me after login returned ${after?.status} ${JSON.stringify(after?.body)}` };
    }
    if (after.body?.persona !== persona) {
      return { persona, ok: false, path,
        why: `the session names persona ${JSON.stringify(after.body?.persona)}, asked for ${JSON.stringify(persona)}` };
    }
    return { persona, ok: true, path, role: after.body?.role };
  } finally {
    await b.close();
  }
}

// F1's accept runs this mode with NO --url, so it brings its own server up on 127.0.0.1 —
// a secure context, unlike 192.168.x.x and .local, which yield a silent undefined. --url
// drives an already-running instance instead. server/index.mjs is IMPORTED, never copied:
// a second definition of the session route is a second thing to drift.
async function serveApp() {
  const { createHttpServer } = await import(resolve(REPO, 'server', 'index.mjs'));
  const server = createHttpServer();
  await new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', res);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

// The page has to actually be SERVED. GET / is S1's static route (owner I3); while that is in
// flight the server answers /api/* and falls through to its JSON 404, and this mode says so
// plainly rather than failing three beats deeper with a stranger message.
async function checkRootServesPage(origin) {
  let res;
  try {
    res = await fetch(origin + '/', { redirect: 'follow' });
  } catch (err) {
    return { ok: false, why: `cannot reach ${origin}/ — ${err.message}` };
  }
  const type = res.headers.get('content-type') ?? '';
  if (res.status === 200 && /text\/html/i.test(type)) return { ok: true };
  return { ok: false, why:
    `GET ${origin}/ returned ${res.status} ${type || '(no content-type)'}, expected 200 text/html. ` +
    `The static route that serves src/page/index.html belongs to S1 (owner I3) and is in flight; ` +
    `until it lands the server answers /api/* only and everything else falls through to E_NOT_FOUND. ` +
    `That is an ordering fact, not a defect in --smoke-login.` };
}

async function modeSmokeLogin(spec, { url, headless }) {
  const personas = String(spec ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!personas.length) {
    process.stderr.write('drive: --smoke-login needs at least one persona, e.g. --smoke-login chen,ruiz\n');
    return 1;
  }

  const own = url ? null : await serveApp();
  const origin = url ?? own.origin;
  try {
    process.stderr.write(`drive: --smoke-login ${personas.join(',')} against ${origin}` +
      (own ? ' (server started by this process)' : ' (--url, server not ours)') + '\n');

    const root = await checkRootServesPage(origin);
    if (!root.ok) { process.stderr.write(`drive: ${root.why}\n`); return 1; }

    const results = [];
    for (const p of personas) {
      let r;
      try { r = await smokeOne(origin, p, { headless }); }
      catch (err) { r = { persona: p, ok: false, why: err.message }; }
      results.push(r);
      if (r.ok) {
        // STDOUT IS THE MACHINE SURFACE: one line per persona, plain strings via
        // process.stdout.write and never console.log of an inspected value — every resident
        // seat exports FORCE_COLOR=3 (kb/pits/L0.md), which makes util.inspect emit SGR codes
        // even into a pipe, and NO_COLOR=1 does not suppress it.
        process.stdout.write(`${r.persona} ok via ${r.path}\n`);
        process.stderr.write(`drive: --smoke-login ${r.persona} PASSED — role ${JSON.stringify(r.role)}, ` +
          `session minted and carried back by the browser (${r.path})\n`);
      } else {
        process.stderr.write(`drive: --smoke-login ${r.persona} FAILED — ${r.why}\n`);
      }
    }
    const failed = results.filter((r) => !r.ok);
    process.stderr.write(`drive: --smoke-login ${results.length - failed.length}/${results.length} persona(s) passed\n`);
    return failed.length ? 1 : 0;
  } finally {
    if (own) await own.close();
  }
}

// One arm of the gate: launch under `scenario`, load `url`, read everything, write nothing.
async function gateArm(scenario, url, { headless, invoke }) {
  const b = await launch(scenario, { headless });
  const arm = { scenario, flag: b.flag, headless: b.headless, url };
  try {
    const { sessionId, surface, cdpDomainEnabled, frameId } = await openPage(b, url);
    arm.cdpDomainEnabled = cdpDomainEnabled; // trap 3: recorded, never asserted on
    arm.frameId = frameId;

    // (ii) THE PAGE API IS REACHABLE. Read off `typeof`, in the page — never off whether a
    // CDP domain enables, which is exactly how the retracted IR-16(b) claim got published.
    arm.documentPresent = (await evalInPage(b.cdp, sessionId,
      "typeof document.modelContext === 'object'")).value === true;
    arm.getToolsIsFunction = (await evalInPage(b.cdp, sessionId,
      "typeof document.modelContext.getTools === 'function'")).value === true;
    arm.executeToolIsFunction = (await evalInPage(b.cdp, sessionId,
      "typeof document.modelContext.executeTool === 'function'")).value === true;
    arm.pageApiReachable = arm.getToolsIsFunction && arm.executeToolIsFunction;
    arm.rawTypeof = (await evalInPage(b.cdp, sessionId,
      'JSON.stringify({document: typeof document.modelContext, ' +
      'getTools: typeof (document.modelContext||{}).getTools, ' +
      'executeTool: typeof (document.modelContext||{}).executeTool})')).value;

    // (iii) COUNT, AWAITED.
    arm.toolCount = 0;
    arm.unAwaitedGetToolsLength = null;
    if (arm.documentPresent) {
      arm.toolCount = await awaitedToolCount(b.cdp, sessionId);
      arm.unAwaitedGetToolsLength = (await evalInPage(b.cdp, sessionId,
        'String(document.modelContext.getTools().length)')).value;
    }

    // (v) exactly one toolsAdded event, naming the tool, carrying its frameId.
    arm.toolsAddedEventCount = surface.toolsAddedEvents.length;
    arm.toolsAddedNames = [...surface.names];
    arm.toolsAddedFrameIds = [...surface.frameIds];
    arm.toolsAddedRaw = surface.toolsAddedEvents;

    // (vi) ONE round trip.
    arm.invokeTool = null;
    arm.invokeToolRoundTrip = false;
    if (invoke && arm.toolCount > 0) {
      const r = await invokeTool(b.cdp, sessionId, frameId, invoke, {});
      arm.invokeTool = r;
      arm.invokeToolRoundTrip = r.roundTrip;
    }
    return arm;
  } finally {
    await b.close();
  }
}

async function modeGate({ headless }) {
  const bin = chromeBinary();
  const version = binaryVersion(bin);

  // The gate's own page. Accept clauses (iii) and (v) are stated over a page registering
  // EXACTLY ONE tool, and V5's origin registers five, so the gate serves its own fixture.
  const srv = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(FIXTURE_HTML);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const fixtureUrl = `http://127.0.0.1:${srv.address().port}/`;

  let graded, control, remote = null;
  try {
    // THE GRADED ARM. Flag on the launch, one tool, full round trip.
    graded = await gateArm('cdp', fixtureUrl, { headless, invoke: FIXTURE_TOOL });

    // THE NEGATIVE CONTROL — accept clause (i). Same binary, same page, `--scenario none`,
    // which emits no feature flag at all. This arm MUST FAIL the gate; its failure is what
    // makes the graded arm a fact about Chrome 152 and not about our command line. It also
    // records cdpDomainEnabled with the feature demonstrably off, which is trap 3 made visible.
    control = await gateArm('none', fixtureUrl, { headless, invoke: FIXTURE_TOOL });

    // A THIRD, UNGATED ARM against V5's REMOTE HTTPS origin. Recorded because a green
    // localhost run is not evidence on its own — an earlier pass agreed with the remote on
    // V0-V4 and hid V6-consent-gate entirely. It is NOT part of the pass condition: the gate's
    // clauses (iii) and (v) require exactly one tool and this origin registers five, and a
    // sleeping free-tier instance must not be able to fail a regression gate about Chrome.
    // The remote path is gated separately and properly, by the --list and --exec accept spans.
    const v5 = readV5Origin();
    if (v5) {
      try {
        remote = await gateArm('cdp', v5, { headless, invoke: 'probe_status' });
      } catch (e) {
        remote = { scenario: 'cdp', url: v5, error: e.message,
          note: 'recorded, not gated — see the note on this arm.' };
      }
    }
  } finally {
    srv.close();
  }

  const evidence = {
    node: 'H2',
    question: 'Is the WebMCP page API reachable over CDP on the installed Chrome, and does an invokeTool round trip complete?',
    verdict: graded.invokeToolRoundTrip ? 'reachable' : 'unreachable',

    // --- the seven fields H2.accept names, in its order ---
    chromeMajor: version.major,
    flag: graded.flag,
    headless: graded.headless,
    pageApiReachable: graded.pageApiReachable,
    toolCount: graded.toolCount,
    cdpDomainEnabled: graded.cdpDomainEnabled,
    invokeToolRoundTrip: graded.invokeToolRoundTrip,

    // --- the charter's eighth: the no-flag negative control's reading ---
    noFlagPageApiAbsent: control.documentPresent === false,

    method: 'cdp',
    chromeVersion: version.raw,
    chromeBinary: bin,
    origin: fixtureUrl,
    originNote: 'A one-tool fixture served by this script on 127.0.0.1 (a secure context). ' +
      'The gate is stated over "a page registering exactly 1 tool"; V5\'s probe origin registers five. ' +
      'The remote origin is exercised in remoteOrigin below and by the --list/--exec accept spans.',
    observedAt: new Date().toISOString(),
    rawTypeof: graded.rawTypeof,
    unAwaitedGetToolsLength: graded.unAwaitedGetToolsLength,

    launch: {
      note: 'THE LAUNCH IS RECORDED AS WELL AS THE RESULT. A driver that omits the flag measures ' +
        'the flag, not the page API. Flags come from tools/chrome.mjs (H1): scenario `cdp` emits ' +
        'the spelling that labels a CDP run, scenario `none` is the control.',
      gradedScenario: 'cdp',
      controlScenario: 'none',
      gradedFlags: graded.flag,
      controlFlags: control.flag,
    },

    toolsAdded: {
      note: 'Accept clause (v). MEASURED 2026-08-29: ONE WebMCP.toolsAdded event carries a `tools` ' +
        'ARRAY, and frameId sits on each tool object, not on the envelope. Note also that this ' +
        'channel spells the annotations `readOnly`/`untrustedContent` while the page JS that ' +
        'registered the tool wrote `readOnlyHint` — same tool, two channels, two spellings.',
      eventCount: graded.toolsAddedEventCount,
      names: graded.toolsAddedNames,
      frameIds: graded.toolsAddedFrameIds,
      pageFrameId: graded.frameId,
      raw: graded.toolsAddedRaw,
    },

    invokeTool: graded.invokeTool,

    negativeControl: {
      note: 'Same binary, same fixture page, launched with tools/chrome.mjs --scenario none, which ' +
        'emits NO --enable-features at all. documentPresent:false here is what makes ' +
        'pageApiReachable:true above a fact about Chrome ' + version.major + ' and not about our ' +
        'command line. THIS ARM MUST FAIL THE GATE — accept clause (i). cdpDomainEnabled is ' +
        'recorded on BOTH arms on purpose: it reads true with the feature off, no tools and no ' +
        'page API, which is precisely why nothing asserts on it.',
      scenario: control.scenario,
      flag: control.flag,
      headless: control.headless,
      documentPresent: control.documentPresent,
      pageApiReachable: control.pageApiReachable,
      toolCount: control.toolCount,
      cdpDomainEnabled: control.cdpDomainEnabled,
      toolsAddedEventCount: control.toolsAddedEventCount,
      invokeToolRoundTrip: control.invokeToolRoundTrip,
      invokeTool: control.invokeTool,
      rawTypeof: control.rawTypeof,
      failsGate: !(control.pageApiReachable && control.invokeToolRoundTrip),
    },

    remoteOrigin: remote && {
      note: 'RECORDED, NOT GATED. V5\'s remote HTTPS origin, which registers five tools, so it ' +
        'cannot satisfy clauses (iii) and (v). It is here because a green localhost run is not ' +
        'evidence on its own, and because a sleeping free-tier instance must not be able to fail ' +
        'a regression gate about Chrome. The remote path is gated by the --list/--exec accept spans.',
      url: remote.url,
      error: remote.error ?? null,
      pageApiReachable: remote.pageApiReachable ?? null,
      toolCount: remote.toolCount ?? null,
      toolsAddedNames: remote.toolsAddedNames ?? null,
      invokeToolRoundTrip: remote.invokeToolRoundTrip ?? null,
      invokeToolStatus: remote.invokeTool?.status ?? null,
    },

    notes: [
      'chromeMajor is parsed from `' + bin + ' --version`, never from a user-agent string.',
      'Every boolean above was produced by CDP Runtime.evaluate on a live page; the comparison is evaluated IN THE PAGE.',
      'toolCount is (await document.modelContext.getTools()).length under awaitPromise:true. The un-awaited form is recorded above as unAwaitedGetToolsLength to keep IR-18 visible: it reads "' + graded.unAwaitedGetToolsLength + '".',
      'cdpDomainEnabled is RECORDED AND NEVER ASSERTED ON: WebMCP.enable returns OK with no flag, no tools and no page API — see negativeControl, where it reads ' + control.cdpDomainEnabled + '.',
      'invokeToolRoundTrip is the only field that discriminates a live surface from an empty launch: WebMCP.invokeTool plus a MATCHING WebMCP.toolResponded carrying status "Completed" (FACTS §1 IR-17).',
      'Execution is by name over the CDP WebMCP domain. document.modelContext.executeTool(name, args) throws TypeError: not of type RegisteredTool — from page JS it takes the descriptor out of getTools() and a JSON STRING of arguments. Runtime.evaluate is used here only for feature detection and page state, never as the executor.',
      'headless is RECORDED AND NOT CONSTRAINED. This run was headless=' + graded.headless + '. MEASURED: --headless=new plus the flag behaves exactly as headed does, which is what makes E6 (evals in CI, where there is no display) feasible at all.',
      'No agent was connected. These are renderer-side readings only.',
    ],
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n');

  // ------------------------------------------------------------------ the gate itself
  // Six clauses. Five are asserted; (iv) is recorded and deliberately absent from this list.
  const checks = [
    ['(i)   flag is on the launch',
      graded.flag === '--enable-features=WebMCP' || graded.flag === '--enable-features=WebMCPTesting'],
    ['(i)   no-flag control recorded and FAILS the gate',
      evidence.negativeControl.failsGate === true && evidence.noFlagPageApiAbsent === true],
    ['(ii)  getTools and executeTool are both functions', graded.pageApiReachable === true],
    ['(iii) (await getTools()).length === 1', graded.toolCount === 1],
    ['(v)   exactly one toolsAdded event naming the tool with its frameId',
      graded.toolsAddedEventCount === 1 &&
      graded.toolsAddedNames.length === 1 &&
      graded.toolsAddedNames[0] === FIXTURE_TOOL &&
      graded.toolsAddedFrameIds.length === 1 &&
      graded.toolsAddedFrameIds[0] === graded.frameId],
    ['(vi)  invokeTool round trip, matching toolResponded status Completed',
      graded.invokeToolRoundTrip === true],
  ];

  const w = (s) => process.stderr.write(s + '\n');
  w(`H2  Chrome ${version.raw} (major ${version.major})  ${graded.flag}  headless=${graded.headless}`);
  w(`    fixture             ${fixtureUrl}  (1 tool: ${FIXTURE_TOOL})`);
  w(`    pageApiReachable    ${graded.pageApiReachable}   (typeof ${graded.rawTypeof})`);
  w(`    toolCount           ${graded.toolCount}   (un-awaited .length reads ${graded.unAwaitedGetToolsLength})`);
  w(`    cdpDomainEnabled    ${graded.cdpDomainEnabled}   RECORDED, NEVER ASSERTED ON — reads ${control.cdpDomainEnabled} with no flag and no page API`);
  w(`    toolsAdded          ${graded.toolsAddedEventCount} event(s), names [${graded.toolsAddedNames}], frameId match ${graded.toolsAddedFrameIds[0] === graded.frameId}`);
  w(`    invokeToolRoundTrip ${graded.invokeToolRoundTrip}   ${graded.invokeTool?.toolName} -> toolResponded status ${graded.invokeTool?.status}`);
  w(`    negative control    documentPresent=${control.documentPresent} pageApiReachable=${control.pageApiReachable} roundTrip=${control.invokeToolRoundTrip}  -> failsGate=${evidence.negativeControl.failsGate}`);
  if (remote) {
    w(`    remote (ungated)    ${remote.url} toolCount=${remote.toolCount ?? 'n/a'} roundTrip=${remote.invokeToolRoundTrip ?? 'n/a'}${remote.error ? ' error=' + remote.error : ''}`);
  }
  w('');
  let failed = 0;
  for (const [label, ok] of checks) {
    w(`    ${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failed++;
  }
  w(`    (iv)  WebMCP.enable returned OK: ${graded.cdpDomainEnabled} — RECORDED, NOT ASSERTED ON`);
  w('');
  w(`    VERDICT             ${evidence.verdict}`);
  w(`    wrote               ${OUT}`);

  if (failed) {
    w(`H2 GATE RED: ${failed} clause(s) failed. E1 is gated on this file; PM hears the same day, out of band.`);
    return 1;
  }
  return 0;
}

// ------------------------------------- --assert-flips (D-58) and --fallback (D-61)
//
// TWO MODES, ONE WALK, AND THAT IS THE POINT. T2.accept span 0 runs
// `node harness/drive.mjs --assert-flips 2,6,13,14`; H3.accept runs
// `node harness/drive.mjs --fallback --scenario happy` and says it "drives THE SAME TOOL
// SURFACE through the page's own getTools/executeTool, completes the 2->6->13->14 walk".
// The same walk, over two different execution channels, is therefore the literal reading of
// both predicates, and it is one implementation below with the channel injected.
//
// NEITHER MODE EXISTED AND NEITHER NODE WAS EVER TOLD TO BUILD ONE. `grep -c` returned 0 for
// both flag literals. Same defect as --smoke-login (D-50): the mode specified in the CONSUMER
// and never in the producer. All three are now specified in H2.notes and built here, because
// harness/drive.mjs is H2's DECLARED OUTPUT and a mode of it belongs to H2's producer.
//
// WHY --assert-flips IS NOT IN H3, because the reasoning outlives the assignment.
// erp/PROPOSAL-workflow-tools.md:285 assigns it to H3 at "0 h, text only". H3.inputs contains
// T2 — H3 RUNS AFTER T2 — so a mode T2's own accept invokes, built in H3, would make T2's
// span 0 UNSATISFIABLE FOREVER: a deadlock across the two head nodes of the remaining critical
// path, shipped as a scheduling note. A PROPOSAL IS NOT AN AUTHORITY.
//
// WHAT --assert-flips ASSERTS, and erp/graph.json is the only authority for it — read it
// verbatim from there, never from a brief. It "drives a real Chrome with
// --enable-features=WebMCP against the served application, calls getTools() after each state
// transition and asserts the counts in order, and asserts that submit_expense_report
// disappears from getTools() after a blocking violation is introduced through the real policy
// engine." Four clauses, four lines of code:
//
//   real Chrome, that flag  -> launch('cdp'), via tools/chrome.mjs. This file never writes
//                              --enable-features itself; H1 owns the spelling.
//   the served application  -> serveApp() imports server/index.mjs, exactly as --smoke-login
//                              does. Never a copy of the routes.
//   getTools()              -> counts AND names are read from PAGE JS,
//                              `(await document.modelContext.getTools())`, because that is the
//                              channel the predicate names. THE AWAIT IS LOAD-BEARING: it
//                              returns a Promise, so `.length` on the unawaited call is
//                              `undefined` (IR-18) and `!== 0` passes against an empty
//                              surface. Both traps are why this reads a settled ARRAY.
//   the real policy engine  -> the violating line's amount is DERIVED from src/policy.js's own
//                              LIMITS, never typed. A cap that moves must not silently stop
//                              producing a violation — that is how an assertion goes vacuous
//                              with nobody editing it.
//
// WHAT --fallback ASSERTS: the same walk with WebMCP switched OFF, driven through the page's
// own getTools/executeTool. The page-JS calling convention is the one every revision of this
// driver's brief before 2026-08-29 got wrong, so it is worth spelling out where it is used:
// `executeTool(DESCRIPTOR, JSON.stringify(args))` — the handle out of getTools() and a JSON
// STRING — returning a JSON STRING. `executeTool(name, args)` throws
// `TypeError: ... not of type 'RegisteredTool'`. There is no by-name call from page JS, which
// is exactly why --assert-flips goes over the CDP WebMCP domain and --fallback cannot.
//
// AND THE HONESTY CONDITION. H3's fallback agent drives the page itself, so at the tool
// boundary it is INDISTINGUISHABLE from a third-party one — which is why we cannot attest
// WHICH agent acted, why no claim that we can may be made anywhere (kb/webmcp/BANNED.txt
// RC-3), and why the surface it runs against must say "simulated agent". This mode reports
// which channel it drove, on every run, for the same reason: a green real-agent run and a
// green simulated run must never be confusable.
//
// WHAT THESE MODES DELIBERATELY DO **NOT** GATE ON. The frozen contract gives per-state
// membership, so the observed NAME SET is compared against MEMBERSHIP[state] and the
// comparison is printed — WITHOUT moving the exit code. T2's accept names counts and it names
// submit_expense_report's disappearance; those decide, and nothing else does. Tightening a
// consumer's predicate from inside the producer is the same act as writing a spec into a
// consumer, which is the defect D-50, D-58 and D-61 all exist to stop. The diagnostic is there
// so "13 tools, but the wrong 13" is VISIBLE; promoting it to a failure is PM's call.
//
// THE NUMERALS ARE CROSS-CHECKED, NOT HARD-CODED. 2,6,13,14 arrive on the command line and
// each is mapped back onto the state in the FROZEN contract whose membership has that size
// (S0=2, S1=6, S3=13, S2=14), by importing MEMBERSHIP from src/page/tools/compile.js — the
// same table tools/validate-contracts.mjs proves equal to
// erp/contracts/tool-surface.contract.md §1 in both directions. A numeral matching no state is
// announced. That is why this file holds no second copy of the counts.
//
// --selftest IS THE REAL-ZERO-VERSUS-UNEXAMINED-ZERO ARM, and T2's own accept blesses exactly
// this pattern for tools/check-toplevel.mjs one clause later. src/page/register.js (T2) and
// src/page/fallback-agent.js (H3) do not exist yet, so against the real application both modes
// currently fail at the first flip with no tool surface at all. That failure is CORRECT, and
// it proves NOTHING about the assertion engine. --selftest drives the identical walk, the
// identical assertions and the identical plumbing against a harness-owned fixture page that
// registers the REAL per-state membership and revokes with AbortController — the only
// de-registration path there is. It is a string in this file rather than a file on disk for
// the same reason FIXTURE_HTML is: a seat writes only what it declared.

// EXISTENCE IS NOT EXECUTION. A file on disk and a module the page evaluated are
// different facts, and today the repo produced two page modules that were green on
// the first and absent on the second. This asks the PAGE, in two independent ways:
// the module's own global (proof it evaluated) and whether the served document even
// references the file (proof of intent). A module can be referenced and still fail
// to evaluate, so "referenced but no global" is reported as its own outcome rather
// than folded into either neighbour.
const MODULE_GLOBALS = {
  'fallback-agent.js': 'outpocketFallbackAgent',
  'register.js': 'outpocketTools',
};

async function pageMountsModule(cdp, sessionId, origin, producerFile) {
  const base = producerFile.split('/').pop();
  const globalName = MODULE_GLOBALS[base] ?? null;
  if (globalName) {
    const r = await evalInPage(cdp, sessionId, `typeof globalThis[${JSON.stringify(globalName)}]`);
    if (r.ok && r.value !== 'undefined') {
      return { loaded: true, how: `globalThis.${globalName} is present in the page` };
    }
  }
  let html = '';
  try { html = await (await fetch(origin)).text(); } catch { /* reported as unmounted below */ }

  // A SCRIPT TAG, not a substring. index.html carries a comment table naming
  // every page module and its owning node, so `html.includes('fallback-agent.js')`
  // is true on a page that never loads it — a grep hit reported as a mount. The
  // first version of this check did exactly that and printed a message that
  // contradicted its own next sentence.
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const scriptTag = new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["'][^"']*${esc}["']`, 'i');
  const mountedInHtml = scriptTag.test(html);
  // Comment-only mentions are worth telling apart from silence: they mean the
  // page KNOWS about the module and still does not load it.
  const mentionedOnly = !mountedInHtml && html.includes(base);

  return {
    loaded: false,
    how: mountedInHtml
      ? `the served document has a <script src> for ${base}, but globalThis.${globalName} is ` +
        'undefined — so the module was requested and failed to evaluate (a 404, or it threw on load)'
      : mentionedOnly
        ? `the served document mentions ${base} only in a comment — there is no <script src> for it`
        : `the served document does not reference ${base} at all`,
    mountedInHtml,
  };
}

// --inject-fallback: append the module from the harness, for a page that does not
// mount it yet. THIS IS NOT THE ACCEPT AND MUST NEVER BE TREATED AS ONE — H3's
// predicate is the bare `--fallback --scenario happy`, against the page as a judge
// would load it. This mode exists so the module can be proven correct while the
// one-line mount is in another seat's file, and every run of it says so.
async function injectFallbackModule(cdp, sessionId) {
  const r = await evalInPage(cdp, sessionId, `(async () => {
    if (globalThis.outpocketFallbackAgent) return { already: true };
    const s = document.createElement('script');
    s.type = 'module';
    s.src = './fallback-agent.js';
    const done = new Promise((res) => { s.onload = () => res(null); s.onerror = () => res('load failed'); });
    document.head.appendChild(s);
    const err = await done;
    return { already: false, err, global: typeof globalThis.outpocketFallbackAgent,
             installed: globalThis.outpocketFallbackAgent?.installResult ?? null };
  })()`, true);
  if (!r.ok) return { ok: false, why: r.error };
  if (r.value?.err) return { ok: false, why: `<script src="./fallback-agent.js"> ${r.value.err}` };
  return { ok: true, ...r.value };
}

const SUBMIT = 'submit_expense_report';
const EMPLOYEE = 'chen'; // the employee persona; server/personas.json owns the enum, not this file

// The walk. One step per numeral, in the order the predicate asserts them. The steps are FIXED
// because the transitions are: this is the state machine the whole project exists to
// demonstrate, not a parameter. The COUNTS are the parameter.
const WALK = [
  { state: 'S0', label: 'signed out, on load' },
  { state: 'S1', label: 'signed in as the employee persona' },
  { state: 'S3', label: 'draft created and open, no lines yet' },
  { state: 'S2', label: 'one clean line — the submit door opens' },
];

// Read the surface THROUGH getTools(), awaited, because that is the channel both predicates
// name. Returns null when the page API is absent, which is a DIFFERENT FACT from zero tools
// and is reported as such: reading a CDP domain instead of the page API is exactly how the
// retracted IR-16(b) claim came to be published.
async function getToolNames(cdp, sessionId) {
  const r = await evalInPage(cdp, sessionId,
    "(async () => (typeof document.modelContext !== 'object' || !document.modelContext) ? null " +
    ": (await document.modelContext.getTools()).map(t => t.name))()", true);
  if (!r.ok || !Array.isArray(r.value)) return null;
  return r.value;
}

// Registration is asynchronous, and a transition ABORTS the previous controller before
// registering the next surface, so the count passes through intermediate values on its way.
// Requiring the expected size to hold across two reads is what stops a transient from being
// mistaken for arrival — and, on the failing path, what stops this from reporting a count it
// caught mid-flight as though it were the settled one.
async function waitForStableNames(cdp, sessionId, expected, { deadlineMs = 20000, stableMs = 200 } = {}) {
  const deadline = Date.now() + deadlineMs;
  let last = null;
  for (;;) {
    last = await getToolNames(cdp, sessionId);
    if (last && last.length === expected) {
      await sleep(stableMs);
      const again = await getToolNames(cdp, sessionId);
      last = again;
      if (again && again.length === expected) return { names: again, settled: true };
    }
    if (Date.now() > deadline) return { names: last, settled: false };
    await sleep(150);
  }
}

// Diagnostic only — the numeral is what gets asserted. S4 and S5 both hold seven names, so a
// size can be ambiguous; say so rather than silently picking one.
function statesOfSize(MEMBERSHIP, n) {
  return Object.keys(MEMBERSHIP).filter((s) => MEMBERSHIP[s].length === n);
}

function describeSurface(names) {
  return names === null ? 'NO PAGE API (document.modelContext is not an object)' : `${names.length} tool(s)`;
}

// ---- the two channels -------------------------------------------------------------------
// Both return { ok, text } so the walk above them cannot tell which one it is driving.

// CHANNEL A — over the CDP WebMCP domain, BY NAME. `input` MUST be an object here (IR-19).
// The answer arrives on the matching toolResponded; WebMCP.invokeTool's own result carries
// {invocationId} and nothing else.
function cdpChannel(cdp, sessionId, frameId) {
  return async function call(name, input) {
    const r = await invokeTool(cdp, sessionId, frameId, name, input ?? {});
    if (r.sendRejected) {
      return { ok: false, why: `${name}: WebMCP.invokeTool answered ${r.cdp?.code ?? '?'} ${r.error}` };
    }
    if (!r.roundTrip) {
      return { ok: false, why: `${name}: toolResponded status=${r.status}` +
        (r.exception?.description ? ` — ${r.exception.description}` : '') +
        (r.note ? ` — ${r.note}` : '') };
    }
    const blocks = r.output?.content ?? [];
    return { ok: true, text: Array.isArray(blocks) ? blocks.map((b) => b?.text ?? '').join('\n') : String(blocks) };
  };
}

// CHANNEL B — the page's own executeTool, from page JS. THE DESCRIPTOR AND A JSON STRING,
// returning a JSON STRING. There is no by-name call on this channel and this is where that
// matters most: with WebMCP disabled there is no CDP WebMCP domain to fall back to.
function pageChannel(cdp, sessionId) {
  return async function call(name, input) {
    const expr = `(async () => {
      const mc = document.modelContext;
      if (typeof mc !== 'object' || !mc) return { ok: false, why: 'no document.modelContext on this page' };
      const tools = await mc.getTools();
      const d = tools.find(t => t.name === ${JSON.stringify(name)});
      if (!d) return { ok: false, why: 'not on the surface; present: ' + tools.map(t => t.name).join(', ') };
      const out = await mc.executeTool(d, ${JSON.stringify(JSON.stringify(input ?? {}))});
      return { ok: true, raw: typeof out === 'string' ? out : JSON.stringify(out) };
    })()`;
    const r = await evalInPage(cdp, sessionId, expr, true);
    if (!r.ok) return { ok: false, why: `${name}: ${r.error}` };
    if (!r.value?.ok) return { ok: false, why: `${name}: ${r.value?.why ?? 'no result'}` };
    let parsed = null;
    try { parsed = JSON.parse(r.value.raw); } catch { return { ok: true, text: String(r.value.raw) }; }
    const blocks = parsed?.content ?? [];
    return { ok: true, text: Array.isArray(blocks) ? blocks.map((b) => b?.text ?? '').join('\n') : String(parsed) };
  };
}

// ---- the walk ---------------------------------------------------------------------------

// The project code is DISCOVERED from get_session_scope rather than typed, and a project the
// scope marks CLOSED is skipped: charging one is itself a blocking violation
// (PROJECT_INACTIVE), which would fail step 3 for a reason with nothing to do with the flip
// under test.
function pickProject(scopeText) {
  const m = /Chargeable projects:\s*([^.]*)/i.exec(scopeText ?? '');
  if (!m) return null;
  for (const entry of m[1].split(';')) {
    if (/CLOSED/i.test(entry)) continue;
    const code = /([A-Z][A-Z0-9_-]{2,})/.exec(entry.trim());
    if (code) return code[1];
  }
  return null;
}

// Sign in by the page's OWN affordance where there is one, exactly as --smoke-login does, and
// say which path was taken. `dom` is never silently downgraded to `fetch`.
async function signIn(cdp, sessionId, origin) {
  const click = await clickPersona(cdp, sessionId, EMPLOYEE);
  if (click.found) return { path: 'dom', how: click.how };
  const login = await evalInPage(cdp, sessionId, loginExpr(EMPLOYEE), true);
  if (!login.ok || login.value?.status !== 200) {
    return { path: 'fetch', failed: `POST /api/login -> ${login.value?.status ?? login.error}` };
  }
  return { path: 'fetch' };
}

// Drive the four flips, then the violation. `call` is the channel; everything else is shared.
// Returns a list of clause results — nothing here decides the exit code, so that the report
// below can print EVERY clause rather than stopping at the first red one.
async function runFlipWalk(cdp, sessionId, origin, call, counts, MEMBERSHIP, LIMITS, { selftest = false } = {}) {
  // The predicate's words are "through the real policy engine", and on the selftest fixture
  // that is NOT what happened — src/policy.js supplies the THRESHOLD there, but the fixture's
  // own stand-in rule raises the violation. Saying "the real policy engine" on a fixture run
  // would be a false clause in a green report, so the report names which one answered.
  const engine = selftest
    ? "the selftest fixture's stand-in rule (threshold from src/policy.js; NOT the real engine)"
    : 'the real policy engine';
  const clauses = [];
  const say = (ok, text) => { clauses.push({ ok, text }); process.stderr.write(`  ${ok ? 'ok  ' : 'FAIL'}  ${text}\n`); };

  // The flips, in order.
  for (let i = 0; i < WALK.length; i++) {
    const step = WALK[i];
    const want = counts[i];

    if (i === 1) {
      const s = await signIn(cdp, sessionId, origin);
      process.stderr.write(`drive: sign-in as ${EMPLOYEE} via ${s.path}${s.how ? ` (${s.how})` : ''}\n`);
      if (s.failed) { say(false, `step ${i} (${step.label}): could not sign in — ${s.failed}`); return clauses; }
    } else if (i === 2) {
      const scope = await call('get_session_scope', {});
      if (!scope.ok) { say(false, `step ${i}: get_session_scope failed — ${scope.why}`); return clauses; }
      const project = pickProject(scope.text);
      if (!project) {
        say(false, `step ${i}: no active project in get_session_scope: ${JSON.stringify(scope.text?.slice(0, 200))}`);
        return clauses;
      }
      process.stderr.write(`drive: charging the draft to project ${project} (discovered, not typed)\n`);
      const made = await call('create_expense_report', { title: 'assert-flips walk', project });
      if (!made.ok) { say(false, `step ${i}: create_expense_report failed — ${made.why}`); return clauses; }
    } else if (i === 3) {
      const added = await call('add_expense_line', cleanLine(LIMITS));
      if (!added.ok) { say(false, `step ${i}: add_expense_line (clean) failed — ${added.why}`); return clauses; }
      const blocking = blockingCount(added.text);
      if (blocking !== 0) {
        say(false, `step ${i}: the line meant to be CLEAN drew ${blocking} blocking violation(s) from the ` +
          `${engine} — the walk cannot reach ${step.state} and this is a fault in the harness's ` +
          `line, not in the surface: ${JSON.stringify(added.text?.slice(0, 300))}`);
        return clauses;
      }
    }

    const { names, settled } = await waitForStableNames(cdp, sessionId, want);
    const got = names === null ? null : names.length;
    say(got === want && settled,
      `flip ${i} -> ${step.state} (${step.label}): (await getTools()).length is ${describeSurface(names)}, ` +
      `asserted ${want}` + (got === want && !settled ? ' — SEEN BUT NEVER SETTLED' : ''));
    if (got !== want) return clauses;

    // Diagnostic, NOT a gate — see the header. Names against the frozen membership table.
    const candidates = statesOfSize(MEMBERSHIP, want);
    if (!candidates.length) {
      process.stderr.write(`        note: no state in the frozen contract has ${want} tools; ` +
        `sizes are ${Object.entries(MEMBERSHIP).map(([s, v]) => `${s}=${v.length}`).join(' ')}\n`);
    } else {
      const expected = MEMBERSHIP[candidates.includes(step.state) ? step.state : candidates[0]];
      const missing = expected.filter((n) => !names.includes(n));
      const extra = names.filter((n) => !expected.includes(n));
      process.stderr.write(`        note: size ${want} -> ${candidates.join('/')} in the frozen contract; ` +
        (missing.length || extra.length
          ? `NAME SET DIFFERS (missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}) ` +
            `— reported, NOT gated: T2's accept names counts\n`
          : 'name set matches exactly\n'));
    }

    // The submit door must be OPEN at the last flip, because the clause below asserts that it
    // CLOSES. A door that was never open cannot be observed to shut.
    if (i === WALK.length - 1) {
      say(names.includes(SUBMIT),
        `${SUBMIT} is on getTools() at ${step.state} — the door the next clause asserts closes`);
      if (!names.includes(SUBMIT)) return clauses;
    }
  }

  // THE BLOCKING VIOLATION, through the real policy engine, and CONFIRMED rather than assumed.
  // If the surface shrank but no violation was raised, that is a different bug wearing the
  // same clothes, and an unexamined shrink is exactly the vacuous pass this file keeps warning
  // about. So the violation is read back before its consequence is asserted.
  const bad = cleanLine(LIMITS);
  bad.amount = LIMITS.TRANSPORT_PER_LINE / 100 + 100; // over the per-trip transport cap, DERIVED
  bad.merchant = 'Over-cap Coach Charter';
  const hit = await call('add_expense_line', bad);
  if (!hit.ok) { say(false, `violation: add_expense_line failed — ${hit.why}`); return clauses; }
  let blocking = blockingCount(hit.text);
  if (blocking === null) {
    const v = await call('validate_expense_report', {});
    blocking = v.ok ? blockingCount(v.text) : null;
    process.stderr.write('drive: add_expense_line did not report a verdict; read it from ' +
      'validate_expense_report instead\n');
  }
  say(blocking !== null && blocking > 0,
    `a blocking violation was introduced through ${engine}: ` +
    `${blocking ?? 'NO VERDICT COULD BE READ'} blocking violation(s) on a ` +
    `${bad.category} line of ${bad.amount} against a ${LIMITS.TRANSPORT_PER_LINE / 100} cap`);
  if (!(blocking > 0)) return clauses;

  const after = await waitForStableNames(cdp, sessionId, counts[WALK.length - 2]);
  const names = after.names;
  // Phrased as an OBSERVATION, not as the assertion, because this is the one clause whose
  // wording flips meaning under a FAIL prefix: "FAIL submit_expense_report disappeared" reads
  // as though it had.
  const gone = names !== null && !names.includes(SUBMIT);
  say(gone, `after the blocking violation, ${SUBMIT} is ${gone ? 'GONE from' : 'STILL ON'} ` +
    `getTools() — surface is now ${describeSurface(names)}`);
  return clauses;
}

// A line that the real policy engine passes: below the receipt threshold so no receipt is
// needed, below the transport cap, dated inside the filing window and not in the future.
// EVERY THRESHOLD IS READ FROM src/policy.js — a cap that moves must not silently turn this
// into a violating line, nor the violating line into a clean one.
function cleanLine(LIMITS) {
  const d = new Date(Date.now() - 24 * 3600 * 1000); // yesterday: age 1, never negative
  return {
    date: d.toISOString().slice(0, 10),
    merchant: 'Metro Transit',
    category: 'transport',
    amount: Math.max(1, LIMITS.RECEIPT_REQUIRED_AT / 100 - 5),
    currency: 'USD',
  };
}

// The tools report a verdict as "N blocking / M warning on ln_x:" or "ln_x passes every policy
// check." (src/page/tools/defs.js lineVerdictText). null means no verdict was in the text at
// all, which is NOT the same as zero and is never reported as zero.
function blockingCount(text) {
  const m = /(\d+)\s+blocking/i.exec(text ?? '');
  if (m) return Number(m[1]);
  if (/passes every policy check/i.test(text ?? '')) return 0;
  return null;
}

// ---- the --selftest fixture --------------------------------------------------------------
//
// The instrument's own arm. It registers the REAL per-state membership out of the frozen
// contract and flips through the same S0->S1->S3->S2 walk, so the assertion engine, the two
// channels, the stable-count wait and the disappearance clause are all exercised TODAY —
// before src/page/register.js (T2) and src/page/fallback-agent.js (H3) exist. It is a stand-in
// for those two files and it says so on the page; it is not a second implementation of them,
// and no measurement about the product may be taken from it.
//
// ONE IRON-RULE INTERACTION IS LOAD-BEARING HERE. A transition re-registers the surface, which
// aborts the controller that registered the tool CURRENTLY EXECUTING. Revocation does not
// cancel an in-flight execute — the page runs to completion and its result is discarded — so
// re-registering synchronously inside execute would leave WebMCP.toolResponded never arriving
// and the rig waiting on a call that already finished. The flip is therefore deferred onto a
// macrotask: execute RETURNS FIRST, and the surface changes after it.
function selftestHtml(MEMBERSHIP, LIMITS) {
  return `<!doctype html>
<meta charset="utf-8"><title>flip-walk selftest fixture</title>
<body>
<h1>flip-walk selftest fixture</h1>
<p><em>Simulated surface. Stand-in for src/page/register.js (T2) and src/page/fallback-agent.js
(H3), which do not exist yet. Not the product.</em></p>
<button data-persona="chen" style="padding:8px 16px">sign in as chen</button>
<pre id="s">boot</pre>
<script>
var MEMBERSHIP = ${JSON.stringify(MEMBERSHIP)};
var CAP = ${JSON.stringify(LIMITS.TRANSPORT_PER_LINE / 100)};
var st = { signedIn: false, open: false, lines: 0, blocking: 0 };
var simulated = false;

function stateId() {
  if (!st.signedIn) return 'S0';
  if (!st.open) return 'S1';
  return (st.blocking === 0 && st.lines > 0) ? 'S2' : 'S3';
}

// With --disable-features=WebMCP there is no document.modelContext, so the page installs its
// own. THE PAGE-JS CONVENTION IS REPRODUCED EXACTLY as MEASURED 2026-08-29: executeTool takes
// the DESCRIPTOR out of getTools() and a JSON STRING, returns a JSON STRING, and throws
// TypeError on a by-name call. A shim that accepted a name would make --fallback pass against
// a convention the real browser does not have.
if (typeof document.modelContext !== 'object' || !document.modelContext) {
  simulated = true;
  var reg = [];
  document.modelContext = {
    registerTool: function (def, opts) {
      reg.push(def);
      if (opts && opts.signal) opts.signal.addEventListener('abort', function () {
        var i = reg.indexOf(def); if (i >= 0) reg.splice(i, 1);
      });
      return Promise.resolve(undefined); // no handle comes back; AbortController is the only revocation path
    },
    getTools: function () {
      return Promise.resolve(reg.map(function (d) {
        return { name: d.name, description: d.description, inputSchema: d.inputSchema, annotations: d.annotations };
      }));
    },
    executeTool: function (descriptor, argsJson) {
      if (typeof descriptor === 'string') throw new TypeError("parameter 1 is not of type 'RegisteredTool'.");
      var d = reg.filter(function (x) { return x.name === (descriptor || {}).name; })[0];
      if (!d) throw new TypeError("parameter 1 is not of type 'RegisteredTool'.");
      return Promise.resolve(d.execute(JSON.parse(argsJson || '{}'))).then(function (out) { return JSON.stringify(out); });
    }
  };
}

function text(t) { return { content: [{ type: 'text', text: t }] }; }

// Deferred: execute RETURNS FIRST, then the surface flips. See the comment above this fixture.
function flip() { setTimeout(sync, 0); }

function defFor(name) {
  return {
    name: name,
    description: 'Selftest stand-in for ' + name + '. Not the product tool.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: function (a) {
      a = a || {};
      if (name === 'get_session_scope') {
        return text('Chen Xiao · role employee · CC-1. Chargeable projects: FALCON (Falcon, active); ' +
          'ORIOLE (Oriole — CLOSED). Approver: none. Reimbursement currency: USD.');
      }
      if (name === 'create_expense_report') {
        st.open = true; st.lines = 0; st.blocking = 0; flip();
        return text('Draft RP-SELFTEST created and opened for project ' + a.project + '.');
      }
      if (name === 'add_expense_line') {
        var over = Number(a.amount) > CAP;
        st.lines += 1; if (over) st.blocking += 1; flip();
        return text(over
          ? '1 blocking / 0 warning on ln_' + st.lines + ':\\nCAP_TRANSPORT block amount'
          : 'ln_' + st.lines + ' passes every policy check.');
      }
      if (name === 'validate_expense_report') {
        return text(st.blocking + ' blocking / 0 warning on the open report.');
      }
      return text(name + ' ok');
    }
  };
}

var ctrl = null;
function sync() {
  if (ctrl) ctrl.abort();          // AbortController is the ONLY de-registration path
  ctrl = new AbortController();
  var names = MEMBERSHIP[stateId()];
  for (var i = 0; i < names.length; i++) document.modelContext.registerTool(defFor(names[i]), { signal: ctrl.signal });
  document.getElementById('s').textContent =
    stateId() + ' · ' + names.length + ' tool(s)' + (simulated ? ' · simulated agent' : ' · real WebMCP');
}

document.querySelector('[data-persona="chen"]').addEventListener('click', function () {
  st.signedIn = true; flip();
});
sync();
</script>`;
}

// ---- the modes ---------------------------------------------------------------------------

async function modeFlipWalk({ counts, fallback, selftest, url, headless, scenarioName, injectFallback }) {
  const { MEMBERSHIP } = await import(resolve(REPO, 'src', 'page', 'tools', 'compile.js'));
  const { LIMITS } = await import(resolve(REPO, 'src', 'policy.js'));

  // H3.accept names the walk as "2->6->13->14" without passing the numerals on the command
  // line, so --fallback on its own takes them FROM THE FROZEN CONTRACT — the size of each
  // walk state's membership — rather than from a second copy typed into this file. That is
  // also the cross-check made explicit: if these defaults ever stop reading 2,6,13,14, the
  // contract moved and every document quoting those numerals is stale.
  if (!counts) counts = WALK.map((w) => MEMBERSHIP[w.state].length);

  if (counts.length !== WALK.length) {
    process.stderr.write(`drive: --assert-flips needs exactly ${WALK.length} counts, one per step of the walk ` +
      `(${WALK.map((w) => `${w.state} ${w.label}`).join(' -> ')}); got ${counts.length}\n`);
    return 1;
  }

  // H3.accept runs `--fallback --scenario happy`. harness/scenarios/happy.json is H3's OWN
  // declared output and is not this follow-up's to write, so a named scenario is REQUIRED to
  // exist and its absence is reported as the ordering fact it is — never silently replaced by
  // the built-in walk, because a degraded run and a green run must not be confusable.
  if (scenarioName) {
    const f = join(REPO, 'harness', 'scenarios', `${scenarioName}.json`);
    if (!existsSync(f)) {
      process.stderr.write(`drive: --scenario ${scenarioName} names ${f}, which does not exist yet. ` +
        `harness/scenarios/${scenarioName}.json is a declared OUTPUT of node H3 (with ` +
        `src/page/fallback-agent.js) and lands with it. That is an ordering fact, not a defect ` +
        `in --fallback: run --fallback --selftest to exercise this mode today.\n`);
      return 1;
    }
    // THE SCENARIO FILE IS READ, NOT MERELY OPENED. A file whose only job is to
    // exist is a check that discovered nothing; these numbers have to be able to
    // be WRONG. Each walk row is cross-checked against MEMBERSHIP in the frozen
    // contract, and a mismatch fails here rather than surfacing four steps later
    // as a mysterious count error.
    process.stderr.write(`drive: --scenario ${scenarioName} <- ${f}\n`);
    let scen = null;
    try { scen = JSON.parse(readFileSync(f, 'utf8')); }
    catch (e) { process.stderr.write(`drive: ${f} is not valid JSON — ${e.message}\n`); return 1; }
    if (!Array.isArray(scen.walk) || scen.walk.length !== WALK.length) {
      process.stderr.write(`drive: ${f} needs a \`walk\` array of ${WALK.length} rows, one per step ` +
        `(got ${Array.isArray(scen.walk) ? scen.walk.length : typeof scen.walk}).\n`);
      return 1;
    }
    const bad = [];
    scen.walk.forEach((row, i) => {
      const want = MEMBERSHIP[WALK[i].state]?.length;
      if (row.state !== WALK[i].state) bad.push(`row ${i}: state ${JSON.stringify(row.state)} != ${WALK[i].state}`);
      else if (row.count !== want) bad.push(`row ${i} (${row.state}): scenario says ${row.count}, the frozen contract says ${want}`);
    });
    if (bad.length) {
      process.stderr.write(`drive: ${f} disagrees with MEMBERSHIP in src/page/tools/compile.js:\n` +
        bad.map((b) => `drive:   ${b}\n`).join('') +
        'drive: the contract is the authority — fix the scenario, not the contract.\n');
      return 1;
    }
    process.stderr.write(`drive: scenario walk cross-checked against the frozen contract: ` +
      `${scen.walk.map((r) => `${r.state}=${r.count}`).join(' -> ')}\n`);
  }

  // --assert-flips is specified over --enable-features=WebMCP; --fallback over
  // --disable-features=WebMCP. tools/chrome.mjs (H1) owns the enable spelling; the disable is
  // appended by this caller and printed on the launch line. See launch().
  const scenario = fallback ? 'none' : 'cdp';
  const extraFlags = fallback ? ['--disable-features=WebMCP'] : [];

  const own = url ? null : (selftest ? null : await serveApp());
  let fixture = null;
  if (selftest) {
    const html = selftestHtml(MEMBERSHIP, LIMITS);
    const srv = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    fixture = { origin: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) };
  }
  const origin = url ?? fixture?.origin ?? own.origin;

  const b = await launch(scenario, { headless, extraFlags });
  try {
    process.stderr.write(
      `drive: ${fallback ? '--fallback' : '--assert-flips'} ${counts.join(',')} against ${origin}\n` +
      `drive: channel ${fallback ? 'PAGE JS — document.modelContext.executeTool(descriptor, JSON string)' :
        'CDP — WebMCP.invokeTool by name'}; flag ${b.flag ?? '(none)'}` +
      `${b.disableFlag ? ' ' + b.disableFlag : ''}; headless ${b.headless}; ` +
      `surface ${selftest ? 'SELFTEST FIXTURE (a stand-in, not the product)' : 'the served application'}\n`);

    // Only the real application needs its static route; the fixture serves its own page.
    if (!selftest) {
      const root = await checkRootServesPage(origin);
      if (!root.ok) { process.stderr.write(`drive: ${root.why}\n`); return 1; }
    }

    const { sessionId, surface, frameId } = await openPage(b, origin);

    // NOT THE ACCEPT. Said on every run, loudly, because a green injected run and
    // a green mounted run must never be confusable — the whole point of H3 is that
    // a judge loading the page gets the fallback, and injection proves only that
    // the module works, not that the page has it.
    if (injectFallback && fallback && !selftest) {
      const inj = await injectFallbackModule(b.cdp, sessionId);
      process.stderr.write(inj.ok
        ? `drive: *** --inject-fallback: src/page/fallback-agent.js was appended BY THE HARNESS ` +
          `(${inj.already ? 'the page had already loaded it' : 'the page had not loaded it'}). ` +
          `THIS IS NOT H3's ACCEPT. The accept is the bare --fallback --scenario happy against the ` +
          `page as a judge loads it; that stays red until src/page/index.html mounts the module. ***\n`
        : `drive: --inject-fallback failed: ${inj.why}\n`);
      if (!inj.ok) return 1;
    }

    const call = fallback ? pageChannel(b.cdp, sessionId) : cdpChannel(b.cdp, sessionId, frameId);

    // NAME THE ORDERING FACT IN THE ERROR TEXT. --smoke-login's own failure message is what let
    // F1's span 0 be diagnosed in a single run instead of an afternoon, and the two files this
    // walk needs are both still in flight. A bare "0 tools, asserted 2" is a true report and a
    // useless one; it reads as a defect in the harness when it is a defect in the calendar.
    // Note that an ABSENT API and a PRESENT-BUT-EMPTY one are different facts and are told
    // apart here: with --enable-features=WebMCP the page API exists from load, so a page that
    // has simply never registered anything reports zero, not null.
    const first = await getToolNames(b.cdp, sessionId);
    if (!selftest && (first === null || first.length === 0)) {
      const producer = fallback
        ? { file: 'src/page/fallback-agent.js', node: 'H3', what: 'installs the page\'s own getTools/executeTool when WebMCP is disabled' }
        : { file: 'src/page/register.js', node: 'T2', what: 'calls document.modelContext.registerTool for the current state' };
      const missing = !existsSync(join(REPO, producer.file));
      process.stderr.write(
        `drive: this page ${first === null ? 'exposes NO document.modelContext at all' :
          'exposes document.modelContext but has registered ZERO tools'}, ` +
        `so there is no tool surface to walk.\n` +
        (missing
          ? `drive: ${producer.file} — the declared OUTPUT of node ${producer.node}, which ${producer.what} — ` +
            `DOES NOT EXIST YET. That is an ordering fact, not a defect in ` +
            `${fallback ? '--fallback' : '--assert-flips'}: run it with --selftest to exercise ` +
            `this mode against the frozen per-state membership today.\n`
          : `drive: ${producer.file} (node ${producer.node}) EXISTS on disk.\n`));

      // EXISTENCE IS NOT EXECUTION, and the previous version of this message
      // conflated them: it said "the page loaded it and still registered
      // nothing" on the strength of an existsSync, which is exactly the defect
      // that let two page modules merge green today without ever being
      // evaluated by the page. Ask the PAGE which modules it actually pulled.
      if (!missing) {
        const mounted = await pageMountsModule(b.cdp, sessionId, origin, producer.file);
        process.stderr.write(mounted.loaded
          ? `drive: and the page DID load it (${mounted.how}) — so it evaluated and still produced no ` +
            `surface. That is a real failure in ${producer.file}.\n`
          : `drive: but the page NEVER LOADED IT — ${mounted.how}. src/page/index.html has no ` +
            `<script type="module" src="./${producer.file.split('/').pop()}"> tag, so the module is an ` +
            `ORPHAN: correct on disk, never evaluated in the page. index.html is node F1's output and ` +
            `not this seat's to edit, so this is one line from F1/UX, not a defect in ${producer.file}. ` +
            `Run with --inject-fallback to prove the module works before that line lands — that mode ` +
            `is deliberately NOT the accept.\n`);
      }
      return 1;
    }

    const clauses = await runFlipWalk(b.cdp, sessionId, origin, call, counts, MEMBERSHIP, LIMITS, { selftest });
    const failed = clauses.filter((c) => !c.ok).length;

    // The two channels cross-checked, on stderr. The predicate's channel is getTools(); this
    // only says so out loud when the CDP enumeration disagrees with it.
    if (!fallback && surface.names.size) {
      const cdpNames = [...surface.names];
      const page = await getToolNames(b.cdp, sessionId);
      if (page && cdpNames.length !== page.length) {
        process.stderr.write(`drive: note — WebMCP.toolsAdded/Removed leaves ${cdpNames.length} name(s) ` +
          `but getTools() reports ${page.length}. getTools() is the channel the predicate names.\n`);
      }
    }

    process.stderr.write(`drive: ${clauses.length - failed}/${clauses.length} clause(s) passed\n`);
    if (failed) return 1;
    // STDOUT IS THE MACHINE SURFACE: one plain line, via process.stdout.write and never
    // console.log of an inspected value — every resident seat exports FORCE_COLOR=3
    // (kb/pits/L0.md), which makes util.inspect emit SGR codes even into a pipe, and NO_COLOR=1
    // does not suppress it.
    process.stdout.write(`flips ${counts.join(',')} ok via ${fallback ? 'page-js' : 'cdp'}` +
      `${selftest ? ' (selftest fixture)' : ''}\n`);
    return 0;
  } finally {
    await b.close();
    if (own) await own.close();
    if (fixture) await fixture.close();
  }
}

// ------------------------------------------------------------------------------- argv

function parseArgv(argv) {
  const out = { headless: true, input: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--list') out.list = true;
    else if (a === '--exec') out.exec = argv[++i];
    else if (a === '--gate') out.gate = true;
    else if (a === '--input') out.input = JSON.parse(argv[++i]);
    else if (a === '--smoke-login') out.smokeLogin = argv[++i];
    else if (a === '--assert-flips') out.assertFlips = argv[++i];
    else if (a === '--fallback') out.fallback = true;
    else if (a === '--scenario') out.scenarioName = argv[++i];
    else if (a === '--selftest') out.selftest = true;
    else if (a === '--inject-fallback') out.injectFallback = true;
    else if (a === '--dump-state') out.dumpState = true;
    else if (a === '--headed') out.headless = false;
    else if (a === '--headless') out.headless = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

// `2,6,13,14` -> [2,6,13,14]. A non-numeral is an error rather than a NaN that silently fails
// every comparison downstream and reports a count mismatch it never had.
function parseCounts(spec) {
  const parts = String(spec ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const out = parts.map(Number);
  const bad = parts.filter((_, i) => !Number.isInteger(out[i]) || out[i] < 0);
  if (!parts.length || bad.length) {
    throw new Error(`--assert-flips takes a comma-separated list of tool counts, e.g. 2,6,13,14` +
      (bad.length ? ` — not ${bad.map((b) => JSON.stringify(b)).join(', ')}` : ''));
  }
  return out;
}

// ------------------------------------------------------------- --dump-state (H4)
//
// Load a seeded demo URL, wait for the demo to SETTLE, read the page's own ERP
// state, and write a byte-stable dump. H4's accept runs this twice at the same
// seed and diffs the two.
//
// THE PREDICATE CAN PASS WHILE PROVING NOTHING — `diff` exits 0 on two empty
// files — so three things here are deliberate:
//
//   * it AWAITS `outpocketDemo.ready` rather than sleeping. A fixed sleep that
//     is slightly too short produces a half-finished filing, and two
//     half-finished filings that stopped in the same place still diff clean.
//     Racing the demo is a way to pass this predicate while timing a stopwatch.
//   * `referenceDate` is read in THE SAME Runtime.evaluate as the state, off the
//     ERP's own clock. Read separately, a run straddling midnight would
//     relativise the dates against the wrong day.
//   * harness/dump-state.mjs refuses to emit a dump with no reports and no
//     day-book entries, so "the demo never ran" fails loudly here instead of
//     exiting 0 twice and diffing clean.
async function modeDumpState(url, { headless }) {
  const { dumpText, DumpError } = await import(resolve(REPO, 'harness', 'dump-state.mjs'));
  const b = await launch('cdp', { headless });
  try {
    const { sessionId } = await openPage(b, url);

    const mounted = await evalInPage(b.cdp, sessionId, 'typeof globalThis.outpocketDemo', false);
    if (!mounted.ok || mounted.value === 'undefined') {
      process.stderr.write(
        'drive: this page never loaded src/page/demo-mode.js — globalThis.outpocketDemo is undefined.\n' +
        'drive: src/page/index.html needs <script type="module" src="./demo-mode.js"></script>. ' +
        "index.html is node F1's output and not this seat's to edit, so that is one line from F1/UX. " +
        'Serve a copy of src/ carrying the tag and point --url at it to verify before it lands.\n');
      return 1;
    }

    const on = await evalInPage(b.cdp, sessionId, 'JSON.stringify(globalThis.outpocketDemo.params ?? null)', false);
    const params = on.ok && on.value ? JSON.parse(on.value) : null;
    if (!params || !params.on) {
      process.stderr.write('drive: ' + url + ' did not turn demo mode on — the page read ' +
        JSON.stringify(params) + '. --dump-state needs ?demo=1&seed=N in the URL.\n');
      return 1;
    }

    // AWAIT THE DEMO, never sleep past it.
    const settled = await evalInPage(b.cdp, sessionId,
      '(async () => { await globalThis.outpocketDemo.ready; return globalThis.outpocketDemo.done === true; })()', true);
    if (!settled.ok || settled.value !== true) {
      process.stderr.write('drive: the demo never settled: ' + (settled.error ?? settled.value) + '\n');
      return 1;
    }

    // ONE READ: state, the ERP's own reference date, and the policy verdict.
    const read = await evalInPage(b.cdp, sessionId, `(() => {
      const t = globalThis.outpocketTools;
      if (!t) return null;
      const d = t.erp.now();
      const pad = (n) => String(n).padStart(2, '0');
      let verdict = null;
      try { verdict = t.erp.openReportOrNull() ? t.erp.verdict() : null; }
      catch (e) { verdict = { error: String((e && e.message) || e) }; }
      return JSON.parse(JSON.stringify({
        seed: globalThis.outpocketDemo.params.seed,
        referenceDate: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
        demo: {
          reachedState: globalThis.outpocketDemo.result ? globalThis.outpocketDemo.result.reachedState : null,
          steps: ((globalThis.outpocketDemo.result || {}).steps || []).map((s) => ({ tool: s.tool, ok: s.ok }))
        },
        state: t.erp.state,
        verdict: verdict
      }));
    })()`, false);
    if (!read.ok || !read.value) {
      process.stderr.write('drive: could not read page state: ' +
        (read.error ?? 'globalThis.outpocketTools is absent') + '\n');
      return 1;
    }

    try {
      process.stdout.write(dumpText(read.value));
    } catch (e) {
      process.stderr.write('drive: ' + (e instanceof DumpError ? e.code + ' — ' : '') + e.message + '\n');
      return 1;
    }
    process.stderr.write('drive: --dump-state seed ' + read.value.seed +
      ', reference ' + read.value.referenceDate +
      ', reached ' + (read.value.demo && read.value.demo.reachedState) + '\n');

    // PER-STEP TIMINGS TRAVEL ON THEIR OWN CHANNEL — stderr, as one labelled
    // JSON line — and deliberately NEVER enter the dump. H4's accept is a
    // byte-for-byte diff of two runs at the same seed; a duration in the dump
    // varies run to run and would break it. harness/rehearse.mjs (H6) parses
    // this line, which is why it is a single machine-readable line and not
    // prose: it is an interface, so it is written as one.
    const timings = await evalInPage(b.cdp, sessionId,
      'JSON.stringify((globalThis.outpocketDemo.result?.steps ?? []).map((s) => ({ tool: s.tool, ok: s.ok, ms: s.ms ?? null })))',
      false);
    if (timings.ok && timings.value) {
      process.stderr.write('drive: timings ' + timings.value + '\n');
    }
    return 0;
  } finally {
    await b.close();
  }
}

const USAGE = [
  'usage:',
  '  node harness/drive.mjs [--gate]                       reachability gate -> evidence/H2-reachability.json',
  '  node harness/drive.mjs --url <origin> --list          one tool name per line, exit 0',
  '  node harness/drive.mjs --url <origin> --exec <name>   invoke by name over CDP, exit 0',
  '  node harness/drive.mjs --smoke-login chen,ruiz       a real login per persona in a real',
  '                                                       browser, one fresh cookie jar each;',
  '                                                       serves the app itself unless --url',
  '  node harness/drive.mjs --assert-flips 2,6,13,14      walk S0->S1->S3->S2 over CDP with',
  '                                                       --enable-features=WebMCP, assert each',
  '                                                       (await getTools()).length in order,',
  '                                                       then assert submit_expense_report',
  '                                                       disappears after a blocking violation',
  '  node harness/drive.mjs --fallback [--scenario happy] the same walk with',
  '                                                       --disable-features=WebMCP, driven',
  '                                                       through the page\'s own getTools/',
  '                                                       executeTool (simulated agent)',
  '  ... --selftest                                       either walk against this file\'s own',
  '                                                       fixture, which registers the frozen',
  '                                                       per-state membership. The instrument\'s',
  '                                                       own arm — NOT a run against the product',
  '',
  'exit: 0 ok | 2 tool not found (the browser\'s own -32602) | 1 anything else',
].join('\n');

let rc = 1;
try {
  const o = parseArgv(process.argv.slice(2));
  if (o.dumpState) {
    if (!o.url) throw new Error('--dump-state requires --url');
    rc = await modeDumpState(o.url, o);
  } else if (o.smokeLogin !== undefined) {
    rc = await modeSmokeLogin(o.smokeLogin, o);
  } else if (o.assertFlips !== undefined || o.fallback) {
    rc = await modeFlipWalk({ ...o, counts: o.assertFlips === undefined ? null : parseCounts(o.assertFlips) });
  } else if (o.list || o.exec) {
    if (!o.url) throw new Error('--list and --exec require --url');
    rc = o.list ? await modeList(o.url, o) : await modeExec(o.url, o.exec, o.input, o);
  } else {
    rc = await modeGate(o);
  }
} catch (err) {
  process.stderr.write(`harness/drive.mjs: ${err.message}\n`);
  if (/unknown argument|require --url/.test(err.message)) process.stderr.write(USAGE + '\n');
  rc = 1;
}
process.exit(rc);
