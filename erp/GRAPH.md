# outpocket — Execution Graph

> **This file is not an authority.** `erp/graph.json` owns node identity, owner, inputs,
> outputs, accept, hours, cut and horizon. `erp/PATHS.md` owns every literal path, filename
> and command name. This file is the *human view* of those two: every table below is copied
> from them, never re-derived. **On any disagreement, the authority wins and this file is
> regenerated, not argued with.**
>
> Regenerated 2026-08-28 from `graph.json` **v2.3.0** (68 nodes, 121 edges — 110 hard and
> 11 soft — 62 nodes horizon A, 118.0 agent-hours). Sprint A deadline **2026-09-03 13:00 PT**
> (~5.5 days). Track B is everything after that date.
>
> **Every table in this file is GENERATED and CHECKED, not typed (R-22).** §2's lane tables
> restate `graph.json` on six columns — id, title, owner, inputs, hours, cut — and
> `node tools/ready.mjs --check-tables` (G0) diffs all 68 rows against the authority field by
> field. **A restatement is legal in this project only while that checker is green.** The
> seventh column is an *accept gloss*: prose, deliberately abbreviated, **not** a copy of the
> predicate and never authoritative. The predicate lives in exactly one place, `graph.json`,
> and this file does not hold a second copy of any command. Where a gloss and the authority
> disagree, the gloss is a bug in this file.
>
> **This file holds no day table.** Which day a node runs on is owned by
> `graph.json.capacity.schedule_A` and restated only in `PLAN.md` §6.3.
>
> **Id-collision warnings, quoted from `graph.json.id_collision_warnings`:**
> - The D-lane node ids `D1`–`D6` are **not** days. Calendar days are always written
>   "Day 1"…"Day 6" in prose.
> - The five open unknowns are keyed **`V0`–`V4`** and are answered by the V-lane nodes of the
>   same name. `HANDOVER.md` §10 keyed them `T0`–`T4`; that numbering is **dead**. `T1`–`T4`
>   are live tool-surface node ids and are unrelated to any unknown.
> - The six canonical application **state** ids are `S0-anon`, `S1-emp-home`,
>   `S2-emp-draft-clean`, `S3-emp-draft-dirty`, `S4-emp-submitted`, `S5-aud`, always written
>   with the hyphenated suffix. The bare ids `S1`…`S6` are **server-lane node ids**.
> - Lane E node ids run `E1`–`E10`. `E8` is the C1 blind grading **run**; `E9` is the C3
>   red-team report; the mutation check that an earlier private table called `E8` is **`E10`**.
> - The atomic sign lock that an earlier private table called `S10` is **`S12`**. `S10` is the
>   contract freeze, owned by L1.

---

## 1. The eight graph-engineering principles, and where each one bit

These are not decoration. Each one changed the shape of the graph below, and the post-audit
repair is what happened when the graph was checked against them for a second time.

**1. A node is the smallest unit that carries its own mechanically checkable acceptance predicate.**
Applied: every one of the 68 nodes has an `accept` field that is a shell command, a named test,
or a file-existence-plus-content assertion. Where the check could not be written, the
requirement was not written — which is why there is no node called "polish the UI".
**Where it bit, twice.** (a) Sixteen accept predicates named a script that no node produced —
four of them at cut rank 0, and the last node in the graph, `D6`, terminated on
`tools/freeze-check.mjs`, which nobody was assigned to write. Every one now has a producing
node and the hours are funded there (`+0.5 h` on each of V0 V4 V6 H1 H5 F2 F5 F6 E7 S10 D2 D3 D6).
(b) Four predicates were not predicates at all: `V1` had no command, `D4` graded "names a
mechanism, not a feature" by human judgement on the single most expensive node in the plan,
`D5` checked "zero retracted claims" against a register that did not exist, and `E6` asked for
"a green run visible on the Actions tab", which is a person looking at a web page. All four are
now commands.

**2. An edge is a frozen artifact, not a feeling.**
Applied: all 121 edges carry a `contract` naming the file that crosses them.
**Where it bit, and it bit again this revision.** Three hard edges were missing and their absence was invisible: `F1→T2`,
`S1→T2` and `S4→T2`. `T2`'s predicate drives a real page (only `F1` produces
`src/page/index.html`), served by a real server (`S1`), and introduces a real blocking violation
(only `S4` produces one) — so `T2` had been scheduled against three artifacts that did not exist
yet. Drawing those three edges is what moved the critical path off the T lane and through the
S lane, and it was the single largest correction of the previous revision.
**Two more were missing and v2.1.0 draws them.** `G1 → G3`: G3 clones
`https://github.com/Caleb0796/outpocket` over anonymous HTTPS and the repository is private
today (MEASURED), so without G1 that clone fails on authentication rather than on tests.
`L0 → H5`: H5's accept runs `node --test`, which needs L0's `package.json` and test tree, and
H5 had **no hard path to L0 at all** while being scheduled on the same day as it. Both edges
are the same class of defect as the first three — a node scheduled against an artifact that
did not exist — and neither was visible until the schedule became an authority a checker could
walk (§4.4).

**3. Exactly one owner seat per node, enforced by file paths.**
Applied: `graph.json.file_ownership` maps every glob to exactly one seat, and `G0` ships
`tools/check-ownership.mjs` so a violation is detectable from a file list.
**Where it bit.** The glob-only rule mechanically rejected **23 of the graph's own node
outputs**, including nine files under `tests/acceptance/**`. The rule is now stated once, in
`graph.json.conventions.ownership_rule`, and quoted verbatim in §7: a node's own `outputs`
beat the glob. Separately, lane E previously existed twice with two different owners for `E4`;
one lane E now exists, and `E4`'s owner is **L2**.

**4. The critical path is COMPUTED, never asserted.**
Applied: §4 shows the arithmetic. The computed answer — **29.5 h** through
`L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6` — is again not the path anyone
guessed, and in v2.3.0 it changed **without a single estimate moving**: two hard edges were added
and the head of the path rerouted. That is exactly why it is computed and never asserted. The previous revision published 19.5 h; the executability audit predicted 22.5 h via
`T6→S10→S1→F1→T2`. Both are wrong, and for instructive reasons, recorded verbatim in §4.1.

**4b. And the schedule is computed too, which is new.** `graph.json.capacity.schedule_A` is
now an authority block with its own calendar, day lists and `verified` line, and
`node tools/ready.mjs --check-schedule` proves `day(u) ≤ day(v)` on every hard edge and that no
seat exceeds `capacity.seat_day_hours_cap`. **Where it bit, four ways.** `V1`'s day disagreed
across three documents, so a RISK trigger fired by construction against the plan's own
schedule. `V0` was scheduled *after* both of its consumers — dead work by arithmetic. `F6`,
`T4` and `H5` were each scheduled on a day their predicates could not hold. And the day table
broke the graph's own 6 h/seat/day assumption three times while quoting that same figure to
justify that same agent-capacity total. **All four were fixed on the schedule side, never on the
assumption side.**

**5. Cut sets are declared in advance with a rank; cutting deletes a whole subgraph.**
Applied: §5, and the invariant `key(u) ≥ key(v)` on every hard edge with rank 0 counting as
infinity. **Where it bit.** The classic error was present and had been *relocated out of the
edge list where the checker could not see it*: the freeze table declared `F6` (cut rank 1) as
unblocking `D4` (cut rank 0, human-gated, 4.0 h) with **no edge between them**, so firing rank 1
deleted the storyboard shot ids the video could not start without, invisibly. `F0` (cut 0) now
authors `docs/STORYBOARD.md` and `docs/VIDEO-SCRIPT.md`, both edges are drawn hard, and `G4`
moved from cut 1 to cut 0 for the same reason — `D5` and `D4` both grade against artifacts `G4`
produces. §5 also retracts a fabricated claim this file made last revision; see there.

**6. The ready set is recomputed each morning.**
Applied: §8. **Where it bit.** `tools/ready.mjs` — the tool the graph is *operated* with — was
an output of `G5` at **cut rank 1**, and the previous revision's own Day-1 recommendation was
to fire rank 1. It is now produced by `G0` at cut 0. Until `G0` is green the procedure runs by
hand; §8 says how.

**7. Interface freeze precedes parallelism.**
Applied: this is why `S10` exists. `webmcp-agent-team.md` names `erp/contracts/violation.schema.json`
as the *only* strong coupling between I2 and I3 and states that parallelism before the freeze is
fake. **Where it bit hardest.** That filename was spelled **`violations.schema.json`, plural, in
29 references across 7 files** — including `S10`'s own freeze predicate, the third node on the
critical path. Every one of those commands would have failed on a missing path, forever. The
file is **`erp/contracts/violation.schema.json`, singular** (`PATHS.md` §1). §6 lists all five
freezes, and every `unblocks` id is now a node with a hard edge from its `frozen_by`, which is
an assertion (`tools/ready.mjs --check-freezes`) rather than a hope — three of the five entries
previously failed it.

**And the directory is `erp/contracts/`, with exactly one glob (R-17).** `erp/contracts/**` and
a bare `contracts/**` were both live for the same files, which is how CONTRACTS.md
addressed them at one path while L0, S10, G6 and PATHS.md addressed them at another, and
nothing anywhere said whether L0 moved, copied or duplicated them. **It does none of those:**
the contract files are pre-existing planning artifacts, they stay where they are, no node lists
one as an output, and S10 *freezes* them in place. 51 references were repointed and the bare
glob is deleted.

> **R-28 — "eight frozen schemas" is dead vocabulary and this file no longer uses it.**
> `erp/contracts/` holds **eight contract FILES**, of which **six are `*.schema.json`**
> (`violation`, `policy`, `eval-case`, `signature`, `provenance`, `tool-export`) and **two are
> frozen data documents** (`canonical-vectors.json`, `policy-versions.json`). The count is also
> stale from Day 0 in the other direction: **V5 adds a ninth contract file**,
> `erp/contracts/probe-verdict.schema.json`, on Day 0. Predicates therefore say **"every
> `*.schema.json` in `erp/contracts/`"** and never a number. Every site in this file that
> carried the phrase — the lane-G table, §5.2, §6 and §9 — is rewritten below.

**8. A restated table is legal only while a checker proves it equal to the authority (R-22).**
This is the rule aimed squarely at this file. The previous falsification entry forbade
restatement outright — and therefore fired against GRAPH.md, EVAL.md §4, PLAN.md §6.3 and
RISK.md §7.1, four of the graph's own siblings, while nothing checked any of them. All four
reproduced exactly under re-verification, which is the *worse* outcome: the agreement was
hand-maintained, and a decorative rule is exactly how seven writers each came to hold a private
copy of the node table. `G0` now ships `--check-tables`, and the rule says so.

---

## 2. Lane tables

**Generated from `graph.json.nodes`, checked by `node tools/ready.mjs --check-tables`.** The
first six columns — id, title, owner, inputs, h, cut — are a field-by-field restatement of the
authority and were re-verified by execution for this revision: **68 of 68 rows identical.**

The seventh column is a **gloss**, and the header says so on every table. It is prose written
for a human skimming a lane; it is abbreviated, it is not diffed by anything, and it is **not**
a copy of the acceptance predicate. **There is exactly one copy of every command in this
project and it is in `graph.json`.** If you are about to run something, open the node's
`accept` field, not this column. Where the two disagree, the gloss is the bug.

Hours are agent-hours for the owning seat, including the seat's own test-writing **and the
acceptance tooling its accept predicate invokes**. `cut` 0 = never cut. Inputs marked `(soft)`
are soft edges: they never block, and the consumer records the absence. Every path named in any
predicate is listed in `PATHS.md`.

### Lane L — Launch (Day-0 bootstrap)

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| L0 | Day-0 bootstrap: repository, .team tree, Codex profiles, ported spike | L1 | — | 3.5 | 0 | **seven** gates, **in this order, and the order is load-bearing**: **(1) PM ruling D-17** — `erp/DECISIONS.md` is created here on Day 0 with the `human_hours_per_day = 2.5\|3.0` row, and the gate proves `capacity.human_hours_available` == that figure × 5.5 (the ruling decides whether 27 of 62 horizon-A nodes exist and was previously due into a file V6 would not produce until Day 2); **(2) port, and `package.json`'s `scripts` block concretely** (`"test": "node --test"` with no path arguments; `npm test -- <name>` is **not** a filter and no predicate may use it — R-23) plus `node --test tests/*.test.mjs` = 24 tests, exactly 1 failure, and it is the known red `auditor surface: read-only by construction`; **(3) team tree** (`ls .team/charters \| wc -l` == 16); **(4) profiles** (R-3, with `$want` bound by the loop); **(5) dependencies, then commit** (`ajv` declared, `npm install`, `git commit`); **(6) push** (`git push -u origin HEAD:main`, then local `HEAD` == `git ls-remote origin refs/heads/main` — the **first** push, and the only one any node's accept performs, but **not** the only push: L1 pushes every merge to main as a standing obligation, which is how T6's fix reaches `origin` for G3 — and `origin/main` is still the three-file initial commit today); **(7) lockfile from a clone of the pushed remote, asserting the ONE KNOWN FAILURE BY NAME, not exit 0** (`git clone https://github.com/Caleb0796/outpocket /tmp/l0 && npm ci`, then `npm test` reports **24 tests, exactly 1 failure, `auditor surface: read-only by construction`** — R-26(a): the old wording demanded exit 0 of the very commit gate (2) declares carries one failing test, so the first node of the sprint failed itself) |

L0 is **the head of the critical path**, and it is 3.5 h rather than 3.0 because `erp/RUBRIC.md`
became one of its outputs (R-16). MEASURED 2026-08-28: outpocket tracks exactly `.gitignore`,
`LICENSE` and `README.md`; `ls ~/.codex/*.config.toml` returns no matches; `erp/` is entirely
untracked. Four of sixteen seats could not boot and the first node in the graph could not run its
own accept. L0 also commits `erp/PATHS.md` and `erp/graph.json`, because a seat working in a
worktree must have both authorities.

**The gate order is the fix, and it is load-bearing (R-15).** The previous accept cloned the
repository in gate (2) and committed in gate (5), so `npm ci` ran against a clone of a tree
tracking three files and reproduced `npm error code EUSAGE … can only install with an existing
package-lock.json` — **the exact error this node exists to eliminate, reproduced by execution
during re-verification.** The commit is now gate (4) and the clone is gate (5). Gate (3)'s
profile loop also had `$want` written as unbound prose and could never have run; it is bound by
the loop now. Gate (4) declares `ajv`, which S10, G6 and V1 all invoke on Day 1 and no other node
declared.

