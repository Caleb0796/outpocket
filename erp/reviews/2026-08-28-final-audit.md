# FINAL AUDIT — `/Users/calebwei/mcp/outpocket/erp/`

## What passed (run, not read)

| Check | Result |
|---|---|
| graph.json parse, 68 nodes, unique ids | clean |
| inputs↔edges bijection | 119/119 both directions, 0 dupes, 0 dangling |
| topological sort | acyclic, 68/68 ordered; roots `{L0,G1}` |
| cut invariant (`key(u)≥key(v)`, hard, same-horizon) | **0 violations over all 100 qualifying edges**; 108 hard / 11 soft matches GRAPH.md §5 |
| critical path | recomputed independently = **29.0 h**, same 12 nodes, same order; runner-up without `T2→H3` = **27.0 h**, exactly as `critical_path_A.what_changed_in_this_revision` claims |
| capacity arithmetic | every figure reproduces: 118.0 A-hours, 107.5 non-gated, 5.375 overhead, 15.875 required, short_by 2.125/1.525/0.3, fits at ranks 1–3 with 0.275 spare, 48.0 h cuttable |
| `schedule_A` | 62/62 A-nodes once, 0 backwards edges, **peak seat-day exactly 6.0** at the five named seat-days |
| `--check-freezes` | 10/10 `unblocks` entries have the hard edge |
| accept paths | 103 concrete paths; 94 in node outputs, 7 pre-existing on disk, 2 globs |
| PLAN.md day table | 62/62 rows equal graph.json on day/owner/hours/cut |
| PLAN.md quoted gates | all 35 cut-0 accepts **byte-identical** to graph.json |
| GRAPH.md lane tables | 68/68 rows equal on id/title/owner/inputs/hours/cut |
| EVAL.md lane-E table | 7/7 rows equal |
| RISK.md amputation sets + 35-node cut-0 list | equal |
| second node table / second cut ladder | none found |
| banned-phrase scan, whitespace-normalised, whole tree | **0 live assertions**; every hit is a quote-to-ban or retraction row |
| `"16 rules"` | 17 occurrences, **all retractions** |
| banned.txt generator | runs, emits exactly 32 rows = BW-01..BW-32 |
| ajv-2020 over `erp/contracts/*.schema.json` | 6/6 compile, 15/15 examples validate |
| **L0 gate (1), executed** | 24 tests, exactly 1 failure, named `auditor surface: read-only by construction` |
| **H2 first-hour gate, executed on Chrome 152** | `document.modelContext` object, `getTools`/`executeTool` functions, 1 tool → `getTools().length===1`; `navigator.modelContext` undefined, `provideContext` undefined, `consequentialHint` silently dropped |
| **Published digests recomputed from scratch** | **16 of 17** — 7/7 OCF-1 vectors, 3/3 policy (incl. the `17bc4b2d` trap), 5/5 snapshot + 1480 bytes, chain seq 1 — from an independent Python OCF-1 written only from CONTRACTS.md §3 prose |

R-7 verified from source: `countinghouse/src/policy.js` emits exactly 19 codes, 15 line-level + 4 report-level, matching the frozen schema. R-6 FX migration verified (1.09→1090000, 0.0067→6700).

## Residual defects

