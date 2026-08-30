# DEPLOY.md addendum — draft, not applied

Draft only, per instruction not to edit `docs/DEPLOY.md` in place. Hand this
to whoever owns that merge; delete this file once folded in.

---

## Cold-start behavior on the free tier (measured 2026-08-30)

The Render free tier sleeps after a period of inactivity and takes a
measurable amount of time to wake on the next request. See
`docs/D1-deploy-observations-2026-08-30.txt` for the method and the raw
numbers; the summary that belongs in this doc:

- First attempt (16-minute idle window, 2026-08-30): 0.41s vs. a 0.15s warm
  baseline — **not a genuine cold start**. A real Render free-tier spin-up
  costs several seconds to tens of seconds, not a quarter of one; this result
  is far more consistent with the instance never having actually slept
  (likely other traffic to the host during the window resetting the idle
  timer — plausible, since multiple seats were actively verifying D1 at the
  time) than with a fast wake. **The wake latency is still unmeasured.**
- Do not treat 0.41s as the answer. Either re-run this measurement during a
  window with no other traffic to the host (hard to arrange with an active
  team), or pull the actual sleep/spin-up event log from the Render
  dashboard for this service — that settles it without depending on
  exclusive access to the URL.

**Why this matters for go-live:** the judging window is 2026-09-04 10:00 →
2026-09-21 17:00 PT, unattended, and the wake-latency question is still open.
If it turns out to be large enough that a judge's first request could
plausibly time out or read as a broken deploy, that is an argument for
upgrading to the paid tier **before** go-live, not a risk to discover during
judging. The $50 hackathon credit on this Render account covers the paid tier
for the whole window (see the original `docs/DEPLOY.md` blocker-1 section) —
the constraint was never cost, only the missing card on file and the missing
decision to spend the credit.

**When the tier is upgraded:** `evidence/D1-url.txt`'s one-instance claim
changes from "true because the tier makes it so" to "true because someone
configured it that way" — that file must be re-verified against the Render
dashboard's actual replica/autoscale setting at that time, not assumed.
