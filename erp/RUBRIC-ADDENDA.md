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
