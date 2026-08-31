// tests/acceptance/provenance.test.mjs — node S8, per-field provenance.
//
// THIS IS THE CLAIM THE WHOLE PRODUCT RESTS ON: that afterwards, from the
// record alone, you can tell which values a human chose and which an agent
// chose. Three ways the naive predicate passes while proving nothing, all
// closed here:
//   1. "every field carries {value,source,ts,actor}" is true of ZERO
//      fields, and of a record where every source is hardcoded 'agent'.
//      Asserts the field COUNT is non-zero and equal to LINE_FIELDS.length,
//      and that BOTH 'agent' and 'human' actually occur in the same report.
//   2. "flips source to human" is satisfiable by a writer stuck at
//      'human'. Shows the SAME field reading 'agent' before and 'human'
//      after, AND a field the human did not touch still reading 'agent' in
//      the SAME record (D-90: discrimination, not presence).
//   3. "two day-book entries with distinct sources" is satisfiable by one
//      actor wearing two hats. Asserts the two entries' ACTORS differ too,
//      and that they are ordered (seq strictly increasing, supersedes
//      chained).
// AND per D-100: the writer must REFUSE to mislabel, in both directions —
// an agent write is not recordable as human, and vice versa. A suite that
// only proves the flip happens cannot tell a working recorder from one
// stuck open.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createReportStore, LINE_FIELDS, REPORT_FIELDS } from "../../server/store.mjs";
import { createProvenanceLedger, ProvenanceError, valueDigest, UNSET_VALUE_DIGEST } from "../../server/provenance.mjs";
import { createApp } from "../../server/index.mjs";

function makeStore() {
  let t = new Date(2026, 7, 28, 10, 0, 0);
  const now = () => t;
  const tick = (ms = 1000) => { t = new Date(t.getTime() + ms); };
  return { store: createReportStore({ now }), tick };
}

// ── clause 1: field count non-zero, both sources occur ──────────────────
test("every line field carries {value, source, ts, actor} — the count is non-zero and equals the real field count, and BOTH sources occur", () => {
  const { store } = makeStore();
  const report = store.createReport({ title: "Boston workshop", project: "FALCON" }, { source: "agent", actor: "agent", tool: "create_expense_report" });
  const line = store.addLine(
    report.id,
    { date: "2026-08-20", merchant: "Acme Co", category: "meals", amount: 1500, currency: "USD" },
    { source: "agent", actor: "agent", tool: "add_expense_line" },
  );

  const fieldNames = Object.keys(line.fields);
  assert.equal(fieldNames.length, LINE_FIELDS.length, "every declared line field must be present, not just the ones written");
  assert.ok(fieldNames.length > 0, "the field count must be non-zero — a schema satisfied by zero fields proves nothing");
  for (const f of LINE_FIELDS) {
    const entry = line.fields[f];
    assert.ok(entry && Object.hasOwn(entry, "value"), `${f}: missing value`);
    assert.ok(entry && Object.hasOwn(entry, "source"), `${f}: missing source`);
    assert.ok(entry && Object.hasOwn(entry, "ts"), `${f}: missing ts`);
    assert.ok(entry && Object.hasOwn(entry, "actor"), `${f}: missing actor`);
  }

  // Human now edits ONE field.
  store.updateLine(report.id, line.id, { attendees: 3 }, { source: "human", actor: "Chen Xiao", tool: null });
  const updated = store.getLine(report.id, line.id);
  const sources = new Set(Object.values(updated.fields).map((f) => f.source));
  assert.ok(sources.has("agent"), "clause 1: 'agent' must actually occur");
  assert.ok(sources.has("human"), "clause 1: 'human' must actually occur — not merely permitted by the schema");
});

