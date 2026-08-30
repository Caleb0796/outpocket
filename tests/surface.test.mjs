import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeWorld, names, buildCleanReport } from "./helpers.mjs";
import { DESC_BUDGET, OUTPUT_BUDGET } from "../src/tools.js";
import { digest } from "../src/canonical.js";

test("signed out: the surface is a single explainer tool", () => {
  const w = makeWorld();
  assert.deepEqual(names(w.toolset), ["get_signin_status"]);
});

test("employee surface grows with state: 5 → 12 → 13 (door) → shrinks when dirty", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  assert.equal(names(w.toolset).length, 5);
  assert.ok(!names(w.toolset).includes("add_expense_line"));

  await buildCleanReport(w);
  const n = names(w.toolset);
  assert.equal(n.length, 13, `expected the clean-draft surface, got: ${n.join(",")}`);
  assert.ok(n.includes("submit_expense_report"), "door open when clean");

  // dirty it → the door closes
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  assert.ok(!names(w.toolset).includes("submit_expense_report"), "door closes when a blocking violation appears");
  assert.equal(names(w.toolset).length, 12);
});

test("auditor surface: read-only by construction", async () => {
  const w = makeWorld();
  w.erp.signIn("ruiz", "human");
  const n = names(w.toolset);
  assert.deepEqual(n.sort(), ["get_day_book", "get_expense_policy", "get_open_report", "get_report", "get_session_scope", "list_expense_reports"].sort());
  for (const d of w.toolset.surface()) assert.equal(d.annotations?.readOnlyHint, true, `${d.name} must be readOnly`);

  // Constructive, not a hint we ask a model to believe: run every tool the
  // auditor actually has and prove none of them moved the page or the log.
  // open_expense_report is off this surface precisely because it fails that —
  // it sets openReportId and appends to the day book (R-9 option (B)).
  const someReport = w.erp.listReports()[0].id;
  const before = { open: w.erp.state.openReportId, book: w.erp.state.dayBook.length };
  for (const name of n) {
    const res = await w.dispatch(name, { report_id: someReport });
    assert.ok(res.content[0].text.length > 0, `${name} returned nothing`);
  }
  const got = await w.dispatch("get_report", { report_id: someReport });
  assert.match(got.content[0].text, new RegExp(someReport), "get_report must read the report it was asked for");
  assert.equal(w.erp.state.openReportId, before.open, "no auditor tool may move the open report");
  assert.equal(w.erp.state.dayBook.length, before.book, "no auditor tool may append to the day book");
});

test("submitted reports expose no editing tools", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  w.erp.openReport("RP-1017", "test"); // seeded, already submitted
  const n = names(w.toolset);
  assert.ok(n.includes("get_open_report"));
  for (const gone of ["add_expense_line", "update_expense_line", "remove_expense_line", "link_receipt", "submit_expense_report"])
    assert.ok(!n.includes(gone), `${gone} must not exist on a submitted report`);
});

test("descriptions fit the official 500-char budget in every state", async () => {
  const w = makeWorld();
  const check = () => {
    for (const d of w.toolset.surface()) {
      assert.ok(d.description.length <= DESC_BUDGET, `${d.name} description is ${d.description.length} chars`);
      assert.match(d.name, /^[a-z][a-z_]*$/);
      assert.ok(d.inputSchema?.type === "object");
    }
  };
  check();
  w.erp.signIn("chen", "human");
  check();
  await buildCleanReport(w);
  check();
  w.erp.signOut("human");
  w.erp.signIn("ruiz", "human");
  check();
});

test("double lock: a captured submit tool refuses after the surface moved on", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  await buildCleanReport(w);
  const submit = w.toolset.surface().find((d) => d.name === "submit_expense_report");
  assert.ok(submit);
  // report goes dirty AFTER capture — the old handle must not submit
  w.erp.addLine({ date: w.dates.cab, merchant: "Big Dinner", category: "meals", amount: 300.0, attendees: 1 }, "test");
  const res = await w.toolset.runTool(submit, {}, {}, "test");
  assert.match(res.content[0].text, /no longer on the surface/);
  assert.equal(w.erp.openReportOrNull().status, "draft");
});