**L1's first boot is the one permitted exception to the symlink rule (R-15).** `.team/charters`
is a symlink L0 itself creates, so L1 could not read `.team/charters/L1.md` before running L0 —
circular, and fatal on Day 0. **L1's first boot, and only its first, reads `erp/charters/L1.md`
directly.** Every later boot and every other seat uses `.team/charters/`. That sentence stands
here, in `L0.notes` and in `TEAM.md` §1, and it is the only substitute-path instruction anywhere
in this project.

**R-17: the contract files are pre-existing planning artifacts at `erp/contracts/`.** L0
does not move, copy or re-author them. It commits them where they are, and no node anywhere
lists one as an output.

### Lane G — Ground (instrumentation, hygiene, disqualification-level compliance)

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| G0 | Graph instrumentation: tools/ready.mjs and tools/check-ownership.mjs | L1 | L0 | 2 | 0 | **seven** subcommands exit 0: `--check-cuts`, `--path` (total equals `capacity.graph_depth_hours`), `--check-accept-paths` (the **tokenizer is specified in the accept**, in five steps, because exit 0 vs 1 used to turn on an unstated one: non-`[A-Za-z0-9_./*$~@+-]` → space, split on whitespace, strip trailing `./-` then one leading `./`, candidate only if the basename carries an extension, and a candidate with no `/` resolves only as an output basename. Four declared **discard** classes — absolute, glob-bearing, `$`-bearing, and not-a-path/bareword — then an exemption list of **eight** entries: the **six** contract files some accept actually names, `erp/charters/C3.md` and `countinghouse/src/policy.js` in the sibling spike checkout. `provenance.schema.json` and `tool-export.schema.json` were **dropped**: no accept names them, and an exemption nothing uses is a licence waiting for a mistake. Both lists are printed. **Run 2026-08-28: 179 resolved, 19 exemption hits, 0 unresolved, exit 0**), `--check-freezes`, `--check-ownership-globs`, **`--check-tables`** (every restated node table and day table in `erp/**.md` diffed against `graph.json` and `capacity.schedule_A`) and **`--check-schedule`** (`day(u) <= day(v)` on every hard edge; no seat above `seat_day_hours_cap`) |
| G1 | Flip both repos public with a root LICENSE visible in the GitHub About box | I4 | — | 0.5 | 0 | for **both** `Caleb0796/outpocket` and `Caleb0796/webmcp-eval-kit`: `gh api repos/$REPO -q '.visibility + " " + .license.spdx_id'` lowercases to exactly `public mit` |
| G2 | README with two plaintext demo credentials and both ways to open the app | I4 | F1 | 1 | 0 | `tests/acceptance/readme-credentials.test.mjs`: every `login:` line POSTs to the live `/api/login` and returns 200; roles covered == {employee, auditor} over exactly **two** logins; README carries both the built-in-browser path and the literal `--enable-features=WebMCPTesting` |
| G3 | Green npm test from a clean clone | QA | T6, L0, G1 | 1.5 | 0 | clone to `/tmp/oc`, `npm ci --prefix`, run the suite with the redirect taken **in the repository root** (a `tee` after `cd /tmp/oc` wrote the evidence file where nothing reads it); **0 fail** over ≥24 tests, **and** the clone's `HEAD` equals the working tree's, proving it is not a stale `origin/main`. R-26(c): zero failures holds only after **T6** is merged **and L1 has pushed that merge** — which is why T6 is a hard input, and why L0 gate (7) asserts the exact opposite (one named failure) of the pre-T6 bootstrap commit |
| G4 | Layer-0 lint hook: banned identifiers, description budget, banned wording, retracted claims | I4 | L0 | 1.5 | 0 | exits 0 over the repo, exits 1 on `tests/fixtures/banned-sample.js` naming every planted violation, `--selftest` exits 0, **and `--assert-register` exits 0** proving `kb/webmcp/RETRACTED.txt` carries five literal strings this project asserted and lost the right to assert — `structural guarantee` · `the five write tools` (R-20) · `a specific agent` (R-21) · `a commit cannot be made without a human decision` (R-13) · `the tool surface is the boundary`; the exclusion list is a **literal array in the source**, never satisfied by deleting quotes |
| G5 | File-ownership pre-commit hook | L1 | G0 | 1 | 1 | two **fixture** invocations (`--files-from tests/fixtures/ownership-ok.txt` → 0, `…-bad.txt` → 1 naming the path) AND `git config core.hooksPath` prints `.githooks` |
| G6 | Contracts conformance runner over every schema in erp/contracts/ | QA | L0, S10, S11, V5 | 2 | 1 | `tools/contracts-check.mjs` exits 0: ajv-2020-12 over every `*.schema.json` in **`erp/contracts/`** (the `.md` contracts carry no schema and are covered by the `FREEZE.md` sha256 instead), each schema's `examples` validated against itself, every published digest **and** `canonical_bytes` recomputed byte-exact with `src/canonical.js`, every tool name in `erp/contracts/tool-surface.contract.md` resolving — **and CONTRACTS.md §11 check 3b, which is this node's real catch (R-29)**: run the frozen policy (`policy.schema.json` `examples[0]`) over the frozen snapshot (`signature.schema.json` `examples[0].snapshot`) and assert the computed verdict equals the carried one in `blocking`, `warning` and the identifying quadruples. The `canonical_bytes` catch this node used to advertise is **stale — 2458 and 2457 both recompute correctly**. It fails loudly on a digest mismatch rather than printing the recomputed value |

**G4 moved from cut 1 to cut 0.** `D5` (cut 0, human-gated, the submission itself) runs
`tools/lint-layer0.mjs docs/DEVPOST.md` and greps `kb/webmcp/RETRACTED.txt`; `D4` greps
`kb/webmcp/MECHANISMS.txt`; `F0` lints the storyboard. Three cut-0 artifacts were produced by a
cut-1 node with no edges, so `--check-cuts` could not see it. Hard edges `G4→F0` and `G4→D5` now
exist. G4 authors `kb/webmcp/BANNED.txt` **itself** — it does not depend on K1, a seat with no
nodes and no hours.

**G6's scope is `erp/contracts/` and only that (R-17).** It ajv-validates every `*.schema.json`
there against its own `$schema`; the `.md` contract files carry no schema and are covered by the
`erp/contracts/FREEZE.md` sha256 check instead. It recomputes every published digest **and
`canonical_bytes`** with `src/canonical.js` and **fails loudly on a mismatch rather than printing
the recomputed value** — the difference between a conformance runner and a value-updater. *(The
`canonical_bytes: 2458` discrepancy the previous revision warned about here was corrected in the
authority; independent from-scratch recomputation of all seven canonical vectors and five
republished digests reproduces the shipped figures.)*

### Lane V — Verification (the five unknowns `V0`–`V4`; highest information value per hour)

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| V0 | navigator.modelContext alias status on the INSTALLED Chrome major | I1 | L0 | 1 | 1 | `harness/probe-v0.mjs` writes `evidence/V0.json` = `{chromeMajor, flag, headless, navigatorAlias, documentPresent, toolCount, cdpDomainEnabled, invokeToolRoundTrip, method:'cdp'}`; every boolean from CDP `Runtime.evaluate` on a live page, never a UA string. **The launch must carry the flag** — with none, `document.modelContext` is `undefined` headed *and* under `--headless=new`, so a flagless probe measures the flag, not the alias. `headless` is **recorded, not constrained**. `toolCount` is `(await getTools()).length` — the **await is load-bearing**. `cdpDomainEnabled` is **recorded and never asserted on**: `WebMCP.enable` returns OK with no flag and no page API at all. Only `invokeToolRoundTrip` discriminates |
| V1 | document.modelContext presence in the ChatGPT built-in browser on a plain HTTPS origin | I1 | V5 | 2 | 0 | **mechanical first, a real command and not an ellipsis:** a `node -e` that ajv-compiles `erp/contracts/probe-verdict.schema.json` and validates `evidence/V1.json` against it, plus `test -s evidence/V1.png`. **human second:** QA re-reads the screenshot against the JSON. Both gates required; the human read is never the only one |
| V2 | Does the built-in browser refresh the tool list mid-session | I1 | V1 | 1.5 | 3 | `evidence/V2.json` records the before/after tool-count pair taken without a reload plus the wall-clock gap; `verdict` ∈ {`refreshes`, `does-not-refresh`, `refreshes-on-next-turn`}. QA countersigns the raw observation pair, not the label |
| V3 | Does an agent-initiated tool execute carry the page's session cookie | I1 | V1 | 1.5 | 3 | `evidence/V3.json` records the probe's `GET /whoami` body as fetched from inside an execute and whether it equals the page's own; `verdict` ∈ {`same-session`, `no-cookie`, `different-session`} |
| V4 | Does a suspended execute time out in the built-in browser | I1 | V1 | 1.5 | 3 | two independent runs write `evidence/V4-run1.json` and `-run2.json`; then `harness/compare-runs.mjs … --tolerance 0.20` exits 0 and writes `evidence/V4.json`; >20% disagreement exits 1 |
| V5 | Throwaway HTTPS probe origin with a cookie-echo endpoint | I1 | L0 | 1.5 | 0 | `curl -sI $(cat evidence/V5-origin.txt)` returns 200 over https AND the Origin-Agent-Cluster check passes (`grep -i '^origin-agent-cluster:' … \| grep -q '?0' && exit 1; exit 0` — absent, or present with a value that is **not** `?0`); the page registers exactly 5 tools, one never resolving, and exposes `GET /whoami` |
| V6 | Unknowns verdict and fallback election | PM | V0 (soft), V1, V2 (soft), V3 (soft), V4 (soft) | 1.5 | 0 | `tools/check-unknowns.mjs` exits 0: `evidence/UNKNOWNS.md` has exactly 5 rows keyed **V0, V1, V2, V3, V4**, each ending in the literal `MEASURED` or `UNVERIFIED`, and every `UNVERIFIED` row names an existing node id from `graph.json` as its fallback |

**V1 is the highest-variance node in the graph.** If `document.modelContext` is absent on a plain
HTTPS origin, judges see a page with zero tools while every local test stays green forever. It is
human-gated: the ChatGPT desktop built-in browser cannot be driven by CDP (MEASURED, HANDOVER §3
rule 8), and it needs GPT-5.6 Sol or Terra because Luna disables WebMCP. **It runs on Day 1
against V5's throwaway origin — not against the production deploy and not against localhost.**
Any trigger anywhere that fires because V1 has not run against production is wrong and must name
V5. Its day is owned by `capacity.schedule_A`, which says **Day 1**; the previous revision had it
on Day 1 here, Day 1 in RISK.md and **Day 2** in PLAN's table, so RISK's Day-1 trigger fired by
construction against the plan's own schedule. Its predicate also carried a literal
`node -e "..."` — an ellipsis standing in for the only mechanical check on the node that gates
three contingencies. It is a command that executes now.

**V5's host is named (R-18):** a **free Render Web Service** on a `*.onrender.com` subdomain, in
the same Render account D1 uses, created and deleted inside Sprint A. It must be a Web Service
and not a Static Site, because `GET /whoami` has to echo a cookie. `onrender.com` is on the
public suffix list (MEASURED, HANDOVER §3 rule 14) and **that is irrelevant here** — V5 mints no
origin-trial token; D2 is the only node that ever wanted one. The free tier's 15-minute sleep is
harmless: V1–V4 are attended, interactive, single-sitting probes. V5 runs on **Day 0**, the
evening L0 lands, so the origin is up before the human opens the built-in browser.

**V0's question changed (R-8).** MEASURED 2026-08-28: the installed browser is Google Chrome
**152.0.7977.64**. The question is what the alias does on **152**, the installed major — not
whether it survives on 151, which is not present on this machine. Build against the current
version and demand an upgrade only if something actually breaks.

**V6's register is keyed `V0`–`V4`.** It used to be keyed `T0`–`T4`, so "every `UNVERIFIED` row
names an existing node id" passed by accident on four rows — `T1`–`T4` are live tool-surface
nodes — and could never pass on the fifth, because `T0` exists nowhere. Only V1 is a hard input;
V0/V2/V3/V4 are soft, which is exactly why V6 is rank 0 while V2–V4 are rank 3.

### Lane H — Harness

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| H1 | Chrome launcher with the right flag per scenario | I1 | L0 | 1.5 | 0 | `tests/acceptance/launcher.test.mjs`: `--scenario cdp --print-flags` prints `--enable-features=WebMCP` and **not** `WebMCPTesting`; `--scenario manual` prints `WebMCPTesting`. **This is a HOUSE RULE about our configuration, not a claim about the browser** — see below |

> **The carried-over rule that "the flag name differs by scenario" is SUPERSEDED.** MEASURED
> 2026-08-28 by the session owner, Chrome 152.0.7977.64, `--headless=new`, a clean dedicated
> `--user-data-dir` per launch, page over `http://localhost`:
>
> | launch | `typeof document.modelContext` |
> |---|---|
> | no flag | `undefined` |
> | `--enable-features=WebMCP` | `object`, `registerTool` succeeds |
> | `--enable-features=WebMCPTesting` | `object`, `registerTool` succeeds |
>
> `FACTS.md` IR-16(a) is **CONFIRMED: the two flag names are interchangeable.** What survives is
> our own convention — `--scenario cdp` emits `WebMCP`, `--scenario manual` emits
> `WebMCPTesting` — so that a launcher log says which scenario produced a run. A graded run made
> under the other name is an **unlabelled** run, not a broken one. What is still worth H1's 1.5
> hours is the failure mode with **no** flag: a silently toolless page and hours of false
> debugging. (`FACTS.md` IR-16(b), "`--headless=new` enables WebMCP with no flag", is **false**
> and retracted: no flag is `undefined` in every launch, headless and headed alike.)

