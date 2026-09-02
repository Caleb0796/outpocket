// Node T4 (QA). Conformance of the tool surface against the frozen contract,
// erp/contracts/tool-surface.contract.md §2, in every one of the six canonical
// states S0-S5 (§1). The frozen four remain, with annotation specificity added
// beside them and one test guarding the copied table against drift from its source:
//
//   1. every description length <= 500
//   2. the annotations object contains only keys from {readOnlyHint, untrustedContentHint}
//   3. no tool definition contains the banned IR-4 output-schema key (kb/webmcp/BANNED.txt)
//   4. every read-only tool (per the frozen §2 column) carries readOnlyHint: true
//   5. all seven writes carry explicit readOnlyHint: false and
//      untrustedContentHint: true because their results can echo supplied text
//   6. all seven reads that can echo untrusted content carry untrustedContentHint,
//      while the three reads backed only by server-owned session/policy records do not
//
// "Read-only" for (4) is not derived from anything in this repo's runtime code —
// it is copied verbatim from the frozen table, because that column is exactly what
// downstream is permitted to rely on (contract §3) and what R-9/T6 fixed. A
// definition-side hint checked against itself would prove nothing.
//
// Property (3)'s key name is IR-4 in kb/webmcp/BANNED.txt and tools/lint-layer0.mjs
// bans the literal identifier anywhere in a scanned file — including here, including
// in a comment. It is assembled below from two non-matching halves for that reason.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeWorld, buildCleanReport } from "../helpers.mjs";
import { DESC_BUDGET } from "../../src/tools.js";

const CONTRACT_PATH = fileURLToPath(new URL("../../erp/contracts/tool-surface.contract.md", import.meta.url));

// Frozen, erp/contracts/tool-surface.contract.md §2. Seventeen tools, "read-only" column.
// This is a deliberate COPY, not a derivation — the point of a conformance test is to
// pin what the contract SAID independently of what the code does. But a copy can go
// stale silently: nothing here would go red if §2 grew a tool and this object didn't.
// parseFrozenReadonlyTable() below re-reads §2 at test time and readOnlyTableMatchesContract
// asserts this copy still equals its source, so drift becomes a failure instead of a
// silent narrowing of coverage.
const READONLY = Object.freeze({
  get_signin_status: true,
  get_session_scope: true,
  get_expense_policy: true,
  list_expense_reports: true,
  create_expense_report: false,
  open_expense_report: false,
  get_open_report: true,
  add_expense_line: false,
  update_expense_line: false,
  remove_expense_line: false,
  list_receipts: true,
  link_receipt: false,
  validate_expense_report: true,
  submit_expense_report: false,
  get_report: true,
  get_day_book: true,
  explain_missing_tool: true,
});

// Parses the "| tool | read-only | states | description budget |" table out of §2 —
// located by its own header row, not by a line number, so it survives the document
// being re-cut around it. Stops at the first line after the header that isn't a
// "| `name` | yes|NO | ... |" row.
function parseFrozenReadonlyTable(contractText) {
  const lines = contractText.split("\n");
  const headerIdx = lines.findIndex((l) => /^\|\s*tool\s*\|\s*read-only\s*\|/.test(l));
  assert.ok(headerIdx >= 0, "could not find the §2 tool/read-only table header in the frozen contract");

  const rowPattern = /^\|\s*`([a-zA-Z0-9_]+)`\s*\|\s*(yes|NO)\s*\|/;
  const table = {};
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const m = lines[i].match(rowPattern);
    if (!m) break;
    table[m[1]] = m[2] === "yes";
  }
  assert.ok(Object.keys(table).length > 0, "parsed zero rows out of the §2 table — parser or table shape has drifted");
  return table;
}

const ALLOWED_ANNOTATION_KEYS = new Set(["readOnlyHint", "untrustedContentHint"]);

const WRITE_TOOLS = new Set([
  "create_expense_report", "open_expense_report", "add_expense_line",
  "update_expense_line", "remove_expense_line", "link_receipt", "submit_expense_report",
]);

