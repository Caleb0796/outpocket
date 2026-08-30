// tools/ready.mjs — node G0, owner L1.
//
// The tool erp/graph.json is OPERATED with. Until this file is green, every claim in that
// graph that cites a checker is OUR-ESTIMATE and not MEASURED — including the cut invariant,
// whose own grade block says so in as many words.
//
//   node tools/ready.mjs                        the ready set, RANKED: critical path, then cut,
//                                               then day. Ranking exists because its absence
//                                               cost two dispatch errors in one session.
//   node tools/ready.mjs --owner <SEAT>         the same, filtered to one seat
//   node tools/ready.mjs --check-cuts           key(u) >= key(v) on every qualifying hard edge
//   node tools/ready.mjs --path                 longest hard-edge horizon-A path and its total
//   node tools/ready.mjs --check-accept-paths   every path named in any accept resolves
//   node tools/ready.mjs --check-freezes        interface_freezes[].unblocks are real edges
//   node tools/ready.mjs --check-ownership-globs  every output/accept path is ownable
//   node tools/ready.mjs --check-tables         restated tables in erp/**.md vs the authority
//   node tools/ready.mjs --check-schedule       day(u) <= day(v); no seat over the daily cap
//   node tools/ready.mjs --check-modes          every --flag in an accept is produced by something
//   node tools/ready.mjs --all                  every check above, exit 1 if any fails
//
// The ownership rule is NOT reimplemented here: it is imported from tools/check-ownership.mjs,
// which conventions.ownership_rule names as its one implementation.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { whoMayWrite } from './check-ownership.mjs';

const G = JSON.parse(fs.readFileSync('erp/graph.json', 'utf8'));
const NODES = new Map(G.nodes.map((n) => [n.id, n]));
const IDS = new Set(NODES.keys());
const HARD = G.edges.filter((e) => e.kind === 'hard');
const STATE_PATH = 'erp/graph.state.json';

const ok = (m) => console.log('  ok    ' + m);
const bad = (m) => console.log('  FAIL  ' + m);

// ---------------------------------------------------------------- ready set (default mode)

function readState() {
  if (!fs.existsSync(STATE_PATH)) return { done: [], in_flight: {} };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function readySet(ownerFilter = null) {
  const st = readState();
  const done = new Set(st.done || []);
  const inFlight = st.in_flight || {};
  const sched = dayOf();
  // THE RANK, and it exists because its absence cost two real errors in one
  // session. This mode printed cut and day and NEVER SORTED BY EITHER against
  // the critical path — so PM's own cut-0 node V6 sat READY AND UNSTARTED all
  // day while every other seat had work, and L1 dispatched I1 to V4 (cut 3, off
  // the path) while H3 (cut 0, ON it) queued behind it on the same seat. Neither
  // of us ever asked this tool to rank, because it never offered to.
  // Order: on the critical path first, then cut rank (0 is never cut), then day,
  // then id. --owner <SEAT> filters, because the tool also never knew who was
  // reading it.
  const onPath = new Set(G.capacity.graph_depth_path.split(' -> '));
  const rows = [];
  for (const n of G.nodes) {
    if (n.horizon !== 'A' || done.has(n.id)) continue;
    const blockers = HARD.filter((e) => e.to === n.id && !done.has(e.from)).map((e) => e.from);
    if (blockers.length) continue;
    if (ownerFilter && n.owner !== ownerFilter) continue;
    rows.push({ id: n.id, owner: n.owner, hours: n.hours, cut: n.cut, day: sched.get(n.id),
                path: onPath.has(n.id), flight: inFlight[n.id] || '' });
  }
  rows.sort((a, b) =>
    (Number(b.path) - Number(a.path)) ||
    ((a.cut === 0 ? -1 : a.cut) - (b.cut === 0 ? -1 : b.cut)) ||
    (a.day - b.day) || a.id.localeCompare(b.id));
  console.log(`state: ${STATE_PATH} — done ${[...done].join(',') || '(none)'}`);
  console.log('READY (hard edges satisfied, horizon A, not done):');
  for (const r of rows) {
    const tag = r.flight ? `  <- ${r.flight}` : '';
    const p = r.path ? ' **PATH**' : '        ';
    console.log(`  ${r.id.padEnd(4)} ${String(r.owner).padEnd(4)} ${String(r.hours).padStart(4)}h cut ${r.cut}  day ${r.day}${p}${tag}`);
  }
  const today = rows.filter((r) => !r.flight);
  console.log(`\n${rows.length} ready, ${rows.length - today.length} already dispatched, ${today.length} undispatched.`);
  return true;
}

// ---------------------------------------------------------------- --check-cuts
// conventions.cut_invariant: key(c) = Infinity when c is 0, else c. For every HARD edge u->v
// where u and v share a horizon: key(u) >= key(v). Cross-horizon edges are exempt by the
// rule's own text; soft edges are exempt because the consumer degrades gracefully.

const key = (c) => (c === 0 ? Infinity : c);

function checkCuts() {
  let qualifying = 0, violations = 0;
  for (const e of HARD) {
    const u = NODES.get(e.from), v = NODES.get(e.to);
    if (!u || !v) { bad(`edge ${e.from}->${e.to} names a node that does not exist`); violations++; continue; }
    if (u.horizon !== v.horizon) continue;
    qualifying++;
    if (!(key(u.cut) >= key(v.cut))) {
      bad(`${e.from}(cut ${u.cut}) -> ${e.to}(cut ${v.cut}): key ${key(u.cut)} < ${key(v.cut)} — ${e.to} would outlive the input it depends on`);
      violations++;
    }
  }
  console.log(`edges ${G.edges.length}, hard ${HARD.length}, qualifying (hard AND same-horizon) ${qualifying}, cross-horizon exempt ${HARD.length - qualifying}`);
  if (!violations) ok(`cut invariant holds on all ${qualifying} qualifying hard edges`);
  return violations === 0;
}

// ---------------------------------------------------------------- --path
// Longest hard-edge horizon-A path, weighted by node hours. Must total graph_depth_hours.

function longestPath() {
  const adj = new Map([...IDS].map((id) => [id, []]));
  for (const e of HARD) {
    const u = NODES.get(e.from), v = NODES.get(e.to);
    if (!u || !v || u.horizon !== 'A' || v.horizon !== 'A') continue;
    adj.get(e.from).push(e.to);
  }
  const memo = new Map();
  const visiting = new Set();
  function best(id) {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new Error(`cycle through ${id}`);
    visiting.add(id);
    let r = { total: NODES.get(id).hours, path: [id] };
    for (const nxt of adj.get(id)) {
      const s = best(nxt);
      if (NODES.get(id).hours + s.total > r.total) r = { total: NODES.get(id).hours + s.total, path: [id, ...s.path] };
    }
    visiting.delete(id);
    memo.set(id, r);
    return r;
  }
  let winner = null;
  for (const id of IDS) {
    if (NODES.get(id).horizon !== 'A') continue;
    const r = best(id);
    if (!winner || r.total > winner.total) winner = r;
  }
  const declared = G.capacity.graph_depth_hours;
  console.log(`longest hard-edge horizon-A path: ${winner.path.join(' -> ')}`);
  console.log(`total ${winner.total} h   capacity.graph_depth_hours ${declared}`);
  console.log(`capacity.graph_depth_path  ${G.capacity.graph_depth_path}`);
  const same = winner.path.join(' -> ') === G.capacity.graph_depth_path;
  if (!same) console.log(`  NOTE  the declared path string differs; a tie between equal-length paths is legal, the TOTAL is the assertion`);
  if (winner.total === declared) { ok(`total equals capacity.graph_depth_hours (${declared})`); return true; }
  bad(`total ${winner.total} != capacity.graph_depth_hours ${declared}`);
  return false;
}

// ---------------------------------------------------------------- --check-accept-paths
// The tokenizer is specified in G0.accept in five steps; this is that specification and
// nothing else. Do not "improve" it — exit 0 vs exit 1 used to turn on an unstated step.

const EXEMPT = [
  'erp/contracts/violation.schema.json',
  'erp/contracts/canonical-vectors.json',
  'erp/contracts/eval-case.schema.json',
  'erp/contracts/policy.schema.json',
  'erp/contracts/policy-versions.json',
  'erp/contracts/signature.schema.json',
  'erp/charters/C3.md',
  'countinghouse/src/policy.js',
];

const stripTrailing = (s) => s.replace(/\/+$/, '');

function acceptPathIndex() {
  const outputs = new Set();
  const basenames = new Map();
  const prefixes = new Set();
  for (const n of G.nodes) {
    for (const o of n.outputs) {
      const c = stripTrailing(o);
      outputs.add(c);
      const b = c.split('/').pop();
      if (!basenames.has(b)) basenames.set(b, []);
      basenames.get(b).push(`${c} (${n.id})`);
      const parts = c.split('/');
      for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join('/'));
    }
  }
  return { outputs, basenames, prefixes };
}