| H2 | CDP driver: enumerate tools, execute a tool, assert on the result | I1 | H1, V5 | 3 | 0 | **first hour, gating everything else — now a REGRESSION gate, six clauses:** (i) the flag is on the launch (with none, `document.modelContext` is `undefined`); (ii) `getTools` and `executeTool` are both functions; (iii) a 1-tool page yields **`(await getTools()).length === 1`** — the await is load-bearing, `getTools()` is a **Promise**, and `!== 0` may not be substituted because it passes against an empty surface; (iv) `WebMCP.enable` returns OK — **recorded, never asserted on**; (v) one `WebMCP.toolsAdded` names the tool; (vi) one **`WebMCP.invokeTool` round trip** whose `toolResponded` carries `status: 'Completed'`. `evidence/H2-reachability.json` records the launch too — `{chromeMajor, flag, headless, pageApiReachable, toolCount, cdpDomainEnabled, invokeToolRoundTrip}` — and **only the round trip decides**, because `WebMCP.enable` returns OK in a launch with no page API at all. `headless` is **recorded, not constrained**. **then:** `--list` prints 5 names exit 0; `--exec whoami` prints a content block, driving `WebMCP.invokeTool` by name and never `executeTool(name, args)`; `--exec no_such_tool` exits 2 |
| H3 | In-page fallback agent (getTools + executeTool self-drive) | I1 | T2 | 2.5 | 0 | `harness/drive.mjs --fallback --scenario happy` under `--disable-features=WebMCP` completes the 1→5→12→13 walk, exit 0 |
| H4 | Deterministic demo mode and fixed seed | I1 | S9 | 1.5 | 0 | two `--dump-state` runs of `?demo=1&seed=7` are byte-identical (`diff` exits 0) |
| H5 | Environment probe and first-screen banner | I1 | L0, V0 (soft) | 1.5 | 0 | `tests/acceptance/banner.test.mjs`: banner matches `/^Chromium \d+ · WebMCP (present\|absent)( · simulated agent)?$/`, and a Chromium major below 153 additionally renders `[data-warn="chrome-lt-153"]` |
| H6 | Unattended two-minute rehearsal rig | I1 | H2, H3, H4 | 2 | 0 | `harness/rehearse.mjs --runs 5` exits 0; `evidence/rehearsal.json` shows 5/5, each under 120 s, with per-step timings |

**H2's reachability question is ANSWERED, and the hour is now a regression gate.** It used to ask
whether `getTools`/`executeTool` were agent-side and absent from page JS under the graded flag —
which would have left lane E with no admissible mode. MEASURED 2026-08-28 on Chrome
152.0.7977.64: both are functions, both work, and **the two flag names are interchangeable**, so
that outcome did not happen. What *did* go wrong was smaller and still worth the hour: the
corpus's calling convention was wrong on every count, and the channel `harness/drive.mjs`
actually executes through — the CDP **`WebMCP`** domain, `invokeTool`/`cancelInvocation`, events
`toolsAdded`/`toolsRemoved`/`toolInvoked`/`toolResponded` — was named nowhere in the plan.

**Two things in that gate read green when they are not, and both are written into the
predicate.** `getTools()` returns a **Promise**, so `getTools().length === 1` compares `undefined`
to `1` and can never hold — and `!== 0` must not be substituted, because it passes against an
empty surface. And `WebMCP.enable` returns **OK in a launch with no flag, no tools and no page API
at all**, so `cdpDomainEnabled` is a vacuous field that reads "on" when the feature is off; a probe
reading the CDP domain instead of the page API is exactly how `FACTS.md` IR-16(b) came to be
published. **Only a completed `invokeTool` round trip discriminates.** PM still hears a failure on
Day 1, not Day 4. H2 is built against V5's probe rather than the product, which is why I1 is seat 0
after L0: the driver is finished and trusted before T2 exists.

**H5's `chrome-lt-153` warning will render throughout the demo and throughout the video.** That
is correct and intended, not a defect to hide — HANDOVER §3 rule 7 (MEASURED) says revocation
does not interrupt a suspended execute below 153, and this banner is how that gap becomes
visible instead of mysterious. **H5 gained a hard input from `L0` in v2.1.0:** its accept runs
`node --test tests/acceptance/banner.test.mjs`, which needs L0's `package.json` and test tree,
and it had no hard path to L0 at all while sitting on the same day as it. `V0` stays soft — the
banner reads the Chromium major itself.

### Lane T — Tool surface

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| T1 | Port tools.js surface compiler into the page, top-level document only | I2 | S10, T6 | 2 | 0 | `node --test tests/surface.test.mjs` green AND `find src/page -name '*.js' -print0 \| xargs -0 node tools/check-toplevel.mjs` exits 0, finding zero `registerTool` call sites reachable from an iframe or worker entry |
| T2 | Real registerTool plus AbortController revocation, the 1->5->12->13 flips | I2 | T1, H1, F1, S1, S4 | 3 | 0 | `harness/drive.mjs --assert-flips 1,5,12,13` exits 0 against a real Chrome under `--enable-features=WebMCP`, calling `getTools()` after each transition; `submit_expense_report` must vanish from `getTools()` after a blocking violation is introduced **through the real policy engine** |
| T3 | Absence register: a resident read-only tool explaining why a tool is missing | I2 | T2 | 1.5 | 2 | `explain_missing_tool` present in all **six** canonical states (count == 1 per state) AND its body validates against `erp/contracts/violation.schema.json` with all of code/severity/field/fix/candidates |
| T4 | Description budget and annotations conformance | QA | T1 | 1 | 1 | `node --test tests/acceptance/conformance.test.mjs`, in all **six** states: every description ≤500; `annotations` keys ⊆ {`readOnlyHint`, `untrustedContentHint`}; zero `outputSchema` keys; every read-only tool carries `readOnlyHint: true` |
| T5 | Blind surface export for C1 and the eval-kit | I2 | T2, T3 (soft), S11 | 1 | 2 | `tools/export-surface.mjs` writes **six** states in canonical id order (asserted by a real `node -e`, no `./` prefix anywhere); two runs byte-identical; every `surface_digest` equals `digest('outpocket/surface/1', tools)` under OCF-1, recomputed independently; the export contains **only** name/description/inputSchema/annotations — no paths, no repo identifiers |
| T6 | Fix the red test: auditor surface read-only by construction | I2 | L0 | 1 | 0 | `node --test tests/surface.test.mjs` reports 0 failures, and the named test passes with the auditor set == {`get_day_book`, `get_expense_policy`, `get_open_report`, **`get_report`**, `get_session_scope`, `list_expense_reports`} |

T1, T3 and T5 are **ports**, not new code: `countinghouse/src/tools.js` is 401 lines and already
DOM-free (MEASURED). That is why T1 is 2.0 h and not 8.

**T6 is second on the critical path and encodes R-9, option (B), now ratified:**
`open_expense_report` genuinely writes state — it mutates `openReportId` and appends to the day
book — so it leaves the auditor surface entirely and is replaced by a side-effect-free
`get_report(report_id)`. Read-only must be constructive, not a hint the model is trusted to
respect. MEASURED 2026-08-28: `node --test tests/*.test.mjs` in countinghouse reports 24 tests,
23 pass, 1 fail, and the single failure is this test. The distinct-tool count is 15 before T6 and
16 after.

**Six states, not five.** The compiler at `countinghouse/src/tools.js:343-354` produces
`S0-anon` 1, `S1-emp-home` 5, `S3-emp-draft-dirty` 12, `S2-emp-draft-clean` 13,
**`S4-emp-submitted` 6** and `S5-aud` 6. The submitted state is precisely the one that motivates
**set** equality over count equality — it and `S5-aud` both carry 6 tools and differ by exactly
one name — and it was missing from every count in the previous revision. A five-state export
cannot express it.

### Lane S — Server

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| S11 | OCF-1 canonicaliser and the seven-vector suite | I3 | L0 | 2 | 0 | `node --test tests/canonical.test.mjs` exits 0: all **seven** vectors in `erp/contracts/canonical-vectors.json` reproduce byte-for-byte, including the provenance vectors v6/v7. Recursive **codepoint** key sort (never `localeCompare`), NFC strings, integers only, `digest(kind, value) = sha256(kind + "\n" + canon(value))`, with the carve-out permitting `$`-prefixed keys inside an `inputSchema` subtree |
| S1 | Single-file Node server with cookie session | I3 | S10 | 2.5 | 0 | `tests/acceptance/session.test.mjs`: `POST /api/login` sets HttpOnly SameSite=Lax; `GET /api/me` returns the persona with it and 401 without; exactly **two** personas, `chen` and `ruiz`, matching the frozen enum in `erp/contracts/eval-case.schema.json` |
| S2 | Per-request role authorization with curl-level privilege-escalation tests | I3 | S1 | 2 | 0 | `bash tests/acceptance/curl-403.sh` exits 0: every route in the server's exported write-route table returns 403 with a `code` field to an auditor cookie; the script fails if the table has a route it does not cover |
| S3 | Policy engine port, integer micro-USD FX, versioned policy document | I3 | S1, S11 | 3 | 0 | `node --test tests/policy.test.mjs` and `node --test tests/canonical.test.mjs` green with the migrated rates (both were `npm test -- <name>`, which is not a filter — R-23 — so this node believed it had two gates and had one whole-suite run twice) AND `node --test tests/policy-lock.test.mjs` re-pins the (version, digest, `canonical_bytes`) triple **and asserts the lock at server policy LOAD** — `server/routes/policy.mjs` recomputes the digest on load and **refuses to serve** a document whose `(version, digest)` pair is absent from `policy-versions.json`. **S3 owns the server-side policy-load lock**, the half of R-33 the contract left unassigned; **no hours move** — R-33 relocates a check S3's 3.0 h already carry, it does not add one AND `GET /api/policy` reports version `2026-08.1`, exactly **19 rules whose `id` fields are `R01`–`R19`** in order — `.id`, **not** `.code`, which carries the named string like `CAP_MEALS` and is checked against the frozen `^[A-Z][A-Z0-9_]{2,39}$`; the old predicate asserted `rules[i].code === "R01".."R19"` and was unsatisfiable against the pinned policy digest — and **no decimal number** anywhere once `version` and `effective_from` — the two date-shaped fields the document must carry — are deleted from a copy before the scan |
| S4 | Deterministic violation envelope on every write tool | I3 | S3, S10 | 1.5 | 0 | `tests/acceptance/envelope.test.mjs`: every write-route error body validates against `erp/contracts/violation.schema.json` with all of code/severity/field/fix/candidates; same input → byte-identical envelope twice. AND `tests/fix-lint.test.mjs` implements the substring lint the schema declares in `x-fixLint`, rejecting the schema-valid instance the contract files under `x-invalidExamples` — no JSON Schema keyword can catch it |
| S5 | Human sign gate: server-owned decision state, snapshot-digest binding, one-shot guard | I3 | S4, S11 | 4 | 0 | `drive.mjs --scenario sign`: execute still unresolved at t+2 s; a record in state `open`; snapshot digest == `digest('outpocket/snapshot/1', snapshot)` with **`request_id` inside the projection**; resolution only after `POST /api/sign/{request_id}/respond`. AND `tests/signature.test.mjs` reproduces every published digest. AND `tests/acceptance/sign-state.test.mjs` asserts **N-15** (a synthesised client-side sign response → 409 `E_NOT_SIGNED`), **N-16 `neg-respond-without-click`** scripted verbatim as the attack and recorded honestly — **it COMMITS today** (controlStatus `known-open`) and returns 403 `E_NO_CONFIRM_TOKEN` (controlStatus `enforced`) only for a caller that cannot read the dialog's DOM — and the **`confirm_token`**, minted with the sign request, delivered **only** into the rendered dialog's DOM and never into any tool-call result. AND the **scheduled deviation `DEV-E3-eval-case-known-open`**: the `confirm_token` flips `erp/contracts/eval-case.schema.json` `examples[1]` from `known-open`/"IT COMMITS" to **`enforced`** (R-27: `refused` is **not** in the frozen enum `[enforced, known-open, not-runnable]`, and the gate that demanded it would have failed ajv and turned `npm test` red repo-wide on Day 3), that file was frozen by S10 on Day 1 under `sha256sum -c`, and E3 (Day 4, downstream through S6) failed by construction until this node filed the ticket, landed the edit in the same commit and re-recorded the digest in `erp/contracts/FREEZE.md` |
| S12 | Report revision counter and atomic sign lock | I3 | S1, S5 | 2 | 0 | `tests/acceptance/sign-lock.test.mjs`: while a sign request is open every mutating endpoint returns **423** with a `code` field; the revision counter increments on every accepted mutation and is carried in the sign request; the lock is taken in the **same synchronous step** as the snapshot computation, asserted by an interleaving test showing no window |
| S6 | Server-side re-canonicalisation and reject on mismatch | I3 | S5, S12 | 2 | 0 | `bash tests/acceptance/toctou.sh`: sign, mutate a line via a second request, submit → **409 `E_SNAPSHOT_MISMATCH`**, both digests in the day book. Re-canonicalisation uses `src/canonical.js` — the same implementation the client used, never a second definition |
| S7 | SHA-256 hash chain over the day book, digest covering the source field | I3 | S1, S11 | 1.5 | 3 | `tests/acceptance/chain.test.mjs`: recompute the chain from `GET /api/daybook` with `src/canonical.js`, verify every link; flip one byte of any entry's `source` and verification fails **at that index** |
| S8 | Per-field provenance record | I3 | S1, S4 | 2 | 3 | `tests/acceptance/provenance.test.mjs`: every field carries `{value, source:'agent'\|'human', ts, actor}`; a human edit after an agent write flips `source` and appends two day-book entries with distinct sources |
| S9 | Deterministic reseed on boot | I3 | S1 | 1 | 0 | boot, `GET /api/state-digest`, restart, digest again — `diff` exits 0 |
| S10 | Freeze the I2/I3 contracts | L1 | T6, V5 | 2 | 0 | `tools/validate-contracts.mjs` exits 0 (ajv 2020-12 metaschema on `erp/contracts/violation.schema.json`, every tool name in `erp/contracts/tool-surface.contract.md` resolving) AND `git log -1 --format=%s -- erp/contracts/FREEZE.md` matches `^freeze:` **(R-31 — the probe used to name `violation.schema.json`, a pre-existing file no node outputs, which `L0` commits once under `bootstrap: …` and nothing touches again, so the gate could never pass; `FREEZE.md` is a file this node genuinely produces in that same freeze commit, MEASURED both ways in a scratch repo)** AND `sha256sum -c erp/contracts/FREEZE.md` exits 0, run from the repository root |

**S11 is numbered last in lane S and scheduled first in it.** Six frozen contracts publish
digests over OCF-1 and nothing implemented it. R-11: this is the **only** canonicaliser. The
eval-kit's `canon.mjs` (E1) is a **port** of it, verified against the same seven vectors. The
second, incompatible definition — `JSON.stringify` over an array sorted by `localeCompare`, no
kind prefix, nested key order untouched — produced different bytes for the same surface
*always*, which made every "the deployed digest equals the frozen digest" assertion unsatisfiable
by construction. It is deleted. `localeCompare` is additionally ICU-dependent: a stranger's clean
clone can sort differently.

