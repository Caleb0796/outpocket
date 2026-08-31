// server/store.mjs — the report/line store, with per-field provenance built
// in from the start.
//
// Node S8. Every expense-line (and report) field is stored as
// {value, source, ts, actor} — never a bare scalar — so "which values a
// human chose and which an agent chose" is a property of the data
// structure itself, not something derived after the fact. Every field
// write also appends one record to server/provenance.mjs's ledger (the
// frozen, audit-facing shape: value_digest, not value, so the ledger never
// stores a value twice) — this store's live `{value,...}` view and the
// ledger's `value_digest` are two projections of the SAME writes, never
// two independent sources of truth.
//
// server/index.mjs wires every report-field HTTP mutation through this
// module. Its compact report array remains the signed-content projection,
// while this store owns field authorship and the richer ledger returned by
// GET /api/reports/:id. Keeping those as two projections was chosen because
// the signed contract needs scalar fields while the editor needs
// {value,source,ts,actor}; both are written in the same route statement.
//
// x-fieldSets (erp/contracts/provenance.schema.json): every field here
// always has exactly one current provenance record.
export const LINE_FIELDS = Object.freeze([
  "amount", "attendees", "category", "currency", "date",
  "description", "itemization", "merchant", "nights", "receipt_id",
]);
export const REPORT_FIELDS = Object.freeze(["project", "title"]);

import { createProvenanceLedger } from "./provenance.mjs";

/**
 * createReportStore({now}) -> {
 *   createReport, seedReport, addLine, updateLine, removeLine,
 *   getReport, getLine, listReports, dayBook, dayBookForReport,
 * }
 */
