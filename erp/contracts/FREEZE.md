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
f363e1b4d3c29c549a2ac40f5c8fd20d20e95138e8899e2c818efceba3051ff6  erp/contracts/tool-export.schema.json
562d5cec6b6ae82f25c8c7e81a910d2129b4a9aa722374b71ae80e4c725735ce  erp/contracts/violation.schema.json
7f61ee1c3e66b6bc519f090471009bed17f47bcb83cb79ea7aa758553ceedf0a  erp/contracts/tool-surface.contract.md

*(`FREEZE.md` cannot hash itself; git does that. `git log -1 --format=%s -- erp/contracts/FREEZE.md` carries this node's own freeze subject, which is the probe `S10.accept` runs — and the reason it does not probe `violation.schema.json` instead is that `L0` commits that path once, under `bootstrap: outpocket sprint A`, and nothing in the graph ever touches it again, so the old probe could never have gone green.)*
