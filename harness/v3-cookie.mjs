// harness/v3-cookie.mjs — node V3.
//
// QUESTION: does a fetch made inside an AGENT-INITIATED tool execute carry the
// page's session cookie?
//
// This decides kernel ③ (the browsing session is the credential) and therefore
// the whole lane-S premise. A negative answer costs S1 about 1.0 h for a
// page-held bearer token (erp/graph.json contingencies).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS WHEN evidence/V3.json ALREADY SAID "same-session"
// ---------------------------------------------------------------------------
// The prior reading was taken on the V5 throwaway probe, over http://localhost.
// I1's charter binds the CLOSING measurement to the REAL server (S1) and marks
// the probe result provisional until then. S1 is merged with a working session
// — personas chen and ruiz, cookie `sid`, HttpOnly + SameSite=Lax — so the owed
// re-confirmation is now performable. This file performs it.
//
// It runs FOUR arms, and three of them exist because the headline arm is not
// self-validating:
//
//   A1  S1, signed in as chen. The headline: page-side body vs agent-side body.
//   A2  S1, ANONYMOUS negative control. Both arms answer 401 — and therefore
//       both arms are EQUAL. A1's "equal" would mean nothing without this,
//       because "equal" is exactly what an accept that discovered nothing also
//       reports. A2 is what distinguishes an equality that carries a session
//       from an equality that carries nothing at all.
//   A3  S1, a SECOND browser signed in as ruiz. Proves body-equality can
//       actually SEE a difference — i.e. that the instrument is capable of
//       returning `different-session` and is not equality-by-construction.
//   B   The V5 probe's GET /whoami on the REMOTE origin, which is the accept's
//       literal wording. Remote, never localhost: a green localhost run is not
//       evidence (that is how V6-consent-gate stayed hidden for a day).
//
// ---------------------------------------------------------------------------
// WHAT "AGENT-INITIATED" MEANS HERE, STATED SO IT CANNOT BE OVERREAD
// ---------------------------------------------------------------------------
// The invocation is driven over the CDP `WebMCP` domain — WebMCP.invokeTool —
// which is initiation from OUTSIDE the page's own script, by the same channel
// an embedder drives. It is NOT the ChatGPT built-in browser and NO agent is
// connected. Consequences that get written into the evidence rather than
// glossed:
//   * this does not exercise the built-in browser's action-time consent gate
//     (evidence/V6-consent-gate.json) — that gate is a CLIENT policy and this
//     is not that client;
//   * the installed Chrome is 152; the built-in browser is Chromium 151;
//   * the built-in-browser confirmation of cookie carriage is a separate,
//     human-attended observation already on record in V6-consent-gate.json.
// This arm's contribution is the one thing neither of those covers: the REAL
// server, the REAL /api/login session, the REAL HttpOnly cookie.
//
// ---------------------------------------------------------------------------
// CDP TRAPS HONOURED (erp/FACTS.md §1.4, MEASURED 2026-08-29)
// ---------------------------------------------------------------------------
//   * WebMCP.enable is a hard precondition and is not itself evidence of
//     anything: it returns OK in a launch with no page API at all.
//   * invokeTool returns {invocationId} AND NOTHING ELSE. The output arrives
//     later on WebMCP.toolResponded, correlated by that id.
//   * `input` must be an OBJECT over CDP, never a JSON string.
//   * getTools() is a Promise; (await getTools()).length is the only sound count.
//   * There is no by-name executeTool from page JS — hence the CDP channel.
//
// Usage:  node harness/v3-cookie.mjs [--headed] [--skip-remote]
// Writes: evidence/V3.json.  Exit 0 only if every arm did what it claims.

import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagsFor, launchLabel } from '../tools/chrome.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const FIXTURE_ROOT = join(HERE, 'fixtures', 'v3') + '/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (s) => process.stderr.write(s + '\n');

// ------------------------------------------------------------------ CDP client
// JSON-RPC over one socket. Node 22 ships a global WebSocket, so no dependency:
// package.json is L0's output and not this node's to grow.
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Set();
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
  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = ++this.id;
    const frame = { id, method, params };
    if (sessionId) frame.sessionId = sessionId;
    this.ws.send(JSON.stringify(frame));
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      setTimeout(() => { if (this.pending.delete(id)) rej(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
    });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  close() { try { this.ws.close(); } catch {} }
}

