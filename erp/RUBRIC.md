# RUBRIC.md — L2's instrument

**Status: NOT an authority.** There are two: `erp/graph.json` and `erp/PATHS.md`. This
file owns one thing only — **the scale "is it enough to win?"** — and it is the single
instrument of the seat that holds that scale, **L2**. It decides nothing about nodes,
hours, paths or days, and where it appears to, the authorities win.

Produced by node **`L0`** (owner L1, +0.5 h, cut 0, Day 0) — **R-16**. Glob owner PM,
writing seat L1, under `graph.json.conventions.ownership_rule` rule (a) beats (b).
Before R-16 this file was cited by four charters, by `TEAM.md` §4 and by `RISK.md` §8
while being **produced by nothing**, which made every "cite a clause in
`erp/RUBRIC.md`" instruction in the corpus unexecutable. It is on disk before any seat
is dispatched, and **no document may go on calling it missing**.

---

## 0. How this file is used, in one paragraph

L2 issues rulings. **Every ruling cites a clause id from §1–§4 of this file.** A
ruling with no clause is not a ruling, it is an opinion, and L2's charter bans it. If
no clause covers the thing L2 wants to say, L2 **adds the clause first, dated, and
says it added it** — the rubric is allowed to grow, but never retroactively, and never
mid-argument to win one. There are exactly four criteria and they are deliberately
few: a rubric with twelve axes is a rubric nobody applies on Day 5.

---

## 1. §1 LEGIBILITY — is the mechanism visible, on screen, without narration?

**The clause.** The contest rules permit judging from the text description, images and
video alone: *"Judges are not required to test the Project."* (PUBLISHED.) Therefore a
mechanism that cannot be **seen happening** scores as if it does not exist.

**§1.1** The single central mechanism must be legible in the **first 10 seconds** of
`video/outpocket.mp4` to a viewer who reads no text.

**§1.2** Three of the four differentiators — per-request authorisation, server-side
re-canonicalisation, and the hash chain — are **server-side invariants and invisible by
construction**. Each one that survives to the submission must have a named on-screen
proxy (`F5`'s inspector row count, `F3`'s receipt channel, `F1`'s state chips) or be
struck from the claims in §3. **An invariant with no on-screen proxy is not a
differentiator, it is a footnote.**

**§1.3** Any cut that removes the last remaining thing that makes a mechanism visible
on camera is refused, and something else is cut instead. This clause **outranks the cut
ladder**, and `RISK.md` §7.4 states the same rule in the same words.

**Evidence this clause admits:** the actual video file or a shot from
`docs/STORYBOARD.md`; `evidence/rehearsal.json` (`H6`, five unattended runs); a
screenshot. **Not admitted:** a description of what the video will show, a storyboard
beat with no corresponding built page, or "it will be obvious once it is running".

---

## 2. §2 THRESHOLD — completeness is the entry fee, not the edge

**The clause.** A working, complete product is what most entries already have. It buys
admission and nothing above it.

**§2.1** **199 of ~452 real implementations (44%)** already ship a LICENSE and ≥20
source files. Completeness is therefore graded **pass/fail**, never as a strength.

**§2.2** **24 of 420 (5%)** posted a video, and the video is a **disqualification
item** — so §1 is where the marginal point is won, not §2.

**§2.3 — the denominator rule, and it is mechanical.** Those two rows **do not share a
denominator**: 44% is 199 of ~452, and the 420 base belongs to the fully-surveyed set
that yields 24/420. Writing "199 of 420" makes it 47.4%, and a judge can recompute the
inconsistency against our own README. **No clause, ruling, README line, video line or
Devpost answer may quote a census percentage without naming its denominator in the same
sentence.** Quote the *percentage* for the first row and the *fraction* for the second,
exactly as written here. `FACTS.md` §4's census table mixes bases (623 / 529 / 420 /
~452); until it carries a denominator column, **this clause is the citable form** and
the table is not.

**Evidence this clause admits:** a figure from the survey **with its denominator**, and
its grade. **Not admitted:** any keyword-count-derived "nobody else does X" claim that
has not been re-tested at the concept level — including the 1-in-623 consequence-line
result, which is **OUR-ESTIMATE** and means "we found one, we did not look hard", never
"this is rare".

---

## 3. §3 CLAIM DEFENSIBILITY — every sentence survives a hostile expert

**The clause.** A claim that collapses under one question costs more than it earns,
because it discredits the claims either side of it.

**§3.1 — the two claims that survive** (HANDOVER §4), and there are only two:
(a) **we add no new credential holder** — the agent reuses the employee's
already-authenticated session; the honest form names the alternative explicitly, that
*every* other route mints a credential separated from the login state and held or
rotated by an intermediary, with **Truto / Merge / Paragon / Nango** named as
competitors rather than whitespace; and (b) **the site binds what was persisted to what was
on screen, and the binding is auditable.** Anything stronger than these two is struck — and
R-44 struck the previous wording of (b), "*evidence co-presence*", which reads as personhood
and is banned by R-13.

**§3.2 — mechanism, not slogan.** Human-sign gates are publicly claimed by
`webmcpui`. Deterministic policy contracts are preceded by Oracle's `expenseErrors` and
by UCP's error envelope. What is left that is ours is the *specific* mechanism:
**snapshot-digest binding plus server-side re-canonicalisation on write**, and the fact
that the **server owns the response state rather than verifying a client's claim about
it** (R-44: "owns the human decision" is the banned wording — what the server owns is the
record of a POST arriving, never the fact of a decision) (`S5`: state `open → answered(signed|declined) → committed | expired`, `signed_by`
from the session cookie and `at` from the server clock, never from the payload).