function tokenize(accept) {
  // (t1) every character outside the set becomes a space
  const spaced = accept.replace(/[^A-Za-z0-9_./*$~@+-]/g, ' ');
  // (t2) split on whitespace
  return spaced.split(/\s+/).filter(Boolean).map((raw) => {
    // (t3) strip trailing `.` `/` `-` repeatedly, leading `-` repeatedly, then ONE leading `./`
    let t = raw;
    while (/[./-]$/.test(t)) t = t.slice(0, -1);
    while (t.startsWith('-')) t = t.slice(1);
    if (t.startsWith('./')) t = t.slice(2);
    return t;
  }).filter(Boolean);
}

function checkAcceptPaths() {
  const { outputs, basenames, prefixes } = acceptPathIndex();
  const tally = { verbatim: 0, prefix: 0, basename: 0, preexisting: 0, exempt: 0 };
  const discarded = { absolute: 0, glob: 0, variable: 0, 'not-a-path': 0, bareword: 0 };
  const prefixHits = [];
  const exemptHits = new Map(EXEMPT.map((e) => [e, 0]));
  const unresolved = [];
  let candidates = 0;
  const distinct = { verbatim: new Set(), prefix: new Set(), basename: new Set(), preexisting: new Set(), exempt: new Set() };
  const seenPair = new Set();

  for (const n of G.nodes) {
    for (const tok of tokenize(n.accept)) {
      // discard classes, IN ORDER
      if (tok.startsWith('/')) { discarded.absolute++; continue; }                       // (d1)
      if (/[*?[]/.test(tok)) { discarded.glob++; continue; }                             // (d2)
      if (tok.includes('$') || tok.startsWith('~')) { discarded.variable++; continue; }   // (d3)
      // (t4) candidate test -> (d4) not-a-path
      const base = tok.split('/').pop();
      const hasExt = /^[A-Za-z0-9_.@+-]+\.[A-Za-z0-9]{1,6}$/.test(base);
      const isOutput = outputs.has(tok);
      const isPrefix = prefixes.has(tok);
      if (!hasExt && !isOutput && !isPrefix) { discarded['not-a-path']++; continue; }
      // (t5) bare word -> (d4) bareword
      if (!tok.includes('/')) {
        const byBase = basenames.has(tok);
        const onDisk = fs.existsSync(tok) && fs.statSync(tok).isFile();
        if (!byBase && !onDisk) { discarded.bareword++; continue; }
        candidates++; tally.basename++; distinct.basename.add(`${n.id}|${tok}`); seenPair.add(`${n.id}|${tok}`); continue;
      }
      candidates++;
      const pair = `${n.id}|${tok}`;
      seenPair.add(pair);
      if (isOutput) { tally.verbatim++; distinct.verbatim.add(pair); continue; }
      if (isPrefix) { tally.prefix++; distinct.prefix.add(pair); prefixHits.push(`${tok} (${n.id})`); continue; }
      const ex = EXEMPT.find((e) => e === tok);
      if (ex) { tally.exempt++; distinct.exempt.add(pair); exemptHits.set(ex, exemptHits.get(ex) + 1); continue; }
      if (tok.startsWith('erp/') && fs.existsSync(tok) && fs.statSync(tok).isFile()) { tally.preexisting++; distinct.preexisting.add(pair); continue; }
      unresolved.push(`${n.id}: ${tok}`);
    }
  }

  const D = (k) => distinct[k].size;
  console.log(`ACCOUNTING, PRINTED HERE AND RESTATED NOWHERE — D-35. This mode tokenizes the`);
  console.log(`accept text AND the documents, so its own published output is part of the corpus`);
  console.log(`it measures: naming the seven directory prefixes in the predicate added seven`);
  console.log(`path tokens and the re-run counted fourteen. THE MEASUREMENT IS NOT IDEMPOTENT`);
  console.log(`UNDER PUBLICATION, so any restated figure is a fixed point the next prose edit`);
  console.log(`breaks — which is how 179/19 and 182/152/7 went stale rather than merely being`);
  console.log(`superseded. What the predicate asserts is the INVARIANT: exit 0, zero`);
  console.log(`unresolved, the prefix class printed separately from the verbatim class rather`);
  console.log(`than folded into it (R-36), and every exemption entry used at least once.`);
  console.log(`Both bases are printed because publishing only one is how the previous run and`);
  console.log(`a strict implementation drifted apart.`);
  console.log(`\ndistinct (node, token) pairs resolved: ${seenPair.size}`);
  console.log(`  ${D('verbatim')} VERBATIM · ${D('prefix')} PREFIX · ${D('basename')} BASENAME (t5) · ${D('preexisting')} PRE-EXISTING · ${D('exempt')} EXEMPT`);
  console.log(`\nraw candidate token occurrences resolved: ${candidates}`);
  console.log(`  ${tally.verbatim} VERBATIM in some node's outputs`);
  console.log(`  ${tally.prefix} as DIRECTORY PREFIXES of one:`);
  for (const p of [...new Set(prefixHits)].sort()) console.log(`        ${p}`);
  console.log(`  ${tally.basename} as output basenames under (t5)`);
  console.log(`  ${tally.preexisting} PRE-EXISTING under erp/ found on disk`);
  console.log(`  ${tally.exempt} hits over the ${EXEMPT.length} exemption entries:`);
  for (const [e, c] of exemptHits) console.log(`        ${c === 0 ? 'UNUSED ->' : String(c).padStart(2) + ' x    '} ${e}`);
  console.log(`discarded: ` + Object.entries(discarded).map(([k, v]) => `${k} ${v}`).join(', '));
  const unusedExempt = [...exemptHits].filter(([, c]) => c === 0).map(([e]) => e);
  if (unusedExempt.length) console.log(`  NOTE  exemption entries nothing uses: ${unusedExempt.join(' ')} — an exemption nothing uses is a licence waiting for a mistake to walk into`);
  if (unresolved.length) {
    for (const u of unresolved) bad(`UNRESOLVED ${u}`);
    return false;
  }
  ok(`0 UNRESOLVED`);
  return true;
}

// ---------------------------------------------------------------- --check-freezes

function checkFreezes() {
  let violations = 0;
  for (const f of G.interface_freezes) {
    for (const id of f.unblocks) {
      if (!IDS.has(id)) { bad(`freeze ${f.artifact}: unblocks "${id}" is not a node id`); violations++; continue; }
      const edge = HARD.find((e) => e.from === f.frozen_by && e.to === id);
      if (!edge) { bad(`freeze ${f.artifact}: no HARD edge ${f.frozen_by} -> ${id}, but unblocks names it`); violations++; continue; }
      ok(`${f.artifact}: ${f.frozen_by} -> ${id} hard edge present`);
    }
    if (!IDS.has(f.frozen_by)) { bad(`freeze ${f.artifact}: frozen_by "${f.frozen_by}" is not a node id`); violations++; }
  }
  return violations === 0;
}

// ---------------------------------------------------------------- --check-ownership-globs

function checkOwnershipGlobs() {
  const seen = new Map();
  for (const n of G.nodes) for (const o of n.outputs) seen.set(stripTrailing(o), `${n.id}.outputs`);
  const { outputs, prefixes } = acceptPathIndex();
  for (const n of G.nodes) {
    for (const tok of tokenize(n.accept)) {
      if (tok.startsWith('/') || /[*?[]/.test(tok) || tok.includes('$') || tok.startsWith('~')) continue;
      const base = tok.split('/').pop();
      if (!/^[A-Za-z0-9_.@+-]+\.[A-Za-z0-9]{1,6}$/.test(base) && !outputs.has(tok) && !prefixes.has(tok)) continue;
      if (!tok.includes('/')) continue;
      if (!seen.has(tok)) seen.set(tok, `${n.id}.accept`);
    }
  }
  let unresolved = 0;
  for (const [p, src] of [...seen].sort()) {
    const r = whoMayWrite(p, G);
    if (!r.resolved) {
      if (EXEMPT.includes(p) || (p.startsWith('erp/') && fs.existsSync(p))) continue;
      bad(`${p} (${src}) — ${r.detail}`);
      unresolved++;
    }
  }
  console.log(`${seen.size} distinct paths (node outputs + accept paths) checked against conventions.ownership_rule`);
  if (!unresolved) ok('every one resolves to a seat');
  return unresolved === 0;
}

// ---------------------------------------------------------------- --check-schedule

function dayOf() {
  const m = new Map();
  for (const [d, ns] of Object.entries(G.capacity.schedule_A.days)) for (const id of ns) m.set(id, Number(d));
  return m;
}

function checkSchedule() {
  const day = dayOf();
  let violations = 0;

  const A = G.nodes.filter((n) => n.horizon === 'A');
  const missing = A.filter((n) => !day.has(n.id));
  const unknown = [...day.keys()].filter((id) => !IDS.has(id));
  if (missing.length) { bad(`horizon-A nodes absent from schedule_A: ${missing.map((n) => n.id).join(' ')}`); violations++; }
  if (unknown.length) { bad(`schedule_A names non-nodes: ${unknown.join(' ')}`); violations++; }
  const seenTwice = [];
  const count = new Map();
  for (const ns of Object.values(G.capacity.schedule_A.days)) for (const id of ns) count.set(id, (count.get(id) || 0) + 1);
  for (const [id, c] of count) if (c > 1) seenTwice.push(`${id} x${c}`);
  if (seenTwice.length) { bad(`scheduled more than once: ${seenTwice.join(' ')}`); violations++; }
  if (!missing.length && !unknown.length && !seenTwice.length) ok(`${A.length}/${A.length} horizon-A nodes scheduled exactly once`);

  let backwards = 0, checked = 0;
  for (const e of HARD) {
    const u = day.get(e.from), v = day.get(e.to);
    if (u === undefined || v === undefined) continue;
    checked++;
    if (u > v) { bad(`hard edge ${e.from}(day ${u}) -> ${e.to}(day ${v}) is BACKWARDS`); backwards++; }
  }
  if (!backwards) ok(`${checked} hard edges, 0 backwards orderings`);
  violations += backwards;

  // capacity.seat_day_hours_cap_note, verbatim: the cap "counts AGENT hours only: the five
  // human-gated nodes (G1, V1, D4, D5, D6) are drawn from the human's daily budget, not from
  // the owning seat's six agent-hours, because the seat is waiting on a person rather than
  // working." Counting them here reports I1 at 7.5 h on Day 1 and fails a schedule that is
  // correct — that was this checker's first bug, not the graph's.
  const cap = G.capacity.seat_day_hours_cap;
  const gated = new Set(G.human_gated);
  const load = new Map();
  for (const [d, ns] of Object.entries(G.capacity.schedule_A.days)) {
    for (const id of ns) {
      const n = NODES.get(id); if (!n) continue;
      if (gated.has(id)) continue;
      const k = `${n.owner}|${d}`;
      load.set(k, (load.get(k) || 0) + n.hours);
    }
  }
  const over = [...load].filter(([, h]) => h > cap);
  const peak = Math.max(...load.values());
  for (const [k, h] of over) { bad(`${k.replace('|', ' day ')} carries ${h} agent-hours, over the ${cap} h cap`); violations++; }
  if (!over.length) {
    const at = [...load].filter(([, h]) => h === peak).map(([k]) => k.replace('|', ' day '));
    ok(`no seat exceeds ${cap} agent-hours on any day; peak ${peak} at ${at.join(', ')} (human-gated ${[...gated].join(',')} excluded per seat_day_hours_cap_note)`);
  }
  return violations === 0;
}

// ---------------------------------------------------------------- --check-modes
// D-59, bought by PM after THREE instances in one day of a predicate naming a
// capability nobody was told to build: --smoke-login (F1's accept, produced by
// H2), S1's missing static route (asserted by T2's and D1's edge contracts), and
// --assert-flips (T2's accept, produced by H2). Two green instruments passed all
// three: --check-accept-paths resolves harness/drive.mjs happily as a declared H2
// output, because THE PATH RESOLVES AND THE MODE IS NOT A PATH; and
// --check-schedule had no edge to order because the dependency was never drawn.
//
// THE RULE, exactly as ruled, so it needs no second interpretation. For every
// (script-path, --flag) pair extracted from an accept:
//   (a) if the script EXISTS on disk, the flag literal must appear in it;
//   (b) if it does NOT exist yet, the node declaring it as an output must be a
//       HARD INPUT of the node whose accept names it.
//
// THE LIMIT, STATED RATHER THAN SOLD AS COMPLETE — PM's words and they belong in
// the source, not only in a decision row: THIS CATCHES TWO OF THE THREE.
// --smoke-login and --assert-flips are FLAGS. S1's static route was a CAPABILITY
// DESCRIBED IN PROSE, and no flag-based checker reaches it; that one was caught
// by a human reading an edge contract against a running server, and nothing cheap
// replaces that. An instrument that closes two thirds of a class and says so is
// worth more than one that claims the class and is trusted in six months.

function checkModes() {
  // A script followed by one or more flags. Flags BEFORE a path are not attributed
  // to it — `node --test tests/x.test.mjs` must not read as tests/x.test.mjs
  // needing a --test literal.
  const PAIR = /([A-Za-z0-9_./-]+\.(?:mjs|js|sh))((?:\s+--[a-z][a-z0-9-]*)+)/g;
  const outputOwner = new Map();
  for (const n of G.nodes) for (const o of n.outputs) outputOwner.set(stripTrailing(o), n);

  let checked = 0, violations = 0;
  const onDisk = [], deferred = [];

  for (const n of G.nodes) {
    for (const m of n.accept.matchAll(PAIR)) {
      const script = m[1].replace(/^\.\//, '');
      const flags = [...m[2].matchAll(/--[a-z][a-z0-9-]*/g)].map((f) => f[0]);
      for (const flag of new Set(flags)) {
        checked++;
        if (fs.existsSync(script) && fs.statSync(script).isFile()) {
          const src = fs.readFileSync(script, 'utf8');
          if (src.includes(flag)) { onDisk.push(`${n.id}: ${script} ${flag}`); continue; }
          bad(`${n.id}.accept names \`${script} ${flag}\` — the script EXISTS and the flag literal does NOT appear in it`);
          violations++;
          continue;
        }
        // (b) not on disk yet: the producer must be a hard input of the consumer
        const producer = outputOwner.get(script);
        if (!producer) {
          bad(`${n.id}.accept names \`${script} ${flag}\` — the script does not exist and NO node declares it as an output`);
          violations++;
          continue;
        }
        if (producer.id === n.id) { deferred.push(`${n.id}: ${script} ${flag} (own output)`); continue; }
        const edge = HARD.find((e) => e.from === producer.id && e.to === n.id);
        if (!edge) {
          bad(`${n.id}.accept names \`${script} ${flag}\`, produced by ${producer.id}, but there is NO HARD EDGE ${producer.id} -> ${n.id} — the dependency is invisible to --check-schedule`);
          violations++;
          continue;
        }
        deferred.push(`${n.id}: ${script} ${flag} <- ${producer.id} (hard edge present)`);
      }
    }
  }

  console.log(`${checked} (script, flag) pair(s) extracted from accept predicates`);
  console.log(`  ${onDisk.length} resolved against a script ON DISK carrying the flag literal`);
  console.log(`  ${deferred.length} deferred to a producer that is a hard input (or the node's own output)`);
  for (const d of deferred) console.log(`        ${d}`);
  console.log(`LIMIT, STATED: this checks FLAGS. A capability described in PROSE — S1's missing`);
  console.log(`static route — is not reachable by this mode and never will be. It closes two of`);
  console.log(`the three instances that bought it, and that is the whole claim.`);
  if (!violations) ok('every mode named in an accept is produced by something');
  return violations === 0;
}