**S3 is 3.0 h, not 1.0, and it is not a port (R-6).** `countinghouse/src/policy.js:28` is
`export const FX = { USD: 1, EUR: 1.09, GBP: 1.28, CNY: 0.14, JPY: 0.0067 }` — floats, which
cannot enter a canonical form two implementations agree on. Amounts stay integer cents; FX rates
become integer **micro-units** (rate × 1e6), and every downstream digest is re-derived.
**S3's predicate was unsatisfiable and is fixed (verified by execution).** The final clause was
`if(JSON.stringify(p).match(/\d+\.\d+/)) process.exit(1)`, and it matched `08.1` inside the
mandatory `version: "2026-08.1"` that the same predicate asserts three clauses earlier — so a
perfectly correct 19-rule integer-only document exited 1, on a cut-0 node at position 5 of 12 on
the critical path. The scan now deletes `version` and `effective_from` from a copy first.
Re-run this round: old predicate exit 1 on a correct document, new predicate exit 0, and exit 1
on a planted `150.5` and on a planted `fx.EUR: 1.09`.

**And the rule count is 19, not 16 (R-7):** `policy.js` emits 15 line-level codes plus 4
report-level codes (`EMPTY_REPORT`, `PROJECT_SCOPE`, `PROJECT_INACTIVE`, `REPORT_REVIEW` at
lines 193/197/199/218), and `erp/contracts/policy.schema.json` `examples[0]` carries `R01`–`R19` with
a digest pinned in `policy-versions.json`. "16" matched nothing in the file — not the codes (19),
not `LIMITS` (9 keys), not the push sites (23). It was carried from HANDOVER §1 without
re-counting. Under the old predicate QA would have had to fail S3, or someone would have quietly
deleted three rules to make a number match.

**S5 fixes a working forgery (R-1), and this is the most serious defect the audit found.** The
old `sign_response` was entirely client-authored: every field was a constant, attacker-chosen, or
copied verbatim out of the `sign_request` the server had just returned. A synthesised response
passed all ten rejection checks and committed, writing a chain entry attesting a human signature
by a client-chosen name at a client-chosen time. The tamper defence worked because nothing
changed between sign request and commit; the forgery succeeded for exactly the same reason — a
digest comparison cannot distinguish "a human signed and nothing changed" from "nobody signed and
nothing changed". **The server now owns the decision:** `open → answered(signed|declined) →
committed | expired`; `signed_by` from the session cookie, `at` from the server clock; the
`signature` object deleted from `commit_request` and reduced to `request_id`; `request_id` added
to the snapshot projection. S5 also ships **both** hold modes behind one switch from the start —
suspend-until-signed and the two-call `{status:'awaiting_signature', ticket}` handshake — because
V4 decides which is viable and discovering that on Day 4 is a rewrite.

**And R-1 did not close the gate. A SECOND forgery survives it, and S5 is now 4.0 h because of
what it costs to say so honestly (R-13).** The attack is inside the plan's own N-04 threat model
— curl, session cookie, no browser: submit a report; **never render the dialog**; POST
`/api/sign/{id}/respond` with `{schema, request_id, decision:'signed', reason:null,
method:'click', acknowledged_digest, acknowledged_revision}`, every field a constant or copied
verbatim from the response the server just issued; then POST the commit. Every rejection code was
walked — `E_DIGEST_ACK_MISMATCH`, `E_NOT_SIGNED`, `E_SNAPSHOT_MISMATCH`, `E_REVISION_MISMATCH`,
`E_SIGN_REQUEST_UNKNOWN`, `E_SIGN_REQUEST_EXPIRED`, `E_SIGN_IN_PROGRESS`,
`E_POLICY_VERSION_MOVED`, `E_NOT_CLEAN`, `E_FORBIDDEN`, `E_DECLINED` — and **not one of them
fires.** It commits.

Three consequences, and all three are written into the authority rather than smoothed over:

1. **The claim is narrowed to the only provable sentence:** *"a commit cannot be made without a
   POST from the authenticated session to `/api/sign/{request_id}/respond`."* **"A commit cannot
   be made without a human decision" is deleted from this project**, along with every
   forgery-closed flag; it is on `kb/webmcp/RETRACTED.txt` and `G4 --assert-register` fails if it
   is missing. §9's falsification table now fires on anyone who writes it.
2. **What R-1 bought and what it cost, stated together.** The attacker loses the ability to
   choose the name and the timestamp. The resulting record is therefore a **true attribution of a
   false event** — signed `chen`, at a genuine server time, forensically indistinguishable from a
   real click in the day book forever. That is arguably a *worse* forensic object than the
   original forgery, and we write it down rather than let a judge find it.
3. **The `confirm_token` is defence in depth, not a proof.** Minted with the sign request,
   delivered **only** into the rendered dialog's DOM, never returned in any tool-call result or
   any `/api/sign/{id}` response body, and required by `/respond`. **Residual risk, exactly:** it
   raises cost, it does **not** establish personhood, and its value is a direct function of open
   unknown **V3** — if an agent-initiated fetch carries the page session cookie and the agent can
   read the DOM, the token is reachable. `graph.json.contingencies` carries both V3 branches, and
   the `same-session` branch is the one that makes this gate *worse*, not better.

**Negative control N-16 `neg-respond-without-click` is scripted verbatim as that attack, and it
records the truth in both directions — and the two directions are SEPARATED BY A DATE, which is
the qualifier R-36 exists to carry.** Before the `confirm_token` ships (**S5, Day 3**) it
**COMMITS** (HTTP 200, a chain entry attesting Chen Xiao at a genuine server time) and is recorded
`known-open`; from Day 3, a caller that cannot read the dialog's DOM gets 403
`E_NO_CONFIRM_TOKEN` and is recorded **`enforced`** — *`refused` is not a member of the frozen
enum and this sentence used to use it (R-27)*. The test **fails if the outcome changes silently in
either direction** — including if someone "fixes" it by weakening the test. **`E9` runs on Day 5,
after S5**, so when C3 fires the vector at the live build the expected answer is the refusal, and
a refusal there is the control HOLDING — not evidence that something changed and nobody wrote it
down, and not licence to write that the gate is stronger than R-13's provable sentence permits.
`signature.schema.json`'s `x-signRequestState.survivingVector` states the claim flatly as *"IT
COMMITS"* and walks **twelve of the fourteen** rejection codes, omitting `E_NO_CONFIRM_TOKEN` and
`E_ALREADY_ANSWERED`; `E_NO_CONFIRM_TOKEN` is exactly the code that refuses the body it posts.

**And the instrument was pointed away from it, by a sentence.** `erp/charters/C3.md` enumerated
exactly four sign-gate attacks — replay, race a second respond, wrong `request_id`,
expire-and-commit — none of which is "POST `/respond` yourself", and told the red team to *"prove
that closure, not to rediscover the hole"*. **E9 is +0.5 h for rewriting that charter, and E9's
own accept asserts the rewrite landed** (`grep -q 'POST /api/sign/{request_id}/respond yourself'`
exits 0, `! grep -q 'prove that closure, not to rediscover the hole'` exits 0) so it cannot be
quietly skipped.

**The revoked-tool set is COMPUTED, and it is seven (R-20).** While a sign request is open, the
tools that disappear are derived from `annotations.readOnlyHint !== true`; in
`S2-emp-draft-clean` that is **seven, not five**. `signature.schema.json`'s `x-freeze.does[0]`
still names five and omits `submit_expense_report` and `open_expense_report` — **that sentence is
wrong and `graph.json` is the authority against it.** "the five write tools" is a retracted
claim. T4's accept, which requires every read-only tool to actually carry `readOnlyHint: true`,
is what makes the count derivable rather than asserted.

**S12 is the node that makes S6's claim true rather than asserted.** S6 closes the TOCTOU window
only if the lock is taken atomically with snapshot creation. This node was published in a sibling
document as `S10` — a straight collision with the real S10, on the critical path, with a different
owner, different inputs and a different job. A seat dispatched "S10" got a schema freeze or a
mutex depending on which file was open.

S1 is where the claim differential lives: HANDOVER §6 records that the strongest rival has no
server, no session and no persistence, and says so in its own README. **D1 must deploy exactly
one instance and the deploy notes must say why:** S6's closure is true by construction of a
single-process Node server with synchronous state mutation inside each handler, and a second
instance reintroduces the race with no test in this repository noticing. Render's instance count
is a dashboard setting, so this is one click away from being false in production while every test
stays green.

S2 exists because HANDOVER §5 **retracts** "the tool surface is the boundary" —
`countinghouse/src/erp.js:101` is the client telling itself 403. The permitted phrasing is "the
tool surface is the *intent* surface; the boundary is on the server", and G4's lint enforces it.
S5's originality is likewise retracted (webmcpui claims the sign-gate line publicly). What
survives is the **mechanism** — snapshot-digest binding plus S6's server-side re-canonicalisation
plus S12's atomic lock.

### Lane F — Front-end

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| F0 | Storyboard and video script, authored before anything grades against them | UX | L0, G4 | 1 | 0 | `tools/lint-layer0.mjs docs/STORYBOARD.md docs/VIDEO-SCRIPT.md` exits 0 AND every shot in `docs/STORYBOARD.md` has a stable shot id and a duration with the durations summing under 170 s AND `docs/VIDEO-SCRIPT.md`'s first cue is timestamped ≤ 00:10 and contains a literal token from `kb/webmcp/MECHANISMS.txt` |
| F1 | Application shell, login, two personas | UX | S1 | 2.5 | 0 | `drive.mjs --smoke-login chen,ruiz` exits 0 for both AND `document.querySelectorAll('[data-persona]').length === 2` |
| F2 | Report editor with per-field provenance and an agent-proposed vs human-edited diff | UX | S8, F1 | 3.5 | 3 | `tests/acceptance/editor.test.mjs`: every field cell carries `data-source ∈ {agent,human}`; after a human edit of an agent-written field the cell exposes both `data-source="human"` and `data-prev-source="agent"` |
| F3 | Receipt upload as a human-only channel; the agent can only link an existing id | UX | F1 | 1.5 | 2 | `tests/acceptance/receipt-channel.test.mjs`: zero registered tool has an `inputSchema` containing `contentEncoding`, `format:'byte'`, or a property named `file`/`data`/`base64`; `link_receipt` on an unknown id returns a `RECEIPT_NOT_FOUND` envelope |
| F4 | Signature dialog with the worst-case consequence printed above the signature line | UX | S5 | 1.5 | 0 | `tests/acceptance/sign-dialog.test.mjs`: the element immediately preceding `[data-signature-line]` has text matching `/you are certifying .+ if this is wrong, .+/i`; cannot confirm while it is empty; confirming POSTs to `/api/sign/{request_id}/respond` a body that **validates against the frozen `sign_respond_request`** — all eight required fields under `additionalProperties:false`, with the `confirm_token` read out of this dialog's own DOM — carrying **no `signed_by`, no `at`, and no key for either**, both taken by the server from the session cookie and its own clock. (The old "**only** `{decision, reason}`" was unsatisfiable: such a body fails `required` and carries nothing for `E_DIGEST_ACK_MISMATCH` or `/respond` to check. CONTRACTS.md §7.3.) |
| F5 | Policy-version indicator and live surface inspector panel | UX | T2, S3 | 2 | 2 | `tests/acceptance/inspector.test.mjs`: inspector row count == `document.modelContext.getTools().length` in each of the four employee states; version chip text == the value from `GET /api/policy` |
| F6 | Demo skin aligned to the storyboard shot ids | UX | F0, F2 (soft), F4 (soft), F5 (soft) | 2.5 | 1 | `tools/check-storyboard.mjs` exits 0: every shot id in `docs/STORYBOARD.md` resolves to a CSS selector matching ≥1 element on the built page |

**F0 is new and it fixes two separate self-referential predicates.** Before: F6 (cut rank 1)
*output* `docs/STORYBOARD.md` and its own accept *read* it; and D4 (cut 0, human-gated, 4.0 h)
graded `docs/VIDEO-SCRIPT.md`, which D4 itself output. F0 (cut 0) authors both, `F0→D4` and
`F0→F6` are hard edges, D4 now grades an artifact it does not produce, and F6 is genuinely
cuttable at rank 1 without touching the video. **You can film an unskinned build** — that is the
whole reason the cut ladder is non-empty. **F6 also moved to Day 4** (R-19): its predicate
resolves every shot id to a CSS selector matching at least one element on the **built page**, and
there was no built page on Day 1 — F1 is Day 2 and F4/F5 are Day 3.

**F1 has two personas, not three (R-5).** The previous predicate required `chen,ruiz,third` and a
count of 3, while the frozen `erp/contracts/eval-case.schema.json` permits only
`["none","chen","ruiz"]` and G2 requires exactly the two roles. The "third" persona had no name,
no role and no credential — a placeholder that had reached an acceptance predicate on a rank-0
node. It is deleted.

F3 encodes MEASURED iron rule 6 — there is no binary channel, so an agent cannot deliver an image
or PDF. **But HANDOVER §5 is explicit that this is page-enforced, not browser-enforced**, and
separately that "raw material does not reside in the system" is *false for us* because
attachments are uploaded and stored. The only honest narrowing is "the derivation context does
not enter the store", and the copy must say so.

F5 is the one cheap way to make kernel ① visible **on screen**, and it is on *our* page, so it is
unconditional — unlike whether the agent's client re-reads the tool list, which is unknown V2.
Contest rules (PUBLISHED): judges may judge from text, images and video alone, and three of the
four differentiators are invisible server-side invariants. If F5 is cut at rank 2, the video
carries all of it.

### Lane E — Eval (Codex-owned, except E4)

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| E1 | Eval-kit driver package skeleton with an OCF-1 port | C4 | H2, S11 | 2 | 2 | `cd webmcp-eval-kit && npm ci && npm test` exits 0, including a vector suite asserting `src/canon.mjs` reproduces all seven vectors in `erp/contracts/canonical-vectors.json` byte-for-byte; `bin/eval.mjs --version` prints semver; `--selftest` runs the pipeline twice against a fixed local fixture, asserts byte-identical results **and a non-zero tool count** |
| E2 | Capability suite: the expected tool set for each application state | C4 | E1, T5 | 2 | 2 | `--suite capability` exits 0 reporting **6 of 6** canonical states matching `artifacts/tools.export.json` by **set equality on tool names, never count equality**; zero states skipped; one extra or missing tool anywhere exits 1 |
| E3 | Negative-control suite with a declared pairing map | C4 | E1, T2, S2, S6 | 2 | 2 | `--suite negative` exits 0 **only if every must-fail case failed**, including **N-15 neg-commit-without-human returning 409 `E_NOT_SIGNED`**; the runner builds the pairing map from each case's `pairsWith` and fails the run if any state in `evals/surfaces.expected.json` has an empty pair set; every case declares `provingNode` and `brokenBy`; and N-16 is asserted against `eval-case.schema.json` `examples[1]` as S5's deviation `DEV-E3-eval-case-known-open` left it — **`enforced`**, not `known-open` (R-27: `refused` is not in the frozen enum). **`neg-policy-content-swap` is assigned the identifier N-20 here** — N-01…N-19 are all bound — expecting 409 `E_POLICY_DIGEST_MOVED`, `enforced`, with its honest scope attached: it needs **write access to the served policy**, arguably outside the declared N-04 curl-and-cookie model, and must never be written up as a break of it. **`neg-decline-to-unlock` is N-21** (R-34), expecting 409 `E_ALREADY_ANSWERED` on the human's genuine click after an attacker's decline, `enforced` once `S5` lands the code on Day 3, recorded as a **nuisance-grade denial and not a forgery**. R-35 settled the collision: `N-20` was self-assigned twice, here and in `erp/EVAL.md`'s control table; `graph.json` assigned it first and wins, so `neg-policy-content-swap` keeps N-20 and `neg-decline-to-unlock` takes N-21 |
| E4 | Blind grading protocol, rubric, packet builder and the hermetic Codex home | L2 | T5 | 2 | 2 | `evals/blind/make-blind-packet.mjs` produces a directory of **exactly two files** (`tools.export.json`, `tasks.md`), outside any git repo, `ls -1` printing 2; `! grep -qi 'outpocket\|countinghouse\|/Users/' evals/blind/prompts/c1.txt`; the builder **exits 1** if the prompt contains any criterion the rubric grades; `bash tools/blind-home.sh --verify` exits 0, asserting the constructed `CODEX_HOME` holds `auth.json` and a two-key `config.toml` and **no** `AGENTS.md`, `[hooks]`, `[mcp_servers]` or `[plugins]` |
| E5 | Deterministic surface accounting, provably zero model calls | C4 | T5 | 1 | 1 | `node --import ./webmcp-eval-kit/test/no-net.mjs … --suite accounting` exits 0 — the leading **`./` is mandatory and this is the only accept path in the graph permitted to carry it** — where `no-net.mjs` **throws from `net.Socket.prototype.connect` and `dns.lookup`**; two runs byte-identical; `! grep -rq 'api\.openai\|api\.anthropic' webmcp-eval-kit/src/`; the header records which denial mechanism ran |
| E6 | CI running the evals against the DEPLOYED commit, not the working tree | C4 | E2, E3, E5 (soft), D1 | 2 | 2 | the workflow's first step asserts `curl -s $URL/version` == `git rev-parse HEAD` and fails otherwise, and fails on `Origin-Agent-Cluster: ?0`; green run proven **mechanically** before D5 by `gh run list --workflow eval.yml --json conclusion -q '.[0].conclusion'` == `success`. **The eval job runs Chrome `--headless=new --enable-features=WebMCP`, and that is what makes this node possible at all**: MEASURED 2026-08-28, the flag works headless — page API present, `registerTool` succeeds, the `invokeTool` round trip completes. The previous revision demanded `headless:false` on the strength of `FACTS.md` IR-16(b), which is **false and retracted**; had it stood, this node had no admissible mode on a CI runner. The **flag** is required; headed is not |
| E7 | Results table published in the README | C4 | E6 | 1 | 2 | `tools/check-results-table.mjs` exits 0: row count == suite count in `evals/latest.json` and every number matches. The published **Bytes** column is `canon()` wire bytes; the export's `accounting` block is an internal cross-check, labelled as such, never mixed into the same column |
| E8 | C1 blind grading run | C1 | E4, T5 | 1 | 2 | the run executes as `CODEX_HOME="$BH" codex exec --strict-config -C "$PACKET" -s read-only --skip-git-repo-check --ephemeral --ignore-rules --output-schema … -o … "$(cat …)" < /dev/null`, `$BH` built by `tools/blind-home.sh`; verdict validates against the rubric schema; **admissibility:** no repo identifier in the verdict, zero tool calls outside `$PACKET`, and the run banner shows `reasoning effort: low` |
| E9 | C3 red-team break attempts | C3 | E3, D1 | 3.5 | 2 | **the C3 charter rewrite is asserted first:** `grep -q 'POST /api/sign/{request_id}/respond yourself' erp/charters/C3.md` exits 0 and `! grep -q 'prove that closure, not to rediscover the hole' erp/charters/C3.md` also exits 0. THEN `evals/redteam/report.md` lists ≥8 attempted breaks each with a reproduction command, including the four sign-gate attacks the charter already had **and the fifth none of them covered — POST `/respond` yourself, then commit**; every successful break lands as a runnable file in `tests/redteam/` in the same commit, mirrored by C4 into the negative suite in the same merge window |
| E10 | Mutation check: prove the negative controls are not vacuous | C4 | E3 | 3 | 2 | `--suite negative --verify-controls` exits 0: for every must-fail case it applies that case's declared one-line `brokenBy` mutation, re-runs it, and **fails the run if the case does not flip from refused to permitted**; `evals/mutation-report.json` records one row per case |

**E4 is owned by L2, not C4.** It is a ruler, not product code, so it does not violate L2's
zero-product-code charter. A verifier with repo access systematically overestimates the surface,
because the judge's Sol sees only name, description, `inputSchema` and **`annotations`** — four
things, not three — hence the `grep` for repo identifiers is part of E4's acceptance.

**R-2: blindness is enforced by `CODEX_HOME`, not by `cwd`.** `-C` is not a jail and
`-s read-only` still grants full-disk read; the base `~/.codex/config.toml` enables MCP servers,
plugins and hooks that bypass the sandbox entirely. An empty `CODEX_HOME` drops the rendered
prompt from 32,412 to 11,217 bytes. **But the leak mattered more than the sandbox:** the old C1
briefing shipped the grader the exact design rules it was supposed to independently discover, so
a grader told that missing ordering prose is intentional will never report "I could not tell what
order to call these in". C1 gets what the API *is*, and nothing about what our surface should
look like. E8 takes **no `-p`** (that home has no profile file, and `-p <missing>` exits 0 with no
warning and silently falls back to the base config) and **never** gets the network override
(R-4). `< /dev/null` is mandatory: with a non-TTY stdin, `codex exec` appends what it finds as a
`<stdin>` block and silently extends the prompt.

**E8 and E9 exist because C1 and C3 are rulers that owned nothing.** E4 is a *protocol*, and a
protocol is not a result. E9 additionally must append
`-c sandbox_workspace_write.network_access=true` (R-4) — bare `-s workspace-write` has **no
network**, so as previously documented C3 could not reach the deployed origin at all and its
entire standing target list was unreachable. Standing target #6, provenance laundering, is the
one that found the S5 forgery; keep it first on the list.

**E9 is 3.5 h, and the extra half hour is the C3 charter rewrite (R-13e).** The charter
enumerated four sign-gate attacks and **none of them was "POST `/respond` yourself"**, and it
instructed the red team to *"prove that closure, not to rediscover the hole"*. The one instrument
that would have found the live vector was pointed away from it. E9's own accept now asserts both
halves of the rewrite before the node may run, so the standing target list must include the live
vector and cannot be quietly restored to the old one. **The rewrite is part of this node's work
and is not free**, which is why the hours moved with it.

**E3's must-fail structure is parity, not advantage:** HANDOVER §6 records that `claimready`
already runs must-fail negative controls in CI against a deployed commit. Five of the old
controls passed vacuously against a tree with no server and no iframes, and **E10 is the only
mechanical definition of "real negative control" the design has.**

**E5's baseline is the byte count, which is MEASURED (iron rule 10):** signed-out 1 tool /
395 chars; employee 5 / 1,947; clean draft 13 / 6,682; auditor 6 / 2,070. **The token figures
(~99 / ~487 / ~1,671 / ~518) are `ceil(bytes/4)` — OUR-ESTIMATE, not a tokenizer, and they must
be labelled that way anywhere they are published (`CONTRACTS.md §5`).** Never present this table
as a token saving: **iron rule 15** (MEASURED) is that a dynamic surface costs ≈1.25× prompt-cache
write per flip. The honest framing is that we spend prompt-cache efficiency to buy a
**page-enforced workflow constraint**: the tool the agent would need is not on the surface until
the state permits it. The boundary that actually holds is the server's per-request check (S2),
not the surface. Three incompatible "bytes per state" definitions were in circulation for the same
state — 395, 397 and 280; **exactly one may appear in the README, and it is `canon()` wire bytes.**

### Lane X — Extraction (Track B, horizon B, never on Sprint A's critical path)

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| X1 | Extract the surface compiler to dev-kit | C2 | T1 | 3 | 4 | dev-kit `npm test` exits 0 AND outpocket stays green with `src/page/tools/compile.js` deleted |
| X2 | Extract the violation envelope to dev-kit | C2 | S4 | 2 | 4 | dev-kit tests green; re-exports `erp/contracts/violation.schema.json` unmodified (sha256 match) |
| X3 | Extract the sign gate to dev-kit | C2 | S5, S6 | 3 | 4 | dev-kit tests green including a ported `toctou.sh` against the kit's reference server **and a ported N-15 asserting 409 `E_NOT_SIGNED`** |
| X4 | Extract the provenance ledger to dev-kit | C2 | S7, S8 | 2.5 | 4 | dev-kit tests green including the chain-tamper test |
| X5 | Extract the layer-0 lint to dev-kit | C2 | G4 | 2 | 4 | `npx webmcp-lint tests/fixtures/banned-sample.js` exits 1 naming every planted violation; 0 on a clean file |
| X6 | Promote the eval harness to eval-kit as a standalone package | C4 | E6 | 3 | 4 | `npm pack` in a clean clone, install into an empty directory, serve `webmcp-eval-kit/fixtures/reference-site/index.html` locally and run `npx webmcp-eval --url http://127.0.0.1:$PORT --suite capability` end to end against that site, which is **not** outpocket; `! grep -rq 'outpocket' webmcp-eval-kit/src/ webmcp-eval-kit/bin/` |

