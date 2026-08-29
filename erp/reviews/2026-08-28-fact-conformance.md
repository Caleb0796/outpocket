Read: `countinghouse/HANDOVER.md`, all 32 files under `/Users/calebwei/mcp/outpocket/erp/` (8 top-level docs, 8 contract JSONs, 16 charters), plus `gatehouse/BUILD.md §2` and `countinghouse/src/*.js` to re-verify the cited line numbers and re-count the policy engine. I independently recomputed every published digest in the contracts layer with a from-scratch OCF-1 implementation.

**What is clean, so you know the scope of the audit:** all 7 canonical vectors reproduce byte-for-byte; the signed-snapshot digest (1445 bytes, `sha256:355217d6…`), the provenance-flip digest, the line-order digest, the chain-entry digest and the `2026-08.1` policy digest (2458 bytes, `sha256:b7ccc1ff…`) all recompute correctly; every source line citation (`policy.js:133`, `policy.js:28`, `erp.js:19`, `erp.js:101`, `erp.js:366`, `erp.js:377-389`, `tools.js:343-354`, `tools.js:370`) is accurate; the cut-ladder invariant really is 0 violations over the 73 hard edges; the 88.0/19.5/14.4/13.75 capacity arithmetic all checks out; and `GRAPH.md §10.1`'s claim about outpocket already having `.git` + a 1066-byte LICENSE + a 1376-byte README is true on disk.

---

## FINDINGS

**1. EVAL.md reasons from the banned WindTunnel data to justify a design decision.**
> "Accuracy is not our selling point, and the public evidence does not support making it one: on the published data a human-in-the-loop arm *loses* on the sensitive-action tier, and on an ERP-domain site the two arms **tied**." — `erp/EVAL.md:730-732`

**Why wrong:** There is exactly one published source with a WebMCP human-in-the-loop arm, a sensitive-action tier and per-site breakdowns, and HANDOVER S5 / FACTS §8 place it on the poison list: its WebMCP arm never went through Chrome's WebMCP (Playwright-injected bridge), so its arm-vs-arm numbers measure a home-built bridge. EVAL.md §2.1 explicitly acknowledges the source is uncitable and says its name "appears nowhere" — then §12.1 launders its *results* into a load-bearing scoping decision, ungraded. This is the exact failure the ban exists to prevent: the citation is hidden but the belief is inherited. A judge who asks "which published data?" gets either a poison citation or no answer.
**Replace with:** "1. **Task accuracy / success rate.** We make no accuracy claim, and we cite no external accuracy data — the only public WebMCP two-arm results we know of come from a harness that injected its own bridge instead of using Chrome's WebMCP, so they are not evidence about anything we build (FACTS §8). Our reason for excluding accuracy is arithmetic, not comparative: see §10.2 — the sample size does not exist inside the deadline. We compete on invariants, which we can prove."

---

**2. PLAN.md asserts an empty cell from census keyword counting — the relapse you flagged, in its fourth instance.**
> "46% of the field flips tools; nobody ships the *third* state — outpocket keeps a resident read-only **absence register** (**T3**)…" — `erp/PLAN.md:196-197`

**Why wrong:** Three defences are claimed and none holds. (a) The parenthetical "That nobody else ships it = OUR-ESTIMATE, from the census" grades the claim but does not license it: `RISK.md:262-265` makes the rule binding — *"no claim of the form 'nobody has done X' may be written until X has been re-tested by concept, with at least three distinct vocabulary variants, and the search terms and hit counts recorded. If the re-test is not in the record, the claim does not go in the document."* No such re-test exists anywhere in `erp/`. (b) "nobody ships" is a paraphrase that dodges BW-06 (`nobody has done`) and BW-07 (`no one else has`) while asserting the identical proposition — the lint will pass it and the judge will not. (c) It is the **recitable** sentence: PLAN.md §4 says "If you cannot recite the non-generic sentence, you cannot present the mechanism," so the caveat is precisely the half that will not survive into the video or Devpost. FACTS.md §10 grades the absence register "never adversarially killed, therefore treat as **unverified** rather than proven" — PLAN.md upgrades it to a field-wide emptiness claim.
**Replace with:** "> **Non-generic sentence:** 46% of the field flips tools, so the flip is not the differentiator — what we add is the *third* state: a resident read-only **absence register** (**T3**) that answers 'why is the tool I need not here, and what restores it' in the same `{code, severity, field, fix, candidates}` envelope as a violation, which is a direct answer to the working group's own open issues **#199** and **#262** (opened inside the contest window, still unanswered). *(Evidence: issue existence and zero replies = MEASURED 2026-08-28. We make no claim about how many other entrants do something similar: our census was keyword-based and this project has been wrong three times about keyword-derived empty cells. Until a concept-level re-test with three vocabulary variants is recorded here, say only what ours does.)*"

---

**3. Three documents write "structural guarantee" — banned by their own BW-11, and substantively false.**
> "*we trade cache efficiency for a structural guarantee about the workflow.*" — `erp/FACTS.md:163-165`
> "*we spend cache efficiency to buy a structural guarantee about the workflow.*" — `erp/EVAL.md:665-667`
> "The honest framing is that we spend cache efficiency to buy a structural guarantee of the workflow (MEASURED)" — `erp/PLAN.md:555`

**Why wrong:** Two independent reasons. (i) `RISK.md:186` BW-11 bans the case-insensitive pattern `structural guarantee` outright over a whitespace-normalised stream — all three lines match, and all three files are inside the hook's scan set. Note RISK.md's own "write this instead" column deliberately says "structural **workflow** guarantee", and `GRAPH.md:207` and `L2.md:103` use that safe form — so the corpus is already split, with the three most-read documents on the banned side. (ii) It is not merely a lint hit: the "workflow guarantee" the flip buys is exactly the tool surface, and `RISK.md §5.1` + IR-10 establish the surface is a **menu, not a lock**, page-enforced, with the browser doing a JSON parse and an is-it-an-Object check. Calling it structural repeats the retracted "no binary channel = a structural guarantee" error one noun over.
**Replace with (all three sites):** "we spend prompt-cache efficiency to buy a page-enforced workflow constraint: the tool the agent would need is not on the surface until the state permits it. The boundary that actually holds is the server's per-request check (S2), not the surface."

