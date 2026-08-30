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
// --mainline exists so this check can be TESTED. A guard I cannot point at a known-bad
// pair is a guard I have not seen fire, which is the thing this file exists to prevent.
const mainline = val('--mainline') || 'origin/main';
if (!node || !seat || !branch) {
  console.error('usage: merge-gate.mjs --node <ID> --seat <SEAT> --branch <REF> [--base main] [--pit-pending] [--skip-accept]');
  process.exit(2);
}

const PIT_KEYS = ['TRIED', 'HAPPENED', 'CHANGED', 'EARLIER', 'GRADE'];
const results = [];
const record = (clause, ok, detail) => { results.push({ clause, ok, detail }); return ok; };

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', ...opts });

// ---- A HAND-PASSED --base THAT IS NOT THE MERGE-BASE IS AN ERROR, AND IT WAS MINE ----
// I gated S6 with --base pointing at a commit four merges older than the branch point.
// Three-dot diff against it swept in every file main had gained since, and the gate
// reported 10 ownership violations against a seat that had touched four files. The gate
// was RIGHT to refuse -- but it refused for a reason that was my input, not the node,
// and a foreman in a hurry reads that as the seat's problem. So: check.
// THE REFERENCE IS origin/main, NOT the passed base, AND THAT MATTERS. My first cut
// compared --base against `git merge-base <base> <branch>` -- which EQUALS <base>
// whenever base is any older ancestor, so THE CHECK VALIDATED ITS OWN BAD INPUT and
// exited 0 on the exact argument that had just produced 10 false violations. A check
// whose reference is derived from the thing it is checking is not a check. origin/main
// works because this gate runs BEFORE the push, so the remote still sits at the branch
// point.
// MULTIPLE MERGE BASES MAKE THE THREE-DOT DIFF UNRELIABLE, and I hit this after
// building the base check that was supposed to stop exactly this family. A branch that
// has merged main back into itself can share more than one merge base with main; `git
// merge-base` then picks ONE ARBITRARILY and `A...B` diffs against that pick. On
// 2026-08-29 that reported SIX ownership violations against PM for files PM never
// touched -- E2's outputs, my own merge log -- and I MERGED ANYWAY after reading them,
// which is DEV-014's shape a second time. git itself warns ("multiple merge bases,
// using ...") and the warning goes to stderr where a piped check swallows it.
{
  const all = run('git', ['merge-base', '--all', mainline, branch]);
  const n = (all.stdout || '').trim().split('\n').filter(Boolean).length;
  if (n > 1) {
    console.log(`\n!!! ${branch} has ${n} MERGE BASES with ${mainline}.`);
    console.log(`    A three-dot diff picks one arbitrarily, so the file list -- and every`);
    console.log(`    ownership verdict drawn from it -- is unreliable. Compare against the`);
    console.log(`    branch's own commits instead: git log origin/main..${branch} --name-only`);
    process.exit(2);
  }
}
if (val('--base')) {
  const mb = run('git', ['merge-base', 'origin/main', branch]);
  const bs = run('git', ['rev-parse', base]);
  if (mb.status === 0 && bs.status === 0 && mb.stdout.trim() !== bs.stdout.trim()) {
    console.log(`\n!!! --base ${base} IS NOT THE MERGE-BASE of ${branch}.`);
    console.log(`    merge-base(origin/main, ${branch}) is ${mb.stdout.trim().slice(0, 12)}. Diffing against the wrong`);
    console.log(`    base attributes every file main gained since to this seat. Omit --base.`);
    process.exit(2);
  }
}

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
  // CLAUSE 6e (D-83): the report now rides in the seat's COMMIT, not a message. This gate
  // still requires the FILE, because the merge record points at it and L1 writes it -- but
  // it must say WHERE the report is, or a foreman reads "does not exist" as "the seat owed
  // me a report and did not send one" when in fact the report is sitting in the branch it
  // is being asked to merge. V4 hit exactly that: I1 delivered under 6e, correctly, and the
  // gate reported a debt.
  const log = run('git', ['log', `${base}..${branch}`, '--format=%B']);
  const hasBlock = /^PIT:/m.test(log.stdout || '');
  record('pit', false, hasBlock
    ? `${pitPath} does not exist YET -- but the branch CARRIES a clause-6e PIT: block.\n`
      + `Transcribe it:  git log ${base}..${branch} --format=%B | sed -n '/^PIT:/,$p'\n`
      + `then write ${pitPath} in the seat's own words and re-run this gate.`
    : `${pitPath} does not exist, and the branch carries NO PIT: block either.\n`
      + `Ask once in the merge exchange, then --pit-pending to record the debt honestly.`);
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
