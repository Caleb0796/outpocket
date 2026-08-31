// server/store.mjs — the server-owned expense-report aggregate.

import { createProvenanceLedger } from "./provenance.mjs";

export const LINE_FIELDS = Object.freeze([
  "amount", "attendees", "category", "currency", "date",
  "description", "itemization", "merchant", "nights", "receipt_id",
]);
export const REPORT_FIELDS = Object.freeze(["project", "title"]);

export class StoreError extends Error {
  constructor(code, http, message) {
    super(message || code);
    this.name = "StoreError";
    this.code = code;
    this.http = http;
  }
}

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function numericSuffix(id, prefix) {
  if (typeof id !== "string" || !id.startsWith(prefix)) return null;
  const value = Number(id.slice(prefix.length));
  return Number.isInteger(value) ? value : null;
}

export function createReportStore({ now = () => new Date() } = {}) {
  const ledger = createProvenanceLedger({ now });
  const reports = new Map();
  const receipts = new Map();
  const lineOwners = new Map();
  let reportSeq = 1017;
  let lineSeq = 0;
  let receiptSeq = 0;

  function setField(entity, entityId, fields, field, value, { source, actor, tool = null, revision }) {
    const rec = ledger.record({ entity, entityId, field, source, actor, tool, value, revision });
    fields[field] = { value: copy(value), source: rec.source, ts: rec.at, actor: rec.actor };
  }

  function initFields(entity, entityId, names, revision) {
    const fields = {};
    for (const field of names) {
      const rec = ledger.record({
        entity, entityId, field, source: "unset", actor: "system", tool: null, value: null, revision,
      });
      fields[field] = { value: null, source: rec.source, ts: rec.at, actor: rec.actor };
    }
    return fields;
  }

  function fieldsView(fields) {
    return Object.fromEntries(Object.entries(fields).map(([name, rec]) => [name, copy(rec)]));
  }

  function lineView(line) {
    return { id: line.id, fields: fieldsView(line.fields) };
  }

  function reportView(report) {
    return {
      id: report.id,
      owner: report.owner,
      status: report.status,
      createdAt: report.createdAt,
      submittedAt: report.submittedAt,
      signature: copy(report.signature),
      artifact: copy(report.artifact),
      revision: report.revision,
      fields: fieldsView(report.fields),
      lines: [...report.lines.values()].map(lineView),
    };
  }

  function receiptView(receipt) {
    return copy(receipt);
  }

  function requireReport(reportId) {
    const report = reports.get(reportId);
    if (!report) throw new StoreError("E_REPORT_NOT_FOUND", 404, `no such report: ${reportId}`);
    return report;
  }

  function requireDraft(report) {
    if (report.status !== "draft") {
      throw new StoreError("E_REPORT_NOT_DRAFT", 409, `report ${report.id} is ${report.status}`);
    }
  }

  function requireLine(report, lineId) {
    const line = report.lines.get(lineId);
    if (!line) throw new StoreError("E_LINE_NOT_FOUND", 404, `no such line: ${lineId}`);
    return line;
  }

  function assertKnownFields(value, allowed, label) {
    const unknown = Object.keys(value ?? {}).filter((field) => !allowed.includes(field));
    if (unknown.length) {
      throw new StoreError("E_BAD_REQUEST", 400, `${label} has unknown field(s): ${unknown.join(", ")}`);
    }
  }

  function insertReport(report, write) {
    if (reports.has(report.id)) throw new StoreError("E_REPORT_EXISTS", 409, `report already exists: ${report.id}`);
    const revision = report.revision ?? 0;
    const fields = initFields("report", report.id, REPORT_FIELDS, revision);
    const internal = {
      id: report.id,
      owner: report.owner ?? null,
      status: report.status ?? "draft",
      createdAt: report.createdAt ?? now().toISOString(),
      submittedAt: report.submittedAt ?? null,
      signature: copy(report.signature ?? null),
      artifact: copy(report.artifact ?? null),
      revision,
      fields,
      lines: new Map(),
    };
    reports.set(report.id, internal);
    if (report.title !== undefined) setField("report", report.id, fields, "title", report.title, { ...write, revision });
    if (report.project !== undefined) setField("report", report.id, fields, "project", report.project, { ...write, revision });
    return internal;
  }

  function insertLine(report, lineId, lineData, write, revision) {
    if (report.lines.has(lineId)) throw new StoreError("E_LINE_EXISTS", 409, `line already exists: ${lineId}`);
    assertKnownFields(lineData, LINE_FIELDS, "line");
    const fields = initFields("line", lineId, LINE_FIELDS, revision);
    const line = { id: lineId, fields };
    report.lines.set(lineId, line);
    lineOwners.set(lineId, report.id);
    for (const field of LINE_FIELDS) {
      if (lineData[field] !== undefined) setField("line", lineId, fields, field, lineData[field], { ...write, revision });
    }
    return line;
  }

  function seedReceipt(receipt, { owner = "chen" } = {}) {
    if (receipts.has(receipt.id)) throw new StoreError("E_RECEIPT_EXISTS", 409, `receipt already exists: ${receipt.id}`);
    const stored = {
      id: receipt.id,
      owner: receipt.owner ?? owner,
      filename: receipt.filename,
      size: receipt.size,
      sha256: receipt.sha256,
      addedBy: receipt.addedBy ?? "human",
      linkedLineId: receipt.linkedLineId ?? null,
      duplicateOf: receipt.duplicateOf ?? null,
      archived: Boolean(receipt.archived),
    };
    receipts.set(stored.id, stored);
    receiptSeq = Math.max(receiptSeq, numericSuffix(stored.id, "rc_") ?? 0);
    return receiptView(stored);
  }

  function seedReport(report, { revision = report.revision ?? 0 } = {}) {
    const stored = insertReport(
      { ...report, revision },
      { source: "seed", actor: "system", tool: null },
    );
    for (const line of report.lines ?? []) {
      insertLine(stored, line.id, {
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
      }, { source: "seed", actor: "system", tool: null }, revision);
      lineSeq = Math.max(lineSeq, numericSuffix(line.id, "ln_") ?? 0);
    }
    reportSeq = Math.max(reportSeq, numericSuffix(report.id, "RP-") ?? 0);
    return reportView(stored);
  }

  function seed(initial) {
    for (const receipt of initial.receipts ?? []) seedReceipt(receipt);
    for (const report of initial.reports ?? []) seedReport(report);
    reportSeq = Math.max(reportSeq, initial.counters?.report ?? 0);
    lineSeq = Math.max(lineSeq, initial.counters?.line ?? 0);
    receiptSeq = Math.max(receiptSeq, initial.counters?.receipt ?? 0);
  }

  function createReport({ title, project, owner = null, createdAt }, write) {
    reportSeq += 1;
    const report = insertReport({
      id: `RP-${reportSeq}`,
      title,
      project,
      owner,
      status: "draft",
      createdAt,
      revision: 0,
    }, write);
    return reportView(report);
  }

  function updateReport(reportId, patch, write) {
    const report = requireReport(reportId);
    requireDraft(report);
    assertKnownFields(patch, REPORT_FIELDS, "report patch");
    report.revision += 1;
    for (const field of REPORT_FIELDS) {
      if (patch[field] !== undefined) setField("report", report.id, report.fields, field, patch[field], { ...write, revision: report.revision });
    }
    return reportView(report);
  }

  function addLine(reportId, lineData, write) {
    const report = requireReport(reportId);
    requireDraft(report);
    assertKnownFields(lineData, LINE_FIELDS, "line");
    report.revision += 1;
    lineSeq += 1;
    const line = insertLine(report, `ln_${lineSeq}`, lineData, write, report.revision);
    return lineView(line);
  }

  function updateLine(reportId, lineId, patch, write) {
    const report = requireReport(reportId);
    requireDraft(report);
    const line = requireLine(report, lineId);
    assertKnownFields(patch, LINE_FIELDS, "line patch");
    report.revision += 1;
    for (const field of LINE_FIELDS) {
      if (patch[field] !== undefined) setField("line", line.id, line.fields, field, patch[field], { ...write, revision: report.revision });
    }
    return lineView(line);
  }

  function removeLine(reportId, lineId) {
    const report = requireReport(reportId);
    requireDraft(report);
    requireLine(report, lineId);
    for (const receipt of receipts.values()) {
      if (receipt.linkedLineId === lineId) receipt.linkedLineId = null;
    }
    report.lines.delete(lineId);
    report.revision += 1;
    return report.revision;
  }

  function addReceipt({ owner, filename, size, sha256 }) {
    receiptSeq += 1;
    const duplicate = [...receipts.values()].find((receipt) => receipt.sha256 === sha256) ?? null;
    const receipt = {
      id: `rc_${receiptSeq}`,
      owner,
      filename,
      size,
      sha256,
      addedBy: "human",
      linkedLineId: null,
      duplicateOf: duplicate?.id ?? null,
      archived: false,
    };
    receipts.set(receipt.id, receipt);
    return receiptView(receipt);
  }

  function linkReceipt(reportId, lineId, receiptId, write) {
    const report = requireReport(reportId);
    requireDraft(report);
    const line = requireLine(report, lineId);
    const receipt = receipts.get(receiptId);
    if (!receipt) throw new StoreError("E_RECEIPT_NOT_FOUND", 404, `no such receipt: ${receiptId}`);
    if (receipt.owner !== report.owner) {
      throw new StoreError("E_RECEIPT_FORBIDDEN", 403, `receipt ${receiptId} is not owned by report owner ${report.owner}`);
    }
    if (receipt.linkedLineId) {
      throw new StoreError("E_RECEIPT_TAKEN", 409, `receipt ${receiptId} already backs line ${receipt.linkedLineId}`);
    }
    const twin = [...receipts.values()].find(
      (candidate) => candidate.id !== receipt.id && candidate.sha256 === receipt.sha256 && candidate.linkedLineId,
    );
    if (twin) {
      throw new StoreError("E_RECEIPT_DUP", 409, `receipt ${receiptId} duplicates ${twin.id}, which backs ${twin.linkedLineId}`);
    }
    const previousId = line.fields.receipt_id.value;
    if (previousId) {
      const previous = receipts.get(previousId);
      if (previous) previous.linkedLineId = null;
    }
    report.revision += 1;
    setField("line", line.id, line.fields, "receipt_id", receipt.id, { ...write, revision: report.revision });
    receipt.linkedLineId = line.id;
    return lineView(line);
  }

  function prepareSubmission(reportId, { expectedRevision, artifact, signedBy, submittedAt }) {
    const report = requireReport(reportId);
    requireDraft(report);
    if (report.revision !== expectedRevision) {
      throw new StoreError(
        "E_SNAPSHOT_MISMATCH",
        409,
        `report ${reportId} revision moved from ${expectedRevision} to ${report.revision}`,
      );
    }
    const storedArtifact = copy(artifact);
    const signature = { signedBy, at: submittedAt };
    return () => {
      report.status = "submitted";
      report.submittedAt = submittedAt;
      report.signature = signature;
      report.artifact = storedArtifact;
    };
  }

  function getReport(reportId) {
    const report = reports.get(reportId);
    return report ? reportView(report) : null;
  }

  function getLine(reportId, lineId) {
    const line = reports.get(reportId)?.lines.get(lineId);
    return line ? lineView(line) : null;
  }

  function getReceipt(receiptId) {
    const receipt = receipts.get(receiptId);
    return receipt ? receiptView(receipt) : null;
  }

  function listReports() {
    return [...reports.values()].map(reportView);
  }

  function listReceipts() {
    return [...receipts.values()].map(receiptView);
  }

  function dayBook() {
    return copy(ledger.ledger());
  }

  function dayBookForReport(reportId) {
    return copy(ledger.ledger().filter(
      (entry) => (entry.entity === "report" && entry.entity_id === reportId)
        || (entry.entity === "line" && lineOwners.get(entry.entity_id) === reportId),
    ));
  }

  function stateProjection() {
    return {
      reports: [...reports.values()].map((report) => ({
        id: report.id,
        owner: report.owner,
        status: report.status,
        title: report.fields.title.value,
        project: report.fields.project.value,
        revision: report.revision,
        artifact: copy(report.artifact),
        lines: [...report.lines.values()].map((line) => ({
          id: line.id,
          ...Object.fromEntries(LINE_FIELDS.map((field) => [field, copy(line.fields[field].value)])),
        })),
      })),
      receipts: listReceipts(),
      counters: { report: reportSeq, line: lineSeq, receipt: receiptSeq },
    };
  }

  return {
    seed,
    seedReport,
    seedReceipt,
    createReport,
    updateReport,
    addLine,
    updateLine,
    removeLine,
    addReceipt,
    linkReceipt,
    prepareSubmission,
    getReport,
    getLine,
    getReceipt,
    listReports,
    listReceipts,
    dayBook,
    dayBookForReport,
    stateProjection,
  };
}
