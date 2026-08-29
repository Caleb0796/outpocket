I have everything I need. Compiling the report.

## VERDICT

`graph.json` **as a standalone file is sound**: parses, 59 nodes with all 11 required fields, 84 edges, zero dangling references, zero duplicate ids, **no cycles** (full topological sort below), critical-path arithmetic **exactly correct**, per-seat hour table **exactly correct**, cut-ladder hours **exactly correct**, and the hard-edge cut invariant **genuinely holds, 0/84 violations**. Someone did the arithmetic.

It fails as an *executable artifact* because four sibling documents that describe the same graph disagree with it on node identity, ownership, cut rank and schedule — and because the graph's own instrumentation does not exist.

Topological order (Kahn, all 84 edges, deterministic tie-break):
`G1 G4 G5 H1 T6 G3 S10 S1 F1 F3 G2 S2 S3 S4 S5 F4 S6 S7 S8 F2 S9 D1 D2 D3 H4 T1 T2 F5 F6 H3 T3 T4 T5 E4 E5 V0 H5 V5 H2 E1 E2 E3 E6 E7 H6 D4 V1 V2 V3 V4 V6 D5 D6 X1 X2 X3 X4 X5 X6`

---

# Defects

### 1. FATAL — `S10` is two different nodes in two authority-claiming documents
- `graph.json:396-406`: S10 = "Freeze the I2/I3 contracts", owner **L1**, inputs `[T6]`, 1.5 h, lane S.
- `CONTRACTS.md:629` (§12 table): S10 = "report revision counter + atomic sign lock", owner **I3**, inputs `S1 S5`, 2 h.

S10 is the **second node on the critical path** and the Day-1 interface freeze that gates T1, S4 and S8. A seat dispatched "S10" gets a schema freeze or a mutex depending on which file is open. `graph.json:5` says "this file is the authority", but CONTRACTS.md §12 does not defer to it — it presents S10 as one of its own four added nodes.
**Fix:** renumber the CONTRACTS.md node to `S12` and add it to `graph.json` with an `S1,S5 → S12 → S6` edge, or delete it and fold the atomic-lock requirement into S6's accept.

### 2. FATAL — four nodes exist only in sibling docs; two of them collide on `E8`
`CONTRACTS.md:628-631` and `EVAL.md:186-191` define **S11, G6, E8, E9** in the same full-field table format (owner, inputs, accept, hours, cut, horizon). None is in `graph.json`. Worse, `E8` is itself two nodes:
- `CONTRACTS.md:631` — E8 = "mutation check for the negative controls", owner **C4**, 3 h, cut 2.
- `EVAL.md:190` — E8 = "C1 blind grading **run**", owner **C1**, 1 h, cut 3.

Consequence: `agent_hours_total_A: 88` (`graph.json:98`) is wrong by 8-10 h, and every downstream number (review overhead 4.4, required 14.4, the DOES-NOT-FIT verdict) moves with it.
**Fix:** merge S11/G6/E9 and one E8 into `graph.json` with edges, then recompute `capacity`; or strike §12 of CONTRACTS.md and §4's added rows in EVAL.md.

### 3. FATAL — lane E disagrees with `graph.json` on every node, including cut rank
`EVAL.md:180-192` vs `graph.json:441-497`:

| | graph.json | EVAL.md |
|---|---|---|
| E1 | inputs `[H2]`, 1.5 h, **cut 2** | inputs `H2,T5`, 2 h, **cut 0** |
| E2 | inputs `[E1,T5]`, 2 h, **cut 2** | inputs `E1,T1,T2,T3,S1,S2`, 3 h, **cut 0** |
| E3 | inputs `[E1,T2,S2,S6]`, 2 h, **cut 2** | inputs `E2,S2,S5,S6,T2`, 4 h, **cut 0** |
| E4 | owner **L2**, cut 2 | owner **C4**, cut 3 |
| E5 | inputs `[T5]`, 1 h, cut 1 | inputs `E1,T5`, 2 h, **cut 0** |
| E7 | inputs `[E6]`, 0.5 h, **cut 2** | inputs `E2,E3,E5,E8,E9`, 1 h, **cut 0** |

