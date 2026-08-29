// EVIDENCE ONLY — this is NOT node L0's gate (4) and must never be mistaken for it.
// L0 gate (4) is the loop in erp/graph.json L0.accept and it is run verbatim by
// `node tools/l0-gate.mjs --run 15`. That loop FAILS on codex-cli 0.144.6 for the
// reason this script demonstrates: the run banner emits ANSI SGR codes between the
// colon and the value, so `grep "reasoning effort: $want"` cannot match.
//
// This script re-runs the same four codex invocations, strips SGR, and reports what
// the banner ACTUALLY says — so the deviation ticket carries the measured effect of
// each profile rather than only the gate's exit code.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PAIRS = [['verifier', 'low'], ['builder', 'medium'], ['redteam', 'high'], ['evaluator', 'high']];
const SGR = /\x1b\[[0-9;]*m/g;

for (const [p, want] of PAIRS) {
  const file = path.join(os.homedir(), '.codex', `${p}.config.toml`);
  const exists = fs.existsSync(file);
  const toml = spawnSync('python3', ['-c', 'import tomllib,sys;tomllib.load(open(sys.argv[1],"rb"))', file]);
  const run = spawnSync('codex', [
    'exec', '--strict-config', '-p', p, '--ephemeral', '-s', 'read-only',
    '--skip-git-repo-check', '-o', '/dev/null', 'Reply with exactly: OK',
  ], { input: '', encoding: 'utf8', maxBuffer: 1 << 26 });

  const raw = (run.stdout || '') + (run.stderr || '');
  const rawLine = (raw.match(/.*reasoning effort:.*/) || ['<no banner line>'])[0];
  const clean = rawLine.replace(SGR, '');
  const greppedRaw = raw.includes(`reasoning effort: ${want}`);
  const greppedClean = raw.replace(SGR, '').includes(`reasoning effort: ${want}`);

  console.log(`--- ${p} (want ${want}) ---`);
  console.log(`  test -f            : ${exists ? 'PASS' : 'FAIL'}`);
  console.log(`  tomllib parse      : ${toml.status === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  banner, raw bytes  : ${JSON.stringify(rawLine)}`);
  console.log(`  banner, SGR stripped: ${JSON.stringify(clean)}`);
  console.log(`  grep on raw   (== the gate's check): ${greppedRaw ? 'MATCH' : 'NO MATCH'}`);
  console.log(`  grep after stripping SGR           : ${greppedClean ? 'MATCH' : 'NO MATCH'}`);
  console.log(`  effort actually in effect          : ${clean.split('reasoning effort:')[1]?.trim() ?? '?'}`);
  console.log();
}