**§3.3 — the sign gate's exact sentence, and no other. R-13.** The only provable
sentence is: **"a commit cannot be made without a POST from the authenticated session
to `/api/sign/{id}/respond`."** Every stronger headline is **struck on sight**,
wherever it appears — "a commit cannot be made without a human decision", "Layer 0
answers *did a human decide?*", any `forgeryClosed` flag. A second forgery survives
R-1 and is **open today**: the attacker never renders the dialog, POSTs `/respond`
itself with the page session cookie and the digest the server just issued, then
commits; every code named by `x-rejectionCodes` was walked and none fires. It is inside the plan's
own **N-04** threat model. What R-1 bought is real and must be stated with its cost:
the attacker loses the name and the timestamp, so the record becomes a **true
attribution of a false event** — forensically indistinguishable from a real click. The
`confirm_token` (`S5`) is **defence in depth and not a proof**: it raises cost, it does
not establish personhood. **`V3` measured COOKIE CARRIAGE ONLY (R-44).** The vector stays open for any caller that **also**
obtains read access to the rendered dialog's DOM — and *nothing measured establishes that second
conjunct for this client*: no run rendered a sign dialog, queried a DOM, or lifted a token. This is
**not** a closure; it removes an unsupported assertion about *which* caller has the access.
`V6-consent-gate` gets **no credit** (R-44): a client policy this server cannot observe.
`N-16 neg-respond-without-click` records the outcome honestly in both directions.

**§3.4 — no claim of attesting a *specific agent*. R-21.** WebMCP provides no agent
identity; the specification says the browser agent uses a different internal mechanism.
The attestation is of a **human decision in a session**, never of which agent acted, and
`H3` — our own fallback agent driving the same surface — is the standing proof that we
cannot tell them apart at the tool boundary.

**§3.5 — the write-tool count is COMPUTED, never typed. R-20.** The revoked set is
`annotations.readOnlyHint !== true`, evaluated per state. In `S2-emp-draft-clean` that
is **seven** tools, not five. Any document, schema annotation or narration line that
hard-codes a number is wrong even when the number is right, because it will drift on
the next flip.

**Evidence this clause admits:** MEASURED (we ran it, on a named machine, on a named
date) and PUBLISHED (a published sentence, quoted). **OUR-ESTIMATE is admissible only
with the words "our estimate" attached in the same sentence.** UNVERIFIED is **not**
admissible in a claim at all — it may appear only in `RISK.md` §4's unknowns register
with a named node that will answer it. **Banned outright as evidence:** WindTunnel,
arXiv 2508.09171, any retracted claim in HANDOVER §5, and "tool surface is the
boundary" — it is a menu, not a lock, and the boundary is server-side.

---

## 4. §4 DISCLOSURE — volunteer the weakness before a judge finds it

**The clause.** An expert reviewer finds the flaw either way. Finding it in *our own*
text scores; finding it against us does not.

**§4.1** Every self-disclosure in `RISK.md` §6 goes into the README and the Devpost
answers **in our own words, before a judge raises it** — the client's own confirmation
policy, the untrusted-content rule, and the fact that judges may never run the project.

**§4.2** Every open unknown at submission time is named as open, with what we would do
if it resolves badly. `V1`–`V4` and their contingencies are the standing list.

**§4.3** §3.3's open vector is disclosed **as an open vector**, not as a closed one.
This is the clause most likely to be argued with under deadline pressure, and it is the
one where being argued out of it costs the most.

**Evidence this clause admits:** the disclosure's own text, and the location it will
ship in. **Not admitted:** an intention to disclose later.

---

## 5. What a failing ruling must contain

L2's rulings take exactly one of three values — `ENOUGH`, `NOT ENOUGH`, `ENOUGH IF` —
and are delivered to PM in the message body in the block in L2's charter.

**A `NOT ENOUGH` or `ENOUGH IF` ruling is inadmissible unless it carries all five:**

1. **`CLAUSE`** — a clause id from §1–§4 of this file. Not a section, a clause: `§3.3`,
   not "the claims section". If none fits, add the clause first, dated.
2. **`BECAUSE`** — at most four sentences, concrete, naming the artifact and the line.
   "This feels thin" is not a because; it is the sentence L2's charter tells L2 to stop
   writing mid-word.
3. **`FIX`** — the **smallest** change that would flip the ruling. Not the best change.
4. **`COST`** — in hours, so PM can price it against `capacity` and the cut ladder. A
   fix with no hours cannot be scheduled and will not happen.
5. **The scale check** — the finding is actually on L2's scale. "This test fails" is
   **QA's**; "can it be broken" is **C3's** (`E9`); "can a blind agent use it" is
   **C1's** (`E8`). A cross-scale finding is **routed through PM, never suppressed and
   never absorbed.**

**A standard nobody can meet on the schedule is not a standard, it is an obstruction.**
That is why `FIX` and `COST` are mandatory and why they are checked before the ruling is
acted on.

---

## 6. The one thing this rubric cannot measure, said out loud

`E4` and `E8` sit at **cut rank 2** with `E9`. Firing that rank deletes the blind
grader and the red team, and **four rulers become two**: QA measures done, L2 measures
enough-to-win, and **nobody** measures whether a blind agent can drive the surface or
whether an adversary can break it. `TEAM.md` §2 names those four detectors as the whole
mitigation for twelve seats the human never speaks to. When that rank is fired, §1–§4
keep working and **§3 quietly loses its instrument** — L2 is then asserting claim
defensibility rather than testing it. Saying so before the cut is L2's scale and is
required by `RISK.md` §7.1; noticing it afterwards is worth nothing.
