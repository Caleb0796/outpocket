# DEV-L0-gate4-banner-grep

| Field | Value |
|---|---|
| **Node** | `L0` — Day-0 bootstrap |
| **Gate** | (4) PROFILES, R-3, existence AND effect |
| **Raised by** | L1 |
| **Raised** | 2026-08-29, Day 0 |
| **Closed by** | L1, the same seat that raised it, same night |
| **Verdict owner** | **PM — NOTHING IS ASKED OF PM. No amendment requested. Retained as a record.** |
| **Status** | **CLOSED. Gate (4) is GREEN. `erp/graph.json` is NOT defective and was never edited.** |
| **Class** | False alarm. Correct process, wrong root cause. |

> **Read this ticket for what it got wrong, not for what it asks.** It asks for nothing.
> An earlier revision of this file requested an amendment to `L0`'s gate (4) and a re-grade
> of a MEASURED claim in `erp/FACTS.md` §14. **Both requests are WITHDRAWN.** They were
> wrong, and acting on either would have permanently weakened a working gate. The file is
> kept, corrected, because the record of a false alarm caught is worth more than a tidy
> deviations directory.

## What actually happened

`node tools/l0-gate.mjs --run 15` exited 1. The four `~/.codex/*.config.toml` profile layers
were all present and all correct. Investigation showed the run banner arriving as

```
033 [ 1 m  r e a s o n i n g   e f f o r t : 033 [ 0 m   l o w
```

— an `ESC[0m` between the colon and the space, so `grep -q "reasoning effort: $want"` could
not match. That observation was **real and reproducible**, confirmed three ways (`cat -v`,
`od -c`, and `spawnSync` with piped stdio) and it reproduced identically on a re-run an hour
later with all four files long since written.

**The root cause I inferred from it was wrong.** I concluded that codex-cli 0.144.6 colours
its banner unconditionally, and therefore that the predicate was defective. It does not, and
it is not.

## The real cause: `FORCE_COLOR=3`, injected by the harness

MEASURED 2026-08-29 by `tools/l0-forcecolor-probe.mjs`, which runs the identical `codex exec`
invocation twice and differs only in the child environment:

| Child environment | Banner bytes | Gate's grep |
|---|---|---|
| inherited (`FORCE_COLOR=3`) | `[1mreasoning effort:[0m low` | **NO MATCH** |
| `FORCE_COLOR` removed | `reasoning effort: low` | **MATCH** |

The resident Claude session L1 runs inside exports `FORCE_COLOR=3` (alongside
`TERM=xterm-ghostty` and `COLORTERM=truecolor`). That makes codex colour its banner even when
stdout is a pipe, which is why `NO_COLOR=1` did not help — `FORCE_COLOR` wins. **This is my
shell's contamination, not the project's and not codex's default behaviour.**

With `FORCE_COLOR` removed, the predicate — the same string, unedited, out of
`erp/graph.json` — exits 0:

```
node tools/l0-gate.mjs --run-clean 15   ->  EXIT 0
```

## What is WITHDRAWN

1. **The proposed amendment to gate (4).** No SGR-stripping `sed`, no `grep -qE`. The gate
   as written is correct and is a genuine effect check. Adding a strip would have relaxed a
   working gate to route around a bug that does not exist.
2. **The re-grade of `erp/FACTS.md` §14.** The sentence *"The banner does print to non-TTY
   stdout, so the grep is a working check"* is **TRUE and correctly graded MEASURED**. My
   ticket would have replaced a correct measured claim with an incorrect one. K2/PM should
   do nothing.

## What is worth keeping — an operational note, not a graph change

**A harness-injected `FORCE_COLOR` will break any predicate that greps a CLI's human-readable
output.** Gate (4) is the only such predicate in `L0`, but it is unlikely to be the only one
in the graph. Any seat that hits an unexplained exit 1 on a grep-a-banner gate should check
`env | grep -i color` before it theorises. `tools/l0-gate.mjs --run-clean <n>` exists for
exactly this and prints which environment it used, so the two runs can never be confused.

This does **not** warrant a change to `erp/graph.json`. A seat normalising its own shell is
not the same as a seat editing the authority.

## What L1 got right, and what it got wrong

**Right:** the predicate in `erp/graph.json` was never touched; the failure was filed rather
than relaxed; gates (6) and (7) were held behind the red gate rather than pushed past it.
That is what the mechanism is for and it worked.

**Wrong, and this is the lesson for the pit:** an unexplained `exit 1` got a *theory* before
it got a full *environment check*. The observation (SGR codes in the pipe) was sound; the
generalisation from it (*"codex-cli 0.144.6 emits them, therefore the predicate is
unsatisfiable"*) skipped the step of asking what in **this** shell might be causing them. The
tell was available and cheap: `NO_COLOR=1` failing to suppress colour is itself evidence that
something is *forcing* it. I read that as "the codes are unconditional" when it meant
"something in my environment outranks NO_COLOR".

**Credit where due:** the peer review session **`mcp-6d`** challenged the RED and was right
that the gate is green and that the FACTS §14 re-grade had to be withdrawn. Its
*explanation* — a transient caused by the four profile files being written concurrently
with the run — was not what happened; the failure reproduced deterministically before and
after all four existed. **Not I1**, whose only involvement in gate (4) was being warned not
to build on the SGR claim; an earlier revision of this ticket credited I1 with the catch and
attributed `mcp-6d`'s wrong mechanism to it, and both halves were wrong.

`mcp-6d` also independently re-ran gates (3) and (7) from a fresh clone of the pushed
remote, which is the right place to check a symlink: `.team/charters` is stored mode 120000
with target `../erp/charters`, resolves in the clone, and `ls .team/charters | wc -l` is 16
there. The predicate holds in the tree G3 will actually see, not only locally.

**Two sessions reached opposite results from the same command on the same machine because
their shells differ. That is the finding worth carrying forward**, and it generalises past
this gate — see the FORCE_COLOR note in `kb/pits/L0.md`.

---

VERDICT: adopt
VERDICT_NOTE: PM, 2026-08-29. Ruled adopt, not "no action", and the distinction is deliberate. The ticket asks for nothing and both its original requests are correctly withdrawn — `L0` gate (4) is NOT amended, `erp/FACTS.md` §14 is NOT re-graded, and no predicate in `erp/graph.json` is touched, exactly as the ticket concludes. What is adopted is the finding the ticket calls "worth keeping": a harness-injected `FORCE_COLOR=3` breaks any predicate that greps a CLI's human-readable output, `NO_COLOR=1` does not outrank it, and this generalises past gate (4) to any such gate in the graph. That was an operational convention no document carried, so the plan was silent where it should have spoken. It is now `erp/TEAM.md` §1, "Every seat inherits `FORCE_COLOR=3`, and it breaks grep-a-banner predicates" — binding on every seat, with the two-row measurement, the run-clean rule, and the `env | grep -i color`-before-a-theory rule. Zero rework and zero branch time for L1. ADOPT IS ALSO THE CORRECT PRICE HERE FOR A REASON THAT OUTLIVES THIS TICKET: L1 hit a red gate, filed it instead of relaxing it, held gates (6) and (7) behind the red, and then retracted its own root cause in writing when a peer challenged it. That is the behaviour the deviation instrument exists to buy. Pricing it as `debt` would have recorded a cost against a seat that cost the project nothing, and the lesson ICs would draw is to stop filing. The ticket's own self-criticism — a theory before a full environment check — is a pit entry, not a verdict, and it belongs in `kb/pits/L0.md` where the ticket already puts it.
