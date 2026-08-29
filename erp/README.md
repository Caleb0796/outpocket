# erp/ — start here

**outpocket is a WebMCP expense-reimbursement desk where the employee's own agent works inside the
employee's already-authenticated browser session** — the page registers tools on itself, the agent
drafts the report, the human signs it, and the server decides per request what was actually allowed.
No second front door, no service account minted for a robot, no broker holding a rotating credential.
`erp/` is not the product: it is the **executable plan** for building it — 68 nodes, 16 seats, a
5.5-day sprint ending **2026-09-03 13:00 PT**.

**If you read only this file, do not change anything.** Nothing has been built yet. The repository at
`/Users/calebwei/mcp/outpocket` still carries only its 3-file initial commit and `erp/` is untracked
— that state is *load-bearing* (node `L0` gate 6 is the first push) and must not be tidied by hand.

---

> **Resuming after a compaction? Read [`HANDOVER.md`](HANDOVER.md) first.** It carries
> the measured browser facts (V0–V4 plus `V6-consent-gate`), the decisions closed on 2026-08-29, the
> environment gotchas that cost real time, and what not to redo.

## 1. Reading order, and which two files are AUTHORITIES

1. `erp/README.md` (this) — the map. 5 min.
2. `erp/PLAN.md` — strategy, the two defensible claims, the schedule and its gates. 30 min.
3. **`erp/graph.json` — AUTHORITY.** Node identity, owner, inputs, outputs, hours, cut rank, horizon,
   and every `accept` string. 20 min.
4. **`erp/PATHS.md` — AUTHORITY.** Every literal path, filename, artifact and command name. 15 min.
5. `~/mcp/countinghouse/HANDOVER.md` — §3 API rules, §5 retracted claims, §6 census. 20 min.
6. `erp/TEAM.md`, `erp/RISK.md`, `erp/GRAPH.md`, then your lane's `erp/charters/<seat>.md`.

**Exactly two files are authorities: `graph.json` and `PATHS.md`.** Everything else — `PLAN.md`,
`GRAPH.md`, `TEAM.md`, `EVAL.md`, `RISK.md`, `FACTS.md`, `CONTRACTS.md`, `RUBRIC.md` — is a **checked
restatement**, and each says so in its own header. Where a restatement and an authority disagree, the
authority wins and the restatement is *regenerated*, never argued with.

**Why this is the first thing said.** Its absence cost five repair rounds. Seven writers each held a
private copy of the filesystem, so `web/**` vs `src/page/**`, and `violations.schema.json` vs the
real singular `violation.schema.json` (29 references, every one of which would have failed on a
missing path), lived side by side as if both were true. Restating is *legal* here, but only while
`node tools/ready.mjs --check-tables` proves the restatement equal to the authority (ruling R-22).
**If you need a path, copy it out of `PATHS.md`. Never type one from memory.**

---

## 2. What each file is for

| File | One line |
|---|---|
| `graph.json` | **AUTHORITY.** 68 nodes, 124 edges, capacity, schedule, cut ladder, 36 rulings, falsification register. |
| `PATHS.md` | **AUTHORITY.** Canonical path, glob owner, writing seat, producing node, and every dead alias. |
| `PLAN.md` | The two claims, five kernel mechanisms, demo beats, Day 0–6 schedule with every cut-0 gate quoted verbatim. |
| `GRAPH.md` | Readable lane tables for all 68 nodes, the critical path, the cut ladder, the morning ready-set procedure. |
| `TEAM.md` | 16 seats, launch commands, communication topology, the four rulers, deviations, the merge protocol. |
| `EVAL.md` | Lane E: driving Chrome, the capability and negative suites, blind grading, deterministic accounting, CI. |
| `RISK.md` | Disqualification checklist, banned wording BW-01..BW-32, killed directions, unknowns V0–V4, attack surface. |
| `FACTS.md` | Carried-over ground truth with evidence grades: API rules, measured sizes, census, poisoned citations. |
| `CONTRACTS.md` | The frozen layer: OCF-1 canonical form, violation envelope, sign gate + hash chain, policy, eval case. |
| `RUBRIC.md` | L2's only instrument: legibility, threshold, claim defensibility, disclosure. |
| `contracts/` | Eight pre-existing frozen artifacts (6 `*.schema.json` + 2 data documents); `V5` adds a ninth on Day 0. |
| `charters/` | The 16 per-seat system prompts. `L1.md` is the only one read directly, on L1's first boot. |
| `reviews/` | Ten archived adversarial reports across five rounds. Read `2026-08-28-signoff.md` first. |