// ---------------------------------------------------------------- --check-orphans
// D-63, bought after the FIFTH instance of a predicate requiring an effect nobody
// was told to produce: src/page/register.js was a correct, complete T2 output that
// NOTHING EVER LOADED. index.html loaded ui/shell.js and nothing else; the page
// registered zero tools; the node could not pass.
//
// THE RULE: every declared node output under src/** that EXISTS ON DISK must be
// REFERENCED FROM A NON-COMMENT CONTEXT — an import/require, a <script src>, an
// entry point in package.json scripts, or a path named in some node's accept.
// An output that has not been built yet is not an orphan; it is unbuilt.
//
// STRIPPING COMMENTS IS THE WHOLE TRICK AND IT IS WHY THIS IS NOT TRIVIAL.
// register.js WAS mentioned in BOTH index.html and ui/shell.js — in comments, by
// name, accurately — so a checker that counted mentions would have called it
// mounted and passed. Beating a naive mention-counter is the specific failure
// this implementation exists to beat, so the comment stripper is the load-bearing
// part and is tested by --selftest-orphans below.
//
// STATED LIMIT, same discipline as --check-modes' two-of-three: THIS CATCHES AN
// ARTIFACT THAT IS NEVER REFERENCED. IT DOES NOT CATCH A CAPABILITY THAT WAS
// NEVER BUILT. S1's missing static route was not an orphaned file — it was a
// missing BEHAVIOUR in a file that exists and loads and is referenced everywhere.
// Nothing cheap reaches that. One of the two, not both.

