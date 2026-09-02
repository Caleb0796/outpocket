// tests/acceptance/editor.test.mjs — node F2 (lane F, owner UX).
//
// F2's predicate: every field cell carries data-source in {agent,human}, and
// after a human edit of an agent-written field the cell exposes BOTH
// data-source="human" and data-prev-source="agent".
//
// THREE WAYS THAT PASSES WHILE PROVING NOTHING, ALL THREE CLOSED HERE.
//
//  1. It is true of ZERO cells, and true of a page that hardcodes
//     data-source="agent" on every cell. So: the cell count is asserted
//     non-zero AND equal to the real number of authored fields, and BOTH
//     values are asserted to occur IN THE SAME RENDER. A renderer that can
//     emit "human" and never does is a renderer, not a provenance display.
//
//  2. "after a human edit ... exposes both" is satisfied by setting
//     data-prev-source unconditionally. So: a field the human did NOT touch is
//     asserted to carry NO data-prev-source in that same render. An attribute
//     that appears everywhere records nothing.
//
//  3. THE ATTRIBUTE IS NOT THE CLAIM. A judge reads the PAGE. A cell carrying
//     data-source="human" while showing a person nothing has satisfied the
//     predicate and communicated nothing. So the provenance is asserted to be
//     VISIBLE TEXT, and the legend that explains the marks is asserted too —
//     the same thing I asserted in F5 for the simulation notice, for the same
//     reason.
//
// AND THE FIXTURE IS NOT FABRICATED. Every report here is built by REAL writes
// through server/store.mjs — a real agent write with a tool name, a real human
// edit — and the provenance is whatever the ledger recorded. Seeding a report
// with hand-written provenance would make this file ASSERT THE THING IT IS
// SUPPOSED TO CHECK, which is the defect I shipped in check-storyboard's
// sign-open state and did not notice for four commits.

import test from "node:test";
import assert from "node:assert/strict";

import { createReportStore } from "../../server/store.mjs";
import { LINE_FIELDS, REPORT_FIELDS } from "../../server/store.mjs";
import { PERSONAS } from "../../src/erp.js";
import { toUsdCents, validateReport } from "../../src/policy.js";
import {
  renderEditor, mountCachedEditor, fieldCells, previousSource, provenanceText,
  AUTHORED_SOURCES, EMPTY_EDITOR_TEXT,
} from "../../src/page/ui/editor.js";

// ── a fake document, same approach as banner.test.mjs and sign-dialog's ─────

function makeDoc() {
  const node = (tag) => ({
    tagName: String(tag).toUpperCase(), attributes: new Map(), children: [], _text: "",
    setAttribute(k, v) { this.attributes.set(k, String(v)); },
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; },
    hasAttribute(k) { return this.attributes.has(k); },
    appendChild(c) { this.children.push(c); return c; },
    set textContent(v) { this._text = String(v); this.children = []; },
    get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join(" ") : this._text; },
    matches(sel) {
      const m = /^\[([a-z0-9-]+)(?:="([^"]*)")?\]$/i.exec(sel);
      if (!m) return false;
      const [, name, want] = m;
      return this.attributes.has(name) && (want === undefined || this.attributes.get(name) === want);
    },
    querySelectorAll(sel) {
      const out = [];
      for (const c of this.children) { if (c.matches(sel)) out.push(c); out.push(...c.querySelectorAll(sel)); }
      return out;
    },
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
  });
  return { createElement: node };
}

function makeMountedDoc() {
  const doc = makeDoc();
  const region = doc.createElement("section");
  region.setAttribute("data-region", "editor");
  doc.querySelector = (sel) => region.matches(sel) ? region : region.querySelector(sel);
  return { doc, region };
}

// ── the REAL path: an agent write, then a human override ────────────────────

const AGENT = (tool) => ({ source: "agent", actor: "agent", tool });
const HUMAN = { source: "human", actor: "chen" };

/**
 * Drive real writes. The agent creates the report and files a line; the human
 * then corrects ONE field of it. Nothing here hand-writes a provenance record.
 */
function agentFiledThenHumanCorrected() {
  const store = createReportStore();
  const report = store.createReport(
    { title: "Boston client workshop", project: "FALCON" },
    { ...AGENT("create_expense_report"), revision: 0 });

  store.addLine(report.id, {
    merchant: "Blue Bottle", amount: 1200, category: "meals",
    date: "2026-08-20", currency: "USD", attendees: 1, description: "Coffee with the client",
  }, { ...AGENT("add_expense_line"), revision: 1 });

  const lineId = store.getReport(report.id).lines[0].id;
  // the human corrects the amount the agent proposed, and NOTHING ELSE
  store.updateLine(report.id, lineId, { amount: 900 }, { ...HUMAN, revision: 2 });

  return { store, report: store.getReport(report.id), ledger: store.dayBook(), lineId };
}

