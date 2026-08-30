// harness/compare-runs.mjs — node V4's comparator, and a declared output of it.
//
//   node harness/compare-runs.mjs evidence/V4-run1.json evidence/V4-run2.json --tolerance 0.20
//   node harness/compare-runs.mjs --selftest
//
// V4 asks how long a client will hold open an `execute()` that never resolves.
// That number sets the maximum time the human sign gate (S5) may keep a call
// suspended. The node deliberately refuses to trust a single reading: two
// independent runs must agree within 20 percent, or the node fails.
//
// ---------------------------------------------------------------------------
// WHAT THIS FILE REFUSES TO DO, AND WHY THAT IS THE POINT
// ---------------------------------------------------------------------------
// A comparator is a gate, and a gate that cannot fail is decoration. Three ways
// this one could have passed while discovering nothing, each blocked explicitly:
//
//   1. MISSING OBSERVATIONS COMPARING EQUAL. If a run file has no observation
//      field, `undefined === undefined` is true and two empty files would
//      "agree" perfectly. Every run file must carry a well-formed observation
//      or this exits 1 before any comparison happens.
//
//   2. UNLIKE CLIENTS COMPARED AS IF THEY WERE REPLICATES. The quantity being
//      measured is a property OF A CLIENT, not of the web platform: run 1 of
//      V4 recorded the ChatGPT built-in browser giving up after 22.267 s with
//      the raw error `Timed out running CDP command "Runtime.evaluate" for
//      tab 1` — that client's own CDP-wrapper timeout. A run taken against a
//      different client measures a different quantity, and agreeing or
//      disagreeing with it is equally meaningless. So the two runs must name
//      the SAME client, and a mismatch exits 1 with its own distinct message —
//      never silently folded into "they disagreed by more than 20 percent",
//      which would report a measurement dispute where there is none.
//
//   3. A `no-timeout` RUN QUIETLY AVERAGING WITH A NUMERIC ONE. "The client
//      never gave up within the window" is not a large number; it is a
//      different KIND of answer. One of each is a total disagreement about
//      whether a timeout exists at all, and is failed as such.
//
// ---------------------------------------------------------------------------
// RUN FILE SHAPE
// ---------------------------------------------------------------------------
//   {
//     "run": 1,
//     "client": "<free text, but the two runs must MATCH>",
//     "origin": "<url>",
//     "observation": { "timedOut": true,  "seconds": 22.267 }
//               ... or { "timedOut": false, "literal": "no-timeout-at-300s" },
//     ...anything else the run wants to carry
//   }
//
// The accept's phrase "or the literal 'no-timeout-at-300s'" is honoured
// exactly: that string, not a sentinel number, not a null.

