// 账房 COUNTINGHOUSE — the tool-surface compiler.
// Compiles (session role × open-report state × validation verdict) into the
// set of WebMCP tools that exist right now. Workflow rules never live in
// descriptions; the surface itself is the state machine:
//
//   signed out                → 1 tool   (get_signin_status)
//   employee, no report open  → 5 tools
//   employee, draft open      → 12 tools
//   employee, draft clean     → 13 tools (submit_expense_report appears)
//   auditor                   → 6 tools  (read-only by construction: every tool
//                                on it is side-effect-free, so the property is a
//                                fact about the set, not a hint on a def)
//
// Pure module: no DOM. The page bridge, the in-page simulated agent, the
// manual tool console and `node --test` all dispatch through the same
// runTool() path, so every mode exercises identical behavior.

import { CATEGORIES, FX, fmtUsd, fmtMoney, policyForAgent } from "./policy.js";
import { ErpError } from "./erp.js";

export const OUTPUT_BUDGET = 1500; // official per-tool output budget
export const DESC_BUDGET = 500; // official description budget

const ok = (text) => ({ content: [{ type: "text", text }] });

export function clip(text, budget = OUTPUT_BUDGET) {
  if (text.length <= budget) return text;
  const note = " …[truncated — call validate_expense_report or get_open_report for details]";
  return text.slice(0, budget - note.length) + note;
}

const num = (x) => {
  if (typeof x === "number") return x;
  if (typeof x === "string" && x.trim() !== "" && !Number.isNaN(Number(x))) return Number(x);
  return x;
};

// ── text builders ──────────────────────────────────────────────
function violationText(v) {
  return `[${v.code}|${v.severity}] ${v.field}: ${v.message} → ${v.fix}`;
}

function reportStatusLine(erp) {
  const r = erp.openReportOrNull();
  if (!r) return "No report is open.";
  const vd = erp.verdict(r.id);
  const door = r.status === "draft"
    ? (vd.clean && r.lines.length ? "submit_expense_report is now on the tool surface." : "submit_expense_report is not on the tool surface yet.")
    : `Report is ${r.status} (read-only).`;
  return `Report ${r.id} “${r.title}” (${r.project}): ${r.lines.length} line(s) · total ${fmtUsd(vd.totalUsd)} · ${vd.blocking} blocking, ${vd.warnings} warning(s). ${door}`;
}

function lineText(l) {
  const extras = [
    l.attendees ? `${l.attendees} attendee(s)` : null,
    l.nights ? `${l.nights} night(s)` : null,
    l.currency !== "USD" ? `${fmtMoney(l.amountCents ?? 0, l.currency)} → ${fmtUsd(l.usdCents)}` : null,
    l.receiptId ? `receipt ${l.receiptId}` : "no receipt",
    `by ${l.createdBy}${l.lastEditedBy !== l.createdBy ? `, edited by ${l.lastEditedBy}` : ""}`,
  ].filter(Boolean).join(" · ");
  return `${l.id} ${l.date ?? "?"} ${l.merchant ?? "?"} · ${l.category ?? "?"} · ${fmtUsd(l.usdCents)} (${extras})`;
}

function lineVerdictText(erp, line) {
  const vd = erp.verdict();
  const vs = vd.lineViolations.get(line.id) ?? [];
  const head = vs.length
    ? `${vs.filter((x) => x.severity === "block").length} blocking / ${vs.filter((x) => x.severity === "warn").length} warning on ${line.id}:\n${vs.map(violationText).join("\n")}`
    : `${line.id} passes every policy check.`;
  return `${head}\n${reportStatusLine(erp)}`;
}

function fullVerdictText(erp) {
  const r = erp.openReportOrNull();
  if (!r) return "No report is open.";
  const vd = erp.verdict(r.id);
  const parts = [];
  for (const v of vd.reportViolations) parts.push(`report ${violationText(v)}`);
  for (const l of r.lines) {
    const vs = vd.lineViolations.get(l.id) ?? [];
    for (const v of vs) parts.push(`${l.id} ${violationText(v)}`);
  }
  const body = parts.length ? parts.join("\n") : "Every policy check passes.";
  return `${body}\n${reportStatusLine(erp)}`;
}

