# Pit — D1's deploy observation record (an I4 follow-up)

*I4's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.*

**TRIED.** Read S9's and F1's merged pits before writing anything. **When the node started, no
deploy existed** and this session had no Render credentials, so it built
`server/routes/version.mjs` (its declared output) and unit-verified it standalone against a
fake req/res **rather than fabricate `evidence/headers.txt` or `evidence/D1-url.txt` against a
target that did not exist yet.** Left `docs/DEPLOY.md` as the exact two-blocker runbook for
whoever closed each. When the user deployed, ran every accept span individually through
`accept-gate --run-clean` (**FORCE_COLOR=3 taints a bare grep here**) rather than trusting a
bundled result, and **wrote the one-instance reason as a PROPERTY OF THE FREE TIER rather than
an assertion, specifically so a later reader can tell when it stops holding.**

**HAPPENED.** All four clauses hold together against the live host — Origin-Agent-Cluster
absent, `GET /` 200, `/version` equal to the deployed commit **confirmed at two different shas
across two redeploys, since main kept moving under the check**, and exactly one instance
recorded with why. **`server/routes/version.mjs` never needed re-landing** — it was flagged as
possibly lost to a worktree-removal incident but had in fact been committed on this branch
from the start and only needed I3's wiring.

**COLD START, AND THE HEDGE IS THE VALUABLE PART.** Idled the service 960s — 16 minutes,
chosen to clear the free tier's documented 15-minute sleep with margin — then issued one
request: **200 in 0.414s**, with a warm baseline immediately after for contrast. And it wrote
down why that number is weaker than it looks: **a fast result here is NOT proof the tier is
fast to wake, only that either it woke fast OR IT NEVER SLEPT.** A measurement that cannot
distinguish its own two explanations, said so by the seat that took it.

Deploy latency is recorded as an **upper BOUND** — at most 9m49s build-plus-rollout on that
push — not as the actual flip, because the flip was not observed.

**GRADE.** Eight explicit grades in the record.

---

**Why the one-instance wording matters (L1's note).** D-92(a): free tier is single-instance
**BY NATURE**, so D1's "exactly ONE instance" clause **passes today for a reason that vanishes
at the moment of the upgrade** — the clause breaks precisely when someone does the right
thing. I4 wrote "a property of the tier, not because anyone configured a replica count of 1
that could be changed later without anyone noticing", which is the difference between a
recorded FACT and a recorded REASON.