function agentFiledAmounts(rows) {
  const store = createReportStore();
  const created = store.createReport(
    { title: "Portland site visit", project: "HERON" },
    { ...AGENT("create_expense_report"), revision: 0 });
  rows.forEach(({ amount, currency = "USD" }, index) => {
    store.addLine(created.id, {
      merchant: `Merchant ${index + 1}`, amount, category: "transport",
      date: "2026-08-20", currency, description: "Site transfer",
    }, { ...AGENT("add_expense_line"), revision: index + 1 });
  });
  return { store, report: store.getReport(created.id), ledger: store.dayBook() };
}

function policyView(report) {
  const value = (fields, name) => fields[name]?.value ?? null;
  return {
    id: report.id,
    project: value(report.fields, "project"),
    lines: report.lines.map((line) => {
      const amountCents = value(line.fields, "amount");
      const currency = value(line.fields, "currency");
      return {
        id: line.id,
        date: value(line.fields, "date"),
        merchant: value(line.fields, "merchant"),
        category: value(line.fields, "category"),
        amountCents,
        currency,
        usdCents: amountCents === null ? null : toUsdCents(amountCents, currency),
        attendees: value(line.fields, "attendees") ?? undefined,
        nights: value(line.fields, "nights") ?? undefined,
        itemization: value(line.fields, "itemization") ?? undefined,
        description: value(line.fields, "description"),
        receiptId: value(line.fields, "receipt_id"),
      };
    }),
  };
}

function verdictFor(report) {
  return validateReport(policyView(report), PERSONAS.find((persona) => persona.id === "chen"), {
    now: new Date("2026-09-01T12:00:00Z"),
    receiptById: () => null,
    priorHashUse: () => null,
  });
}

// ── clause 1: every cell carries a source, and both values really occur ─────

test("every field cell carries data-source in {agent,human}, and there is more than zero of them", () => {
  const { report, ledger } = agentFiledThenHumanCorrected();
  const root = renderEditor(makeDoc(), { report, ledger });
  const cells = root.querySelectorAll("[data-field-cell]");

  assert.ok(cells.length > 0, "no field cells rendered — the predicate is vacuously true of zero");

  // and the count is the REAL number of authored fields, not whatever rendered
  const authored = fieldCells(report, ledger).length;
  assert.equal(cells.length, authored,
    "the rendered cell count does not equal the number of fields with a recorded author");

  for (const c of cells) {
    const src = c.getAttribute("data-source");
    assert.ok(AUTHORED_SOURCES.includes(src),
      `cell ${c.getAttribute("data-field-cell")} carries data-source="${src}"`);
  }

  // BOTH VALUES OCCUR IN THIS ONE RENDER. A renderer that hardcodes "agent"
  // passes every assertion above and fails this one.
  const sources = new Set([...cells].map((c) => c.getAttribute("data-source")));
  assert.deepEqual([...sources].sort(), ["agent", "human"],
    `only ${[...sources].join(", ")} appears — a display that emits one value is not a provenance display`);
});

// ── clause 2: the override, and the attribute must not be universal ─────────

test("a human edit of an agent-written field carries BOTH data-source=human and data-prev-source=agent", () => {
  const { report, ledger, lineId } = agentFiledThenHumanCorrected();
  const root = renderEditor(makeDoc(), { report, ledger });

  const amount = [...root.querySelectorAll('[data-field-cell="amount"]')]
    .find((c) => c.getAttribute("data-entity-id") === lineId);
  assert.ok(amount, "no cell for the field the human edited");
  assert.equal(amount.getAttribute("data-source"), "human");
  assert.equal(amount.getAttribute("data-prev-source"), "agent");
});

test("a field the human did NOT touch carries NO data-prev-source in the SAME render", () => {
  // Without this, setting data-prev-source unconditionally passes the clause
  // above. An attribute that appears everywhere records nothing.
  const { report, ledger, lineId } = agentFiledThenHumanCorrected();
  const root = renderEditor(makeDoc(), { report, ledger });

  const merchant = [...root.querySelectorAll('[data-field-cell="merchant"]')]
    .find((c) => c.getAttribute("data-entity-id") === lineId);
  assert.ok(merchant, "no cell for the untouched field");
  assert.equal(merchant.getAttribute("data-source"), "agent");
  assert.equal(merchant.hasAttribute("data-prev-source"), false,
    "an untouched agent field claims to have overridden something");

  // exactly one cell in the whole render carries it, and it is the edited one
  const withPrev = root.querySelectorAll("[data-prev-source]");
  assert.equal(withPrev.length, 1, "data-prev-source appears on more than the field that was overridden");
  assert.equal(withPrev[0].getAttribute("data-field-cell"), "amount");
});

