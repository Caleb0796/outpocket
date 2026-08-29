#!/usr/bin/env node
// V0 — navigator.modelContext alias status on the INSTALLED Chrome major.
//
// Owner: I1. Declared outputs: harness/probe-v0.mjs, evidence/V0.json.
// Accept: erp/graph.json -> nodes[id=V0].accept (verbatim in .team/contracts/V0.txt).
//
// Four traps this file exists to not fall into, in the order they bite:
//
//  1. NO FLAG = NO SURFACE. A flagless launch leaves document.modelContext
//     undefined, headed AND under --headless=new (FACTS §1 IR-16(b), retracted
//     claim). A probe without the flag measures the flag, not the alias. So the
//     graded arm carries --enable-features=WebMCP, and a second no-flag arm runs
//     as the negative control FACTS §1 IR-1's advance reading requires.
//  2. getTools() RETURNS A PROMISE (IR-18). An un-awaited .length is undefined,
//     and `!== 0` passes against an empty surface. The expression evaluated in
//     the page below is literally `(await ...getTools()).length`, under
//     Runtime.evaluate awaitPromise:true.
//  3. cdpDomainEnabled IS RECORDED AND NEVER ASSERTED ON. WebMCP.enable returns
//     OK in a launch with no flag, no tools and no page API at all. Nothing in
//     this file branches on it. The negative-control arm records it too, so the
//     evidence file itself carries the proof that it is vacuous.
//  4. invokeToolRoundTrip IS THE ONLY DISCRIMINATOR — a real WebMCP.invokeTool
//     whose matching toolResponded carries status:'Completed' (IR-17). It is the
//     field that decides whether this probe ran against a live surface at all.
//
// chromeMajor comes from `<binary> --version`, never a user-agent string.
// `headless` is recorded and NOT constrained; the flag works under --headless=new.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

// V5's throwaway HTTPS origin. Remote by default and deliberately: a green
// localhost run is not evidence (V6-consent-gate was invisible on localhost).
// Overridable for re-runs, but whatever is used is recorded in the evidence.
const ORIGIN = process.env.V0_ORIGIN || readOrigin();
const TOOL = process.env.V0_TOOL || 'probe_status';
const FLAG = 'WebMCP';                     // --enable-features=WebMCP
const HEADLESS = process.env.V0_HEADED !== '1';
const OUT = join(REPO, 'evidence', 'V0.json');

function readOrigin() {
  const f = join(REPO, 'evidence', 'V5-origin.txt');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  throw new Error('no origin: evidence/V5-origin.txt missing and V0_ORIGIN unset');
}

function chromeBinary() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('no Chrome binary found; set CHROME_PATH');
}

// chromeMajor from the INSTALLED BINARY. Never a user-agent string: a UA can be
// frozen, spoofed or reduced, and on 152 it is not the number we are grading.
function binaryVersion(bin) {
  const raw = execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim();
  const m = raw.match(/(\d+)\.(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`cannot parse version from ${JSON.stringify(raw)}`);
  return { raw, major: Number(m[1]) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- CDP client
// JSON-RPC over one socket. Node 22 ships a stable global WebSocket, so this
// needs no dependency — package.json is L0's output and not mine to grow.
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
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const frame = { id, method, params };
    if (sessionId) frame.sessionId = sessionId;
    this.ws.send(JSON.stringify(frame));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`));
      }, 30000);
    });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  close() { try { this.ws.close(); } catch {} }
}

// ------------------------------------------------------------------- launch
async function launch({ bin, flag, headless }) {
  const dir = mkdtempSync(join(tmpdir(), 'v0-chrome-'));
  const args = [
    `--user-data-dir=${dir}`,
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    'about:blank',
  ];
  if (headless) args.unshift('--headless=new');
  // Trap 1: the flag, or deliberately nothing at all for the negative control.
  if (flag) args.unshift(`--enable-features=${flag}`);

  const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
  const portFile = join(dir, 'DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 200; i++) {
    if (existsSync(portFile)) {
      const [port, path] = readFileSync(portFile, 'utf8').split('\n');
      if (port && path) { wsUrl = `ws://127.0.0.1:${port.trim()}${path.trim()}`; break; }
    }
    await sleep(50);
  }
  if (!wsUrl) { child.kill('SIGKILL'); throw new Error('Chrome never wrote DevToolsActivePort'); }
  const cdp = await CDP.connect(wsUrl);
  return {
    cdp, args,
    async close() {
      cdp.close();
      child.kill('SIGKILL');
      await sleep(150);
      try { rmSync(dir, { recursive: true, force: true }); } catch {}
    },
  };
}

async function openPage(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const loaded = new Promise((res) => {
    const off = cdp.on((m) => {
      if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) { off(); res(); }
    });
    setTimeout(res, 60000); // free-tier Render cold start; proceed and let the probes speak
  });
  await cdp.send('Page.navigate', { url }, sessionId);
  await loaded;
  return sessionId;
}

