# Executability audit — `/Users/calebwei/mcp/outpocket/erp/`

Simulated as a fresh session with this directory and nothing else. Every command below was actually run; results are quoted, not predicted.

---

## A. Walk of Day 1 (2026-08-29), step by step

`PLAN.md §6` Day 1 = **G1 G2 G3 G4 G5, V0 V1 V2 V3 V4, H1 H2, T6**. Each ✋ is a hard stop where I would have to ask you a question.

| # | Step | What happens |
|---|---|---|
| 1 | Day-0 carry-in: boot 16 seats with `--append-system-prompt-file .team/charters/<seat>.md` | ✋ `.team/` does not exist. `TEAM.md §1` has the `ln -sfn` command, but `PLAN.md §0`'s mandatory read order never names TEAM.md, and no node creates the symlink. |
| 2 | Boot C1–C4 with `codex exec -p <profile>` | ✋ `ls ~/.codex/*.config.toml` → **no matches**. `TEAM.md §9.4` admits this ("a Day-0 blocking chore") but it is not a node, has no hours, and is not in Gate D0. 4 of 16 seats cannot boot. |
| 3 | Gate D0: "`ls erp/*.md` lists PLAN, GRAPH **and the charter set**" | ✋ Ran it: lists 7 files, none of them charters (charters are in `erp/charters/`). The gate as written can never pass. |
| 4 | `GRAPH.md §8` morning ready-set: `node tools/ready.mjs` | ✋ Does not exist. Produced by **G5 — a Day-1 node**. Same for `tools/lint-layer0.mjs` (G4, Day 1) and `erp/graph.state.json` (G5). The procedure that computes Day 1's work requires three artifacts built during Day 1. §8's only fallback is "if G5 was **cut**", not "if G5 is not built yet". |
| 5 | Start **T6** (first node in the graph, first on the critical path) | ✋ Accept is `npm test -- surface`. `/Users/calebwei/mcp/outpocket` has no `package.json`, no `tests/`, no `src/`. `package.json` comes from **G3, whose declared input is T6**. Circular. |
| 6 | Where does T6 write? | ✋ Outputs `src/tools.js` + `tests/surface.test.mjs`. The ownership matrix has no glob for `src/tools.js`; I2's own charter says it owns `web/tools/**`, `web/surface.js`. Three answers, and the first commit of the sprint is an ownership violation under G5. |
| 7 | Get the red test | ✋ It lives at `countinghouse/tests/surface.test.mjs:28` (confirmed present). No node instructs anyone to copy `countinghouse/tests/` or `countinghouse/src/` into outpocket. G3 lists `tests/**` as an output but is gated behind T6. |
| 8 | Freeze #1 — `contracts/violations.schema.json`, deadline "end of Day 1" | ✋ **S10 is not on Day 1's node list, or any day's.** T1, S1, S4, S8 all hard-block on it. |
| 9 | Find the schema to freeze | ✋ 29 references across PLAN/GRAPH/TEAM/graph.json/3 charters say `contracts/violations.schema.json`. The file on disk is `erp/contracts/violation.schema.json` — different directory, singular filename. S10's accept (`git log -1 … -- contracts/violations.schema.json`) matches nothing, forever. |
| 10 | Read CONTRACTS.md for the schema | ✋ `CONTRACTS.md §12` defines **S10 = "report revision counter + atomic sign lock", owner I3, inputs S1 S5**. `graph.json` defines **S10 = "Freeze the I2/I3 contracts", owner L1, input T6**. Same id, two different nodes, on the critical path. |
| 11 | Run S10's checker | ✋ `tools/validate-contracts.mjs` is produced by no node; it needs ajv; there is no `package.json` to declare it. |
| 12 | Start the V lane | ✋ **V5 is not on any day's list**, yet V1 and H2 hard-depend on it. V5 requires standing up a live HTTPS origin — no host, account, or domain is named anywhere (D-08 names Render only for D1). |
| 13 | Write a V verdict | ✋ Four incompatible specs: I1's charter says `harness/findings/V<n>.md` (QUESTION/VERDICT/GRADE/HOW/SAW/MEANS); graph.json says `evidence/V0.json` with `{chromeMajor, navigatorAlias, documentPresent, method}`; V6 requires `evidence/UNKNOWNS.md` with rows keyed **T0–T4**; PLAN's Day-1 gate greps `erp/VERIFY.md` for `^\| V[0-4] `. |
| 14 | Run **V0** | ✋ V0 asks "does `navigator.modelContext` survive on Chrome **151**". Installed: `Google Chrome 152.0.7977.64`. The question as framed is about a version that isn't here, while D-10 mandates building against the installed one. |
| 15 | Run **G1**, exact accept command | ✋ Ran it: `gh repo view … -q '.visibility + " " + .licenseInfo.spdxId'` → **`PRIVATE`**. `licenseInfo` exposes `key`/`name`/`nickname`, not `spdxId`. After the flip this emits `"PUBLIC "`, never `"PUBLIC MIT"`. A rank-0 node whose predicate is unsatisfiable. Also G1 says "**both** repos"; three exist and all are private. |
| 16 | Run **G2** | ✋ Hard input is **F1 (Day 3)**; accept POSTs to a live `/api/login` (S1 Day 3, D1 Day 5). Cannot start on Day 1. |
| 17 | G2's credentials | ✋ F1 requires personas `chen,ruiz,third` and `[data-persona]` count == 3. `contracts/eval-case.schema.json:26` freezes `persona` to `["none","chen","ruiz"]`. G2 requires role coverage `{employee, auditor}` = 2. The third persona has no name, role, or credential. |
| 18 | Run **G3** | ✋ Ran `npm ci` against a lockfile-less package.json: `npm error EUSAGE … can only install with an existing package-lock.json`. No node produces a lockfile. This same command is also in PLAN's Day-1 gate, QA's charter bar 3, and I4's charter bar for G3. |
| 19 | Run **G4** | ✋ Consumes `kb/webmcp/BANNED.txt`, owned by **K1 — a seat with zero nodes, zero hours, and no appearance in any day**. Also `PLAN.md §0` requires G4 to carry an allowlist for `erp/PLAN.md`; that requirement is in prose only, not in G4's accept. |
| 20 | Run **G5** | ✋ It enforces a matrix that (mechanically checked, below) rejects 23 of the graph's own node outputs and has no rule for 24 more. |
| 21 | Run **H1** | ✋ Accept asserts `tests/acceptance/launcher.test.mjs`; I1's charter says "you must never touch `tests/`"; the matrix gives `tests/acceptance/**` to QA. |
| 22 | **Gate D1**, 4 commands | ✋ (1) `curl -sI …/outpocket` → ran it, `HTTP/2 404` (G1 fixes). (2) `npm ci` → fails, see 18. (3) `grep -c … erp/VERIFY.md` → file does not exist and **no node produces it**. (4) `node --test tests/surface.test.mjs` from an unstated cwd. **The Day-1 gate cannot pass even if all Day-1 work is done perfectly.** |