// ── clause 3: THE ATTRIBUTE IS NOT THE CLAIM ────────────────────────────────

test("the provenance is VISIBLE TEXT, not only an attribute — a judge reads the page", () => {
  const { report, ledger, lineId } = agentFiledThenHumanCorrected();
  const root = renderEditor(makeDoc(), { report, ledger });

  // every cell says who chose the value, in words
  for (const c of root.querySelectorAll("[data-field-cell]")) {
    const shown = c.querySelector("[data-provenance-text]")?.textContent ?? "";
    assert.ok(shown.trim().length > 0,
      `cell ${c.getAttribute("data-field-cell")} carries a data-source attribute and shows a person nothing`);
  }

  // the override says so in words too, and names what it replaced
  const amount = [...root.querySelectorAll('[data-field-cell="amount"]')]
    .find((c) => c.getAttribute("data-entity-id") === lineId);
  const text = amount.querySelector("[data-provenance-text]").textContent;
  assert.match(text, /was agent/i,
    `the override reads "${text}" — a person cannot see that this replaced an agent's value`);

  // and there is a LEGEND, so the marks are not a private code
  const legend = root.querySelector("[data-provenance-legend]");
  assert.ok(legend && legend.textContent.length > 40, "no legend explaining what the marks mean");
  assert.match(legend.textContent, /agent/i);
  assert.match(legend.textContent, /overrode|override/i);
});

test("the visible text and the attributes cannot disagree — they are one function", () => {
  // provenanceText() is what the DOM renders and what this asserts, so a cell
  // whose attribute says human and whose text says agent is not constructible.
  assert.equal(provenanceText({ source: "human", prevSource: "agent" }), "you — was agent");
  assert.equal(provenanceText({ source: "agent", prevSource: null }), "agent");
  assert.equal(provenanceText({ source: "seed", prevSource: null }), "sample data");
});

// ── F4a: the editor must show money and the server verdict, not raw storage ──

test("integer cents render as two-decimal money using the line currency", () => {
  const { report, ledger } = agentFiledAmounts([
    { amount: 15_90 },
    { amount: 17_40 },
    { amount: 10_65 },
    { amount: 180_00 },
    { amount: 12_34, currency: "EUR" },
  ]);
  const root = renderEditor(makeDoc(), { report, ledger });
  const shown = root.querySelectorAll('[data-field-cell="amount"]')
    .map((cell) => cell.children
      .find((child) => child.getAttribute("class") === "field-value").textContent);

  assert.deepEqual(shown, ["$15.90", "$17.40", "$10.65", "$180.00", "EUR 12.34"]);
});

test("blocking findings render the policy engine's message and fix verbatim", () => {
  const { report, ledger } = agentFiledAmounts([{ amount: 180_00 }]);
  const verdict = verdictFor(report);
  const root = renderEditor(makeDoc(), {
    report: { ...report, status: "draft" }, ledger, verdict,
  });
  const cap = root.querySelector('[data-validation-finding="CAP_TRANSPORT"]');

  assert.ok(cap, "CAP_TRANSPORT did not render in [data-validation-findings]");
  assert.equal(
    cap.textContent,
    "BLOCKING · CAP_TRANSPORT — $180.00 exceeds the $150.00 per-trip transport cap. " +
      "Fix: A trip above the limit needs a written exception from your approver before it can be filed.",
  );
  assert.ok(root.querySelector("[data-validation-findings]"));
});

test("a clean draft says the submit tool is registered", () => {
  const { report, ledger } = agentFiledAmounts([{ amount: 15_90 }]);
  const root = renderEditor(makeDoc(), { report, ledger, verdict: verdictFor(report) });

  assert.equal(
    root.querySelector("[data-validation-clean]").textContent,
    "No blocking findings. submit_expense_report is registered for this draft.",
  );
});