// Comment strippers. Deliberately conservative: they may leave a comment in
// (a false PASS on that one reference) but must never remove live code (a false
// FAIL). A checker that invents violations is worse than one that misses some.
export function stripJsComments(src) {
  let out = '', i = 0, mode = 'code', quote = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && n === '*') { mode = 'block'; i += 2; continue; }
      if (c === '/' && n === '/') { mode = 'line'; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { mode = 'str'; quote = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'block') { if (c === '*' && n === '/') { mode = 'code'; i += 2; out += ' '; continue; } i++; continue; }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += '\n'; } i++; continue; }
    if (mode === 'str') {
      if (c === '\\') { out += c + (n ?? ''); i += 2; continue; }
      if (c === quote) { mode = 'code'; }
      out += c; i++; continue;
    }
  }
  return out;
}
export function stripHtmlComments(src) { return src.replace(/<!--[\s\S]*?-->/g, ' '); }

function checkOrphans() {
  const roots = [];
  (function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const q = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(q); }
      else if (/\.(js|mjs|cjs|html)$/.test(e.name)) roots.push(q);
    }
  })('src');
  // tests/ MUST be in the corpus. Leaving it out reported src/samples.js as an
  // orphan when tests/helpers.mjs imports it — a checker inventing a violation,
  // which is worse than one that misses. Found by running it before shipping it.
  for (const extra of ['server', 'harness', 'probe', 'tests', 'tools', 'evals']) {
    (function walk(d) {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const q = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(q); }
        else if (/\.(js|mjs|cjs|html)$/.test(e.name)) roots.push(q);
      }
    })(extra);
  }

  // One stripped corpus, built once, with each file's own text excluded when we
  // ask whether OTHERS reference it — a file importing itself proves nothing.
  const stripped = new Map();
  for (const f of roots) {
    const src = fs.readFileSync(f, 'utf8');
    stripped.set(f, f.endsWith('.html') ? stripHtmlComments(src) : stripJsComments(src));
  }

  const pkg = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
  const acceptText = G.nodes.map((n) => n.accept).join('\n');

  const targets = [];
  for (const n of G.nodes) {
    for (const o of n.outputs) {
      const c = stripTrailing(o);
      if (!c.startsWith('src/')) continue;
      if (!/\.(js|mjs|cjs|html)$/.test(c)) continue;
      if (!fs.existsSync(c)) continue; // unbuilt is not orphaned
      targets.push({ path: c, node: n.id, owner: n.owner });
    }
  }

  let orphans = 0;
  const referenced = [];
  for (const t of targets) {
    const base = t.path.split('/').pop();
    let via = null;
    for (const [f, text] of stripped) {
      if (f === t.path) continue;
      // A REFERENCE IN HTML IS AN src= OR href= ATTRIBUTE, NOT ANY QUOTED STRING.
      // UX predicted this hole and I reproduced it: delete the real <script src>
      // from index.html, leave the comment table, the block comment and the
      // onerror MESSAGE — all of which quote the filename — and this check still
      // reported the module as mounted and exited 0. A FALSE GREEN IN THE
      // INSTRUMENT BOUGHT TO PREVENT FALSE GREENS. index.html names
      // fallback-agent.js four times and register.js eleven; exactly one of each
      // is a mount.
      // JS IS SPECIFIER-ONLY TOO, and this is a REVERSAL I am stating rather than
      // making quietly. I first kept it broad — any quoted string bearing the
      // basename — to avoid inventing an orphan for `const mod = "./x.js";
      // import(mod)`. But harness/drive.mjs names src/page/fallback-agent.js in a
      // DIAGNOSTIC MESSAGE TABLE, and that string alone made the module look
      // mounted. A message about a file is not an execution path.
      // The stripper's conservatism stands unchanged (it may leave a comment in,
      // it must never remove live code). The MATCHER's rule is different and now
      // says: only from/import/require specifiers count. A dynamic specifier
      // assembled at run time will be reported as an orphan — a FALSE FAIL, which
      // is LOUD and gets investigated, where the false PASS it replaces was
      // silent and shipped.
      const b = base.replace(/\./g, '\\.');
      const re = f.endsWith('.html')
        ? new RegExp(`(?:src|href)\\s*=\\s*["'][^"']*${b}["']`)
        : base.endsWith('.html')
          // AN HTML ENTRY POINT IS SERVED, NEVER IMPORTED. src/page/index.html is
          // referenced by server/index.mjs as a PATH, not a specifier, so the
          // specifier rule invented it as an orphan on its first run. Caught before
          // shipping by running the checker against the real tree — the same way the
          // missing tests/ corpus was caught the first time this mode was built.
          ? new RegExp("[\"'`][^\"'`]*" + b + "[\"'`]")
          : new RegExp("(?:from|import|require)\\s*\\(?\\s*[\"'`][^\"'`]*" + b + "[\"'`]");
      if (re.test(text)) { via = f; break; }
    }
    if (!via && new RegExp(`["'][^"']*${base.replace(/\./g, '\\.')}`).test(pkg)) via = 'package.json scripts';
    if (!via && acceptText.includes(t.path)) via = 'named in an accept';
    if (via) { referenced.push(`${t.path} (${t.node}) <- ${via}`); continue; }
    bad(`${t.path} is a declared output of ${t.node} (${t.owner}), EXISTS on disk, and is referenced from NO non-comment context — nothing loads it`);
    orphans++;
  }

  console.log(`${targets.length} built output(s) under src/ checked against a COMMENT-STRIPPED corpus of ${roots.length} file(s)`);
  for (const r of referenced) console.log(`        ${r}`);
  console.log(`LIMIT, STATED: this catches an ARTIFACT NEVER REFERENCED. It does NOT catch a`);
  console.log(`CAPABILITY NEVER BUILT — S1's missing static route was a live, loaded, referenced`);
  console.log(`file with a behaviour missing from it, and nothing cheap reaches that.`);
  if (!orphans) ok('every built src/ output is loaded from somewhere real');
  return orphans === 0;
}

