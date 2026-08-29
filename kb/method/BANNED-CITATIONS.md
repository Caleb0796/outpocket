# Banned citations

**Owner: K2. Produced by node L0 (Day 0). Reviewed by L1.** (`erp/PATHS.md`)

L0 puts this file into git so that K2 has a home to author into and so that
`tools/lint-layer0.mjs` (node **G4**) has a file to exclude — this file quotes banned strings
in order to ban them, and G4's scan therefore skips it, alongside `erp/**`,
`kb/webmcp/BANNED.txt` and `.team/lint/banned.txt`.

**The content authority is `erp/FACTS.md` §8, *Citations that are poison*.** The table below
is reproduced from it so that no writer has to go looking; if the two ever disagree, §8 wins
and this file is regenerated. `erp/RISK.md` BW-15 … BW-19 lint the literal strings.

---

## Never cite any of these

Grade: MEASURED — each one was checked.

| Poison source | Why it kills you |
|---|---|
| **WindTunnel** | Its WebMCP arm injects a home-built bridge through Playwright — it **never goes through Chrome's WebMCP**. The publisher, nekuda, also sells a WebMCP integration plugin, so it is an interested party. Citing it says we did not read past the abstract. |
| **arXiv 2508.09171** | Same name, different thing — an independent client-side scheme by D. Perera. Citing it is an on-the-spot puncture. |
| **TDS, "Prompt Engineering Fails Quietly"** | A deterministic mock simulator. **Not one model call happened.** Any number quoted from it is fiction dressed as measurement. |
| **"Adding semantically similar tools costs 8–19%"** | Wrong column read. The real drop is **1–8%, median ~3%**, and the paper itself flags that column as an evaluation artefact. Do not cite a number here at all. |
| The vendor-internal Oracle Fusion Expense agentic prompt the user supplied | Publishability unconfirmed. Never quote it verbatim, never attribute it, and do not use it as a benchmark arm without explicit clearance from the user. |

## Laundering a result is the same offence as citing the source

The belief travels even when the name is removed. A judge who asks *"which published data?"*
gets either a poison citation or no answer. **The correct move is to state that we make no
accuracy claim and cite no external accuracy data, and to give our own arithmetic reason for
excluding it.**

## G-RULE-2 — the meta-lesson that generated the list

**An "empty cell" found by keyword search is a vocabulary artefact, not a conceptual gap.**
Every time a strict regex returned 0/623, a concept-level re-test found occupants. **Any claim
of novelty based on keyword counting must be re-tested at the concept level before it may be
written down.** `erp/RISK.md:262-265` makes this binding, with a recorded-search-terms
requirement. The 0/420 per-field-provenance figure and the 1-in-623 figure are both this shape.

---

*Seeded by L0 on Day 0 from `erp/FACTS.md` §8. K2 owns what follows and may extend it; do not
delete a row without a citation, and keep every banned string literally scannable.*
