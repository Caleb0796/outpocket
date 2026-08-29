// L0 gate runner. Reads erp/graph.json, pulls the backtick-delimited commands out of
// L0.accept, and either lists them or executes one with `sh -c`. Nothing here retypes a
// predicate: the string that runs is the string in the authority.
//
//   node .team/log/gate.mjs --list
//   node .team/log/gate.mjs --show <n>
//   node .team/log/gate.mjs --run  <n>
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
  console.error('usage: gate.mjs --list | --show <n> | --run <n>');
  process.exit(2);
}

const cmd = spans[idx];

if (mode === '--show') {
  process.stdout.write(cmd + '\n');
  process.exit(0);
}

if (mode === '--run') {
  console.error('--- RUNNING VERBATIM FROM graph.json L0.accept ---');
  console.error(cmd);
  console.error('--- BEGIN OUTPUT ---');
  const r = spawnSync('sh', ['-c', cmd], { stdio: 'inherit' });
  console.error('--- EXIT ' + r.status + ' ---');
  process.exit(r.status === null ? 1 : r.status);
}

console.error('usage: gate.mjs --list | --show <n> | --run <n>');
process.exit(2);