---

**4. "16 rules" is wrong — the measured count is 19 — and it is baked into an acceptance predicate that will fail.**
> "`GET /api/policy` reports version `2026-08.1` with 16 rules" — `erp/GRAPH.md:142` (S3 accept), and identically in `erp/graph.json` S3
> "| `src/policy.js` | 250 | Policy engine, 16 rules, integer cents. Ported by **S3**. |" — `erp/FACTS.md:531`
> "**S3** Port `policy.js` (250 lines, 16 rules, **integer cents**…" — `erp/charters/I3.md:49`

**Why wrong:** I counted the spike directly. `countinghouse/src/policy.js` emits **19 distinct violation codes** — 15 line-level (`grep -o 'push("[A-Z_0-9]*"' | sort -u` → 15) plus 4 report-level (`EMPTY_REPORT`, `PROJECT_SCOPE`, `PROJECT_INACTIVE`, `REPORT_REVIEW` at lines 193/197/199/218). The frozen contract agrees: `contracts/policy.schema.json` `examples[0]` carries **R01–R19**, and its digest `sha256:b7ccc1ff…` is pinned in `policy-versions.json` and verified by me. "16" matches nothing in the file — not the codes (19), not `LIMITS` (9 keys), not the push sites (23). It was carried from HANDOVER §1 into FACTS.md without re-counting, which is exactly what FACTS.md exists to prevent. **Consequence:** S3's acceptance predicate is unsatisfiable against the frozen contract; QA must fail S3 or someone will quietly delete three rules to make a number match.
**Replace with:** GRAPH.md/graph.json S3 accept → "`npm test -- policy` green; `GET /api/policy` reports version `2026-08.1` and enumerates 19 rules `R01`–`R19`, matching `contracts/policy.schema.json` `examples[0]`". FACTS.md:531 → "| `src/policy.js` | 250 | Policy engine, **19 deterministic violation codes** (15 line-level, 4 report-level), integer cents. Ported by **S3**. *(Re-counted from source 2026-08-28; HANDOVER §1's "16" is superseded.)* |". I3.md:49 → "Port `policy.js` (250 lines, 19 violation codes, **integer cents** — keep integer cents)".

---

**5. CONTRACTS.md's demo-bump derivation does not produce the published digest.**
> "The demo bump is pinned in advance: **`2026-08.2`**, identical except `transport_per_line: 15000 → 5000`, digest `sha256:d024607ef7d8597e4d403f97c0ebe9fadf69a8196f6ba16cb60c10292df1f362`." — `erp/CONTRACTS.md:524-527`

**Why wrong:** I recomputed it. Changing only `transport_per_line` gives `sha256:17bc4b2d1031b63e07a3983b067c8485316e8c16b53454e481680f65b7962e92`. The published `d024607e…` requires **three** changes — `version` → `"2026-08.2"`, `effective_from` → `"2026-08-29"`, and `transport_per_line` → `5000`. `policy-versions.json`'s own `derivation` field states all three correctly; only the prose is wrong. This is the single highest-probability thing an expert reviewer actually runs (it is one `sha256` away), and the prose is what they will run it from.
**Replace with:** "The demo bump is pinned in advance: **`2026-08.2`**, byte-identical to `2026-08.1` except three values — `version` becomes `2026-08.2`, `effective_from` becomes `2026-08-29`, and `limits_cents.transport_per_line` drops 15000 → 5000 — giving digest `sha256:d024607e…` over 2457 canonical bytes. (Changing the limit alone gives `sha256:17bc4b2d…`; if your recomputation lands there, you did not bump the version.)"

---

**6. "Three different single edits" — one of the three is not a single edit, and a reviewer recomputing it gets a mismatch.**
> "Three different single edits, three different digests. The provenance flip is the one a checksum over a projection without `source` would have missed." — `erp/CONTRACTS.md:404-405`, and the same claim in `signature.schema.json` `x-knownDigests.readsAs`

**Why wrong:** I reproduced all three. The provenance flip and the line-order reversal are genuinely single edits and match exactly. The row labelled `amount 18640 → 8640` does **not**: editing `amount_cents` alone, or `amount_cents` + `usd_cents`, both give digests different from the published `sha256:9f92bee2…`. The published digest requires `amount_cents` → 8640, `usd_cents` → 8640 **and** `total_usd_cents` → 12850 (a consistent re-total). The digest itself is correct; the description of what produced it is not. A reviewer or an implementer of `tests/signature.test.mjs` following the prose will conclude our pinned digest is fabricated. (Aside: the tampered snapshot still carries an itemization summing to 18640 against an amount of 8640, so it is internally inconsistent — worth noting in the test fixture.)
**Replace with:** "Three different tampers, three different digests, all different from the signed one. The amount row is a *consistent* re-total — `amount_cents`, `usd_cents` and `report.total_usd_cents` all moved together, which is the realistic attack — while the provenance flip and the line reorder are single-field edits. The provenance flip is the one a checksum over a projection without `source` would have missed." Rename the `x-knownDigests` key `tampered_amount_18640_to_8640` → `tampered_amount_consistent_retotal_18640_to_8640` and record the three fields in its note.

---

**7. `policy-versions.json` publishes the wrong byte count for `2026-08.2`.**
> `"version": "2026-08.2", … "canonical_bytes": 2458` — `erp/contracts/policy-versions.json`

**Why wrong:** Computed: the `2026-08.2` document canonicalises to **2457** bytes, not 2458. `2026-08.1` is 2458 and correct. The bump keeps `version` and `effective_from` the same length but shortens `15000` to `5000`, losing exactly one byte. If `tests/policy-lock.test.mjs` asserts `canonical_bytes` — and CONTRACTS §11 check 3 says it recomputes and asserts — the lock test fails on the demo policy, i.e. on demo beat ①.
**Replace with:** `"canonical_bytes": 2457` for the `2026-08.2` entry.