test("calling an unregistered tool names the real surface", async () => {
  const w = makeWorld();
  const res = await w.dispatch("submit_expense_report", {});
  assert.match(res.content[0].text, /No tool named/);
  assert.match(res.content[0].text, /get_signin_status/);
});

test("auditor writes are impossible twice over: no tool AND a 403 underneath", async () => {
  const w = makeWorld();
  w.erp.signIn("ruiz", "human");
  const res = await w.dispatch("create_expense_report", { title: "x", project: "FALCON" });
  assert.match(res.content[0].text, /No tool named/); // surface lock
  assert.throws(() => w.erp.createReport({ title: "x", project: "FALCON" }, "test"), /403/); // session lock
});

test("every tool output in a busy session respects the 1500-char budget", async () => {
  const w = makeWorld();
  w.erp.signIn("chen", "human");
  w.erp.createReport({ title: "Messy report with a very long title that keeps going on and on", project: "FALCON" }, "test");
  for (let i = 0; i < 12; i++) {
    w.erp.addLine({
      date: "2026-04-01", merchant: `Grand Continental Palace Hotel & Convention Resort ${i}`, category: "lodging",
      amount: 900 + i, nights: 1, currency: "EUR",
      itemization: [{ label: "Champagne welcome package deluxe", amount: 200 }, { label: "Room and extended incidentals bundle", amount: 700 + i }],
      description: "An unnecessarily long description of the stay to stress the output budget of the tools",
    }, "test");
  }
  for (const name of ["validate_expense_report", "get_open_report", "list_expense_reports", "get_expense_policy", "get_session_scope", "list_receipts"])
    await w.dispatch(name, {});
  for (const text of w.outputs)
    assert.ok(text.length <= OUTPUT_BUDGET, `output of ${text.slice(0, 40)}… is ${text.length} chars`);
});

// ── node T5: the blind export ──────────────────────────────────────────────────
// These assert against the FILE, not against the compiler that produced it, because
// the file is C1's entire world: C1 sees artifacts/tools.export.json and one task
// list and nothing else. Every did-not-change assertion below is committed beside a
// control showing the same operation could have produced a different answer.

const EXPORT = JSON.parse(readFileSync(new URL("../artifacts/tools.export.json", import.meta.url), "utf8"));
const stateOf = (id) => {
  const s = EXPORT.states.find((x) => x.state_id === id);
  assert.ok(s, `no state ${id} in the export`);
  return s;
};
const namesOf = (id) => stateOf(id).tools.map((t) => t.name);

test("T5 export: six canonical states in the frozen order", () => {
  assert.equal(EXPORT.schema, "outpocket.tool_export/1");
  assert.deepEqual(EXPORT.states.map((s) => s.state_id),
    ["S0-anon", "S1-emp-home", "S2-emp-draft-clean", "S3-emp-draft-dirty", "S4-emp-submitted", "S5-aud"]);
});

test("T5 export: the ids cross over at 2/3 — clean is 13 tools, dirty is 12", () => {
  // compile.js's internal S2 is the DIRTY draft and its S3 is the CLEAN one, while
  // the export's S2-… is clean and its S3-… is dirty. The digit does not carry over.
  // Mapping by it would publish submit_expense_report on the surface that holds a
  // blocking violation, and the state count, the id order and every digest would
  // still check out — wrong quietly, which is the whole reason this test exists.
  const clean = namesOf("S2-emp-draft-clean");
  const dirty = namesOf("S3-emp-draft-dirty");
  assert.equal(clean.length, 13);
  assert.equal(dirty.length, 12);
  assert.ok(clean.includes("submit_expense_report"), "the clean draft is the one that can be submitted");
  assert.ok(!dirty.includes("submit_expense_report"), "a blocking violation takes the door away");
  assert.deepEqual(clean.filter((n) => n !== "submit_expense_report"), dirty, "and they differ by that one name only");
});

