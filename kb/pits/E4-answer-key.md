# Pit — E4's answer key (an L2 follow-up)

*L2's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.*

**TRIED.** Read the export's actual per-state tool lists before writing a single expectation,
rather than reasoning from the storyboard or from `compile.js`'s header comment. **Wrote the
key first, then the checks that would catch a bad one, then made each check fail on purpose.**

**HAPPENED.** Key written, verified, 23/23 on the self-test. **The failure worth recording is
one I caused:** tightening `assertPacketShape` from a COUNT to the two real NAMES immediately
turned my own positive case red, because that case was still writing `f0.txt`/`f1.txt`. **Fixed
the test, not the assertion**, and added a fourth shape case ("two files, WRONG names") that
the old contract would have accepted.

**CHANGED.** `evals/blind/answer-key.json` (new) and `make-blind-packet.mjs`. **Zero product
code.**

**EARLIER.** D-108 says prove the detector still returns the positive on the real corpus. **What
I learned today is WHY THE POSITIVE CASE EARNS ITS PLACE PERMANENTLY RATHER THAN ONCE: IT IS
THE ONLY THING THAT NOTICES WHEN *I* CHANGE THE CONTRACT.** I tightened the packet assertion
from a count to two real names; **every negative case still passed — still rejected, for the
NEW reason instead of the old one — and nothing would have told me the contract had moved.**
The positive case went red in the same run. **A suite of negatives cannot distinguish
"stricter" from "broken", because both look like rejection.**

**GRADE.** All four E4 spans re-run green after the change, including PM's fixed span [1].
Self-test 23/23, `--verify-key` exit 0.

---

## What the key carries beyond the expectations

Each task pre-registers **`mismatchMeans`** — what a MISS would tell us. EVAL.md §8.5 already
bans quietly re-rolling until we like the number; **this bans quietly RE-INTERPRETING, which is
the cheaper and likelier version of the same move.** T4 is deliberately impossible (no
registered tool takes a file-shaped argument), and if C1 picks `link_receipt` **that is the
most important result in the run** — our description would have let a competent agent believe
it could hand over a photo. Recorded in advance so it cannot be explained away later.

Three assertions added because the key now lives beside the packet sources: the packet is
asserted **BY NAME AND BY CONTENT, not by count** — "exactly two files" is satisfied by the
answer key REPLACING one of them, **the one substitution that makes the eval worthless in the
direction that flatters us**, self-tested by planting the key under the export's filename. The
key is verified against the surface it describes, because **a key naming an absent tool would
mark C1 WRONG FOR BEING RIGHT** and the mismatch would then be read as a finding about our
descriptions. And D-108 applied to the key itself: a task accepting every tool in its state is
REJECTED.

---

**ONE CLAIM IN THIS PIT IS WRONG AND I CHECKED IT RATHER THAN RELAYING IT (L1's note).** L2
states that `compile.js`'s header has its clean/dirty labels swapped, and routed it to I2. **It
does not.** Measured:

    compile.js header:  S2 ... DIRTY -> 13 tools ; S3 ... CLEAN -> 14 (submit appears)
    MEMBERSHIP.S2 = 13 tools, submit NO   -> DIRTY.  Header correct.
    MEMBERSHIP.S3 = 14 tools, submit YES  -> CLEAN.  Header correct.

**That header describes the COMPILER'S INTERNAL ids and is right.** L2 compared it against the
EXPORT's ids — where `S2-emp-draft-clean` is 14 — which is **the other namespace**. That is
exactly the D-99 error, made by the seat that received D-99, and PM nearly made the identical
one two rounds earlier by checking the export instead of the compiler. **Not routed to I2.**

There IS a real defect a few lines away, and it is smaller: `tools/export-surface.mjs:21-22`
states the mapping with **pre-T3 counts** — "export S2-emp-draft-clean (13 tools)" where the
export now has 14, and "(12 tools)" where it now has 13. The MAPPING is right; the NUMERALS
are stale. The fair version of L2's point is D-99's: **`compile.js`'s header does not say which
namespace it is in**, and it should.