// ── clause 2: the SAME field flips, an untouched field does NOT (D-90) ───
test("a human edit flips the SAME field's source to 'human', and a field the human did NOT touch still reads 'agent'", () => {
  const { store, tick } = makeStore();
  const report = store.createReport({ title: "T", project: "FALCON" }, { source: "agent", actor: "agent", tool: "create_expense_report" });
  const line = store.addLine(
    report.id,
    { date: "2026-08-20", merchant: "Acme Co", category: "meals", amount: 1500 },
    { source: "agent", actor: "agent", tool: "add_expense_line" },
  );

  assert.equal(line.fields.merchant.source, "agent", "BEFORE: merchant is agent-sourced");
  assert.equal(line.fields.amount.source, "agent", "BEFORE: amount is agent-sourced");
  const merchantBefore = line.fields.merchant;

  tick();
  store.updateLine(report.id, line.id, { merchant: "Acme Corporation" }, { source: "human", actor: "Chen Xiao", tool: null });
  const after = store.getLine(report.id, line.id);

  assert.equal(after.fields.merchant.source, "human", "AFTER: the SAME field now reads human");
  assert.equal(after.fields.merchant.value, "Acme Corporation");
  assert.notEqual(after.fields.merchant.ts, merchantBefore.ts, "the ts must actually advance on the real write");

  // D-90: the field the human did NOT touch must be UNCHANGED — a flip
  // that flips everything (or a writer that only ever writes 'human')
  // would pass a test that checked merchant alone.
  assert.equal(after.fields.amount.source, "agent", "a field the human did not touch must still read 'agent'");
  assert.equal(after.fields.amount.value, 1500);
  assert.deepEqual(after.fields.amount, line.fields.amount, "the untouched field's whole record is byte-identical, not just its source");

  // And a field nobody ever wrote stays 'unset', value null — the record
  // exists so every field always resolves to exactly one current source.
  assert.equal(after.fields.currency.source, "unset");
  assert.equal(after.fields.currency.value, null);
});

// ── clause 3: two day-book entries, distinct sources AND distinct actors, ordered ──
test("the day book carries two entries for the same field with distinct sources AND distinct actors, in order", () => {
  const { store, tick } = makeStore();
  const report = store.createReport({ title: "T", project: "FALCON" }, { source: "agent", actor: "agent", tool: "create_expense_report" });
  const line = store.addLine(report.id, { date: "2026-08-20", merchant: "Acme Co", category: "meals", amount: 1500 }, { source: "agent", actor: "agent", tool: "add_expense_line" });
  tick();
  store.updateLine(report.id, line.id, { merchant: "Acme Corporation" }, { source: "human", actor: "Chen Xiao", tool: null });

  const book = store.dayBook();
  const merchantEntries = book.filter((e) => e.entity === "line" && e.entity_id === line.id && e.field === "merchant" && e.source !== "unset");
  assert.equal(merchantEntries.length, 2, `expected exactly 2 non-seed merchant entries, got ${merchantEntries.length}`);

  const [first, second] = merchantEntries;
  assert.equal(first.source, "agent");
  assert.equal(second.source, "human");
  assert.notEqual(first.source, second.source, "distinct sources");

  // The trap: two entries with distinct sources and the SAME actor is one
  // actor wearing two hats, which an auditor needs to catch.
  assert.equal(first.actor, "agent");
  assert.equal(second.actor, "Chen Xiao");
  assert.notEqual(first.actor, second.actor, "distinct actors — not one actor wearing two hats");

  // Ordered: strictly increasing seq, and the chain names its predecessor.
  assert.ok(second.seq > first.seq, "the human entry must be ordered AFTER the agent entry by seq");
  assert.equal(second.supersedes, first.id, "the human entry must name the agent entry as what it supersedes");

  // value_digest, not the value itself, is what the ledger stores.
  assert.equal(first.value_digest, valueDigest("Acme Co"));
  assert.equal(second.value_digest, valueDigest("Acme Corporation"));
  assert.notEqual(first.value_digest, second.value_digest);
});

