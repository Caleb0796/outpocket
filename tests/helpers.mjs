// Shared test world: the same erp + toolset + scripts the page uses,
// with an injectable "auto-human" for attach/sign steps.
import { createServer } from "node:http";
import { createErp } from "../src/erp.js";
import { createToolset } from "../src/tools.js";
import { makeSampleReceipts, sampleDates } from "../src/samples.js";
import { createApp } from "../server/index.mjs";
import { createSignGate } from "../server/sign.mjs";

const PROVENANCE_FIELDS = [
  "amount", "attendees", "category", "currency", "date",
  "description", "itemization", "merchant", "nights", "receipt_id",
];

function localLineProjection(line) {
  const source = line.lastEditedBy ?? line.createdBy ?? "unset";
  const values = {
    amount: line.amountCents,
    attendees: line.attendees,
    category: line.category,
    currency: line.currency,
    date: line.date,
    description: line.description,
    itemization: line.itemization,
    merchant: line.merchant,
    nights: line.nights,
    receipt_id: line.receiptId,
  };
  return {
    id: line.id,
    date: line.date ?? null,
    merchant: line.merchant ?? null,
    category: line.category ?? null,
    amount_cents: line.amountCents ?? null,
    currency: line.currency ?? null,
    usd_cents: line.usdCents ?? null,
    attendees: line.attendees ?? null,
    nights: line.nights ?? null,
    itemization: Array.isArray(line.itemization)
      ? line.itemization.map((item) => ({ label: item.label, amount_cents: item.amountCents }))
      : null,
    description: line.description ?? null,
    receipt_id: line.receiptId ?? null,
    receipt_sha256: line.receiptSha256 ?? null,
    provenance: Object.fromEntries(PROVENANCE_FIELDS.map((field) => [
      field,
      values[field] === undefined || values[field] === null ? "unset" : source,
    ])),
  };
}

function localReportProjection(report) {
  return {
    id: report.id,
    owner: report.owner ?? "chen",
    title: report.title,
    project: report.project,
    status: report.status,
    revision: Number.isInteger(report.revision) ? report.revision : 0,
    created_at: report.createdAt ?? new Date(0).toISOString(),
    submitted_at: report.submittedAt ?? null,
    signature: report.signature ?? null,
    artifact: report.artifact ?? null,
    lines: report.lines.map(localLineProjection),
  };
}

/** Explicit test-only API double. Production definitions never fall back to this. */
export function createLocalApi(erp) {
  const receipts = () => erp.state.receipts.map((receipt) => ({
    ...receipt,
    owner: receipt.owner ?? erp.session()?.id ?? "chen",
  }));
  const payload = (report) => ({
    report: localReportProjection(report),
    provenance: report.provenance ?? { report: {}, lines: [], ledger: [] },
    receipts: receipts(),
  });
  const open = () => erp.openReportOrNull();
  const bump = (report) => {
    report.revision = (Number.isInteger(report.revision) ? report.revision : 0) + 1;
    return report;
  };

  return {
    async listReports() { return { reports: erp.listReports().map(localReportProjection) }; },
    async getReport(reportId) {
      const report = erp.state.reports.find((entry) => entry.id === reportId);
      if (!report) throw new Error(`No report ${reportId}.`);
      return payload(report);
    },
    async listReceipts() { return { receipts: receipts() }; },
    async createReport(args) { return payload(erp.createReport(args, "agent")); },
    async openReport(args) { return payload(erp.openReport(args.report_id, "agent")); },
    async addLine(_reportId, fields) {
      const result = erp.addLine(fields, "agent");
      bump(result.report);
      return { report_id: result.report.id, line_id: result.line.id, line: localLineProjection(result.line), ...payload(result.report) };
    },
    async updateLine(_reportId, args) {
      const { line_id: lineId, ...fields } = args;
      const result = erp.updateLine(lineId, fields, "agent");
      bump(result.report);
      return { report_id: result.report.id, line: localLineProjection(result.line), ...payload(result.report) };
    },
    async removeLine(_reportId, args) {
      const result = erp.removeLine(args.line_id, "agent");
      bump(result.report);
      return { report_id: result.report.id, ...payload(result.report) };
    },
    async linkReceipt(_reportId, args) {
      const result = erp.linkReceipt(args.line_id, args.receipt_id, "agent");
      bump(result.report);
      return { report_id: result.report.id, line: localLineProjection(result.line), ...payload(result.report) };
    },
    async validateReport() {
      const report = open();
      return { verdict: erp.verdict(report.id), ...payload(report) };
    },
    async commitReport() {
      return { ok: false, status: 503, body: { error: "E_TEST_NO_SIGN_SERVER", message: "test API has no sign server" } };
    },
    async dayBook() {
      return { ok: true, status: 200, body: { entries: [], head: "sha256:" + "0".repeat(64), verification: { ok: true, brokenAtIndex: null, reason: null } } };
    },
  };
}

export function makeWorld({ now = () => new Date(2026, 7, 28, 10, 0, 0), signImpl } = {}) {
  const erp = createErp({ now });
  const outputs = []; // every tool result text, for budget assertions
  const hooks = {
    api: createLocalApi(erp),
    requestSignature: signImpl ?? (async () => ({ signed: true })),
    onCallEnd: (_rec, r) => outputs.push(r.text),
  };
  const toolset = createToolset(erp, hooks);
  const dates = sampleDates(now());
  const receiptData = makeSampleReceipts(dates);
  const human = {
    async attach(keys) {
      const out = {};
      for (const k of keys) {
        const r = receiptData.find((x) => x.key === k);
        const rec = await erp.attachReceipt({ filename: r.filename, bytes: new TextEncoder().encode(r.svg) }, "human");
        out[k] = rec.id;
      }
      return out;
    },
    async signin(personaId) {
      erp.signIn(personaId, "human");
    },
  };
  const dispatch = (name, args, opts = {}) => toolset.call(name, args, { source: "sim", ...opts });
  return { erp, toolset, dates, human, dispatch, outputs, receiptData };
}

export function names(toolset) {
  return toolset.surface().map((d) => d.name);
}

export async function withRealServer(fn, { signGate = createSignGate() } = {}) {
  const server = createServer(createApp({ signGate }));
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn({ base, signGate });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// A minimal clean report: small amounts, below every threshold, no receipts needed.
export async function buildCleanReport(world, { title = "Cafeteria week", project = "FALCON" } = {}) {
  const { erp, dates } = world;
  erp.createReport({ title, project }, "test");
  erp.addLine({ date: dates.cab, merchant: "Heron Cafeteria", category: "meals", amount: 18.2, attendees: 1, description: "Lunch" }, "test");
  erp.addLine({ date: dates.cab, merchant: "T Pass", category: "transport", amount: 12.0, description: "Subway" }, "test");
  return erp.openReportOrNull();
}
