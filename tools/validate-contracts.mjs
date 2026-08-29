// tools/validate-contracts.mjs — node S10, owner L1.
//
// Two assertions, and they are the two S10.accept names:
//   1. an ajv 2020-12 METASCHEMA check on erp/contracts/violation.schema.json — is the schema
//      itself a legal 2020-12 schema, not "does some document validate against it";
//   2. every tool name in erp/contracts/tool-surface.contract.md RESOLVES TO A DEFINITION in
//      src/tools.js, over the union of every reachable surface state.
//
// It also asserts the converse of (2) — every definition appears in the contract — because a
// freeze that silently omits a tool freezes nothing. That is this file's own addition and it is
// declared here rather than smuggled in: S10.accept does not require it, and if it ever fails
// the fix is the CONTRACT, never the check.
//
// EXTRACTION RULE, stated so it can be argued with rather than reverse-engineered: a tool name
// is the backticked token in the FIRST CELL of a markdown table row in the contract, matching
// ^[a-z][a-z0-9]*(_[a-z0-9]+)+$. Nothing else in the document is read as a tool name, which is
// why prose may say `readOnlyHint` or `annotations` without becoming an assertion.
import fs from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { createErp, PERSONAS } from '../src/erp.js';
import { createToolset } from '../src/tools.js';

const CONTRACT = 'erp/contracts/tool-surface.contract.md';
const VIOLATION = 'erp/contracts/violation.schema.json';

let failures = 0;
const ok = (m) => console.log('  ok    ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); failures++; };

// ---- 1. ajv 2020-12 metaschema check ------------------------------------------------------
{
  const schema = JSON.parse(fs.readFileSync(VIOLATION, 'utf8'));
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  try {
    ajv.compile(schema);
    ok(`${VIOLATION} compiles as a 2020-12 schema (ajv ${JSON.parse(fs.readFileSync('node_modules/ajv/package.json', 'utf8')).version})`);
  } catch (e) {
    bad(`${VIOLATION} does not compile: ${e.message}`);
  }
  if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
    bad(`${VIOLATION} declares $schema "${schema.$schema}" — the freeze is on the 2020-12 dialect`);
  } else {
    ok('$schema is the 2020-12 dialect');
  }
}

// ---- 2. every contracted tool name resolves to a definition --------------------------------
const contracted = [];
for (const line of fs.readFileSync(CONTRACT, 'utf8').split('\n')) {
  if (!/^\s*\|/.test(line)) continue;
  const first = line.split('|')[1] ?? '';
  const m = first.match(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/);
  if (m) contracted.push(m[1]);
}
const contractedSet = new Set(contracted);

// The union of every reachable surface state. Built by DRIVING the toolset, never by reading a
// list off a document — the point of the freeze is that the document tracks the code.
function unionOfDefinitions() {
  const defs = new Map();
  const add = (ts) => { for (const d of ts.surface()) defs.set(d.name, d); };
  const world = (persona) => {
    const erp = createErp({ now: () => new Date(2026, 7, 28, 10, 0, 0) });
    const ts = createToolset(erp, { requestSignature: async () => ({ signed: true }) });
    if (persona) erp.signIn(persona, 'human');
    return { erp, ts };
  };
  let w = world(null); add(w.ts);                                            // signed out
  const employee = PERSONAS.find((p) => p.role === 'employee').id;
  const auditor = PERSONAS.find((p) => p.role !== 'employee').id;
  w = world(employee); add(w.ts);                                            // no report open
  w = world(employee);
  w.erp.createReport({ title: 'Freeze probe', project: 'FALCON' }, 'test');
  add(w.ts);                                                                 // draft open
  w.erp.addLine({ date: '2026-08-24', merchant: 'Heron Cafeteria', category: 'meals', amount: 18.2, attendees: 1, description: 'Lunch' }, 'test');
  w.erp.addLine({ date: '2026-08-24', merchant: 'T Pass', category: 'transport', amount: 12.0, description: 'Subway' }, 'test');
  add(w.ts);                                                                 // draft clean
  return defs;
}

const defs = unionOfDefinitions();
// submit_expense_report and the auditor set are reached above via the clean draft and the
// auditor persona respectively; drive the auditor separately so its read-only set is included.
{
  const erp = createErp({ now: () => new Date(2026, 7, 28, 10, 0, 0) });
  const ts = createToolset(erp, {});
  erp.signIn(PERSONAS.find((p) => p.role !== 'employee').id, 'human');
  for (const d of ts.surface()) defs.set(d.name, d);
}

console.log(`\ncontract names ${contractedSet.size}, definitions reachable ${defs.size}`);
const unresolved = [...contractedSet].filter((n) => !defs.has(n));
const uncontracted = [...defs.keys()].filter((n) => !contractedSet.has(n));
if (unresolved.length) bad(`named in ${CONTRACT} but resolving to NO definition: ${unresolved.join(' ')}`);
else ok(`every one of the ${contractedSet.size} contracted names resolves to a definition`);
if (uncontracted.length) bad(`reachable on the surface but ABSENT from ${CONTRACT}: ${uncontracted.join(' ')} — a freeze that omits a tool freezes nothing`);
else ok(`every reachable definition is named in the contract`);

// ---- 3. the read-only claim the contract makes about the auditor set is constructive --------
{
  const erp = createErp({ now: () => new Date(2026, 7, 28, 10, 0, 0) });
  const ts = createToolset(erp, {});
  erp.signIn(PERSONAS.find((p) => p.role !== 'employee').id, 'human');
  const notReadOnly = ts.surface().filter((d) => d.annotations?.readOnlyHint !== true).map((d) => d.name);
  if (notReadOnly.length) bad(`auditor surface carries non-readOnly tools: ${notReadOnly.join(' ')}`);
  else ok(`auditor surface is ${ts.surface().length} tools, every one annotations.readOnlyHint === true`);
}

console.log(failures ? `\n${failures} failure(s).` : '\nall contract assertions hold.');
process.exit(failures ? 1 : 0);