import { readFileSync, writeFileSync, existsSync, mkdtempSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (s) => process.stdout.write(s + '\n');
const say = (s) => process.stderr.write(s + '\n');

const NO_TIMEOUT = 'no-timeout-at-300s';

// ---------------------------------------------------------------- parse a run
// Returns { ok, kind: 'seconds'|'no-timeout', seconds?, client, origin } or
// { ok:false, why }. Every rejection names the file, because "one of them is
// malformed" is not an actionable message at 2am.
function readRun(path) {
  if (!existsSync(path)) return { ok: false, why: `${path}: no such file` };
  let doc;
  try { doc = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { return { ok: false, why: `${path}: not valid JSON — ${e.message}` }; }

  const o = doc.observation;
  if (o === undefined || o === null || typeof o !== 'object') {
    return { ok: false, why: `${path}: no \`observation\` object. A run file without an observation ` +
      'is not a run; two of them would compare equal and pass a gate that discovered nothing.' };
  }
  if (typeof doc.client !== 'string' || doc.client.trim() === '') {
    return { ok: false, why: `${path}: no \`client\`. The quantity measured is a property of a client, ` +
      'so a run that does not name one cannot be compared with anything.' };
  }

  if (o.timedOut === false) {
    if (o.literal !== NO_TIMEOUT) {
      return { ok: false, why: `${path}: observation.timedOut is false but observation.literal is ` +
        `${JSON.stringify(o.literal)}; V4's accept names the literal ${JSON.stringify(NO_TIMEOUT)}.` };
    }
    return { ok: true, kind: 'no-timeout', client: doc.client, origin: doc.origin ?? null, doc };
  }
  if (o.timedOut === true) {
    if (typeof o.seconds !== 'number' || !Number.isFinite(o.seconds) || o.seconds <= 0) {
      return { ok: false, why: `${path}: observation.timedOut is true but observation.seconds is ` +
        `${JSON.stringify(o.seconds)}; a positive finite number is required.` };
    }
    return { ok: true, kind: 'seconds', seconds: o.seconds, client: doc.client, origin: doc.origin ?? null, doc };
  }
  return { ok: false, why: `${path}: observation.timedOut must be true or false, got ${JSON.stringify(o.timedOut)}.` };
}

// ------------------------------------------------------------------- compare
// Relative difference is taken against the SMALLER value. That is the strict
// choice — 100 vs 125 is 25% here and 20% against the larger — and a gate whose
// job is to withhold trust should round toward withholding it. Both denominators
// are printed so a reader can see whether a pair sits near that boundary rather
// than having to recompute it.
function compare(a, b, tolerance) {
  if (a.client !== b.client) {
    return { pass: false, reason: 'client-mismatch',
      detail: `run1 client ${JSON.stringify(a.client)} != run2 client ${JSON.stringify(b.client)}. ` +
        'These runs measure different quantities, so neither their agreement nor their disagreement ' +
        'means anything. This is NOT a 20-percent disagreement and must not be recorded as one.' };
  }
  if (a.kind === 'no-timeout' && b.kind === 'no-timeout') {
    return { pass: true, reason: 'both-no-timeout',
      detail: `both runs report the literal ${NO_TIMEOUT}: this client did not abandon a suspended ` +
        'execute inside the window, twice.' };
  }
  if (a.kind !== b.kind) {
    const n = a.kind === 'seconds' ? a : b;
    const t = a.kind === 'no-timeout' ? 'run1' : 'run2';
    return { pass: false, reason: 'kind-mismatch',
      detail: `one run timed out at ${n.seconds}s and the other (${t}) reported ${NO_TIMEOUT}. ` +
        'That is a disagreement about whether a timeout exists at all — the widest possible ' +
        'disagreement, not a near miss.' };
  }
  const lo = Math.min(a.seconds, b.seconds);
  const hi = Math.max(a.seconds, b.seconds);
  const diff = hi - lo;
  const relToSmaller = diff / lo;
  const relToLarger = diff / hi;
  return {
    pass: relToSmaller <= tolerance,
    reason: relToSmaller <= tolerance ? 'within-tolerance' : 'over-tolerance',
    seconds: [a.seconds, b.seconds], diff, relToSmaller, relToLarger, tolerance,
    detail: `${a.seconds}s vs ${b.seconds}s — difference ${diff.toFixed(3)}s, ` +
      `${(relToSmaller * 100).toFixed(1)}% of the smaller (${(relToLarger * 100).toFixed(1)}% of the larger); ` +
      `tolerance ${(tolerance * 100).toFixed(0)}% measured against the smaller.`,
  };
}

// ------------------------------------------------------------------ selftest
// The comparator is a gate, so its ability to FAIL is the property worth
// proving. A green node is not evidence that its output runs; this is how this
// one demonstrates that it does, and that each refusal above actually fires.
function selftest() {
  const R = (client, kind, seconds) => kind === 'no-timeout'
    ? { ok: true, kind, client, doc: {} }
    : { ok: true, kind: 'seconds', seconds, client, doc: {} };
  const cases = [
    ['equal readings pass',            R('X', 's', 22.0), R('X', 's', 22.0), 0.20, true,  'within-tolerance'],
    ['19% apart passes',               R('X', 's', 20.0), R('X', 's', 23.8), 0.20, true,  'within-tolerance'],
    ['21% apart fails',                R('X', 's', 20.0), R('X', 's', 24.2), 0.20, false, 'over-tolerance'],
    ['both no-timeout pass',           R('X', 'no-timeout'), R('X', 'no-timeout'), 0.20, true,  'both-no-timeout'],
    ['no-timeout vs numeric fails',    R('X', 'no-timeout'), R('X', 's', 22.0), 0.20, false, 'kind-mismatch'],
    ['different clients never compare',R('A', 's', 22.0), R('B', 's', 22.0), 0.20, false, 'client-mismatch'],
    ['identical but unlike clients',   R('A', 'no-timeout'), R('B', 'no-timeout'), 0.20, false, 'client-mismatch'],
  ];
  let bad = 0;
  for (const [name, a, b, tol, wantPass, wantReason] of cases) {
    const r = compare(a, b, tol);
    const good = r.pass === wantPass && r.reason === wantReason;
    if (!good) bad++;
    out(`${good ? 'ok  ' : 'FAIL'}  ${name}  -> pass=${r.pass} reason=${r.reason}`);
  }
  // Malformed inputs must be rejected by readRun, not silently compared.
  // Scratch files go to the OS temp dir, never into evidence/: a selftest that
  // writes into the evidence directory can leave a stray file behind that a
  // later reader mistakes for a measurement.
  const tmp = mkdtempSync(join(tmpdir(), 'compare-runs-selftest-'));
  const probes = [
    ['missing observation', JSON.stringify({ client: 'X' })],
    ['missing client',      JSON.stringify({ observation: { timedOut: true, seconds: 1 } })],
    ['bad literal',         JSON.stringify({ client: 'X', observation: { timedOut: false, literal: 'nope' } })],
    ['non-positive seconds',JSON.stringify({ client: 'X', observation: { timedOut: true, seconds: 0 } })],
  ];
  for (const [name, body] of probes) {
    const p = join(tmp, 'run.json');
    writeFileSync(p, body);
    const r = readRun(p);
    const good = r.ok === false;
    if (!good) bad++;
    out(`${good ? 'ok  ' : 'FAIL'}  rejects ${name}`);
    unlinkSync(p);
  }
  rmSync(tmp, { recursive: true, force: true });
  out(bad === 0 ? 'selftest: all green' : `selftest: ${bad} failure(s)`);
  return bad === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------- main
function main(argv) {
  if (argv.includes('--selftest')) return selftest();

  const files = argv.filter((a) => !a.startsWith('--'));
  const ti = argv.indexOf('--tolerance');
  const tolerance = ti >= 0 ? Number(argv[ti + 1]) : 0.20;
  if (files.length !== 2 || !Number.isFinite(tolerance) || tolerance < 0) {
    say('usage: node harness/compare-runs.mjs <run1.json> <run2.json> [--tolerance 0.20]');
    say('       node harness/compare-runs.mjs --selftest');
    return 2;
  }

  const a = readRun(files[0]);
  const b = readRun(files[1]);
  for (const r of [a, b]) if (!r.ok) { say('compare-runs: ' + r.why); return 1; }

  const c = compare(a, b, tolerance);
  out(`run1: ${files[0]}`);
  out(`run2: ${files[1]}`);
  out(`client: ${a.client === b.client ? a.client : `${a.client}  vs  ${b.client}`}`);
  out(`result: ${c.reason} — ${c.detail}`);

  if (!c.pass) {
    say('');
    say(`compare-runs: FAIL (${c.reason}). evidence/V4.json NOT written; node V4 does not pass.`);
    if (c.reason === 'client-mismatch') {
      say('This is a refusal to compare unlike runs, not a measurement disagreement. Re-run the ' +
          'second measurement against the SAME client as run 1 before reading anything into it.');
    }
    return 1;
  }

  // Preserve rather than overwrite, exactly as V3 did: the V4.json being
  // replaced holds a real observation and its own careful caveats, and a reader
  // should not have to go to git history to learn it existed.
  const target = join(REPO, 'evidence', 'V4.json');
  let priorReading = null;
  if (existsSync(target)) {
    try {
      const prev = JSON.parse(readFileSync(target, 'utf8'));
      priorReading = prev.node === 'V4' && prev.comparison ? (prev.priorReading ?? null) : prev;
    } catch { priorReading = null; }
  }

  const doc = {
    node: 'V4',
    question: 'Does a suspended execute time out in the client, and after how long?',
    verdict: c.reason === 'both-no-timeout' ? 'no-timeout' : 'times-out',
    grade: 'MEASURED',
    client: a.client,
    seconds: c.reason === 'both-no-timeout' ? null : (a.seconds + b.seconds) / 2,
    literal: c.reason === 'both-no-timeout' ? NO_TIMEOUT : null,
    comparison: {
      tolerance,
      toleranceMeasuredAgainst: 'the smaller of the two readings — the strict choice',
      reason: c.reason,
      detail: c.detail,
      run1: { file: files[0], observation: a.doc.observation ?? null },
      run2: { file: files[1], observation: b.doc.observation ?? null },
    },
    writtenBy: 'harness/compare-runs.mjs',
    observedAt: new Date().toISOString(),
    priorReading,
  };
  writeFileSync(target, JSON.stringify(doc, null, 2) + '\n');
  out(`wrote ${target}`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