// ── D-100: the writer REFUSES to mislabel, in BOTH directions ───────────
test("D-100: the ledger refuses to record an agent write as human, or a human write as agent", () => {
  const ledger = createProvenanceLedger();

  // An agent write with no tool name (the shape a mislabeled 'human' write
  // would have) must be refused, not silently accepted as agent.
  assert.throws(
    () => ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "agent", actor: "agent", tool: null, value: "x" }),
    (err) => err instanceof ProvenanceError && err.code === "E_PROVENANCE_MISLABEL",
    "source 'agent' with no tool must be refused",
  );

  // A human write carrying a tool name (an agent write dressed up as
  // human) must be refused.
  assert.throws(
    () => ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "human", actor: "Chen Xiao", tool: "add_expense_line", value: "x" }),
    (err) => err instanceof ProvenanceError && err.code === "E_PROVENANCE_MISLABEL",
    "source 'human' with a tool name must be refused",
  );

  // An agent write claiming a human-shaped actor name must be refused —
  // R-21: no agent identity beyond the literal string 'agent'.
  assert.throws(
    () => ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "agent", actor: "Chen Xiao", tool: "add_expense_line", value: "x" }),
    (err) => err instanceof ProvenanceError,
    "source 'agent' claiming a human actor name must be refused",
  );

  // A human write claiming the literal actor string 'agent' must be
  // refused — the inverse mislabel.
  assert.throws(
    () => ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "human", actor: "agent", tool: null, value: "x" }),
    (err) => err instanceof ProvenanceError,
    "source 'human' claiming actor 'agent' must be refused",
  );

  // And the refusal actually refuses — nothing was written by any of the
  // four attempts above.
  assert.equal(ledger.ledger().length, 0, "a refused record() must not have appended anything");
  assert.equal(ledger.currentRecord("line", "ln_1", "merchant"), null);

  // The correctly-labeled versions of the same two writes DO succeed —
  // proving this isn't a validator stuck shut (this suite's own D-100 for
  // itself).
  const agentRec = ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "agent", actor: "agent", tool: "add_expense_line", value: "Acme Co" });
  assert.equal(agentRec.source, "agent");
  const humanRec = ledger.record({ entity: "line", entityId: "ln_1", field: "merchant", source: "human", actor: "Chen Xiao", tool: null, value: "Acme Corporation" });
  assert.equal(humanRec.source, "human");
});

// ── report-level fields go through the same discipline ───────────────────
test("report-level fields (title, project) also carry full provenance and the same discrimination", () => {
  const { store, tick } = makeStore();
  const report = store.createReport({ title: "Boston workshop", project: "FALCON" }, { source: "agent", actor: "agent", tool: "create_expense_report" });
  assert.equal(Object.keys(report.fields).length, REPORT_FIELDS.length);
  assert.equal(report.fields.title.source, "agent");
  assert.equal(report.fields.project.source, "agent");

  tick();
  store.updateReport(report.id, { title: "Boston workshop — corrected" }, {
    source: "human",
    actor: "Chen Xiao",
    tool: null,
  });
  const updated = store.getReport(report.id);
  assert.equal(updated.fields.title.value, "Boston workshop — corrected");
  assert.equal(updated.fields.title.source, "human");
  assert.equal(updated.fields.project.source, "agent", "the untouched report field keeps its agent source");
  assert.notEqual(updated.fields.title.ts, report.fields.title.ts);
});

