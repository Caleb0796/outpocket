// server/sign.mjs — the human sign gate: server-owned decision state.
//
// Node S5. Contract: erp/contracts/signature.schema.json (FROZEN — sha256sum
// -c erp/contracts/FREEZE.md). Ruling R-1: the sign decision is recorded by
// the SERVER, never accepted as a client-authored claim. Ruling R-13: what
// this module proves is exactly one sentence — "a commit cannot be made
// without a POST from the authenticated session to
// /api/sign/{request_id}/respond" — and nothing stronger. It does NOT prove a
// human decided, and it does NOT prove cross-call report immutability (that
// gap is closed by S12's atomic sign lock, downstream of this node on a hard
// edge — see NOT_THIS_NODE below).
//
// Machine (x-signRequestState.machine):
//   open -> answered(signed) -> committed | expired
//   open -> answered(declined)
//   open -> expired
//
// Two distinct secrets, never confused:
//   - confirm_token (ct_...): minted with the sign request, delivered ONLY
//     via GET /api/sign/{request_id}/confirm-token (D-89) — a session-scoped
//     route that is NOT a registered tool — into the rendered dialog's DOM.
//     Never in any JSON response a TOOL can produce (see
//     peekConfirmTokenForDialog below and stripTicketAndToken), required by
//     respond(). Defence in depth (R-13(c)), not proof of personhood (R-44).
//   - ticket (tk_...): minted with the sign request, returned to the AGENT
//     in the tool-execute result of the two-call handshake (contingencies[4]
//     fired: handshake is the shipped mode, suspend stays behind the switch
//     as this node's own negative control — see createSignBridge in
//     src/page/sign-bridge.js). An agent-visible continuation capability,
//     distinct from confirm_token: rejecting it at /respond proves field
//     separation and nothing more.
//
// NOT THIS NODE (read before extending this file):
//   - E_SIGN_IN_PROGRESS / HTTP 423 / "the sign lock" — that is S12's atomic
//     report-mutation lock (x-freeze layer 2), server/locks.mjs, wired in
//     below (`locks.acquire` in open(), `locks.release` in respond()/
//     commit()/settleExpiry()). This module's OWN per-report `openByReport`
//     bookkeeping is a separate, narrower thing that exists ONLY to make the
//     ticket-expiry/reopen test meaningful (it stops a second /api/sign for
//     the same report; it says nothing about a write route that never goes
//     through /api/sign at all) — it is NOT layer 2 and must never be
//     described as such.
//   - E_SNAPSHOT_MISMATCH: S6 has landed (server/recanon.mjs). open() and
//     commit() both read the injected server aggregate before treating
//     anything as signed or committed — GIVEN a single server instance (S1), true by
//     construction, same argument as S12's lock. Still not this node's own
//     concern in one sense: the canonicalisation logic itself lives entirely
//     in recanon.mjs, unit-tested there; this module only calls it.
//   - The persisted, verifiable hash chain: S7 has landed
//     (server/chain.mjs). commit() below appends a real entry to it — the
//     earlier single-process, in-memory chain_entry stand-in this module
//     used to build itself is gone, replaced, not duplicated. Verification
//     (verifyChain, the byte-flip-at-an-index property) lives entirely in
//     chain.mjs; this module only calls append().
//   - Per-field provenance ledger — that is S8's. artifact.provenance_summary
//     below is counted honestly from the snapshot's own provenance map
//     (already present on every line), not fabricated.
import { randomBytes } from "node:crypto";
import { digest } from "../src/canonical.js";
import { PERSONAS as ERP_PERSONAS } from "../src/erp.js";
import { toUsdCents, validateReport } from "../src/policy.js";
import { createReportLocks } from "./locks.mjs";
import { reconcile, SNAPSHOT_DIGEST_PREFIX } from "./recanon.mjs";
import { createChain, CHAIN_DIGEST_PREFIX, GENESIS_DIGEST } from "./chain.mjs";
import { SERVED_POLICY } from "./routes/policy.mjs";

export { SNAPSHOT_DIGEST_PREFIX, CHAIN_DIGEST_PREFIX, GENESIS_DIGEST };

const DEFAULT_TTL_MS = 300_000; // 300s — R-43: now the human's budget, not a client-timeout guess.

export const REQUEST_ID_RE = /^sg_[0-9a-f]{16}$/;
export const CONFIRM_TOKEN_RE = /^ct_[0-9a-f]{32}$/;
export const TICKET_RE = /^tk_[0-9a-f]{32}$/;