`EVAL.md:203` states "**E2 → E3 → E7 → D5 is on Sprint A's critical path**". `GRAPH.md:352` recommends "**fire rank 1 and rank 2 pre-emptively on Day 1**" — which deletes E1, E2, E3, E4, E6, E7. Following GRAPH.md's own recommendation on Day 1 deletes six nodes another document marks never-cut and critical-path.
**Fix:** one lane-E table wins. Given `graph.json`'s authority claim, rewrite EVAL.md §4 from it and delete EVAL.md's independent cut ordering at lines 209-212.

### 4. FATAL — `contracts/violations.schema.json` does not exist; the file is `violation.schema.json`
The file on disk is `/Users/calebwei/mcp/outpocket/erp/contracts/violation.schema.json` (singular). The plural form is named in **4 accept predicates** — T3 (`graph.json:298`), S4 (`:355`), S10 (`:403`), X2 (`:520`) — **3 edge contracts** (`:620, :633, :638`), the interface-freeze table (`:80`), the falsification register (`:695`), and in GRAPH.md, TEAM.md, PLAN.md, I2.md, I3.md, L1.md. Every one of those accept commands fails on a missing path.
**Fix:** one `sed -i '' 's|violations\.schema\.json|violation.schema.json|g'` across `erp/` — or rename the file. Do it before S10 freezes anything, because the freeze commit hashes the path.

### 5. The cut ladder reduces the critical path by exactly **zero**, at every rank
All nine critical-path nodes (T6 S10 T1 T2 H3 H6 D4 D5 D6) are `cut: 0`, so the depth is invariant under amputation. Recomputed longest hard-edge path, horizon A:

| after firing | depth | remaining A agent-hours |
|---|---|---|
| nothing | **19.5 h** | 88.0 |
| rank 1 | **19.5 h** | 78.0 |
| rank 2 | **19.5 h** | 63.0 |
| rank 3 | **19.5 h** | 52.5 |
| rank 4 | **19.5 h** | 52.5 |

`GRAPH.md:384-385` states rank 3 "drops only from 19.5 h to ~19.0 h — with F2/S8 gone the path reroutes through the H lane". **That reroute does not happen and 19.0 is a fabricated number** — F2 and S8 are not on the path and nothing reroutes. `graph.json:585` makes the softer claim ("barely shortens") which is also false; the correct word is *never*.
**Fix:** replace both sentences with the table above. The observation they were reaching for is real and stronger: *the ladder is a pure agent-hour instrument and cannot shorten the schedule at all.*

### 6. The ladder frees **zero** human-gated hours, which is the resource `graph.json` says is binding
All five `human_gated` nodes (G1 0.5, V1 2.0, D4 4.0, D5 2.0, D6 1.5 = **10.0 h**) are `cut: 0`. `capacity.verdict` (`graph.json:107`) reads "The binding resource is human hours, not agent hours. **Cut for human hours.**" The ladder cannot cut human hours — it only shaves the `0.05 × agent_hours` review term. The instruction is unexecutable as written.
**Fix:** state the reachable thresholds explicitly in `capacity`: rank 1 → 13.9 h required (still short), **rank 2 → 13.15 h (first rank that fits)**, rank 3 → 12.625 h. And name the 10.0 h as irreducible.

### 7. `human_hours_required: 14.4` double-counts, and the whole DOES-NOT-FIT verdict rests on 9 minutes
`graph.json:104` — overhead is `0.05 × 88.0 = 4.4`, but the 88.0 **includes the 10.0 human-gated hours**. The human does not review their own 10 hours at 5%. Correct: `0.05 × 78.0 = 3.9`; required = **13.9**, not 14.4; deficit **0.15 h, not 0.65**. Nine minutes, derived from a coefficient (`0.05`) that `graph.json` itself grades OUR-ESTIMATE. `GRAPH.md:355-357` half-concedes this ("if the human budget is genuinely 3 h/day... the full graph fits").
**Fix:** `human_hours_required: 13.9`, `human_hours_breakdown: "10.0 human-gated + 3.9 review overhead (0.05 × 78.0 non-human-gated agent-hours)"`, and downgrade the verdict from "DOES NOT FIT" to "fits or misses by 9 minutes depending on one unvalidated coefficient; PM settles the 2.5-vs-3.0 h/day question on Day 1 before cutting anything."