---

**8. Claim (b) promises attestation of a "specific agent", which nothing in WebMCP provides.**
> "outpocket can show — and later prove from its own records — that a specific authenticated human and **a specific agent** were on the same page…" — `erp/PLAN.md:149-152`

**Why wrong:** There is no agent-identity channel anywhere in the sixteen iron rules or in `gatehouse/BUILD.md §2`. `execute(args, opts)` carries no attested caller identity; the page cannot distinguish ChatGPT-Sol from a CDP script from `H3`'s own in-page fallback agent — and `H3` exists precisely to drive the same surface with no agent at all. Worse, OpenAI's published position is that our page is untrusted content, not that the client authenticates itself to us. We can attest *that a tool call arrived and that a human signed the snapshot it produced*; "a specific agent" is a guarantee the browser does not make and a judge can break in ten seconds by driving the page with `H3`.
**Replace with:** "**Precisely:** at the moment a consequential write happens, outpocket can show — and later prove from its own records — that a **specific authenticated human** reviewed a specific canonical snapshot, that the write arrived through the tool surface rather than the UI, and that what was persisted is byte-identical to what the human saw. We do **not** identify or authenticate the agent: WebMCP exposes no agent identity, and our own in-page fallback agent (H3) is indistinguishable from a third-party one at the tool boundary. What we record is the *call*, the *snapshot*, and the *human*."

---

**9. Demo beat 1 promises a mid-session surface refresh that V2 has not answered.**
> "Finance edits a policy rule. The policy version bumps, visibly (**F5**). The tool surface changes *on the spot*. The same agent, running the same instruction it just ran successfully, is now blocked" — `erp/PLAN.md:260-263`

**Why wrong:** Whether the ChatGPT built-in browser re-reads the tool list mid-session is open unknown **V2** (`FACTS.md §7`, `RISK.md §4`), and both siblings say plainly what happens if the answer is no: `RISK.md:282` — "Do not claim live push… script the video so the agent is re-prompted after the flip"; `GRAPH.md:89` allows the verdict `does-not-refresh`. PLAN.md is the document every seat reads first and the one the storyboard is written from, and it states the unverified branch as fact with no marker. `UX.md:57-58` inherits it verbatim ("the tool surface changes **on screen**"), so the risk propagates straight into D4, the one node that cannot be re-shot.
**Replace with:** "**Beat 1 — the surface moves under the agent (mechanism ①②).** Finance edits a policy rule. The policy version bumps, visibly (**F5**), and the live surface inspector shows the tool set change — *that* is on our own page and is unconditional. Whether the agent's client re-reads the tool list without a re-prompt is open unknown **V2**; until V2 returns `refreshes`, the storyboard re-prompts the agent after the flip and the narration says 'on its next turn', never 'on the spot'. The absence register (**T3**) then tells it, in structured form, why the tool it wants is gone and what would bring it back."

---

**10. Two charters invent a denominator and contradict the measured 44%.**
> "**199 of 420 surveyed entries already ship a LICENSE and ≥20 source files**" — `erp/charters/I4.md:7-9`
> "199 of 420 surveyed entries already have a LICENSE and ≥20 source files." — `erp/charters/L2.md:39-41`

**Why wrong:** 199/420 = 47.4%. HANDOVER §6 and `FACTS.md §4` both record **199 (44%)**, which implies a base of ~452, not 420. The 420 base belongs to the *other* row (24/420 videos, 2/420 violations, 0/420 provenance). `PLAN.md:71` correctly says "44%". So two charters — including L2's, the seat whose whole output is the rubric — will state a percentage a judge can recompute against our own README as inconsistent. Note also that `FACTS.md §4`'s single table implies one shared denominator for rows that do not share one; that is the source of the error.
**Replace with (both charters):** "199 surveyed entries (**44%**) already ship a LICENSE and ≥20 source files — a complete product is the threshold, not the edge. Only **24 of 420** (5%) posted a video, and the video is a disqualification item." And in `FACTS.md §4`, add a denominator column: 623 candidates / 529 real implementations / 420 fully surveyed, so no row is read against the wrong base.

---

**11. PLAN.md states the TOCTOU closure as fact, dropping the precondition that CONTRACTS says breaks it silently.**
> "ours binds to a snapshot digest and is re-checked server-side, which closes the TOCTOU hole between 'the human approved' and 'the server persisted'" — `erp/PLAN.md:235-237`

**Why wrong:** `CONTRACTS.md:445-453` grades the same claim honestly and adds the condition: "Grade: **OUR-ESTIMATE, true by construction of a single-process Node server with synchronous state mutation inside each request handler**… **This breaks silently if node D1 deploys more than one instance.** A second instance reintroduces the race and **no test in this repository would notice.**" PLAN.md §4 is the text the video and Devpost answers reduce to, and it carries neither the grade nor the precondition. Render's paid instance count is a dashboard setting, so this is one click away from being false in production while every test stays green.
**Replace with:** "…ours binds to a snapshot digest and is re-checked server-side before commit, which closes the time-of-check/time-of-use window between 'the human approved' and 'the server persisted' — *given a single server instance*, because the sign lock and the snapshot computation are taken in one synchronous step (OUR-ESTIMATE, true by construction; `CONTRACTS.md §7.4`). D1 must deploy exactly one instance, and the deploy notes must say why."

---

**12. The "1 hit in 623 repos" rarity claim is another keyword count used as a differentiator.**
> "printing the worst-case consequence *above the signature line* (**F4**) hit **1 time in 623 repos** (MEASURED)." — `erp/PLAN.md:237-238`; repeated at `FACTS.md:517-518` and `charters/UX.md:41-43`

