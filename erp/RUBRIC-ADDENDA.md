# RUBRIC-ADDENDA.md — clauses L2 added after the freeze, in the open

**Status: NOT an authority**, exactly as `erp/RUBRIC.md` is not. There are two:
`erp/graph.json` and `erp/PATHS.md`. This file holds clauses **added by L2 after
the rubric was written**, under `RUBRIC.md` §0's standing permission: *"If no
clause covers the thing L2 wants to say, L2 adds the clause first, dated, and
says it added it — the rubric is allowed to grow, but never retroactively, and
never mid-argument to win one."*

Owned and committed by **L2** — D-103, PM, 2026-08-29. `erp/RUBRIC.md` §1–§4 are
an `L0` output under R-16 and `check-ownership --seat L2` **denies** that path.
That denial is the design and not an obstacle: **it makes the add-only constraint
mechanical rather than honour-system.** L2 cannot reword an existing clause to
make a verdict come out right, because L2 does not own the file the existing
clauses live in — and L2 never needs another seat's hand to add a criterion.
A clause added here can only ever **raise** the bar; nothing here can lower one.

## How a clause in this file is cited, and how it may be used

- Cite a clause here by **its own id** — `§1.4` — never as `RUBRIC.md §1.4`.
  `RUBRIC.md` §1–§4 are cited as before.
- Every clause is **dated** and says who added it and what class of ruling it was
  written for.
- **A clause here may never be applied to a ruling issued before its date.**
  Declaring a criterion in advance and then applying it is honest; reaching back
  with one is precisely what "never mid-argument" exists to stop. Each clause
  below therefore states, in its own text, which rulings it did **not** decide.
- **Clauses appear in the order they were ADDED, not in numeric order**, and that
  is deliberate: this file is a log of a standard growing, and the sequence is
  evidence that each clause preceded the ruling it was written for. Sorting them
  numerically would tidy away the one property the file exists to demonstrate.
  The index below is for finding them.

## Index

| clause | added | extends | in one line |
|---|---|---|---|
| `§1.4` | 2026-08-29 | `RUBRIC.md` §1 | an off-page shot must not be satisfiable by a generic failure |
| `§3.6` | 2026-08-29 | `RUBRIC.md` §3 | an instrument's result carries the grade of its weakest ARMED control |
| `§2.4` | 2026-08-29 | `RUBRIC.md` §2.3 | a figure from our own instrument carries its achievable maximum |

## What §3.6 and §2.4 have in common, since it was asked

They are **not two halves of one rule and should not be merged into one.** They
extend different parents and they are not the same shape: `§3.6` governs any
instrument result, numeric or not, and asks *did the check that grades this
actually run?*; `§2.4` governs figures only, and needs a bounded scale to have a
maximum at all. Either can apply without the other.

**But they are the first two of one family, and naming it is worth more than
merging them.** `RUBRIC.md` §1–§4 grade evidence that arrives from *outside* —
a published sentence, a census row, a measurement of somebody else's browser.
`§3.6` and `§2.4` grade a second class the rubric did not anticipate: **numbers
this project generates about itself**, for the purpose of putting them in its own
submission. Self-generated evidence carries obligations borrowed evidence does
not, because we control both the instrument and the reporting of it, and the
failure modes are ours to introduce. `§3.6` covers the instrument; `§2.4` covers
the scale. **A third clause in this family should be expected rather than
resisted**, and it belongs here rather than in `RUBRIC.md` §1–§4 for the same
mechanical reason everything else here does.

---

## §1.4 — an off-page shot must not be satisfiable by a generic failure

**Added 2026-08-29 by L2.** Extends `RUBRIC.md` §1 LEGIBILITY. Written for the
class of ruling D-94 created: a demo shot filmed on a surface that is not our
page.

**What this clause did not decide, stated first.** The D-94 beats ruling of
2026-08-29 — `SB-04`, `SB-08` and `SB-12`, all `ENOUGH IF` — was decided on
`RUBRIC.md` **§1.2 alone** and was issued **before this clause existed**. Nothing
in it rests on §1.4, and §1.4 must not be cited in support of it afterwards. This
clause applies from its date forward: the end-state review before `D6`, and any
re-cut of `docs/STORYBOARD.md` or `docs/VIDEO-SCRIPT.md`.

**Why it is needed.** D-94 created the off-page shot on 2026-08-29 — surfaces
`page`, `agent-client` and `terminal` — and `RUBRIC.md` §1.1–§1.3 predate that
category by the whole sprint. §1.2 requires a surviving invariant to have a
**named** on-screen proxy, and stops there. It does not require that proxy to be
**informative**. So a bare `403` filmed in a terminal satisfies §1.2 while proving
nothing, and §1.2 fails open in exactly the shape this project has paid for more
than any other — here pointed at a camera rather than at an exit code.

**The clause.** A shot filmed on a surface that is not our page is admissible, and
for some mechanisms it is the **only honest surface**: a shot whose entire content
is "this went around the page" cannot be anchored to an element on the page. But
our page is self-identifying and a terminal is not, so an off-page shot must
carry, **in one still frame**, both of:

- **(a) the named artifact.** The specific thing on that surface that displays the
  mechanism — a command, a status code, a named error code, an envelope field —
  and not merely the surface's name. Declaring `SURFACE: terminal` names a
  surface; it does not name a proxy.
- **(b) a frame not satisfiable by a generic failure.** A bare `403`, a bare
  "I can't do that", a bare stack trace: each is indistinguishable from a broken
  server or a confused agent, and satisfies the shot **for the wrong reason**.
  This is D-90 — *a control satisfiable by the subject being absent is not a
  control* — applied to a camera. The usual discharge is a **positive control in
  the same frame**: same route, same body, exactly one thing different.

A shot that fails (b) is moved on-page or struck. **It is never left to
narration**, because §1.1's whole premise is a judge who reads no text and may
never run the project.

**Evidence this clause admits:** a still frame, or the runnable artifact a still
is lifted from — `tests/acceptance/curl-403.sh` is the worked example, and it
already prints the auditor's `403 E_ROLE_FORBIDDEN` adjacent to an employee
positive control on the same route and body, by its own design. **Not admitted:**
an intention to frame it that way in the take.

---

## §3.6 — an instrument's result carries the grade of its weakest ARMED control

**Added 2026-08-29 by L2**, before the ruling it was written for (E8's
admissibility) and applied to no ruling issued before its date. Extends
`RUBRIC.md` §3's evidence rule, which grades **claims** but is silent on how to
grade the output of an **instrument this project built in order to produce
claims**.

**Why it is needed.** §3's evidence rule sorts a claim into MEASURED, PUBLISHED,
OUR-ESTIMATE or UNVERIFIED by asking where the claim came from. It does not ask
whether the instrument that produced it was working. An instrument whose own
acceptance predicate names a control that cannot run will report satisfaction
anyway — because a control with no artifact to inspect returns nothing to object
to. That is the shape this project has paid for more than any other, and §3 as
written admits its output at MEASURED.

**The clause.** A result produced by one of this project's own instruments may be
quoted at **MEASURED** only if every control named in that instrument's
acceptance predicate is:

- **(a) ARMED** — the artifact the control inspects is actually produced by the
  run it grades. A control that reads a transcript a run does not emit is
  unarmed, and its silence is the absence of evidence, not evidence of absence.
- **(b) able to return the NEGATIVE**, demonstrated, not assumed (D-90); and
- **(c) demonstrated NOT to fire on legitimate output** (D-108).

A predicate carrying an unarmed control does not make its result false. It makes
that result **UNVERIFIED on that axis**, and `RUBRIC.md` §3's evidence rule
already says where UNVERIFIED may go: `RISK.md` §4's unknowns register with a
named node that will answer it, **never into a claim** — which includes a number
printed in the README.

**(c) is not symmetry for its own sake.** A control that fires on legitimate
output does not merely misgrade one run: it gets the instrument discarded. For a
**one-shot** instrument — a run bounded by a quota, a deadline, or a human's
availability — the discarded run is the only run, and the cost of a false
positive is the whole instrument rather than one number.

**Evidence this clause admits:** the instrument's predicate quoted verbatim
beside the artifacts the run actually produces, and a demonstration of each
control failing and passing. **Not admitted:** "the control is in the accept", or
a control whose only evidence of working is that it has never objected.

---

## §2.4 — a figure from our own instrument carries its achievable maximum

**Added 2026-08-29 by L2**, before the ruling it was written for (the blind
gate) and applied to no ruling issued before its date. Extends `RUBRIC.md` §2.3,
whose mechanism — never quote a figure without the base that makes it
interpretable — is written for census percentages and is needed more widely.

**The clause.** Any score, count or fraction reported from an instrument **this
project built** must be quoted with the **maximum achievable value** of that
instrument in the same sentence, whenever that maximum is not the nominal
denominator. "*N* of 8" is inadmissible when only 6 of the 8 were reachable by
construction, because the reader does the division the writer avoided.

**It binds in both directions, and that is the test of whether this is a rule or
an excuse.** A result AT the ceiling must carry the ceiling too: "we scored the
maximum available" and "we scored 6 out of 8" say different things, and a clause
that only ever softened bad numbers would be a rationalisation with a section
number. Written down here so that a future good result cannot quietly use the
nominal denominator while a bad one gets the honest base.

**And the ceiling itself must be pre-registered.** Where the maximum is set by
our own design choices, those choices must be traceable to an artifact **frozen
before the run**. Arithmetic over pre-registered artifacts is admissible. A
re-reading of the task set *after* seeing the score is not — that is the quiet
re-interpretation `evals/blind/answer-key.json` was built to prevent, arriving
one level up, at the instrument instead of at a single task.

**Evidence this clause admits:** the pre-run artifact that fixes the ceiling,
quoted, with its freeze date. **Not admitted:** a ceiling computed from the
result, however correct the arithmetic turns out to be.
