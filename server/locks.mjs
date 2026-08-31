// server/locks.mjs — atomic sign lock.
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
// write route that never goes through /api/sign at all). Report write routes
// (S2 authz + S4 envelope) consult this layer first, via
// assertUnlocked(reportId), before touching report content.
//
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
 * createReportLocks({now}) -> { acquire, release, assertUnlocked, isLocked }
 *
 * opts.now: () -> Date, injectable clock (default real time) so tests can
 *   advance past a lock's expiry deterministically — mirrors sign.mjs's own
 *   `now` option, and MUST be the same clock instance a shared signGate uses
 *   or the two modules' notions of "expired" drift apart.
 */
export function createReportLocks({ now = () => new Date() } = {}) {
  const locked = new Map(); // report_id -> { holder, expiresAt: ISO string }

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
   * synchronous step (no await between them) as publishing the snapshot the
   * caller already computed; JS's single-thread execution then leaves no
   * point at which another handler can run between lock and publication.
   * Computing first also means a digest failure cannot leave an orphan lock.
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

  return { acquire, release, assertUnlocked, isLocked };
}

/** newLockToken() — for callers that want an opaque holder id distinct from a request_id. */
export function newLockToken() {
  return "lk_" + randomBytes(8).toString("hex");
}
