# Pit — the malformed-`/api/sign` server crash (an S5 follow-up)

*I3's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.
Found by L1 while running the shoot-gate verification against production.*

**TRIED.** **Reproduced L1's exact repro locally FIRST, before writing any fix**, to see the
real crash and stack trace with my own eyes rather than take the report on faith. Fixed **at
the point of use (`open()`) rather than only in the HTTP route**, so any other caller of
`open()` gets the same protection. Grepped every other `digest()`/`canon()` call site in
`server/**` to confirm `open()` was **the only one reachable from unvalidated external
input** — `commit()` and `recanon.mjs`'s `reconcile()` both operate on already-validated,
server-tracked data, and `routes/policy.mjs`'s `canon()` call is over a static module-level
constant, never request input.

**HAPPENED.** Full suite 198/198. FREEZE unaffected. Manually reproduced the crash pre-fix,
confirmed the fix with curl (400, server stays alive, well-formed still works), then let the
automated test carry the proof. **Sabotage of the specific validation alone still passed the
"server stays alive" property via the general guard, while correctly failing the "returns 400"
property — both fixes independently verified.**

**CHANGED.** `server/sign.mjs` (the new validation in `open()`), `server/index.mjs` (the
`routeRequest()`/`handle()` split with a top-level try/catch), `tests/acceptance/sign-state.test.mjs`.

**EARLIER.** **My first draft of the validation was TOO STRICT — `typeof === "string"`,
rejecting `null` — and broke three real, already-passing tests before I ever committed it.**
Caught by running the full suite as a matter of course, not by being asked to. That is the
same lesson S12 and S2 both already cost this project: **verify before trusting a fix green,
especially one written under time pressure with an urgent framing.** The narrowing that
survived checks `undefined` ONLY, because **`null` is a valid OCF-1 value** and
`sign-install.js`'s `buildOpenBody` legitimately sends `policy_version`/`policy_digest` as
null when there is no live policy object — so a stricter check would have been a second defect
wearing the clothes of a fix.

**GRADE.** Green. Fixed both the specific defect and the class L1 asked it to consider, and
verified each independently rather than assuming one implies the other.

---

**L1's own verification, because the general guard is the half that matters.** I disabled ONLY
the specific validation (`if (false && problems.length > 0)`) and re-ran the repro: the
malformed request returned **500 rather than 000**, the `CanonError` was still thrown
internally (twice in the log), and **`GET /api/me` afterwards returned 200 — the server
survived on the top-level guard alone.** My first attempt to disable it silently failed to
apply and returned 400, which would have let me report the general guard as verified when I
had not tested it at all. **A sabotage that does not apply is a green that means nothing** —
the same shape as everything else this sprint, arriving in my own verification.