| # | Defect | Sev |
|---|---|---|
| 1 | **`signature.schema.json` `examples[0].snapshot` is not committable under the frozen policy.** It carries `verdict:{blocking:0,violations:[]}`; `policy.schema.json` `examples[0]` emits **CAP_MEALS block** on `ln_3` (18640 for 2 attendees vs `meal_per_attendee` 8000). `violation.schema.json` `x-invalidExamples` documents that identical violation — same code, `rule_id` R05, `entity_id` ln_3, message "$186.40 is above $80.00 per attendee for 2 attendees". Commit returns `E_NOT_CLEAN`. Fixing it (attendees→3) moves all five §7.2 digests, the 1480-byte count, chain seq 1's `payload_digest`, the artifact block and every eval case pinning them. | **HIGH** |
| 2 | **F4's accept contradicts the frozen C4 schema and the fix never landed.** F4 (cut 0) requires the dialog POST "a body carrying ONLY `{decision, reason}`"; `sign_respond_request` is 8 required fields, `additionalProperties:false`. CONTRACTS.md §7.3 names this, names the owner ("a flag for the `graph.json` owner"), prescribes the wording, and §15 logs it as corrected — but graph.json, PLAN.md:800 and GRAPH.md:467 all still carry the unsatisfiable text. A flagged, named defect that survived a repair round. | **HIGH** |
| 3 | **H2's `--exec` predicate is not implementable as written.** MEASURED on Chrome 152.0.7977.64: `executeTool('whoami',{})` → `TypeError: not of type 'RegisteredTool'`; the `getTools()` descriptor (`{annotations,description,inputSchema,name,origin,title,window}`) → `UnknownError: Failed to parse input arguments`. The working channel is the CDP **`WebMCP`** domain — `invokeTool{frameId,toolName,input}`, `cancelInvocation`, events `toolsAdded/toolsRemoved/toolInvoked/toolResponded` — which appears **nowhere** in the corpus. `--enable-features=WebMCPTesting` (H1's `manual` scenario) does **not** expose it. | **HIGH** |
| 4 | **S3's accept reads the wrong field.** It asserts `p.rules[i].code === "R01".."R19"`; the frozen schema puts `R01` in `.id` (`^R[0-9]{2,3}$`) and named strings in `.code` (`^[A-Z][A-Z0-9_]{2,39}$`). Unsatisfiable together with the pinned digest `b7ccc1ff`/2458. S3 is on the critical path. Restated verbatim at PLAN.md:733. | **HIGH** |
| 5 | **Nothing pushes.** MEASURED: `origin/main` = the 3-file initial commit, `erp/` untracked, both repos still **private**. L0 commits locally; G3 (Day 1, cut 0) clones the GitHub URL and runs `npm ci`. The `L0→G3` edge contract names "package-lock.json" as if G3 read the local tree. | HIGH |
| 6 | **`npm test -- <name>` is not a filter.** Used by T1, T4, T6, S11, S3(×2). `package.json` content is unspecified beyond `devDependencies.ajv`. MEASURED: `"test":"node --test"` → exit 1, `Could not find 'surface'`; `"test":"node --test tests/*.test.mjs"` → runs the **whole unfiltered suite**, the argument inert. S3 believes it has two gates; it has one command run twice. | MED |
| 7 | **G0 `--check-accept-paths` exits 1 on the graph it validates.** Its exemption set is enumerated as "exactly the eight frozen schemas under `erp/contracts/` and `erp/charters/C3.md`"; `countinghouse/src/policy.js` (S4) and `tests/*.test.mjs` (L0) are in neither. | MED |
| 8 | **D-17 has no home on Day 0.** The 2.5-vs-3.0 h/day ruling — the one number deciding whether 27 of 62 nodes are amputated — is due "Day 0, before any seat is dispatched", logged in `erp/DECISIONS.md`, a **V6 output on Day 2**; Day 0 contains only L0 and V5. Unfixed from round 2. | MED |
| 9 | **E3 fails by construction on Day 4.** `eval-case.schema.json` `examples[1]` hard-codes `controlStatus:"known-open"` / `observedToday:"IT COMMITS"`; S5 (Day 3, cut 0) ships the `confirm_token` that flips it to refused; the runner "fails if the behaviour moves in either direction without the record being updated"; that file is frozen by S10 on Day 1 under `sha256sum -c FREEZE.md`, so the edit needs a PM deviation ticket no node schedules. | MED |
| 10 | **"Eight frozen schemas" is dead vocabulary.** Only 6 of the 8 files are `*.schema.json` (7 after V5 adds `probe-verdict`). G6's title, accept and 4 restatements assert 8. G6's advertised catch — "the known `canonical_bytes` error in `policy-versions.json`" — is stale: I recomputed both, 2458 and 2457, **both correct**. | LOW |
| 11 | **RISK.md §2's worked example cites three fixed sites.** It asserts present-tense that `erp/FACTS.md:163-165`, `erp/EVAL.md:665-667`, `erp/PLAN.md:555` violate BW-11 and instructs owners to paste replacement text. All three now hold unrelated content; the replacement already landed at EVAL.md:1119, FACTS.md:270, GRAPH.md:556. A seat acting on §2 stalls. | LOW |
| 12 | **`registerTool` returns a Promise, not `undefined`.** EVAL.md:1129 / FACTS.md §2 state "returns `undefined` synchronously", graded MEASURED. Wrong on the installed binary. The conclusion drawn from it survives; the grade does not. | LOW |
| 13 | Chain `seq 0` (`7caed842…`) is the only published digest with no recomputable input anywhere in the corpus — §7.5 calls the pair "verified"; brute-force over 36 plausible shapes found nothing. G6 recomputes only `policy-versions.json`, so no node checks chain digests. | LOW |
| 14 | `graph.json.falsification[8]` says "Fire ranks 1, 2 and 3 together" — an operational trigger citing rank numbers, which R-12 / PATHS.md §5 forbid, inside the authority that declares the rule. Restated at GRAPH.md:1077. | LOW |

## Day-0 / Day-1 simulation

Walking Day 0 (L0, V5) then Day 1 (16 nodes) from `erp/` alone: **5 hard stops** — #6 (`package.json`/`scripts.test`), #5 (no push + private remote → G3), #8 (D-17 homeless), #7 (G0 self-fails), #3 (H2 `--exec`). Six if you count V5's Render account on round 2's basis; the host and domain are now named (R-18), only provisioning is presumed.

