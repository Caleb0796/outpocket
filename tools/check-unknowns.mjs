#!/usr/bin/env node
// tools/check-unknowns.mjs — node V6, owner PM.
//
// Proves that evidence/UNKNOWNS.md IS a register rather than a document that
// looks like one. The predicate in erp/graph.json is byte-literal and this file
// implements it clause for clause, because R-44 records that a LOOSE reading of
// it already passed a file a STRICT one rejects.
//
//   node tools/check-unknowns.mjs             check the real register, exit 0/1
//   node tools/check-unknowns.mjs --selftest  prove every rejection arm fires
//
// The six clauses, in the accept's own order:
//   (1) locate the four-column unknowns table
//   (2) EXACTLY six contiguous data rows and no seventh — asserted, not floored
//   (3) first cells, `**` stripped, EXACTLY equal to the ordered key list
//   (4) each raw line's FINAL BYTES are MEASURED or UNVERIFIED, no trailing pipe
//   (5) every UNVERIFIED row carries fallback:<node-id> naming a real node
//   (6) no duplicate ids, no extra cells, no duplicate fallback tokens,
//       no bare `V6`, and no status token outside the terminal position
//
// WHY EXACT STRING COMPARISON AND NEVER A REGEX (clause 3, R-43): the sixth key
// is `V6-consent-gate` and `V6` is a NODE ID in erp/graph.json — this node's own.
// /^\|\s*\**V6\b/ matches BOTH, because `-` is a word boundary. A checker that
// used \b here would call a register keyed on this node's own id well-formed.

import fs from 'node:fs';

const REGISTER = 'evidence/UNKNOWNS.md';
const GRAPH = 'erp/graph.json';

// Clause (3): the ordered key list, exact strings. The sixth ALWAYS carries its
// suffix. A bare 'V6' here would be a node id, not a finding — see R-43/R-44.
const KEYS = ['V0', 'V1', 'V2', 'V3', 'V4', 'V6-consent-gate'];
const STATUSES = ['MEASURED', 'UNVERIFIED'];
const CELLS = 4; // id | question | verdict | consequence

function nodeIds(graphText) {
  return new Set(JSON.parse(graphText).nodes.map((n) => n.id));
}

