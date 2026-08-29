// EVIDENCE ONLY. Isolates whether FORCE_COLOR in the caller's environment is what
// makes L0 gate (4)'s banner grep fail. Runs the same codex invocation twice — once
// with the inherited env, once with FORCE_COLOR removed — and dumps the banner bytes.
import { spawnSync } from 'node:child_process';

const ARGS = ['exec', '--strict-config', '-p', 'verifier', '--ephemeral', '-s', 'read-only',
  '--skip-git-repo-check', '-o', '/dev/null', 'Reply with exactly: OK'];

function run(label, env) {
  const r = spawnSync('codex', ARGS, { input: '', encoding: 'utf8', env, maxBuffer: 1 << 26 });
  const raw = (r.stdout || '') + (r.stderr || '');
  const line = (raw.match(/.*reasoning effort:.*/) || ['<none>'])[0];
  console.log(`--- ${label} ---`);
  console.log('  FORCE_COLOR   :', JSON.stringify(env.FORCE_COLOR ?? '<unset>'));
  console.log('  banner bytes  :', JSON.stringify(line));
  console.log('  gate grep     :', raw.includes('reasoning effort: low') ? 'MATCH' : 'NO MATCH');
  console.log();
}

run('inherited env (what the gate saw)', process.env);

const stripped = { ...process.env };
delete stripped.FORCE_COLOR;
run('FORCE_COLOR removed', stripped);