// ── tool definitions ───────────────────────────────────────────
function defs(erp, hooks) {
  const S = { type: "string" };
  const session = erp.session();
  const open = erp.openReportOrNull();

  const t_signin_status = {
    name: "get_signin_status",
    description:
      "Read whether an employee is signed in to Countinghouse, Meridian Fabrication's expense desk. Sign-in is the employee's own act, done in the page via company SSO — agents never see or present credentials. Returns the current sign-in state and what this page is for.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () =>
      ok(session
        ? `${session.name} (${session.role}) is signed in. The tools on this surface are compiled from that session's scope.`
        : "No one is signed in. This page files expense reports against Meridian's ERP. Once the employee signs in via SSO in the page, the tool surface for their role appears here — there is nothing else to call until then."),
  };

  const t_scope = {
    name: "get_session_scope",
    description:
      "Read the signed-in person's expense scope: name, role, cost center, chargeable projects with active flags, approver, and reimbursement currency. Everything an expense report can charge against comes from this session's scope, not from anything the agent supplies.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const s = session;
      const projects = s.projects.length
        ? s.projects.map((p) => `${p.code} (${p.name}${p.active ? "" : " — CLOSED"})`).join("; ")
        : "none (read-only role)";
      return ok(
        `${s.name} · ${s.title} · role ${s.role} · ${s.costCenter}. Chargeable projects: ${projects}. ` +
        `Approver: ${s.approver ?? "n/a"}. Reimbursement currency: ${s.currency}. All actions run inside this signed-in session.`);
    },
  };

  const t_policy = {
    name: "get_expense_policy",
    description:
      "Read the company expense policy as compact JSON: per-category caps, receipt and itemization thresholds, non-reimbursable items, accepted currencies with conversion rates, filing window, and the policy version. This is the same document the page enforces on every write — no policy needs to live in a prompt.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ok(JSON.stringify(policyForAgent())),
  };

  const t_list_reports = {
    name: "list_expense_reports",
    description:
      "List this session's expense reports with id, title, project, status (draft or submitted), line count and USD total.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const rows = erp.listReports().map((r) => `${r.id} “${r.title}” · ${r.project} · ${r.status} · ${r.lines} line(s) · ${fmtUsd(r.totalUsd)}`);
      return ok(rows.length ? rows.join("\n") : "No reports yet.");
    },
  };

  const t_create = {
    name: "create_expense_report",
    description:
      "Create a new draft expense report and open it in the page. Needs a short title and a project code from the employee's own scope (see get_session_scope); charges to closed or out-of-scope projects are refused by the server.",
    inputSchema: {
      type: "object",
      properties: {
        title: { ...S, description: "Short human-readable title, e.g. 'Boston client workshop'" },
        project: { ...S, description: "Project code from the employee's scope, e.g. FALCON" },
      },
      required: ["title", "project"],
    },
    execute: ({ title, project }, opts, source) => {
      const r = erp.createReport({ title, project }, source);
      return ok(`Draft ${r.id} created and opened for project ${r.project}.\n${reportStatusLine(erp)}`);
    },
  };

  const t_open = {
    name: "open_expense_report",
    description:
      "Open an expense report in the page so the employee and the agent are looking at the same thing. Takes the report id from list_expense_reports.",
    inputSchema: {
      type: "object",
      properties: { report_id: { ...S, description: "e.g. RP-1018" } },
      required: ["report_id"],
    },
    execute: ({ report_id }, opts, source) => {
      erp.openReport(report_id, source);
      return ok(reportStatusLine(erp));
    },
  };

  const t_get_open = {
    name: "get_open_report",
    description:
      "Read the report currently open in the page: header, every line with amounts, receipt links and provenance (which lines were filled by an agent vs edited by the employee), plus totals and validation counts.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const r = erp.openReportOrNull();
      if (!r) return ok("No report is open.");
      const lines = r.lines.length ? r.lines.map(lineText).join("\n") : "(no lines yet)";
      return ok(`${reportStatusLine(erp)}\n${lines}`);
    },
  };

  // Read-only by construction (R-9 (B)): unlike open_expense_report this never
  // touches openReportId and never appends to the day book, so it is safe on a
  // surface whose whole claim is that it cannot write.
  const t_get_report = {
    name: "get_report",
    description:
      "Read one expense report by id: header, status, every line with amounts, receipt links and provenance, totals, and the blocking and warning counts. A pure read — it does not open the report in the page and writes nothing, so the page keeps showing whatever it was showing. Ids come from list_expense_reports.",
    inputSchema: {
      type: "object",
      properties: { report_id: { ...S, description: "e.g. RP-1018" } },
      required: ["report_id"],
    },
    annotations: { readOnlyHint: true },
    execute: ({ report_id }) => {
      // The browser parses inputSchema but does not enforce it, so check here.
      const id = typeof report_id === "string" ? report_id.trim() : "";
      const r = id ? erp.state.reports.find((x) => x.id === id) : null;
      if (!r) {
        const known = erp.listReports().map((x) => x.id).join(", ");
        return ok(`No report ${id || "(no report_id given)"}. Readable here: ${known || "(none)"}.`);
      }
      const vd = erp.verdict(r.id); // pure: validates, never records
      const lines = r.lines.length ? r.lines.map(lineText).join("\n") : "(no lines)";
      return ok(
        `Report ${r.id} “${r.title}” (${r.project}) · ${r.status} · ${r.lines.length} line(s) · ` +
        `total ${fmtUsd(vd.totalUsd)} · ${vd.blocking} blocking, ${vd.warnings} warning(s).\n${lines}`);
    },
  };

  const lineProps = {
    date: { ...S, description: "Receipt date, YYYY-MM-DD" },
    merchant: { ...S, description: "Merchant name as printed on the receipt" },
    category: { type: "string", enum: CATEGORIES },
    amount: { type: "number", description: "Receipt total as a decimal in its own currency, e.g. 186.40" },
    currency: { type: "string", enum: Object.keys(FX), description: "Defaults to USD" },
    attendees: { type: "integer", minimum: 1, description: "Meals: number of people on the receipt" },
    nights: { type: "integer", minimum: 1, description: "Lodging: number of nights on the folio" },
    itemization: {
      type: "array",
      description: "Line items transcribed from the receipt: [{label, amount}]. Required for meals ≥ $75.",
      items: {
        type: "object",
        properties: { label: S, amount: { type: "number" } },
        required: ["label", "amount"],
      },
    },
    description: { ...S, description: "One-line business purpose" },
  };

  const coerceLine = (args) => {
    const out = { ...args };
    for (const k of ["amount", "attendees", "nights"]) if (k in out) out[k] = num(out[k]);
    if (Array.isArray(out.itemization))
      out.itemization = out.itemization.map((it) => (it && typeof it === "object" ? { ...it, amount: num(it.amount) } : it));
    return out;
  };

  const t_add_line = {
    name: "add_expense_line",
    description:
      "Add one expense line, transcribed from one receipt, to the open draft report. The server validates it against the live policy immediately and returns any violations with fix hints — expect to iterate until the line is clean.",
    inputSchema: {
      type: "object",
      properties: lineProps,
      required: ["date", "merchant", "category", "amount"],
    },
    execute: (args, opts, source) => {
      const { line } = erp.addLine(coerceLine(args), source);
      return ok(`Line ${line.id} added: ${line.merchant} · ${line.category} · ${fmtMoney(line.amountCents ?? 0, line.currency)}.\n${lineVerdictText(erp, line)}`);
    },
  };

  const t_update_line = {
    name: "update_expense_line",
    description:
      "Update fields of one line on the open draft report (partial update; only the fields given change). Returns the line's fresh validation verdict — this is how violations get fixed.",
    inputSchema: {
      type: "object",
      properties: { line_id: { ...S, description: "e.g. ln_3" }, ...lineProps },
      required: ["line_id"],
    },
    execute: ({ line_id, ...patch }, opts, source) => {
      const { line } = erp.updateLine(line_id, coerceLine(patch), source);
      return ok(`Line ${line_id} updated.\n${lineVerdictText(erp, line)}`);
    },
  };

  const t_remove_line = {
    name: "remove_expense_line",
    description: "Remove one line from the open draft report. Its linked receipt, if any, becomes available again.",
    inputSchema: {
      type: "object",
      properties: { line_id: S },
      required: ["line_id"],
    },
    execute: ({ line_id }, opts, source) => {
      erp.removeLine(line_id, source);
      return ok(`Line ${line_id} removed.\n${reportStatusLine(erp)}`);
    },
  };

  const t_list_receipts = {
    name: "list_receipts",
    description:
      "List the receipt files the employee has attached in the page: id, filename, size, SHA-256 prefix, and whether each already backs a line. Receipt files stay in the employee's browser; tools only ever see this metadata.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const rows = erp.state.receipts
        .filter((r) => !r.archived)
        .map((r) => `${r.id} ${r.filename} · ${(r.size / 1024).toFixed(1)}KB · sha256 ${r.sha256.slice(0, 12)}… · ${r.linkedLineId ? `backs ${r.linkedLineId}` : "unlinked"}${r.duplicateOf ? ` · byte-identical to ${r.duplicateOf}` : ""}`);
      return ok(rows.length ? rows.join("\n") : "The employee has not attached any receipt files yet. Attaching files is done by the employee, in the page.");
    },
  };

  const t_link = {
    name: "link_receipt",
    description:
      "Link one attached receipt file to one expense line as its evidence. Each receipt backs exactly one line; byte-identical duplicates are refused by the server.",
    inputSchema: {
      type: "object",
      properties: { line_id: S, receipt_id: { ...S, description: "From list_receipts, e.g. rc_2" } },
      required: ["line_id", "receipt_id"],
    },
    execute: ({ line_id, receipt_id }, opts, source) => {
      const { line } = erp.linkReceipt(line_id, receipt_id, source);
      return ok(`Receipt ${receipt_id} now backs ${line_id}.\n${lineVerdictText(erp, line)}`);
    },
  };

  const t_validate = {
    name: "validate_expense_report",
    description:
      "Run the full policy validation over the open report and return every violation — code, severity (block or warn), field, message and fix hint — plus totals. Blocking violations are what keep the report from being submittable.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ok(fullVerdictText(erp)),
  };

  const t_submit = {
    name: "submit_expense_report",
    description:
      `Submit the open expense report to the approver. This suspends while the employee reviews the report next to the attached receipt images and signs it in the page; it returns the signed confirmation, or the employee's reason for sending it back. Submission is the employee's act — this tool only requests it.`,
    inputSchema: { type: "object", properties: {} },
    execute: async (args, opts, source) => {
      const r = erp.openReportOrNull();
      if (!r) return ok("No report is open.");
      const vd = erp.verdict(r.id); // double lock: re-verify at execution time
      if (!vd.clean || r.status !== "draft" || !r.lines.length)
        return ok(`Refused: the report is not clean right now (${vd.blocking} blocking violation(s)). The submit door only exists while every check passes.\n${fullVerdictText(erp)}`);
      const summary = {
        reportId: r.id, title: r.title, project: r.project,
        totalUsd: vd.totalUsd, warnings: vd.warnings,
        approver: erp.session().approver,
        lines: r.lines.map((l) => ({
          id: l.id, merchant: l.merchant, usd: fmtUsd(l.usdCents),
          receiptId: l.receiptId, filledBy: l.createdBy, lastEditedBy: l.lastEditedBy,
        })),
      };
      const decision = await hooks.requestSignature(summary, opts?.signal);
      if (!decision?.signed)
        return ok(`The employee reviewed the report and sent it back${decision?.reason ? `: “${decision.reason}”` : "."} The draft stays editable — adjust it and try again.`);
      const { confirmation, artifact } = erp.submitOpenReport({ signedBy: erp.session().name, method: "signature-click" }, source);
      return ok(
        `Signed and submitted. Confirmation ${confirmation}; routed to ${summary.approver}. ` +
        `Provenance: ${artifact.provenance.agentLines}/${artifact.provenance.totalLines} line(s) filled via agent tools, ` +
        `${artifact.provenance.humanEditedLines} human-edited; signature by ${artifact.signature.signedBy}. ` +
        `A structured artifact (policy ${artifact.policyVersion}, line provenance, receipt hashes, day-book digest) is stored on the report.`);
    },
  };

  const t_day_book = {
    name: "get_day_book",
    description:
      "Read the day book: the append-only log of everything that happened in this session — tool calls by agents, sign-ins, receipt attachments, signatures. Auditor sessions read it; nothing in any session can edit it.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const rows = erp.state.dayBook.slice(-18).map((e) => `${e.ts.slice(11, 19)} [${e.kind}/${e.source}] ${e.actor}: ${e.label}${e.detail ? ` — ${e.detail}` : ""}`);
      return ok(rows.length ? rows.join("\n") : "The day book is empty.");
    },
  };

  // ── compile the surface for the current state ────────────────
  if (!session) return [t_signin_status];
  if (session.role === "auditor")
    return [t_scope, t_policy, t_list_reports, t_get_report, t_get_open, t_day_book];

  const base = [t_scope, t_policy, t_list_reports, t_create, t_open];
  if (!open) return base;
  if (open.status !== "draft") return [...base, t_get_open];

  const editing = [...base, t_get_open, t_add_line, t_update_line, t_remove_line, t_list_receipts, t_link, t_validate];
  const vd = erp.verdict(open.id);
  if (vd.clean && open.lines.length) editing.push(t_submit);
  return editing;
}