// The stripper is the load-bearing part, so it is tested rather than trusted.
function selftestOrphans() {
  const cases = [
    ['// import "./ghost.js"\n', false, 'line comment'],
    ['/* import "./ghost.js" */\n', false, 'block comment'],
    ['import "./ghost.js";\n', true, 'real import'],
    ['<!-- <script src="./ghost.js"></script> -->', false, 'html comment', true],
    ['<script src="./ghost.js"></script>', true, 'real script tag', true],
    ['<div onerror="./ghost.js is missing"></div>', false, 'an onerror MESSAGE quoting a filename is NOT a mount', true],
    ['<!-- table: #x  H3/I1  src/page/ghost.js -->', false, 'a comment table naming the file is NOT a mount', true],
    ['const mod = "./ghost.js";\n', true, 'a quoted specifier in live code, after a stripper pass'],
    ['const s = "not a path";\n// import "./ghost.js"\n', false, 'comment AFTER live code still stripped'],
  ];
  let fails = 0;
  for (const [src, want, label, isHtml] of cases) {
    const out = isHtml ? stripHtmlComments(src) : stripJsComments(src);
    const got = isHtml
      ? /(?:src|href)\s*=\s*["'][^"']*ghost\.js["']/.test(out)
      : /["'`][^"'`]*ghost\.js["'`]/.test(out);
    if (got !== want) { bad(`selftest-orphans: ${label} — expected reference ${want}, got ${got}`); fails++; }
    else ok(`selftest-orphans: ${label}`);
  }
  return fails === 0;
}

// ---------------------------------------------------------------- --check-record
// Clause 6c says THE RECORD OF A MERGE IS PART OF THE MERGE, and nothing checked
// the record. On 2026-08-29 .team/log/merges.txt carried four rows naming pit
// files that do not exist and two rows with no sha at all, while the row count
// and graph.state.json.done agreed exactly — SO BOTH REGISTERS AGREED WHILE BOTH
// OVERSTATED THE TREE. Two registers agreeing is not two registers being right.
//
// Every MERGED row must satisfy: the sha resolves to a commit that exists, and
// the pit path exists in HEAD or reads PENDING. PENDING is honest and passes;
// naming a file that is not there does not.
function checkRecord() {
  const LOG = '.team/log/merges.txt';
  if (!fs.existsSync(LOG)) { bad(`${LOG} does not exist`); return false; }
  const rows = fs.readFileSync(LOG, 'utf8').split('\n').filter((l) => l.startsWith('MERGED'));
  const st = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : { done: [] };
  let violations = 0;
  const seen = [];
  for (const line of rows) {
    const m = line.match(/^MERGED\s+(\S+)\s+(\S+)\s+pits:(\S+)/);
    if (!m) { bad(`malformed row: ${line}`); violations++; continue; }
    const [, node, sha, pit] = m;
    seen.push(node);
    if (!/^[0-9a-f]{7,40}$/.test(sha)) { bad(`${node}: "${sha}" is not a sha`); violations++; }
    else {
      const r = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`]);
      if (r.status !== 0) { bad(`${node}: sha ${sha} is not a commit in this repository`); violations++; }
    }
    if (pit !== 'PENDING' && !fs.existsSync(pit)) { bad(`${node}: names ${pit}, which DOES NOT EXIST`); violations++; }
  }
  const done = new Set(st.done || []);
  const rowsNotDone = seen.filter((n) => !done.has(n));
  const doneNotRows = [...done].filter((n) => !seen.includes(n));
  if (rowsNotDone.length) { bad(`rows for nodes not in graph.state.json.done: ${rowsNotDone.join(' ')}`); violations++; }
  if (doneNotRows.length) { bad(`done but no merge row: ${doneNotRows.join(' ')}`); violations++; }
  const pending = rows.filter((l) => /pits:PENDING/.test(l)).length;
  console.log(`${rows.length} merge row(s) checked; ${done.size} node(s) done; ${pending} pit(s) PENDING`);
  if (!violations) ok('every row names a sha that exists and a pit that exists or is honestly PENDING');
  return violations === 0;
}

