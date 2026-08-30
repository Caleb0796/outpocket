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
// SCOPE: this is a standalone module, not wired into server/index.mjs's
// existing S2 write routes (server/index.mjs's `state.reports` is a
// separate, simpler, already-shipped store — S2 does not list S8 as an
// input, and S8 does not list S2). Rewiring S2's already-tested HTTP
// routes onto this store is a follow-up for whichever node does that
// integration, not this one — see this node's PIT for the explicit call.
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
 *   createReport, addLine, updateLine, getReport, getLine, listReports,
 *   dayBook,
 * }
 */
export function createReportStore({ now = () => new Date() } = {}) {
  const ledger = createProvenanceLedger({ now });
  const reports = new Map(); // report_id -> internal report record
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

  /**
   * createReport({title, project}, {source, actor, tool, revision}) -> report view
   */
  function createReport({ title, project }, { source, actor, tool = null, revision = 0 }) {
    reportSeq += 1;
    const id = `RP-${reportSeq}`;
    const fields = initFields("report", id, REPORT_FIELDS, revision);
    const internal = { id, status: "draft", fields, lines: new Map() };
    reports.set(id, internal);
    if (title !== undefined) setField("report", id, fields, "title", title, { source, actor, tool, revision });
    if (project !== undefined) setField("report", id, fields, "project", project, { source, actor, tool, revision });
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
    const fields = initFields("line", lineId, LINE_FIELDS, revision);
    const internal = { id: lineId, fields };
    report.lines.set(lineId, internal);
    for (const field of LINE_FIELDS) {
      if (lineData[field] !== undefined) {
        setField("line", lineId, fields, field, lineData[field], { source, actor, tool, revision });
      }
    }
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

  return { createReport, addLine, updateLine, getReport, getLine, listReports, dayBook };
}
