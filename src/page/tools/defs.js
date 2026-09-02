// outpocket — the sixteen tool definitions (node T1, seat I2).
//
// PORTED, not rewritten, from src/tools.js. This half answers "what IS a tool":
// name, description, inputSchema, annotations, execute. Which of them exist right
// now is the other half, and it lives in ./compile.js. That split is the same one
// erp/contracts/tool-surface.contract.md draws between its §2 (the catalogue) and
// its §1 (the six states), and the contract is FROZEN, so the seam is too. §2 lists
// SEVENTEEN since the D-77 bump; the sixteen below are the expense-desk tools, and
// the seventeenth is the absence register, which ./compile.js assembles because it
// needs the membership table and ./absence.js must not import it.
//
// Names, per-state membership and the read-only column are frozen. Descriptions are
// not: they may be re-worded inside the 500-char budget without a ticket. This round
// changes only the agent-facing precision of those descriptions; it does not change
// which definitions exist or when they are registered.
//
// Pure module: no DOM, no browser globals, no registration. Registration is node T2
// and it happens in the top-level document only.
//
// The browser parses inputSchema and checks that the arguments are an Object; it does
// NOT validate against the schema. Every write tool therefore checks its own arguments
// in code, and the server checks them again underneath.
//
// The annotation key set is exactly readOnlyHint and untrustedContentHint. Nothing
// else. The latter marks two precise classes: reads that can return employee-authored
// text, and writes whose result can echo the title, merchant, line, receipt or return
// reason supplied by a person. It stays off server-owned session and policy reads,
// preserving the distinction instead of flattening every definition into one class.

import { CATEGORIES, FX, fmtUsd, fmtMoney, policyForAgent } from "../../policy.js";

export const OUTPUT_BUDGET = 1500; // official per-tool output budget
export const DESC_BUDGET = 500; // official description budget

export const ok = (text) => ({ content: [{ type: "text", text }] });