**Why wrong:** Same shape as finding 2 and same shape as the 0/420 provenance count that FACTS.md §8 itself identifies as "exactly this shape". A regex over 623 repos cannot see a consequence line rendered from a template, worded as a warning, or placed in a component the scanner did not read — and the concept-level re-test that the project's own binding rule requires has not been run for this one. Grading it MEASURED is defensible only for "our scanner matched once"; the load-bearing inference ("therefore this is rare, therefore it differentiates") is not measured at all.
**Replace with:** "printing the worst-case consequence *above the signature line* (**F4**) is zero-cost and our keyword scan of 623 repos matched it once — but that scan has not been re-tested at the concept level, so treat it as 'we found one, we did not look hard' (OUR-ESTIMATE), not as evidence of rarity. It is in the plan because it costs nothing and it makes the signature mean something, not because it is unique."

---

**13. `x-requiredStates` is labelled MEASURED against code that produces six states, not five.**
> "`x-requiredStates` pins the five state tool counts **1 / 5 / 12 / 13 / 6** (MEASURED on `countinghouse/src/tools.js:343-354`)." — `erp/CONTRACTS.md:278-280`

**Why wrong:** I read those exact lines. The compiler produces **six** distinct surfaces: signed-out 1; auditor 6; employee-no-report 5; **employee-with-non-draft-report 6** (`if (open.status !== "draft") return [...base, t_get_open]`); draft-dirty 12; draft-clean 13. The contract omits the submitted state entirely — and `EVAL.md §6.3` makes that state the *point* of the whole set-equality design: `S4-emp-submitted` and `S5-aud` both have 6 tools and differ by exactly one element (`create_expense_report` vs `get_day_book`), so "a count assertion passes even if the auditor is handed the employee's surface." A five-state export cannot express the state that motivates the assertion. `totals.state_count: 5` and `distinct_tool_count: 15` inherit the gap (and 15 becomes 16 once T6 lands `get_report`).
**Replace with:** "`x-requiredStates` pins the **six** state tool counts — `signed_out` 1, `employee.no_report` 5, `employee.draft.dirty` 12, `employee.draft.clean` 13, `employee.submitted` 6, `auditor` 6 — all MEASURED by reading `countinghouse/src/tools.js:343-354`. `employee.submitted` and `auditor` deliberately share a count and differ by one name, which is why E2 asserts set equality and never count equality. `totals.distinct_tool_count` is 15 before T6 and 16 after (`get_report` joins the auditor surface)."

---

**14. The frozen export contract and the eval design use different state ids for the same states.**
> `"signed_out"`, `"employee.no_report"`, `"employee.draft.dirty"`, `"employee.draft.clean"`, `"auditor"` — `erp/contracts/tool-export.schema.json` `x-requiredStates`
> "Canonical state ids (**used verbatim everywhere in lanes E, T, S, F, H**): `S0-anon` · `S1-emp-home` · `S2-emp-draft-clean` · `S3-emp-draft-dirty` · `S4-emp-submitted` · `S5-aud` · `S6-emp-signing`" — `erp/EVAL.md:240-251`

**Why wrong:** C2 is a **frozen contract** (freeze 2026-08-29 12:00) consumed by E1/E2/E3/E5/E6/E4/G4/X6, and `surface_digest` is keyed per state id, as is `surfaces.frozen.json`, as is the README results table. Two vocabularies for one key means E2's `setEquals` cannot be written against both, and `E6`'s "the deployed surface digest equals the frozen one" comparison is undefined. This is a contract defect, not a naming quibble: CONTRACTS.md §1 rule 1 says an edge that cannot name one artifact is fake.
**Replace with:** adopt EVAL.md's ids in the schema (they are the ones seven documents already use) and add to CONTRACTS.md §5: "State ids are the canonical set defined in `EVAL.md §5` — `S0-anon`, `S1-emp-home`, `S2-emp-draft-clean`, `S3-emp-draft-dirty`, `S4-emp-submitted`, `S5-aud`, and `S6-emp-signing` once the sign gate lands. No other spelling appears in any artifact; `surface_digest` and `surfaces.frozen.json` are keyed by these strings."

---

**15. Three incompatible definitions of "bytes per state" are in circulation, and one of them lands in the README.**
> "Logged out | 1 | 395 | ≈99" — `erp/FACTS.md §3`
> "| `S0-anon` | **1** | `get_signin_status` | 397 | 100 |" — `erp/EVAL.md §6.2`
> `"accounting": {"tool_count":1,"description_bytes":230,"schema_bytes":33,"total_bytes":280,"estimated_tokens":70}` — `erp/CONTRACTS.md §5` / `tool-export.schema.json`

**Why wrong:** Same state, three numbers: 395, 397 and 280. EVAL.md §6.1 handles the 395→397 gap well (it names the serializer and says so). Nobody reconciles the third: the export's `total_bytes` counts description + schema only, so it is 30% smaller than `canon()`'s wire form, and it feeds `estimated_tokens` on a *different* base. `E7`'s Table 1 publishes a single "Bytes" column and `E5` is required to "reproduce the §6.2 baseline" while also validating the export's `accounting` block — the two cannot both be the column.
**Replace with:** in CONTRACTS.md §5, after the accounting example: "`total_bytes` here is `description_bytes + schema_bytes + framing`, which is **not** the same quantity as `EVAL.md §6.1`'s `canon()` wire bytes (280 vs 397 for `S0-anon`). Exactly one of them may appear in the README: **`canon()` bytes are the published figure**; the export's `accounting` block is an internal cross-check and is labelled as such wherever it is shown. `estimated_tokens` is `ceil(canon_bytes/4)`, OUR-ESTIMATE, no tokenizer."

---

**16. The G4 wording lint, as specified, fails on ten of the project's own files — and the documented failure mode is deleting the ban list.**
> "**`erp/RISK.md` and `.team/lint/banned.txt` must be excluded**, because they are the only two files in the repository that are *supposed* to contain every banned string." — `erp/RISK.md:166-170`