export class SignError extends Error {
  constructor(code, http, message, detail) {
    super(message || code);
    this.name = "SignError";
    this.code = code;
    this.http = http;
    this.detail = detail;
  }
}

function newRequestId() {
  return "sg_" + randomBytes(8).toString("hex");
}
function newConfirmToken() {
  return "ct_" + randomBytes(16).toString("hex");
}
function newTicket() {
  return "tk_" + randomBytes(16).toString("hex");
}

function stripTicketAndToken(rec) {
  // The public projection of a record: exactly $defs.sign_request's shape.
  // additionalProperties:false in the frozen schema means confirm_token and
  // ticket may never appear here — not in the tool result, not in GET
  // /api/sign/{request_id}, not anywhere.
  return {
    schema: "outpocket.sign_request/1",
    request_id: rec.request_id,
    report_id: rec.report_id,
    revision: rec.revision,
    policy_version: rec.policy_version,
    snapshot: rec.snapshot,
    snapshot_digest: rec.snapshot_digest,
    worst_case: rec.worst_case,
    violation_history_count: rec.violation_history_count,
    created_at: rec.created_at,
    expires_at: rec.expires_at,
  };
}

function toSignResponse(rec) {
  return {
    schema: "outpocket.sign_response/1",
    request_id: rec.request_id,
    state: rec.state,
    decision: rec.decision,
    reason: rec.reason,
    signed_by: rec.signed_by,
    method: rec.method,
    at: rec.at,
    acknowledged_digest: rec.acknowledged_digest,
    acknowledged_revision: rec.acknowledged_revision,
  };
}

function countProvenance(snapshot) {
  const counts = { agent_fields: 0, human_fields: 0, seed_fields: 0, total_fields: 0 };
  for (const line of snapshot.report.lines) {
    if (!line.provenance || typeof line.provenance !== "object" || Array.isArray(line.provenance)) {
      throw new SignError("E_SNAPSHOT_MISMATCH", 409, `signed line ${line.id} is missing its provenance map`);
    }
    for (const source of Object.values(line.provenance)) {
      counts.total_fields++;
      if (source === "agent") counts.agent_fields++;
      else if (source === "human") counts.human_fields++;
      else if (source === "seed") counts.seed_fields++;
      // 'unset' counts toward total_fields only, matching the frozen
      // provenance_summary shape (agent+human+seed need not sum to total).
    }
  }
  return counts;
}

const PROVENANCE_FIELDS = Object.freeze([
  "amount", "attendees", "category", "currency", "date",
  "description", "itemization", "merchant", "nights", "receipt_id",
]);
const PROVENANCE_SOURCES = new Set(["agent", "human", "seed", "unset"]);

// validateReport() consumes the browser ERP's normalized camelCase line
// shape, while the signed contract and HTTP store use snake_case integer
// cents. This adapter is deliberately only a projection: every rule and
// threshold still runs in src/policy.js. Rewriting the caps beside the
// server routes was rejected because two copies could disagree while both
// continued returning plausible verdicts.
function toPolicyReport(report) {
  const receipts = new Map();
  const lines = report.lines.map((line) => {
    const amountCents = Number.isInteger(line.amount_cents) && line.amount_cents > 0 ? line.amount_cents : null;
    const currency = typeof line.currency === "string" ? line.currency : null;
    const receiptId = typeof line.receipt_id === "string" && line.receipt_id ? line.receipt_id : null;
    if (receiptId && typeof line.receipt_sha256 === "string" && line.receipt_sha256) {
      receipts.set(receiptId, { id: receiptId, filename: receiptId, sha256: line.receipt_sha256 });
    }
    return {
      id: line.id,
      date: line.date,
      merchant: line.merchant,
      category: line.category,
      amountCents,
      currency,
      usdCents: amountCents === null ? null : toUsdCents(amountCents, currency),
      attendees: line.attendees ?? undefined,
      nights: line.nights ?? undefined,
      itemization: Array.isArray(line.itemization)
        ? line.itemization.map((item) => ({ label: item.label, amountCents: item.amount_cents }))
        : undefined,
      description: line.description ?? undefined,
      receiptId,
    };
  });
  return {
    report: { id: report.id, project: report.project, lines },
    receiptById: (receiptId) => receipts.get(receiptId),
  };
}