---

## 3. How to start

From `/Users/calebwei/mcp/outpocket`. Every command below was executed while writing this file;
expected output on the right.

```
git log --oneline -1                                   # 7496b06 Initial commit: ...
git status --porcelain | head -1                       # ?? erp/
git ls-remote origin refs/heads/main | cut -f1         # 7496b066b9e9...  (== local HEAD)
gh api repos/Caleb0796/outpocket -q '.visibility + " " + .license.spdx_id'   # private MIT
ls erp/charters | wc -l                                # 16   (L0 gate 3 asserts this)
ls erp/contracts/*.schema.json | wc -l                 # 6    (never say "eight schemas")
ls -1 ~/.codex/ | grep -cE '^(verifier|builder|redteam|evaluator)\.config\.toml$'   # 0
node --version ; codex --version                       # v22.23.1 ; codex-cli 0.144.6
```

**Day 0 is two nodes and nothing else: `L0` (L1, 3.5 h) and `V5` (I1, 1.5 h).** Their accept
predicates are quoted byte-for-byte in `PLAN.md` §6.3 "Gate Day-0"; run them from there or from
`graph.json`, never from a third copy. `L0`'s seven gates run **in the printed order** — that order
is the fix for three separate defects — and gate (6) is the first `git push` any node performs.

**Ruling D-17 is SETTLED: 3.0 human-hours/day** (ruled by the user 2026-08-28, before any seat was
dispatched). 16.5 h available against 15.875 h required — **the full graph fits with 0.625 h of
spare and nothing is cut.** `L0` gate (1) is still that ruling's home *and* its gate: it must find
`human_hours_per_day = 3.0` in `erp/DECISIONS.md` and prove it equals
`capacity.human_hours_available / 5.5`. The 2.5 h/day branch — 13.75 available, short by 2.125, and
**27 of the 62 horizon-A nodes deleted**, named by id in `capacity.human_budget_sensitivity` — is
retained as the contingency if the budget slips in practice. The gate fails unless `erp/DECISIONS.md` carries the row and
`capacity.human_hours_available` equals the ruled figure × 5.5.

**On the sign-off's hard stop.** `reviews/2026-08-28-signoff.md` records exactly one: defect #1,
`S10`'s `^freeze:` commit probe, which named a pre-existing file no node ever re-commits. **It is
closed** — v2.3.0 (ruling R-31) repoints the probe at `erp/contracts/FREEZE.md`, a file `S10`
genuinely produces; verified in S10's current `accept`. If it reopens, the fix is the one that
landed: move the probe's path, never weaken the `sha256sum -c` clause.

---

## 4. The state of the work, honestly

**Verified by execution, by me, today, against the files as they stand:**

| Check | Result |
|---|---|
| structure | 68 nodes (ids unique), 124 edges, `inputs`↔`edges` bijective 124/124, acyclic, roots `{G1, L0}` |
| cut invariant, hard + same-horizon | **0 violations over 102 qualifying edges** (110 hard / 11 soft) |
| critical path, recomputed from `hours` | **29.5 h**, `L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6` |
| capacity | 118.0 A-hours, 107.5 non-gated, 5.375 overhead, **15.875 required vs 16.5 available at the ruled 3.0 h/day**; fits whole, 0.625 h spare, nothing cut |
| `schedule_A` | 62/62 scheduled once, 0 backwards orderings on hard *and* soft edges, peak agent seat-day exactly **6.0** |
| PLAN.md vs `graph.json` | **35/35 gate blocks byte-identical** (exactly the 35 cut-0 A-nodes); day table 62/62 equal |
| GRAPH.md lane tables | 68/68 rows, **all equal on id/title/owner/inputs/hours/cut** (the S5 title drift is closed — `graph.json` adopted the fuller title) |
| `PATHS.md` owner columns | **166 rows / 150 comparable / 57 disagreeing** — reproduces the published figure exactly |
| banned-list generator | emits exactly **32** rows, BW-01..BW-32 |
| environment | Chrome 152.0.7977.64, node v22.23.1, codex-cli 0.144.6, `gh` authed as Caleb0796 with `repo` scope |