### 8. The classic error IS present — relocated out of the edge list where the checker cannot see it
Over hard edges the invariant holds cleanly (I re-derived it: **0 violations over all 84 edges**, matching `graph.json:11`). But `interface_freezes[4]` (`graph.json:88`) declares:

> `"artifact": "docs/STORYBOARD.md shot ids", "frozen_by": "F6", "unblocks": ["D4"]`

**F6 is cut rank 1. D4 is cut rank 0**, human-gated, 4 h, and the single largest human cost in the plan. There is **no F6→D4 edge** in the graph, so `--check-cuts` never sees it. Firing rank 1 — GRAPH.md's Day-1 recommendation — deletes the shot ids that the freeze table says D4 cannot start without.

Compounding it: **nothing produces `docs/STORYBOARD.md` before F6 needs it.** F6 *outputs* it (`graph.json:437`) and F6's accept *reads* it ("every shot id in docs/STORYBOARD.md resolves to a CSS selector"). And **D4's accept grades D4 against `docs/VIDEO-SCRIPT.md`, which D4 itself outputs** — a self-referential predicate. `GRAPH.md:353-355` prescribes the cure ("write `docs/VIDEO-SCRIPT.md` on Day 2, agent hours, free") but there is no node for it.
**Fix:** split a new `F0` (UX, ~1 h, cut 0) that authors `docs/STORYBOARD.md` + `docs/VIDEO-SCRIPT.md`; edge `F0 → D4` hard, `F0 → F6` hard; F6 keeps only the skin and the selector check. Then D4's accept grades an artifact it does not produce, and the rank-1 dependency disappears.

### 9. One soft edge carries the submission, and a sibling doc says it is hard and never-cut
`E7 (cut 2) → D5 (cut 0)`, kind **soft**, contract "the README results table" (`graph.json:688`). Soft is what exempts it from the invariant. But `EVAL.md:203` puts E7→D5 on the critical path with E7 at cut 0. Independently: D5's accept requires `tools/lint-layer0.mjs docs/DEVPOST.md` to report "**zero retracted claims**" — if rank 2 fires and the eval numbers vanish while DEVPOST still cites them, D5 fails on its own predicate. The graceful-degradation story is not written down anywhere.
**Fix:** add to the edge record `"degrade": "if E7 is cut, D5 removes the §Results section and DEVPOST cites T5's export instead"`, and make that removal part of D5's accept.

The other six soft violations are legitimate (`V0→H5`, `V0/V2/V3/V4→V6`, `E5→E6`) — the consumers genuinely record absence.

### 10. FATAL for the day plan — `PLAN.md`'s schedule omits 3 cut-0 nodes and asserts a path with a reversed edge
`PLAN.md:313` asserts the critical path `V1 → T1 → T2 → S1 → S2 → S5 → S6 → E6 → D1 → D4 → D5` at "~29 serial hours". Checked link by link:

```
V1 -> T1 : NO EDGE          S5 -> S6 : ok
T1 -> T2 : ok               S6 -> E6 : NO EDGE
T2 -> S1 : NO EDGE          E6 -> D1 : *** REVERSED — graph has D1 -> E6 ***
S1 -> S2 : ok               D1 -> D4 : ok
S2 -> S5 : NO EDGE          D4 -> D5 : ok
```
Five of ten links are not edges, one runs backwards, and the hours sum to 26.5, not 29. `PLAN.md:308-309` contains its own trip-wire — "If GRAPH.md's computed path differs from this by more than 4 hours, GRAPH.md wins and PM re-issues the day table" — 19.5 vs 29 is 9.5 h. **The trip-wire fired and the day table was never re-issued.**