// The call log changed shape during the freeze: structured status/code is the
// durable path, while already-built callers still carry only the rendered
// technical line. Exercise one refusal through each path so deleting either
// parser makes a user-visible acceptance test fail.
test("423/422/403/404 write refusals render exact status, and a success clears it", () => {
  const { doc, region } = makeMountedDoc();
  let onCall = null;
  const erp = {
    openReportOrNull: () => null,
    onChange: () => () => {},
  };
  mountCachedEditor({
    doc,
    tools: {
      erp,
      onCall(fn) { onCall = fn; return () => { onCall = null; }; },
    },
  });
  const status = () => region.querySelector("[data-operation-status]").textContent;

  onCall({
    name: "update_expense_line",
    status: "err",
    error: { status: 423, code: "E_SIGN_IN_PROGRESS" },
    text: "report RP-1018 has an open sign request in progress",
  });
  assert.equal(status(),
    "Edit blocked — this report is locked while a signature is being reviewed. Nothing changed. " +
    "Technical: HTTP 423 · E_SIGN_IN_PROGRESS.");

  onCall({
    name: "submit_expense_report",
    status: "err",
    text: "The server refused submission. Technical: HTTP 422 · E_NOT_CLEAN.",
  });
  assert.equal(status(),
    "Submission blocked — this report still has policy issues. Nothing was submitted. " +
    "Technical: HTTP 422 · E_NOT_CLEAN.");

  onCall({
    name: "create_expense_report",
    status: "err",
    error: { status: 403, code: "E_ROLE_FORBIDDEN" },
  });
  assert.equal(status(),
    "Action blocked — this auditor session is read-only. Nothing changed. " +
    "Technical: HTTP 403 · E_ROLE_FORBIDDEN.");

  onCall({
    name: "open_expense_report",
    status: "err",
    text: "The server refused the open. Technical: HTTP 404 · E_REPORT_NOT_FOUND.",
  });
  assert.equal(status(),
    "Report not found — choose one of the reports available to this session. " +
    "Technical: HTTP 404 · E_REPORT_NOT_FOUND.");

  onCall({ name: "submit_expense_report", status: "ok", text: "Submitted." });
  assert.equal(status(), "");
});

test("S1 renders the agent prompt instead of leaving the editor region empty", () => {
  const { doc, region } = makeMountedDoc();
  mountCachedEditor({
    doc,
    tools: {
      erp: { openReportOrNull: () => null, onChange: () => () => {} },
      onCall: () => () => {},
    },
  });

  assert.equal(region.querySelector("[data-editor-empty-message]").textContent, EMPTY_EDITOR_TEXT);
  assert.equal(region.querySelector("[data-operation-status]").getAttribute("role"), "alert");
});

// ── D-100: the renderer cannot mislabel, because the STORE refuses ──────────

test("the store REFUSES an agent write that claims a human actor — the mislabel is impossible upstream", () => {
  const store = createReportStore();
  // source 'agent' requires actor 'agent' AND a tool name (R-21).
  assert.throws(
    () => store.createReport({ title: "x", project: "FALCON" },
      { source: "agent", actor: "chen", tool: "create_expense_report", revision: 0 }),
    /actor/i, "an agent write was accepted with a human actor");
  assert.throws(
    () => store.createReport({ title: "x", project: "FALCON" },
      { source: "agent", actor: "agent", revision: 0 }),
    /tool/i, "an agent write was accepted with no tool name");
  assert.throws(
    () => store.createReport({ title: "x", project: "FALCON" },
      { source: "human", actor: "agent", revision: 0 }),
    /human/i, "a human write was accepted claiming the actor 'agent'");
});

// ── controls: every assertion above must be able to fail ────────────────────

test("CONTROL — previousSource returns null for a field that replaced nothing, and agent for one that did", () => {
  const { ledger, lineId } = agentFiledThenHumanCorrected();
  assert.equal(previousSource(ledger, "line", lineId, "amount"), "agent",
    "the overridden field reports no previous author");
  assert.equal(previousSource(ledger, "line", lineId, "merchant"), null,
    "an agent field that filled a blank reports an override");
  assert.equal(previousSource(ledger, "line", lineId, "nights"), null);
});

test("CONTROL — unset fields are not rendered as cells at all", () => {
  // `nights` is never written. It exists in the store with source 'unset'.
  // Rendering it would put a data-source="unset" cell into the panel and break
  // clause 1 — so the exclusion is load-bearing, not tidying.
  const { report, ledger } = agentFiledThenHumanCorrected();
  const cells = fieldCells(report, ledger);
  assert.ok(LINE_FIELDS.includes("nights"));
  assert.equal(cells.some((c) => c.field === "nights"), false,
    "an unset field was rendered as an authored cell");
  assert.equal(cells.some((c) => c.source === "unset"), false);
  // but the fields that WERE written are all there
  assert.ok(cells.some((c) => c.field === "title"), "report fields are missing from the panel");
  assert.ok(REPORT_FIELDS.every((f) => cells.some((c) => c.field === f)));
});
