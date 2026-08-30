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
//   - E_SNAPSHOT_MISMATCH: S6 has landed (server/recanon.mjs). commit() below
//     calls reconcile() against opts.getLiveReport(reportId) before treating
//     anything as committed — GIVEN a single server instance (S1), true by
//     construction, same argument as S12's lock. Still not this node's own
//     concern in one sense: the canonicalisation logic itself lives entirely
//     in recanon.mjs, unit-tested there; this module only calls it.
//   - The persisted, verifiable hash chain — that is S7's server/chain.mjs.
//     commit() computes one schema-correct chain_entry (same OCF-1 formula,
//     same digest prefix) so this node's own tests can observe "a chain
//     entry attesting Chen Xiao at a genuine server time", but it is a
//     single-process, in-memory stand-in, not S7's day book.
//   - Per-field provenance ledger — that is S8's. artifact.provenance_summary
//     below is counted honestly from the snapshot's own provenance map
//     (already present on every line), not fabricated.
import { randomBytes } from "node:crypto";
import { canon, digest } from "../src/canonical.js";
import { createReportLocks } from "./locks.mjs";
import { reconcile, SNAPSHOT_DIGEST_PREFIX } from "./recanon.mjs";

export { SNAPSHOT_DIGEST_PREFIX };
export const CHAIN_DIGEST_PREFIX = "outpocket/chain/1";
export const GENESIS_DIGEST = "sha256:" + "0".repeat(64);

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
 * opts.getLiveReport: (reportId) -> report | null. S6's hook into live
 *   report state (S2's store). Defaults to `() => null` — every commit
 *   then behaves exactly as it did before S6 existed (recon.skipped, no
 *   check performed), which is what every synthetic-report_id test in this
 *   repo relies on. The real server (server/index.mjs) wires this to its
 *   own findReport().
 * opts.getServedPolicy: () -> {version, digest} | null. D-118
 *   (x-policyBinding.theFix(a)): the policy this server is ACTUALLY
 *   serving right now. Defaults to `() => null` — SKIPPED, same discipline
 *   as getLiveReport, so every existing test that signs with an arbitrary
 *   policy_version/policy_digest unrelated to any real served document
 *   keeps passing. The real server wires this to routes/policy.mjs's
 *   SERVED_POLICY.
 */
export function createSignGate({
  now = () => new Date(),
  ttlMs = DEFAULT_TTL_MS,
  requireConfirmToken = true,
  locks = createReportLocks({ now }),
  getLiveReport = () => null,
  getServedPolicy = () => null,
} = {}) {
  const records = new Map(); // request_id -> record
  const byTicket = new Map(); // ticket -> request_id
  const openByReport = new Map(); // report_id -> request_id (bookkeeping only — see NOT THIS NODE)
  let chainHead = GENESIS_DIGEST;
  let chainSeq = 0;
  let confirmCounter = 0;

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
   * open({sessionId, personaId, personaName, reportId, revision,
   *       policyVersion, policyDigest, report, verdict, worstCase,
   *       violationHistoryCount}) -> { signRequest, ticket }
   *
   * report and verdict are supplied by the caller in the exact shapes
   * $defs.snapshot.report and $defs.snapshot.verdict describe — this module
   * does not own report storage or policy evaluation (S2/S3's concerns); it
   * owns the sign-request state machine built over them.
   */
  function open({
    sessionId,
    personaId,
    personaName,
    reportId,
    revision: claimedRevision,
    policyVersion,
    policyDigest,
    report,
    verdict,
    worstCase,
    violationHistoryCount,
  }) {
    // Validate BEFORE anything reaches digest() — src/canonical.js correctly
    // refuses to serialize `undefined` (E_CANON_TYPE) rather than silently
    // coercing it, and a malformed body used to leave report/verdict
    // undefined here, throw from inside digest(), and escape uncaught: the
    // whole process died on one bad POST /api/sign, taking every in-memory
    // session with it. This checks EXACTLY the fields that end up inside
    // the digested snapshot ({policy_digest, policy_version, report,
    // verdict} — see below) for the ONE thing canon() cannot serialize.
    // Deliberately not a stricter shape check: `null` is a valid OCF-1
    // value and several real callers (e.g. src/page/sign-install.js's
    // buildOpenBody with no live policy object) legitimately send
    // policy_version/policy_digest as null — narrowing to `undefined` only
    // is what matches canon()'s actual failure mode, no more. See
    // server/index.mjs's top-level handler guard for the general backstop.
    const problems = [];
    if (reportId === undefined) problems.push("report_id");
    if (policyVersion === undefined) problems.push("policy_version");
    if (policyDigest === undefined) problems.push("policy_digest");
    if (report === undefined) problems.push("report");
    if (verdict === undefined) problems.push("verdict");
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

    const requestId = newRequestId();
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + ttlMs);

    // S12: the revision carried in the sign request is the server's own
    // count (locks.getRevision), not whatever the caller happened to send —
    // `claimedRevision` is trusted only the first time this report_id is
    // ever seen (there is nothing yet to disagree with it).
    const revision = locks.getRevision(reportId, claimedRevision);

    // S12: acquire the report lock in the SAME synchronous step as the
    // snapshot below — no `await` sits between this line and the one that
    // builds `snapshot`, so no other request can observe a state where one
    // exists without the other. Throws 423 E_SIGN_IN_PROGRESS if some other
    // holder already has this report_id locked (should not happen given the
    // openByReport check above, since both are released together, but this
    // is the real, load-bearing check — the one above is not).
    locks.acquire(reportId, requestId, expiresAt.toISOString());

    const snapshot = {
      kind: "outpocket.snapshot",
      ocf: 1,
      policy_digest: policyDigest,
      policy_version: policyVersion,
      request_id: requestId,
      report,
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
      policy_version: policyVersion,
      snapshot,
      snapshot_digest: snapshotDigest,
      worst_case: worstCase,
      violation_history_count: violationHistoryCount,
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
   * Trusts its own stored record. Does NOT re-canonicalise or rebuild the
   * snapshot from live state (S6) and does NOT persist to a real day book
   * (S7) — see NOT THIS NODE above. The chain_entry and provenance_summary
   * below are computed honestly from data this record already holds, scoped
   * to this gate instance, not claimed as S6/S7/S8's properties.
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
    // servedPolicy is null when getServedPolicy is unset (default,
    // preserving every existing test's arbitrary policy_version/
    // policy_digest) or when the server's own load-time lock check failed
    // (routes/policy.mjs's SERVED_POLICY) — either way there is nothing to
    // compare against, so this SKIPS rather than refuses: null must never
    // read as "moved", or a server refusing to serve any policy would also
    // refuse every commit for an unrelated reason.
    // null is a valid, legitimate claim here too (src/page/sign-install.js's
    // buildOpenBody sends policy_version/policy_digest as null when no live
    // policy object was available at sign time — same fact S1's own crash
    // fix already had to respect for these exact two fields at open()).
    // null means "no claim was made", not "the policy moved" — comparing it
    // against a real served value and refusing on the mismatch would be
    // exactly the false-positive direction D-108 is pointing at: a
    // legitimate commit from a caller that never claimed a policy identity
    // would be refused for a policy identity it never asserted.
    const servedPolicy = getServedPolicy();
    if (servedPolicy) {
      if (rec.snapshot.policy_version !== null && servedPolicy.version !== rec.snapshot.policy_version) {
        throw new SignError(
          "E_POLICY_VERSION_MOVED",
          409,
          `policy version moved between sign and commit: signed under '${rec.snapshot.policy_version}', server now serves '${servedPolicy.version}'`,
          { signed_policy_version: rec.snapshot.policy_version, served_policy_version: servedPolicy.version },
        );
      }
      if (rec.snapshot.policy_digest !== null && servedPolicy.digest !== rec.snapshot.policy_digest) {
        throw new SignError(
          "E_POLICY_DIGEST_MOVED",
          409,
          `policy content moved under the same version between sign and commit: signed digest ${rec.snapshot.policy_digest}, server now serves ${servedPolicy.digest}`,
          { signed_policy_digest: rec.snapshot.policy_digest, served_policy_digest: servedPolicy.digest },
        );
      }
    }

    // S6: re-canonicalise against LIVE state before treating anything as
    // committed. GIVEN a single server instance, synchronous with no await
    // between the fetch and the comparison — true by construction.
    const recon = reconcile(rec.snapshot, getLiveReport(rec.report_id));
    if (!recon.ok) {
      throw new SignError(
        "E_SNAPSHOT_MISMATCH",
        409,
        `report ${rec.report_id} changed between sign and commit: signed ${recon.signedDigest}, recomputed ${recon.recomputedDigest}`,
        { signed_digest: recon.signedDigest, recomputed_digest: recon.recomputedDigest },
      );
    }

    confirmCounter += 1;
    const confirmation = `CH-${String(confirmCounter).padStart(4, "0")}`;
    chainSeq += 1;
    const entryWithoutDigest = {
      seq: chainSeq,
      at: rec.at,
      kind: "commit",
      source: "human",
      actor: rec.signed_by,
      label: `signed & submitted ${rec.report_id}`,
      detail: confirmation,
      payload_digest: rec.snapshot_digest,
      recomputed_digest: recon.recomputedDigest ?? rec.snapshot_digest,
      prev: chainHead,
    };
    const entryDigest = digest(CHAIN_DIGEST_PREFIX, entryWithoutDigest);
    const chainEntry = { ...entryWithoutDigest, entry_digest: entryDigest };
    chainHead = entryDigest;

    rec.state = "committed";
    releaseReport(rec.report_id, rec.request_id);
    locks.release(rec.report_id, rec.request_id); // S12: commit frees the report lock

    return {
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
        chain_head: entryDigest,
        provenance_summary: countProvenance(rec.snapshot),
        violation_history: [],
      },
    };
  }

  // `locks` is exposed so a real write route (S2/S4, not this node) shares
  // THIS gate's own lock/revision instance rather than accidentally
  // constructing a second one that would never see these acquire/release
  // calls.
  return { open, get, respond, continueTicket, commit, peekConfirmTokenForDialog, peekOpenRequestId, locks };
}