test("T5 export: every surface_digest recomputes under OCF-1 — and the digest moves when the surface does", () => {
  for (const st of EXPORT.states) {
    assert.equal(digest("outpocket/surface/1", st.tools), st.surface_digest, st.state_id);
  }
  // Control, from the same operation: one character of one description moved, and
  // the digest must move with it. Without this the loop above would pass over a
  // digest function that returned a constant.
  const tampered = JSON.parse(JSON.stringify(stateOf("S5-aud").tools));
  tampered[0].description += ".";
  assert.notEqual(digest("outpocket/surface/1", tampered), stateOf("S5-aud").surface_digest);
  // Control, on membership rather than text: dropping a tool must move it too.
  assert.notEqual(digest("outpocket/surface/1", stateOf("S5-aud").tools.slice(1)), stateOf("S5-aud").surface_digest);
});

test("T5 export: counting tools cannot tell the auditor from the employee", () => {
  // This is why the export carries six states and why everything downstream compares
  // SETS of names. A count assertion passes here even when the auditor has been
  // handed the employee's surface.
  const submitted = stateOf("S4-emp-submitted");
  const auditor = stateOf("S5-aud");
  assert.equal(submitted.tools.length, auditor.tools.length, "both surfaces carry six tools");
  assert.notDeepEqual(namesOf("S4-emp-submitted").slice().sort(), namesOf("S5-aud").slice().sort(),
    "and they are not the same six");
  assert.notEqual(submitted.surface_digest, auditor.surface_digest);
});

test("T5 export: the auditor surface is read-only by construction", () => {
  for (const t of stateOf("S5-aud").tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} must be readOnly`);
  // R-20: the write set is the filter's result, never a typed number.
  assert.deepEqual(stateOf("S5-aud").tools.filter((t) => t.annotations?.readOnlyHint !== true), []);
  // Control: the same filter over a surface that does hold write tools is not empty,
  // so the emptiness above is a fact about the auditor and not about the filter.
  assert.ok(stateOf("S2-emp-draft-clean").tools.filter((t) => t.annotations?.readOnlyHint !== true).length > 0);
});

test("T5 export: blind — only the four fields a client agent's model can see", () => {
  const permitted = ["annotations", "description", "inputSchema", "name"];
  for (const st of EXPORT.states) {
    for (const t of st.tools) {
      for (const k of Object.keys(t)) assert.ok(permitted.includes(k), `${t.name} carries ${k}`);
      for (const k of Object.keys(t.annotations ?? {}))
        assert.ok(k === "readOnlyHint" || k === "untrustedContentHint", `${t.name} carries annotation ${k}`);
      assert.ok(t.description.length <= DESC_BUDGET, `${t.name} description is ${t.description.length} chars`);
    }
  }
  // The contract's x-forbiddenKeys are KEYS, so they are scanned as keys and not as
  // text: `session` is on that list and `get_session_scope` is a legitimate tool
  // name, so a substring sweep would report a leak that is not there. The list is
  // READ from the frozen contract rather than typed — partly so a bump to the
  // contract binds this test, and partly because several of those keys are
  // identifiers layer-0 bans outright, which is exactly why none may appear.
  const contract = JSON.parse(readFileSync(new URL("../erp/contracts/tool-export.schema.json", import.meta.url), "utf8"));
  const forbidden = contract["x-forbiddenKeys"].keys;
  const keysIn = (node, out = []) => {
    if (!node || typeof node !== "object") return out;
    if (Array.isArray(node)) { for (const v of node) keysIn(v, out); return out; }
    for (const k of Object.keys(node)) { out.push(k); keysIn(node[k], out); }
    return out;
  };
  const present = keysIn(EXPORT);
  for (const k of forbidden) assert.ok(!present.includes(k), `the export carries the key ${k}`);
  // Control: the same walk over an object that does carry one must find it.
  assert.ok(keysIn({ states: [{ [forbidden[0]]: 1 }] }).includes(forbidden[0]));

  // Paths and repo identifiers are text, and are scanned as text.
  const raw = readFileSync(new URL("../artifacts/tools.export.json", import.meta.url), "utf8");
  for (const leak of ["src/", ".js", "countinghouse", "/Users/"])
    assert.ok(!raw.includes(leak), `the export leaks ${leak}`);
});
