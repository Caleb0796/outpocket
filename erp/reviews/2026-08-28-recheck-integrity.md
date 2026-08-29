Verification complete. All findings below were produced by running scripts and commands against `/Users/calebwei/mcp/outpocket/erp/`, not by reading.

## Mechanical results (all reproduced independently)

| Check | Result |
|---|---|
| `graph.json` parses | ✅ 68 nodes, 117 edges, v2.0.0 |
| Duplicate ids / missing required fields | ✅ 0 / 0 (all 11 fields on all 68) |
| `inputs[]` ↔ `edges[]` bijection | ✅ 117 = 117, zero either way |
| Topological sort (Kahn, all 117 edges) | ✅ completes, 68/68, acyclic |
| Cut invariant `key(u) ≥ key(v)`, hard edges | ✅ 0 violations |
| Cut-ladder bookkeeping | ✅ ranks free 12.0 / 24.0 / 11.5 exactly; every cut>0 node in exactly one rank; no cut-0 node in any rank |
| `agent_hours_total_A: 116.0` | ✅ exact |
| `human_gated_hours: 10.5`, all cut 0 | ✅ exact, irreducible |
| `human_hours_required: 15.775` = 10.5 + 0.05×105.5 | ✅ exact; all five `reachable_thresholds` rows reproduce to the decimal |
| Critical path `L0→T6→S10→S1→S3→S4→T2→H3→H6→D4→D5→D6` = 28.5 h | ✅ my independent longest-hard-path gives the same 12 nodes, same hours, same seats; every consecutive pair is a real hard edge |
| Depth after ranks 1/2/3/4 | ✅ 28.5 at every rank, as claimed |
| Every accept path appears in some node's `outputs` | ⚠️ 1 miss: `./artifacts/tools.export.json` (T5) — `./` prefix only |
| `interface_freezes[].unblocks` | ✅ 10/10 are real nodes with a hard edge from `frozen_by` |
| Ownership resolution under `ownership_rule` | ✅ 0 unresolvable (4 `~/.codex/*` outputs match no glob but are node outputs) |
| Sibling node tables vs `graph.json` (owner/inputs/hours/cut) | ✅ GRAPH.md 68/68 identical; EVAL.md §4 11/11 identical; PLAN.md 62/62 identical |
| PLAN.md day table | ✅ 62/62 horizon-A scheduled, **0 backwards hard orderings**, 20/20 gate blocks byte-identical to `accept` |
| Second cut ladder | ✅ RISK.md's 10-rank ladder deleted; PLAN/RISK restatements match `cut_ladder` exactly; 35-node never-cut set and 27-node amputation set both reproduce |
| Paths resolve against PATHS.md | ✅ 149 rows, 0 non-existent node ids, 0 producing-node disagreements |

---

## Prior defects — graph-integrity report (20)

