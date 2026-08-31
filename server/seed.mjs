// server/seed.mjs — deterministic initial state, for boot and reseed.
//
// Node S9. The judging window (2026-09-04 10:00 -> 09-21 17:00 PT) is
// unattended, so a restart must be equivalent to a clean initial state:
// this module reads no wall clock and no RNG, and every field below is a
// literal. PORT: the shape (reports / day book / counters) matches the
// ported spike's seed (src/erp.js), so later write-path nodes extend one
// convention rather than inventing a second.
export function seedState() {
  const receipt = {
    id: "rc_1",
    filename: "jul-visit-cab.pdf",
    size: 48213,
    sha256: "9d1e7a5c0b8f42a6e3d94417c25a80fe6b1c9d0347f8ab52ce61904d7e3b21aa",
    addedBy: "human",
    linkedLineId: "ln_a1",
    duplicateOf: null,
    archived: true,
  };
  return {
    reports: [
      {
        id: "RP-1017",
        title: "July site visit — Heron",
        project: "HERON",
        owner: "chen",
        status: "submitted",
        createdAt: "2026-07-27",
        submittedAt: "2026-07-29",
        signature: { signedBy: "Chen Xiao", at: "2026-07-29" },
        artifact: null,
        lines: [
          {
            id: "ln_a1",
            date: "2026-07-26",
            merchant: "City Cab Co.",
            category: "transport",
            amountCents: 38_50,
            currency: "USD",
            usdCents: 38_50,
            receiptId: receipt.id,
            createdBy: "human",
            lastEditedBy: "human",
            description: "Airport → plant",
          },
          {
            id: "ln_a2",
            date: "2026-07-26",
            merchant: "Heron Cafeteria",
            category: "meals",
            amountCents: 18_20,
            currency: "USD",
            usdCents: 18_20,
            receiptId: null,
            createdBy: "human",
            lastEditedBy: "human",
            attendees: 1,
            description: "Lunch",
          },
        ],
      },
    ],
    receipts: [receipt],
    dayBook: [],
    counters: { report: 1017, line: 0, receipt: 1, confirm: 0 },
  };
}