// ── toolset: one dispatch path for every mode ──────────────────
export function createToolset(erp, hooks = {}) {
  const surface = () => defs(erp, hooks);

  function surfaceKey() {
    return surface().map((d) => d.name).join("|");
  }

  async function runTool(def, args, opts, source) {
    const t0 = hooks.now ? hooks.now() : Date.now();
    const rec = hooks.onCallStart?.({ name: def.name, args, source });
    try {
      // Double lock: a captured execute must not outlive its registration.
      if (!surface().some((d) => d.name === def.name)) {
        const res = ok(`Tool ${def.name} is no longer on the surface — the page state moved on. Current tools: ${surfaceKey().replaceAll("|", ", ")}.`);
        hooks.onCallEnd?.(rec, { status: "gone", text: res.content[0].text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
        return res;
      }
      const raw = await def.execute(args ?? {}, opts, source);
      raw.content[0].text = clip(raw.content[0].text);
      hooks.onCallEnd?.(rec, { status: "ok", text: raw.content[0].text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
      return raw;
    } catch (e) {
      if (e?.name === "AbortError") {
        hooks.onCallEnd?.(rec, { status: "aborted", text: "aborted", ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
        throw e;
      }
      const text = e instanceof ErpError ? `Error [${e.code}]: ${e.message}` : `Error: ${e?.message ?? String(e)}`;
      hooks.onCallEnd?.(rec, { status: "err", text, ms: (hooks.now ? hooks.now() : Date.now()) - t0 });
      return ok(clip(text));
    }
  }

  async function call(name, args, { source = "agent", signal } = {}) {
    const def = surface().find((d) => d.name === name);
    if (!def) {
      const text = `No tool named "${name}" exists on the current surface. Available: ${surfaceKey().replaceAll("|", ", ") || "(none)"}.`;
      hooks.onCallEnd?.(hooks.onCallStart?.({ name, args, source }), { status: "gone", text, ms: 0 });
      return ok(text);
    }
    return runTool(def, args, { signal }, source);
  }

  return { surface, surfaceKey, runTool, call };
}