**What is an estimate, not a measurement.** Every `hours` field is OUR-ESTIMATE, so 29.5 h and 118.0
h are arithmetic over estimates. `tools/ready.mjs` **now exists** (`G0`, first green run 2026-08-29),
and `graph.json` regrades the critical path and the cut invariant accordingly — but the regrade is
narrow: what is MEASURED is the *derivation* (this walk is the longest hard-edge horizon-A path; its
total equals `capacity.graph_depth_hours`; the invariant holds on all 101 qualifying hard edges), not
the *inputs*. **Do not read 29.5 h as a measurement of how long the sprint takes.** W's one-third
adopt-rate target is a prior, not data. The human budget is **no longer** an open assumption: D-17 is
RULED at 3.0 h/day (see above).

**Do not oversell this.** Five adversarial rounds are archived in `reviews/` and a reader will check
them. The hard-stop sequence across those rounds was **22 → 16 → 5 → 3 → 1**; the last two verdicts
on record are `NOT-EXECUTABLE` (confirmation pass, 3 stops) and `EXECUTABLE` (sign-off, 1 stop).
v2.3.0 then closed the sign-off's fourteen named defects — **but no adversarial round has run since
v2.3.0.** What you have is a plan that survived five audits plus one repair round nobody has audited.

---

## 5. The standing disciplines

**Four non-overlapping rulers.** QA asks *is it done?* (G3 G6 T4 D6) and may not say "this is not
impressive". L2 asks *is it enough to win?* against `RUBRIC.md`, and may not say "this test fails".
C3 asks *can it be broken?* (E9). C1 asks *can a blind agent use it?* (E8) and never sees the source
— blindness is enforced by a dedicated empty `CODEX_HOME`, not by `cwd`. A finding outside your own
scale is **routed through PM, never suppressed and never absorbed**. Firing cut ranks 1–3 deletes E4,
E8 and E9 and four rulers become two; PM must say that out loud before firing, not after.

**The three-layer deviation mechanism.** Layer 0 is a zero-token git hook (`G4` lint, `G5` ownership)
that blocks the commit — it catches most deviations because most deviations are careless, not
strategic. Layer 1 is W, which produces **evidence only, never verdicts**, filed as
`.team/deviations/DEV-<NNN>.md` in eight fixed fields. Layer 2 is PM, with three verdicts: **adopt**
(the plan was wrong, the work was right — PM edits the authority, nothing is sent back),
**send-back** (must name the failed clause, a deadline and a branch, or the IC may refuse it), and
**debt** (merges as-is, logged in `erp/DECISIONS.md`). Adopt must stay cheaper for the IC than
send-back, or ICs learn to hide deviations and the mechanism reports perfect compliance exactly when
compliance has failed.

**L1 is the sole pusher — and pushing is an obligation, not just a permission.** `git push` is L1's
and only L1's; the other fifteen charters' "never `git push`" restricts *them* and never prohibits
L1. The half that was missing tied the sprint's first knot: **L1 pushes on every merge to `main`**
(`git push origin HEAD:main`, then assert local `HEAD` equals `git ls-remote origin refs/heads/main`).
`L0` deliberately pushes a tree with one known-red test that `T6` fixes on Day 1, and `G3` clones
`origin/main` demanding zero failures — without the standing obligation, T6's fix never reaches the
remote and `G3` is unsatisfiable for the whole sprint.