X6's old predicate ran against `https://example-webmcp-site`, a host that does not resolve, so it
could never pass. The kit now ships its own minimal reference site as the not-outpocket target —
which is also the honest demonstration of the claim that the kit is not outpocket-specific.

### Lane D — Delivery

| id | title | owner | inputs | h | cut | accept — **gloss only, not an authority** |
|---|---|---|---|---|---|---|
| D1 | Deploy live, single instance, with a response-header dump | I4 | S9, F1 | 2 | 0 | `curl -sI $URL \| tee evidence/headers.txt` then `grep -i '^origin-agent-cluster:' evidence/headers.txt \| grep -q '?0' && exit 1; exit 0` — the header must be **absent, or present with a value that is not `?0`** — AND status 200 AND `GET /version` == `git rev-parse HEAD` AND the deploy is configured for exactly **one** instance, recorded with the reason |
| D2 | Custom domain and origin trial token (bonus, explicitly non-blocking) | I4 | D1 | 2 | 1 | `grep -c 'http-equiv="origin-trial"'` returns 1 AND `tools/check-psl.mjs $DOMAIN` exits 0 (the apex is not on the public suffix list) |
| D3 | Unattended survival check across the 2026-09-04 to 09-21 judging window | I4 | D1, S9 | 1.5 | 1 | `tools/survive.mjs --idle 1800` exits 0: after 30 idle minutes a cold request returns 200 in under 10 s and `/api/state-digest` equals the boot digest recorded by S9 |
| D4 | Video under 3 minutes, with audio, English, mechanism in the first 10 seconds | UX | H6, D1, F0 | 4 | 0 | `ffprobe` reports duration <180 AND ≥1 stream with `codec_type=audio`; the public URL returns 200 from a logged-out fetch; and `docs/VIDEO-SCRIPT.md`'s first cue is ≤00:10 and contains a literal token from `kb/webmcp/MECHANISMS.txt` |
| D5 | Devpost four answers and submission | I4 | D4, G1, G2, V6, G4, E7 (soft) | 2 | 0 | `docs/DEVPOST.md` has exactly 4 H2 sections AND `tools/lint-layer0.mjs docs/DEVPOST.md` exits 0 — zero banned wording, zero claims appearing in `kb/webmcp/RETRACTED.txt` — AND the Devpost submission URL returns 200 from a **logged-out** fetch |
| D6 | Freeze rehearsal on a clean profile / incognito | QA | D5 | 2 | 0 | `tools/freeze-check.mjs` exits 0 against the **public** URLs from a fresh `--user-data-dir` with no session: the repo page loads logged out; `gh api repos/Caleb0796/outpocket -q .license.spdx_id` returns MIT; the video URL returns 200 with an audio stream; the live URL returns 200 and the first screen shows the env banner |

**D1's predicate was wrong twice and each error was load-bearing.** `grep -c` printing `0`
**exits 1**, so the old `&& ` chain always failed; and only `?0` is fatal — `?1` is the opposite
setting and is harmless. The documented reaction to a failing D1 is "deployment is dead for
WebMCP regardless of code, reopen ahead of all feature work", so a benign header would have
full-stopped the critical path. Deploy target is **Render paid 0.5c-512mb** — the free tier
sleeps after 15 minutes and keep-warm pings exhaust the 750 h/month allowance.

**D2 is a bonus:** judges reach us through the ChatGPT built-in browser or a Chrome flag, both of
which bypass the origin-trial token, and `pages.dev`, `vercel.app`, `netlify.app`, `github.io`,
`chatgpt.site` and `onrender.com` are all on the public suffix list (MEASURED, iron rule 14), so
no subdomain token is obtainable at all. **Contingent: if V1 reports ABSENT, D2's cut rank
becomes 0 and `--check-cuts` is re-run.** *(That PSL fact is about D2 and only D2. **V5** is also
hosted on `*.onrender.com` and does not care: it mints no origin-trial token — R-18.)*

**Schedule D4 on Day 5, not Day 6.** It is 29% of the human budget with zero tolerance for a
re-shoot, and Day 6 must hold only D5 and D6. F6 is deliberately **not** an input, so the video
can be shot on an unskinned build.

**D5's claim (b) must read: a specific authenticated *human* reviewed a specific canonical
snapshot, and the write arrived through the tool surface.** We do **not** identify or
authenticate the agent — WebMCP exposes no agent identity, the specification says the browser
agent uses a different internal mechanism, and H3 is indistinguishable from a third-party agent
at the tool boundary. **Ruling R-21 makes this absolute: no document in this project may claim
attestation of "a specific agent",** and the phrase is on the retracted register that
`G4 --assert-register` and D5's own lint both scan. **And the sign-gate sentence D5 may write is
bounded by R-13** — a POST from the authenticated session, never "a human decided". **E7 is a soft input:** if E7 is cut, D5 *removes* the
§Results section entirely and cites T5's export instead — that removal is part of D5's own
accept, and without it D5 fails its own lint on numbers that no longer exist.

