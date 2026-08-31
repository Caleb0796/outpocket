// 账房 COUNTINGHOUSE — in-memory page model and server-response cache.
// Pure module: no DOM. In the product page, report data is hydrated from the
// server aggregate; the local mutation helpers remain useful to the pure
// state-machine demonstrations and tests, but are not an authority boundary.

import { validateReport, toCents, toUsdCents, POLICY_VERSION } from "./policy.js";

export class ErpError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ErpError";
    this.code = code;
  }
}

// FNV-1a — stable, dependency-free digest for canonical state comparison
// (the "two agent styles, one ledger" check). Receipts use real SHA-256.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function sha256Hex(bytes) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const PERSONAS = [
  {
    id: "chen",
    name: "Chen Xiao",
    title: "Field engineer",
    role: "employee",
    costCenter: "CC-4200 · Field Engineering",
    currency: "USD",
    approver: "Mei Tanaka (Engineering Director)",
    projects: [
      { code: "FALCON", name: "Falcon line retrofit", active: true },
      { code: "HERON", name: "Heron pilot plant", active: true },
      { code: "KESTREL", name: "Kestrel decommission", active: false },
    ],
  },
  {
    id: "ruiz",
    name: "Elena Ruiz",
    title: "Internal audit",
    role: "auditor",
    costCenter: "CC-9000 · Internal Audit",
    currency: "USD",
    approver: null,
    projects: [],
  },
];

const LINE_FIELDS = ["date", "merchant", "category", "amount", "currency", "attendees", "nights", "itemization", "description"];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysAgoIso(now, days) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return iso(d);
}

