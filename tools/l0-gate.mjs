// L0 gate runner. Reads erp/graph.json, pulls the backtick-delimited commands out of
// L0.accept, and either lists them or executes one with `sh -c`. Nothing here retypes a
// predicate: the string that runs is the string in the authority.
//
//   node tools/l0-gate.mjs --list
//   node tools/l0-gate.mjs --show <n>
//   node tools/l0-gate.mjs --run  <n>          inherit this shell's environment
//   node tools/l0-gate.mjs --run-clean <n>     same command, FORCE_COLOR removed
//
// WHY --run-clean EXISTS. The resident Claude session that L1 runs inside exports
// FORCE_COLOR=3. That makes codex-cli colour its run banner even when stdout is a
// pipe, so the bytes become  ESC[1mreasoning effort:ESC[0m low  and gate (4)'s
// `grep -q "reasoning effort: $want"` cannot match — an SGR reset sits between the
// colon and the space. MEASURED 2026-08-29 by tools/l0-forcecolor-probe.mjs: with
// FORCE_COLOR unset the same invocation prints a clean `reasoning effort: low` and
// the grep matches.
//
// FORCE_COLOR is injected by the harness, not by this project, and it is not part
// of any seat's real environment. Removing it restores a normal shell; it does NOT
// edit the predicate. The command text executed by --run and --run-clean is the
// same string, taken from erp/graph.json. Gate (4) is reported against --run-clean
// for that reason, and the discrepancy is recorded in
// .team/deviations/DEV-L0-gate4-banner-grep.md rather than hidden.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const g = JSON.parse(fs.readFileSync('erp/graph.json', 'utf8'));
const accept = g.nodes.find((n) => n.id === 'L0').accept;

// Spans between single backticks. The accept text uses backticks only for runnable
// commands and for path/identifier mentions; the caller picks by index after --list.
const spans = [...accept.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

const [mode, argRaw] = process.argv.slice(2);
const idx = Number(argRaw);

if (mode === '--list') {
  spans.forEach((s, i) => {
    const oneLine = s.replace(/\s+/g, ' ');
    console.log(`[${i}] ${oneLine.length > 150 ? oneLine.slice(0, 150) + ' …' : oneLine}`);
  });
  process.exit(0);
}

if (!Number.isInteger(idx) || idx < 0 || idx >= spans.length) {
  console.error('usage: l0-gate.mjs --list | --show <n> | --run <n> | --run-clean <n>');
  process.exit(2);
}

const cmd = spans[idx];

if (mode === '--show') {
  process.stdout.write(cmd + '\n');
  process.exit(0);
}

// --run-seq <a> <b> — join two spans with ' && ' and run them in ONE shell.
// Gate (7) needs this: its first span ends with `cd /tmp/l0`, and its second span
// (`npm test > /tmp/l0/out.txt 2>&1; node -e "…"`) must run inside that clone. Run
// separately they would execute in the worktree instead, which would assert the
// property of the wrong tree — the exact mistake R-26(a) corrected. Nothing is
// rewritten; the two strings are concatenated as they stand in the authority.
if (mode === '--run-seq') {
  const j = Number(process.argv[4]);
  if (!Number.isInteger(j) || j < 0 || j >= spans.length) {
    console.error('usage: l0-gate.mjs --run-seq <a> <b>');
    process.exit(2);
  }
  const joined = spans[idx] + ' && ' + spans[j];
  console.error('--- RUNNING VERBATIM FROM graph.json L0.accept (spans ' + idx + ' && ' + j + ', one shell) ---');
  console.error(joined);
  console.error('--- BEGIN OUTPUT ---');
  const r = spawnSync('sh', ['-c', joined], { stdio: 'inherit' });
  console.error('--- EXIT ' + r.status + ' ---');
  process.exit(r.status === null ? 1 : r.status);
}

if (mode === '--run' || mode === '--run-clean') {
  const clean = mode === '--run-clean';
  const env = { ...process.env };
  if (clean) delete env.FORCE_COLOR;
  console.error('--- RUNNING VERBATIM FROM graph.json L0.accept ---');
  console.error(cmd);
  console.error(clean
    ? '--- env: FORCE_COLOR removed (harness injection, not part of the predicate) ---'
    : `--- env: inherited (FORCE_COLOR=${process.env.FORCE_COLOR ?? '<unset>'}) ---`);
  console.error('--- BEGIN OUTPUT ---');
  const r = spawnSync('sh', ['-c', cmd], { stdio: 'inherit', env });
  console.error('--- EXIT ' + r.status + ' ---');
  process.exit(r.status === null ? 1 : r.status);
}

console.error('usage: gate.mjs --list | --show <n> | --run <n>');
process.exit(2);
