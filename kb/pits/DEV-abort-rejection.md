# Pit — the register.js unhandled AbortError (a T2/T6 follow-up)

*I2's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.
Found by QA driving the LIVE site over raw CDP.*

**TRIED.** Fix the uncaught AbortError QA found in `register.js`, which is mine, and **prove
the fix in the environment the bug lives in rather than in the suite.**

**HAPPENED.** Reproduced at 13 against real Chrome, then **probed the API directly** and found
`registerTool` returns a promise that rejects on abort — which turned a plausible story about
in-flight executes into a measured one-line cause. **The count difference between QA's 12 and
my 13 was not noise; it was the evidence that the rejection is per REGISTERED TOOL** (the
deployed build predates T3, whose largest surface is one tool smaller).

**CHANGED.** **My first two reproduction attempts were false negatives and I nearly believed
both.** Playwright's bundled Chromium has no WebMCP, so `document.modelContext` fell back to
the `__simulated` shim and **I measured a code path that is not the one that ships** — while
`registry.why()` still cheerfully reported "registering". Then my first post-fix run reported
0 exceptions and I almost took the win: **the server had died of EADDRINUSE and the page never
loaded, so 0 was the count of exceptions in a page that did not run.**

**EARLIER.** When hunting a bug the existing probes cannot see, **the FIRST thing to verify is
that your new observer is looking at the real thing — before you trust either a positive or a
negative from it.** Both my false results had **the same shape as the bug itself: a green
reading from an instrument pointed at the wrong object.** **A ZERO IS ONLY EVIDENCE IF YOU CAN
SHOW THE THING THAT PRODUCES NON-ZERO WAS RUNNING.** That is why the after-run reports 6 steps,
4 flips and S3 **beside** the 0, and why the test asserts the abort FIRED before it asserts
nothing leaked.

**GRADE.** `registerTool` returning a promise that rejects with AbortError on abort:
**MEASURED**, Chrome 152, one client, direct probe. The 13-to-0 result: **MEASURED**, same
probe, same page outcome both sides. That an agent making back-to-back write calls hits this:
**DERIVED, not measured** — `sync()` is the shared path and the demo is only a fast caller of
it, but no real agent was driven through it. QA's 12 on the deployed site is **QA's reading,
not one I re-ran.**

---

**Two things I2 flagged and did not fix, both correctly out of lane.** `registry.why()` reports
`"registering"` against the SIMULATED shim, because it checks only that `document.modelContext`
exists — **so a page talking to the fallback reports itself as live-registering, and it told I2
the opposite of the truth mid-debug.** Presumably deliberate for the no-WebMCP path;
`fallback-agent.js` is I1's. And `GET /page/skin.css` 404s locally as well as on the live host —
**the shape `--check-orphans` and `--check-modes` both name as the limitation they cannot
reach: a live, loaded, referenced file with a behaviour missing from it.**
