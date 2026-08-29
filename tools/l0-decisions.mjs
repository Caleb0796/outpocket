// L0 helper — generates erp/DECISIONS.md by lifting the D-17 row VERBATIM out of
// erp/RUNBOOK.md §2 ("The D-17 row, literally"). No hand-copied row, no second
// copy of the ruling. Run from the repository root.
import fs from 'node:fs';

const rb = fs.readFileSync('erp/RUNBOOK.md', 'utf8');
const m = rb.match(/```markdown\n(\| ID \| Date \| Ruling \| Consequence \|\n[\s\S]*?)```/);
if (!m) { console.error('RUNBOOK §2 D-17 block not found'); process.exit(1); }
const table = m[1].replace(/\n+$/, '\n');
if (!/^\|\s*D-17\s*\|/m.test(table)) { console.error('no D-17 row in the block'); process.exit(1); }

const header = `# Decisions register — outpocket sprint A

Rulings of record. Created by node **L0** on Day 0 (2026-08-28); node **V6** appends its
unknowns rows to this same file on Day 2 and does not create it.

The D-17 row below is reproduced verbatim from \`erp/RUNBOOK.md\` §2, *The D-17 row, literally*.
\`L0\` accept gate (1) matches it with \`^\\|\\s*D-17\\s*\\|[^\\n]*human_hours_per_day\\s*=\\s*([0-9.]+)\`,
requires the captured value to be \`2.5\` or \`3.0\`, and requires \`erp/graph.json\`
\`capacity.human_hours_available\` to equal that value x 5.5. If you change a digit here, change
\`capacity.human_hours_available\` in the same edit or the gate fails — which is what it is for.

D-17 was RULED by the user directly on 2026-08-28, before any seat was dispatched. L0 does not
decide it; L0 records it.

## Rulings

`;

fs.writeFileSync('erp/DECISIONS.md', header + table);
console.log('wrote erp/DECISIONS.md');