---

## 3. Added nodes, the fourth Codex seat, and the four rulers

**Nine nodes beyond the previous revision**, each because something the graph depended on was
produced by nothing. Quoted from `graph.json.contradictions_with_skeleton`:

- **L0** — nothing bootstrapped the repository. No `package.json`, no lockfile, no `.team/` tree,
  no `~/.codex/*.config.toml`. Four of sixteen seats could not boot and the first node could not
  run its own accept.
- **G0** — `tools/ready.mjs`, the tool the graph is operated with, sat inside the first cut.
- **G6** — no contract file under `erp/contracts/` was enforced by anything.
- **S11** — no OCF-1 implementation existed, yet six frozen contracts publish digests over it.
- **S12** — no atomic sign lock, so S6's TOCTOU closure was asserted rather than built.
- **F0** — the storyboard was produced by the same rank-1 node that consumed it, and the video
  script was graded against itself.
- **E8, E9** — no blind grading *run* and no red-team output artifact, so rulers C1 and C3 owned
  zero nodes.
- **E10** — no mutation check, so a negative-control suite could pass while asserting nothing.

Carried forward from the previous revision and still standing: **V5** (the V lane had no origin),
**S10** (nothing froze the I2/I3 contract), **V6** (nothing converted the unknowns into a
decision).

**Seat reconciliation.** The user agreed fifteen seats with **four** Codex positions, but only
three were ever named — C1 verifier, C2 builder, C3 redteam. The fourth is **C4, eval engineer**,
matching the user's instruction that eval is mainly Codex-run. That makes 16 seats. This is a
reconciliation of an existing decision, not a new headcount request.

**Three seats own no node, and that is now declared rather than accidental.** `graph.json`
lists `W`, `K1` and `K2` under `non_node_seats`: "explicitly unbudgeted overhead, not idle
rulers. `owner ∈ seats` remains a real check because every node owner is drawn from the other
thirteen. No acceptance predicate anywhere may hard-depend on an artifact produced by a non-node
seat." Note in particular that **G4 does not depend on K1** — G4 authors `kb/webmcp/BANNED.txt`
itself and K1 enriches it afterwards.

**The four non-overlapping rulers**, quoted from `graph.json.rulers`:

| ruler | measures | instrument | owns |
|---|---|---|---|
| **QA** | is it done | acceptance predicates met | G3, G6, T4, D6 |
| **L2** | is it enough to win | rubric — `erp/RUBRIC.md`, an **`L0` output at cut rank 0**: not a node, therefore not cuttable, and no longer missing (R-16) | E4 |
| **C3** | can it be broken | adversarial | E9 |
| **C1** | can a blind agent use it | blind surface only (`artifacts/tools.export.json`, no repo) | E8 |

> **That defect is CLOSED, and it was closed by funding it rather than by repointing it (R-16).**
> `erp/RUBRIC.md` is L2's only instrument and was cited by four charters while being produced by
> nothing — the previous revision flagged it OPEN and left it there, which meant every "cite a
> clause in `erp/RUBRIC.md`" instruction was unexecutable and the reason L2 survives rank 2 was
> resting on a file that did not exist. It is now an **output of `L0`**, which took **+0.5 h**
> for it (3.0 → 3.5, and that is the whole of the critical path's move from 28.5 h to 29.0 h; the later move to 29.5 h is the `V5` edges, not an estimate). It
> is authored on Day 0, at cut rank 0, and it stops being flagged OPEN anywhere.

---

## 4. The computed critical path, and whether it fits

### 4.1 The path

Longest path by earliest-finish over **hard** edges only, horizon A, computed from the `hours`
field. Recompute with `node tools/ready.mjs --path` (G0) after any estimate change; **never
assert it by hand.**

```
L0  →  V5  →  S10 →  S1  →  S3  →  S4  →  T2  →  H3  →  H6  →  D4  →  D5  →  D6
3.5 + 1.5 + 2.0 + 2.5 + 3.0 + 1.5 + 3.0 + 2.5 + 2.0 + 4.0 + 2.0 + 2.0  =  29.5 h
L1     I1    L1    I3    I3    I3    I2    I1    I1    UX    I4    QA
```

**It moved from 29.0 h to 29.5 h in v2.3.0, and position 2 rerouted from `T6` to `V5`, with no
estimate touched.** The mover is a pair of hard edges v2.3.0 adds: `V5 → S10` and `V5 → G6`. `V5`
writes `erp/contracts/probe-verdict.schema.json` — the **ninth** contract file — into
`erp/contracts/` on Day 0; `S10` freezes and sha256-hashes that directory on Day 1 and `G6`
ajv-validates every schema in it. Only the schedule ordered them, and `--check-schedule` proves
`day(u) ≤ day(v)` over **hard edges only**, so with no edge there was nothing to prove: had `V5`
slipped one day, the ninth schema would have landed *after* the freeze with no failing check and
no scheduled deviation. `V5` is 1.5 h against `T6`'s 1.0 and both feed `S10` from `L0`, so the
deepest walk into `S10` now runs through `V5` (7.0 h to `S10`'s finish, against 6.5 through `T6`).
`T6` keeps its hours and its position in the graph; it is simply no longer the deepest way in, and
the last ten nodes are byte-identical. The **longest divergent path is 27.5 h**
(`L0 → V5 → S10 → S1 → S3 → S4 → S5 → S12 → S6 → E3 → E9`), so there is still 2.0 h of clearance
behind the spine — recomputed by script after the change, along with the path itself. *The earlier
move, retained: 28.5 h → 29.0 h came from L0 gaining 0.5 h when `erp/RUBRIC.md` became one of its
outputs (R-16).*

Named: **the bootstrap → the red test → the contract freeze → the server → the policy engine →
the violation envelope → live registration → the fallback agent → the rehearsal → the video →
the submission → the freeze check.**

**Grade: OUR-ESTIMATE.** Re-derived twice by hand and once by scratch script for this revision.
It is **not** MEASURED, because `tools/ready.mjs` does not exist yet — it is produced by G0. No
claim in this file may be graded MEASURED or VERIFIED on the strength of a checker that has not
been written.

**Three things moved it, and all three are worth reading**, because the previous revision
published 19.5 h and the executability audit predicted 22.5 h:

1. **The three missing hard edges `F1→T2`, `S1→T2`, `S4→T2`.** T2's predicate drives a real page
   served by a real server with a real blocking violation. Adding those edges routes T2 through
   the S lane. **The server lane *is* the spine after all** — the previous revision's headline
   observation that it was not is retracted.
2. **L0 at the head**, adding 3.5 h ahead of everything.
3. **S3 re-estimated 1.0 → 3.0 h** for the integer-micro-USD FX migration (R-6).

The audit's predicted `T6→S10→S1→F1→T2→…` path is real, but it is not the longest one:
`S1→S3→S4→T2` is 2.0 h longer than `S1→F1→T2`.

What has **not** changed is the tail: the path is still gated by rehearsal, video and submission
rather than by mechanism depth. That is a direct consequence of the contest rule (PUBLISHED) that
judges may score from text, images and video alone.

### 4.2 Three capacity models, and only one of them binds

**Model A — graph depth against wall clock.** 29.5 h of strictly dependent work against ~132
wall-clock hours (2026-08-28 evening → 2026-09-03 13:00 PT). Fits with 4.5× headroom.

**Model B — agent capacity.** Total Sprint A work = **118.0 agent-hours** over 62 horizon-A
nodes. Lane X's 15.5 h are horizon B and are not part of this total.

| seat | I3 | I1 | UX | C4 | I4 | L1 | I2 | QA | C3 | L2 | PM | C1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| horizon-A hours | 23.5 | 21.0 | 18.5 | 13.0 | 10.5 | 8.5 | 8.5 | 6.5 | 3.5 | 2.0 | 1.5 | 1.0 |

By lane: L 3.5 · G 9.5 · V 10.5 · H 12.0 · T 9.5 · S 25.5 · F 14.5 · E 19.5 · D 13.5 = 118.0.

`graph.json.capacity` puts available agent capacity at **396 h** — "12 active node-owning seats
× 6 productive agent-hours/day × 5.5 days, OUR-ESTIMATE". 118.0 of 396 fits with 3.4× headroom,
and the busiest seat (I3 at 23.5 h) needs 3.9 of the 5.5 days. *(The previous revision published
"10 seats … 330 h" and this file flagged the discrepancy in a footnote rather than correcting the
authority. The authority is now corrected: **twelve** seats own horizon-A nodes — I1 12, I3 11, UX
8, I4 7, C4 7, I2 5, L1 4, QA 4, C1 1, C3 1, L2 1, PM 1 — plus C2 in horizon B only. Correcting it
only increases the headroom; agent hours are not binding at any rank, so nothing downstream moves,
and the term in that assumption that actually binds is the 6 h/seat/day, through
`capacity.seat_day_hours_cap`, not the total.)*

**The 6 h/seat/day figure inside that assumption is no longer just a divisor — it BINDS.** It is
a named field, `capacity.seat_day_hours_cap: 6.0`, and `node tools/ready.mjs --check-schedule`
enforces it against `capacity.schedule_A`. The previous day table broke it three times — I3 at
8.0 h on Day 2, I1 at 6.5 h on Day 2 and 7.0 h on Day 3 — **while quoting that same 6 h to
justify the agent-capacity total above.** It was fixed on the schedule side, never on the assumption
side: S9 moved to Day 2, S5 to Day 3, S2 to Day 4, S7 to Day 5, V5 to Day 0, and **the peak
seat-day is now exactly 6.0** (I1 Day 2, I1 Day 3, I3 Day 3, I3 Day 4, UX Day 4). The cap counts
**agent** hours only: the five human-gated nodes come out of the human's budget, because the seat
is waiting on a person rather than working.

**Model C — human capacity. This is the binding one.**

The human budget is **3.0 h/day × 5.5 days = 16.5 h available** — ruled by the user on
2026-08-28 as **D-17**, at the top of their stated 2–3 h/day range, before any seat was
dispatched. Source, quoted from `graph.json`: "the user's own stated budget of 2–3 h/day and
30–50 prompts (PUBLISHED — stated directly by the user, not measured)." At the ruled figure
nothing is cut and 0.625 h is spare.

Required, and the arithmetic is shown rather than asserted:

| item | hours |
|---|---|
| G1 — only the repo owner can flip visibility | 0.5 |
| V1 — the ChatGPT desktop browser cannot be driven by CDP | 2.0 |
| D4 — recording audio narration | 4.0 |
| D5 — Devpost account submission | 2.0 |
| D6 — judging the freeze rehearsal from a logged-out window | 2.0 |
| **subtotal, explicitly human-gated** | **10.5** |
| review/dispatch overhead at 0.05 × **107.5** non-human-gated agent-hours | 5.375 |
| **total required** | **15.875** |

**The overhead coefficient applies to non-gated hours only.** An earlier revision applied
`0.05 ×` the full total and double-counted: the human does not review their own gated hours at
5%. That correction is stated as a rule in `graph.json.conventions.hours`.

**And the 10.5 h is not spread evenly — the schedule now makes that visible.** Human-gated work
lands on three days and three only: **Day 1 = 2.5 h** (G1 0.5 + V1 2.0), **Day 5 = 4.0 h** (D4),
**Day 6 = 4.0 h** (D5 2.0 + D6 2.0). Days 5 and 6 each need **1.5 h more than the 2.5 h/day
average**, and Day 6 is the morning of a 13:00 PT deadline. **No rank of the ladder touches
this** — all five human-gated nodes are cut 0 — so if the user cannot give roughly half a day to
the video on Day 5 and half a day to submission on Day 6, **the answer is to shorten D4's scope,
not to fire a rank** (`capacity.human_hours_are_budgeted_in_total_not_per_day`).

**All five human-gated nodes are cut rank 0, so the 10.5 h is irreducible: no rank of the ladder
frees a single human-gated hour.**

### 4.3 The sensitivity, stated in the open

**RULED 2026-08-28 (D-17): 3.0 h/day. 16.5 available against 15.875 required — the full graph
fits with 0.625 h of spare and no rank of the ladder fires.** The 2.5 h/day branch below is the
retained contingency, not the plan of record.

**At 2.5 h/day: 13.75 available against 15.875 required. The full graph would not fit — short by
2.125 h.** The first rank that fits is **rank 3**, at 13.475 required with **0.275 h of spare**,
which is less than one video re-shoot. Ranks 1 and 2 do not get there — 15.275 and 14.05 against
13.75 — and rank 4 frees zero horizon-A hours.

**At 3.0 h/day: 16.5 available against 15.875 required. Nothing needs cutting. The full graph
fits with 0.625 h of spare.**

**The entire cut ladder hangs on a difference of half an hour per day.** That is a PM decision on
**Day 0**, logged as D-17 in `erp/DECISIONS.md` — a file **`L0` creates on Day 0** for exactly this purpose and gates in its accept gate (1); V6 later *appends* its unknowns rows to it — taken *before any seat is
dispatched* — not discovered on Day 4.

**If 2.5 h/day holds, this is exactly what is amputated** — 27 of the 62 horizon-A nodes, named
here rather than hidden behind a verdict word (`graph.json.capacity.human_budget_sensitivity.amputation_set_if_2.5_holds`):

```
V0  G5  G6  T4  D2  D3  F6  E5                                  (rank 1)
T3  T5  F3  F5  E1  E2  E3  E4  E6  E7  E8  E9  E10             (rank 2)
V2  V3  V4  S7  S8  F2                                          (rank 3)
```

What that costs: the whole eval lane and the instruments of **two** of the four rulers, the
absence register, the surface inspector, per-field provenance, the hash chain, three of five
unknowns, and the demo skin. What survives: the server kernel, the tool-surface flips, the
harness, the deploy and the video.

**And the thing that must not be misread:** cutting does not make the deadline easier.
`graph.json.capacity.verdict` — "The binding resource is human hours; agent hours are not binding
at any rank. **The ladder cannot help the schedule — graph depth is 29.5 h regardless** — so if
the deadline is the problem, cutting is the wrong instrument and scope must come out of
D4/D5/D6 or the deadline moves."

The one place to buy real slack is `docs/VIDEO-SCRIPT.md`, which **F0** writes in agent hours on
**Day 1**, so D4 is a single scripted take rather than an exploratory four-hour session.

---

## 5. The cut ladder

**There is exactly one cut ladder in the project: this one, from `graph.json.cut_ladder`.**
RISK.md's 10-rank ladder is **deleted, not deprecated** — it was inverted against this one (its
rank 1 was lane X, which is rank 4 here) and its ranks 8 and 10 cut H6, H1 and H2, all cut 0 here
and one of them on the critical path. "Fire ranks 1–3" meant opposite things in the two documents,
in the same words, at the hour when nobody re-reads a disclaimer. **Every trigger in every
document now names node ids — "Cut `X1`–`X6`", never "Cut rank 1" (R-12).**

Cuts are cumulative: firing rank *r* deletes every node ranked 1…*r*. Rank 0 is never cut.

**Invariant.** Let key(0) = ∞ and key(n) = n. For every hard edge u→v within one horizon,
key(u) ≥ key(v) — a node may never outlive an input it depends on. Soft edges are exempt (the
consumer degrades and records the absence). Cross-horizon A→X edges are exempt from the Sprint A
ladder; an X node is simply unreachable in Track B if its source was cut.

> **Grade, quoted verbatim from `graph.json.conventions.cut_invariant_grade`:**
> "OUR-ESTIMATE 2026-08-28. Re-derived by hand and by a scratch script over all 105 edges with
> 0 violations, but `tools/ready.mjs --check-cuts` — the mechanism the previous revision cited —
> **DOES NOT EXIST YET**. It is produced by G0. No claim in this file may be graded MEASURED or
> VERIFIED on the strength of a checker that has not been written; regrade to MEASURED on the
> first green G0 run."
>
> The previous revision of this file stamped that check **"VERIFIED 2026-08-28: 0 violations over
> all 84 edges."** That stamp was not earned and is withdrawn. The claim happens to be true — two
> independent re-derivations agree — but a grade is a statement about *how* we know, and we knew
> it by hand.
>
> *(Two edge counts appear in the authority: the quote above says 105 and the graph now carries
> **119** edges, of which **108 are hard** and 11 are soft. The invariant is defined over hard
> edges **that do not cross a horizon** — the rule's own text exempts `A → X` — so of the 108
> hard edges **102 qualify** and 8 are cross-horizon. That is the figure that matters, and the
> stale 105 is retracted in `graph.json.conventions.cut_invariant_grade`. Re-verified by script
> this revision: **0 violations over all 102 qualifying edges**. The two edges v2.3.0 added,
> `V5 → S10` and `V5 → G6`, are hard and same-horizon and therefore qualify; both hold — `V5` and
> `S10` are cut 0, whose key is ∞, and `G6` is cut 1.)*

### 5.1 The real per-rank table

| rank | nodes deleted | horizon-A agent-h freed | **critical path after** | **human-gated h freed** |
|---|---|---|---|---|
| — | (nothing fired) | — | **29.5 h** | — |
| **1** | V0, G5, G6, T4, D2, D3, F6, E5 | 12.0 | **29.5 h** | **0** |
| **2** | T3, T5, F3, F5, E1, E2, E3, E4, E6, E7, E8, E9, E10 | 24.5 | **29.5 h** | **0** |
| **3** | V2, V3, V4, S7, S8, F2 | 11.5 | **29.5 h** | **0** |
| **4** | X1, X2, X3, X4, X5, X6 | **0.0** — the 15.5 h are all horizon **B** | **29.5 h** | **0** |

**Rank 4's third column is 0.0 on purpose, and that is a fixed field.** It used to report `15.5`
in the same column as ranks 1–3, which report horizon-A hours, so a reader summing the column got
63.0 h of relief out of a graph containing only 48.0 h of cuttable horizon-A work. Lane X's hours
are not part of `agent_hours_total_A` and firing this rank changes no Sprint A number.

**Read the two right-hand columns before doing anything with this ladder.** Every one of the
twelve nodes on the critical path is cut rank 0, and every one of the five human-gated nodes is
cut rank 0. Therefore:

> **The ladder shortens the critical path by exactly zero at every rank, and frees exactly zero
> human-gated hours at every rank. It is a pure review-overhead instrument: its only effect on
> the human budget is to shrink the `0.05 × agent-hours` term.**

**Retraction.** The previous revision of this file wrote that rank 3 "barely shortens the
critical path — with F2/S8 gone the path reroutes through the H lane and drops only from 19.5 h
to ~19.0 h." **That reroute does not happen, F2 and S8 are not on the path, and 19.0 h was a
fabricated number.** It is withdrawn. The observation it was reaching for is real and stronger,
and it is the sentence above.

### 5.2 What each rank actually costs

**Rank 1.** Unknown V0 ships UNVERIFIED. No ownership pre-commit hook — ownership reverts to L1
reading diffs, though `tools/check-ownership.mjs` itself survives in G0. **No contracts
conformance runner: nothing ajv-validates the schemas in `erp/contracts/`, and nothing runs
CONTRACTS.md check 3b — the frozen policy over the frozen snapshot, which is G6's real catch
(R-29). The `canonical_bytes` error this line used to advertise does not exist: 2458 and 2457
both recompute correctly.** No annotations conformance test (the 500-char check
survives inside the ported surface test). No custom domain. No unattended-window proof. No demo
skin — the video is shot on the plain build, which F0 and D4 are explicitly designed to permit.
No surface-accounting numbers in the README.

**Rank 2 is the painful one, and it is a governance change, not only a scope change.** It deletes
the entire eval lane, which is the instrument of **two of the four rulers**: C1 loses E4 and E8
(blind grading) and C3 loses E9 (red team). C4 goes idle, but **C4 was never a ruler** — it is the
eval engineer. Working it through node by node:

| ruler | instrument | in rank 2? | survives? |
|---|---|---|---|
| **QA** | acceptance predicates (owns G3, G6, T4, D6) | G6 and T4 only, at rank 1 | **yes** — G3 and D6 are cut 0 |
| **L2** | `erp/RUBRIC.md` — an **L0 output at cut 0**, not a node (R-16) | no | **yes** |
| **C3** | E9 | **yes** | **no** |
| **C1** | E4, E8 | **yes** | **no** |

**So four rulers become two: QA and L2.** After rank 2, nobody measures whether a blind agent can
drive the surface, and nobody measures whether an adversary can break it. Also lost at rank 2:
the **absence register** — the one un-killed original idea — the blind surface export, the live
surface inspector (so kernel ① is no longer visible on screen and the video must carry it
entirely), and the human-only receipt channel demonstration.

> **The contradiction this file recorded last revision is now CLOSED in the authority.**
> `graph.json.cut_ladder` rank 2 used to say "three of the four rulers' instruments" are lost,
> then "Four rulers become THREE", while its own next clause named *both* C1 and C3 as losing
> their measurement — three statements, no two of which could hold together. This file reported
> that rather than papering over it. The authority now reads **"TWO rulers are idled — C1 and C3
> — and FOUR RULERS BECOME TWO"** and adds the consequence that matters most this round: at rank
> 2, **nobody is measuring the live sign-gate vector N-16** either. The table above and the
> authority now say the same thing.
>
> An earlier revision of *this* file said "four rulers reduce to two… the remaining pair (QA and
> C3)". The count was right by accident and the naming was wrong: **C3 does not survive rank 2;
> L2 does**, because L2's instrument is an L0 output at cut 0.

