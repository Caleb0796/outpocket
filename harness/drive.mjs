#!/usr/bin/env node
// H2 — the CDP driver. Enumerates tools, executes one, asserts on the result.
//
// Owner: I1. Declared outputs: harness/drive.mjs, evidence/H2-reachability.json.
// Accept: erp/graph.json -> nodes[id=H2].accept (verbatim in .team/contracts/H2.txt).
//
//   node harness/drive.mjs                       # reachability gate -> evidence/H2-reachability.json
//   node harness/drive.mjs --url <origin> --list  # one tool name per line on stdout, exit 0
//   node harness/drive.mjs --url <origin> --exec <name>   # invoke by name over CDP, exit 0
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
async function launch(scenario, { headless }) {
  const bin = chromeBinary();
  const dir = mkdtempSync(join(tmpdir(), `h2-${scenario}-`));
  const flags = flagsFor(scenario, { port: 0, userDataDir: dir, headless, url: 'about:blank' });
  process.stderr.write(launchLabel(scenario, flags) + '\n');

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
    else if (a === '--headed') out.headless = false;
    else if (a === '--headless') out.headless = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

const USAGE = [
  'usage:',
  '  node harness/drive.mjs [--gate]                       reachability gate -> evidence/H2-reachability.json',
  '  node harness/drive.mjs --url <origin> --list          one tool name per line, exit 0',
  '  node harness/drive.mjs --url <origin> --exec <name>   invoke by name over CDP, exit 0',
  '',
  'exit: 0 ok | 2 tool not found (the browser\'s own -32602) | 1 anything else',
].join('\n');

let rc = 1;
try {
  const o = parseArgv(process.argv.slice(2));
  if (o.list || o.exec) {
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
