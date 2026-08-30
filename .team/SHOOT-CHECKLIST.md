# D4 shoot checklist

L1, 2026-08-30. For the person holding the camera. Items are ordered by when
they bite, not by importance. Every factual claim below was measured this
morning against `main` at `ca63d50` and the deployed origin, except where it
says otherwise — and where I could not establish something, it says that too.

---

## 0. Before anything — the two that cost a whole take if missed

**DECLARE A SHOOT FREEZE. No pushes to `main` once takes begin.**
Render deploys on every push to `main`, a deploy restarts the process, and
**nothing in server memory survives it** — an open sign request, a session, a
day-book entry held in memory. A push mid-take does not spoil the frame; it
spoils the *state the frame is about*, and the take will look fine until you
check the server. Same protocol as D3's idle window: tell L1 when it opens and
when it closes, and L1 pushes nothing in between. **L1 is the only pusher, so
this is one person's discipline, not a race.**

**WALK EVERY ON-CAMERA REGION AND CONFIRM IT HAS CONTENT — IN A BROWSER, NOT A
CHECKER.** PM, D-136. `tools/check-storyboard.mjs` certifies that a selector
*resolves*. It does not certify that the region has anything in it.
**A SELECTOR RESOLVING IS NOT THE FRAME EXISTING**, and we now have two cases
where those came apart. F6 is green and honestly green; it is measuring exactly
what it says.

---

## 1. SB-12 CANNOT BE FILMED AS WRITTEN. Read this before you plan the day.

`SB-12` is beat 3's payload — *"the agent alters the amount after signing"* —
and its anchor is `[data-region="editor"]`.

**MEASURED on the deployed origin this morning:**

```
<section data-region="editor" hidden>
```

**The region is empty, and it will stay empty**, because `server/store.mjs` —
S8's provenance ledger — **is not wired into the HTTP write routes.** S8's own
header names the integration as a follow-up; no node owned it. So F2's editor
panel renders correctly from a shape that **nothing on the page produces.**

This is not a defect in F2 or in S8. Both are green and both are honest. It is
a missing seam, funded this morning as **D-134, an S8 follow-up on I3, ~1.0 h**.

**Your options, and this is a shoot decision rather than an engineering one:**
- **film SB-12 last**, after D-134 lands, or
- **shoot the other twelve and treat SB-12 as a pickup**, or
- **declare SB-12 a cuttable beat** — PM's D-135 explicitly contemplates this.

**Do not discover this at the camera.** That is the entire reason it is item 1.

---

## 2. What the static walk could and could not establish

I ran a walk of all ten `page`-surface selectors against the served HTML. **It is
not a substitute for the browser walk in item 0, and here is exactly why.**

Three regions ship with `hidden` in the served markup:

```
<section data-region="surface" id="surface-inspector" hidden>   SB-03
<section data-region="editor" hidden>                           SB-12
[data-persona] blocks                                    SB-05 / SB-06
```

For `#surface-inspector` and the persona blocks this is **normal** — the markup
is static, present in every session state, and revealed by script after login.
The page's own comment says so. **A static fetch cannot tell "hidden until
login, then populated" apart from "hidden and nothing will ever populate it."**

**So: SB-12 is known empty because of D-134, an independent fact — NOT because
this walk said `hidden`.** The other two are almost certainly fine and I am not
going to claim they are broken on evidence that cannot support it. **Confirm
them in a browser, after logging in, before rolling.**

Selectors present and not hidden in served HTML: `data-tool-row` (SB-01),
`data-policy-version` (SB-02), `data-receipt-channel` (SB-09), `data-worst-case`
(SB-10), `data-signature-line` (SB-11), `#env-banner` (SB-13).

`SB-04`, `SB-07` are `agent-client` surface and `SB-08` is `terminal` — nothing
on our page to walk.

---

## 3. The signature beat — SB-10 / SB-11

**CAPTURE THE `POST /api/respond` RESPONSE ON THE TAKE.** Page text is not
evidence; **server reads are.** The frame showing a signature line is a frame of
our own DOM, and our own DOM is the thing under test. What proves the beat is
the server's answer carrying its own attribution and timestamp.

Two acceptable capture forms — **pick one before rolling, not during**:
- **DevTools Network panel open on the take**, response visible; or
- **one warm-up take with capture**, then a clean take for the cut, with the
  warm-up kept as the evidence artifact.

**The second is safer for the edit and weaker as evidence**, because the
captured response is then not from the take in the cut. If you use it, say so
wherever the take is cited — the same discipline as D3 standing "with its build
named".