// ── frozen schema conformance, spot-checked without a second schema copy ──
test("every ledger record matches the frozen provenance.schema.json's required shape and enum", () => {
  const { store } = makeStore();
  const report = store.createReport({ title: "T", project: "FALCON" }, { source: "agent", actor: "agent", tool: "create_expense_report" });
  store.addLine(report.id, { merchant: "Acme Co" }, { source: "agent", actor: "agent", tool: "add_expense_line" });

  const required = ["schema", "seq", "id", "at", "entity", "entity_id", "field", "source", "actor", "tool", "value_digest", "supersedes"];
  for (const rec of store.dayBook()) {
    for (const key of required) assert.ok(Object.hasOwn(rec, key), `record missing required key '${key}': ${JSON.stringify(rec)}`);
    assert.equal(rec.schema, "outpocket.provenance/1");
    assert.match(rec.id, /^pv_[0-9]{1,9}$/);
    assert.match(rec.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.ok(["human", "agent", "seed", "unset"].includes(rec.source));
    assert.match(rec.value_digest, /^sha256:[0-9a-f]{64}$/);
    if (rec.source === "unset") assert.equal(rec.value_digest, UNSET_VALUE_DIGEST);
  }
});

async function withHttpApp(fn) {
  const server = createServer(createApp());
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona: "chen" }),
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    await fn(base, cookie);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function requestJson(base, path, cookie, { method = "GET", body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test("the HTTP report routes populate provenance and GET /api/reports/:id returns it", async () => {
  await withHttpApp(async (base, cookie) => {
    const created = await requestJson(base, "/api/reports", cookie, {
      method: "POST",
      body: { title: "Boston workshop", project: "FALCON" },
    });
    assert.equal(created.status, 201);
    const reportId = created.body.report_id;

    const added = await requestJson(base, `/api/reports/${reportId}/lines`, cookie, {
      method: "POST",
      body: { date: "2026-08-20", merchant: "Acme Co", category: "meals", amount_cents: 1500, currency: "USD" },
    });
    assert.equal(added.status, 201);
    const lineId = added.body.line.id;

    const updated = await requestJson(base, `/api/reports/${reportId}/lines/${lineId}`, cookie, {
      method: "PATCH",
      body: { merchant: "Acme Corporation" },
    });
    assert.equal(updated.status, 200);
    const humanReportEdit = await requestJson(base, `/api/ui/reports/${reportId}`, cookie, {
      method: "PATCH",
      body: { title: "Boston workshop — corrected" },
    });
    assert.equal(humanReportEdit.status, 200);
    const humanLineEdit = await requestJson(base, `/api/ui/reports/${reportId}/lines/${lineId}`, cookie, {
      method: "PATCH",
      body: { attendees: 2 },
    });
    assert.equal(humanLineEdit.status, 200);
    const attached = await requestJson(base, "/api/ui/receipts", cookie, {
      method: "POST",
      body: { filename: "receipt.svg", size: 123, sha256: "a".repeat(64) },
    });
    assert.equal(attached.status, 201);
    const linked = await requestJson(base, `/api/reports/${reportId}/lines/${lineId}/receipt`, cookie, {
      method: "POST",
      body: { receipt_id: attached.body.receipt.id },
    });
    assert.equal(linked.status, 200);

    const fetched = await requestJson(base, `/api/reports/${reportId}`, cookie);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.report.id, reportId);
    assert.equal(fetched.body.report.title, "Boston workshop — corrected");
    assert.equal(fetched.body.report.lines[0].merchant, "Acme Corporation");
    assert.equal(fetched.body.report.lines[0].attendees, 2);
    assert.equal(fetched.body.report.lines[0].provenance.merchant, "agent");
    assert.equal(fetched.body.report.lines[0].provenance.attendees, "human");
    assert.equal(fetched.body.report.lines[0].provenance.receipt_id, "agent");
    assert.equal(fetched.body.provenance.report.title.source, "human");
    const merchantWrites = fetched.body.provenance.ledger.filter(
      (entry) => entry.entity_id === lineId && entry.field === "merchant" && entry.source !== "unset",
    );
    assert.equal(merchantWrites.length, 2);
    assert.equal(merchantWrites[1].supersedes, merchantWrites[0].id);
  });
});

test("the server seed exposes RP-1017, its two lines, receipt rc_1 and seed provenance", async () => {
  await withHttpApp(async (base, cookie) => {
    const fetched = await requestJson(base, "/api/reports/RP-1017", cookie);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.report.title, "July site visit — Heron");
    assert.equal(fetched.body.report.lines.length, 2);
    assert.equal(fetched.body.report.lines[0].receipt_id, "rc_1");
    assert.equal(fetched.body.report.lines[0].receipt_sha256, "9d1e7a5c0b8f42a6e3d94417c25a80fe6b1c9d0347f8ab52ce61904d7e3b21aa");
    assert.equal(fetched.body.provenance.report.title.source, "seed");
    assert.equal(fetched.body.provenance.lines[0].fields.merchant.source, "seed");
    assert.ok(fetched.body.provenance.ledger.length > 0);
  });
});