export function createReportStore({ now = () => new Date() } = {}) {
  const ledger = createProvenanceLedger({ now });
  const reports = new Map(); // report_id -> internal report record
  const lineOwners = new Map(); // line_id -> report_id, retained after deletion for ledger reads
  let reportSeq = 1017; // matches server/seed.mjs's counter convention
  let lineSeq = 0;

  /** Write one field: appends a ledger record and updates the live {value,source,ts,actor} view. */
  function setField(entity, entityId, fieldsHolder, field, value, { source, actor, tool = null, revision }) {
    const rec = ledger.record({ entity, entityId, field, source, actor, tool, value, revision });
    fieldsHolder[field] = { value, source: rec.source, ts: rec.at, actor: rec.actor };
    return rec;
  }

  /** Seed every field of a fresh entity to source:'unset', value null — so every field always resolves. */
  function initFields(entity, entityId, fieldNames, revision) {
    const fields = {};
    for (const field of fieldNames) {
      const rec = ledger.record({ entity, entityId, field, source: "unset", actor: "system", tool: null, value: null, revision });
      fields[field] = { value: null, source: rec.source, ts: rec.at, actor: rec.actor };
    }
    return fields;
  }

  function reportView(internal) {
    return {
      id: internal.id,
      status: internal.status,
      fields: internal.fields,
      lines: [...internal.lines.values()].map(lineView),
    };
  }
  function lineView(internal) {
    return { id: internal.id, fields: internal.fields };
  }

  function insertReport(id, { title, project }, { source, actor, tool = null, revision = 0, status = "draft" }) {
    if (reports.has(id)) throw new RangeError(`report already exists: ${id}`);
    const fields = initFields("report", id, REPORT_FIELDS, revision);
    const internal = { id, status, fields, lines: new Map() };
    reports.set(id, internal);
    if (title !== undefined) setField("report", id, fields, "title", title, { source, actor, tool, revision });
    if (project !== undefined) setField("report", id, fields, "project", project, { source, actor, tool, revision });
    return internal;
  }

  function insertLine(report, lineId, lineData, { source, actor, tool = null, revision }) {
    if (report.lines.has(lineId)) throw new RangeError(`line already exists: ${lineId}`);
    const fields = initFields("line", lineId, LINE_FIELDS, revision);
    const internal = { id: lineId, fields };
    report.lines.set(lineId, internal);
    lineOwners.set(lineId, report.id);
    for (const field of LINE_FIELDS) {
      if (lineData[field] !== undefined) {
        setField("line", lineId, fields, field, lineData[field], { source, actor, tool, revision });
      }
    }
    return internal;
  }

  /**
   * createReport({title, project}, {source, actor, tool, revision}) -> report view
   */
  function createReport({ title, project }, { source, actor, tool = null, revision = 0 }) {
    reportSeq += 1;
    const id = `RP-${reportSeq}`;
    const internal = insertReport(id, { title, project }, { source, actor, tool, revision });
    return reportView(internal);
  }

  /** Seed an existing report id without consuming the next generated id. */
  function seedReport(report, { revision = 0 } = {}) {
    const internal = insertReport(
      report.id,
      { title: report.title, project: report.project },
      { source: "seed", actor: "system", revision, status: report.status ?? "draft" },
    );
    for (const line of report.lines ?? []) {
      insertLine(internal, line.id, {
        amount: line.amount_cents ?? line.amountCents,
        attendees: line.attendees,
        category: line.category,
        currency: line.currency,
        date: line.date,
        description: line.description,
        itemization: line.itemization,
        merchant: line.merchant,
        nights: line.nights,
        receipt_id: line.receipt_id ?? line.receiptId,
      }, { source: "seed", actor: "system", revision });
    }
    return reportView(internal);
  }

  function requireReport(reportId) {
    const internal = reports.get(reportId);
    if (!internal) throw new RangeError(`no such report: ${reportId}`);
    return internal;
  }

  /**
   * addLine(reportId, lineData, {source, actor, tool, revision}) -> line view
   * lineData: a plain object of LINE_FIELDS -> value. Unknown keys ignored;
   * fields not given stay source:'unset', value null.
   */
  function addLine(reportId, lineData, { source, actor, tool = null, revision }) {
    const report = requireReport(reportId);
    lineSeq += 1;
    const lineId = `ln_${lineSeq}`;
    const internal = insertLine(report, lineId, lineData, { source, actor, tool, revision });
    return lineView(internal);
  }

  /**
   * updateLine(reportId, lineId, patch, {source, actor, tool, revision})
   *   -> line view
   *
   * Only the fields present in `patch` get a new provenance record; every
   * other field's {value,source,ts,actor} is untouched — a human editing
   * one field must never flip the source of a field they did not touch.
   */
  function updateLine(reportId, lineId, patch, { source, actor, tool = null, revision }) {
    const report = requireReport(reportId);
    const internal = report.lines.get(lineId);
    if (!internal) throw new RangeError(`no such line: ${lineId}`);
    for (const field of LINE_FIELDS) {
      if (patch[field] !== undefined) {
        setField("line", lineId, internal.fields, field, patch[field], { source, actor, tool, revision });
      }
    }
    return lineView(internal);
  }

  /** Remove a live line while retaining its append-only ledger history. */
  function removeLine(reportId, lineId) {
    const report = requireReport(reportId);
    if (!report.lines.delete(lineId)) throw new RangeError(`no such line: ${lineId}`);
  }

  function getReport(reportId) {
    const internal = reports.get(reportId);
    return internal ? reportView(internal) : null;
  }

  function getLine(reportId, lineId) {
    const report = reports.get(reportId);
    const internal = report?.lines.get(lineId);
    return internal ? lineView(internal) : null;
  }

  function listReports() {
    return [...reports.values()].map(reportView);
  }

  /** dayBook() -> the full provenance ledger, in seq order — the append-only audit trail. */
  function dayBook() {
    return ledger.ledger();
  }

  /** Include removed-line history: deleting a live row never deletes its prior writes. */
  function dayBookForReport(reportId) {
    return ledger.ledger().filter(
      (entry) => (entry.entity === "report" && entry.entity_id === reportId)
        || (entry.entity === "line" && lineOwners.get(entry.entity_id) === reportId),
    );
  }

  return { createReport, seedReport, addLine, updateLine, removeLine, getReport, getLine, listReports, dayBook, dayBookForReport };
}
