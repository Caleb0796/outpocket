// Dispatch-block generator. Same discipline as tools/accept-gate.mjs: the ACCEPT line is
// read out of erp/graph.json and never retyped, so `.team/contracts/<node>.txt` cannot
// drift from the authority. DO and DEADLINE are the only hand-written fields, and DO is
// passed in on the command line so it is visible in the dispatch record.
//
//   node tools/contract.mjs <NODE> --deadline <iso> --do "<sentences>"   > .team/contracts/<NODE>.txt
//   node tools/contract.mjs <NODE> --accept-only                          (verbatim accept, nothing else)
import fs from 'node:fs';

const argv = process.argv.slice(2);
const nodeId = argv[0];
const g = JSON.parse(fs.readFileSync('erp/graph.json', 'utf8'));
const node = g.nodes.find((n) => n.id === nodeId);
if (!node) { console.error(`no node ${nodeId} in erp/graph.json`); process.exit(2); }

if (argv.includes('--accept-only')) { process.stdout.write(node.accept + '\n'); process.exit(0); }

const val = (flag) => { const i = argv.indexOf(flag); return i === -1 ? '' : argv[i + 1]; };
const inputs = node.inputs.length ? node.inputs.join(', ') : '(none)';

process.stdout.write(
  `NODE:      ${node.id}\n` +
  `OWNER:     ${node.owner}\n` +
  `INPUTS:    ${inputs}\n` +
  `DO:        ${val('--do')}\n` +
  `ACCEPT:    ${node.accept}\n` +
  `BRANCH:    seat/${node.owner}-${node.id}\n` +
  `DEADLINE:  ${val('--deadline')}\n`
);
