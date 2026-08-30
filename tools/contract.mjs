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
  `PIT:       D-83 / CLAUSE 6e, RULED 2026-08-29, BINDING — THE REPORT IS A COMMIT, NOT A\n` +
  `           MESSAGE. Put the five fields in a \`PIT:\` BLOCK IN YOUR FINAL COMMIT MESSAGE on\n` +
  `           your own branch. L1 reads them with \`git log\` at the gate and writes\n` +
  `           kb/pits/${node.id}.md from them (D-31 still stands: you do NOT commit a pit FILE).\n` +
  `           COMPOSING IS COMMITTING. There is no send step to forget.\n` +
  `           WHY THIS CHANGED: four reports have been lost, in FOUR DIFFERENT WAYS — a seat\n` +
  `           that finished and went idle, a seat still running whose message never arrived, a\n` +
  `           restarted session whose transcript was gone, and two composed as ordinary\n` +
  `           conversation text and never sent. Every arrangement so far depended on a channel\n` +
  `           between you and the gate, and THE CHANNEL HAS FAILED IN FOUR WAYS OUT OF FOUR.\n` +
  `           A REPORT COMPOSED BUT NOT TRANSMITTED IS INDISTINGUISHABLE, FROM THE RECEIVING\n` +
  `           END, FROM A REPORT NEVER WRITTEN. So the mechanism removes the channel: the\n` +
  `           report rides inside the artifact being gated.\n` +
  `           Send it in your green message TOO if you like, but the commit is what counts.\n` +
  `           D-31, RULED 2026-08-29 — DO NOT COMMIT A PIT FILE. You REPORT five fields and\n` +
  `           L1 writes kb/pits/${node.id}.md from them. In order: TRIED, HAPPENED, CHANGED,\n` +
  `           EARLIER, GRADE. "No pit" is a legal ENTRY; no report at all is not, and L1\n` +
  `           cannot merge you without one.\n` +
  `           REPORT THEM IN THE SAME MESSAGE THAT SAYS YOUR ACCEPT IS GREEN, not after.\n` +
  `           Reports have been made and lost three times in this sprint, and a seat stopped\n` +
  `           before it reports takes its pit with it — one node's pit had to be written\n` +
  `           marked "NOT the seat's own report", which is worse than the node deserved.\n` +
  `           Report in YOUR OWN WORDS. L1 transcribes and names you; a pit L1 composed is\n` +
  `           worse than no pit. EARLIER is the field that pays: what you would tell\n` +
  `           yourself an hour before you learned it.\n` +
  `           (This block previously said "write it on your branch" — a contradiction with\n` +
  `           D-31 that survived a reset of mine and misled three seats, all of which\n` +
  `           correctly followed the ruling over the template and told me.)\n` +
  `BRANCH:    seat/${node.owner}-${node.id}\n` +
  `PUSH:      PUSH YOUR SEAT BRANCH AT EVERY STOPPING POINT — \`git push origin HEAD:seat/${node.owner}-${node.id}\`.\n` +
  `           A SEAT-BRANCH PUSH NEVER DEPLOYS. Render builds from \`main\` only, which L1 alone\n` +
  `           pushes, so this is free even during a push freeze on main. "Never push" in your\n` +
  `           charter means NEVER PUSH TO main — it was never a rule about your own branch.\n` +
  `           MEASURED 2026-08-29, and this line exists because of it: a full night of product\n` +
  `           work sat as LOCAL-ONLY REFS on one machine. L1 could see, verify and test it;\n` +
  `           nothing outside that filesystem could — not the monitoring sweep, not W, not a\n` +
  `           clone. It read as three seats idle with nothing delivered, and one lost worktree\n` +
  `           would have destroyed it. Work L1 has not fetched is work nobody can prove exists.\n` +
  `DEADLINE:  ${val('--deadline')}\n`
);
