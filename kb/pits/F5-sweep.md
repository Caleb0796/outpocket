# Pit — F5's presence-check sweep (a UX follow-up)

*UX's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.*

**TRIED.** **Ran the sweep as a CLASSIFICATION rather than a grep:** every presence check, then
for each one — does it conclude about the SURFACE or about the ENVIRONMENT, and would our own
shim fool it.

**HAPPENED.** Three instances in the class out of ~17 checks. **One was mine** and is fixed
here; the majority were correct **and I can say why.** The fix broke no test, **which is how I
discovered the demo's own configuration was untested.**

**CHANGED.** `src/page/ui/inspector.js` and its test, both F5 outputs. **Nothing in
`register.js`** — that instance is I1's and is reported, not touched.

**EARLIER.** Its own instance **looked correct**: the panel reported `document.modelContext`
and it genuinely WAS `document.modelContext` — our shim. **It only reads as a defect once you
ask what the sentence CLAIMS TO A READER rather than what it asserts to a compiler.** Same test
as the off-page shots, where a selector that RESOLVES is not a selector that IDENTIFIES.

And the generalisation, which belongs beside D-114: **THE TESTED CONFIGURATION AND THE SHIPPED
CONFIGURATION DIVERGE WHEREVER A TEST HAD TO CHOOSE SOMETHING — a flag, an injected default, a
fixture — AND THE CHOICE IS INVISIBLE FROM INSIDE THE TEST.** Its three F5 tests were right and
green and **could not reach the branch the demo runs in**, because they launch with
`--enable-features=WebMCP` and the demo does not.

**GRADE.** Three instances found, the cleared cases documented with their reasons.

---

**The cleared cases are worth as much as the findings, and UX measured them.**
`probe/index.html` and `harness/fixtures/v3/index.html` do not load `fallback-agent.js` at all,
**so H2's reachability gate and the V0/V3 probes CANNOT be fooled by our shim** — their
presence checks are correct precisely because there is no shim on those pages. UX checked that
rather than assuming it, because a false positive there would have sent I1 chasing the gate
that establishes whether the browser has WebMCP at all. Reporting "seventeen possible
instances" **would have cost four seats an afternoon each to re-derive what one pass settled.**