export function createErp({ now = () => new Date(), hashBytes = sha256Hex } = {}) {
  const listeners = new Set();
  const state = {
    session: null,
    openReportId: null,
    reports: [],
    receipts: [],
    dayBook: [],
    counters: { report: 1017, line: 0, receipt: 0, confirm: 0 },
  };

  // ── plumbing ─────────────────────────────────────────────────
  function emit(type, detail) {
    for (const fn of listeners) fn({ type, detail });
  }
  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
  function log(kind, source, label, detail = "") {
    state.dayBook.push({ ts: now().toISOString(), kind, source, actor: state.session?.name ?? "—", label, detail });
    if (state.dayBook.length > 400) state.dayBook.splice(0, state.dayBook.length - 400);
  }

  function requireSession() {
    if (!state.session) throw new ErpError("NO_SESSION", "No one is signed in. Sign-in happens in the page, by the employee, via company SSO.");
    return state.session;
  }
  function requireEmployee() {
    const s = requireSession();
    if (s.role !== "employee")
      throw new ErpError("FORBIDDEN", `403 for ${s.name} (${s.role}): this session's role cannot modify expense reports.`);
    return s;
  }
  function getReport(id) {
    const r = state.reports.find((x) => x.id === id);
    if (!r) throw new ErpError("NOT_FOUND", `No report ${id}.`);
    return r;
  }
  function requireOpenReport() {
    if (!state.openReportId) throw new ErpError("NO_OPEN_REPORT", "No expense report is open in the page.");
    return getReport(state.openReportId);
  }
  function requireOpenDraft() {
    const r = requireOpenReport();
    if (r.status !== "draft") throw new ErpError("NOT_DRAFT", `Report ${r.id} is ${r.status} and can no longer be edited.`);
    return r;
  }

  function serverLine(line) {
    if (!line || typeof line !== "object" || Array.isArray(line) || typeof line.id !== "string") {
      throw new ErpError("BAD_SERVER_RESPONSE", "The server returned an invalid expense line.");
    }
    const provenance = line.provenance && typeof line.provenance === "object"
      ? { ...line.provenance }
      : {};
    const authored = Object.values(provenance).filter((source) => source !== "unset");
    const createdBy = authored.includes("agent") ? "agent" : authored[0] ?? "unset";
    const lastEditedBy = authored.includes("human") ? "human" : createdBy;
    return {
      id: line.id,
      date: line.date ?? null,
      merchant: line.merchant ?? null,
      category: line.category ?? null,
      amountCents: line.amount_cents ?? line.amountCents ?? null,
      currency: line.currency ?? null,
      usdCents: line.usd_cents ?? line.usdCents ?? null,
      attendees: line.attendees ?? undefined,
      nights: line.nights ?? undefined,
      itemization: Array.isArray(line.itemization)
        ? line.itemization.map((item) => ({
            label: item.label,
            amountCents: item.amount_cents ?? item.amountCents,
          }))
        : undefined,
      description: line.description ?? null,
      receiptId: line.receipt_id ?? line.receiptId ?? null,
      receiptSha256: line.receipt_sha256 ?? line.receiptSha256 ?? null,
      provenance,
      createdBy,
      lastEditedBy,
    };
  }

  function serverReport(report, provenance = null) {
    if (!report || typeof report !== "object" || Array.isArray(report)
        || typeof report.id !== "string" || !Array.isArray(report.lines)) {
      throw new ErpError("BAD_SERVER_RESPONSE", "The server returned an invalid expense report.");
    }
    return {
      id: report.id,
      title: report.title,
      project: report.project,
      owner: report.owner,
      status: report.status,
      createdAt: report.created_at ?? report.createdAt ?? null,
      submittedAt: report.submitted_at ?? report.submittedAt ?? null,
      signature: report.signature ?? null,
      artifact: report.artifact ?? null,
      revision: report.revision,
      lines: report.lines.map(serverLine),
      provenance,
    };
  }

  function adoptServerReport(report, { open = false, provenance = null } = {}) {
    const previous = state.reports.find((entry) => entry.id === report?.id);
    const projected = serverReport(report, provenance ?? previous?.provenance ?? null);
    const index = state.reports.findIndex((entry) => entry.id === projected.id);
    if (index === -1) state.reports.push(projected);
    else state.reports[index] = projected;
    const reportNumber = Number(projected.id.replace(/^RP-/, ""));
    if (Number.isInteger(reportNumber)) state.counters.report = Math.max(state.counters.report, reportNumber);
    for (const line of projected.lines) {
      const lineNumber = Number(line.id.replace(/^ln_/, ""));
      if (Number.isInteger(lineNumber)) state.counters.line = Math.max(state.counters.line, lineNumber);
    }
    if (open) state.openReportId = projected.id;
    emit("reports", { reportId: projected.id });
    return projected;
  }

  function adoptServerReports(reports) {
    if (!Array.isArray(reports)) throw new ErpError("BAD_SERVER_RESPONSE", "The server report list is invalid.");
    const provenanceById = new Map(state.reports.map((report) => [report.id, report.provenance]));
    state.reports = reports.map((report) => serverReport(report, provenanceById.get(report.id) ?? null));
    if (state.openReportId && !state.reports.some((report) => report.id === state.openReportId)) {
      state.openReportId = null;
    }
    for (const report of state.reports) {
      const reportNumber = Number(report.id.replace(/^RP-/, ""));
      if (Number.isInteger(reportNumber)) state.counters.report = Math.max(state.counters.report, reportNumber);
    }
    emit("reports");
    return state.reports;
  }

  function adoptServerReceipts(receipts) {
    if (!Array.isArray(receipts)) throw new ErpError("BAD_SERVER_RESPONSE", "The server receipt list is invalid.");
    state.receipts = receipts.map((receipt) => ({ ...receipt }));
    for (const receipt of state.receipts) {
      const receiptNumber = Number(receipt.id?.replace(/^rc_/, ""));
      if (Number.isInteger(receiptNumber)) state.counters.receipt = Math.max(state.counters.receipt, receiptNumber);
    }
    emit("receipts");
    return state.receipts;
  }

  // ── normalization ────────────────────────────────────────────
  function normalizeLineInput(fields, base = {}) {
    if (typeof fields !== "object" || fields === null) throw new ErpError("BAD_INPUT", "Line fields must be an object.");
    const unknown = Object.keys(fields).filter((k) => !LINE_FIELDS.includes(k));
    if (unknown.length)
      throw new ErpError("BAD_INPUT", `Unknown field(s): ${unknown.join(", ")}. Allowed: ${LINE_FIELDS.join(", ")}.`);
    const merged = { ...base, ...fields };

    const line = {
      date: typeof merged.date === "string" ? merged.date.trim() : merged.date ?? null,
      merchant: typeof merged.merchant === "string" ? merged.merchant.trim() : null,
      category: typeof merged.category === "string" ? merged.category.trim().toLowerCase() : null,
      currency: typeof merged.currency === "string" ? merged.currency.trim().toUpperCase() : "USD",
      description: typeof merged.description === "string" ? merged.description.trim() : null,
      attendees: undefined,
      nights: undefined,
      itemization: undefined,
    };

    line.amountCents = toCents(typeof merged.amount === "number" ? merged.amount : NaN);
    line.usdCents = line.amountCents === null ? null : toUsdCents(line.amountCents, line.currency);

    for (const k of ["attendees", "nights"]) {
      if (merged[k] === undefined || merged[k] === null) continue;
      const n = Math.floor(merged[k]);
      if (!Number.isFinite(n) || n < 1) throw new ErpError("BAD_INPUT", `\`${k}\` must be an integer ≥ 1.`);
      line[k] = n;
    }

    if (merged.itemization !== undefined && merged.itemization !== null) {
      if (!Array.isArray(merged.itemization)) throw new ErpError("BAD_INPUT", "`itemization` must be an array of {label, amount}.");
      line.itemization = merged.itemization.map((it, i) => {
        const label = typeof it?.label === "string" ? it.label.trim() : "";
        const cents = toCents(typeof it?.amount === "number" ? it.amount : NaN);
        if (!label || cents === null)
          throw new ErpError("BAD_INPUT", `itemization[${i}] needs a non-empty label and a positive decimal amount.`);
        return { label, amountCents: cents };
      });
      if (!line.itemization.length) line.itemization = undefined;
    }
    return line;
  }

  // ── validation context ───────────────────────────────────────
  function receiptById(id) {
    return state.receipts.find((r) => r.id === id);
  }
  function priorHashUseFor(reportId) {
    const map = new Map();
    for (const r of state.reports) {
      if (r.id === reportId) continue;
      for (const l of r.lines) {
        if (!l.receiptId) continue;
        const rc = receiptById(l.receiptId);
        if (rc && !map.has(rc.sha256)) map.set(rc.sha256, { lineId: l.id, reportId: r.id });
      }
    }
    return (hash) => map.get(hash);
  }
  function verdict(reportId = state.openReportId) {
    const r = getReport(reportId);
    const owner = PERSONAS.find((p) => p.id === r.owner);
    return validateReport(r, owner, { now: now(), receiptById, priorHashUse: priorHashUseFor(r.id) });
  }

  // ── session ──────────────────────────────────────────────────
  function signIn(personaId, source = "human") {
    const p = PERSONAS.find((x) => x.id === personaId);
    if (!p) throw new ErpError("NOT_FOUND", `No persona ${personaId}.`);
    state.session = p;
    state.openReportId = null;
    log("human", source, `SSO sign-in: ${p.name}`, `${p.role} · ${p.costCenter}`);
    emit("session");
    return p;
  }
  function signOut(source = "human") {
    const was = state.session?.name;
    state.session = null;
    state.openReportId = null;
    if (was) log("human", source, `Sign-out: ${was}`);
    emit("session");
  }

  // ── receipts (attached by the human in the page) ─────────────
  async function attachReceipt({ filename, bytes }, source = "human") {
    requireEmployee();
    if (!filename || !(bytes instanceof Uint8Array)) throw new ErpError("BAD_INPUT", "attachReceipt needs {filename, bytes:Uint8Array}.");
    const sha256 = await hashBytes(bytes);
    const dup = state.receipts.find((r) => r.sha256 === sha256);
    const receipt = {
      id: `rc_${++state.counters.receipt}`,
      filename,
      size: bytes.byteLength,
      sha256,
      addedBy: source,
      linkedLineId: null,
      duplicateOf: dup ? dup.id : null,
    };
    state.receipts.push(receipt);
    log("human", source, `Receipt attached: ${filename}`, `sha256 ${sha256.slice(0, 12)}…${dup ? ` · duplicate of ${dup.id}` : ""}`);
    emit("receipts");
    return receipt;
  }

  // ── reports ──────────────────────────────────────────────────
  function listReports() {
    requireSession();
    return state.reports.map((r) => ({
      id: r.id, title: r.title, project: r.project, status: r.status,
      lines: r.lines.length, totalUsd: r.lines.reduce((s, l) => s + (l.usdCents ?? 0), 0),
    }));
  }
  function createReport({ title, project }, source) {
    const s = requireEmployee();
    if (!title || typeof title !== "string") throw new ErpError("BAD_INPUT", "A report needs a short title.");
    const code = typeof project === "string" ? project.trim().toUpperCase() : "";
    const p = s.projects.find((x) => x.code === code);
    if (!p) throw new ErpError("PROJECT_SCOPE", `403: project ${code || "(none)"} is not in ${s.name}'s scope. Chargeable projects: ${s.projects.filter((x) => x.active).map((x) => x.code).join(", ")}.`);
    if (!p.active) throw new ErpError("PROJECT_INACTIVE", `403: project ${p.code} (${p.name}) is closed and no longer accepts charges.`);
    const report = {
      id: `RP-${++state.counters.report}`,
      title: title.trim(), project: p.code, owner: s.id, status: "draft",
      createdAt: now().toISOString(), lines: [], submittedAt: null, signature: null, artifact: null,
    };
    state.reports.push(report);
    state.openReportId = report.id;
    log("tool", source, `Report created: ${report.id}`, `“${report.title}” · ${p.code}`);
    emit("reports");
    return report;
  }
  function openReport(id, source) {
    const s = requireSession();
    const r = getReport(id);
    if (s.role === "employee" && r.owner !== s.id) throw new ErpError("FORBIDDEN", `403: report ${id} belongs to another employee.`);
    state.openReportId = r.id;
    log("tool", source, `Report opened: ${r.id}`, r.title);
    emit("reports");
    return r;
  }

  // ── lines ────────────────────────────────────────────────────
  function addLine(fields, source) {
    requireEmployee();
    const r = requireOpenDraft();
    const line = normalizeLineInput(fields);
    line.id = `ln_${++state.counters.line}`;
    line.receiptId = null;
    line.createdBy = source;
    line.lastEditedBy = source;
    r.lines.push(line);
    log("tool", source, `Line ${line.id} added`, `${line.merchant ?? "?"} · ${line.category ?? "?"}`);
    emit("lines");
    return { report: r, line, verdict: verdict(r.id) };
  }
  function updateLine(lineId, patch, source) {
    requireEmployee();
    const r = requireOpenDraft();
    const idx = r.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) throw new ErpError("NOT_FOUND", `No line ${lineId} on the open report.`);
    const prev = r.lines[idx];
    const next = normalizeLineInput(patch, {
      date: prev.date, merchant: prev.merchant, category: prev.category,
      currency: prev.currency, description: prev.description,
      attendees: prev.attendees, nights: prev.nights,
      amount: prev.amountCents === null ? undefined : prev.amountCents / 100,
      itemization: prev.itemization?.map((it) => ({ label: it.label, amount: it.amountCents / 100 })),
    });
    next.id = prev.id;
    next.receiptId = prev.receiptId;
    next.createdBy = prev.createdBy;
    next.lastEditedBy = source;
    r.lines[idx] = next;
    log("tool", source, `Line ${lineId} updated`, Object.keys(patch).join(", "));
    emit("lines");
    return { report: r, line: next, verdict: verdict(r.id) };
  }
  function removeLine(lineId, source) {
    requireEmployee();
    const r = requireOpenDraft();
    const idx = r.lines.findIndex((l) => l.id === lineId);
    if (idx === -1) throw new ErpError("NOT_FOUND", `No line ${lineId} on the open report.`);
    const [line] = r.lines.splice(idx, 1);
    if (line.receiptId) {
      const rc = receiptById(line.receiptId);
      if (rc) rc.linkedLineId = null;
    }
    log("tool", source, `Line ${lineId} removed`, line.merchant ?? "");
    emit("lines");
    return { report: r, verdict: verdict(r.id) };
  }
  function linkReceipt(lineId, receiptId, source) {
    requireEmployee();
    const r = requireOpenDraft();
    const line = r.lines.find((l) => l.id === lineId);
    if (!line) throw new ErpError("NOT_FOUND", `No line ${lineId} on the open report.`);
    const rc = receiptById(receiptId);
    // D-68. The unknown-LINE case above and the unknown-RECEIPT case here used to
    // throw the SAME generic NOT_FOUND, so a caller could not tell which of two
    // different conditions it had hit — a latent defect found while F3 measured
    // why its predicate could not pass. Distinguished here, in erp.js, and
    // surfaced as text exactly as before: no envelope, no policy rule, no version
    // bump. An unknown id is a BAD ARGUMENT, not an expense-policy violation, and
    // violation.schema.json's own rule_id text keeps those namespaces apart "so
    // that a policy version bump changes expense validation and nothing else".
    if (!rc) throw new ErpError("RECEIPT_NOT_FOUND", `No receipt ${receiptId}. list_receipts shows what the employee has attached.`);
    if (rc.linkedLineId && rc.linkedLineId !== lineId)
      throw new ErpError("RECEIPT_TAKEN", `Receipt ${receiptId} already backs line ${rc.linkedLineId}. Each receipt backs exactly one line.`);
    const twin = state.receipts.find((x) => x.sha256 === rc.sha256 && x.id !== rc.id && x.linkedLineId);
    if (twin)
      throw new ErpError("RECEIPT_DUP", `Receipt ${receiptId} is byte-identical (sha256) to ${twin.id}, which already backs line ${twin.linkedLineId}. This looks like a duplicate claim.`);
    if (line.receiptId && line.receiptId !== receiptId) {
      const old = receiptById(line.receiptId);
      if (old) old.linkedLineId = null;
    }
    line.receiptId = receiptId;
    rc.linkedLineId = lineId;
    line.lastEditedBy = source;
    log("tool", source, `Receipt ${receiptId} linked to ${lineId}`, rc.filename);
    emit("lines");
    return { report: r, line, verdict: verdict(r.id) };
  }

  // ── submission (only ever called after the human signs) ──────
  function submitOpenReport(signature, source) {
    requireEmployee();
    const r = requireOpenDraft();
    const vd = verdict(r.id);
    if (!vd.clean) throw new ErpError("NOT_CLEAN", `Report ${r.id} still has ${vd.blocking} blocking violation(s).`);
    if (!signature?.signedBy) throw new ErpError("BAD_INPUT", "A submission needs the employee's signature.");
    const provenance = {
      agentLines: r.lines.filter((l) => l.createdBy !== "human").length,
      humanEditedLines: r.lines.filter((l) => l.lastEditedBy === "human").length,
      totalLines: r.lines.length,
    };
    r.status = "submitted";
    r.submittedAt = now().toISOString();
    r.signature = { ...signature, at: r.submittedAt };
    const confirmation = `CH-${String(++state.counters.confirm).padStart(4, "0")}`;
    r.artifact = {
      schema: "countinghouse.artifact/1",
      confirmation,
      policyVersion: POLICY_VERSION,
      report: {
        id: r.id, title: r.title, project: r.project, owner: r.owner,
        totalUsd: vd.totalUsd, warnings: vd.warnings,
        lines: r.lines.map((l) => ({
          id: l.id, date: l.date, merchant: l.merchant, category: l.category,
          amountCents: l.amountCents, currency: l.currency, usdCents: l.usdCents,
          receipt: l.receiptId ? { id: l.receiptId, sha256: receiptById(l.receiptId)?.sha256 } : null,
          filledBy: l.createdBy, lastEditedBy: l.lastEditedBy,
        })),
      },
      provenance,
      signature: r.signature,
      dayBookDigest: fnv1a(JSON.stringify(state.dayBook.map((e) => [e.kind, e.label]))),
    };
    log("human", source, `Signed & submitted: ${r.id}`, `${confirmation} · to ${state.session.approver}`);
    emit("reports");
    return { report: r, confirmation, artifact: r.artifact, verdict: vd };
  }

  // ── server commit view cache ──────────────────────────────────
  //
  // submitOpenReport() stays above for the seeded/local demonstration paths that
  // already depend on it. The page tool no longer calls it after signing: doing so
  // would mint a second confirmation and append a second, client-only submission
  // event after the server had already committed the report. applyCommitResult()
  // therefore does the smaller job the page still needs — move its view cache to
  // the submitted state using the server's timestamp, actor and artifact, then emit
  // the ordinary report change so the registered surface shrinks immediately.
  // It deliberately does not call log() or increment counters.confirm; those values
  // belong to the server response and its SHA-256 day-book chain.
  function applyCommitResult(reportId, result) {
    requireEmployee();
    const r = requireOpenDraft();
    if (r.id !== reportId) throw new ErpError("NOT_FOUND", `Report ${reportId} is not the open draft.`);
    r.status = "submitted";
    r.submittedAt = result.chain_entry.at;
    r.signature = { signedBy: result.chain_entry.actor, at: result.chain_entry.at };
    r.artifact = result.artifact;
    emit("reports");
    return r;
  }

  // ── canonical digest (drift check) ───────────────────────────
  // Options let the "two agent styles, one ledger" demo compare pure line
  // data across two drafts (receipts can't be shared between reports — the
  // duplicate guard correctly forbids it — so they're excluded there).
  function canonicalDigest(reportId, { receipts = true, status = true } = {}) {
    const r = getReport(reportId);
    const lines = r.lines
      .map((l) => ({
        date: l.date, merchant: l.merchant?.toLowerCase(), category: l.category,
        usdCents: l.usdCents, attendees: l.attendees ?? null, nights: l.nights ?? null,
        receiptSha: receipts ? (l.receiptId ? receiptById(l.receiptId)?.sha256 ?? null : null) : undefined,
        items: l.itemization?.map((it) => ({ label: it.label.toLowerCase(), amountCents: it.amountCents }))
          .sort((a, b) => a.label.localeCompare(b.label)) ?? null,
      }))
      .sort((a, b) => (a.merchant + a.date).localeCompare(b.merchant + b.date));
    return fnv1a(JSON.stringify({ project: r.project, status: status ? r.status : undefined, lines }));
  }

  // ── seed: one archived, already-submitted report ─────────────
  function seed() {
    const t = now();
    const rc = {
      id: `rc_${++state.counters.receipt}`, filename: "jul-visit-cab.pdf", size: 48213,
      sha256: "9d1e7a5c0b8f42a6e3d94417c25a80fe6b1c9d0347f8ab52ce61904d7e3b21aa",
      addedBy: "human", linkedLineId: "ln_a1", duplicateOf: null, archived: true,
    };
    state.receipts.push(rc);
    state.reports.push({
      id: "RP-1017", title: "July site visit — Heron", project: "HERON", owner: "chen",
      status: "submitted", createdAt: daysAgoIso(t, 34), submittedAt: daysAgoIso(t, 32),
      signature: { signedBy: "Chen Xiao", at: daysAgoIso(t, 32) }, artifact: null,
      lines: [
        { id: "ln_a1", date: daysAgoIso(t, 35), merchant: "City Cab Co.", category: "transport",
          amountCents: 38_50, currency: "USD", usdCents: 38_50, receiptId: rc.id,
          createdBy: "human", lastEditedBy: "human", description: "Airport → plant" },
        { id: "ln_a2", date: daysAgoIso(t, 35), merchant: "Heron Cafeteria", category: "meals",
          amountCents: 18_20, currency: "USD", usdCents: 18_20, receiptId: null,
          createdBy: "human", lastEditedBy: "human", attendees: 1, description: "Lunch" },
      ],
    });
  }
  seed();

  return {
    state, now, onChange, log,
    signIn, signOut, session: () => state.session,
    adoptServerReport, adoptServerReports, adoptServerReceipts,
    attachReceipt, listReports, createReport, openReport,
    openReportOrNull: () => (state.openReportId ? getReport(state.openReportId) : null),
    addLine, updateLine, removeLine, linkReceipt,
    verdict, submitOpenReport, applyCommitResult, canonicalDigest,
    receiptById,
  };
}