// Returns { ok, failures[], rows[] }. Never throws on malformed input — a
// checker that crashes tells you less than one that names the clause.
export function checkRegister(text, ids) {
  const fail = [];
  const lines = text.split('\n');

  // ---- clause (1): locate the four-column table -------------------------
  let header = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*id\s*\|/.test(lines[i]) && /^\|[-\s|]+\|$/.test(lines[i + 1] || '')) {
      header = i;
      break;
    }
  }
  if (header === -1) {
    return { ok: false, failures: ['(1) no four-column unknowns table found (a `| id |` header over a `|---|` rule)'], rows: [] };
  }

  // ---- clause (2): EXACTLY six CONTIGUOUS data rows, no seventh ---------
  // Contiguity matters: the count is asserted, not floored, so a seventh row
  // separated by a blank line must still be caught rather than skipped past.
  const rows = [];
  let i = header + 2;
  for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push({ raw: lines[i], n: i + 1 });

  if (rows.length !== KEYS.length) {
    fail.push(`(2) expected EXACTLY ${KEYS.length} contiguous data rows, found ${rows.length} — a register that grows a row without a ruling is not a register`);
  }

  const seen = new Set();
  const fallbacksSeen = new Set();

  for (const row of rows) {
    const { raw, n } = row;

    // ---- clause (4): FINAL BYTES are a status token, no trailing pipe ----
    // Checked on the RAW line before any splitting: `… MEASURED |` must FAIL,
    // and it would survive a check that trimmed cells first.
    const status = STATUSES.find((s) => raw.endsWith(s));
    if (!status) {
      const why = /\|\s*$/.test(raw)
        ? 'it ends in a table pipe — the missing final `|` is deliberate, do not "fix" it'
        : `it does not end in ${STATUSES.join(' or ')}`;
      fail.push(`(4) line ${n}: ${why}`);
    }
    row.status = status;

    // ---- clause (6): exactly four cells ---------------------------------
    const parts = raw.split('|');
    if (parts[0].trim() !== '') fail.push(`(6) line ${n}: content before the leading pipe`);
    const cells = parts.slice(1);
    if (cells.length !== CELLS) {
      fail.push(`(6) line ${n}: expected ${CELLS} cells, found ${cells.length}${cells.length > CELLS ? ' (extra cell, or a literal | inside a cell)' : ''}`);
      continue;
    }

    // ---- clause (3): first cell, strip ONLY surrounding `**` -------------
    const id = cells[0].trim().replace(/^\*\*/, '').replace(/\*\*$/, '');
    row.id = id;
    if (id === 'V6') {
      fail.push(`(6) line ${n}: bare \`V6\` is a NODE ID in ${GRAPH} (this node's own); the finding is \`V6-consent-gate\` — R-43`);
    }
    if (seen.has(id)) fail.push(`(6) line ${n}: duplicate id \`${id}\``);
    seen.add(id);

    const consequence = cells[3];

    // ---- clause (6): status token ONLY in the terminal position ----------
    if (status) {
      const body = consequence.slice(0, consequence.lastIndexOf(status));
      for (const s of STATUSES) {
        if (body.includes(s)) fail.push(`(6) line ${n}: status token \`${s}\` appears before the terminal position`);
      }
    }

    // ---- clause (5): UNVERIFIED requires fallback:<node-id> --------------
    // There was previously NO SYNTAX distinguishing a fallback from any other
    // node the row happens to mention, so the token is required literally.
    if (status === 'UNVERIFIED') {
      const found = [...consequence.matchAll(/fallback:([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
      if (found.length === 0) {
        fail.push(`(5) line ${n}: UNVERIFIED row carries no \`fallback:<node-id>\` token — a row with no named fallback is malformed and this node does not pass`);
      }
      if (found.length > 1) fail.push(`(6) line ${n}: ${found.length} fallback tokens; exactly one is permitted`);
      for (const f of found) {
        if (!ids.has(f)) fail.push(`(5) line ${n}: fallback \`${f}\` is not a node id in ${GRAPH}`);
        if (fallbacksSeen.has(f)) fail.push(`(6) line ${n}: fallback \`${f}\` already named by an earlier row`);
        fallbacksSeen.add(f);
      }
    }
  }

  // ---- clause (3): ordered, exact -----------------------------------------
  const got = rows.map((r) => r.id);
  if (got.length === KEYS.length && got.some((v, k) => v !== KEYS[k])) {
    fail.push(`(3) keys are [${got.join(', ')}]; expected EXACTLY [${KEYS.join(', ')}] in order`);
  }

  return { ok: fail.length === 0, failures: fail, rows };
}

// --------------------------------------------------------------------------
// --selftest. Clause (5) has NO live fixture: all six rows are MEASURED today.
// The accept says so and requires the branch be exercised synthetically rather
// than shipped unexercised — an arm no input reaches is an arm nobody has run.
// Every case below must FAIL for the reason named, and the last must PASS, so
// this cannot be satisfied by a checker that rejects everything.
// --------------------------------------------------------------------------
const HEAD = '| id | question | verdict | consequence |\n|---|---|---|---|';
const OK5 = ['V0', 'V1', 'V2', 'V3', 'V4'].map((k) => `| **${k}** | q | v | c MEASURED`);
const build = (rows) => `${HEAD}\n${rows.join('\n')}\n`;
const SIX = [...OK5, '| **V6-consent-gate** | q | v | c MEASURED'];

const CASES = [
  ['clean six-row register', build(SIX), true, null],
  ['a seventh row', build([...SIX, '| **V7** | q | v | c MEASURED']), false, '(2)'],
  ['only five rows', build(OK5), false, '(2)'],
  ['trailing table pipe', build([...OK5, '| **V6-consent-gate** | q | v | c MEASURED |']), false, '(4)'],
  ['no status token', build([...OK5, '| **V6-consent-gate** | q | v | c']), false, '(4)'],
  ['bare V6 as the sixth key', build([...OK5, '| **V6** | q | v | c MEASURED']), false, '(6)'],
  ['duplicate id', build([...OK5.slice(0, 4), '| **V3** | q | v | c MEASURED', '| **V6-consent-gate** | q | v | c MEASURED']), false, '(6)'],
  ['keys out of order', build(['| **V1** | q | v | c MEASURED', '| **V0** | q | v | c MEASURED', ...OK5.slice(2), '| **V6-consent-gate** | q | v | c MEASURED']), false, '(3)'],
  ['an extra cell', build([...OK5, '| **V6-consent-gate** | q | v | c | x MEASURED']), false, '(6)'],
  ['status token before the terminal position', build([...OK5, '| **V6-consent-gate** | q | v | MEASURED then more MEASURED']), false, '(6)'],
  // ---- clause (5), the branch with no live fixture ----
  ['UNVERIFIED with a valid fallback', build([...OK5, '| **V6-consent-gate** | q | v | c fallback:S5 UNVERIFIED']), true, null],
  ['UNVERIFIED with NO fallback token', build([...OK5, '| **V6-consent-gate** | q | v | c UNVERIFIED']), false, '(5)'],
  ['UNVERIFIED naming a non-node', build([...OK5, '| **V6-consent-gate** | q | v | c fallback:S99 UNVERIFIED']), false, '(5)'],
  ['UNVERIFIED with two fallback tokens', build([...OK5, '| **V6-consent-gate** | q | v | c fallback:S5 fallback:S1 UNVERIFIED']), false, '(6)'],
  ['no table at all', '# nothing here\n', false, '(1)'],
];

function selftest(ids) {
  let bad = 0;
  for (const [name, text, wantOk, clause] of CASES) {
    const r = checkRegister(text, ids);
    const clauseHit = clause === null || r.failures.some((f) => f.startsWith(clause));
    if (r.ok !== wantOk || !clauseHit) {
      bad++;
      console.log(`  FAIL  ${name} — expected ${wantOk ? 'PASS' : `FAIL ${clause}`}, got ${r.ok ? 'PASS' : r.failures.join(' / ')}`);
    } else {
      console.log(`  ok    ${name}${clause ? ` → rejected by ${clause}` : ''}`);
    }
  }
  console.log(`${CASES.length} selftest case(s), ${bad} unexpected`);
  return bad === 0;
}

// --------------------------------------------------------------------------
const ids = nodeIds(fs.readFileSync(GRAPH, 'utf8'));

if (process.argv.includes('--selftest')) {
  console.log('--selftest: every rejection arm must fire, and the two well-formed');
  console.log('registers must PASS — a checker that rejects everything is not a checker.');
  process.exit(selftest(ids) ? 0 : 1);
}

const result = checkRegister(fs.readFileSync(REGISTER, 'utf8'), ids);
for (const f of result.failures) console.log(`  FAIL  ${REGISTER}: ${f}`);
if (result.ok) {
  const m = result.rows.filter((r) => r.status === 'MEASURED').length;
  const u = result.rows.length - m;
  console.log(`${result.rows.length} rows: ${result.rows.map((r) => r.id).join(' ')}`);
  console.log(`  ${m} MEASURED, ${u} UNVERIFIED`);
  console.log('  ok    the unknowns register is well-formed under all six clauses');
}
process.exit(result.ok ? 0 : 1);
