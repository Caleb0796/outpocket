#!/usr/bin/env node
// tools/merge-gate.mjs — L1's merge gate, clause 6 of erp/charters/L1.md, ENFORCED.
//
// WHY THIS EXISTS. On 2026-08-29 I merged W's DEV-014 ticket over an ownership DENY.
// I ran tools/check-ownership.mjs, it printed
//     DENY  .team/deviations/DEV-014.md  [longest matching glob `.team/**` -> L1, not W]
//     1 path(s) checked for seat W; 1 violation(s).
// and I merged anyway -- not by overriding it, which would at least have been a
// decision, but because the check and the merge were separate shell statements and I
// only ECHOED the exit status instead of gating on it. THE GATE DID NOT REJECT THE
// MERGE; IT NARRATED ITS OWN OBJECTION AND WAS IGNORED.
//
// That is the same defect I had spent the whole day writing into other seats' contracts:
// a check that RAN and a check that was ENFORCED are two different things, and exit 0 is
// also satisfied by a check nobody consumed. The remedy for a process I keep executing
// wrongly by hand is not resolving to be careful. It is one command that returns one
// status, so that the only way to merge past a red clause is to say so out loud.
//
//   node tools/merge-gate.mjs --node <ID> --seat <SEAT> --branch <REF>
//
// Runs all four clauses of the merge gate and exits 1 if ANY fails:
//   (1) the node's accept predicate, verbatim from erp/graph.json via accept-gate.mjs
//   (2) the Layer-0 lint (G4)
//   (3) check-ownership over the branch's REAL file list -- three-dot, see below
//   (4) the pit entry: kb/pits/<node>.md exists with all five keys, or --pit-pending
//
// THREE DOTS, NOT TWO. The file list comes from `git diff --name-only main...<branch>`,
// which diffs against the MERGE BASE. `main..<branch>` (two dots) is a TREE COMPARISON
// and lists everything main has that the branch lacks -- on 2026-08-29 that reported 16
// files for a 3-file node, including my own contracts and merge log, and would have sent
// a clean node to PM as a cross-seat ownership collision.
//
// This gate does NOT push. R-26(b) push-and-verify stays a separate deliberate act.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const val = (f) => { const i = argv.indexOf(f); return i === -1 ? null : argv[i + 1]; };
const has = (f) => argv.includes(f);

const node = val('--node'), seat = val('--seat'), branch = val('--branch');
const base = val('--base') || 'main';
if (!node || !seat || !branch) {
  console.error('usage: merge-gate.mjs --node <ID> --seat <SEAT> --branch <REF> [--base main] [--pit-pending] [--skip-accept]');
  process.exit(2);
}

const PIT_KEYS = ['TRIED', 'HAPPENED', 'CHANGED', 'EARLIER', 'GRADE'];
const results = [];
const record = (clause, ok, detail) => { results.push({ clause, ok, detail }); return ok; };

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', ...opts });

// ---- (3) first, because it is cheap and it is the one that failed open ----------
const dl = run('git', ['diff', '--name-only', `${base}...${branch}`]);
if (dl.status !== 0) {
  record('ownership', false, `git diff ${base}...${branch} failed: ${dl.stderr.trim()}`);
} else {
  const files = dl.stdout.split('\n').filter(Boolean);
  if (!files.length) record('ownership', false, 'the branch changes NO files against the merge base -- nothing to merge');
  else {
    const tmp = `${process.env.TMPDIR || '/tmp'}/mg-${process.pid}.txt`;
    fs.writeFileSync(tmp, files.join('\n') + '\n');
    const o = run('node', ['tools/check-ownership.mjs', '--seat', seat, '--files-from', tmp]);
    fs.unlinkSync(tmp);
    record('ownership', o.status === 0, `${files.length} file(s)\n${(o.stdout + o.stderr).trim()}`);
  }
}

// ---- (1) the accept predicate, verbatim -----------------------------------------
if (has('--skip-accept')) {
  record('accept', true, 'SKIPPED by --skip-accept (declare why in the merge message)');
} else {
  const list = run('node', ['tools/accept-gate.mjs', node, '--list']);
  if (list.status !== 0) {
    record('accept', false, `accept-gate could not list spans for ${node}:\n${(list.stdout + list.stderr).trim()}`);
  } else {
    const spans = list.stdout.split('\n').filter((l) => /^\[\d+\]/.test(l));
    let allOk = spans.length > 0;
    const lines = [];
    for (let i = 0; i < spans.length; i++) {
      const r = run('node', ['tools/accept-gate.mjs', node, '--run', String(i)]);
      const nonCommand = /DOES NOT LOOK LIKE A SHELL COMMAND/.test(r.stdout + r.stderr);
      // A prose fragment is not a failing node -- accept-gate says so itself, and a
      // shell rejecting an English sentence must not read as a red predicate.
      const ok = r.status === 0 || nonCommand;
      if (!ok) allOk = false;
      lines.push(`  span ${i} exit ${r.status}${nonCommand ? '  (not a shell command -- not counted)' : ''}  ${spans[i].slice(0, 72)}`);
    }
    if (!spans.length) lines.push('  NO SPANS -- accept has no runnable command; this gate cannot pass it');
    record('accept', allOk, lines.join('\n'));
  }
}

// ---- (2) Layer-0 lint -------------------------------------------------------------
const lint = run('node', ['tools/lint-layer0.mjs']);
record('layer0-lint', lint.status === 0, (lint.stdout + lint.stderr).trim().split('\n').slice(-3).join('\n'));

// ---- (4) the pit -------------------------------------------------------------------
const pitPath = `kb/pits/${node}.md`;
if (has('--pit-pending')) {
  record('pit', true, `PENDING accepted by --pit-pending. The merge row MUST read pits:PENDING, and "no pit" is a legal ENTRY but no report at all is a DEBT, not a pass.`);
} else if (!fs.existsSync(pitPath)) {
  record('pit', false, `${pitPath} does not exist. Collect the seat's five fields, or pass --pit-pending to record the debt honestly.`);
} else {
  const body = fs.readFileSync(pitPath, 'utf8');
  const missing = PIT_KEYS.filter((k) => !new RegExp(`\\*\\*${k}\\b`).test(body));
  record('pit', missing.length === 0, missing.length ? `${pitPath} is missing: ${missing.join(', ')}` : `${pitPath}, all five keys`);
}

// ---- report --------------------------------------------------------------------
console.log(`\nMERGE GATE  node ${node}  seat ${seat}  branch ${branch}  (base ${base})\n`);
for (const r of results) {
  console.log(`${r.ok ? '  ok  ' : '  FAIL'}  ${r.clause}`);
  if (r.detail) console.log(r.detail.split('\n').map((l) => `        ${l}`).join('\n'));
}
const failed = results.filter((r) => !r.ok);
console.log('');
if (failed.length) {
  console.log(`REFUSED: ${failed.length} clause(s) failed -- ${failed.map((f) => f.clause).join(', ')}.`);
  console.log('Do not merge. A clause that printed its objection and was ignored is how DEV-014 landed.');
  process.exit(1);
}
console.log('ALL FOUR CLAUSES PASS. Merge, then push and verify the remote sha (R-26(b)).');
process.exit(0);