The six-day table (`PLAN.md:331,348,363,372,379,391`) **never schedules five horizon-A nodes**:
- **V5** (cut 0) — hard input to V1 *and* H2, both scheduled Day 1.
- **S10** (cut 0, critical path #2) — hard input to T1 (Day 2), S1 (Day 3), S4 (Day 3); it *is* the "end of Day 1" freeze.
- **V6** (cut 0) — hard input to D5 (Day 6).
- E4 (cut 2), D2 (cut 1).

Three further orderings are backwards: **G2 (Day 1) needs F1 (Day 3)**; **H4 (Day 2) needs S9 (Day 4)**; **F2 (Day 3) needs S8 (Day 4)**.
**Fix:** regenerate §6 from `graph.json` by topological order — do not hand-edit it. Put V5 and S10 in Day 0/1, move G2 to Day 3, H4 to Day 4, F2 to Day 4.

### 11. Two incompatible cut ladders issue orders in the same words
`RISK.md:497-512` defines a **10-rank** ladder, inverted against `graph.json`'s 4-rank one: RISK **rank 1 = lane X**, graph.json **rank 4 = lane X**. RISK ranks 8 and 10 cut **H6, H1, H2** — all `cut: 0` in graph.json, and **H6 is on the critical path**. RISK.md:498 disclaims authority in one line, then its own trigger table (`RISK.md:518-528`) gives operational orders in its own numbering — "Cut rank 1 (lane X) immediately", "Cut ranks 1–2", "Cut ranks 3–4", "Cut ranks 5–6", "Cut ranks 7–10" — and `PLAN.md:554` says "**PM executes cut ranks 1–3**" naming no ladder at all.

Under graph.json, "fire ranks 1–3" deletes the eval lane, per-field provenance and the hash chain. Under RISK.md it deletes lane X, D2 and E6/E7. Opposite outcomes from one sentence, at the hour when nobody is re-reading a disclaimer.
**Fix:** delete RISK.md's ladder table entirely; rewrite its trigger rows to name **nodes**, never rank numbers ("Cut `X1–X6`", not "Cut rank 1"). Same for `PLAN.md:554`.

### 12. Five of sixteen seats own zero nodes — two of them are named rulers
Computed owner counts: `I1:12 I3:9 I4:7 UX:7 C4:7 I2:5 C2:5 QA:3 L1:2 PM:1 L2:1`. **W, C1, C3, K1, K2 own nothing.** `graph.json:57` declares four rulers — QA, L2, **C3**, **C1** — and two of them have no node, no output path and no acceptance predicate at rank 0. `graph.json:578` then says rank 2 makes "C1 and C4 go idle": C1 is idle already.

`EVAL.md:190-191` exists precisely to fix this (E8 = the C1 blind *run*, E9 = the C3 red-team report) and was never merged into the graph. `interface_freezes[3]` (`graph.json:83`) lists `unblocks: ["C1 run"]` — a string that is not a node id, pointing at the missing node.
**Fix:** merge EVAL.md's E8 (owner C1) and E9 (owner C3) into `graph.json`, and give K1/K2/W nodes or move them out of the roster into a "non-node seats" list so `owner ∈ seats` stays a real check.

Related, same line: `graph.json:578` and `GRAPH.md:379` disagree with each other and both are wrong. graph.json: "three of the four rulers reduce to two" (incoherent). GRAPH.md: "four rulers reduce to two... the remaining pair (QA and C3)". Rank 2 idles **only C1** among the rulers; QA, L2 and C3 survive. Correct text: "four rulers reduce to three."

### 13. Sixteen accept predicates name a script that no node produces — four are `cut: 0`, two on the critical path
Cross-referencing every path in every `accept` against the union of all `outputs`:

| missing artifact | needed by |
|---|---|
| `tools/validate-contracts.mjs` | **S10 (cut 0, critical path #2)** |
| `tools/freeze-check.mjs` | **D6 (cut 0, critical path terminal)** |
| `tools/check-unknowns.mjs` | **V6 (cut 0)** |
| `tests/acceptance/banner.test.mjs` | **H5 (cut 0)** |
| `tests/acceptance/launcher.test.mjs` | **H1 (cut 0)** |
| `harness/probe-v0.mjs` | V0 |
| `bin/eval.mjs` | E1, E2, E3, E5 |
| `tools/check-results-table.mjs` | E7 |
| `tools/check-storyboard.mjs` | F6 |
| `tools/survive.mjs`, `tools/check-psl.mjs` | D3, D2 |
| `tests/acceptance/editor.test.mjs`, `inspector.test.mjs` | F2, F5 |

D6 is the last node in the graph: the whole plan terminates on a script nobody is assigned to write.
**Fix:** add each to the `outputs` of the node whose accept invokes it (that is where the hours have to live), or add a small `G7` "acceptance tooling" node. Then make "every path in `accept` appears in some node's `outputs`" a `tools/ready.mjs` check.

### 14. The graph's own instrumentation is in the first cut, and its VERIFIED stamp was not earned
`tools/ready.mjs` is an output of **G5, cut rank 1**. It is depended on by `critical_path_A.method` ("Recompute with `node tools/ready.mjs --path`"), the cut invariant ("`tools/ready.mjs --check-cuts`", `graph.json:11` and `GRAPH.md:370`), and the entire morning ready-set procedure (`GRAPH.md:442-482`). Firing rank 1 — the Day-1 recommendation — deletes the tool the graph is operated with. **G5 is also the graph's only full orphan**: no in-edges, no out-edges, despite those three real dependencies.

Separately: `graph.json:11` asserts "**VERIFIED 2026-08-28: 0 violations over all 84 edges**". `git ls-files` in `/Users/calebwei/mcp/outpocket` returns exactly `.gitignore`, `LICENSE`, `README.md`; there is no `tools/`, no `harness/`, no `package.json`. The named mechanism cannot have run. (I re-derived the claim independently and **it is true** — but it is asserted at a grade the file's own `evidence_grades` convention does not permit.)
**Fix:** move `tools/ready.mjs` and `tools/check-ownership.mjs` out of G5 into a new `G0` at `cut: 0` owned by L1, keeping only the git hook in G5. Regrade `:11` to `OUR-ESTIMATE` until the checker exists.

### 15. Accept predicates that are not mechanically checkable
Quoted verbatim:

1. **S3** — `curl -s $URL/api/policy | node -e "..."` — the predicate literally contains `"..."`. Nothing to run. *Fix:* `node -e 'const p=JSON.parse(require("fs").readFileSync(0));if(p.version!=="2026-08.1"||p.rules.length!==16)process.exit(1)'`
2. **D4** — "docs/VIDEO-SCRIPT.md's first cue is timestamped <= 00:10 and **names a mechanism, not a feature**." The timestamp is checkable; the second clause is a judgment on a 4-hour, human-gated, 29%-of-budget node. *Fix:* require the first cue to contain one token from a frozen `kb/webmcp/MECHANISMS.txt` list; grep it.
3. **D5** — "**zero retracted claims**" and "**evidence/submission.png shows the submitted state**." No retracted-claims register exists; a human reads the PNG. *Fix:* ship `kb/webmcp/RETRACTED.txt` and have `lint-layer0.mjs` grep it; replace the PNG clause with the Devpost submission URL returning 200.
4. **V1** — "**QA re-reads the screenshot against the JSON; a mismatch fails the node.**" V1 has no command at all — no schema check, no file check. It is the highest-information node in the graph and gates three contingencies. *Fix:* at minimum `node -e` an ajv check of `evidence/V1.json` against a committed schema plus `test -s evidence/V1.png`; keep the human read as a *second* gate, not the only one.
5. **E6** — "a green run must be **visible on the public repo's Actions tab**". *Fix:* `gh run list --workflow eval.yml --json conclusion -q '.[0].conclusion'` equals `success`.
6. **V2 / V3 / V4** — "Verdict field must be one of `'refreshes'|'does-not-refresh'|...`". The *shape* is checkable; nothing prevents a wrong verdict from passing. V4 adds "Two independent runs required; a disagreement of more than 20 percent fails the node" with no script named to compare them.
7. **G5** — `node tools/check-ownership.mjs --seat I2 $(git diff --name-only origin/main...HEAD) exits 1 when the diff touches server/** and 0 when it touches only src/page/tools/**`. Behaviour depends on the ambient diff; this is two fixture invocations, not one predicate.
8. **X6** — `npx webmcp-eval --url https://example-webmcp-site --suite capability`. That host does not resolve. The predicate can never pass.
9. **G1** — title and `outputs` cover **both** repos; the accept checks only `Caleb0796/outpocket`. `webmcp-eval-kit` visibility goes unverified on a disqualification-level node. *Fix:* run the `gh repo view` twice.
10. **Shell exit-status trap** in D1, E4, E5: `grep -ci 'origin-agent-cluster' evidence/headers.txt returns 0 AND ...`. `grep -c` printing `0` **exits 1**; written as a `&&` chain these always fail. *Fix:* `! grep -qi 'origin-agent-cluster' evidence/headers.txt`.
11. **T1** — `node tools/check-toplevel.mjs src/page/**/*.js` needs `shopt -s globstar`; under `sh` it silently matches one directory level and the check passes vacuously.

### 16. The unknowns register is keyed `T0–T4`, colliding with real lane-T node ids
V6's accept (`graph.json:280`) requires `evidence/UNKNOWNS.md` to hold "exactly 5 rows keyed T0..T4 ... every UNVERIFIED row to name an **existing node id** as its fallback." **T1, T2, T3, T4 are existing node ids** meaning "Port tools.js", "Real registerTool", "Absence register", "Description budget". T0 exists nowhere. `CONTRACTS.md:751-753` uses T2/T3/T4 as unknown ids too; `GRAPH.md:376` writes "(T0 UNVERIFIED)". The unknowns are the V0–V4 nodes.

`graph.json:8` carries a `day_label_warning` about exactly this class of collision for D1–D6 — and misses the one inside its own accept predicate.
**Fix:** key the register `V0–V4`. Then V6's "names an existing node id as its fallback" becomes a real check instead of an accidental one.

### 17. Charters contradict `file_ownership`, and the path namespaces do not overlap
- `charters/I2.md:19-21` — "`contracts/violations.schema.json` — **you are its author**... **Freezing it is your first-day priority**." graph.json: S10 owner **L1**. CONTRACTS.md: S10 owner **I3**. Three owners for one freeze. `charters/L1.md` — the graph's actual S10 owner — **never mentions S10**.
- `charters/I2.md:17` — "You own, by path: `web/tools/**`, `web/surface.js`". `graph.json` `file_ownership`: I2 owns `src/page/tools/**`, `src/page/register.js`. **`web/` matches no glob in the matrix**, and `charters/L1.md:20` lists `web/` among the paths every seat must never touch. G5's ownership checker classifies every I2 diff as unowned.
- `charters/L1.md:44` references **`erp/OWNERS.md`** — does not exist; the matrix lives in `graph.json`/`GRAPH.md §7`. Same charter uses `contracts/FREEZE`; graph.json outputs `contracts/FREEZE.md`.
- `charters/I2.md:3-4` claims X1/X2/X5 and `charters/I3.md` references X3/X4; `graph.json` assigns all five to **C2**.

**Fix:** generate the "You own, by path" block of every charter from `graph.json.file_ownership` rather than writing it by hand; make that generation a G5 check.

### 18. `file_ownership` leaves nine acceptance-critical paths unowned
`tools/` is enumerated file-by-file (`export-surface`, `ready`, `check-ownership`, `chrome`, `lint-layer0`). Nine paths named in accept predicates fall outside **every** glob: `tools/check-unknowns.mjs`, `tools/validate-contracts.mjs`, `tools/freeze-check.mjs`, `tools/survive.mjs`, `tools/check-psl.mjs`, `tools/check-storyboard.mjs`, `tools/check-results-table.mjs`, `tools/check-toplevel.mjs`, `bin/eval.mjs`. Also `tests/policy.test.mjs` is owned by I3 but produced by no node.
**Fix:** add a catch-all `{"glob":"tools/**","seat":"L1"}` at the end of the list (with the specific globs winning on longest-match), and make "every output path and every accept path matches exactly one glob" a `--check-ownership` assertion.

### 19. Minor — freeze table names dependencies the edge list does not contain
`interface_freezes[0]` says S10 unblocks **T1, S4, S8**; S8's inputs are `[S1, S4]` with no S10 edge (the coupling is transitive through S4). `interface_freezes[3]` unblocks `"C1 run"`, not a node id (see #12). `interface_freezes[4]` unblocks D4 with no edge (see #8).
**Fix:** make `unblocks` an assertion — every id must be a node with an edge from `frozen_by`. Three of five entries currently fail it.

### 20. Minor — `PLAN.md` commits the exact collision `graph.json` warns about
`graph.json:8` warns that lane-D node ids D1–D6 are not days. `PLAN.md:327,338,354,368,374,382,393` then labels its day gates **"Gate D0" … "Gate D6"**, and `PLAN.md:554` says "Gate D3 fails". Gate D1 is a day; node D1 is "Deploy live". `PLAN.md:368`'s Gate D3 also invokes `tests/curl-escalation.sh` where S2 outputs `tests/acceptance/curl-403.sh`, and `PLAN.md:374`'s Gate D4 invokes `tests/sign-gate.test.mjs`, which no node produces (S5's predicate is `harness/drive.mjs --scenario sign`).
**Fix:** rename to "Gate Day-1" … "Gate Day-6" and copy the commands verbatim from the nodes' `accept` fields.

---

## What checks out

Worth recording, because it is most of the file:

- `graph.json` parses; 59 nodes, no duplicate ids, **all 11 required fields present on all 59**; types correct throughout.
- **No cycles.** Full Kahn sort completes on all 59 nodes.
- Every `inputs` entry resolves to a real node. `edges[]` and `inputs[]` are **bijective — 84 = 84**, no duplicates, every edge carries a `kind` and a `contract`.
- Every `owner` is a seat in the 16-seat roster; the 16 charter files match the roster exactly.
- **Critical path is correct as computed.** My independent longest-path over hard edges, horizon A: `T6→S10→T1→T2→H3→H6→D4→D5→D6`, `1+1.5+2+3+2.5+2+4+2+1.5 = 19.5 h` — matches `critical_path_A` node-for-node, hour-for-hour, seat-for-seat. Every consecutive pair is a real hard edge.
- **`agent_hours_total_A: 88` is exact.** The GRAPH.md §4.2 per-seat table (`I1 19.0 · I3 16.5 · UX 16.0 · I4 9.5 · C4 9.0 · I2 8.5 · QA 4.0 · L1 3.0 · L2 1.5 · PM 1.0`) is exact and sums to 88.0.
- **Cut ladder bookkeeping is exact.** Ranks free 10 / 15 / 10.5 / 15.5 as claimed. All 30 non-zero-cut nodes appear in exactly one rank; no `cut: 0` node appears in any rank; no node appears twice.
- **The hard-edge cut invariant genuinely holds: 0 violations over all 84 edges**, exactly as claimed — the defects in #8 and #9 are dependencies that live *outside* the edge list, not failures of the stated check.
- `falsification[4]`'s "29 rank-0 nodes" is correct (29 nodes at `cut: 0`, all horizon A).
- Only 6 GRAPH.md lane-table rows differ from `graph.json`, all six purely cosmetic (`V0–V4` range notation, inline `(soft)` markers). **GRAPH.md is a faithful human view of graph.json.** The divergence is entirely with CONTRACTS.md, EVAL.md, PLAN.md, RISK.md and the charters.
- **T6, the first node on the critical path, is grounded in a real measurement.** `node --test tests/*.test.mjs` in `/Users/calebwei/mcp/countinghouse` reports `# tests 24 / # pass 23 / # fail 1`, and the single failure is `not ok 18 - auditor surface: read-only by construction` — precisely the test T6 names, at precisely the count G3's accept asserts ("at least 24 tests, the ported count"). `src/tools.js` is 401 lines, as `charters/I2.md` states.

## The two changes that matter most

1. **Pick one authority and regenerate.** `graph.json:5` claims authority but four documents were written against different versions of it. CONTRACTS.md §12, EVAL.md §4 and RISK.md §7 each hold a private node table or ladder. Until #1–#4 are resolved, dispatching "S10" or "fire ranks 1–3" produces different work depending on which file the seat opened — and that is what makes this FATAL rather than merely inconsistent.
2. **The graph cannot yet check itself.** `tools/ready.mjs` does not exist, is scheduled inside the first cut, and 16 accept predicates name scripts nobody owns. Fix #13 and #14 first; every other defect here was found by a 200-line script that took ten minutes to write, and `--check-cuts` should have caught #8 on its own if F6→D4 had been drawn as an edge.

Scratch verification script: `/private/tmp/claude-501/-Users-calebwei-mcp/67898feb-2bcd-4702-acaa-66b19b7e96db/scratchpad/verify.mjs` (re-runnable with `node verify.mjs`).