**Why wrong:** They are not the only two. Grepping the ban patterns over the tree, the hook also fires on: `PLAN.md` (WindTunnel, 2508.09171, "tool surface is the boundary", "machine-verified", "impossible without WebMCP"), `FACTS.md` (§8 and §9 quote every poison source and every retraction, plus `8–19%`), `GRAPH.md §11`, `TEAM.md §6` and `§8`, and charters `I2`, `C2`, `L2`, `UX`, `K1`, `K2` — all of which quote banned strings *in order to ban them*. `PLAN.md:39-43` spotted this for itself only ("this file… must carry an explicit allowlist"). RISK.md then names the exact hazard — "the usual reaction — deleting rows from the table — is the exact failure this whole section exists to prevent" — and leaves the door open for it.
**Replace with:** "**Excluded from the wording scan:** `erp/RISK.md`, `erp/PLAN.md`, `erp/FACTS.md`, `erp/GRAPH.md`, `erp/TEAM.md`, `erp/charters/**`, `kb/webmcp/BANNED.txt`, `kb/method/BANNED-CITATIONS.md` and `.team/lint/banned.txt` — every one of these quotes banned strings *in order to ban them*, and the hook must carry the list explicitly rather than being satisfied by deleting quotes. The exclusion list is itself checked: `node tools/lint-layer0.mjs --selftest` asserts the hook still fires on `tests/fixtures/banned-sample.js`. **Everything not on this list is scanned**, including README, video script, Devpost answers and all product code."

---

**17. Blind-packet contract: one file or two, at two different paths, with two different verdict schemas.**
> "the packet dir must contain exactly two files" / "builds a directory containing **exactly two files**: 1. `tools.export.json`… 2. `tasks.md`" — `erp/EVAL.md:45, 424-438`
> "`cd /tmp/c1-blind && ls -a` — must print exactly: `.  ..  tools.export.json`" and "If your transcript ever references any other path, **your run is void**" — `erp/charters/C1.md:17-23`; identical in `TEAM.md:215-223`

**Why wrong:** Under C1's own charter, receiving `tasks.md` voids the run; under EVAL.md, a packet without `tasks.md` fails E4's acceptance. The path disagrees too (`artifacts/tools.export.json` in TEAM/GRAPH/C1/I2 vs `outpocket/tools.export.json` in EVAL §3/§8.2), and the output shapes are mutually exclusive: C1.md mandates `{state, verdict: USABLE|AMBIGUOUS|UNUSABLE, first_wrong_call, unfillable_params, …}` while EVAL.md §8.3 mandates per-task operational records plus a six-dimension 0/1/2 rubric with a binary gate, forced by `--output-schema`. Since C1 is one of the four rulers and its verdict is one Codex call, the whole ruler produces nothing usable if these are not reconciled before the packet is built.
**Replace with:** in `C1.md`, "Your working directory contains exactly two files: `tools.export.json` (the surface) and `tasks.md` (eight task statements in the employee's voice). Nothing else. `ls -a` must print exactly `.  ..  tasks.md  tools.export.json`; any other path in your transcript voids the run." — and replace C1.md's output block with a pointer: "Your output is a single JSON document validating against `webmcp-eval-kit/schemas/blind-verdict.schema.json`, as specified in `EVAL.md §8.3`: one operational record per task, plus the six rubric dimensions R1–R6 and the binary gate G." Fix the path to `artifacts/tools.export.json` everywhere.

---

**18. Lane E exists twice with different owners, hours and cut ranks, and EVAL's version invalidates GRAPH's capacity arithmetic.**
> "| **E4** | blind grading protocol + rubric | E | **C4** | … | 2 | 3 |" — `erp/EVAL.md:186`
> "| E4 | Blind grading protocol + rubric for C1 | **L2** | T5 | … | 1.5 | 2 |" and "E4 is owned by **L2**, not C4: it is a ruler, not product code" — `erp/GRAPH.md:190, 195-198`

**Why wrong:** Graph principle 3 is "**exactly one owner seat per node**", and this node has two. Beyond the owner, EVAL.md re-specifies the whole lane: hours 2/3/4/2/2/3/1 versus GRAPH's 1.5/2/2/1.5/1/2/0.5, and it adds **E8 and E9** (+4 h) which do not exist in `graph.json` at all. That moves lane E from 10.5 h to 25 h — so GRAPH's `agent_hours_total_A: 88.0`, the rank-2 "15.0 agent-hours freed", and the 14.4 h human requirement (0.05 × 88.0) are all computed on a lane that no longer exists. Cut ranks conflict too: EVAL marks E2/E3/E5/E7 `cut 0` (never cut) while GRAPH ranks them 2, 2, 1, 2 — and `RISK.md:498` says "GRAPH.md's `cut` field is authoritative", which would delete four nodes EVAL calls unamputatable.
**Replace with:** in `EVAL.md §4`, above the table: "**Authority.** `erp/graph.json` owns `owner`, `hours` and `cut` for every node; this table restates them and must not diverge. **E4's owner is L2** (it is a ruler, not product code, and L2 writes zero product code); C4 owns E1/E2/E3/E5/E6/E7. **E8 and E9 are proposed additions not yet in `graph.json`** — until PM adopts them by deviation ticket, they are 0 h on the board and lane E's Sprint A total stays 10.5 agent-hours. Where this file's cut ranks differ from graph.json's, graph.json wins and PM reconciles in one edit." Then re-run `tools/ready.mjs --path` and reissue §4.2's capacity table if E8/E9 are adopted.

---

**19. GRAPH.md and graph.json disagree about how many rulers rank 2 destroys, and both are wrong.**
> "**Rank 2 is the painful one.** It deletes two of the four rulers… cutting to two means the remaining pair (QA and C3)…" — `erp/GRAPH.md:386-390`
> "The entire eval lane and the blind-verifier ruler (C1 and C4 go idle; three of the four rulers reduce to two)." — `erp/graph.json`, cut_ladder rank 2

