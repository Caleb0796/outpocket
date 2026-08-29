import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, names, buildCleanReport } from "./helpers.mjs";
import { DESC_BUDGET, OUTPUT_BUDGET } from "../src/tools.js";

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

test("auditor surface: read-only by construction", () => {
  const w = makeWorld();
  w.erp.signIn("ruiz", "human");
  const n = names(w.toolset);
  assert.deepEqual(n.sort(), ["get_day_book", "get_expense_policy", "get_open_report", "get_session_scope", "list_expense_reports", "open_expense_report"].sort());
  for (const d of w.toolset.surface()) assert.equal(d.annotations?.readOnlyHint, true, `${d.name} must be readOnly`);
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