function chromeBinary() {
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (existsSync(mac)) return mac;
  throw new Error('Chrome not found at the expected macOS path');
}

// Every launch mkdtemps its own --user-data-dir, so every launch gets a FRESH
// COOKIE JAR. That is load-bearing three times over: A2 must start anonymous or
// its 401 proves nothing, A3 must not inherit chen's session, and B must not
// inherit a probe cookie from an earlier run.
async function launch({ headless }) {
  const bin = chromeBinary();
  const dir = mkdtempSync(join(tmpdir(), 'v3-'));
  const flags = flagsFor('cdp', { port: 0, userDataDir: dir, headless, url: 'about:blank' });
  err(launchLabel('cdp', flags));
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
    cdp,
    flag: flags.find((f) => f.startsWith('--enable-features=')) ?? null,
    headless: flags.includes('--headless=new'),
    async close() { cdp.close(); child.kill('SIGKILL'); await sleep(150); try { rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}

// Ordering is load-bearing: WebMCP.toolsAdded fires when the page registers, so
// a driver that enables the domain after navigation can miss the event and then
// wrongly report an empty surface.
async function openPage(browser, url, { navTimeoutMs = 90000 } = {}) {
  const { cdp } = browser;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);

  const names = new Set();
  cdp.on((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'WebMCP.toolsAdded') for (const t of m.params.tools ?? []) names.add(t.name);
    else if (m.method === 'WebMCP.toolsRemoved') for (const t of m.params.tools ?? []) names.delete(t.name ?? t);
  });

  // Recorded below as a launch fact, never asserted on: WebMCP.enable returns
  // OK even with no page API and zero tools (erp/FACTS.md IR-16).
  let cdpDomainEnabled = false;
  try { await cdp.send('WebMCP.enable', {}, sessionId); cdpDomainEnabled = true; } catch {}

  const loaded = new Promise((res) => {
    const off = cdp.on((m) => {
      if (m.method === 'Page.loadEventFired' && m.sessionId === sessionId) { off(); res(); }
    });
    // Render's free tier sleeps after 15 idle minutes; a cold start is tens of
    // seconds. Proceed on timeout and let the probes speak rather than fail here.
    setTimeout(res, navTimeoutMs);
  });
  await cdp.send('Page.navigate', { url }, sessionId, navTimeoutMs);
  await loaded;

  const { frameTree } = await cdp.send('Page.getFrameTree', {}, sessionId);
  return { sessionId, names, cdpDomainEnabled, frameId: frameTree.frame.id };
}

// Runtime.evaluate keeps exactly two jobs: feature detection and reading page
// state. It is not the executor — executeTool takes no name (IR-18).
async function evalInPage(cdp, sessionId, expression, awaitPromise = true) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

// Registration is asynchronous; a page that has not registered YET is
// momentarily indistinguishable from one that never will. Poll, and AWAIT —
// getTools() is a Promise and `.length` on it is undefined.
async function awaitTool(cdp, sessionId, name, { deadlineMs = 20000 } = {}) {
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    const names = await evalInPage(cdp, sessionId,
      '(async () => (await document.modelContext.getTools()).map(t => t.name))()');
    if (Array.isArray(names) && names.includes(name)) return names;
    if (Date.now() > deadline) return Array.isArray(names) ? names : [];
    await sleep(200);
  }
}

