// server/locks.mjs — report revision counter and atomic sign lock.
//
// Node S12 (renumbered from a collision with the real S10 — see
// erp/graph.json.nodes[S12].notes). Contract: this is the mechanism S6 relies
// on for TOCTOU closure and the one CONTRACTS.md section 11 check 9 names:
// "a mutating endpoint called while a sign request is open does not return
// 423" is the failure this module exists to make impossible.
//
// x-freeze layer 2. NOT S5's own `openByReport` bookkeeping (server/sign.mjs
// keeps that separately, documented there as "NOT layer 2" — it only stops a
// second sign request opening for the same report; it says nothing about a
// write route that never goes through /api/sign at all). This is the layer a
// real write route (S2 authz + S4 envelope, downstream, per kb/pits/S4.md
// "no HTTP write routes exist yet") is required to consult as its first
// line, via assertUnlocked(reportId), before touching report content.
//
// Report content mutation and the sign-request state machine share one
// report_id namespace, so revision-ownership lives here too: getRevision()
// is the server's own count, seeded (not trusted) from whatever value a
// caller first supplies for a report_id it has never seen, then owned
// server-side from there on — bumpRevision() is what an accepted mutation
// calls, never a client-supplied number written straight through.
import { randomBytes } from "node:crypto";

export const LOCK_CODE = "E_SIGN_IN_PROGRESS";
export const LOCK_HTTP = 423;

export class LockError extends Error {
  constructor(code, http, message) {
    super(message || code);
    this.name = "LockError";
    this.code = code;
    this.http = http;
  }
}

/**
 * createReportLocks({now}) -> {
 *   acquire, release, assertUnlocked, isLocked, getRevision, bumpRevision,
 * }
 *
 * opts.now: () -> Date, injectable clock (default real time) so tests can
 *   advance past a lock's expiry deterministically — mirrors sign.mjs's own
 *   `now` option, and MUST be the same clock instance a shared signGate uses
 *   or the two modules' notions of "expired" drift apart.
 */
export function createReportLocks({ now = () => new Date() } = {}) {
  const locked = new Map(); // report_id -> { holder, expiresAt: ISO string }
  const revisions = new Map(); // report_id -> integer, server-owned from first sight

  function currentEntry(reportId) {
    const entry = locked.get(reportId);
    if (!entry) return null;
    if (new Date(entry.expiresAt).getTime() <= now().getTime()) {
      // Lazily reap an expired lock — R-44: "advancing the clock past
      // expires_at releases the lock and permits a new sign request."
      locked.delete(reportId);
      return null;
    }
    return entry;
  }

  /**
   * acquire(reportId, holder, expiresAt) — MUST be called in the same
   * synchronous step (no await between them) as whatever snapshot
   * computation the caller is protecting; JS's single-thread execution then
   * makes "no window between them" true by construction, not merely
   * asserted — there is no point at which another handler's code can run
   * between the two statements in the caller's function body.
   *
   * Throws LockError if a DIFFERENT, still-live holder already has the
   * report locked. Re-acquiring with the same holder (e.g. a retried open())
   * is a no-op refresh, not a conflict.
   */
  function acquire(reportId, holder, expiresAt) {
    const entry = currentEntry(reportId);
    if (entry && entry.holder !== holder) {
      throw new LockError(LOCK_CODE, LOCK_HTTP, `report ${reportId} has an open sign request in progress`);
    }
    locked.set(reportId, { holder, expiresAt });
  }

  /** release(reportId, holder) — only clears the lock if `holder` still owns it. */
  function release(reportId, holder) {
    const entry = locked.get(reportId);
    if (entry && entry.holder === holder) locked.delete(reportId);
  }

  /**
   * assertUnlocked(reportId) — the call every mutating report route makes
   * before touching state. Throws LockError(E_SIGN_IN_PROGRESS, 423) while a
   * live lock is held; otherwise returns undefined.
   */
  function assertUnlocked(reportId) {
    if (currentEntry(reportId)) {
      throw new LockError(LOCK_CODE, LOCK_HTTP, `report ${reportId} has an open sign request in progress`);
    }
  }

  /** isLocked(reportId) -> boolean, read-only, no throw. */
  function isLocked(reportId) {
    return currentEntry(reportId) !== null;
  }

  /**
   * getRevision(reportId, fallback) -> integer
   * First call for a report_id seeds the server's counter from `fallback`
   * (the caller's own claim, trusted only because nothing has been recorded
   * yet); every call after that ignores `fallback` and returns the value
   * this module has tracked since — a client cannot roll it back or skip it
   * ahead by resending an old or invented number.
   */
  function getRevision(reportId, fallback = 0) {
    if (revisions.has(reportId)) return revisions.get(reportId);
    revisions.set(reportId, fallback);
    return fallback;
  }

  /** bumpRevision(reportId) -> integer — the new revision, one accepted mutation later. */
  function bumpRevision(reportId) {
    const next = (revisions.get(reportId) ?? 0) + 1;
    revisions.set(reportId, next);
    return next;
  }

  return { acquire, release, assertUnlocked, isLocked, getRevision, bumpRevision };
}

/** newLockToken() — for callers (tests, future write routes) that want an opaque holder id distinct from a request_id. */
export function newLockToken() {
  return "lk_" + randomBytes(8).toString("hex");
}
