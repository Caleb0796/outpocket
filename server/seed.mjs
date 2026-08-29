// server/seed.mjs — deterministic initial state, for boot and reseed.
//
// Node S9. The judging window (2026-09-04 10:00 -> 09-21 17:00 PT) is
// unattended, so a restart must be equivalent to a clean initial state:
// this module reads no wall clock and no RNG, and every field below is a
// literal. PORT: the shape (reports / day book / counters) matches the
// ported spike's seed (src/erp.js), so later write-path nodes extend one
// convention rather than inventing a second.
export function seedState() {
  return {
    reports: [],
    dayBook: [],
    counters: { report: 1017, line: 0, receipt: 0, confirm: 0 },
  };
}
