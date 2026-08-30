# Pit — the discarded-promise class sweep (an I2 follow-up)

*I2's five fields, delivered in its COMMIT under clause 6e. L1 transcribed, did not compose.
The commit is deliberately EMPTY of code — everything it found is in other seats' files.*

**TRIED.** Classify every sibling of the AbortError bug **rather than report suspicion**, and
back a negative result the way its own EARLIER demands.

**HAPPENED. ONE instance, already fixed, and the reason is STRUCTURAL rather than lucky.**
`new AbortController()` appears **exactly once** in `src/` and `server/` — `register.js:258` —
and `.abort()` exactly once, `register.js:256`. The only other controller anywhere is
`harness/drive.mjs`, a dev harness. **So property (3) of the class — "can reject on a path we
take deliberately" — has exactly ONE generator in product code, and it is the one already
fixed.** That is why the answer is one instance rather than a handful: **not "I looked and
found nothing", but "there is only one place that deliberately aborts anything."**

**DETECTOR VALIDATED BEFORE IT WAS TRUSTED.** Run against the PRE-FIX `register.js` it flags the
known bug at line 224. **A "no further instances" conclusion from an unvalidated detector would
have been worth nothing.** 79 files swept; 71 discarded-call candidates, plus a separate pass
for async callbacks handed to non-awaiting sinks.

**CHANGED.** Nothing — the commit carries the classification and this pit. **Two false zeros
caught on the way:** the first sink pass reported zero because the regex only matched `async` on
the same line as `addEventListener`, and a multi-line check confirmed the zero — **but the
first zero was not evidence.** And the first sibling-clearance run reported
`inspectorMounted false` with 0 exceptions **because the selectors had been guessed** — a
candidate cleared on a run that may never have exercised it.

**EARLIER — and it is the sharpest thing in the sweep. IN A CLASSIFICATION THE DANGEROUS CELL
IS NOT THE INSTANCE, IT IS THE CLEARED ONE.** An instance gets fixed and re-tested; **a wrong
clearance is never looked at again and costs a seat an afternoon to re-derive.** So every
clearance names WHICH of the three properties fails, and the one clearance resting on a run
rather than a reading **also states what the run proved was RUNNING** — mounted, painted, four
flips, real API. **A zero is only evidence if you can show the thing that produces non-zero was
there, and that applies to clearing a suspect exactly as much as to confirming a bug.**

**GRADE.** One instance, structurally bounded; suite 200/200 on the branch.

## The cleared cells, each naming which property fails

- **`inspector.js` (UX, F5)** — the strongest candidate and it earned the work. `paint()` is
  async, discarded, runs on EVERY flip, has no catch, and awaits `mc.getTools()` unguarded:
  **the bug's exact shape.** CLEARED BY RUNNING IT — real Chrome 152, inspector mounted AND
  painted into `[data-region="surface"]`, 4 real generation swaps, 0 exceptions. **Limit
  stated: clears this build and these flips, not proof `getTools()` can never reject.**
- **`shell.js`** — login/refreshSession discarded, but both guard their fetch; property (3)
  fails. **Residual:** `res.json()` at `:107` sits OUTSIDE the try.
- **`receipts.js`** — detector false positive; that paint is synchronous.
- **`fallback-agent.js`** — detector false positive (method definitions), **but reading them
  produced a real finding** (below).
- Every `executeTool` caller awaits; `demo-mode` wraps each step. `compile.js`'s `runTool`
  DOES rethrow AbortError deliberately, but nothing discards it.
- **`server/`, `harness/`, `tools/`** — no controller, no generation swap, and node crashes
  loudly on an unhandled rejection, **so the class is not silent there anyway.**

## Two findings routed, both verified by L1

**`sign-dialog.js:183/186` (UX) — NOT the class, but the highest-CONSEQUENCE thing in the
sweep.** `submitDecision` is discarded from the human's Sign and Decline click handlers, and
its `await fetchImpl(...)` is NOT wrapped — only `res.json()` has a `.catch`. Property (3)
fails because transport failure is not deliberate. **But the failure mode is: the human clicks
Sign, the request fails, and NOTHING VISIBLY HAPPENS** — the only trace an unhandled rejection
nobody is watching. Verified in the source.

**`fallback-agent.js:129` (I1) — the shim returns `Promise.resolve(undefined)` and deletes from
its Map on abort. IT NEVER REJECTS.** Two consequences: the fallback path never had this bug,
**and the shim CANNOT REPRODUCE IT** — which is why I2's Playwright attempt came back clean and
nearly convinced it there was nothing there. **It diverges from the real contract on exactly
the path that produced the production bug, making it a false-negative generator for this whole
class.** I2 measured that the real `registerTool` REJECTS with AbortError when the signal
aborts; the shim resolves.
