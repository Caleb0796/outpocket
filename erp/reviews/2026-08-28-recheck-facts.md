Re-verification complete. All digests independently recomputed; Codex CLI exercised on this machine.

## HEADLINE: the one-request forgery is closed. A two-request forgery still commits.

The repaired `commit_request` is `{schema, request_id, report_id}` with `additionalProperties:false` — there is no `signature` field, so the old synthesised `sign_response` has nowhere to go, and the server consults its own record. The original attack now dies at `E_NOT_SIGNED` (409). Confirmed correct.

**But the decision itself is still client-triggerable.** `x-signRequestState.answered` reads: *"Entered ONLY by POST /api/sign/{request_id}/respond arriving on an `open` record from the authenticated session that owns it."* That is the entire admission test. Nothing requires a click — no nonce, no server-issued confirm token bound to the render, no user-activation check, no `Sec-Fetch-*` gate. Grep for `nonce|csrf|userActivation|isTrusted|confirm token` over the whole tree returns **zero hits outside the old review**.

**New attack, `neg-respond-without-click`** (same threat model as the plan's own N-04: curl, session cookie, no browser):

1. `submit_expense_report` → server returns `sign_request` with `snapshot_digest` D, `revision` R.
2. Never render the dialog. `POST /api/sign/sg_…/respond` with `{schema:"outpocket.sign_respond_request/1", request_id:"sg_…", decision:"signed", reason:null, method:"click", acknowledged_digest:D, acknowledged_revision:R}` — every field a constant or copied verbatim from the response the server just issued.
3. `POST /api/reports/R/commit {schema, request_id, report_id}`.

Eleven-code walk. At step 2 the only code defined on `/respond` is `E_DIGEST_ACK_MISMATCH` — we echoed D, so no. Record → `answered(signed)`. At step 3: `E_NOT_SIGNED` no (answered+signed) · `E_SNAPSHOT_MISMATCH` no (nothing changed) · `E_REVISION_MISMATCH` no (server's own R) · `E_DIGEST_ACK_MISMATCH` no (moved upstream) · `E_SIGN_REQUEST_UNKNOWN` no · `E_SIGN_REQUEST_EXPIRED` no (<300 s) · `E_SIGN_IN_PROGRESS` no · `E_POLICY_VERSION_MOVED` no · `E_NOT_CLEAN` no · `E_FORBIDDEN` no (chen's own session) · `E_DECLINED` no. **Committed.** `chain_entry{kind:"commit", source:"human", actor:"Chen Xiao"}` plus a stored artifact.

What R-1 actually bought is real but narrower than advertised: the attacker loses the ability to choose the name and the timestamp. It is arguably *worse* forensically — the record now carries a **true attribution of a false event**, signed `chen` at a genuine server time, indistinguishable from a real click in the day book forever.

The schema layer states this honestly — `sign_respond_request.description`: *"the decision is the arrival of this request on an open record from an authenticated session."* Every headline above it overclaims: N-15's title "**a commit cannot be made without a human decision**", `x-freeze.does` layer 0 "**Layer 0 answers 'did a human decide?'**", `x-signRequestState.forgeryClosed`. The provable sentence is "a commit cannot be made without a POST from the authenticated session to `/respond`."

Two aggravators. (a) The vector is a direct function of open unknown **V3** ("does an agent-initiated execute carry the page session cookie") — if V3 returns *yes*, the agent can drive `/respond` itself; `CONTRACTS.md:948` notices V3 "got **more** load-bearing under R-1" but frames it as an attribution problem, never as the forgery vector. (b) `charters/C3.md:133` tells the red team *"Your job is to prove that closure, not to rediscover the hole"* and enumerates four sign-gate attacks — replay, race a second respond, wrong `request_id`, expire-and-commit — **none of which is "POST `/respond` yourself."** The one instrument that would find this is pointed away from it.

---

## Prior findings

### eval-realism (`reviews/2026-08-28-eval-realism.md`)

| # | finding | status |
|---|---|---|
| 1 | sign-response forgery | **PARTIAL** — one-request form closed; two-request form above still commits |
| 2 | C1 blindness leaks via MCP/AGENTS.md/hooks | **CLOSED** — verified: hermetic `CODEX_HOME` drops AGENTS.md, `node_repl`, plugins, hooks, oracle OAuth callout; effort `low` took without `-p` |
| 3 | `-p <missing>` silently succeeds | **CLOSED** — re-measured: exit 0, no warning, banner `reasoning effort: medium`. Banner **does** print to non-TTY stdout, so the repaired `test -f` + banner-grep predicate is a working check. Zero profiles exist today; EVAL.md:144 states that correctly and assigns creation to L0 |
| 4 | TEAM.md ran C1 inside the repo | **CLOSED** — short form deleted, "there is no short form" |
| 5 | C1 charter contradicts §8, leaks the answer key | **CLOSED** — 12 iron rules → 4, "four things per tool", two-file packet, rubric schema is sole field source, three admissibility clauses |
| 6 | two incompatible canonicalisers | **CLOSED** — verified independently (below) |
| 7 | `HTTPS_PROXY` proof vacuous | **CLOSED** — `node --import test/no-net.mjs` |
| 8 | `workspace-write` has no network; C3 forbidden `evals/` | **CLOSED** — verified: bare → "Network access is restricted", `-c sandbox_workspace_write.network_access=true` → "Network access is enabled". C3 writes `tests/redteam/`, C4 mirrors |
| 9 | five vacuous negative controls, N-01/N-02 contradictory | **PARTIAL** — prose repair is excellent (N-08/N-09 → `not-runnable`, N-10/11/13/14 → guards G-10/11/13/14, N-02 restated, N-16/17/18 added, `brokenBy` + E10). But the enforcing fields are **illegal under the frozen schema** — see NEW-1 |
| 10 | pairing asserted arithmetically | **PARTIAL** — `pairsWith` map replaces `14 >= 7`; same schema problem |
| 11 | `getTools()` measured under the wrong flag | **CLOSED** — H2 first-hour reachability gate in EVAL §2.5, `graph.json` H2 accept, contingency, and §15 |
| 12 | charter/EVAL drift (bytes, paths, `PASSED n/m`, "max") | **CLOSED** |

### fact-conformance (`reviews/2026-08-28-fact-conformance.md`)

**CLOSED (22):** 1, 2, 5, 6, 7, 9, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30. Several verbatim as recommended.

| # | finding | status | evidence |
|---|---|---|---|
| 3 | "structural guarantee" ×3 | **PARTIAL** | `EVAL.md` and `PLAN.md` fixed; **`FACTS.md:164` unchanged**, and it is the site that says this is *"the only [framing] permitted in README, video and Devpost text"* — i.e. it licenses a banned string into the one scan set G4 still covers |
| 4 | rule count 16 vs 19 | **PARTIAL** | 19 everywhere except **`FACTS.md:531`**. `RISK.md:579` now says "any document still saying '16 rules' is stale" — the project condemns its own file |
| 8 | attesting "a specific agent" | **OPEN** | `PLAN.md:178` unchanged, inside the memorise-these-four block. `graph.json:355` now states *"no claim about attesting 'a specific agent' may be made anywhere"* — direct self-contradiction against the graph authority |
| 10 | 199/420 → 44% | **PARTIAL** | `I4.md:18-20` and `L2.md:88` fixed with an explicit denominator note; **`FACTS.md §4`** still one table, mixed bases (623/529/420/~452), no denominator column — the source of the error |
| 12 | "1 hit in 623" as rarity | **PARTIAL** | `PLAN.md:283`, `UX.md:92` carry the caveat; **`FACTS.md:518`** still bare |
| 19 | rank-2 ruler count | **PARTIAL** | `GRAPH.md:688-717` fixed *and* explicitly records that `graph.json.cut_ladder` rank 2 is still self-contradictory ("three of the four rulers' instruments" then names two; "four rulers become THREE" when it is two). Disclosed, not fixed, in the file RISK.md calls authoritative |
| 23 | "the five write tools" | **OPEN** | `CONTRACTS.md:628` **and** `signature.schema.json` `x-freeze.does[0]`, which names exactly five and omits `submit_expense_report`/`open_expense_report`. `graph.json:474` says *"SEVEN tools, not five… computed from `annotations.readOnlyHint !== true`, never hard-coded"* — the frozen contract now contradicts the graph |

**Root cause of every PARTIAL/OPEN above.** `stat` on the tree: `FACTS.md` 17:38:04, `canonical-vectors.json` 17:42, `provenance.schema.json` 17:45, `policy.schema.json` 17:48 — all **before** `reviews/*` at 18:09. Everything else is 18:37–18:57. **`FACTS.md` was never opened during the repair pass.** Every fact-conformance finding whose site is in `FACTS.md` is open by construction; nothing else explains the pattern.

### What I verified by execution

Independent from-scratch OCF-1 implementation (`/private/tmp/claude-501/-Users-calebwei-mcp/67898feb-2bcd-4702-acaa-66b19b7e96db/scratchpad/ocf.py`):

- **7/7** canonical vectors reproduce, canonical string and digest.
- `2026-08.1` → `sha256:b7ccc1ff…`, **2458** bytes. ✔
- `2026-08.2` three-edit derivation → `sha256:d024607e…`, **2457** bytes. ✔ (finding 7 fixed)
- limit-only edit → `sha256:17bc4b2d…`. ✔ (finding 5's warning is correct)
- **All five republished R-1 snapshot digests reproduce**: snapshot `d2a4cb99…` at **1480** bytes; consistent re-total `e684cca2…`; provenance flip `a688b890…`; line reversal `1e37bf76…`; new cross-request replay `39a3efd9…`. ✔
- Chain entry `86a23ca0…` reproduces. ✔

A BREAKING projection change was executed and every dependent digest correctly recomputed. This layer is the strongest thing in the submission and it survives hostile recomputation.

Codex CLI 0.144.6, this machine: `-p nonexistent-profile-xyz` → **exit 0**, silent fallback, banner `reasoning effort: medium`; `ls ~/.codex/*.config.toml` → **no matches**, no `[profiles.*]` table; bare `workspace-write` → "Network access is restricted"; `+network_access=true` → "Network access is enabled"; `-s read-only` under the default home still fired the `oracle_dbtools` OAuth request and both `SessionStart`/`UserPromptSubmit` hooks; hermetic `CODEX_HOME` suppressed all of it.

---

## NEW problems introduced by the repair

**NEW-1 [CRITICAL] — the mechanism that makes negative controls non-vacuous is illegal under the frozen contract.** `contracts/eval-case.schema.json` (edited 18:48, so touched) has root `additionalProperties:false` with exactly `['driver','expect','id','schema','setup','steps','suite','title']`. **`pairsWith`, `provingNode` and `brokenBy` are not permitted properties and appear nowhere in the file.** Yet `EVAL.md §7.1` says *"Every must-fail case declares three fields, and the suite file is invalid without them"*; E3's accept requires *"Every case declares `provingNode` and `brokenBy`"*; and **E10** — the entire answer to eval-realism finding 9, the only mechanical definition of a real negative control this project has — executes `brokenBy`. A conforming suite file cannot carry the fields; a suite file with them fails validation. E3, E10 and the pairing map are all unsatisfiable as frozen. This is a ten-second check for a reviewer with `python3 -c "import json"`.

**NEW-2 [HIGH] — N-06 asserts a status the repaired contract cannot return, and its `brokenBy` cannot flip it.** `EVAL.md:543` asserts `overTheWire(409)` for a `request_id` presented against a different report. The repaired `commit_request.report_id` says *"Must match the report_id on the server's sign record; a mismatch is `E_SIGN_REQUEST_UNKNOWN`"* — which `x-rejectionCodes` gives **HTTP 404**. N-06 fails on the code it asserts. Worse, its declared `brokenBy` is "drop `report_id` from the snapshot projection" — but replay is now blocked by the server's own record lookup, so that mutation does **not** flip the case, and `--verify-controls` (E10) fails the run on N-06 by construction. The codes moved under R-1 and this row did not move with them.

**NEW-3 [MEDIUM] — F4's acceptance predicate contradicts the frozen `sign_respond_request`.** `graph.json:560`, `GRAPH.md:308` and `charters/UX.md:97` all assert the dialog POSTs a body carrying **"ONLY `{decision, reason}`"**. The frozen schema requires seven fields (`schema`, `request_id`, `decision`, `reason`, `method`, `acknowledged_digest`, `acknowledged_revision`) with `additionalProperties:false`. A body that passes F4's test fails schema validation and carries no `acknowledged_digest` for `E_DIGEST_ACK_MISMATCH` to check. The "no `signed_by`, no `at`" point is right; "only two fields" is the overshoot.

**NEW-4 [MEDIUM] — EVAL.md:64-65's `CODEX_HOME` number is not reproducible.** Claim, graded MEASURED: *"An empty `CODEX_HOME` drops the rendered prompt from 32,412 to 11,217 bytes."* Measured today: **32,359 → 15,666**. The ~4.5 KB delta is the `<recommended_plugins>` marketplace catalog, which **survives** the hermetic home (2 occurrences, a live list of third-party app names) — it does not come from `$BH/config.toml`, so `blind-home.sh --verify`, which asserts only the contents of `$BH`, cannot see it. C1's prompt therefore contains an uncontrolled, time-varying block, and the blind run is not reproducible run-to-run. Benign for C1's task; fatal to the word "hermetic" and to a MEASURED byte count a reviewer can re-run.

**NEW-5 [MEDIUM] — `E_DECLINED` and `E_NOT_SIGNED` both claim the same condition with different HTTP codes.** `E_NOT_SIGNED` (409): *"…it was `declined`…"*. `E_DECLINED` (200): *"The record is `answered` with decision `declined`."* Both are in `commit_result.error.code`. Commit against a declined record has two contradictory correct answers.

**NEW-6 [LOW] — the eval-case examples pass float tool arguments** (`amount: 86.4`, `212.4`, `106.2`) while `CONTRACTS §3.1` rule 3 says *"No float ever enters a canonical form"* and N-07 tests *"a non-integer amount"* must return a violation envelope. The dollars→cents conversion boundary is stated nowhere, so `neg-post-signature-tamper` may be refused as a bad argument before it ever reaches the snapshot comparison it exists to test.

---

## Verdict

**Yes — an expert reviewer would still find claims that collapse.** The cryptographic layer is now genuinely bulletproof (7/7 vectors, five republished digests, a BREAKING projection change executed correctly), and 22 of 30 fact findings plus 9 of 12 eval findings are properly closed. But three things a hostile reviewer reaches for first still break: the sign gate's headline claim ("a commit cannot be made without a human decision") falls to a two-line curl that the plan's own N-04 threat model already puts in scope and that C3's charter tells the red team not to look for; the negative-control non-vacuity mechanism (`brokenBy`/E10) is forbidden by the frozen schema it must validate against; and `FACTS.md` — the evidence ledger, the file the whole grading discipline rests on — was never opened during the repair, so it still says "16 rules", still says "structural guarantee", and still licenses that phrase for the README, the video and the Devpost answers.