// ---------------------------------------------------------------- --check-tables
// R-22: this mode is what makes restatement legal at all. falsification[9] used to forbid a
// sibling document from restating a node table outright; the rule is now narrowed to "a
// restatement --check-tables does not prove equal to the authority". Until this is green the
// agreement is hand-maintained.
//
// SCOPE, stated so it can be argued with rather than guessed at:
//   NODE TABLE   an id column plus at least one of owner / inputs / hours / cut / horizon.
//                Every listed field is compared, field by field, against erp/graph.json.
//   DAY TABLE    (a) a table under a `#### Day N` heading — every row's node must be
//                    scheduled on day N;
//                (b) a row-per-day table with a day column and a nodes column — every node
//                    id named in the row must be scheduled on that day, and a cell of the
//                    form `<k> nodes` must equal that day's node count.
//                Direction is MEMBERSHIP, not equality: a filtered view (PLAN.md's
//                human-gated split) may legally omit nodes. Omissions are printed as NOTE.

function mdTables(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const out = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{2,6}\s+(.*)$/);
    if (h) heading = h[1];
    if (!/^\s*\|/.test(lines[i])) continue;
    if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) continue;
    const cells = (l) => l.split('|').slice(1, -1).map((c) => c.replace(/[`*_]/g, '').trim());
    const header = cells(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push({ n: j + 1, cells: cells(lines[j]) }); j++; }
    out.push({ file, line: i + 1, heading, header, rows });
    i = j - 1;
  }
  return out;
}

function erpMarkdown() {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) files.push(p);
    }
  })('erp');
  return files.sort();
}

const COLS = {
  id: /^(node|id|node id)$/i,
  owner: /^(owner|seat)$/i,
  inputs: /^(input|inputs|deps|depends on)$/i,
  hours: /^(h|hr|hrs|hours|agent-hours|agent hours)$/i,
  cut: /^(cut|cut rank|rank)$/i,
  horizon: /^horizon$/i,
  repo: /^repo$/i,
  day: /^day$/i,
};

const idsIn = (cell) => (cell.match(/\b([A-Z]\d{1,2})\b/g) || []).filter((t) => IDS.has(t));
const numIn = (cell) => { const m = cell.match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

function checkTables() {
  const day = dayOf();
  let violations = 0, nodeTables = 0, dayTables = 0, rowsChecked = 0;

  for (const file of erpMarkdown()) {
    for (const t of mdTables(file)) {
      const at = (name) => t.header.findIndex((h) => COLS[name].test(h));
      const idCol = at('id');
      const dayCol = at('day');
      // Prefer an EXACT `Nodes` header before any header merely CONTAINING "node". RUNBOOK's
      // day table is `| Day | Node-owning seats that must be live | Nodes |`, and a loose
      // /node/i match reads the SEATS column as the nodes column — which silently skips the
      // real one and invents membership NOTEs out of the seat names beside it.
      let nodesCol = t.header.findIndex((h, k) => k !== idCol && /^nodes?$/i.test(h));
      if (nodesCol < 0) nodesCol = t.header.findIndex((h, k) => k !== idCol && /node/i.test(h));
      const cmp = ['owner', 'inputs', 'hours', 'cut', 'horizon', 'repo'].map((f) => [f, at(f)]).filter(([, k]) => k >= 0);
      const known = idCol >= 0 ? t.rows.filter((r) => IDS.has(r.cells[idCol] || '')).length : 0;

      // ---- node table
      if (idCol >= 0 && known >= 2 && cmp.length) {
        nodeTables++;
        const headingDay = (t.heading.match(/^Day\s+(\d)\b/i) || [])[1];
        for (const r of t.rows) {
          const id = r.cells[idCol];
          if (!IDS.has(id)) continue;
          const n = NODES.get(id);
          rowsChecked++;
          for (const [f, k] of cmp) {
            const cell = r.cells[k] ?? '';
            if (f === 'inputs') {
              const want = [...n.inputs].sort().join(',');
              const none = /^(|—|-|–|none|\(none\)|n\/a)$/i.test(cell.trim());
              const got = none ? '' : [...new Set(idsIn(cell))].sort().join(',');
              if (want !== got) { bad(`${file}:${r.n}  ${id}.inputs  table [${got || '(none)'}]  graph.json [${want || '(none)'}]`); violations++; }
            } else if (f === 'hours' || f === 'cut') {
              const got = numIn(cell);
              if (got !== n[f]) { bad(`${file}:${r.n}  ${id}.${f}  table [${cell}]  graph.json [${n[f]}]`); violations++; }
            } else {
              const got = cell.trim();
              if (got !== String(n[f])) { bad(`${file}:${r.n}  ${id}.${f}  table [${got}]  graph.json [${n[f]}]`); violations++; }
            }
          }
          if (headingDay !== undefined) {
            const d = day.get(id);
            if (d !== Number(headingDay)) { bad(`${file}:${r.n}  ${id} sits under heading "${t.heading}" but schedule_A puts it on day ${d}`); violations++; }
          }
          if (dayCol >= 0) {
            const got = numIn(r.cells[dayCol] ?? '');
            const d = day.get(id);
            if (got !== d) { bad(`${file}:${r.n}  ${id}.day  table [${r.cells[dayCol]}]  schedule_A [${d}]`); violations++; }
          }
        }
        continue;
      }

      // ---- row-per-day table
      if (dayCol >= 0 && nodesCol >= 0 && idCol < 0) {
        dayTables++;
        for (const r of t.rows) {
          const dayCell = r.cells[dayCol] ?? '';
          const days = (dayCell.match(/\d/g) || []).map(Number).filter((d) => d in G.capacity.schedule_A.days);
          if (!days.length) continue;
          const cell = r.cells[nodesCol] ?? '';
          rowsChecked++;
          const listed = [...new Set(idsIn(cell))];
          const countClaim = cell.match(/^(\d+)\s+nodes?$/i);
          if (countClaim && days.length === 1) {
            const want = G.capacity.schedule_A.days[days[0]].length;
            if (Number(countClaim[1]) !== want) { bad(`${file}:${r.n}  day ${days[0]} node COUNT  table [${countClaim[1]}]  schedule_A [${want}]`); violations++; }
            continue;
          }
          for (const id of listed) {
            const d = day.get(id);
            if (!days.includes(d)) { bad(`${file}:${r.n}  ${id} is listed on day ${days.join('/')} but schedule_A puts it on day ${d}`); violations++; }
          }
          if (days.length === 1 && listed.length) {
            const absent = G.capacity.schedule_A.days[days[0]].filter((id) => !listed.includes(id));
            if (absent.length) console.log(`  NOTE  ${file}:${r.n}  day ${days[0]} row names ${listed.length} of ${G.capacity.schedule_A.days[days[0]].length} nodes; absent: ${absent.join(' ')} (a filtered view is legal)`);
          }
        }
      }
    }
  }
  console.log(`${nodeTables} restated node table(s), ${dayTables} restated day table(s), ${rowsChecked} row(s) compared against erp/graph.json`);
  if (!violations) ok('every restatement agrees with the authority');
  return violations === 0;
}

// ---------------------------------------------------------------- main

const MODES = [
  ['--check-cuts', checkCuts],
  ['--path', longestPath],
  ['--check-accept-paths', checkAcceptPaths],
  ['--check-freezes', checkFreezes],
  ['--check-ownership-globs', checkOwnershipGlobs],
  ['--check-tables', checkTables],
  ['--check-schedule', checkSchedule],
  ['--check-modes', checkModes],
  ['--check-orphans', checkOrphans],
  ['--check-record', checkRecord],
  ['--selftest-orphans', selftestOrphans],
];

const argv = process.argv.slice(2);
if (!argv.length) { readySet(); process.exit(0); }
if (argv[0] === '--owner') {
  if (!argv[1]) { console.error('usage: ready.mjs --owner <SEAT>'); process.exit(2); }
  readySet(argv[1]); process.exit(0);
}

if (argv[0] === '--all') {
  let allOk = true;
  for (const [name, fn] of MODES) {
    console.log(`\n=== ${name} ===`);
    const r = fn();
    if (!r) allOk = false;
  }
  console.log(`\n${allOk ? 'ALL CHECKS GREEN' : 'AT LEAST ONE CHECK FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

const found = MODES.find(([name]) => name === argv[0]);
if (!found) {
  console.error('usage: ready.mjs [ ' + MODES.map(([n]) => n).join(' | ') + ' | --all ]');
  process.exit(2);
}
process.exit(found[1]() ? 0 : 1);