**Why wrong:** The four rulers are QA, L2, C3, C1 (`GRAPH.md §3`, `TEAM.md §4`, `RISK.md §8`, `EVAL.md §1` — all four agree). Rank 2 deletes T5 and E4, which removes **C1's instrument only**. C4 is not a ruler (it is the eval engineer). L2 is untouched — its instrument is `erp/RUBRIC.md`, which is not a node and not cuttable. So four rulers become **three** (QA, L2, C3). GRAPH.md's "the remaining pair (QA and C3)" silently deletes the commissar; graph.json's "three of the four rulers reduce to two" is not even self-consistent. PM is told to "treat firing rank 2 as a governance change" on the basis of a count that is wrong in both places.
**Replace with (both files):** "Rank 2 is the painful one: it deletes **C1's instrument** — `T5`'s blind export and `E4`'s protocol — so the four rulers become three (QA measures done, L2 measures enough-to-win, C3 measures breakable, and **nobody measures whether a blind agent can drive the surface**). C4 goes idle but C4 was never a ruler. L2 is unaffected; its instrument is `erp/RUBRIC.md`, which is not a node. PM should treat this as a governance change, not only a scope change."

---

**20. The five unknowns are keyed `T0–T4` in the graph and `V0–V4` everywhere else — and `T0–T4` collides with real lane-T node ids.**
> "requires `evidence/UNKNOWNS.md` to contain exactly 5 rows keyed **T0..T4**" — `erp/graph.json` V6 accept; "`node tools/check-unknowns.mjs` exits 0: exactly 5 rows **T0–T4**" — `erp/GRAPH.md:93`
> "| id | unknown | which contract moves | … | **T2** | does the built-in browser refresh the tool list mid-session | … | **T3** | does an agent-initiated execute carry the page session cookie | … **Nodes V2–V4 answer these.**" — `erp/CONTRACTS.md:664-672`

**Why wrong:** HANDOVER §10 keyed the unknowns T0–T4; `FACTS.md §7`, `RISK.md §4`, `GRAPH.md §2` (lane V), `I1.md` and `EVAL.md §14` all renamed them V0–V4. `graph.json` kept the old keys inside a machine-checked predicate, and CONTRACTS.md §14 kept them in a table whose very next line says "Nodes V2–V4 answer these" — so a single table uses both vocabularies. This is not cosmetic: **T2, T3 and T4 are live node ids in lane T** (registration flips, absence register, description budget). `CONTRACTS.md §14` currently reads as "node T3 — does an agent-initiated execute carry the page session cookie", which is false of the real T3 and will send someone to the wrong seat. GRAPH.md opens with a naming-collision warning about D1–D6 and then commits the same error with T.
**Replace with:** in `graph.json`/`GRAPH.md` V6 accept → "requires `evidence/UNKNOWNS.md` to contain exactly 5 rows keyed **V0..V4**"; in `CONTRACTS.md §14`, retitle the id column rows to **V2 / V3 / V4** and add: "*(HANDOVER §10 numbered these T0–T4; this project renumbered them V0–V4 to avoid collision with lane-T node ids. `T2`, `T3` and `T4` are tool-surface nodes and are unrelated.)*"

---

**21. C1's charter tells the blind verifier the judging agent cannot see annotations.**
> "The judging agent (Sol, in the ChatGPT desktop browser) sees exactly **three** things per tool: `name`, `description`, `inputSchema`." — `erp/charters/C1.md:8-9`

**Why wrong:** It is four. `annotations` (`readOnlyHint`, `untrustedContentHint`) is part of the registered tool definition and is what the client sees — that is the entire basis of iron rule 3, of `T4`'s conformance test, of `EVAL.md §6.3`'s `readOnly` set-equality assertion and of the `S5-aud` red test. `EVAL.md §8.1`, `TEAM.md §5` and `CONTRACTS.md §5` all say four. C1's own required output includes `annotation_violations` and a read-only-honesty judgement (rubric R6), which it cannot produce from three fields. As written, the charter instructs the one seat whose job is to model the judge's view to model it wrong, in the direction of under-crediting our `readOnlyHint` discipline.
**Replace with:** "The judging agent (Sol, in the ChatGPT desktop browser) sees exactly four things per tool: `name`, `description`, `inputSchema`, and `annotations` — where `annotations` can only ever be `readOnlyHint` and/or `untrustedContentHint`. It never sees our source."

---

**22. I2's reporting template mislabels the 13-tool state as "signed".**
> "STATES:   logged-out 1 | employee 5 | draft 12 | **signed 13**   (asserted)" — `erp/charters/I2.md:94`

**Why wrong:** Read from `tools.js:343-354`: 13 is the **clean draft** (12 + `submit_expense_report`, added only when `vd.clean && open.lines.length`), 12 is the **dirty draft**, and a report that is no longer a draft returns **6** tools (`if (open.status !== "draft") return [...base, t_get_open]`). So the surface *shrinks* to 6 after signing — the opposite of what the template implies. I2 is the seat that owns T2's flip assertions; a template that names the states wrong will produce assertions that are right by accident or wrong quietly.
**Replace with:** "STATES:   signed-out 1 | employee-no-report 5 | draft-dirty 12 | draft-clean 13 | submitted 6 | auditor 6   (asserted, set equality on names)".

---

**23. "The five write tools" — the clean-draft state has seven.**
> "*In the page.* While a sign request is open, the five write tools are revoked by aborting their `AbortController`." — `erp/CONTRACTS.md:424-425`

**Why wrong:** In `S2-emp-draft-clean` (13 tools, 6 read-only per `EVAL.md §6.2`, which I confirmed against the compiler) the non-read-only tools are seven: `add_expense_line`, `update_expense_line`, `remove_expense_line`, `link_receipt`, `submit_expense_report`, `create_expense_report`, `open_expense_report`. If the implementer revokes five, two write paths stay registered while a signature is pending — and since layer 1 is explicitly "not a control", nobody's test will catch it; only the server's 423 lock will, which is exactly the belt the document tells you not to rely on alone.
**Replace with:** "*In the page.* While a sign request is open, **every non-read-only tool on the current surface** is revoked by aborting its `AbortController` — seven of them in `S2-emp-draft-clean` (`add_expense_line`, `update_expense_line`, `remove_expense_line`, `link_receipt`, `submit_expense_report`, `create_expense_report`, `open_expense_report`). The set is computed from `annotations.readOnlyHint !== true`, never hard-coded, so a new write tool is covered on the day it is added."