| # | Defect | Status | Evidence |
|---|---|---|---|
| 1 | `S10` is two different nodes | **CLOSED** | CONTRACTS §12 table deleted; its node is now `S12` (I3, 2 h) with edges S1→S12, S5→S12, S12→S6 — all three present |
| 2 | S11/G6/E8/E9 exist only in siblings; E8 collides | **CLOSED** | All merged; E8 = C1 blind run, E10 = mutation check; `id_collision_warnings` records the split |
| 3 | Lane E disagrees on every node | **CLOSED** | All 11 EVAL.md §4 rows match owner/inputs/hours/cut/repo/horizon |
| 4 | `violations.schema.json` (plural) doesn't exist | **CLOSED** | 0 live uses; all 10 remaining occurrences are explicit "this is dead" warnings or the reviews/ dir |
| 5 | Ladder shortens the path by zero, docs claim otherwise | **CLOSED** | `ladder_does_not_shorten_the_schedule` states it; 28.5 at every rank verified |
| 6 | Ladder frees zero human-gated hours | **CLOSED** | 10.5 h declared irreducible; `reachable_thresholds` published and verified |
| 7 | `human_hours_required` double-counts | **CLOSED** | Rule now `0.05 × (total − human_gated)`; 15.775 verified |
| 8 | Storyboard frozen by cut-1 F6, unblocking cut-0 D4, no edge | **CLOSED** | `F0` added (cut 0); F0→D4 and F0→F6 both hard; D4 no longer grades itself |
| 9 | E7→D5 soft edge carries the submission, no degrade story | **CLOSED** | Edge carries a `degrade` field; D5's retracted-claims clause is now mechanical via `kb/webmcp/RETRACTED.txt` |
| 10 | PLAN's schedule omits 3 cut-0 nodes, asserts a reversed path | **CLOSED** | 62/62 scheduled, 0 backwards hard orderings |
| 11 | Two incompatible cut ladders | **CLOSED** | RISK §7 ladder deleted; triggers name node ids |
| 12 | Five seats own zero nodes | **CLOSED** | W/K1/K2 declared `non_node_seats`; C1 owns E8, C3 owns E9; computed zero-node set == declared set exactly |
| 13 | 16 accept predicates name scripts no node produces | **CLOSED** | Every one now has a producing node and funded hours; only the `./` prefix on T5 remains |
| 14 | `tools/ready.mjs` inside the first cut; unearned VERIFIED stamp | **CLOSED** | Moved to `G0` (cut 0); `cut_invariant_grade` regraded to OUR-ESTIMATE with an explicit "the checker does not exist yet" |
| 15 | 11 unrunnable accept predicates | **PARTIAL** | 9 fixed and 4 verified by execution (see below). **V1 still carries a literal `node -e "..."`**; V2/V3 verdict labels remain unverifiable (acknowledged in-node) |
| 16 | Unknowns register keyed T0–T4 | **CLOSED** | Keyed V0–V4 everywhere; `id_collision_warnings` marks T0–T4 dead |
| 17 | Charters contradict `file_ownership` | **PARTIAL** | All 15 "You own, by path" blocks regenerated; every dead-vocabulary hit is now an explicit negation. But PATHS.md's Owner column is the *glob* owner, disagreeing with the actual writer on **45 of 149 rows** |
| 18 | Nine acceptance-critical paths unowned | **CLOSED** | `tools/**`→L1 catch-all added; 0 unresolvable |
| 19 | Freeze table names dependencies the edge list lacks | **CLOSED** | 10/10 verified |
| 20 | "Gate D0…D6" collides with node ids | **CLOSED** | Renamed `Gate Day-0`…`Gate Day-6`; gate commands verbatim |

Predicates re-run and confirmed fixed: `gh api … .license.spdx_id` → `private mit` (old `licenseInfo.spdxId` → `PRIVATE `, empty); the Origin-Agent-Cluster idiom → exit 0 absent, 1 on `?0`, 0 on `?1` (old `grep -c` form exits 1 always); `find … -print0 | xargs -0` finds both levels under `sh` (old `src/page/**/*.js` finds one).

## Prior defects — executability report (24)