// Every boolean below is obtained via CDP Runtime.evaluate on a live page.
// The comparison happens IN THE PAGE so the recorded value is the predicate's
// own expression, not a Node-side reconstruction of it.
async function evalInPage(cdp, sessionId, expression, awaitPromise = false) {
  const r = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) {
    return { ok: false, error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  }
  return { ok: true, value: r.result.value };
}

async function probeArm({ bin, flag, headless, url, invoke }) {
  const arm = { flag: flag ? `--enable-features=${flag}` : null, headless };
  const b = await launch({ bin, flag, headless });
  try {
    const sessionId = await openPage(b.cdp, url);

    // Trap 1 + the V0 question itself. Read off `typeof`, in the page, never off
    // whether a CDP domain enables.
    arm.documentPresent = (await evalInPage(b.cdp, sessionId,
      "typeof document.modelContext === 'object'")).value === true;
    arm.navigatorAlias = (await evalInPage(b.cdp, sessionId,
      "typeof navigator.modelContext === 'object'")).value === true;
    arm.rawTypeof = (await evalInPage(b.cdp, sessionId,
      "JSON.stringify({document: typeof document.modelContext, navigator: typeof navigator.modelContext})")).value;

    // Trap 2. THE AWAIT IS LOAD-BEARING. `!== 0` is not substituted anywhere.
    arm.toolCount = 0;
    if (arm.documentPresent) {
      const deadline = Date.now() + 15000;
      for (;;) {
        const r = await evalInPage(b.cdp, sessionId,
          '(async () => (await document.modelContext.getTools()).length)()', true);
        if (r.ok && Number.isInteger(r.value)) arm.toolCount = r.value;
        if (arm.toolCount > 0 || Date.now() > deadline) break;
        await sleep(250);
      }
      // Same expression un-awaited, recorded to keep the trap visible in evidence.
      arm.unAwaitedLength = (await evalInPage(b.cdp, sessionId,
        'String(document.modelContext.getTools().length)')).value;
    }

    // Trap 3. RECORDED, NEVER ASSERTED ON. Nothing below branches on this value;
    // the negative-control arm records it as well, which is the proof it is vacuous.
    try {
      await b.cdp.send('WebMCP.enable', {}, sessionId);
      arm.cdpDomainEnabled = true;
    } catch {
      arm.cdpDomainEnabled = false;
    }

    // Trap 4. THE ONLY DISCRIMINATOR. invokeTool returns {invocationId} and
    // nothing else (IR-17); the answer arrives later on toolResponded, correlated
    // by that id.
    arm.invokeToolRoundTrip = false;
    if (invoke && arm.toolCount > 0) {
      const { frameTree } = await b.cdp.send('Page.getFrameTree', {}, sessionId);
      const frameId = frameTree.frame.id;
      const responded = new Promise((res) => {
        const off = b.cdp.on((m) => {
          if (m.method === 'WebMCP.toolResponded') { off(); res(m.params); }
        });
        setTimeout(() => { off(); res(null); }, 20000);
      });
      try {
        const { invocationId } = await b.cdp.send('WebMCP.invokeTool',
          { frameId, toolName: invoke, input: {} }, sessionId);   // input MUST be an object
        const ev = await responded;
        arm.invokeTool = {
          toolName: invoke,
          invocationId,
          matched: ev ? ev.invocationId === invocationId : false,
          status: ev ? ev.status : null,
          output: ev && ev.output !== undefined ? ev.output : null,
        };
        arm.invokeToolRoundTrip = !!ev && ev.invocationId === invocationId && ev.status === 'Completed';
      } catch (e) {
        arm.invokeTool = { toolName: invoke, error: e.message, cdp: e.cdp || null };
      }
    }
    return arm;
  } finally {
    await b.close();
  }
}

// ---------------------------------------------------------------------- main
const bin = chromeBinary();
const version = binaryVersion(bin);

const graded = await probeArm({ bin, flag: FLAG, headless: HEADLESS, url: ORIGIN, invoke: TOOL });
// The no-flag negative control FACTS §1 IR-1 requires of this node: it is what
// makes documentPresent in the graded arm a fact about Chrome 152 rather than a
// fact about our command line. It also records cdpDomainEnabled with the feature
// demonstrably off, which is trap 3 made visible in the artifact.
const control = await probeArm({ bin, flag: null, headless: HEADLESS, url: ORIGIN, invoke: null });