**Rank 3** frees the most hours per unit of capability lost. Three of the five unknowns ship
UNVERIFIED with named fallbacks (H3 becomes the unconditional demo path), and kernel ⑤ (per-field
provenance) and the hash chain are amputated entirely, leaving three of five kernel mechanisms.
It does **not** shorten the critical path. No rank does.

**Rank 4** is lane X, horizon B by definition. It frees **zero** horizon-A hours and changes no
Sprint A number. It is listed as a rank only so the invariant check has a terminal rank.

---

## 6. Interface freeze schedule

Before the contract artifact exists, "parallel" work is speculative rework. Nothing downstream of
a freeze may start until the freeze commit lands. Copied from `graph.json.interface_freezes`;
**every id in the `unblocks` column is a node with a hard edge from its `frozen_by`, and
`node tools/ready.mjs --check-freezes` asserts exactly that.** Three of the five entries
previously failed that assertion.

| # | artifact | frozen by | owner | unblocks | deadline |
|---|---|---|---|---|---|
| 1 | `erp/contracts/violation.schema.json` | S10 | L1 | T1, S1, S4 | end of Day 1 |
| 2 | `erp/contracts/session.contract.md` | S1 | I3 | F1 | end of Day 2 |
| 3 | `artifacts/tools.export.json` | T5 | I2 | E2, E4, E5 | end of Day 3 |
| 4 | `evals/blind/rubric.schema.json` | E4 | L2 | E8 | end of Day 4 |
| 5 | `docs/STORYBOARD.md` shot ids | **F0** | UX | D4, F6 | end of Day 2 |

Three of these entries were repaired, and the repairs are instructive:

- **#2** previously listed `V3` with no `S1→V3` edge. V3 runs against V5's throwaway probe, not
  against S1, so the dependency was imaginary. It is removed.
- **#4** previously read `unblocks: ["C1 run"]` — a prose string, not a node id, pointing at a
  node that did not exist. That node is **E8** and it now exists.
- **#5** previously froze the shot ids in **F6, cut rank 1**, and declared them unblocking **D4,
  cut rank 0 and human-gated** — with no edge, so `--check-cuts` could not see it. **F0** (cut 0)
  now owns the freeze and both edges are hard.

Freeze #1 is the one that matters. It is named in `webmcp-agent-team.md` as the **only** strong
coupling between I2 and I3. Its commit must start with `freeze:`; any later edit requires a PM
deviation ticket referenced in the commit body, and more than two such edits is a falsification
signal (§9). **The filename is singular, and the directory is `erp/contracts/` (R-17).** There is
**one** freeze mechanism: `sha256sum -c erp/contracts/FREEZE.md`, run **from the repository root**
so the paths inside resolve, asserted in S10's accept. Any per-contract wall-clock deadline in a
sibling document is a third mechanism and is not authoritative.

**S10 freezes the contract files where they already are.** They are pre-existing planning
artifacts; L0 does not move or copy them and no node lists one as an output. That is the whole of
the fix for the two-vocabulary defect — `erp/contracts/**` and a bare `contracts/**` were both
live for the same files, and nothing said which one L0 was supposed to produce. Per R-28 the
freeze is stated as *every file listed in `erp/contracts/FREEZE.md`*, never as a count: there are
eight today, nine once V5 lands `erp/contracts/probe-verdict.schema.json` on Day 0.

---

## 7. File ownership

**The rule, quoted verbatim from `graph.json.conventions.ownership_rule`:**

> "A seat may write a path if EITHER (a) it owns a node that lists that path in `outputs`, OR
> (b) the longest-matching glob in `file_ownership` names it. **(a) beats (b).**
> `tools/check-ownership.mjs` (G0) implements exactly this and nothing else. This replaces the
> previous glob-only rule, which mechanically rejected 23 of the graph's own node outputs."

**The glob list itself lives in `graph.json.file_ownership` and is not restated here.** Every
charter's "You own, by path" block is *generated* from that list plus this rule and is never
hand-written; generating it is a G5 check. **There is now exactly one contracts glob,
`erp/contracts/**`; the bare `contracts/**` is deleted** (R-17). `erp/PATHS.md` additionally
splits its Owner column into **glob owner** and **writing seat**, which disagree on **57 of the
150 comparable rows** of its 166 (recounted in v2.3.0; the earlier "51 of 157" reproduced neither
figure, and four rows had the writing seat copied into the glob column) — that disagreement is rule (a) beating rule (b), and it is meant to be legible rather than
surprising. For the path-by-path view — canonical path, owner,
producing node, and the aliases to eradicate — read **`erp/PATHS.md` §2**, which is the authority
on every literal path in the project.

Two consequences worth stating in prose, because they are what the old hand-written matrix got
wrong:

- **`tests/acceptance/**` defaults to QA, but a node's own outputs beat the glob**, so I3 writes
  `tests/acceptance/session.test.mjs` legitimately because S1 lists it. Without this rule every
  node's acceptance predicate would be blocked behind a single seat. Any charter that says "you
  must never touch `tests/`" is wrong and is regenerated.
- **`web/**`, `policy/**`, `public/**`, `deploy/**`, `submission/**`, `tests/curl/**` and
  `harness/findings/**` are dead vocabularies.** They match no glob in the matrix and no accept
  predicate anywhere. All sixteen charters briefed their seats against that tree, which means the
  ownership checker would have classified every single I2 commit as unowned and the first commit
  of the sprint would have been an ownership violation. `PATHS.md` §2 lists every one of them as
  an alias to eradicate.

---

## 8. The morning ready-set procedure

Run by whichever session opens the day, before any dispatch. Commands are quoted from
`PATHS.md` §3; do not type a path from memory.

```bash
cd /Users/calebwei/mcp/outpocket

# 1. What is unblocked right now? (nodes whose HARD inputs are all marked done)
node tools/ready.mjs
#    -> prints: id | title | owner | hours | cut | inputs-satisfied

# 2. Did anything drift structurally overnight?
node tools/ready.mjs --check-cuts             # cut invariant over every hard edge; must exit 0
node tools/ready.mjs --path                   # recompute the critical path from current hours
node tools/ready.mjs --check-accept-paths     # every path in any accept appears in some outputs
node tools/ready.mjs --check-freezes          # every unblocks id is a node with an edge from frozen_by
node tools/ready.mjs --check-tables           # every restated node/day table in erp/**.md == the authority
node tools/ready.mjs --check-schedule         # day(u) <= day(v) on every hard edge; no seat over 6.0 h/day
node tools/lint-layer0.mjs                    # banned identifiers / >500-char descriptions / banned wording
node tools/lint-layer0.mjs --assert-register  # the retracted-claims register still carries all five strings

# 3. Mark last night's completions, one at a time, only after the accept predicate ran green
node tools/ready.mjs --done T6        # appends to erp/graph.state.json with a timestamp

# 4. Ownership check on every open branch, from a FILE LIST, never an ambient diff
git diff --name-only origin/main...HEAD > /tmp/files.txt
node tools/check-ownership.mjs --seat I2 --files-from /tmp/files.txt
```

**Before G0 is green — which is every hour of Day 0 — none of this exists.** The fallback is not
"if G0 was cut"; it is "if G0 has not run yet". Do step 1 by hand: read §2's tables and mark a
node ready when every id in its `inputs` column that is *not* marked `(soft)` is already done.
`erp/graph.state.json` is produced by G0, so until then the completion list is whatever L1 is
keeping. **This is the reason L0 → G0 heads the graph.**