const UNTRUSTED_READS = new Set([
  "list_expense_reports", "get_open_report", "get_report",
  "list_receipts", "validate_expense_report", "get_day_book", "explain_missing_tool",
]);

const SERVER_OWNED_READS = new Set([
  "get_signin_status", "get_session_scope", "get_expense_policy",
]);

// IR-4, assembled to avoid the banned contiguous literal — see the header note.
const BANNED_OUTPUT_KEY = ["output", "Schema"].join("");

// One world per canonical state (erp/contracts/tool-surface.contract.md §1), built
// the same way tests/surface.test.mjs already drives S1-S5.
async function sixStates() {
  const states = {};

  states.S0 = makeWorld();

  const s1 = makeWorld();
  s1.erp.signIn("chen", "human");
  states.S1 = s1;

  const s3 = makeWorld();
  s3.erp.signIn("chen", "human");
  await buildCleanReport(s3);
  states.S3 = s3;

  const s2 = makeWorld();
  s2.erp.signIn("chen", "human");
  await buildCleanReport(s2);
  s2.erp.addLine({ date: s2.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  states.S2 = s2;

  const s4 = makeWorld();
  s4.erp.signIn("chen", "human");
  s4.erp.openReport("RP-1017", "test"); // seeded, already submitted
  states.S4 = s4;

  const s5 = makeWorld();
  s5.erp.signIn("ruiz", "human");
  states.S5 = s5;

  return states;
}

function assertConformance(stateId, defs) {
  assert.ok(defs.length > 0, `${stateId}: surface is empty — nothing was checked`);
  for (const d of defs) {
    assert.ok(
      d.description.length <= DESC_BUDGET,
      `${stateId}/${d.name}: description is ${d.description.length} chars, budget is ${DESC_BUDGET}`
    );

    const annoKeys = Object.keys(d.annotations ?? {});
    for (const k of annoKeys)
      assert.ok(ALLOWED_ANNOTATION_KEYS.has(k), `${stateId}/${d.name}: annotation key "${k}" is not readOnlyHint or untrustedContentHint`);

    assert.ok(!(BANNED_OUTPUT_KEY in d), `${stateId}/${d.name}: definition carries a banned IR-4 output-schema key`);
    assert.ok(!("title" in d), `${stateId}/${d.name}: title is outside this round's exported definition shape`);

    if (READONLY[d.name] === true)
      assert.equal(d.annotations?.readOnlyHint, true, `${stateId}/${d.name}: frozen contract marks this read-only but readOnlyHint !== true`);
    if (WRITE_TOOLS.has(d.name))
      assert.deepEqual(
        d.annotations,
        { readOnlyHint: false, untrustedContentHint: true },
        `${stateId}/${d.name}: echoing write annotation must be explicit and exact`
      );
    if (UNTRUSTED_READS.has(d.name))
      assert.deepEqual(
        d.annotations,
        { readOnlyHint: true, untrustedContentHint: true },
        `${stateId}/${d.name}: this read can return untrusted text`
      );
    if (SERVER_OWNED_READS.has(d.name))
      assert.deepEqual(
        d.annotations,
        { readOnlyHint: true },
        `${stateId}/${d.name}: server-owned text must not be marked as employee-authored`
      );
  }
}

test("the copied read-only table still matches erp/contracts/tool-surface.contract.md §2", () => {
  const contractText = readFileSync(CONTRACT_PATH, "utf8");
  const fromContract = parseFrozenReadonlyTable(contractText);
  assert.deepEqual(
    { ...READONLY },
    fromContract,
    "READONLY in this file has drifted from §2 of the frozen contract — update the copy, not this assertion"
  );
});

test("tool surface conforms to the frozen contract in every one of the six canonical states", async () => {
  const states = await sixStates();
  assert.deepEqual(Object.keys(states).sort(), ["S0", "S1", "S2", "S3", "S4", "S5"], "did not reach all six canonical states");
  for (const [stateId, world] of Object.entries(states)) {
    assert.equal(world.toolset.state(), stateId, `helper built ${stateId} but the compiler reports a different state`);
    assertConformance(stateId, world.toolset.surface());
  }
});