---

**24. N-01 asserts a browser behaviour nothing has measured.**
> "`submit_expense_report` ∉ `getTools()`; then `executeTool("submit_expense_report", …)` rejects **from the browser** (unknown tool), not from our `execute`" — `erp/EVAL.md:385`

**Why wrong:** No iron rule, and nothing in `gatehouse/BUILD.md §2`, establishes what the browser does with an `executeTool` call naming an unregistered tool. `executeTool()` entered the spec on 2026-08-14, is absent from the WPT `webmcp.idl`, and the one thing we *have* measured about browser-side argument handling is that it does almost nothing (IR-10). Meanwhile `tools.js:370` shows the spike already implements its own double lock for exactly this case ("Tool … is no longer on the surface — the page state moved on"), which is a **page**-side rejection. So the negative control is written against an unverified browser guarantee, and if the browser instead forwards the call, N-01 fails for a reason that has nothing to do with our invariant.
**Replace with:** "`submit_expense_report` ∉ `getTools()`; then `executeTool(\"submit_expense_report\", …)` does not reach state. Record **which layer refused** — browser (unknown tool) or page (the `tools.js:370` double lock) — as evidence, and assert only that the report `status` is unchanged and the day-book head is unchanged. Whether the browser refuses an unregistered name is unmeasured and must not be asserted; N-02 covers the captured-handle case at the page layer, which is the one we control."

---

**25. GRAPH.md publishes HANDOVER's token counts as MEASURED, which CONTRACTS.md has already corrected to OUR-ESTIMATE — and misnumbers two iron rules.**
> "E5's baseline to beat is **MEASURED (iron rule 10)**: signed-out 1 tool / 395 chars / ~99 tok; employee 5 / 1,947 / ~487; clean draft 13 / 6,682 / ~1,671; auditor 6 / 2,070 / ~518. **Never present this table as a token saving.** **Iron rule 14 (MEASURED)**: a dynamic surface breaks prefix caching at ~1.25× cache write per flip." — `erp/GRAPH.md:203-207`

**Why wrong:** Two defects. (a) `CONTRACTS.md:297-302` establishes — and I re-verified all four — that 99, 487, 1671 and 518 are *exactly* `ceil(bytes/4)`, i.e. the same OUR-ESTIMATE formula, not independent tokenizer output: "Citing them to a judge as measured token counts would be circular, and E5 must not do it." GRAPH.md is the file the E-lane seat reads for its baseline. (b) The rule numbers are off: in HANDOVER §3, the prefix-cache finding is rule **15**, not 14 (rule 14 is the public-suffix-list trap, which GRAPH.md:237 cites correctly), and the surface-size table is rule **10** (correct). A misnumbered iron-rule citation invites a seat to code against the wrong rule.
**Replace with:** "E5's baseline is the byte count, which is MEASURED (iron rule 10): signed-out 1 tool / 395 chars; employee 5 / 1,947; clean draft 13 / 6,682; auditor 6 / 2,070. **The token figures (~99 / ~487 / ~1,671 / ~518) are `ceil(bytes/4)` — OUR-ESTIMATE, not a tokenizer, and they must be labelled that way anywhere they are published (CONTRACTS.md §5).** Never present this table as a token saving: **iron rule 15** (MEASURED) is that a dynamic surface costs ≈1.25× prompt-cache write per flip. The honest framing is trading cache efficiency for a page-enforced workflow constraint."

---

**26. `VENDOR-CLAIMED` is used for something the user said, which is a grade the taxonomy assigns to vendors.**
> `"human_hours_assumption": "2.5 h/day x 5.5 days, from webmcp-agent-team.md (Daisy tier, 2-3 h/day, 30-50 prompts). VENDOR-CLAIMED by the user."` — `erp/graph.json`; same wording at `GRAPH.md:319`

**Why wrong:** `FACTS.md §0` defines VENDOR-CLAIMED as "A vendor asserts it; we did not verify… **Never load-bearing on its own**", and `FACTS.md §15` grades the user's own stated preferences as PUBLISHED. Here the grade is attached to the single most load-bearing number in the entire capacity model — GRAPH.md §4.3 says this one assumption "is the difference between 'cut half the plan' and 'ship all of it'" — while the grade it carries says it may never be load-bearing. Also "Daisy tier" appears nowhere else in the corpus and will read as noise to any other seat.
**Replace with:** `"2.5 h/day x 5.5 days. Source: the user's own stated budget of 2-3 h/day and 30-50 prompts (PUBLISHED — stated directly by the user, not measured). This single figure decides whether the cut ladder is needed at all (§4.3); PM must settle 2.5 vs 3.0 on Day 1 and re-run tools/ready.mjs --path, rather than discovering it on Day 4."` and drop "Daisy tier".

---

**27. K1's Day-0 seed miscounts the gatehouse rules and over-grades the HANDOVER set.**
> "Seed `kb/webmcp/RULES.md` from the **sixteen measured iron rules** in `countinghouse/HANDOVER.md` §3 and **the twelve** in `gatehouse/BUILD.md` §2." — `erp/charters/K1.md:48-49`