function authoritativeReport(report, { reportId }) {
  if (!report || typeof report !== "object" || Array.isArray(report) || !Array.isArray(report.lines)) {
    throw new SignError("E_BAD_SIGN_REQUEST", 400, "report must be an object with a lines array");
  }
  const lines = report.lines.map((line, index) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) {
      throw new SignError("E_BAD_SIGN_REQUEST", 400, `report.lines[${index}] must be an object`);
    }
    const currency = typeof line.currency === "string" ? line.currency : null;
    const amountCents = Number.isInteger(line.amount_cents)
      ? line.amount_cents
      : Number.isInteger(line.amountCents) ? line.amountCents : null;
    const usdCents = amountCents === null ? null : toUsdCents(amountCents, currency);
    const provenance = {};
    for (const field of PROVENANCE_FIELDS) {
      const source = line.provenance?.[field];
      provenance[field] = PROVENANCE_SOURCES.has(source) ? source : "unset";
    }
    const itemization = Array.isArray(line.itemization)
      ? line.itemization.map((item) => ({
          amount_cents: Number.isInteger(item?.amount_cents) ? item.amount_cents : item?.amountCents,
          label: item?.label,
        }))
      : null;
    return {
      amount_cents: amountCents,
      attendees: Number.isInteger(line.attendees) ? line.attendees : null,
      category: typeof line.category === "string" ? line.category : null,
      currency,
      date: typeof line.date === "string" ? line.date : null,
      description: typeof line.description === "string" ? line.description : null,
      id: typeof line.id === "string" ? line.id : `line_${index + 1}`,
      itemization,
      merchant: typeof line.merchant === "string" ? line.merchant : null,
      nights: Number.isInteger(line.nights) ? line.nights : null,
      provenance,
      receipt_id: typeof line.receipt_id === "string" ? line.receipt_id : line.receiptId ?? null,
      receipt_sha256: typeof line.receipt_sha256 === "string" ? line.receipt_sha256 : null,
      usd_cents: usdCents,
    };
  });
  return {
    id: reportId,
    lines,
    owner: typeof report.owner === "string" ? report.owner : "",
    project: typeof report.project === "string" ? report.project : "",
    revision: Number.isInteger(report.revision) && report.revision >= 0 ? report.revision : 0,
    status: report.status === "submitted" ? "submitted" : "draft",
    title: typeof report.title === "string" ? report.title : "",
    total_usd_cents: lines.reduce((total, line) => total + (line.usd_cents ?? 0), 0),
  };
}

/** Evaluate the signed verdict with the policy identity this server serves. */
export function evaluateServerVerdict(report, { personaId, personaName, servedPolicy, now }) {
  if (
    !servedPolicy
    || typeof servedPolicy.version !== "string"
    || typeof servedPolicy.digest !== "string"
  ) {
    throw new SignError("E_POLICY_LOCK_FAILED", 503, "the server has no verified policy available for signing");
  }
  const adapted = toPolicyReport(report);
  const persona = ERP_PERSONAS.find((entry) => entry.id === personaId);
  const result = validateReport(
    adapted.report,
    { name: personaName, projects: persona?.projects ?? [] },
    { now: now(), receiptById: adapted.receiptById },
  );
  const violations = result.reportViolations.map((violation) => ({
    code: violation.code,
    field: violation.field,
    line_id: null,
    severity: violation.severity,
  }));
  for (const line of adapted.report.lines) {
    for (const violation of result.lineViolations.get(line.id) ?? []) {
      violations.push({ code: violation.code, field: violation.field, line_id: line.id, severity: violation.severity });
    }
  }
  return { blocking: result.blocking, violations, warning: result.warnings };
}