**PACE IT: the sign window is 300 seconds from `open`.** `DEFAULT_TTL_MS =
300_000` in `server/sign.mjs`, R-43 — *the human's budget, not a client-timeout
guess*. Click promptly. If it expires, the dialog now says so in words rather
than failing silently.

**The dialog can no longer render nothing.** UX landed the fix last night: a
thrown fetch — which is what a dead server produces — used to leave the dialog
completely blank. It now renders a sentence and a retry control, and a server
refusal renders **the server's own message and code**.

---

## 4. Session and seed

- Log in as **`chen`** via `POST /api/login` — **not** `/api/session`, which
  does not exist. Two self-inflicted 400s came from that spelling.
- The decision value on respond is **`"signed"`**, not `"approve"`. The frozen
  `signature.schema.json` is the authority.
- `?demo=1` for the seeded flow.
- `SB-06` needs the **`ruiz`** auditor session — a genuinely different session,
  not a toggle. The auditor registers **no write tool at all**, which is the
  point of the shot.

---

## 5. If any evaluation number appears on camera or in copy

**D-121 binds, and all three items travel together. Any one missing makes the
figure inadmissible or misleading:**

1. **the disclosure** — the blind packet was **not identifier-free**, and
   blindness rested on an **after-the-fact transcript check**, not prevention;
2. **the ceiling** — never a bare "5 of 8" and never a bare "gate: FAILED". The
   admissible form is **"gate not passed: 5 of a possible 6, the other two tasks
   being deliberately unfulfillable by design"**;
3. **T3's sentence** — the one genuine shortfall, and it belongs in the *same
   paragraph* as the score rather than buried under it.

**The cheapest compliant option is not to cite the total at all.**

**And a fourth, added by L2 after the run:** *"the run executed at reasoning
effort low"* is **OUR-ESTIMATE**, not MEASURED, and must carry those words — no
transcript event names a model or an effort, so the evidence is a sibling run.
**Do not cite `reasoning_output_tokens` as proof of the setting. It is
consumption, not configuration.**

---

## 6. T3 belongs in the narration, not the errata

L2's framing, and it is better than treating it as a defect line:

> **T3 is not only a defect. It is the honest cost of the thing we are
> advocating.** We keep flow control out of descriptions because the
> registration state machine *is* the workflow — and T3 is a blind agent hitting
> the price of that choice. **It knew which tool to call**, and could not resolve
> "last Tuesday" or invent a merchant, because nothing in the surface tells it
> and **we deliberately did not put it in the prose.**

A judge reaches that objection unaided in thirty seconds. **Finding it in our own
text scores; having it found against us does not.** And an instrument that found
nothing would be worthless — T3 is the strongest evidence the blind run was a
real test rather than a lap of honour.

---

## 7. D-135 — why SB-12's fragility is structural, and what NOT to do about it

There is **no `F2 → D4` edge in the graph, and its absence is a report rather
than an oversight.** F2 is cut 3, D4 is cut 0; `key(F2)=3`, `key(D4)=Infinity`.
A hard edge would fail `key(u) >= key(v)` and **`--check-cuts` would reject it.**

So the graph is reporting a **scope mismatch**: an on-camera beat's payload
depends on **rank-3 work — the last rank the ladder deletes — while the video
that shoots it is cut 0.**

**It is not live.** D-17 ruled nothing is cut at 3.0 h/day, so rank 3 never
fires. It is recorded because if it ever did, **SB-12 would silently lose its
content and D4 would shoot an empty region, with no instrument to warn us —
there being no edge to check.**

**If it ever becomes live: promote F2 and S8, or declare SB-12 a cuttable beat.
NEVER draw an edge the invariant forbids.** Making `--check-cuts` lie to record a
dependency is worse than the dependency.

---

## 8. After the shoot

- **Lift the freeze explicitly**, the same way it was declared.
- `video/outpocket.mp4` — under **180 s**, with **at least one audio stream**.
  `ffprobe` is what grades it, not judgement.
- `evidence/D4-video-url.txt` — the public URL must return **200 from a
  logged-out fetch**. Check it logged out, in a private window.
- The script clause is **already green**: `docs/VIDEO-SCRIPT.md`'s first cue is
  `IN 00:00` and carries `document.modelContext`, a literal token from
  `kb/webmcp/MECHANISMS.txt`. Verified. **Nothing to do here.**
- **`D4` unblocks `D5`, which unblocks `D6`.** It is the head of everything
  that remains.

---

## What is NOT in this list, deliberately

**G1 stays unbooted.** It publishes both repositories, and the user's standing
order is that it does not run today. Nothing in the shoot needs it.
