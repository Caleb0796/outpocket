// server/authz.mjs — per-request role authorization, on the server.
//
// Node S2. HANDOVER §5's retracted claim about where the tool surface sits
// does not hold — countinghouse/src/erp.js:101 is a client telling itself
// 403, which is not enforcement at all. The correct sentence, per that
// retraction: the tool surface is the intent surface; the boundary is on
// the server (enforced here, by G4's lint). The page's tool list is a menu
// an auditor's own browser could ignore; what actually stops an auditor
// session from writing is this module, consulted on every mutating request,
// never the absence of a button — and never anything claimed as an
// unconditional guarantee of the surface itself.
//
// Exactly two personas exist (S1): chen (employee), ruiz (auditor). Only
// `employee` may call a write route — this is coarse-grained and
// report-agnostic on purpose: an auditor session gets 403 on every write,
// full stop, never a per-report ownership check that could accidentally
// let one auditor through on a technicality.
export const WRITE_ROLE = "employee";

export class AuthzError extends Error {
  constructor(message) {
    super(message || "forbidden");
    this.name = "AuthzError";
    this.code = "E_ROLE_FORBIDDEN";
    this.http = 403;
  }
}

/** authorizeWrite(session) — throws AuthzError(403, E_ROLE_FORBIDDEN) unless session.role === 'employee'. */
export function authorizeWrite(session) {
  if (!session || session.role !== WRITE_ROLE) {
    throw new AuthzError(`role '${session?.role ?? "none"}' may not call a write route — only '${WRITE_ROLE}' may`);
  }
}

export function authorizeReportRead(session, report) {
  if (!session) throw new AuthzError("authentication is required");
  if (session.role === "auditor") return;
  if (session.role === WRITE_ROLE && report?.owner === session.personaId) return;
  throw new AuthzError(`report '${report?.id ?? "unknown"}' is not readable by '${session.personaId ?? "none"}'`);
}

export function authorizeReportWrite(session, report) {
  authorizeWrite(session);
  if (!report || report.owner !== session.personaId) {
    throw new AuthzError(`report '${report?.id ?? "unknown"}' is not writable by '${session.personaId ?? "none"}'`);
  }
}

// The server's own exported write-route table. tests/acceptance/curl-403.sh
// reads THIS array (via `node --input-type=module -e "import('./server/
// authz.mjs').then(...)"`), never a hand-copied list — a route added here
// without a matching authorizeWrite() call in server/index.mjs is exactly
// the gap that script is built to catch; a route added to index.mjs and
// forgotten here is the gap curl-403.sh's own "table has a route it does
// not cover" clause exists to make impossible.
//
// `:report_id` / `:line_id` are literal path placeholders the test
// substitutes with fixture ids it creates along the way — this table
// doesn't need to know which report/line ids exist to describe its own
// shape.
//
// Scope note: this table stops at the sign gate's own front door
// (`POST /api/sign`, which this module now also gates — see
// server/index.mjs). `/api/sign/:id/respond` and `/api/reports/:id/commit`
// are deliberately NOT in this positive-control table because a successful
// request needs an already-open sign record and, for /respond, the dialog's
// confirm_token. Both routes still call authorizeWrite() before parsing and
// then require the exact session that opened the record.
export const WRITE_ROUTES = Object.freeze([
  Object.freeze({ method: "POST", path: "/api/reports", tool: "create_expense_report" }),
  Object.freeze({ method: "POST", path: "/api/reports/:report_id/open", tool: "open_expense_report" }),
  Object.freeze({ method: "POST", path: "/api/reports/:report_id/lines", tool: "add_expense_line" }),
  Object.freeze({ method: "PATCH", path: "/api/reports/:report_id/lines/:line_id", tool: "update_expense_line" }),
  Object.freeze({ method: "POST", path: "/api/ui/receipts", tool: "page_attach_receipt" }),
  Object.freeze({ method: "PATCH", path: "/api/ui/reports/:report_id", tool: "page_update_expense_report" }),
  Object.freeze({ method: "PATCH", path: "/api/ui/reports/:report_id/lines/:line_id", tool: "page_update_expense_line" }),
  Object.freeze({ method: "POST", path: "/api/reports/:report_id/lines/:line_id/receipt", tool: "link_receipt" }),
  Object.freeze({ method: "DELETE", path: "/api/reports/:report_id/lines/:line_id", tool: "remove_expense_line" }),
  Object.freeze({ method: "POST", path: "/api/sign", tool: "submit_expense_report" }),
]);