export function clip(text, budget = OUTPUT_BUDGET) {
  if (text.length <= budget) return text;
  const note = " …[truncated — use a visible report_id, line_id, or receipt_id to make the next tool call narrower]";
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
    ? (vd.clean && r.lines.length
        ? "submit_expense_report is registered now; clients that snapshot the tool list per turn will see it on their next turn."
        : "submit_expense_report is not registered now; clients that snapshot the tool list per turn will see that state on their next turn.")
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

function errorFrom(body) {
  if (typeof body?.error === "string") return { code: body.error, message: body.message };
  if (body?.error && typeof body.error === "object") {
    return { code: body.error.code, message: body.error.message ?? body.message };
  }
  return { code: null, message: body?.message };
}

function sentence(text, fallback) {
  const value = typeof text === "string" && text.trim() ? text.trim() : fallback;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function commitRefusalText(status, body) {
  const { code, message } = errorFrom(body);
  const named = code ? ` [${code}]` : "";
  if (status === 422 || code === "E_NOT_CLEAN") {
    return `The server rechecked the report and refused submission${named}: ` +
      `${sentence(message, "blocking policy violations remain")} The draft stays editable; validate it again before retrying.`;
  }
  if (status === 423) {
    return `The server refused submission${named} because this report is locked by a signing operation: ` +
      `${sentence(message, "the report is busy")} The draft stays editable; wait for that operation to finish before retrying.`;
  }
  if (status === 409) {
    return `The server refused submission${named} because the signing state or signed snapshot no longer matches: ` +
      `${sentence(message, "the signed state is stale")} The draft stays editable; start a fresh review before retrying.`;
  }
  return `The server refused submission${named}: ${sentence(message, `HTTP ${status}`)} The draft stays editable.`;
}

function verificationText(verification) {
  if (verification?.ok === true || verification === true) return "verified";
  if (verification?.ok === false) {
    const where = Number.isInteger(verification.brokenAtIndex) ? ` at index ${verification.brokenAtIndex}` : "";
    return `failed${where}: ${verification.reason ?? "the server reported a broken link"}`;
  }
  if (verification === false) return "failed";
  if (typeof verification === "string" && verification) return verification;
  return "not reported";
}

function chainEntryText(entry) {
  const detail = entry.detail ? ` — ${entry.detail}` : "";
  return `#${entry.seq} ${entry.at} [${entry.kind}/${entry.source}] ${entry.actor}: ${entry.label}${detail}\n` +
    `  prev ${entry.prev}\n  sha256 ${entry.entry_digest}`;
}

export const TEXT = { violationText, reportStatusLine, lineText, lineVerdictText, fullVerdictText };

// ── the sixteen definitions ────────────────────────────────────
// Returns every definition, keyed by name, for the CURRENT erp state. Selecting
// which of them are on the surface is compileSurface()'s job, not this function's.
export function buildDefs(erp, hooks = {}) {
  const S = { type: "string" };
  const session = erp.session();
  const activeProjectCodes = session?.projects.filter((project) => project.active).map((project) => project.code) ?? [];
  const api = hooks.api;

  function serverApi(method) {
    if (typeof api?.[method] !== "function") {
      throw new Error(`The server API does not provide ${method}().`);
    }
    return api[method].bind(api);
  }

  function adoptReportPayload(payload, { open = false } = {}) {
    const report = erp.adoptServerReport(payload.report, { open, provenance: payload.provenance });
    if (Array.isArray(payload.receipts)) erp.adoptServerReceipts(payload.receipts);
    return report;
  }

  const get_signin_status = {
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

  const get_session_scope = {
    name: "get_session_scope",
    description:
      "Read the signed-in person's expense scope: name, role, cost center, chargeable projects with active flags, approver, and reimbursement currency. Everything an expense report can charge against comes from this session's scope, not from anything the agent supplies.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => {
      const s = session;
      const projects = s.projects.length
        ? s.projects.map((p) => `${p.code} (${p.name} — ${p.active ? "ACTIVE" : "CLOSED"})`).join("; ")
        : "none (read-only role)";
      return ok(
        `${s.name} · ${s.title} · role ${s.role} · ${s.costCenter}. Chargeable projects: ${projects}. ` +
        `Approver: ${s.approver ?? "n/a"}. Reimbursement currency: ${s.currency}. All actions run inside this signed-in session.`);
    },
  };

  const get_expense_policy = {
    name: "get_expense_policy",
    description:
      "Read the company expense policy as compact JSON: per-category caps, receipt and itemization thresholds, non-reimbursable items, accepted currencies with conversion rates, filing window, and the policy version. This is the same document the page enforces on every write — no policy needs to live in a prompt.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    execute: () => ok(JSON.stringify(policyForAgent())),
  };

  const list_expense_reports = {
    name: "list_expense_reports",
    description:
      "List this session's expense reports with id, title, project, status (draft or submitted), line count and USD total.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args, opts) => {
      const payload = await serverApi("listReports")(opts?.signal);
      erp.adoptServerReports(payload.reports);
      const rows = erp.listReports().map((r) => `${r.id} “${r.title}” · ${r.project} · ${r.status} · ${r.lines} line(s) · ${fmtUsd(r.totalUsd)}`);
      return ok(rows.length ? rows.join("\n") : "No reports yet.");
    },
  };

  const create_expense_report = {
    name: "create_expense_report",
    description:
      "Create a new draft expense report and open it in the page. Needs a short title and a project code from the employee's own scope (see get_session_scope); charges to closed or out-of-scope projects are refused by the server.",
    inputSchema: {
      type: "object",
      properties: {
        title: { ...S, description: "Short human-readable title, e.g. 'Boston client workshop'" },
        project: { ...S, enum: activeProjectCodes, description: "Active project code from get_session_scope, e.g. FALCON" },
      },
      required: ["title", "project"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const payload = await serverApi("createReport")(args, opts?.signal);
      const r = adoptReportPayload(payload, { open: true });
      return ok(`Draft ${r.id} created and opened for project ${r.project}.\n${reportStatusLine(erp)}`);
    },
  };

  const open_expense_report = {
    name: "open_expense_report",
    description:
      "Open an expense report in the page so the employee and the agent are looking at the same thing. Takes the report id from list_expense_reports.",
    inputSchema: {
      type: "object",
      properties: { report_id: { ...S, description: "from list_expense_reports, e.g. RP-1018" } },
      required: ["report_id"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const payload = await serverApi("openReport")(args, opts?.signal);
      adoptReportPayload(payload, { open: true });
      return ok(reportStatusLine(erp));
    },
  };

  const get_open_report = {
    name: "get_open_report",
    description:
      "Read the report currently open in the page: header; lines, truncated at the output budget with a note when a report is large, with amounts, receipt links and provenance (agent-filled vs employee-edited); totals and validation counts.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
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
  const get_report = {
    name: "get_report",
    description:
      "Read one expense report by id: header and status; lines, truncated at the output budget with a note when a report is large, with amounts, receipt links and provenance; totals and validation counts. A pure read — it does not open the report or write anything. Ids come from list_expense_reports.",
    inputSchema: {
      type: "object",
      properties: { report_id: { ...S, description: "from list_expense_reports, e.g. RP-1018" } },
      required: ["report_id"],
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async ({ report_id }, opts) => {
      // The browser parses inputSchema but does not enforce it, so check here.
      const id = typeof report_id === "string" ? report_id.trim() : "";
      if (!id) {
        const known = erp.listReports().map((x) => x.id).join(", ");
        return ok(`No report ${id || "(no report_id given)"}. Readable here: ${known || "(none)"}.`);
      }
      let payload;
      try {
        payload = await serverApi("getReport")(id, opts?.signal);
      } catch (error) {
        if (error?.status !== 404) throw error;
        const known = erp.listReports().map((x) => x.id).join(", ");
        return ok(`No report ${id}. Readable here: ${known || "(none)"}.`);
      }
      const r = adoptReportPayload(payload);
      const vd = erp.verdict(r.id); // pure: validates, never records
      const lines = r.lines.length ? r.lines.map(lineText).join("\n") : "(no lines)";
      return ok(
        `Report ${r.id} “${r.title}” (${r.project}) · ${r.status} · ${r.lines.length} line(s) · ` +
        `total ${fmtUsd(vd.totalUsd)} · ${vd.blocking} blocking, ${vd.warnings} warning(s).\n${lines}`);
    },
  };

  const lineProps = {
    date: { ...S, format: "date", description: "Receipt date, YYYY-MM-DD" },
    merchant: { ...S, description: "Merchant name as printed on the receipt" },
    category: { type: "string", enum: CATEGORIES },
    amount: { type: "number", exclusiveMinimum: 0, description: "Receipt total as a decimal in its own currency, e.g. 186.40" },
    currency: { type: "string", enum: Object.keys(FX), default: "USD", description: "Defaults to USD" },
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

  const add_expense_line = {
    name: "add_expense_line",
    description:
      "Add one expense line, transcribed from one receipt, to the open draft report. The server validates it against the live policy immediately and returns any violations with fix hints — expect to iterate until the line is clean.",
    inputSchema: {
      type: "object",
      properties: lineProps,
      required: ["date", "merchant", "category", "amount"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const open = erp.openReportOrNull();
      const payload = await serverApi("addLine")(open.id, coerceLine(args), opts?.signal);
      const report = adoptReportPayload(payload);
      const line = report.lines.find((entry) => entry.id === payload.line_id);
      return ok(`Line ${line.id} added: ${line.merchant} · ${line.category} · ${fmtMoney(line.amountCents ?? 0, line.currency)}.\n${lineVerdictText(erp, line)}`);
    },
  };

  const update_expense_line = {
    name: "update_expense_line",
    description:
      "Update fields of one line on the open draft report (partial update; only the fields given change). Returns the line's fresh validation verdict — this is how violations get fixed.",
    inputSchema: {
      type: "object",
      properties: { line_id: { ...S, description: "from get_open_report, e.g. ln_3" }, ...lineProps },
      required: ["line_id"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const open = erp.openReportOrNull();
      const payload = await serverApi("updateLine")(
        open.id,
        coerceLine(args),
        opts?.signal,
      );
      const report = adoptReportPayload(payload);
      const line = report.lines.find((entry) => entry.id === args.line_id);
      return ok(`Line ${args.line_id} updated.\n${lineVerdictText(erp, line)}`);
    },
  };

  const remove_expense_line = {
    name: "remove_expense_line",
    description: "Remove one line from the open draft report. Its linked receipt, if any, becomes available again.",
    inputSchema: {
      type: "object",
      properties: { line_id: { ...S, description: "from get_open_report, e.g. ln_3" } },
      required: ["line_id"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const open = erp.openReportOrNull();
      const payload = await serverApi("removeLine")(open.id, args, opts?.signal);
      adoptReportPayload(payload);
      return ok(`Line ${args.line_id} removed.\n${reportStatusLine(erp)}`);
    },
  };

  const list_receipts = {
    name: "list_receipts",
    description:
      "List the receipt files the employee has attached in the page: id, filename, size, SHA-256 prefix, and whether each already backs a line. Receipt files stay in the employee's browser; tools only ever see this metadata.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args, opts) => {
      const payload = await serverApi("listReceipts")(opts?.signal);
      erp.adoptServerReceipts(payload.receipts);
      const rows = erp.state.receipts
        .filter((r) => !r.archived)
        .map((r) => `${r.id} ${r.filename} · ${(r.size / 1024).toFixed(1)}KB · sha256 ${r.sha256.slice(0, 12)}… · ${r.linkedLineId ? `backs ${r.linkedLineId}` : "unlinked"}${r.duplicateOf ? ` · byte-identical to ${r.duplicateOf}` : ""}`);
      return ok(rows.length ? rows.join("\n") : "The employee has not attached any receipt files yet. Attaching files is done by the employee, in the page.");
    },
  };

  const link_receipt = {
    name: "link_receipt",
    description:
      "Link one attached receipt file to one expense line as its evidence. Each receipt backs exactly one line; byte-identical duplicates are refused by the server.",
    inputSchema: {
      type: "object",
      properties: {
        line_id: { ...S, description: "from get_open_report, e.g. ln_3" },
        receipt_id: { ...S, description: "from list_receipts, e.g. rc_2" },
      },
      required: ["line_id", "receipt_id"],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      const open = erp.openReportOrNull();
      const payload = await serverApi("linkReceipt")(open.id, args, opts?.signal);
      const report = adoptReportPayload(payload);
      const line = report.lines.find((entry) => entry.id === args.line_id);
      return ok(`Receipt ${args.receipt_id} now backs ${args.line_id}.\n${lineVerdictText(erp, line)}`);
    },
  };

  const validate_expense_report = {
    name: "validate_expense_report",
    description:
      "Run the full policy validation over the open report and return violations, truncated at the output budget with a note when a report is large: code, severity (block or warn), field, message and fix hint, plus totals. Blocking violations keep the report from being submittable.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args, opts) => {
      const open = erp.openReportOrNull();
      const payload = await serverApi("validateReport")(open.id, opts?.signal);
      adoptReportPayload(payload);
      return ok(fullVerdictText(erp));
    },
  };

  const submit_expense_report = {
    name: "submit_expense_report",
    description:
      `Request submission of the open expense report. A response with {"status":"awaiting_signature","ticket":"…"} means the page is waiting for the employee’s Sign or Send back decision. When the employee has chosen, invoke submit_expense_report with {} to read the server-owned decision and either finish or refuse submission. Submission is the employee’s act — this tool only requests it.`,
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args, opts) => {
      let r = erp.openReportOrNull();
      if (!r) return ok("No report is open.");
      const validated = await serverApi("validateReport")(r.id, opts?.signal);
      r = adoptReportPayload(validated);
      const vd = erp.verdict(r.id); // double lock: re-verify at execution time
      if (!vd.clean || r.status !== "draft" || !r.lines.length)
        return ok(`Refused: the report is not clean right now (${vd.blocking} blocking violation(s)). The submit door only exists while every check passes.\n${fullVerdictText(erp)}`);
      const summary = {
        reportId: r.id, title: r.title, project: r.project,
        personaId: erp.session().id,
        totalUsd: vd.totalUsd, warnings: vd.warnings,
        approver: erp.session().approver,
        lines: r.lines.map((l) => ({
          id: l.id, merchant: l.merchant, usd: fmtUsd(l.usdCents),
          receiptId: l.receiptId, filledBy: l.createdBy, lastEditedBy: l.lastEditedBy,
        })),
      };
      const decision = await hooks.requestSignature(summary, opts?.signal);
      if (decision?.status === "awaiting_signature") {
        return ok(JSON.stringify({
          status: decision.status,
          ticket: decision.ticket,
          waiting_on: "employee_page_decision",
          resume: { tool: "submit_expense_report", arguments: {} },
        }));
      }
      if (decision?.status === "submission_in_progress") {
        return ok(JSON.stringify({
          status: decision.status,
          ticket: decision.ticket,
          waiting_on: "submission_completion",
          resume: { tool: "submit_expense_report", arguments: {} },
        }));
      }
      if (!decision?.signed)
        return ok(`The employee reviewed the report and sent it back${decision?.reason ? `: “${decision.reason}”` : "."} The draft stays editable — adjust it and try again.`);

      if (!decision.request_id) {
        return ok("The server recorded the signing response without returning its request id, so the report was not committed. The draft stays editable; start a fresh review before retrying.");
      }

      let committed;
      try {
        committed = await serverApi("commitReport")(r.id, decision.request_id, opts?.signal);
      } catch (error) {
        if (error?.name === "AbortError") {
          decision.settle?.({
            status: "retryable",
            message: "The commit request was aborted before the server answered; call submit_expense_report again.",
          });
          throw error;
        }
        const message = `The server could not finish submission: ${sentence(error?.message, "the commit request failed")} The signed request is retained; call submit_expense_report again to retry.`;
        decision.settle?.({ status: "retryable", message });
        return ok(message);
      }

      if (!committed.ok) {
        const message = commitRefusalText(committed.status, committed.body);
        decision.settle?.({ status: "retryable", message });
        return ok(message);
      }
      const result = committed.body;
      if (result?.schema !== "outpocket.commit_result/1" || result.status !== "committed") {
        const message = result?.status === "rejected"
          ? commitRefusalText(result.http_status ?? committed.status, result)
          : "The server returned an unexpected commit response. The page did not mark the draft submitted; refresh it from the server before taking another action.";
        decision.settle?.({ status: "retryable", message });
        return ok(message);
      }

      decision.settle?.({
        status: "committed",
        confirmation: result.confirmation ?? null,
        message: result.confirmation
          ? `Submitted. Confirmation ${result.confirmation}.`
          : "Submitted. Refresh the report to read the server confirmation.",
      });

      const provenance = result.artifact?.provenance_summary;
      if (!result.confirmation || !result.chain_entry?.at || !result.chain_entry?.actor ||
          !result.artifact?.chain_head || !provenance) {
        return ok("The server committed the report but returned an incomplete result. Refresh the page to read the committed report and its day-book entry.");
      }

      try {
        const fresh = await serverApi("getReport")(r.id, opts?.signal);
        adoptReportPayload(fresh);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return ok(
          `Signed and submitted. Confirmation ${result.confirmation}, but the page could not refresh the committed report: ` +
          `${sentence(error?.message, "the read-back failed")} Refresh the page before taking another action.`,
        );
      }
      return ok(
        `Signed and submitted. Confirmation ${result.confirmation}; server revision ${result.committed_revision}. ` +
        `Provenance: ${provenance.agent_fields}/${provenance.total_fields} field(s) filled via agent tools, ` +
        `${provenance.human_fields} human-filled, ${provenance.seed_fields} seeded. ` +
        `Commit actor ${result.chain_entry.actor}; policy ${result.artifact.policy_version}; ` +
        `SHA-256 day-book head ${result.artifact.chain_head}.`);
    },
  };

  const get_day_book = {
    name: "get_day_book",
    description:
      "Read the server day book: SHA-256 hash-chain entries for committed reports, plus the server's chain head and verification result. Auditor sessions read it; this call does not edit it.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (args, opts) => {
      let response;
      try {
        response = await serverApi("dayBook")(opts?.signal);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        return ok(`The server day book could not be read: ${sentence(error?.message, "the request failed")}`);
      }
      if (!response.ok) {
        const { code, message } = errorFrom(response.body);
        return ok(`The server refused the day-book read${code ? ` [${code}]` : ""}: ${sentence(message, `HTTP ${response.status}`)}`);
      }

      const entries = Array.isArray(response.body?.entries) ? response.body.entries : [];
      const shown = entries.slice(-6);
      const omitted = entries.length - shown.length;
      const header = `Chain verification: ${verificationText(response.body?.verification)}. ` +
        `Head: ${response.body?.head ?? "(empty chain)"}.`;
      if (!shown.length) return ok(`${header}\nThe server day book has no entries.`);
      const note = omitted ? `Showing the last ${shown.length} of ${entries.length} entries.\n` : "";
      return ok(`${header}\n${note}${shown.map(chainEntryText).join("\n")}`);
    },
  };

  return {
    get_signin_status, get_session_scope, get_expense_policy, list_expense_reports,
    create_expense_report, open_expense_report, get_open_report, get_report,
    add_expense_line, update_expense_line, remove_expense_line,
    list_receipts, link_receipt, validate_expense_report, submit_expense_report,
    get_day_book,
  };
}

// Every name a definition exists for, in the order buildDefs returns them. T3's
// absence register needs "every name that COULD exist" alongside "every name that
// does"; it derives the first from here rather than typing a second list. Checked
// against buildDefs() itself by assertCatalogue() below, so the two cannot drift.
export const ALL_TOOL_NAMES = Object.freeze([
  "get_signin_status", "get_session_scope", "get_expense_policy", "list_expense_reports",
  "create_expense_report", "open_expense_report", "get_open_report", "get_report",
  "add_expense_line", "update_expense_line", "remove_expense_line",
  "list_receipts", "link_receipt", "validate_expense_report", "submit_expense_report",
  "get_day_book",
]);

// Cheap structural self-check over one built catalogue: every key equals its def's
// own `name`, and the key set equals ALL_TOOL_NAMES. Returns the list of problems
// so a caller can decide whether to throw; it never throws by itself.
export function assertCatalogue(built) {
  const problems = [];
  for (const [key, def] of Object.entries(built))
    if (def.name !== key) problems.push(`key ${key} holds a def named ${def.name}`);
  const keys = new Set(Object.keys(built));
  for (const n of ALL_TOOL_NAMES) if (!keys.has(n)) problems.push(`ALL_TOOL_NAMES has ${n}, buildDefs does not`);
  for (const k of keys) if (!ALL_TOOL_NAMES.includes(k)) problems.push(`buildDefs has ${k}, ALL_TOOL_NAMES does not`);
  return problems;
}