/**
 * createSignGate(opts) -> { open, get, respond, continueTicket, commit, peekConfirmTokenForDialog }
 *
 * opts.now: () -> Date, injectable clock (default real time) so tests can
 *   advance past expires_at deterministically.
 * opts.ttlMs: sign-request lifetime, default 300_000 (300s, R-43).
 * opts.requireConfirmToken: default true (the SHIPPED, enforced position).
 *   Settable to false ONLY so this node's own tests can honestly reproduce
 *   the pre-confirm_token `known-open` outcome alongside the shipped
 *   `enforced` one — see tests/acceptance/sign-state.test.mjs N-16 and
 *   .team/deviations/DEV-E3-eval-case-known-open.md. Never false in
 *   createHttpServer()'s default wiring.
 * opts.locks: S12's report lock/revision module. Defaults to a fresh
 *   createReportLocks({now}) sharing THIS gate's clock — a caller that
 *   injects its own `now` and wants to observe locks.mjs's expiry from a
 *   test must also inject the same `locks` instance, built with the same
 *   `now`, or the two modules disagree about what "expired" means.
 * opts.getLiveReport: (reportId) -> report | null. The sole source for sign
 *   content at both open and commit. With no reader, open refuses; a missing
 *   report is never replaced by a client body or the signed snapshot.
 * opts.prepareReportCommit: ({reportId, expectedRevision, artifact,
 *   signedBy, submittedAt}) -> publish(). It validates the same aggregate
 *   before chain publication and returns a synchronous no-throw transition.
 *   With no publisher, commit refuses before publishing anything.
 * opts.chain: S7's real hash chain (server/chain.mjs). Defaults to a fresh
 *   createChain({now}) sharing THIS gate's clock. commit() appends to it —
 *   this REPLACES the earlier single-process, in-memory chain_entry
 *   stand-in this module used to build itself; that stand-in is gone, not
 *   duplicated. Exposed on the returned gate as `chain` so a caller (the
 *   real server's GET /api/daybook) can list() it.
 * opts.getServedPolicy: () -> {version, digest} | null. D-118
 *   (x-policyBinding.theFix(a)): the policy this server is ACTUALLY
 *   serving right now. Defaults to routes/policy.mjs's verified
 *   SERVED_POLICY; a client claim is never an input to this option.
 * opts.policyNow: policy clock, separate from the injectable state-machine
 *   clock. Tests that advance expiry across months must not silently move
 *   receipt dates across the filing window at the same time.
 * opts.evaluateVerdict: the server policy adapter above, injectable only for
 *   focused failure-atomicity tests. Production uses evaluateServerVerdict.
 *
 * ORDERING INSIDE commit(), decided at the merge of these two nodes
 * (S7 and D-118, independently branched off the same baseline, both
 * touching commit()): policy identity is checked FIRST (a moved policy is
 * the more fundamental fact — the rules themselves changed, not merely
 * the report), THEN the fresh cleanliness check and S6 report/verdict
 * re-canonicalisation. Only after those pass are provenance, the chain
 * candidate and the complete response prepared; publication is last.
 * tests/acceptance/chain.test.mjs and sign-state.test.mjs assert each
 * refusal leaves the day book unchanged.
 */