| # | Defect | Status |
|---|---|---|
| 1 | Two filesystem vocabularies | **PARTIAL** — PATHS.md unifies `web/**` etc., but `erp/contracts/**` vs `contracts/**` is still live in *both* (see NEW-6) |
| 2 | Frozen contract at the wrong name | **CLOSED** |
| 3 | S10 is two nodes | **CLOSED** |
| 4 | Five horizon-A nodes in no day | **CLOSED** |
| 5 | Missing hard edges F1→T2, S1→T2, S4→T2 | **CLOSED** — all three present; depth correctly moves to 28.5 |
| 6 | PLAN's critical path is not a path | **CLOSED** |
| 7 | G1's predicate can never pass | **CLOSED** — verified by execution |
| 8 | `npm ci` fails, no lockfile | **PARTIAL → REGRESSED** — lockfile now from L0, but L0's own gate reproduces the identical `EUSAGE` (NEW-1) |
| 9 | Nothing bootstraps the repo | **PARTIAL** — L0 exists with 3.0 h, but nothing has run: `git ls-files` still returns 3 files, `erp/` untracked, no `.team/`, no `~/.codex/*.config.toml` |
| 10 | Ownership matrix rejects the graph's own work | **CLOSED** — `ownership_rule` (a) beats (b); 0 unresolvable |
| 11 | Gate commands drift from accept | **CLOSED** — 20/20 byte-identical |
| 12 | Three backwards orderings | **CLOSED** — 0 |
| 13 | Five phantom node ids | **CLOSED** |
| 14 | Integer cents vs micro-USD | **PARTIAL** — R-6 rules, S3 re-estimated 1.0→3.0 h; but S3's new predicate is unsatisfiable (NEW-3) and `FACTS.md:531` still says "16 rules" |
| 15 | The third persona does not exist | **CLOSED** — R-5, F1 asserts `count == 2` |
| 16 | RISK's second ladder and calendar | **PARTIAL** — ladder deleted, Day 6 reconciled; but RISK's Day-1 trigger now fires against PLAN's own schedule (NEW-5) |
| 17 | Rank-0 requirement in a doc its owner isn't told to read | **CLOSED** — both contingencies verified present in `S5.notes` and `S1.notes` |
| 18 | QA's coverage check is a no-op | **REGRESSED** — replaced with one that can never pass (NEW-4) |
| 19 | Seven missing `erp/*.md` | **PARTIAL** — six repointed or deleted; `erp/RUBRIC.md` (L2's only instrument) flagged OPEN with no node and no hours, by design |
| 20 | Two freeze mechanisms | **CLOSED** — one: `sha256sum -c contracts/FREEZE.md` (`sha256sum` present on this machine) |
| 21 | Five seats own zero nodes | **CLOSED** |
| 22 | Capacity failure with nothing acting on it | **CLOSED** — D-17, `reachable_thresholds`, 27-node amputation set, PM ruling on Day 0 |
| 23 | Version pinning vs the machine | **CLOSED** — R-8 anchors to 152; installed is 152.0.7977.64 |
| 24 | Ceremonies with no owner-hours | **CLOSED for `.team/`** (L0); `kb/pits/**` remains explicitly unbudgeted |

---

## NEW defects the repair introduced

**NEW-1 — FATAL. `L0`'s accept gate (2) is unsatisfiable in its own stated order. Verified by execution.**
`"All five must pass, in order"`, gate (2): `npm install && test -f package-lock.json && rm -rf /tmp/l0 && git clone . /tmp/l0 && cd /tmp/l0 && npm ci`. `git clone .` clones HEAD, which tracks only `.gitignore LICENSE README.md`; the commit is gate **(5)**. Reproduced: `npm error code EUSAGE … can only install with an existing package-lock.json` — the exact error the repair claims to have eliminated. L0 is cut 0 and the head of the critical path. *Fix:* commit before gate (2), or reorder (5) ahead of (2).

**NEW-2 — FATAL. The L1 seat cannot boot to run L0.**
`TEAM.md` §1 launch command is `claude … --append-system-prompt-file .team/charters/L1.md`. `.team/charters` is created only by L0; L0's owner is L1; and TEAM.md forbids the escape: *"Do not hand-run a substitute symlink command here; there is one copy of that command and it lives in L0."* Circular. *Fix:* one sentence permitting L1's first boot from `erp/charters/L1.md`.

**NEW-3 — FATAL. `S3`'s predicate is unsatisfiable. Verified by execution.**
The final clause `if(JSON.stringify(p).match(/\d+\.\d+/)) process.exit(1)` matches `08.1` inside the mandatory `version: "2026-08.1"` that the same predicate asserts three clauses earlier. A perfectly correct 19-rule integer-only document exits 1. S3 is cut 0, position 5 of 12 on the critical path, 3.0 h. *Fix:* strip the version field before the decimal scan.

**NEW-4 — QA's replacement coverage check can never pass. Verified by execution.**
`comm -23 <(node -e "…nodes…map(n=>n.id)…") <(ls tests/acceptance | cut -d. -f1 | sort -u)` — the left side is node ids, the right side is *feature* filenames (`launcher`, `banner`, `session`). Built a tree with all 16 acceptance files the graph actually produces: the check prints **all 62 node ids**. QA's charter says it "must print nothing." The old check was vacuously green; this one is vacuously red.

**NEW-5 — V1's day contradicts itself across three documents.**
`graph.json` V1.notes and V5.notes both say *"This runs on **Day 1**"*; RISK.md §4 says *"`V1` runs on Day 1"*; PLAN.md's day table puts V1 on **Day 2**. RISK.md's Day-1 23:59 trigger — *"`V5` is not up, or `V1` has not run against it"* — therefore fires by construction against the authority's own schedule, on a cut-0 human-gated node that gates three contingencies.

**NEW-6 — `erp/contracts/**` and `contracts/**` are both live for the same eight frozen schemas.**
The eight files are on disk at `erp/contracts/`. `CONTRACTS.md` addresses them as `erp/contracts/**` throughout (incl. the G5 ownership check at §860). L0's outputs, S10's freeze, G6's accept and PATHS.md §2.4 all use `contracts/**`. `file_ownership` keeps *both* globs. PATHS.md §6 marks only the *plural* `erp/contracts/violations.schema.json` dead, leaving the singular — the file that exists — unaddressed. Nothing says whether L0 moves, copies, or duplicates.

**NEW-7 — `V5` still has no host, account or domain.** FACTS §6 decides Render for D1 only. V5 is cut 0, Day 1, and gates V1.

**NEW-8 — three cut-0/cut-1 nodes are scheduled before their predicates can hold.** `F6` (Day 1) requires "a CSS selector matching at least one element on the **built page**" — F1 is Day 2, F4/F5 Day 3, F2 Day 4 (legal only because those edges are soft). `T4` (Day 1) asserts "in every one of the SIX canonical states", which need F1 (Day 2). `H5` (Day 0) has **no hard path to L0** yet runs `node --test`, which needs L0's tree.

**NEW-9 — `V0` is dead work as scheduled.** V0 is Day 3; both its consumers precede it — H5 Day 0, V6 Day 2. V6 can only ever record V0 as UNVERIFIED.

**NEW-10 — minor.** `G0 --check-accept-paths` exits 1 on the graph as shipped (T5's `./artifacts/tools.export.json` vs the output `artifacts/tools.export.json`) unless the checker normalises `./`. `E5`'s `node --import webmcp-eval-kit/test/no-net.mjs …` throws `ERR_MODULE_NOT_FOUND` — a bare relative specifier needs `./` (verified). Three tests named inside the frozen schemas S10 freezes (`tests/policy-lock.test.mjs`, `tests/signature.test.mjs`, `tests/fix-lint.test.mjs`) are produced by no node and absent from PATHS.md. `G3` (Day 1) clones a repo verified `private` today, with no `G1→G3` edge and no scheduled push. `cut_ladder[4].agent_hours_freed: 15.5` is horizon-B hours where ranks 1–3 are horizon-A. `G6`'s "known correction" note points at a `canonical_bytes` value already corrected in the file. PLAN's day table breaks the graph's own 6 h/seat assumption three times (I3 8.0 on Day 2, I1 6.5 Day 2, I1 7.0 Day 3). `graph.json.falsification[9]` — *"Any document in erp/ restates a node table … instead of quoting"* — fires today against GRAPH.md, EVAL.md §4, PLAN.md §6.3 and RISK.md §7.1; all four reproduce exactly, but nothing in `G0` checks them, so the agreement is hand-maintained.

---

## Day-1 simulation

Walking `PLAN.md` §0 read order, then §6.3 Day 0 (L0, H5) and Day 1 (G0 G4 H1 S11 T6 G3 F0 G1 S10 V5 H2 S1 T1 F6 G5 G6 T4):

1. L1 cannot boot — charter lives behind the symlink only L0 creates (NEW-2)
2. L0 gate (2) `npm ci` fails on a clone made before the commit (NEW-1, reproduced)
3. L0 gate (4) `grep -q "reasoning effort: $want"` — `$want` is prose, unbound in the loop
4. H5 scheduled Day 0 with no hard input, accept needs L0's tree (NEW-8)
5. D-17 due "Day 0 before any seat is dispatched", but `erp/DECISIONS.md` is a V6 output (Day 2) and Day 0 has no PM node
6. G3 clones a repo verified private, no `G1→G3` edge, no push scheduled
7. F6 on Day 1 needs a page that arrives Day 2–4 (NEW-8)
8. T4 on Day 1 needs six canonical states that need F1, Day 2 (NEW-8)
9. V5 has no named host, account or domain (NEW-7)
10. V1 is Day 1 or Day 2 depending on which authority you opened (NEW-5)
11. V1's accept is a literal `node -e "..."`
12. `ajv` is required by S10 and G6 on Day 1 but named only in G6's *notes*, never in L0's contract; not installed
13. `G0 --check-accept-paths` exits 1 on the shipped graph (NEW-10)
14. QA's coverage check prints 62 lines on a perfect tree (NEW-4, reproduced)
15. The eight frozen schemas exist at `erp/contracts/` while S10 freezes `contracts/` (NEW-6)
16. S10 freezes contracts naming three test files no node produces

**16 hard stops, down from 22.** The character changed more than the count: the prior 22 were structural (a graph that disagreed with itself in four documents), and 12 of these 16 are one-line fixes or same-day PM rulings. Nothing on this list requires re-deriving the graph.

---

**VERDICT: NOT-EXECUTABLE — 16 hard stops, down from 22; the graph itself is now sound (68 nodes, 117 edges, acyclic, every number reproduces, zero cross-document disagreement), and the blockers are four one-line defects on cut-0 nodes — L0's clone-before-commit, L1's boot circularity, S3's self-defeating decimal regex, and QA's inverted coverage check — plus twelve same-day rulings.**