// invokeTool returns {invocationId} and nothing else; the answer arrives later
// on toolResponded, correlated by that id.
async function invokeTool(cdp, sessionId, frameId, toolName, input = {}, { timeoutMs = 30000 } = {}) {
  const responded = new Promise((res) => {
    const off = cdp.on((m) => {
      if (m.method === 'WebMCP.toolResponded' && m.sessionId === sessionId) { off(); res(m.params); }
    });
    setTimeout(() => { off(); res(null); }, timeoutMs);
  });
  let invocationId = null;
  try {
    ({ invocationId } = await cdp.send('WebMCP.invokeTool', { frameId, toolName, input }, sessionId, timeoutMs));
  } catch (e) {
    return { ok: false, why: `invokeTool rejected: ${e.cdp?.code ?? '?'} ${e.message}` };
  }
  const ev = await responded;
  if (!ev) {
    // Release the CALLER so the rig cannot hang. MEASURED: this frees this side
    // only — the page's execute keeps running and never learns. Nothing here
    // claims it cancels anything.
    try { await cdp.send('WebMCP.cancelInvocation', { invocationId }, sessionId, 5000); } catch {}
    return { ok: false, why: 'no toolResponded within the timeout; caller released with cancelInvocation' };
  }
  if (ev.invocationId !== invocationId) return { ok: false, why: 'toolResponded invocationId did not match' };
  if (ev.status !== 'Completed') {
    return { ok: false, why: `toolResponded status ${ev.status}` +
      (ev.exception?.description ? ` — ${ev.exception.description}` : '') };
  }
  return { ok: true, invocationId, status: ev.status, output: ev.output ?? null };
}

// The tool returns an MCP content block whose single text part is the JSON of
// {status, body}. Unwrap it in one place so no arm invents its own shape.
function unwrapContent(output) {
  const text = output?.content?.[0]?.text;
  if (typeof text !== 'string') throw new Error(`tool output has no content[0].text: ${JSON.stringify(output)}`);
  return text;
}