const evidence = {
  node: 'V0',
  question: 'navigator.modelContext alias status on the INSTALLED Chrome major',
  verdict: graded.navigatorAlias ? 'alias-present' : 'alias-absent',

  // --- the nine fields V0.accept names, in its order ---
  chromeMajor: version.major,
  flag: graded.flag,
  headless: graded.headless,
  navigatorAlias: graded.navigatorAlias,
  documentPresent: graded.documentPresent,
  toolCount: graded.toolCount,
  cdpDomainEnabled: graded.cdpDomainEnabled,
  invokeToolRoundTrip: graded.invokeToolRoundTrip,
  method: 'cdp',

  // --- provenance ---
  chromeVersion: version.raw,
  chromeBinary: bin,
  origin: ORIGIN,
  observedAt: new Date().toISOString(),
  rawTypeof: graded.rawTypeof,
  unAwaitedGetToolsLength: graded.unAwaitedLength,
  invokeTool: graded.invokeTool ?? null,
  negativeControl: {
    note: 'Same binary, same page, no --enable-features. documentPresent:false here is what makes documentPresent:true above a fact about Chrome 152 and not about our command line. cdpDomainEnabled is recorded on BOTH arms on purpose: it reads true with the feature off, which is why nothing asserts on it.',
    flag: control.flag,
    headless: control.headless,
    documentPresent: control.documentPresent,
    navigatorAlias: control.navigatorAlias,
    toolCount: control.toolCount,
    cdpDomainEnabled: control.cdpDomainEnabled,
    rawTypeof: control.rawTypeof,
  },
  notes: [
    'chromeMajor is parsed from `' + bin + ' --version`, never from a user-agent string.',
    'Every boolean above was produced by CDP Runtime.evaluate on a live page; the comparison is evaluated IN THE PAGE.',
    'toolCount is (await document.modelContext.getTools()).length under awaitPromise:true. The un-awaited form is recorded above as unAwaitedGetToolsLength to keep IR-18 visible.',
    'cdpDomainEnabled is recorded and never asserted on (FACTS §1 IR-16(b), retracted): WebMCP.enable returns OK with no flag, no tools and no page API — see negativeControl.',
    'invokeToolRoundTrip is the only field that discriminates a live surface from an empty launch: WebMCP.invokeTool + a matching WebMCP.toolResponded carrying status "Completed" (FACTS §1 IR-17).',
    'No agent was connected. These are renderer-side readings only.',
  ],
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n');

// Exit 0 only when the probe actually ran against a live surface. A file that
// looks green because the surface was empty is the failure mode this node exists
// to prevent, so the discriminator gates the exit code.
const required = { chromeMajor: 'number', flag: 'string', headless: 'boolean',
  navigatorAlias: 'boolean', documentPresent: 'boolean', toolCount: 'number',
  cdpDomainEnabled: 'boolean', invokeToolRoundTrip: 'boolean', method: 'string' };
const bad = Object.entries(required)
  .filter(([k, t]) => typeof evidence[k] !== t)
  .map(([k]) => k);
if (bad.length) { console.error(`V0 FAIL: wrong type for ${bad.join(', ')}`); process.exit(1); }
if (!Number.isInteger(evidence.chromeMajor) || !Number.isInteger(evidence.toolCount)) {
  console.error('V0 FAIL: chromeMajor and toolCount must be integers'); process.exit(1);
}
if (evidence.method !== 'cdp') { console.error('V0 FAIL: method must be cdp'); process.exit(1); }
if (!evidence.invokeToolRoundTrip) {
  console.error('V0 FAIL: no invokeTool round trip — this probe did not run against a live surface, ' +
    'so its booleans are facts about the launch and not about Chrome ' + evidence.chromeMajor + '.');
  console.error(JSON.stringify({ documentPresent: evidence.documentPresent, toolCount: evidence.toolCount,
    invokeTool: evidence.invokeTool }, null, 2));
  process.exit(1);
}

console.log(`V0  Chrome ${version.raw} (major ${evidence.chromeMajor})  ${evidence.flag}  headless=${evidence.headless}`);
console.log(`    origin              ${evidence.origin}`);
console.log(`    documentPresent     ${evidence.documentPresent}   (typeof ${JSON.parse(evidence.rawTypeof).document})`);
console.log(`    navigatorAlias      ${evidence.navigatorAlias}   (typeof ${JSON.parse(evidence.rawTypeof).navigator})`);
console.log(`    toolCount           ${evidence.toolCount}   (un-awaited .length reads ${evidence.unAwaitedGetToolsLength})`);
console.log(`    cdpDomainEnabled    ${evidence.cdpDomainEnabled}   RECORDED, NEVER ASSERTED ON — reads ${evidence.negativeControl.cdpDomainEnabled} with no flag and no page API`);
console.log(`    invokeToolRoundTrip ${evidence.invokeToolRoundTrip}   ${evidence.invokeTool?.toolName} -> toolResponded status ${evidence.invokeTool?.status}`);
console.log(`    negative control    documentPresent=${evidence.negativeControl.documentPresent} with no flag`);
console.log(`    VERDICT             ${evidence.verdict}`);
console.log(`    wrote               ${OUT}`);
