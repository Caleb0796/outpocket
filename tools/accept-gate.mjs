// Generic accept-predicate runner. Reads erp/graph.json, pulls the backtick-delimited
// commands out of <node>.accept, and executes one with `sh -c`. The string that runs is
// the string in the authority — L1 never retypes a predicate.
//
//   node tools/accept-gate.mjs <NODE> --list
//   node tools/accept-gate.mjs <NODE> --show <n>
//   node tools/accept-gate.mjs <NODE> --run  <n>
//   node tools/accept-gate.mjs <NODE> --run-clean <n>   FORCE_COLOR removed
//
// See tools/l0-gate.mjs for why --run-clean exists (a harness-injected FORCE_COLOR makes
// codex colour its banner into a pipe, which breaks any predicate that greps CLI output).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const [nodeId, mode, argRaw] = process.argv.slice(2);
const g = JSON.parse(fs.readFileSync('erp/graph.json', 'utf8'));
const node = g.nodes.find((n) => n.id === nodeId);
if (!node) { console.error(`no node ${nodeId} in erp/graph.json`); process.exit(2); }

const spans = [...node.accept.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

if (mode === '--list') {
  spans.forEach((s, i) => {
    const one = s.replace(/\s+/g, ' ');
    console.log(`[${i}] ${one.length > 160 ? one.slice(0, 160) + ' …' : one}`);
  });
  process.exit(0);
}

const idx = Number(argRaw);
if (!Number.isInteger(idx) || idx < 0 || idx >= spans.length) {
  console.error('usage: accept-gate.mjs <NODE> --list | --show <n> | --run <n> | --run-clean <n>');
  process.exit(2);
}

if (mode === '--show') { process.stdout.write(spans[idx] + '\n'); process.exit(0); }

if (mode === '--run' || mode === '--run-clean') {
  const env = { ...process.env };
  if (mode === '--run-clean') delete env.FORCE_COLOR;
  console.error(`--- RUNNING VERBATIM FROM graph.json ${nodeId}.accept, span ${idx} ---`);
  console.error(spans[idx]);
  console.error('--- BEGIN OUTPUT ---');
  const r = spawnSync('sh', ['-c', spans[idx]], { stdio: 'inherit', env });
  console.error('--- EXIT ' + r.status + ' ---');
  process.exit(r.status === null ? 1 : r.status);
}

console.error('usage: accept-gate.mjs <NODE> --list | --show <n> | --run <n> | --run-clean <n>');
process.exit(2);