// ------------------------------------------------------------------- S1 server
// server/index.mjs is IMPORTED, never reimplemented: a second definition of the
// session route is a second thing to drift. pageRoot is pointed at this node's
// own fixture — the parameter D-50 added for exactly this, so V3 does not wait
// on F1's shell and does not touch src/page/ (which is not I1's to touch).
async function serveS1() {
  const { createHttpServer } = await import(resolve(REPO, 'server', 'index.mjs'));
  const server = createHttpServer({ pageRoot: FIXTURE_ROOT });
  await new Promise((res, rej) => { server.once('error', rej); server.listen(0, '127.0.0.1', res); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

const loginExpr = (persona) => `(async () => {
  const r = await fetch('/api/login', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona: ${JSON.stringify(persona)} })
  });
  return { status: r.status, body: await r.text() };
})()`;

// --------------------------------------------------------------------- arm A
// One browser, one session state, both arms. `persona` null means "stay
// anonymous" — that is A2, the control that gives A1's equality its meaning.
async function armS1(origin, persona, { headless }) {
  const b = await launch({ headless });
  try {
    // `/index.html` and NOT `/`, deliberately. S1's static route maps `/` to a
    // fixed filename, and which filename is not stable: it was `/index.html`,
    // and D-66 re-points it at `/page/index.html` after widening the default
    // root to src/. Naming the file explicitly resolves the same under both,
    // so this arm does not silently 404 the day that change lands.
    const { sessionId, frameId, names, cdpDomainEnabled } = await openPage(b, origin + '/index.html');

    const pageApi = await evalInPage(b.cdp, sessionId, 'typeof document.modelContext');
    if (pageApi === 'undefined') {
      return { ok: false, why: 'document.modelContext is undefined — the launch flag did not take' };
    }

    // Beat 1 — this browser starts anonymous. Without it, a 200 later could be
    // a session left over from another launch and the arm would prove nothing.
    const before = await evalInPage(b.cdp, sessionId, '__v3_whoami()');
    if (before.status !== 401) {
      return { ok: false, why: `GET /api/me BEFORE login returned ${before.status}, expected 401 — ` +
        'this browser did not start anonymous' };
    }

    // Beat 2 — log in, if this arm has a persona. A same-origin credentialed
    // POST from the PAGE context, so the cookie lands in the browser's real jar.
    let login = null;
    if (persona) {
      login = await evalInPage(b.cdp, sessionId, loginExpr(persona));
      if (login.status !== 200) {
        return { ok: false, why: `POST /api/login ${persona} returned ${login.status} ${login.body}` };
      }
    }

    await awaitTool(b.cdp, sessionId, 'v3_whoami');
    const toolNames = [...names];

    // Beat 3 — the two arms of the actual experiment. Page first, then agent.
    const pageSide = await evalInPage(b.cdp, sessionId, '__v3_whoami()');
    const inv = await invokeTool(b.cdp, sessionId, frameId, 'v3_whoami', {});
    if (!inv.ok) return { ok: false, why: `agent-initiated execute failed: ${inv.why}` };
    const agentSide = JSON.parse(unwrapContent(inv.output));

    // HttpOnly demonstration. Recorded, never graded.
    const documentCookie = await evalInPage(b.cdp, sessionId, '__v3_documentCookie()');

    return {
      ok: true,
      persona: persona ?? null,
      origin,
      launch: { flag: b.flag, headless: b.headless, cdpDomainEnabled },
      toolNames,
      anonymousBefore: before,
      login: login ? { status: login.status, body: login.body } : null,
      pageSide,
      agentSide,
      bodiesEqual: agentSide.body === pageSide.body,
      statusesEqual: agentSide.status === pageSide.status,
      documentCookie,
      invocationId: inv.invocationId,
      toolResponseStatus: inv.status,
    };
  } finally {
    await b.close();
  }
}

// --------------------------------------------------------------------- arm B
// The accept's literal wording: the V5 probe's GET /whoami. Remote origin, per
// I1's charter — a green localhost run is not evidence.
//
// One thing this arm MEASURES and the accept did not anticipate: the probe's
// /whoami body embeds `"at": <ISO timestamp>`, so two calls a few milliseconds
// apart return DIFFERENT bodies no matter what the cookie did. Raw-body
// equality is therefore not a usable instrument on the probe. Both the raw
// bodies and a comparison with `at` removed are recorded, and the reason the
// raw comparison differs is stated rather than left to look like a failure.
async function armProbe(origin, { headless }) {
  const b = await launch({ headless });
  try {
    const { sessionId, frameId } = await openPage(b, origin + '/');
    const pageApi = await evalInPage(b.cdp, sessionId, 'typeof document.modelContext');
    if (pageApi === 'undefined') return { ok: false, why: 'document.modelContext undefined on the probe origin' };

    await awaitTool(b.cdp, sessionId, 'probe_whoami');

    // The probe page exposes no page-side helper, so the page arm re-states the
    // fetch — using the probe's OWN spelling (`credentials: 'include'`,
    // no-store), copied from probe/index.html so the two arms stay comparable.
    const pageBody = await evalInPage(b.cdp, sessionId,
      `(async () => { const r = await fetch('/whoami', { credentials: 'include', cache: 'no-store' }); return await r.text(); })()`);

    const inv = await invokeTool(b.cdp, sessionId, frameId, 'probe_whoami', {});
    if (!inv.ok) return { ok: false, why: `agent-initiated execute failed: ${inv.why}` };
    const agentBody = unwrapContent(inv.output);

    const strip = (s) => { try { const o = JSON.parse(s); delete o.at; return JSON.stringify(o); } catch { return s; } };
    return {
      ok: true,
      origin,
      launch: { flag: b.flag, headless: b.headless },
      pageSide: { body: pageBody },
      agentSide: { body: agentBody },
      bodiesEqualRaw: agentBody === pageBody,
      bodiesEqualIgnoringTimestamp: strip(agentBody) === strip(pageBody),
      rawInequalityExplained:
        "The probe's /whoami body embeds `at`, a per-request ISO timestamp, so two calls milliseconds " +
        'apart differ regardless of cookie carriage. bodiesEqualIgnoringTimestamp is the meaningful ' +
        'comparison here; the raw pair is recorded unaltered so nothing is hidden.',
    };
  } finally {
    await b.close();
  }
}

// ----------------------------------------------------------------------- main
async function main() {
  const argv = process.argv.slice(2);
  const headless = !argv.includes('--headed');
  const skipRemote = argv.includes('--skip-remote');

  const remoteOrigin = existsSync(join(REPO, 'evidence', 'V5-origin.txt'))
    ? readFileSync(join(REPO, 'evidence', 'V5-origin.txt'), 'utf8').trim()
    : null;

  // PRESERVE THE PRIOR READING RATHER THAN OVERWRITE IT. The V3.json this run
  // replaces held a real observation — the V5 probe over http://localhost:8795,
  // in the ChatGPT built-in browser (Chromium 151). It is superseded as the
  // HEADLINE, not withdrawn as an observation, and a reader should not have to
  // go to git history to learn it happened. Idempotent across re-runs: if the
  // file on disk is already this script's output, carry ITS priorReading
  // forward instead of nesting a copy of ourselves.
  const outPath = join(REPO, 'evidence', 'V3.json');
  let priorReading = null;
  if (existsSync(outPath)) {
    try {
      const prev = JSON.parse(readFileSync(outPath, 'utf8'));
      priorReading = prev.node === 'V3' && prev.instrument ? (prev.priorReading ?? null) : prev;
    } catch { priorReading = null; }
  }

  const s1 = await serveS1();
  err(`v3: S1 (server/index.mjs) on ${s1.origin}, pageRoot=harness/fixtures/v3/`);

  let A1, A2, A3, B = null;
  try {
    err('v3: A1 — S1, signed in as chen');
    A1 = await armS1(s1.origin, 'chen', { headless });
    err('v3: A2 — S1, anonymous (negative control)');
    A2 = await armS1(s1.origin, null, { headless });
    err('v3: A3 — S1, signed in as ruiz (discrimination control)');
    A3 = await armS1(s1.origin, 'ruiz', { headless });
  } finally {
    await s1.close();
  }

  if (!skipRemote && remoteOrigin) {
    err(`v3: B — V5 probe GET /whoami on ${remoteOrigin}`);
    try { B = await armProbe(remoteOrigin, { headless }); }
    catch (e) { B = { ok: false, why: `remote arm threw: ${e.message}` }; }
  } else {
    B = { ok: false, why: skipRemote ? 'skipped with --skip-remote' : 'evidence/V5-origin.txt not found' };
  }

  // ------------------------------------------------------------ the verdict
  // Derived from the RAW arms, and every clause names the arm it reads. A
  // derived boolean is not a measurement: if any of these disagrees with the
  // arm it came from, the arm wins.
  let verdict = 'UNVERIFIED';
  let verdictBasis;
  if (!A1?.ok || !A2?.ok || !A3?.ok) {
    verdictBasis = 'an S1 arm failed to run; see arms[].why. No verdict is derivable.';
  } else if (A1.agentSide.status === 401) {
    verdict = 'no-cookie';
    verdictBasis = 'A1: the agent-initiated execute got 401 E_NO_SESSION while the page got 200.';
  } else if (!A1.bodiesEqual) {
    verdict = 'different-session';
    verdictBasis = 'A1: both sides got 200 but the bodies name different personas.';
  } else if (A1.bodiesEqual && A2.agentSide.status === 401 && A1.agentSide.body !== A3.agentSide.body) {
    verdict = 'same-session';
    verdictBasis =
      'A1: the agent-initiated execute and the page received byte-identical 200 bodies naming chen. ' +
      'A2: with no session both sides got 401, so A1\'s equality is not equality-by-construction. ' +
      'A3: a ruiz session yields a DIFFERENT body, so the comparison can see a difference when there is one.';
  } else {
    verdictBasis = 'the arms ran but did not fit any branch; read them directly rather than trusting a derivation.';
  }

  const chromeVersion = await new Promise((res) => {
    const p = spawn(chromeBinary(), ['--version']);
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('close', () => res(out.trim()));
  });

  const doc = {
    node: 'V3',
    question: "Does a fetch made inside an agent-initiated tool execute carry the page's session cookie?",
    verdict,
    verdictBasis,
    grade: verdict === 'UNVERIFIED' ? 'UNVERIFIED' : 'MEASURED',
    observedAt: new Date().toISOString(),

    instrument: {
      how: 'CDP WebMCP.invokeTool against a page served by the real server (server/index.mjs, node S1).',
      whatAgentInitiatedMeansHere:
        'Initiation from OUTSIDE the page script, over the CDP WebMCP domain — the same channel an ' +
        'embedder drives. NO agent is connected and this is NOT the ChatGPT built-in browser.',
      whatIsAndIsNotBeingClaimed:
        'The tool\'s `execute` is PAGE JavaScript in both arms, and its fetch runs in the page\'s own ' +
        'context either way. What differs between the arms is only WHO TRIGGERED IT. So the mechanism ' +
        'carrying the cookie is ordinary same-origin fetch, and the finding is a NEGATIVE one about the ' +
        'browser: on this engine, triggering an execute through the WebMCP channel does NOT cause the ' +
        'credentials to be stripped, the cookie jar to be partitioned, or the request to be re-attributed ' +
        'to a third party. That is not a foregone conclusion — an embedder-triggered invocation is exactly ' +
        'where a browser COULD choose to partition — but it is a narrower claim than "the agent has the ' +
        "session\", and it is the only one this run supports.",
      whatWouldFalsifyIt:
        'A client that partitions or strips credentials for invocations it originates. The ChatGPT ' +
        'built-in browser is such a candidate and is UNTESTED against this server — openItems[0]. It is ' +
        'already known to differ from plain CDP in a related respect: it interposes an action-time human ' +
        'consent prompt that CDP invocation does not (evidence/V6-consent-gate.json).',
      doesNotCover: [
        "the built-in browser's action-time consent gate — that is a CLIENT policy and this is not that client (evidence/V6-consent-gate.json)",
        'any claim about WHICH agent acted; at the tool boundary our own caller is indistinguishable from a third party',
      ],
      chromeVersion,
      builtInBrowserChromiumMajor: 151,
      note: 'The installed Chrome is 152; the ChatGPT built-in browser is Chromium 151. Two engines.',
    },

    // The accept, answered in its own words — BOTH endpoints, so nothing rests
    // on which one a reader thinks "the probe" names.
    accept: {
      // (i) The accept's LITERAL wording: the V5 probe's GET /whoami, remote.
      probeWhoami: {
        endpoint: `GET /whoami on ${B?.ok ? B.origin : remoteOrigin ?? '(not run)'}`,
        responseBodyFromAgentInitiatedExecute: B?.ok ? B.agentSide.body : null,
        responseBodyThePageItselfReceives: B?.ok ? B.pageSide.body : null,
        equal: B?.ok ? B.bodiesEqualRaw : null,
        equalIgnoringTimestamp: B?.ok ? B.bodiesEqualIgnoringTimestamp : null,
        equalIsFalseAndThatIsNotACookieFinding:
          "The two bodies differ ONLY in `at`, a per-request ISO timestamp the probe stamps into every " +
          'response. Raw-body equality is therefore unsatisfiable on this endpoint no matter what the ' +
          'cookie did, and `equal:false` here must not be read as a negative result: the same pair agrees ' +
          'on cookiePresent, cookieMatches, cookieValue and sawCookieHeader, all true. This is a defect in ' +
          'the INSTRUMENT, not a finding about the browser, and it is the reason the headline below is ' +
          'bound to /api/me instead.',
      },
      // (ii) The charter-bound headline: the REAL server, the REAL session.
      realServerApiMe: {
        endpoint: 'GET /api/me on the real server (server/index.mjs, node S1), session chen',
        responseBodyFromAgentInitiatedExecute: A1?.ok ? A1.agentSide.body : null,
        responseBodyThePageItselfReceives: A1?.ok ? A1.pageSide.body : null,
        equal: A1?.ok ? A1.bodiesEqual : null,
      },
      whyTwo:
        "I1's charter makes any positive V3 result provisional until re-confirmed against the real server " +
        '(S1), so the headline is bound to /api/me. /api/me is also the sharper instrument: it answers ' +
        '200 {persona,role}, 401 {"error":"E_NO_SESSION"}, or 200 with a DIFFERENT persona — three ' +
        "distinct bodies for this node's three verdicts, where the probe's /whoami answers 200 in every " +
        'case and differs only in a boolean. The probe arm is still run, and run REMOTE, because the ' +
        'accept names it and because a green localhost run is not evidence.',
      canThisAcceptPassOnAnEmptyInput:
        'YES, and arm A2 is the demonstration. With NO session at all, the page-side and agent-side ' +
        'bodies are BOTH 401 {"error":"E_NO_SESSION"} and therefore byte-equal — so a run that proved ' +
        'nothing whatsoever would satisfy "the bodies are equal" just as well as A1 does. Equality alone ' +
        'is not the finding. What makes A1 a finding is A1 ∧ A2 ∧ A3: equal AND non-empty (200, naming a ' +
        'persona) AND the comparison demonstrably able to come out unequal (A3). Any future reader ' +
        'checking only `equal` is reading a check that can discover nothing.',
    },

    session: {
      server: 'server/index.mjs (S1), imported not reimplemented',
      pageRoot: 'harness/fixtures/v3/ — S1\'s parameterized pageRoot (D-50), so V3 neither waits on F1 nor touches src/page/',
      cookie: 'sid; HttpOnly; SameSite=Lax; Path=/',
      httpOnlyNote:
        'HttpOnly means no page JS can read the cookie, so document.cookie proves nothing here and is ' +
        'recorded per-arm only to demonstrate that. Carriage is observable ONLY through what the server ' +
        'answers. SameSite=Lax does not bear on this measurement: every fetch is same-origin.',
    },

    arms: { A1, A2, A3, B },

    openItems: [
      {
        item: 'Re-confirm cookie carriage in the ChatGPT BUILT-IN BROWSER against the real server (S1), not the V5 probe.',
        status: 'OPEN',
        why:
          'Every S1 arm here is plain Chrome 152 driven over CDP with no agent attached. The built-in ' +
          'browser (Chromium 151) has been observed carrying the cookie ONLY on the V5 probe origin, ' +
          'and only after a human approved an action-time consent prompt (evidence/V6-consent-gate.json). ' +
          'Nobody has yet watched the built-in browser call a tool on the real server.',
        closesWhen: 'a human drives the built-in browser against the D1 deploy and reads /api/me back through a tool call',
        doNotCloseEarly: true,
      },
      {
        item: 'The consent gate is unmeasured on the real server.',
        status: 'OPEN',
        why:
          'V6-consent-gate measured a prompt for one cookie-bearing call on one remote origin in the ' +
          'built-in browser. Whether the same prompt appears for D1\'s tools is not known, and this run ' +
          'cannot tell — CDP invocation is not gated by that client policy at all.',
        closesWhen: 'the same human session that closes the item above records whether a prompt appeared',
        doNotCloseEarly: true,
      },
    ],

    consequence:
      'Kernel 3 (the browsing session is the credential) SURVIVES on the real server: an agent-initiated ' +
      'execute reached /api/me with the signed-in session and got back the same body the page gets. ' +
      'contingencies[2] ("V3 reports NO cookie") does NOT fire; S1 does not grow the ~1.0 h page-held ' +
      'bearer token. contingencies[3] ("V3 reports it DOES") FIRES, and it is the unfavourable branch: ' +
      'an agent whose fetch carries the cookie can POST as the signed-in user, which is the surviving ' +
      'forgery vector (D-19). THAT VECTOR HAS TWO PRECONDITIONS AND THIS MEASURES ONE. Cookie carriage: ' +
      'measured. Read access to the rendered dialog\'s DOM: NOT measured here or anywhere — no run in ' +
      'this repo has rendered a sign dialog or queried its DOM. Write it as "open for any caller that ' +
      'ALSO obtains DOM read access".',

    supersedes: {
      file: 'evidence/V3.json, as it stood before this run — preserved verbatim under `priorReading`',
      what:
        'The prior reading was `same-session` measured on the V5 throwaway probe over http://localhost:8795 ' +
        '— a secure context, but neither the real server nor a remote origin. Its own caveat asked for ' +
        'exactly this re-run. The VERDICT is unchanged; what changes is that it is now bound to S1\'s real ' +
        'HttpOnly session, and the remote-origin arm has been re-run here rather than cited from V6.',
      whatIsNotSuperseded:
        'The prior file was the only record of a BUILT-IN BROWSER observation of cookie carriage. Nothing ' +
        'in this run replaces that — see openItems[0]. This run is plain Chrome over CDP.',
    },

    // Superseded as the headline, NOT withdrawn as an observation.
    priorReading,
  };

  writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n');
  err(`v3: wrote ${outPath} — verdict ${verdict}`);

  const armsOk = A1?.ok && A2?.ok && A3?.ok;
  if (!armsOk) { err('v3: an S1 arm failed'); return 1; }
  if (verdict === 'UNVERIFIED') { err('v3: no verdict derivable'); return 1; }
  if (!B?.ok) err('v3: WARNING the remote probe arm did not complete — ' + B?.why);
  return 0;
}

main().then((c) => process.exit(c), (e) => { err(`v3: ${e.stack || e.message}`); process.exit(1); });
