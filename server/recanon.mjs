// server/recanon.mjs — server-side re-canonicalisation, reject on mismatch.
//
// Node S6. GIVEN a single server instance (S1): true by construction, graded
// OUR-ESTIMATE, not a proven property of a horizontally scaled deployment —
// nothing here crosses a process boundary between the live-report fetch and
// the digest comparison, the same argument S12 makes for its own lock.
//
// This is the only part of the sign-gate concept that is actually ours —
// the concept itself is publicly claimed elsewhere (webmcpui; OpenAI's
// client applies its own confirmation policy for consequential actions).
// The mechanism is: digest binding at sign time (S5), an atomic lock across
// the whole open->commit window (S12), and — here — re-deriving the exact
// bytes about to be persisted from LIVE state and refusing to persist
// anything whose digest no longer matches what was signed. `reconcile`
// canonicalises through `src/canonical.js`'s `digest()` — the ONLY
// canonicaliser in this project, the same implementation the client used —
// never a second definition. That is what makes it resistant to the five
// canonicalisation attacks a client could otherwise try: key order,
// whitespace, unicode normalisation, numeric formatting, and duplicate
// keys — none of them change the OCF-1 digest of semantically identical
// content, and OCF-1 has no representation FOR a duplicate key once parsed
// (JSON.parse already collapses it, and canon() sorts recursively by
// codepoint), so none of the five is a way to sign one thing and persist
// another.
import { digest } from "../src/canonical.js";

export const SNAPSHOT_DIGEST_PREFIX = "outpocket/snapshot/1";

export class RecanonMismatchError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "RecanonMismatchError";
    this.code = "E_SNAPSHOT_MISMATCH";
    this.http = 409;
    this.detail = detail;
  }
}

/**
 * reconcile(signedSnapshot, liveReport, liveVerdict) -> {
 *   ok, skipped, recomputedDigest, signedDigest,
 * }
 *
 * signedSnapshot: the exact snapshot object recorded at sign time
 *   (server/sign.mjs's `rec.snapshot` — {kind, ocf, policy_digest,
 *   policy_version, request_id, report, verdict}).
 * liveReport: the CURRENT report for this report_id, fetched fresh from
 *   live server state (S2's store) at commit time. A missing projection is
 *   a mismatch; reconciliation never treats absent live state as success.
 * liveVerdict: the verdict freshly evaluated from `liveReport` with the
 *   policy the server is serving. It travels with the report because both
 *   fields are inside the signed projection; recomputing only one would let
 *   this comparison attest a combination the policy engine never produced.
 *
 * Rebuilds a snapshot identical to `signedSnapshot` except for `report` and
 * `verdict`, then recomputes its OCF-1 digest. Policy evaluation stays in
 * server/sign.mjs, which owns the persona and served-policy context; this
 * module only reconciles the two already-derived projections. Passing the
 * verdict in was chosen over importing policy here so there remains one
 * place that decides whether a report is clean at open and at commit.
 */
export function reconcile(signedSnapshot, liveReport, liveVerdict) {
  const signedDigest = digest(SNAPSHOT_DIGEST_PREFIX, signedSnapshot);
  if (liveReport == null) {
    return { ok: false, skipped: false, recomputedDigest: null, signedDigest };
  }
  const recomputedSnapshot = { ...signedSnapshot, report: liveReport, verdict: liveVerdict };
  const recomputedDigest = digest(SNAPSHOT_DIGEST_PREFIX, recomputedSnapshot);
  return { ok: recomputedDigest === signedDigest, skipped: false, recomputedDigest, signedDigest };
}