**Rules for the ready set:**

- A node enters the ready set only when every **hard** input is done. Soft inputs never block —
  the consumer records the absence instead.
- A blocked node must name the node it waits on. "Blocked" without a named node id is not a
  status, it is a stall, and W (overseer) files it as evidence.
- PM recomputes the critical path whenever any estimate changes by more than 50%. **Never assert
  the path from memory**; §4.1's answer was not the intuitive one, twice running, and both wrong
  answers were published by people who had done the arithmetic once.
- Human-gated nodes (**G1, V1, D4, D5, D6**) must be scheduled into the human's 2.5 h/day slot
  *explicitly, the day before*. They are the scarce resource (§4.2), they are irreducible (§5),
  and they cannot be absorbed by adding agent seats.

---

## 9. What makes this graph falsifiable

The plan is a set of predictions. Here is how to discover it was wrong while there is still time
to act, rather than on Day 5. Copied from `graph.json.falsification`.

| check (run it, do not estimate it) | if it trips, the plan was wrong because |
|---|---|
| **L0 is not green by the end of Day 0** | Nothing else can start. T6 cannot run its own accept, four Codex seats cannot boot, npm ci fails, and the plan is not in git. This is the single hardest stop in the graph and it is why L0 heads the critical path. |
| **H2's first-hour regression gate records `invokeToolRoundTrip:false` — no completed CDP `WebMCP.invokeTool` round trip on the installed Chrome under the flag** | The channel `harness/drive.mjs` executes through is gone on this browser, and lane E's mode question is reopened the same day. **Note what is no longer open, because this entry used to ask it:** page-API reachability under the flag is ANSWERED — MEASURED 2026-08-28, Chrome 152.0.7977.64, `getTools` and `executeTool` are both functions under either flag name, headed and under `--headless=new` alike, and the feared "lane E has no admissible mode" outcome did not happen. Two things this check must **not** be satisfied by: an un-awaited `getTools().length` (a Promise; the comparison is `undefined`) and `WebMCP.enable` returning OK (it returns OK in a launch with no page API at all). Only the round trip discriminates. Tell PM the same day; this is a Day-1 fact, not a Day-4 discovery. |
| **V1 reports ABSENT and no custom domain is registered by end of Day 2** | Judges reach a page with zero tools while every local test stays green. D2 becomes cut 0 immediately and the graph re-roots on DNS. |
| **T2 cannot show the 1->5->12->13 flips in a real Chrome by end of Day 3** | Kernel 1 is unfilmable. Note T2 now needs F1, S1 and S4, so 'by end of Day 2' was never achievable; Day 3 is the real gate. The first 10 seconds of the video fall back to H3 plus the server invariants. |
| **erp/contracts/violation.schema.json has been edited more than twice after its freeze commit** | Principle 7 was violated: the parallelism was speculative and every per-seat estimate downstream of S10 is wrong. Re-estimate before continuing. |
| **N-15 neg-commit-without-human passes (i.e. a synthesised sign_response commits) at any point after S5 lands** | The one-request forgery is live again: the server is verifying a client's claim about a human decision instead of owning the decision. Pull every provenance and signature claim from docs/DEVPOST.md and docs/VIDEO-SCRIPT.md the same hour. |
| **Any document states, in any wording, that a commit cannot be made without a HUMAN DECISION, or flags the sign-gate forgery as closed** | R-13 has been violated. N-16 neg-respond-without-click COMMITS today and the plan knows it: an attacker with the session cookie POSTs /respond itself with the digest the server just issued and every rejection code declines to fire. The only provable sentence is 'a commit cannot be made without a POST from the authenticated session to /api/sign/{id}/respond'. The confirm_token raises cost; it does not establish personhood, and its value is a function of open unknown V3. Delete the stronger sentence, do not weaken the test. |
| **More than 5.0 of the human hours are consumed by end of Day 2** | Fire V0, G5, G6, T4, D2, D3, F6, E5 that evening, then reassess against the reachable_thresholds table — not on Day 4 when it is too late to redirect the seats. |
| **Fewer than 14 of the 35 cut-0 nodes are done at end of Day 3** | The 29.5-hour path cannot land with review latency. Fire V0, G5, G6, T4, D2, D3, F6, E5, T3, T5, F3, F5, E1, E2, E3, E4, E6, E7, E8, E9, E10, V2, V3, V4, S7, S8 and F2 together — all 27, by id, per R-12, which forbids naming rank numbers in an operational trigger — and shoot the video on Day 4 instead of Day 5. Note that firing them does not shorten the path; it only buys review-overhead hours, so if the problem is the path, cut scope out of D4/D5/D6 instead. |
| **The ready set printed by tools/ready.mjs is empty on any morning while nodes remain** | The graph has a cycle or a stale state file. Either is a planning defect, not an execution one. |
| **Any document in erp/ restates a node table, a day table, a cut ladder, a path, a command or an hour estimate WITHOUT that restatement being proved equal to this file by `node tools/ready.mjs --check-tables`** | R-22. The failure that produced this revision is recurring. Seven writers each held a private copy of the node table and S10, E8 and lane E each existed twice. A restatement is LEGAL — GRAPH.md, EVAL.md §4, PLAN.md §6.3 and RISK.md §7.1 all restate legally, and all four reproduced exactly under re-verification — but only while a checker proves the equality mechanically. As written before this revision the rule forbade restatement outright and therefore fired against four of its own siblings while nothing checked them, so the agreement was hand-maintained and the rule was decorative. Regenerate the offending section from the authority; never reconcile it by hand. |
| **`node tools/ready.mjs --check-schedule` reports a hard edge u->v with day(u) > day(v), or any seat above capacity.seat_day_hours_cap on any day** | capacity.schedule_A has drifted from the graph or from its own cap. Three nodes were previously scheduled before their predicates could hold (F6, T4, H5), one was scheduled after both its consumers (V0), and three seat-days broke the 6 h assumption the capacity model quotes. Fix the schedule, not the assumption. |

**Twelve checks, and three of them are new this revision.** The seventh — *any document claims a
commit cannot be made without a human decision, or flags the sign-gate forgery as closed* — is the
one that protects the honesty of the whole submission: **N-16 commits today and the plan says so**
(R-13). The last two are the ones that protect this file and PLAN's day table: the restatement
rule is narrowed so that a restatement is legal *while a checker proves it equal*, and
`--check-schedule` is what would have caught F6, T4, H5 and V0 being scheduled where their
predicates could not hold.

The strongest falsifier of the **model** is the human-hours one: §4 argues the schedule is
human-gated rather than agent-gated, so if human hours are burning slower than 2.5/day the whole
cut ladder was unnecessary and nothing should have been fired. The strongest falsifier of **this
file** is the restatement rule.

---

## 10. Where the ground truth forced a contradiction with the skeleton

Recorded in `graph.json.contradictions_with_skeleton`, summarised here:

1. **G1 assumed no LICENSE exists.** MEASURED 2026-08-28: `/Users/calebwei/mcp/outpocket` already
   contains `.git`, a 1066-byte `LICENSE` and a 1376-byte `README.md`. HANDOVER §1's
   "no .git, no LICENSE, no README" describes **countinghouse**, not outpocket. G1 shrinks to a
   visibility flip plus About-box verification.
2. **G3 assumed `package.json` could be added to an existing setup.** MEASURED: countinghouse has
   **no** `package.json` at all and its 24 tests run under bare `node --test`; and `npm ci`
   against a lockfile-less `package.json` fails with `EUSAGE`. **L0** creates both files; G3 now
   verifies only what it was ever able to assert — that a stranger's clean clone is green. **And
   R-26 makes that assertable at all:** `G3` has a hard edge from `T6` and demands **zero**
   failures, which is true of `origin/main` only after `T6`'s fix is merged **and L1 has pushed
   that merge** — while `L0` gate (7) asserts the exact opposite, one named failure, of the
   pre-`T6` bootstrap commit.
3. **MEASURED: outpocket tracks exactly `.gitignore`, `LICENSE` and `README.md`.** No `src/`, no
   `tests/`, no `tools/`, no `harness/`, no `.team/`, no `~/.codex/*.config.toml`. Nothing in the
   previous revision created any of it. **L0** does.
4. **The V lane had no origin.** V1–V4 all require an HTTPS origin the skeleton never produced.
   Added **V5**.
5. **The graph had no interface freeze.** Added **S10**, in direct application of principle 7.
6. **The unknowns had no decision node.** Added **V6**.
7. **No OCF-1 implementation existed**, yet six frozen contracts publish digests over it. Added
   **S11**, scheduled first in lane S.
8. **No atomic sign lock**, so S6's TOCTOU closure was asserted rather than built. Added **S12**.
9. **No contracts conformance runner**, so no contract file under `erp/contracts/` was enforced
   by anything. Added **G6**.
10. **No blind grading *run* and no red-team output artifact**, so rulers C1 and C3 owned zero
    nodes. Added **E8** and **E9**.
11. **No mutation check**, so a negative-control suite could pass while asserting nothing. Added
    **E10**.
12. **The storyboard was produced by the rank-1 node that consumed it, and the video script was
    graded against itself.** Added **F0**.
13. **`tools/ready.mjs` — the tool the graph is operated with — sat inside the first cut.** Added
    **G0**.
14. **T6 encodes a design decision** that a planning document should not settle silently.
    HANDOVER §1 left options (A) and (B) open with a preference for (B). **R-9 ratifies (B)** and
    it is written into T6's acceptance predicate.
15. **The schedule was not owned by anything.** Six nodes were scheduled where their predicates
    could not hold or after their own consumers, three seat-days broke the graph's own
    6 h/seat/day figure, and one node's day disagreed across three documents. Added
    **`capacity.schedule_A`** as an authority block, plus `--check-schedule`.
16. **`erp/RUBRIC.md` was L2's only instrument and was produced by nothing.** It is now an
    **L0 output** at cut rank 0 (R-16), which is the entire reason the critical path moved from
    28.5 h to 29.0 h. (It moved again, 29.0 → 29.5, when v2.3.0 added the `V5 → S10` and
    `V5 → G6` hard edges; that one moved no estimate at all.)
17. **The sign gate's headline claim outran its state machine.** R-1 closed the one-request
    forgery; a two-request forgery survives it and **commits today**. The claim is narrowed to a
    POST from the authenticated session, N-16 records the outcome honestly, and the `confirm_token`
    is added as cost, not as proof (R-13). This is the one contradiction in this revision that is
    resolved by *weakening a claim* rather than by adding a node.

---

## 11. Standing wording discipline (carried from HANDOVER §5, enforced by G4)

Never written anywhere in this project, in any language:

- "the tool surface is the boundary" → use "the tool surface is the **intent** surface; the
  boundary is on the server"
- "**structural guarantee**" in any casing → the surface is a menu, not a lock, and it is
  page-enforced. Write "we spend prompt-cache efficiency to buy a **page-enforced workflow
  constraint**: the tool the agent would need is not on the surface until the state permits it.
  The boundary that actually holds is the server's per-request check (S2), not the surface."
- "we invented the deterministic policy contract" → Oracle Expenses REST already returns per-field
  `expenseErrors`; UCP has an isomorphic envelope
- "the human sign gate is our differentiator" → webmcpui claims that line publicly; only the
  **mechanism** (snapshot-digest binding + server-side re-canonicalisation + the atomic lock) is
  ours to claim
- "raw material does not reside in the system" → false for us; attachments are uploaded and stored
- "no binary channel is a structural guarantee" → it is **page-enforced**, not browser-enforced
- "revocation stops the call" → MEASURED: revocation blocks the *next* call, never the in-flight
  one
- "a stable prefix saves tokens" → MEASURED (**iron rule 15**): the opposite; a dynamic surface
  costs ≈1.25× prompt-cache write per flip
- "the surface changes **on the spot**" → until V2 returns `refreshes`, the honest phrasing is
  "on its next turn", and the storyboard re-prompts the agent after the flip
- "a specific **agent** was on the page" → **R-21, absolute:** WebMCP exposes no agent identity,
  the specification says the browser agent uses a different internal mechanism, and H3 is
  indistinguishable from a third-party agent at the tool boundary. Attest the **human**, the
  **snapshot** and the **call**. `a specific agent` is on the retracted register.
- "**a commit cannot be made without a human decision**" → **R-13.** The only provable sentence
  is *"a commit cannot be made without a POST from the authenticated session to
  `/api/sign/{request_id}/respond`."* N-16 `neg-respond-without-click` commits today — *today* meaning before the `confirm_token` ships with S5 on Day 3 (R-36), after which the same body is refused 403 `E_NO_CONFIRM_TOKEN` and that refusal is the control holding. Never flag
  the sign-gate forgery as closed.
- "**the five write tools**" → **R-20.** The count is **seven**, and it is computed from
  `annotations.readOnlyHint !== true`, never written down. `signature.schema.json`'s
  `x-freeze.does[0]` still says five and is wrong.
- "**16 rules**" → the measured count is **19** (`R01`–`R19`), 15 line-level plus 4 report-level
- any citation of **WindTunnel** or **arXiv 2508.09171** — both are disqualifying on contact

**The lint's exclusion list is a literal array in `tools/lint-layer0.mjs`, and it excludes
`erp/**`, `kb/webmcp/BANNED.txt`, `kb/method/BANNED-CITATIONS.md` and `.team/lint/banned.txt`** —
the files that quote banned strings *in order to ban them*. The documented failure mode is
deleting rows from the ban table to make the hook pass; `--selftest` exists so that cannot happen
silently. Everything not on that list is scanned, including README, video script, Devpost answers
and all product code.

Only two claims survived four adversarial rounds and may be asserted:
**(a)** every other route into the ERP requires minting a credential separate from the login
session, held and rotated by an intermediary — we add no new credential holder;
**(b)** the site can attest to co-presence and turn that attestation into auditable evidence —
specifically, that a **specific authenticated human** reviewed a **specific canonical snapshot**,
that the write arrived through the tool surface rather than the UI, and that what was persisted is
byte-identical to what the human saw.

**And claim (b) has a stated edge, which is the last thing written in this file on purpose.** The
sign gate proves *"a commit cannot be made without a POST from the authenticated session to
`/api/sign/{request_id}/respond`"* — no more than that. It does not prove a person clicked. R-1
took the attacker's ability to choose the name and the timestamp; what it left behind is a record
that can be a **true attribution of a false event**, indistinguishable from a real click. The
`confirm_token` raises the cost and its value depends on unknown **V3**. Write that down before a
judge does.