export function createSignGate({
  now = () => new Date(),
  ttlMs = DEFAULT_TTL_MS,
  requireConfirmToken = true,
  locks = createReportLocks({ now }),
  getLiveReport = null,
  prepareReportCommit = null,
  chain = createChain({ now }),
  getServedPolicy = () => SERVED_POLICY,
  policyNow = () => new Date(),
  evaluateVerdict = evaluateServerVerdict,
} = {}) {
  const records = new Map(); // request_id -> record
  const byTicket = new Map(); // ticket -> request_id
  const openByReport = new Map(); // report_id -> request_id (bookkeeping only — see NOT THIS NODE)
  let confirmCounter = 0;
  let readReport = typeof getLiveReport === "function" ? getLiveReport : null;
  let prepareCommit = typeof prepareReportCommit === "function" ? prepareReportCommit : null;

  function setReportAuthority({ getLiveReport: reader, prepareReportCommit: prepare } = {}) {
    if (typeof reader === "function") readReport = reader;
    if (typeof prepare === "function") prepareCommit = prepare;
  }

  function hasReportAuthority() {
    return readReport !== null && prepareCommit !== null;
  }

  function liveReport(reportId, personaId) {
    if (!readReport) {
      throw new SignError("E_REPORT_AUTHORITY_UNAVAILABLE", 503, "the server report authority is unavailable");
    }
    const report = readReport(reportId);
    if (!report) throw new SignError("E_REPORT_NOT_FOUND", 404, `no such report: ${reportId}`);
    if (report.owner !== personaId) {
      throw new SignError("E_REPORT_FORBIDDEN", 403, `report ${reportId} is not owned by ${personaId}`);
    }
    if (report.status !== "draft") {
      throw new SignError("E_REPORT_NOT_DRAFT", 409, `report ${reportId} is ${report.status}`);
    }
    return authoritativeReport(report, { reportId });
  }

  function releaseReport(reportId, requestId) {
    if (openByReport.get(reportId) === requestId) openByReport.delete(reportId);
  }

  function settleExpiry(rec) {
    if ((rec.state === "open" || rec.state === "answered") && now().getTime() > new Date(rec.expires_at).getTime()) {
      rec.state = "expired";
      releaseReport(rec.report_id, rec.request_id);
      locks.release(rec.report_id, rec.request_id); // S12: expiry frees the report lock too
    }
    return rec;
  }

  function lookup(requestId) {
    const rec = records.get(requestId);
    if (!rec) return null;
    return settleExpiry(rec);
  }

  function assertSameSession(rec, sessionId) {
    if (rec.session_id !== sessionId) {
      throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "no such sign request for this session");
    }
  }

  /**
   * open({sessionId, personaId, personaName, reportId, worstCase,
   *       violationHistoryCount}) -> { signRequest, ticket }
   *
   * Report content, provenance, receipt metadata and revision come only from
   * the injected server report reader. The caller supplies an id and optional
   * presentation text, never a document to sign.
   */
  function open({
    sessionId,
    personaId,
    personaName,
    reportId,
    worstCase,
    violationHistoryCount,
  }) {
    // Validate BEFORE anything reaches digest() — src/canonical.js correctly
    // refuses to serialize `undefined` (E_CANON_TYPE) rather than silently
    // coercing it, and a malformed body used to leave report undefined here,
    // throw from inside digest(), and escape uncaught: the
    // whole process died on one bad POST /api/sign, taking every in-memory
    // session with it. This boundary check covers the two request values the
    // gate still needs; policy identity and verdict are absent because they
    // no longer come from a request body at all. authoritativeReport() below
    // performs the deeper report-shape projection before digesting.
    const problems = [];
    if (typeof reportId !== "string" || !reportId) problems.push("report_id");
    if (problems.length > 0) {
      throw new SignError("E_BAD_SIGN_REQUEST", 400, `missing field(s): ${problems.join(", ")}`);
    }

    const existingId = openByReport.get(reportId);
    if (existingId) {
      const existing = lookup(existingId);
      if (existing && (existing.state === "open" || existing.state === "answered")) {
        throw new SignError(
          "E_SIGN_ALREADY_OPEN",
          409,
          "a sign request for this report is already open — this is S5's own request-uniqueness bookkeeping, not S12's report-mutation lock",
        );
      }
    }

    // Check an externally supplied lock instance before doing policy work.
    // This preserves the failure-atomic property of a rejected acquire: no
    // request id, digest, token or map entry is produced for a report another
    // holder already owns.
    locks.assertUnlocked(reportId);

    const servedPolicy = getServedPolicy();
    const signedReport = liveReport(reportId, personaId);
    const revision = signedReport.revision;
    const verdict = evaluateVerdict(signedReport, {
      personaId,
      personaName,
      servedPolicy,
      now: policyNow,
    });
    if (verdict.blocking > 0) {
      throw new SignError(
        "E_NOT_CLEAN",
        422,
        `report ${reportId} has ${verdict.blocking} blocking policy violation(s)`,
      );
    }

    const requestId = newRequestId();
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);

    const snapshot = {
      kind: "outpocket.snapshot",
      ocf: 1,
      policy_digest: servedPolicy.digest,
      policy_version: servedPolicy.version,
      request_id: requestId,
      report: signedReport,
      verdict,
    };
    const snapshotDigest = digest(SNAPSHOT_DIGEST_PREFIX, snapshot);
    const confirmToken = newConfirmToken();
    const ticket = newTicket();

    const rec = {
      request_id: requestId,
      report_id: reportId,
      session_id: sessionId,
      persona_id: personaId,
      persona_name: personaName,
      revision,
      policy_version: servedPolicy.version,
      snapshot,
      snapshot_digest: snapshotDigest,
      worst_case: typeof worstCase === "string" && worstCase ? worstCase : "Signing submits this expense report under the current policy.",
      violation_history_count: Number.isInteger(violationHistoryCount) && violationHistoryCount >= 0 ? violationHistoryCount : 0,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      confirm_token: confirmToken,
      ticket,
      state: "open",
      decision: null,
      reason: null,
      signed_by: null,
      method: null,
      at: null,
      acknowledged_digest: null,
      acknowledged_revision: null,
    };

    // S12: every value that can fail canonicalisation or construction is
    // complete before the lock changes. Acquiring immediately before the
    // three Map publications still has no `await` window, while a bad deep
    // field can no longer strand a lock for a request that was never stored.
    // The earlier placement before digest() was rejected after reproducing
    // exactly that orphan-lock failure with an undefined verdict member.
    locks.acquire(reportId, requestId, expiresAt.toISOString());
    records.set(requestId, rec);
    byTicket.set(ticket, requestId);
    openByReport.set(reportId, requestId);

    return { signRequest: stripTicketAndToken(rec), ticket };
  }

  /**
   * peekOpenRequestId(reportId, {sessionId}) -> request_id | null
   *
   * Dialog-discovery convenience: this is how F4 (not this node's output)
   * would learn which sign request to render for a report it already has
   * open — and how this node's own tests recover request_id without routing
   * it through the deliberately narrow tool-result shape. Read-only, scoped
   * to the caller's own session.
   */
  function peekOpenRequestId(reportId, { sessionId }) {
    const requestId = openByReport.get(reportId);
    if (!requestId) return null;
    const rec = lookup(requestId);
    if (!rec || rec.session_id !== sessionId) return null;
    return requestId;
  }

  /** get(requestId, {sessionId}) -> $defs.sign_request, or throws SignError. */
  function get(requestId, { sessionId }) {
    if (!REQUEST_ID_RE.test(requestId)) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "malformed request_id");
    const rec = lookup(requestId);
    if (!rec) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "no such sign request");
    assertSameSession(rec, sessionId);
    return stripTicketAndToken(rec);
  }

  /**
   * peekConfirmTokenForDialog(requestId, {sessionId}) -> confirm_token
   *
   * D-89: THE REAL PRODUCTION CHANNEL, promoted from its earlier test-only
   * status. Mounted at GET /api/sign/{request_id}/confirm-token
   * (server/index.mjs) — a session-scoped endpoint that is NOT, and must
   * never become, a registered WebMCP tool. That is the whole property:
   * the agent cannot read this through the tool surface (nothing in
   * src/page/tools/defs.js wraps it, and R-13's tool-facing functions —
   * open()'s stripTicketAndToken projection, respond()'s toSignResponse —
   * still never include confirm_token, unchanged). Page-authored,
   * non-tool JS calling this with the session cookie is the admissible
   * channel PM's D-89 ruling names; still used directly (no HTTP) by
   * tests/acceptance/sign-state.test.mjs and sign-lock.test.mjs, which
   * predate this route and don't need it.
   */
  function peekConfirmTokenForDialog(requestId, { sessionId }) {
    const rec = lookup(requestId);
    if (!rec) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "no such sign request");
    assertSameSession(rec, sessionId);
    return rec.confirm_token;
  }

  /**
   * respond({requestId, sessionId, decision, reason, method,
   *          acknowledgedDigest, acknowledgedRevision, confirmToken})
   *   -> $defs.sign_response
   *
   * THE ONLY TRANSITION OUT OF `open`. signed_by and at are taken from
   * sessionId/personaName and the server clock — never from the arguments
   * above, because there is nothing here for a client to put them in (R-1).
   */
  function respond({ requestId, sessionId, decision, reason, method, acknowledgedDigest, acknowledgedRevision, confirmToken }) {
    if (!REQUEST_ID_RE.test(requestId)) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "malformed request_id");
    const rec = lookup(requestId);
    if (!rec) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "no such sign request");
    assertSameSession(rec, sessionId);

    if (rec.state === "expired") throw new SignError("E_SIGN_REQUEST_EXPIRED", 410, "sign request expired");
    if (rec.state !== "open") throw new SignError("E_ALREADY_ANSWERED", 409, `sign request is already ${rec.state} — the machine is one-shot`);

    if (requireConfirmToken) {
      if (typeof confirmToken !== "string" || !CONFIRM_TOKEN_RE.test(confirmToken) || confirmToken !== rec.confirm_token) {
        throw new SignError("E_NO_CONFIRM_TOKEN", 403, "missing or wrong confirm_token");
      }
    }
    if (acknowledgedDigest !== rec.snapshot_digest || acknowledgedRevision !== rec.revision) {
      throw new SignError("E_DIGEST_ACK_MISMATCH", 409, "acknowledged digest/revision does not match the issued sign request");
    }

    rec.decision = decision;
    rec.reason = reason ?? null;
    rec.signed_by = rec.persona_name;
    rec.method = method;
    rec.at = now().toISOString();
    rec.acknowledged_digest = acknowledgedDigest;
    rec.acknowledged_revision = acknowledgedRevision;
    rec.state = "answered";

    if (decision === "declined") {
      // Recovery (x-rejectionCodes.E_ALREADY_ANSWERED.severity): the draft
      // stays editable and the human can open a new sign request right away
      // — release happens at the decision, not at a commit that may never
      // come.
      releaseReport(rec.report_id, rec.request_id);
      locks.release(rec.report_id, rec.request_id); // S12: decline frees the report lock
    }

    return toSignResponse(rec);
  }

  /**
   * continueTicket({ticket, sessionId, reportId}) -> {status:'awaiting_signature'} | $defs.sign_response
   *
   * S5's own endpoint, outside the frozen signature.schema.json (which
   * defines the five dialog/commit messages, not the handshake's
   * continuation channel). Read-only: never transitions state. Idempotent
   * and side-effect-free by construction — it only ever reads `rec.state`.
   */
  function continueTicket({ ticket, sessionId, reportId }) {
    if (typeof ticket !== "string" || !TICKET_RE.test(ticket)) {
      throw new SignError("E_NO_CONFIRM_TOKEN", 403, "missing or malformed ticket");
    }
    const requestId = byTicket.get(ticket);
    if (!requestId) throw new SignError("E_NO_CONFIRM_TOKEN", 403, "unknown ticket");
    const rec = lookup(requestId);
    if (!rec) throw new SignError("E_NO_CONFIRM_TOKEN", 403, "unknown ticket");
    if (rec.session_id !== sessionId || rec.report_id !== reportId) {
      throw new SignError("E_NO_CONFIRM_TOKEN", 403, "ticket does not belong to this session/report");
    }
    if (rec.state === "expired" || rec.state === "committed") {
      // "rejected after expiry and after terminal consumption" — both
      // committed and expired are terminal; there is nothing left to
      // continue toward.
      throw new SignError("E_NO_CONFIRM_TOKEN", 403, "sign request is no longer continuable");
    }
    if (rec.state === "open") return { status: "awaiting_signature", ticket };
    // answered — the second tool call's payload IS the server's own record.
    return toSignResponse(rec);
  }

  /**
   * commit({requestId, reportId, sessionId}) -> $defs.commit_result
   *
   * Re-reads live report state, re-evaluates the served policy and prepares
   * every derived result before publishing the chain entry or terminal sign
   * state. There is no cleanup path here by design: an error before publish
   * leaves every mutable component untouched, and the final synchronous
   * publish contains only Map/array assignments that have already had their
   * digest and response inputs computed.
   */
  function commit({ requestId, reportId, sessionId }) {
    if (!REQUEST_ID_RE.test(requestId)) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "malformed request_id");
    const rec = lookup(requestId);
    if (!rec || rec.report_id !== reportId) throw new SignError("E_SIGN_REQUEST_UNKNOWN", 404, "no such sign request for this report");
    assertSameSession(rec, sessionId);

    if (rec.state === "expired") throw new SignError("E_SIGN_REQUEST_EXPIRED", 410, "sign request expired");

    if (rec.state === "answered" && rec.decision === "declined") {
      return {
        schema: "outpocket.commit_result/1",
        status: "rejected",
        http_status: 200,
        confirmation: null,
        committed_revision: null,
        error: { code: "E_DECLINED", message: rec.reason ?? "the employee declined to sign" },
      };
    }

    if (!(rec.state === "answered" && rec.decision === "signed")) {
      throw new SignError("E_NOT_SIGNED", 409, `sign request is ${rec.state}${rec.decision ? `/${rec.decision}` : ""}, not answered+signed`);
    }

    // D-118 (x-policyBinding.theFix(a)): the rules the human was shown must
    // still be the rules in force, checked BEFORE the report-content
    // re-canonicalisation below — if what moved is the policy itself, that
    // is the more fundamental fact and gets its own, more specific code
    // rather than surfacing as an undifferentiated snapshot mismatch.
    // A missing served policy is not a client opt-out. Open bound a verified
    // server identity into the snapshot, so commit either sees a verified
    // identity again or stops before it interprets the report.
    const servedPolicy = getServedPolicy();
    if (
      !servedPolicy
      || typeof servedPolicy.version !== "string"
      || typeof servedPolicy.digest !== "string"
    ) {
      throw new SignError("E_POLICY_LOCK_FAILED", 503, "the server has no verified policy available for commit");
    }
    if (servedPolicy.version !== rec.snapshot.policy_version) {
      throw new SignError(
        "E_POLICY_VERSION_MOVED",
        409,
        `policy version moved between sign and commit: signed under '${rec.snapshot.policy_version}', server now serves '${servedPolicy.version}'`,
        { signed_policy_version: rec.snapshot.policy_version, served_policy_version: servedPolicy.version },
      );
    }
    if (servedPolicy.digest !== rec.snapshot.policy_digest) {
      throw new SignError(
        "E_POLICY_DIGEST_MOVED",
        409,
        `policy content moved under the same version between sign and commit: signed digest ${rec.snapshot.policy_digest}, server now serves ${servedPolicy.digest}`,
        { signed_policy_digest: rec.snapshot.policy_digest, served_policy_digest: servedPolicy.digest },
      );
    }

    const currentReport = liveReport(rec.report_id, rec.persona_id);
    const liveVerdict = evaluateVerdict(currentReport, {
      personaId: rec.persona_id,
      personaName: rec.persona_name,
      servedPolicy,
      now: policyNow,
    });
    if (liveVerdict.blocking > 0) {
      throw new SignError(
        "E_NOT_CLEAN",
        422,
        `report ${rec.report_id} has ${liveVerdict.blocking} blocking policy violation(s)`,
      );
    }

    // S6: report and verdict are rebuilt together before treating anything
    // as committed. GIVEN a single server instance, synchronous with no await
    // between the fetch and the comparison — true by construction.
    const recon = reconcile(rec.snapshot, currentReport, liveVerdict);
    if (!recon.ok) {
      throw new SignError(
        "E_SNAPSHOT_MISMATCH",
        409,
        `report ${rec.report_id} changed between sign and commit: signed ${recon.signedDigest}, recomputed ${recon.recomputedDigest}`,
        { signed_digest: recon.signedDigest, recomputed_digest: recon.recomputedDigest },
      );
    }

    const provenanceSummary = countProvenance(rec.snapshot);
    const nextConfirmCounter = confirmCounter + 1;
    const confirmation = `CH-${String(nextConfirmCounter).padStart(4, "0")}`;
    // S7: append to the REAL day book. `source` is 'human' here because
    // this event is the human's act of signing and submitting — the one
    // field an attacker would move, and the one server/chain.mjs's own
    // digest formula covers along with everything else in the entry.
    const chainEntry = chain.prepare({
      kind: "commit",
      source: "human",
      actor: rec.signed_by,
      label: `signed & submitted ${rec.report_id}`,
      detail: confirmation,
      payload_digest: rec.snapshot_digest,
      recomputed_digest: recon.recomputedDigest ?? rec.snapshot_digest,
    });
    const result = {
      schema: "outpocket.commit_result/1",
      status: "committed",
      http_status: 200,
      confirmation,
      committed_revision: rec.revision,
      chain_entry: chainEntry,
      artifact: {
        policy_version: rec.snapshot.policy_version,
        policy_digest: rec.snapshot.policy_digest,
        snapshot_digest: rec.snapshot_digest,
        chain_head: chainEntry.entry_digest,
        provenance_summary: provenanceSummary,
        violation_history: [],
      },
    };

    if (!prepareCommit) {
      throw new SignError("E_REPORT_AUTHORITY_UNAVAILABLE", 503, "the server report commit authority is unavailable");
    }
    const publishReport = prepareCommit({
      reportId: rec.report_id,
      expectedRevision: rec.revision,
      artifact: result.artifact,
      signedBy: rec.signed_by,
      submittedAt: chainEntry.at,
    });
    if (typeof publishReport !== "function") {
      throw new SignError("E_REPORT_AUTHORITY_UNAVAILABLE", 503, "the server report commit authority did not prepare a transition");
    }

    // Publication begins only after the complete result above exists. None
    // of the code below canonicalises data or builds provenance/response
    // objects, so a construction error cannot leave a committed chain entry
    // paired with an HTTP failure.
    chain.appendPrepared(chainEntry);
    publishReport();
    confirmCounter = nextConfirmCounter;
    rec.state = "committed";
    releaseReport(rec.report_id, rec.request_id);
    locks.release(rec.report_id, rec.request_id); // S12: commit frees the report lock
    return result;
  }

  // `locks` is exposed so every real write route shares THIS gate's lock
  // instance rather than constructing a second one that would never see
  // these acquire/release calls. Revision lives in the report aggregate.
  // `chain` is exposed the same way, for GET /api/daybook (S7).
  return {
    open,
    get,
    respond,
    continueTicket,
    commit,
    peekConfirmTokenForDialog,
    peekOpenRequestId,
    setReportAuthority,
    hasReportAuthority,
    locks,
    chain,
  };
}