**The banned-wording lint.** `RISK.md` §2 is the source table; `.team/lint/banned.txt` is *generated*
from it by one `sed`, with an emptiness guard because `grep -f` on an empty pattern file matches
every line. `G4` scans for banned identifiers, descriptions over 500 characters, banned phrasing and
retracted claims, and `--assert-register` fails unless `kb/webmcp/RETRACTED.txt` literally carries
the five sentences this project lost the right to assert — among them *"a commit cannot be made
without a human decision"* (R-13; the provable sentence names the POST) and *"the tool surface is the
boundary"* (it is a menu, not a lock). `erp/**` is excluded **because these files quote the banned
strings in order to ban them** — verify the exemption, never satisfy the hook by deleting quotes.
Patterns must be `\b`-anchored: unanchored, `our differentiator` matches the innocent
"f*our differentiator*s".

---

## 6. Known open — nothing is hidden

- **`reviews/2026-08-28-signoff.md` is the live defect list**: 20 entries, 1 hard stop (closed, §3),
  a "first hour tomorrow" paragraph, and a named "most likely to go wrong that nobody has caught" —
  the sign gate's surviving forgery is described two incompatible ways two JSON keys apart in the
  same frozen file.
- ~~**Three restatement drifts**~~ **— all three are CLOSED, and leaving them listed here as live
  was itself a defect (R-44).** Verified 2026-08-29: (1) `graph.json`'s `S5` title *does* carry
  ", one-shot guard" and `GRAPH.md` matches it; (2) `EVAL.md` §4 already restates the path as
  `L0 → V5 → S10 → …` at **29.5 h**, equal to `capacity.graph_depth_hours`; (3) `PATHS.md` §3
  carries the retraction of the superseded **179 / 157** run rather than republishing it.
- **`G0`'s accept-path accounting is stale and says so.** R-43/R-44 edited `S5`, `S12` and `V6`
  accept text, which changes the token set. Recompute and republish on the first Day-0 run; do not
  quote **182 / 152 / 7** or "0 UNRESOLVED" as a current measurement.
- **The unknowns V0–V4** (`RISK.md` §4), each with a pre-declared fallback. **All five now carry
  readings (2026-08-29) and none has passed its answering node** — see `evidence/UNKNOWNS.md`, and
  quote each with its origin, because `V1` was read remotely and the rest on localhost. `V1` — is
  `document.modelContext` present in ChatGPT's built-in browser on a plain HTTPS origin — was the one
  failure mode invisible from inside the dev loop; it came back **PRESENT** on `V5`'s throwaway origin.
- **Unbudgeted overhead, kept deliberately**: `kb/pits/<node-id>.md` merge entries, deviation
  tickets, inbound logs, and the 68 `.team/contracts/<node>.txt` briefs. If the schedule bites, PM
  drops them by ruling — never by silence.

---

## 7. Submission compliance — the part with a deadline

**2026-09-03 13:00 PT.** PUBLISHED contest requirements (`FACTS.md` §12): a **public** repo with full
running instructions and all assets; an **OSI licence at the repo root, visible in the GitHub About
box** (Devpost and GitHub detect it differently, and the root file satisfies both); and a **public
video under 3 minutes, in English, WITH AUDIO** — missing audio is disqualification-grade, and only
**24 of 420** gallery entries attached a video at all.

**All three repos are `private MIT` today** — measured above for `outpocket`, `webmcp-eval-kit` and
`webmcp-dev-kit`. Flipping the first two to public is node **`G1`** (human-gated, 0.5 h, cut 0), and
**it runs on Day 1, not at the end** (decision D-12): `G3` clones the GitHub URL over anonymous HTTPS
that same day, so a private repo fails that clone on authentication rather than on tests. The only
working probe is `gh api repos/Caleb0796/<repo> -q '.visibility + " " + .license.spdx_id'`; `gh repo
view --json licenseInfo` returns empty, because `licenseInfo` has no `spdxId` field. The video is
**`D4`** (Day 5, 4.0 h, human-gated), the Devpost submission is **`D5`** (Day 6), and final
acceptance — **`D6`** — is run item by item from a logged-out or incognito window: repo opens,
LICENSE visible, video plays, video has sound.

> The whole crew is scaffolding for a submission the judges may never run: the rules permit judging
> from the text, images and video alone. **If a choice must be made between crew discipline and the
> video shipping, the video ships.**
