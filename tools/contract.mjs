// Dispatch-block generator. Same discipline as tools/accept-gate.mjs: the ACCEPT line is
// read out of erp/graph.json and never retyped, so `.team/contracts/<node>.txt` cannot
// drift from the authority. DO and DEADLINE are the only hand-written fields, and DO is
// passed in on the command line so it is visible in the dispatch record.
//
// The PIT line is generated, not typed. It is a MERGE GATE (erp/charters/L1.md, clause 6),
// and the first four dispatch records of Day 1 omitted it: one seat wrote a pit anyway from
// its charter and one did not, which is not a difference in diligence but a difference in
// what each seat happened to carry over. A gate that is not in the contract is a gate the
// contract-holder cannot see. Caught by the peer session mcp-6d, 2026-08-29.
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
  `PIT:       kb/pits/${node.id}.md — REQUIRED BEFORE MERGE, no exceptions and no discretion.\n` +
  `           Five keys, in order: TRIED, HAPPENED, CHANGED, EARLIER, GRADE. "No pit" is a\n` +
  `           legal ENTRY; a missing FILE is not. One paragraph per key is enough. Write it\n` +
  `           on your branch. (kb/pits/** is glob-owned by L1 while the merge gate demands\n` +
  `           the file from you — that contradiction is L1's to carry to PM, not yours to\n` +
  `           resolve. Write the file; L1 absorbs the ownership finding.)\n` +
  `BRANCH:    seat/${node.owner}-${node.id}\n` +
  `DEADLINE:  ${val('--deadline')}\n`
);