**Why wrong:** I counted `gatehouse/BUILD.md §2`: it has **fourteen** numbered items (1–14, with item 12 written last, out of order — which is probably where "twelve" came from). And HANDOVER §3's sixteen are not all measured: rule 4 (description ≤500 / output ≤1500) is an official *recommendation* and is PUBLISHED, and rule 9's spec-change dates are PUBLISHED. K1's own acceptance bar requires a grade per line, so seeding them all as "measured" guarantees the KB starts with two mis-graded rules — in the file the Layer-0 hook consumes.
**Replace with:** "Seed `kb/webmcp/RULES.md` from the **sixteen** iron rules in `countinghouse/HANDOVER.md` §3 and the **fourteen** in `gatehouse/BUILD.md` §2 (note §2's items are numbered 1–14 but printed out of order — item 12 appears last). **Carry each rule's own grade: most are MEASURED, but the ≤500-char / ≤1500-char budgets are PUBLISHED official *guidance*, not enforcement, and the spec-change dates are PUBLISHED.** Nothing in this file is graded by inheritance."

---

**28. RISK.md moves D1 to Day 1; PLAN.md schedules it on Day 5; GRAPH.md solves the problem a third way.**
> "**`D1` moves to Day 1, not Day 5.** A twenty-line probe page… is deployed to the *production origin* before any product code is written. Node `V1`'s input is a deployed URL, not a localhost port." — `erp/RISK.md:296-300`
> "### Day 5 — 2026-09-02 — Deploy and measure / Nodes: **D1 D3**…" — `erp/PLAN.md:378-379`
> "| V5 | **(ADDED)** Throwaway HTTPS probe origin… | I1 | — | … | 1.5 | 0 |" with V1's input being V5 — `erp/GRAPH.md:92`

**Why wrong:** Three documents, three answers, on the node that RISK.md itself calls "the single failure mode in the plan that is invisible from inside the development loop". GRAPH.md's answer is the good one — a **throwaway** origin (V5) unblocks V1 on Day 1 without dragging the real deploy forward — but RISK.md demands the *production* origin specifically, and its Day-1 trigger ("The V1 probe page is not deployed to the production origin → cut rank 1 immediately") will therefore fire on Day 1 even when the plan is executing correctly via V5. A trigger that fires on correct execution trains PM to ignore triggers.
**Replace with (RISK.md §4's V1 box, consequence 1):** "**`V1` runs on Day 1, against `V5`'s throwaway HTTPS origin — not against the production deploy and not against localhost.** A twenty-line probe page — feature-detect, register one read-only tool, print the result on screen — is deployed to *any* origin we control that is not on the public suffix list, before any product code is written. This is node `V5` (GRAPH.md), and it exists so that `D1` does not have to move off Day 5. If V1 comes back ABSENT, `D2` (custom domain) becomes rank 0 and the production origin question reopens." Correct the Day-1 trigger row to name V5.

---

**29. TEAM.md cites three probability figures as MEASURED; only one exists in the carried-over record.**
> "a self-estimated ~12% figure was carried forward and placed side by side with a 10.5% and a 7.5% that had each been through an external ruler… Evidence grade: **MEASURED** (it happened in our own artefacts)" — `erp/TEAM.md:149-154`

**Why wrong:** HANDOVER records exactly one of these (`REVIEW-codex-2026-08-28.md`, P=7.5%); the 10.5% and ~12% appear nowhere in HANDOVER or FACTS.md, and 10.5% surfaces only in `gatehouse/BUILD.md`'s P0.5 section as a gatehouse figure, not a countersign one. The grade MEASURED is being applied to "this conversation happened", then silently doing duty for the three numbers themselves. This paragraph is the sole evidence offered for the asymmetric-leads design, which is the most consequential organisational decision in TEAM.md.
**Replace with:** "There is live evidence for this from the parallel workstreams: a self-estimated probability was carried forward and placed side by side with figures that had each been through an external ruler, and nothing in the process objected, because the seat that would have objected was calibrated the same way as the seat that produced it. Evidence grade: **OUR-ESTIMATE** — the incident is real and is in our own artefacts, but only the 7.5% codex review figure is recorded in `HANDOVER.md`; the others are not carried over and must not be quoted as measurements. Cite the incident, never the numbers."

---

**30. D1's acceptance predicate fails on a header that is harmless.**
> "`curl -sI $URL | tee evidence/headers.txt; grep -ci 'origin-agent-cluster' evidence/headers.txt` returns 0" — `erp/graph.json` D1 accept, and `GRAPH.md:224`, and `charters/I4.md:52-55`

**Why wrong:** The rule (iron rule 13 / gatehouse §2.12) is that `Origin-Agent-Cluster: **?0**` kills WebMCP. `Origin-Agent-Cluster: ?1` is the opposite setting and is harmless. `RISK.md` N-11 states the correct test — "header absent, **or present with a value that is not `?0`**". As written, D1 fails if Render ever emits `?1`, and the documented reaction to a failing D1 is "deployment is dead for WebMCP regardless of code; D1 reopens **immediately, ahead of all feature work**" — a full-stop on the critical path triggered by a benign header.
**Replace with:** "`curl -sI $URL | tee evidence/headers.txt; grep -i '^origin-agent-cluster:' evidence/headers.txt | grep -q '?0' && exit 1; exit 0` — i.e. the header is absent, or present with a value that is not `?0`. Also assert HTTP 200 and `GET /version` == `git rev-parse HEAD`."

---

### Two notes that are not findings, recorded so the next reviewer does not re-derive them

- **`FACTS.md §3`'s hedge about the "12" is now resolvable.** It says "the 12 is the intermediate before the final tool appears — do not 'fix' one number to match the other without re-measuring." I re-measured against `tools.js:343-354`: 12 (dirty draft) and 13 (clean draft) are both real, and there is additionally a 6-tool submitted state. `EVAL.md §6.2` did this re-measurement correctly and its whole six-state table is sound. FACTS.md §3 can be closed out.
- **The contracts layer's cryptography is genuinely verified,** which is unusual and worth defending: 7/7 canonical vectors, the snapshot digest at 1445 bytes, the provenance-flip and line-order digests, the chain entry, and the `2026-08.1` policy digest at 2458 bytes all reproduce from an independent implementation. The only defects are in the *prose describing* two of them (findings 5, 6) and one byte count (finding 7). Fix those three and the layer is the strongest evidence in the submission — it is the one part a hostile reviewer can check and will find correct.