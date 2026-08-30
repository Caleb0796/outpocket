// server/chain.mjs — the SHA-256 hash chain over the day book.
//
// Node S7. "The source field must be inside the digest, otherwise
// provenance is decoration." S8 built the per-field ledger that records
// who wrote what; this is what makes that record un-forgeable rather than
// merely recorded — an operator who edits an entry's `source` after the
// fact must be DETECTABLE, at the exact entry they touched, not merely
// "somewhere in here."
//
// PM ruled (D-116) that the day book, not the ephemeral sign-request
// record, is THE DURABLE WITNESS for a signature: get_day_book is on the
// auditor surface, the sign endpoint is not, so "prove a human signed
// this" is answered from here. server/sign.mjs's commit() used to build
// its own single-process, in-memory chain_entry as an honest stand-in
// (documented there as exactly that, "not S7's day book") — this module
// is what that stand-in was standing in FOR, and commit() is wired to it
// (see server/sign.mjs's `chain` option) rather than keeping a second,
// parallel implementation.
//
// ONE canonicaliser: every digest here is src/canonical.js's digest(),
// never a second definition — that is the rule S11 exists to make
// possible, and it is why an honestly re-serialised entry (different key
// order, whitespace, a JSON round-trip) verifies identically to the
// original: OCF-1 sorts recursively by codepoint and normalises to NFC
// before anything is hashed, so reformatting is invisible to the digest
// and a real content change is not.
import { digest } from "../src/canonical.js";

export const CHAIN_DIGEST_PREFIX = "outpocket/chain/1";
export const GENESIS_DIGEST = "sha256:" + "0".repeat(64);

/**
 * createChain({now}) -> { append, list, currentHead }
 *
 * opts.now: () -> Date, injectable clock (default real time).
 */
export function createChain({ now = () => new Date() } = {}) {
  const entries = [];
  let head = GENESIS_DIGEST;
  let seq = 0;

  /**
   * append(fields) -> the new entry (fields + seq, at, prev, entry_digest)
   *
   * `fields` is whatever the caller wants recorded (kind, source, actor,
   * label, detail, payload_digest, ... — this module does not fix the set,
   * server/sign.mjs's commit() does). seq/at/prev are added here, in the
   * SAME synchronous statement as the digest computation, so there is no
   * window in which an entry exists without its digest or vice versa.
   */
  function append(fields) {
    seq += 1;
    const entryWithoutDigest = { seq, at: now().toISOString(), ...fields, prev: head };
    const entry_digest = digest(CHAIN_DIGEST_PREFIX, entryWithoutDigest);
    const entry = { ...entryWithoutDigest, entry_digest };
    entries.push(entry);
    head = entry_digest;
    return entry;
  }

  /** list() -> the full day book, in append order. A copy — callers cannot mutate history. */
  function list() {
    return entries.slice();
  }

  function currentHead() {
    return head;
  }

  return { append, list, currentHead };
}

/**
 * verifyChain(entries) -> { ok, brokenAtIndex, reason }
 *
 * Recomputes each entry's digest via the SAME canon()/digest() src/
 * canonical.js exports, and checks two things per entry: (1) its own
 * entry_digest still matches a fresh digest of everything else it
 * carries — so ANY field, not just source, is covered, and (2) its `prev`
 * still names the PREVIOUS entry's entry_digest (or GENESIS_DIGEST for the
 * first) — so an entry cannot be deleted, reordered, or have its
 * predecessor swapped without breaking the link into it.
 *
 * brokenAtIndex is the array index of the FIRST entry that fails either
 * check, or null if every entry verifies — "which entry", not merely
 * "something is wrong somewhere", is what makes this an audit artifact
 * rather than a checksum.
 */
export function verifyChain(entries) {
  let prevDigest = GENESIS_DIGEST;
  for (let i = 0; i < entries.length; i++) {
    const { entry_digest, ...rest } = entries[i];
    const recomputed = digest(CHAIN_DIGEST_PREFIX, rest);
    if (recomputed !== entry_digest) {
      return { ok: false, brokenAtIndex: i, reason: "entry_digest no longer matches a fresh digest of this entry's own fields" };
    }
    if (rest.prev !== prevDigest) {
      return { ok: false, brokenAtIndex: i, reason: "prev does not name the previous entry's entry_digest — the link into this entry is broken" };
    }
    prevDigest = entry_digest;
  }
  return { ok: true, brokenAtIndex: null, reason: null };
}
