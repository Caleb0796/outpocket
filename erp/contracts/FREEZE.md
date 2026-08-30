# `FREEZE.md` — the one freeze mechanism

> **Node `S10`, owner L1, Day 1.** This file is the **only** freeze mechanism in this project.
> Not a date, not a table, not a sentence in a charter. Verify from the repository root:
>
> ```
> sha256sum -c erp/contracts/FREEZE.md
> ```
>
> `sha256sum -c` reads the `<hash>  <path>` lines below and ignores the prose, warning that the
> prose lines are "improperly formatted" and exiting 0 anyway when every checksum line verifies
> (MEASURED, `sha256sum (Darwin) 1.0`). The warning is expected. A non-zero exit is not.
>
> **The wall-clock deadlines in `erp/CONTRACTS.md` §2 are NOT authoritative.**
> `erp/graph.json.interface_freezes` is the authority for what unblocks what; this manifest is
> the authority for whether it is frozen yet. Before this check passes, work downstream of the
> seam is speculative rework, and `webmcp-agent-team.md` calls parallelism before the freeze
> fake.
>
> **Any change after this commit requires a PM deviation ticket referenced in the commit body.**
> One node is already licensed to move a line without a ticket: `S5` edits
> `erp/contracts/signature.schema.json` and RE-RECORDS its sha256 here in the same commit. That
> is a re-record, not a waiver — the manifest never goes stale silently.
>
> **`erp/contracts/eval-case.schema.json` moved once, under a ticket.** `S5` flips
> `examples[1].controlStatus` from `known-open` to `enforced` once the confirm_token ships
> (R-27; `refused` is not in the frozen enum) — see
> `.team/deviations/DEV-E3-eval-case-known-open.md`, referenced in the commit body that made
> this edit, and this line's sha256 is the re-record it authorises.

## What is frozen, and why these ten

Nine of these are **pre-existing planning artifacts** (R-17): they were authored before the
graph, they are on disk today, **no node lists one as an output**, and `L0` committed them
**where they are** — it did not move, copy or duplicate them under a bare `contracts/`
directory. That spelling is dead. `erp/contracts/probe-verdict.schema.json` is the ninth and it
is a **V5 output**, written on Day 0 so that `V1` could run on Day 1; the hard edges
`V5 -> S10` and `V5 -> G6` are what make that ordering a provable claim rather than a
scheduling coincidence.

The tenth is `tool-surface.contract.md`, this node's own output. It is here because `G6`'s
accept says so in as many words: the `.md` contract files **carry no schema** and are
"covered by the `erp/contracts/FREEZE.md` sha256 check instead". A markdown contract that
nothing hashes is not frozen.

**The filename is `violation.schema.json`, SINGULAR.** The plural spelling appeared in 29
references across 7 files and every one of those commands would have failed on a missing path,
forever. This manifest hashes the path, which is why that had to settle before anything froze.

## The manifest

413a563e2425fae70b949f8792f983c72b88849a83827e2e2f3420c7c3dea398  erp/contracts/canonical-vectors.json
8c7d72dc9a137d9075f3b1391c71eec14bd189738e09dae2b7ebe9f8aa4a5360  erp/contracts/eval-case.schema.json
8dc6404d22a0671bc963f122851c48ac9c79ab61a5f9e85f55937378b36c2411  erp/contracts/policy-versions.json
a9413096bd65c6c3b699dfa55b262b7bcd5a247d7b03cc4834e215f60c6410ed  erp/contracts/policy.schema.json
4f839c13dd6d07758b1ef74138ad632be0fb4f7fbb4ced552e7ed489103b1485  erp/contracts/probe-verdict.schema.json
fb729b21555efafa9f38adec1e767063e35ca5038210207eeb85982f59b525da  erp/contracts/provenance.schema.json
3ddedc9ec3775b6313abdc991377af2182df251a67b880b80f4d70f04f36e2a8  erp/contracts/signature.schema.json
df4134e7ec98d326b94777e6b1efda58554bc6ec6238252da40d668876d4129b  erp/contracts/tool-export.schema.json
562d5cec6b6ae82f25c8c7e81a910d2129b4a9aa722374b71ae80e4c725735ce  erp/contracts/violation.schema.json
20a6984e992f5901a296d02dfbb41f4b192676ee38402f86e3739b41fb051400  erp/contracts/tool-surface.contract.md

*(`FREEZE.md` cannot hash itself; git does that. `git log -1 --format=%s -- erp/contracts/FREEZE.md` carries this node's own freeze subject, which is the probe `S10.accept` runs — and the reason it does not probe `violation.schema.json` instead is that `L0` commits that path once, under `bootstrap: outpocket sprint A`, and nothing in the graph ever touches it again, so the old probe could never have gone green.)*


## Amendment log

**2026-08-29 — D-77, the T3 bump.** Two hashes moved: `tool-export.schema.json` and
`tool-surface.contract.md`. `explain_missing_tool` (the absence register, node **T3**) is
published on the surface in all six states, so every per-state count rose by one.

THIS IS A BUMP, NOT A BREAK, AND THE DISTINCTION IS THE WHOLE POINT OF THE FREEZE.
`x-requiredStates`' own note recorded that its six counts were MEASURED by reading the
countinghouse spike compiler — **a pre-port spike that had no absence register, because T3 did
not exist.** They were a stale measurement, never a decision about where that tool belongs.
A freeze exists to catch ACCIDENTAL surface change; the sanctioned mechanism for an
intentional reviewed one is a bump, adjudicated and recorded. Leaving the numbers frozen would
have given a deleted compiler veto power over a live design choice.

**THE TWO DOCUMENTS DO NOT AGREE DIGIT FOR DIGIT AND MUST NOT.** §1 of
`tool-surface.contract.md` is written in the COMPILER'S INTERNAL ids, where `S2` is the DIRTY
draft and `S3` is the CLEAN one; `x-requiredStates` is written in EXPORT ids, where
`S2-emp-draft-clean` is the clean one. So §1 reads `… 13, 14 …` and `x-requiredStates` reads
`… 14, 13 …`, and **both are correct. If they ever agree in row order, one of them is wrong.**
I first wrote this amendment as "2/6/14/13/7/7 down both" — which would have put 14 on the
DIRTY row and propagated into `MEMBERSHIP`, the mirror image of the exact bug T5 exists to
prevent. Caught by I2 before it was applied.

A SECOND RE-CUT IS EXPECTED. `tool-surface.contract.md` §2 carries `set by T3 / 500` in the
description-budget cell, because the tool does not exist yet. T3 fills the real byte count and
this manifest is re-cut again when it lands. Two honest re-cuts beat one that guesses a number.

Also corrected here, under D-78: the note's claim that `S4-emp-submitted` and `S5-aud` "differ
by exactly one name" — MEASURED, they differ by TWO each way. True when written, stale since
T6, and the argument it supports (set equality over count equality) is slightly stronger for it.