**22 → 16 → 5.** Round 2's stops were internal disagreements; four of these five are contact with the outside world — a git remote, npm CLI semantics, Chrome's actual API — which is the class a document review cannot reach.

## Signature attacks — what succeeds vs what the documents claim succeeds

Run against a reference implementation of the §7.3 state machine and all twelve rejection codes.

| Attack | Result | Documents claim | Agree |
|---|---|---|---|
| One-request forgery (N-15) | **REFUSED** 409 `E_NOT_SIGNED` | refused, `E_NOT_SIGNED`, `controlStatus:"enforced"` | **yes** |
| Two-request `/respond` forgery (N-16), scripted verbatim | **REFUSED** — the 7-field body fails `required` (8 fields incl. `confirm_token`) | "it COMMITS today" **and** "with the confirm_token required → 403 `E_NO_CONFIRM_TOKEN`, status REFUSED" — both branches written down in S5's accept and `whatFlipsIt` | **yes** |
| Same, attacker reads the dialog DOM (V3=yes) | **COMMITS** 200, `signed_by:chen`, server clock, chain entry | predicted exactly, "a direct function of open unknown V3" | **yes** |
| **Invented C — same-version policy content swap** | **COMMITS.** The snapshot binds `policy_version` (a *name*), not `policy_digest`. Swap the served policy to the corpus's own trap document (`17bc4b2d`) under an unchanged `"2026-08.1"`: verdict unmoved → digest unmoved → `E_POLICY_VERSION_MOVED` cannot fire. The artifact attests "clean under 2026-08.1" against content whose digest is no longer the pinned one. `policy_digest` sits in the artifact, **outside** the signed projection. | **not claimed anywhere** | **no** |
| **Invented D — decline-to-unlock** | Attacker with the token declines first; the human's genuine click then gets 409 `E_SIGN_IN_PROGRESS`. Silent cancellation of a pending signature, not a forgery. | not claimed | **no** |

On the vectors the plan set out to describe, the two lists agree completely — which is the thing that matters. C is a real gap in what the signature *binds* (needs write access to the served policy, so arguably outside the declared N-04 curl+cookie model; say so rather than hide it). D is a nuisance requiring the token.

## VERDICT

**NOT-EXECUTABLE** — 5 Day-0/Day-1 hard stops and 4 HIGH defects, but the graph itself is now provably sound (68 nodes, 119 edges, cut invariant 0/100, 29.0 h path and every capacity figure recomputed independently, 16 of 17 published digests reproduced from prose alone, zero cross-document disagreement, zero live banned wording); nothing on the list requires re-deriving the graph.

---

## The three things a hostile expert attacks first

**1. The sign gate.** They go here because the plan advertises it. **Survives — and it is the plan's strongest asset.** The corpus opens §7 with the surviving forgery, scripts it verbatim as a control, records `controlStatus: known-open`, writes "a true attribution of a false event… arguably worse than the old forgery", and grounds the residual in open unknown V3. I ran all three attacks and every outcome matches what the documents predict. A reviewer attacking here finds the plan already standing where they meant to land. The one thing they take away is defect #9 — a frozen eval case that S5 itself invalidates on Day 3 with no scheduled deviation ticket. That is a process trap, not a claim collapse.

**2. "Every number in this plan reproduces."** They pick a digest and recompute it. **Survives that** — 16 of 17, including the deliberate `17bc4b2d` trap, from an implementation written only from CONTRACTS.md §3. **Does not survive the next step.** A reviewer who runs the frozen policy against the frozen snapshot instead of merely re-hashing it finds `verdict:{blocking:0}` on a line that `policy.schema.json` blocks and that `violation.schema.json` `x-invalidExamples` documents as blocked — same code, same `rule_id` R05, same `ln_3`, same "$186.40 is above $80.00 per attendee". Two frozen contract files assert opposite things about one line, and the snapshot the entire C4 layer is built on is `E_NOT_CLEAN`. This is the finding that costs real hours: the fix is one integer and it invalidates every digest in §7.2 and §7.5.

**3. "The harness drives Chrome's real `document.modelContext`."** EVAL.md §2 makes this a rule and stakes the eval lane on it. Ninety seconds with Chrome open: `executeTool` takes a `RegisteredTool`, not a name; `getTools()` returns a descriptor, not a handle; so `Runtime.evaluate` — the corpus's only named instrument, in H2, V0, charters/I1 — cannot execute a tool by name at all. Meanwhile the CDP `WebMCP` domain does exactly that, and its `cancelInvocation` is precisely the instrument RISK §5.2's in-flight-revocation weakness needs. Neither is named once in ~900 KB of planning. **Does not survive as written.** H2's first-hour gate is real and it passes — I ran it — but it proves the API exists and never touches the one call the harness is built to make, so "gating everything else" is not true of it. Recoverable inside H2's own 3.0 hours, and the fix leaves the harness better than specified.