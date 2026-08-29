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

// NOT EVERY BACKTICKED SPAN IS A SHELL COMMAND. Several accepts quote a JS
// expression, a filename or a fragment of prose inside backticks — F1's span 1
// is `document.querySelectorAll('[data-persona]').length === 2`, which must be
// graded IN A BROWSER. Handed to `sh -c` it exits 2 on a syntax error, and a
// reader who does not know that reads exit 2 as the NODE failing. It is not:
// the tool asked the wrong shell to grade the wrong kind of claim. Flagged by UX
// on F1, 2026-08-29, after it had graded span 1 correctly by other means.
// This is a WARNING, not a refusal — the span still runs, because deciding what
// is "really" a command is exactly the kind of judgement a gate runner should
// not be making silently.
function looksUnrunnable(span) {
  const t = span.trim();
  if (/^(node|npm|git|test|for|rm|find|sha256sum|curl|python3|codex|cd|ls|grep|mkdir|echo)\b/.test(t)) return null;
  if (/^[A-Za-z0-9_./-]+$/.test(t)) return 'a bare path or word, not a command';
  if (/[;=]==|\bdocument\.|\bwindow\.|=>|\.length\b/.test(t)) return 'a JavaScript expression — grade it in the environment it describes';
  return 'not recognisable as a shell command';
}

if (mode === '--run' || mode === '--run-clean') {
  const env = { ...process.env };
  if (mode === '--run-clean') delete env.FORCE_COLOR;
  const warn = looksUnrunnable(spans[idx]);
  if (warn) {
    console.error(`!!! SPAN ${idx} DOES NOT LOOK LIKE A SHELL COMMAND: ${warn}.`);
    console.error(`!!! A non-zero exit below is the SHELL rejecting it, NOT the node failing.`);
    console.error(`!!! Grade this clause by the means it describes and say so in your report.`);
  }
  console.error(`--- RUNNING VERBATIM FROM graph.json ${nodeId}.accept, span ${idx} ---`);
  console.error(spans[idx]);
  console.error('--- BEGIN OUTPUT ---');
  const r = spawnSync('sh', ['-c', spans[idx]], { stdio: 'inherit', env });
  console.error('--- EXIT ' + r.status + ' ---');
  process.exit(r.status === null ? 1 : r.status);
}

console.error('usage: accept-gate.mjs <NODE> --list | --show <n> | --run <n> | --run-clean <n>');
process.exit(2);
