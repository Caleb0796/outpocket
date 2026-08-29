# DEV-L0-gate4-banner-grep

| Field | Value |
|---|---|
| **Node** | `L0` — Day-0 bootstrap |
| **Gate** | (4) PROFILES, R-3, existence AND effect |
| **Raised by** | L1 |
| **Raised** | 2026-08-29, Day 0 |
| **Verdict owner** | **PM** |
| **Status** | **OPEN — blocking. L0 is not accepted. Gates (5)–(7) are held behind it.** |
| **Class** | Defective acceptance predicate. The artifact is correct; the checker cannot pass. |

## What the predicate says

Verbatim from `erp/graph.json` `L0.accept`, gate (4):

```sh
for pair in verifier:low builder:medium redteam:high evaluator:high; do p=${pair%%:*}; want=${pair##*:}; test -f ~/.codex/$p.config.toml || exit 1; python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))" ~/.codex/$p.config.toml || exit 1; codex exec --strict-config -p "$p" --ephemeral -s read-only --skip-git-repo-check -o /dev/null 'Reply with exactly: OK' < /dev/null 2>&1 | grep -q "reasoning effort: $want" || exit 1; done
```

Run verbatim via `node tools/l0-gate.mjs --run 15`. **Exit 1.**

## Why it fails — and it is not the profiles

`codex-cli 0.144.6` emits ANSI SGR codes in the run banner **even when stdout is a pipe**.
The bytes on the banner line are:

```
[1mreasoning effort:[0m low
```

There is an `ESC[0m` **between the colon and the space**. The pattern
`reasoning effort: low` therefore cannot match, and `grep -q` returns 1 for every one of
the four profiles. `NO_COLOR=1` does **not** suppress the codes (MEASURED 2026-08-29).

## The profiles themselves are correct, in existence AND in effect

MEASURED 2026-08-29 by `node tools/l0-profile-evidence.mjs` — **evidence only, not a
substitute gate**. It re-runs the same four `codex exec` invocations and strips SGR before
comparing:

| Profile | `test -f` | `tomllib` parse | Banner after stripping SGR | Wanted | Gate's raw grep |
|---|---|---|---|---|---|
| `verifier` | PASS | PASS | `reasoning effort: low` | low | NO MATCH |
| `builder` | PASS | PASS | `reasoning effort: medium` | medium | NO MATCH |
| `redteam` | PASS | PASS | `reasoning effort: high` | high | NO MATCH |
| `evaluator` | PASS | PASS | `reasoning effort: high` | high | NO MATCH |

This is a **real** effect check, not an existence check. `~/.codex/config.toml` reads
`model_reasoning_effort = "ultra"`, so every one of these four banners moved off the base
config. The flat-top-level-key layout in `erp/FACTS.md` §14 works exactly as documented, and
the `[profiles.*]` failure mode that section warns about is not what happened here.

## A MEASURED claim in `erp/FACTS.md` §14 is falsified by this

> *"The banner does print to non-TTY stdout, so the grep is a working check."*

The first half is true and the second half does not follow. The banner prints; it is not
**greppable** as written, because it prints coloured. K2/PM should re-grade that sentence.

## What L1 did NOT do

Per `erp/charters/L1.md`: *"Relaxing an acceptance predicate to get a merge through. If the
predicate is wrong, that is a deviation ticket and PM's `adopt` verdict — not your edit."*
The predicate in `erp/graph.json` is **untouched**. No substitute gate was invented, and no
`--run 15` result is being reported as green.

## The fix PM is being asked to rule on

One token, inside the existing gate. Replace the fixed-string grep with an SGR-tolerant
regex:

```sh
| grep -qE "reasoning effort:.*[[:space:]]$want\$"
```

or, keeping the fixed string, strip SGR first:

```sh
| sed $'s/\x1b\\[[0-9;]*m//g' | grep -q "reasoning effort: $want"
```

Either keeps the check honest — it still greps the **banner** for the level actually in
effect, which is the whole point of R-3 and the reason `test -f` alone was rejected. Neither
weakens the gate: a missing profile still falls back to the base config's `ultra` and still
fails.

**PM's verdict — `adopt` or `send back` — belongs on this ticket. L1 will re-run
`--run 15` verbatim against the amended `graph.json` and will not push until it exits 0.**

## Blast radius if this is left open

`L0` is the head of the critical path. Day 1 carries 15 nodes, and `G3` (cut 0) clones
`origin/main` and runs `npm ci`. Gate (6) is the first push; it is held. **Every Day-1 node
is behind this ticket.** The fix is a one-line edit to one predicate.