**22 stops on day one.** The first eight occur before any code is written.

---

## B. Numbered defects, most severe first

**1. Two incompatible filesystem vocabularies. (Blocks every seat, every day.)**
The graph/matrix/accept-predicates use `src/page/**`, `src/page/tools/**`, `src/page/ui/**`, `src/policy.js`, `tests/acceptance/**`, `docs/STORYBOARD.md`, `docs/DEVPOST.md`, `.github/**`, `evidence/**`. The charters brief their seats on `web/**`, `web/tools/**`, `web/surface.js`, `web/probe.js`, `policy/**`, `tests/curl/**`, `submission/storyboard.md`, `deploy/**`, `.githooks/**`, `harness/findings/**`, `QA-STATUS.md`. There is **zero overlap** for the front-end, the policy document, the curl tests, the storyboard, the deploy artifacts and the hook directory. Every seat is briefed against a tree the enforcement tool has never heard of.
*Fix:* pick one (the graph's — it is what the accept commands execute) and rewrite the "You own, by path" block of all 16 charters to quote the matrix verbatim. ~40 lines of edits.

**2. The one frozen contract does not exist at the name its consumers use.**
`contracts/violations.schema.json` (29 refs, 7 files) vs the delivered `erp/contracts/violation.schema.json`. Wrong directory **and** wrong filename. S10's accept, L1's `sha256sum -c contracts/FREEZE`, I2's and I3's charters, and freeze #1 all target a path that will never exist.
*Fix:* global rename to `erp/contracts/violation.schema.json`, or move+rename the file. One `sed`, but it must be done before Day 1 09:00 (CONTRACTS.md's own C1 freeze time).

**3. `S10` is two different nodes.**
`graph.json`: freeze the I2/I3 contracts, owner **L1**, input T6, 1.5 h, second on the critical path. `CONTRACTS.md §12`: report revision counter + atomic sign lock, owner **I3**, inputs S1 S5, 2 h. Both are rank 0. `graph.json` is declared the authority, which silently deletes a node CONTRACTS.md argues is load-bearing for S6's TOCTOU closure ("without S10 that property is asserted, not built").
*Fix:* renumber the CONTRACTS.md node to `S12`, add it to `graph.json` with edges S1→S12, S5→S12, S12→S6, and schedule it on Day 4.

**4. Five horizon-A nodes appear in no day of the schedule.**
Mechanically: **S10, V5, V6, E4, D2**. S10, V5 and V6 are **rank 0**. V5 hard-blocks V1 and H2 (both Day 1). S10 hard-blocks T1, S1, S4, S8. V6 hard-blocks D5 (submission). E4 is the entire blind-verifier ruler.
*Fix:* Day 1 = `+V5 +S10`; Day 3 = `+E4`; Day 5 = `+V6`; D2 explicitly parked.

**5. Day 2's gate is not reachable from Day 1's outputs — the graph is missing three hard edges.**
T2 (rank 0, critical path) accepts on: drive a real Chrome, `getTools()` after each state transition, assert 1→5→12→13, and assert `submit_expense_report` vanishes *when a blocking violation appears*. Its declared inputs are only T1 and H1. It silently needs **F1** (there is no HTML page until F1), **S1** (no server to serve it), and **S4** (no violation to introduce) — all scheduled **Day 3**. Recomputing with those three edges added: the critical path is **22.5 h, not 19.5 h**, and reroutes `T6 → S10 → S1 → F1 → T2 → H3 → H6 → D4 → D5 → D6`.
*Fix:* add edges F1→T2, S1→T2, S4→T2; re-run `--path`; move T2/T5/H3 to Day 3 and S1/S3/S4/F1 to Day 2.

**6. `PLAN.md §6`'s critical path is not a path in this graph, and the plan's own rule voids the day table on Day 0.**
Of the 10 edges in `V1 → T1 → T2 → S1 → S2 → S5 → S6 → E6 → D1 → D4 → D5`, **5 do not exist** (V1→T1, T2→S1, S2→S5, S6→E6, E6→D1). It is ~29 h against GRAPH's computed 19.5 h. PLAN §6 states: "If GRAPH.md's computed path differs from this by more than 4 hours, GRAPH.md wins and PM re-issues the day table." The difference is 9.5 h. **The day table a fresh session is told to walk is invalid before Day 1 begins, by the plan's own rule.**
*Fix:* delete PLAN §6's chain and regenerate the day table from `graph.json`.

**7. `G1`'s acceptance predicate can never pass. (Verified by execution.)**
`gh repo view … -q '.visibility + " " + .licenseInfo.spdxId'` → `PRIVATE`. `licenseInfo` has no `spdxId`.
*Fix:* `gh api repos/Caleb0796/outpocket -q '.visibility + " " + .license.spdx_id'` — verified to print `MIT` today. (D6's accept already uses the correct form; G1's does not.)

**8. `npm ci` is specified in four places and fails deterministically. (Verified.)**
`npm error EUSAGE … can only install with an existing package-lock.json`. G3's outputs are `package.json` and `tests/**` — no lockfile.
*Fix:* add `package-lock.json` to G3's outputs and `npm install && git add package-lock.json` to its body; or change all four call sites to `npm install`.

**9. Nothing bootstraps the repository, and the plan itself is not in git.**
`git ls-tree -r HEAD` → `.gitignore, LICENSE, README.md`. `git status` → `?? erp/`. **All 32 planning documents are untracked and unpushed**, despite the commit message "Initial commit: license, readme, plan directory". Any seat working in a `git worktree` (mandatory for C2/C3/C4 per L1's charter) gets a tree with no plan in it. Missing with no node creating them: `package.json`, `package-lock.json`, `tests/`, `src/`, `.team/`, `~/.codex/*.config.toml`.
*Fix:* `git add erp && git commit && git push` plus a Day-0 bootstrap node.

**10. The ownership matrix rejects the graph's own work.**
Mechanically checked every node output against every glob: **23 outputs are written by a seat that does not own the glob** — including `package.json` (G3/QA vs I4), `src/tools.js` and every `evidence/*` file written by I4, PM or QA (matrix: I1), 9 files under `tests/acceptance/**` written by I3/UX/I4 (matrix: QA), `.github/workflows/eval.yml` (E6/C4 vs I4), all three `evals/blind/*` (E4/L2 vs C4), `contracts/session.contract.md` (S1/I3 vs L1). A further **24 outputs match no glob at all** — `artifacts/tools.export.json`, `docs/VIDEO-SCRIPT.md`, `src/page/index.html`, `src/page/fallback-agent.js`, `tools/check-toplevel.mjs`, `tests/fixtures/**`, `.githooks/**`, everything under `web/`. GRAPH §7's stated justification for splitting the tests ("without that split, every node's acceptance predicate would be blocked behind a single seat") is contradicted by its own data.
*Fix:* run this check as part of G5 and add the missing globs; either widen `tests/acceptance/**` to "the owning seat writes, QA reviews" or move those 9 files out of it.

**11. Gate commands drift from accept predicates on every single day.**

| Day | PLAN gate says | graph.json / charters say |
|---|---|---|
| 1 | `erp/VERIFY.md` | `evidence/UNKNOWNS.md` (rows `T0–T4`) / `harness/findings/V*.md` |
| 2 | `drive.mjs --assert-surface` | `--assert-flips` |
| 2 | `tools.export.json` | `artifacts/tools.export.json` / `outpocket/tools.export.json` (EVAL.md) |
| 3 | `tests/curl-escalation.sh` | `tests/acceptance/curl-403.sh` / `tests/curl/**` (I3 charter) |
| 4 | `tests/sign-gate.test.mjs` | produced by no node; S5/S6 accept via `drive.mjs --scenario sign` + `tests/acceptance/toctou.sh` |
| 5 | `node eval/run.mjs` | `.github/workflows/eval.yml` + `bin/eval.mjs` in the eval-kit |
| 5 | `https://<live-host>` | unresolved placeholder |
| 6 | `video/outpocket.mp4` | `video.mp4` (graph) / `submission/demo.mp4` (I4 charter) |

*Fix:* generate PLAN §6's gate blocks from `graph.json`'s `accept` fields; never hand-write a second copy.

**12. Three more hard inputs are scheduled after their consumers.**
`G2 (Day 1) ← F1 (Day 3)`; `H4 (Day 2) ← S9 (Day 4)`; `F2 (Day 3) ← S8 (Day 4)`.
*Fix:* falls out of regenerating the day table by topological order (defect 6).

**13. `CONTRACTS.md` and `EVAL.md` reference five node ids that do not exist in the authority.**
`S0, S11, G6, E8, E9`. S11 ("OCF-1 canonicaliser + vector test") is declared **"scheduled first in lane S… every digest in the system depends on it"** and is rank 0 — it is in no graph, no day, no capacity model. `EVAL.md §8` is titled "E4 / E8".
*Fix:* add S11/G6/E8 to `graph.json` with edges and hours, or strike CONTRACTS §12 and EVAL's E8 references.

**14. Two documents give I3 opposite instructions about money.**
`I3.md`: "Port `policy.js` (250 lines, 16 rules, **integer cents** — keep integer cents)." `CONTRACTS.md §13.1`: "**Float FX rates must go.** `countinghouse/src/policy.js:28` is incompatible with a canonical form… Integer micro-USD, and the port (S3) carries the migration." Confirmed on disk: `export const FX = { USD: 1, EUR: 1.09, GBP: 1.28, CNY: 0.14, JPY: 0.0067 }` — floats. Migrating the FX layer to integer micro-USD and re-deriving every digest is not a 1.0 h "port", and S3's accept predicate (`GET /api/policy` reports 16 rules) would not detect whether it happened.
*Fix:* PM ruling on Day 1; if micro-USD wins, S3 goes to 3.0 h and its accept must assert the vector suite in `contracts/canonical-vectors.json`.

**15. The third persona does not exist.**
F1 requires `chen,ruiz,third` and `[data-persona]` count == 3; the frozen `eval-case.schema.json` permits `["none","chen","ruiz"]`; G2 requires roles `{employee, auditor}`. `"third"` is a placeholder that reached an acceptance predicate.
*Fix:* name it (role, login, password) in `server/personas.json` and add it to the frozen enum, or change F1 to `count == 2`.

**16. `RISK.md` ships a second, incompatible cut ladder and a second, incompatible calendar.**
RISK has **10 ranks**; GRAPH has 4. RISK's never-cut set omits nodes GRAPH marks rank 0 (S9, S10, V5, V6, T6, S3, S4, H4). RISK says "Day 6 = 2026-09-03, freeze at **09:00 PT**… only D5 and D6 may run" — PLAN schedules **D4 (the 4.0 h video, rank 0) on Day 6**. RISK's Day-1 trigger requires "the V1 probe page deployed to the **production** origin"; GRAPH's V5 is explicitly a throwaway origin and production (D1) is Day 5. RISK says "GRAPH wins", which makes 10 ranks and 11 trigger rows into instructions that must never be followed — and RISK is the only document with day-by-day triggers, so it is what a PM will actually reach for.
*Fix:* delete RISK §7's ladder, keep only the trigger table, and re-express each trigger in GRAPH's 4 ranks. Reconcile Day 6.

**17. A rank-0 design requirement exists in exactly one document that its owner is not told to read.**
`RISK.md §4/V4`: "`S5` **must be written with both modes behind one switch from the start**" (suspend-until-signed vs two-call `{status:"awaiting_signature", ticket}` handshake). Absent from S5's accept, notes, and I3's charter. `PLAN.md §0` tells seats to read "only the ones for your lane", and RISK is not assigned to a lane. If V4 returns "times out at 30 s" on Day 1, S5 is rewritten on Day 4. Same shape: RISK's V3 fallback costs "~1 hour in S1", which S1's 2.5 h has no room for.
*Fix:* move both contingencies into S5's and S1's `notes` in `graph.json`.

**18. QA's only coverage check is a no-op. (Verified.)**
`grep -o '^  [A-Z][0-9]' erp/GRAPH.md` returns **0 matches** (ids are in `| G1 |` table cells, not two-space-indented). The `comm` therefore prints nothing and the check passes vacuously with zero tests written.
*Fix:* `grep -oE '^\| [A-Z][0-9]+ \|' erp/GRAPH.md | tr -d '| '` — returns 62.

**19. Seven referenced `erp/*.md` files do not exist and no node creates them.**
`VERIFY.md` (Day-1 gate), `RUBRIC.md` (**L2's only instrument** — "your rulings must cite a clause in `erp/RUBRIC.md`"), `OWNERS.md` (cited by L1, I4 and TEAM §7 as the ownership authority; the matrix actually lives in GRAPH §7 and `graph.json`, and I4's charter claims to *own* `erp/OWNERS.md` while the matrix assigns `erp/*.md` to PM), `DEBT.md`, `DECISIONS.md`, `STORY.md` (EVAL says L2 reads it; GRAPH says `docs/STORYBOARD.md`; UX says `submission/storyboard.md`), `VERDICTS.md`.
*Fix:* either create stubs on Day 0 or repoint each reference at the file that actually holds the content.

**20. Two ordering mechanisms for the same freeze.**
`L1.md`/`TEAM.md §7`: `sha256sum -c contracts/FREEZE`. `graph.json` S10: `git log -1 --format=%s` matching `^freeze:`, with outputs `contracts/FREEZE.md`. `CONTRACTS.md §2` gives a third: per-contract wall-clock deadlines (C1 at 2026-08-29 **09:00 PT**) — but C1's declared producer is **S4, scheduled Day 3**, so a Day-1-morning freeze deadline sits two days ahead of its producer. TEAM §7 also names the I2/I3 coupling as **T4/T5 ↔ S3/S4**; GRAPH names it **T1/T3 ↔ S4/S8**.
*Fix:* one mechanism (`contracts/FREEZE` with sha256), one coupling definition, and move C1's freeze to after S4.

**21. Five of sixteen seats own zero nodes.**
`W, C1, C3, K1, K2`. No node ids, no hours, no line in the 88.0 h capacity model, no day assignment. Yet PLAN §6 Day 3 says "this is the day the red team (**C3**) is pointed at the boundary"; G4 hard-consumes K1's `BANNED.txt`; the merge gate hard-requires `kb/pits/<node>.md`; W's stall polling, the deviation ledger and the inbound-log topology check are all load-bearing in TEAM.md. `tests/redteam/**` (C3) and `kb/**` appear in charters but `tests/redteam/**` is absent from the matrix entirely.
*Fix:* give each of the five at least one node with an acceptance predicate and hours, or state plainly that they are unbudgeted overhead and remove G4's dependency on K1.

**22. The capacity model reports failure and nothing acts on it.**
GRAPH §4.2 computes 14.4 human-hours required against 13.75 available — "**It does not fit — deficit 0.65 human-hours… with zero tolerance for a video re-shoot**" — then recommends PM "settle it on Day 1". No node, no gate, no decision row. Meanwhile PLAN schedules D4 (4.0 h, 29% of the entire human budget) on the final day, and RISK freezes at 09:00 that day.
*Fix:* make it D-17 in the decision log with a value for the daily human budget, and move D4 to Day 5 with Day 6 reserved for D5/D6 only.

**23. Version pinning is inconsistent with the machine.**
Installed: **Google Chrome 152.0.7977.64**. D-07 asserts revocation semantics "(Chrome 153+)" while D-10 mandates building against the installed version — so T2's rank-0 revocation behaviour is unmeasured on the only browser present. H5's accept requires Chromium <153 to render `[data-warn="chrome-lt-153"]`, i.e. **the demo shows a warning banner throughout the video**. V0 asks a question about Chrome 151.
*Fix:* re-anchor D-07 and H5 to 152, and restate V0 as "alias status on the installed major" (its accept already records `chromeMajor` — only the prose is wrong).

**24. Ceremonies with no owner-hours.**
`kb/pits/<node>.md` per merge (blocks every merge), `.team/deviations/DEV-*.md`, `.team/log/inbound-*.jsonl`, `.team/stalls.md`, `.team/contracts/*.txt` (L1 must write one per node — 59 of them), `.team/charters` symlink, K1/K2 Day-0 KB seeding, C1's `blind-packet/tasks.md`. None is a node; none has hours; none appears in the 88.0 h total; no node creates `.team/`.
*Fix:* one Day-0 node `L0` (owner L1) creating the whole `.team/` tree, and either budget the pit-entry ritual or drop it from L1's merge gate.

---

## C. What is actually sound — do not re-derive it

Verified by execution, not reading:
- `graph.json` is internally consistent: **59 nodes, 84 edges, acyclic, every node's `inputs` list matches its inbound edges exactly (0 mismatches)**.
- The computed critical path reproduces exactly: **19.5 h, `T6→S10→T1→T2→H3→H6→D4→D5→D6`**. Total horizon-A work **88.0 h**; the per-seat table (I1 19.0, I3 16.5, UX 16.0, I4 9.5, C4 9.0, I2 8.5, QA 4.0, L1 3.0, L2 1.5, PM 1.0) reproduces to the decimal.
- The cut invariant `key(u) ≥ key(v)` holds over all 84 hard edges: **0 violations**, as claimed.
- `countinghouse/src` is exactly as D-03 describes: `tools.js` 401, `erp.js` 425, `policy.js` 250, `scenarios.js` 187, `samples.js` 133 = **1,396 lines**, and `tests/surface.test.mjs` + `tests/policy.test.mjs` exist.
- D6's `gh api … -q .license.spdx_id` works today (returns `MIT`).
- The charters' *content* is strong: each carries several things its seat could not have guessed — I1's `WebMCP` vs `WebMCPTesting` flag split, the silent `undefined` on `192.168.x.x`/`.local`, CDP screenshot latency as frame quantisation, "all measurements were taken with no agent connected"; QA's "a hint is not a property → FAIL-BY-CONSTRUCTION even when the test is green"; C1's information-theoretic blindness argument; C3/C4's stale-tutorial warning with exact spec dates; K1/K2's "failed attempts are unrecoverable from finished code". **The failure is wiring, not prose.** Fixing defect 1 preserves all of it.

---

## D. Verdict

**NOT-EXECUTABLE.**

Smallest change that flips it: **add one Day-0 node `B0` (owner L1, ~3 h) that (a) declares `erp/PATHS.md` — one table binding every literal path, filename and command in the project to a single canonical value, taken from `graph.json` — and rewrites the "You own, by path" block of all 16 charters and PLAN §6's gate blocks to quote it; (b) adds the three missing hard edges `F1→T2`, `S1→T2`, `S4→T2`, schedules the five orphan nodes (S10, V5, V6, E4, D2), and regenerates PLAN §6's day table in topological order from `graph.json`; (c) creates the tree it names — `git add erp`, `package.json` + `package-lock.json`, `tests/` ported from countinghouse, the `.team/` skeleton, the four `~/.codex/*.config.toml` profiles; and (d) fixes the two verified-broken commands (`G1`'s `spdxId` → `gh api … .license.spdx_id`, and QA's charter grep).**

Everything else in the numbered list is then a same-day PM ruling rather than a blocker — except defect 14 (integer cents vs micro-USD) and defect 15 (the third persona), which need a human answer before S3 and F1 are dispatched.