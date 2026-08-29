## HEADLINE: the sign gate does not prove a human signed. Working forgery below.

I read EVAL.md, TEAM.md, CONTRACTS.md, all 16 charters (C1/C3/C4 in full), and `contracts/signature.schema.json`, and I exercised the real `codex` CLI (0.144.6) on this machine. Everything marked MEASURED below I ran.

---

### 1. [CRITICAL] `sign_response` carries no server-held secret — a commit can be forged with no human in the loop

`signature.schema.json` `$defs.sign_response` is entirely client-authored. Its fields are `request_id`, `decision`, `reason`, `signed_by`, `method`, `at`, `acknowledged_digest`, `acknowledged_revision`. **Every one of them is either a constant, attacker-chosen, or copied verbatim out of the `sign_request` the server itself just returned** (`sign_request.snapshot_digest` → `acknowledged_digest`; `sign_request.revision` → `acknowledged_revision`; `sign_request.request_id` → `request_id`). There is no nonce, no MAC, no server-issued confirm token.

**The attack (`neg-commit-without-human`):**

1. Call `submit_expense_report`. The server creates `sg_XXXXXXXXXXXXXXXX`, takes the sign lock, and returns the `sign_request` — including `snapshot_digest` and `revision`.
2. Never render the dialog. Synthesise:
   ```json
   {"schema":"outpocket.sign_response/1","request_id":"sg_XXXXXXXXXXXXXXXX",
    "decision":"signed","reason":null,"signed_by":"chen","method":"click",
    "at":"<now>","acknowledged_digest":"<sign_request.snapshot_digest>",
    "acknowledged_revision":<sign_request.revision>}
   ```
3. `POST /api/reports/R/commit` with that as `commit_request.signature`.

Walk the full `x-rejectionCodes` table: `E_SIGN_REQUEST_UNKNOWN` no (real id), `E_SIGN_REQUEST_EXPIRED` no (<300 s), `E_REVISION_MISMATCH` no (copied), `E_DIGEST_ACK_MISMATCH` no — it is defined as *"acknowledged_digest differs from the digest the server issued in the sign request"*, and we copied that digest, `E_SNAPSHOT_MISMATCH` no (the lock guarantees nothing changed), `E_POLICY_VERSION_MOVED` no, `E_NOT_CLEAN` no, `E_FORBIDDEN` no, `E_DECLINED` no. **Committed.** A `chain_entry` is written and an `artifact` stored attesting a human signature, `signed_by: "chen"`, at a client-chosen timestamp.

The cruelty is structural: the tamper defence works *because nothing changed between sign request and commit*. The forgery succeeds **for exactly the same reason**. A digest comparison cannot distinguish "human signed and nothing changed" from "nobody signed and nothing changed." **There is no rejection code for "this sign request was never answered"** — the ten-code table has no `E_NOT_SIGNED`, which is direct evidence the server has no `open → answered → committed` state machine.

Two attempted defences in the docs do not cover this:
- §7.4/`x-freeze.doesNot` says *"None of this defends against script execution in the page."* This attack needs no script execution. It needs a POST with the session cookie — a vector EVAL's own **N-04** establishes as in-scope and mandatory to test (`curl` from CI, cookie, no browser).
- The schema's rationale for `acknowledged_digest` — *"so that a page-side substitution between render and click is detectable server-side"* — is **false as written**. A substituted dialog renders content X and echoes the server's digest D; server rebuild equals D; it passes. The echo verifies only that the client can copy a number the server handed it.

This is the maximal form of C3's own standing target #6 ("provenance laundering: get an agent-proposed field to present as human-edited"), and the contract layer does not close it. It contradicts the design's stated principle — *"the tool surface is the intent surface; the boundary is on the server"* (EVAL §7) — because the human-decision half of the gate lives on the client.

**Fix (the server must own the decision, not verify a claim about it):**
- Add sign-request server state: `open → answered(signed|declined) → committed | expired`. Commit requires `answered`.
- The click POSTs `/api/sign/{request_id}/respond`. The server records `decision` from the body but takes **`signed_by` from the session cookie and `at` from the server clock** — never from the payload. (Today `signed_by` is a free 120-char client string: an agent can commit as anyone.)
- **Delete `signature` from `commit_request`.** Reduce it to `request_id`; the server looks up its own record. Add `E_NOT_SIGNED` (409) to `x-rejectionCodes`.
- Add `request_id` to the snapshot projection (`$defs.snapshot` required list) so a digest can never be presented against a different sign request. Note this is a BREAKING projection change per the §7 compatibility table — it must land before the C4 freeze at 2026-08-29 18:00, not after.
- Add negative control **N-15 `neg-commit-without-human`** exactly as scripted above, asserting 409 `E_NOT_SIGNED`. This is a *genuine* negative control: it fails today and passes only after S5/S6 land the state machine.

---

### 2. [CRITICAL] C1's blindness is not enforced — MCP servers and the global AGENTS.md leak straight past `-s read-only`

Traced end to end with `codex debug prompt-input` (no model calls). EVAL §9.3 command (4) is:
```
codex exec --strict-config -p verifier -C "/tmp/blind-packet-$FREEZE" -s read-only --skip-git-repo-check --ephemeral …
```
`-C` sets cwd; it is **not a jail**. `-s read-only` grants *full-disk read* — C1 can `cat /Users/calebwei/mcp/outpocket/src/erp.js` at will. Worse, the base `~/.codex/config.toml` (which `-p` layers *on top of*, and which EVAL §9.1 wrongly describes as containing only two keys — it is 6,416 bytes) enables:

- `[mcp_servers.node_repl]` — a Node REPL, **enabled**, with `NODE_REPL_TRUSTED_CODE_PATHS`. MCP servers are separate processes; the Codex filesystem/network sandbox does not govern them. `require('fs').readFileSync(...)` reads the repo.
- `[plugins."chrome@openai-bundled"]`, `[plugins."browser@openai-bundled"]`, `sites`, `superpowers`, `codex-app-tools` — all `enabled = true`. These give C1 a browser, i.e. the deployed URL.
- `[mcp_servers.oracle_dbtools]` — MEASURED: during my `-s read-only` smoke run this server made an outbound OAuth request and logged an auth error, while the prompt told the model *"Network access is restricted."* Proof that "restricted" applies to the shell tool only.
- `~/.codex/AGENTS.md` (9,271 chars) is injected into the prompt **even with cwd outside any git repo** — MEASURED, item 3 of the rendered prompt list.
- `[hooks] UserPromptSubmit`/`SessionStart` fire `context-handover.py`, which injects prior-session handover text. MEASURED: both hooks ran in my smoke test. That is an uncontrolled injection channel into a supposedly hermetic run.

The §1 "mechanical enforcement" greps catch none of this: they only fail on `src/`, `.mjs`, `.js` appearing in the *verdict*, which a well-behaved model will never emit even after reading the source.

**Fix — isolate `CODEX_HOME`, don't isolate `cwd`.** MEASURED working: with an empty `CODEX_HOME`, AGENTS.md, plugins, apps, and the recommended-plugins block all vanish (prompt drops 32,412 → 11,217 bytes).
```bash
BH=/tmp/codex-blind-home-$FREEZE
mkdir -p "$BH" && cp ~/.codex/auth.json "$BH/"          # auth still reads CODEX_HOME
printf 'model = "gpt-5.6-sol"\nmodel_reasoning_effort = "low"\n' > "$BH/config.toml"
# no AGENTS.md, no [hooks], no [mcp_servers], no [plugins]
CODEX_HOME="$BH" codex exec --strict-config -C "/tmp/blind-packet-$FREEZE" \
  -s read-only --skip-git-repo-check --ephemeral --ignore-rules \
  --output-schema … -o … "$(cat "$EK/prompts/E4-blind.md")"
```
Add to §15: assert `$BH` contains no `AGENTS.md`, and that `config.toml` has zero `mcp_servers`/`plugins`/`hooks` tables. Also add a positive admissibility check: the verdict is void unless the transcript shows zero tool calls outside the packet dir. Since this dedicated home has no profile file, drop `-p verifier` and put the two keys directly in `$BH/config.toml`.

---

### 3. [CRITICAL] `codex exec -p <missing-profile>` silently succeeds — every profile in the design is unverified, and the doc's own acceptance test cannot detect it

MEASURED, verbatim:
```
$ codex exec --strict-config -p nonexistent-profile-xyz --ephemeral -s read-only \
    --skip-git-repo-check -o /tmp/sc.txt "Reply with exactly: OK"
… model: gpt-5.6-sol … reasoning effort: medium …
codex: OK          EXIT=0
```
No error, no warning. It fell back to the base config's `medium`. EVAL §9.2's acceptance check #2 runs exactly this shape and then does `grep -q OK` — **it passes with no profile file present at all.** TEAM.md:421 stakes the same claim on the same vacuous probe (*"Grade: UNVERIFIED until `codex exec -p verifier 'print ok'`"*).

Consequence: C3 ("maximum reasoning") and C4 ("high") can silently run at `medium` for the entire sprint, and C1 at `medium` instead of `low`, with every result file still green. This is the single cheapest way for the whole eval to be quietly wrong.

**Fix — assert existence and assert the effect:**
```bash
for p in verifier builder redteam evaluator; do
  test -f ~/.codex/$p.config.toml || { echo "missing profile $p"; exit 1; }
  python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))" ~/.codex/$p.config.toml || exit 1
done
want_verifier=low; want_builder=medium; want_redteam=high; want_evaluator=high
for p in verifier builder redteam evaluator; do
  eval "want=\$want_$p"
  codex exec --strict-config -p "$p" --ephemeral -s read-only --skip-git-repo-check \
    "Reply with exactly: OK" 2>&1 | tee /tmp/smoke-$p.log | grep -q "^codex$" 
  grep -q "reasoning effort: $want" /tmp/smoke-$p.log \
    || { echo "profile $p did not take effect (banner disagrees)"; exit 1; }
done
```
Good news, also MEASURED: `--strict-config` does **not** reject the real `config.toml` — that part of §9.2 is sound. And `-o` does write correctly.

---

### 4. [CRITICAL] TEAM.md's actual C1 launch command runs the blind verifier inside the repo

TEAM.md:61 prints the roster command as:
```
codex exec -p verifier "$(cat .team/contracts/C1-blind.txt)"
```
No `-C`, no `-s read-only`, no `--skip-git-repo-check`, no `--output-schema`, no `--ephemeral`. TEAM.md:47 puts `.team/` **inside `outpocket`**, so this runs with cwd = the product repo, default sandbox, the repo's own `AGENTS.md` loaded, and full read of `src/`. TEAM.md:216 has the `/tmp/c1-blind` copy step but the roster table — the thing an operator will actually copy-paste at 03:00 — does not use it. **Fix:** replace TEAM.md:61 with the full §2 command, and delete the short form so it cannot be copied.

---

### 5. [HIGH] The C1 charter contradicts EVAL §8 on every material point, and leaks the answer key it is supposed to test

`charters/C1.md` and `EVAL.md` §8 cannot both be executed:

| | C1.md | EVAL.md §8 |
|---|---|---|
| packet | "exactly one file"; `ls -a` "must print exactly: `.  ..  tools.export.json`" | **exactly two** files (`+ tasks.md`); §1 asserts `ls -1 \| wc -l = 2` |
| output | `artifacts/c1-verdict-<state>.json`, one per state | one `reports/blind/<freeze>.json` |
| fields | `verdict`, `first_wrong_call`, `unfillable_params`, `unexplained_absences`, `annotation_violations` | `firstTool`, `canConstructArgs`, `missingInfo`, `ambiguousWith`, `wouldAskHuman`, R1–R6, gate G, `confidence`, `worstProblem` |
| what the judge sees | "exactly **three** things per tool" | "exactly **four**" (incl. `annotations`) |
| who hands the export | L1 | C4, via `make-blind-packet.mjs` |

The two field sets share **zero** names; `blind-verdict.schema.json` can only satisfy one, so `codex exec --output-schema` will make C1 emit a shape its own charter forbids. C1.md's "three things" also contradicts C1.md's *own* iron rule 3 (annotations exist) and makes rubric dimension R6 (`readOnlyHint` honesty) ungradeable. Its `ls -a` check is additionally just wrong — `ls -a` on a one-file dir prints three entries, so the stated command never matches its stated expected output.

**The leak is worse than the mismatch.** C1.md ships C1 a 12-item "API iron rules" block before it grades. Rule 10 — *"Descriptions must not encode workflow order. The registration state machine is the workflow"* — is precisely design kernel ① that EVAL §8.1 says C1 exists to test (*"The blind grader is the only instrument that can tell us whether the state machine communicates itself"*). Rule 4 hands over the exact 500/1500-char budgets graded by R5 and tested by N-12/N-14. Rules 9 and 12 pre-answer the iframe and `Origin-Agent-Cluster` questions. **A grader told that missing ordering prose is intentional will not report "I could not tell what order to call these in."** The §1 greps cannot catch this — it is a leak of design intent, not of source paths.

**Fix:** (a) rewrite C1.md to EVAL §8's packet, schema, and output path, and make it the single source; (b) delete iron rules 4, 9, 10, 11, 12 from **C1.md only** (keep them in C3.md/C4.md, where the seat needs them and is not an instrument); (c) C1 needs exactly rules 1–3 and 6 — what the API *is* — and nothing about what our surface *should* look like; (d) add a §8.4 admissibility clause: the packet-builder must fail if the prompt or charter contains any of the graded rubric's criteria.

---

### 6. [HIGH] Two incompatible canonicalisers — the digest-equality assertions in §6.4 and §8.4 can never hold

EVAL §6.1 defines `digest = sha256(canon(surface))` where `canon` is `JSON.stringify` over an array sorted by `localeCompare`, no `kind` prefix, nested key order untouched. CONTRACTS §3 defines OCF-1: sorted keys **recursively**, NFC strings, integers only, and `digest(kind, value) = sha256(kind + "\n" + canon(value))` with kind `outpocket/surface/1` for "one state's `tools` array in the export" — which is what `tools.export.json.surface_digest` holds.

These produce different bytes for the same surface, always. So:
- §6.4 item 4 ("E6 asserts the deployed surface digest equals the frozen one") and §8.4 ("the export digest equals `surfaces.frozen.json`") compare an OCF-1 digest to a `canon.mjs` digest. **They can never be equal.** Both are unsatisfiable as written.
- The export envelopes also disagree completely. EVAL §8.2: `{freeze, chromiumMajor, capturedAt, states:{<id>:{digest,tools}}}`. CONTRACTS §5: `{schema, app_commit, policy_version, policy_digest, states:[{state_id,preconditions,tools,surface_digest,accounting}], totals}`. **No shared key except `states`, whose type differs (object vs array).** T5 can only build one.
- The byte numbers disagree for the same state: CONTRACTS §5 gives `signed_out` `total_bytes 280 / estimated_tokens 70`; EVAL §6.2 gives `S0-anon` `397 / 100`. EVAL §6.1's whole "one definition, forever" paragraph is written to kill exactly this class of discrepancy and then a second definition ships in the adjacent frozen contract.
- **OCF-1 cannot canonicalise `inputSchema` at all.** §3.1 rule 1 requires every key match `^[A-Za-z0-9_]{1,64}$` or raise `E_CANON_KEY`. JSON Schema keys `$schema`, `$ref`, `$defs` all fail. Rule 3 forbids non-integers, so `"multipleOf": 0.01` raises `E_CANON_NUMBER`. Any tool whose schema uses these makes the surface digest uncomputable.

**Fix:** delete `canon.mjs`'s independent definition; make `canon.mjs` a *port of OCF-1* verified against `contracts/canonical-vectors.json` (all seven vectors) as `webmcp-eval-kit`'s `npm test`. Compute surface digests as `digest("outpocket/surface/1", tools)`. Reconcile §6.2's byte table to OCF-1 and restate the numbers once. Add an OCF-1 carve-out permitting `$`-prefixed keys inside an `inputSchema` subtree, or require T-lane to emit `$`-free schemas and lint it. Pick one export envelope — CONTRACTS §5's, since it is frozen and carries `policy_digest` — and rewrite EVAL §8.2's example to match.

Separately, even standalone `canon.mjs` is not reproducible: `localeCompare(a,b,"en")` is ICU-dependent (a stranger's clean clone can sort differently), and nested `inputSchema` key order is whatever the page emitted, so a semantically identical schema re-ordered by a T-lane edit changes the digest with no surface change. Use codepoint sort (`a.name < b.name ? -1 : 1`) and recursive key sorting. `canon.mjs` also uses `createHash` with no import.

---

### 7. [HIGH] E5's "zero model calls" proof is vacuous — `HTTPS_PROXY` does not constrain Node

MEASURED on this machine, Node v22.23.1:
```
$ HTTPS_PROXY=http://127.0.0.1:1 https_proxy=http://127.0.0.1:1 node pxt.mjs
proxy env: http://127.0.0.1:1
FETCH REACHED SERVER, status 401 -> HTTPS_PROXY did NOT block it
```
Node's global `fetch` (undici) ignores proxy env vars without an explicit `ProxyAgent`. E5's acceptance predicate (§4, §10.1, and §15's checklist line) therefore certifies nothing: a run that called `api.openai.com` would exit 0 and be recorded as model-free. This is the one claim EVAL says it tests about itself, and it is the one that does not test.

**Fix — deny the syscall, not the env var.** Any of:
```bash
# a) hard, and it is already a dependency of this project:
codex sandbox -s read-only -- npx webmcp-eval account …   # read-only ⇒ network denied (MEASURED)
# b) portable in-process guard, add to account.mjs's test:
node --import ./test/no-net.mjs …   # no-net.mjs throws from net.Socket.prototype.connect + dns.lookup
# c) Linux CI:
unshare -rn npx webmcp-eval account …
```
Then assert exit 0. Also state which one ran in `accounting.json`'s header, since "zero model calls" is a published claim.

---

### 8. [HIGH] Two of the five standing Codex commands cannot do their job — `workspace-write` has no network

MEASURED via `codex debug prompt-input`: default `-s workspace-write` renders *"Network access is enabled"* only with an explicit override; bare `workspace-write` renders **"Network access is restricted."**

- Command (5), C3 red team, is documented *"full access, against the deployed origin"* but runs `-s workspace-write` — **no network, so it cannot reach the deployed origin at all.** Its entire standing target list (client-side 403, curl-level auditor 403, determinism across reboots) is unreachable.
- Command (1), C4, `-s workspace-write` in a fresh `webmcp-eval-kit` — `npm install` fails.

**Fix:** append `-c sandbox_workspace_write.network_access=true` to commands (1) and (5). MEASURED as the correct key: the permissions block flips to "Network access is enabled." Do **not** add it to command (4).

Also on command (5): `-C "$OP"` makes `outpocket` the writable root, but E9's accept requires C3 to append to `outpocket/evals/suites/negative.suite.json` — a path `charters/C3.md` **explicitly forbids** ("You must never touch … `evals/`"; "You own `tests/redteam/**`. Nothing else, in any repo"). **E9's acceptance predicate is unsatisfiable under C3's own charter.** Fix: either grant C3 `evals/suites/negative.suite.json` in the charter, or change E9's accept to "every successful break lands as a runnable file in `tests/redteam/`, and C4 mirrors it into `negative.suite.json` in the same merge window."

And `-o` on command (5) captures only the agent's **last message**; E9 requires ≥8 attempted breaks each with a repro command in that file. Make the report a file C3 writes with the shell tool and use `-o` only for a status line.

---

### 9. [MEDIUM] Five negative controls pass vacuously today, and N-02 contradicts N-01

Checked against the actual `countinghouse` tree (`src/{erp,policy,samples,scenarios,tools}.js` — MEASURED: no server, no `http.createServer`, no `express`, no `fetch(`, no iframe, no testkit, no header config).

| id | verdict |
|---|---|
| **N-09** "test kit invisible without token → 404" | **vacuous.** No testkit exists; *any* unknown path 404s. Green today, green if S-lane never ships, green if the token check is later deleted. |
| **N-10** "no tool registered in an iframe" | **vacuous.** The app has no iframes and no plan for one. Cannot fail in any reachable state. |
| **N-11** "no `Origin-Agent-Cluster: ?0`" | **vacuous** (nobody sets it) *and* unrunnable (needs D1). |
| **N-13** flow-prose lint | **vacuous as a control** — no description contains flow prose today. It is a regression guard, not a negative control. |
| **N-14** `description.length <= 500` | same. |
| **N-02** captured-handle replay | **not a real mechanism.** Chrome gives the client no callable handle — invocation is `executeTool(name, …)`, which *is* N-01. Worse, N-02 asserts the result text matches `/no longer on the surface/`, while N-01 asserts the browser rejects it as an unknown tool. Both cannot hold: our page text can only be produced if the tool was never actually unregistered, i.e. if revocation is fake. **N-02 as written passes only when N-01's invariant is broken.** |

Genuinely red today, i.e. real: N-03 (over-the-wire half), N-04, N-05, N-06, N-07, N-08, N-12 — plus proposed N-15.

**Fix:** (a) require every must-fail case to name a `provingNode` and a `brokenBy` — a one-line mutation that makes it go green — and have `webmcp-eval run --suite negative --verify-controls` apply each `brokenBy` and fail the run if the case does not flip; that is the only mechanical definition of "real negative control" and it directly implements C4's own charter bar (*"These tests must be red when the mechanism is removed"*), which EVAL currently states nowhere. (b) N-09: assert the *distinguishing* pair — with token → 200/400, without → 404 — so it can only pass if the endpoint exists. (c) N-10: demote to a build-time lint (`grep -c '<iframe' dist/` = 0) or delete; keep §2.2.2 as design rationale. (d) N-11/N-13/N-14: relabel as **guards**, listed in a separate README table from the negative controls, so Table 2's "every row must read `refused`" means something. (e) Delete N-02, or restate it as the real risk: *the page's `execute` closure remains reachable after abort* — assert the closure itself refuses, which is a code test, not a browser test.

---

### 10. [MEDIUM] The pairing rule is asserted arithmetically but not enforced

E3's accept is `count(mustFail) >= count(capability states)` → `14 >= 7`, trivially true. It permits a state with zero paired controls, which is the actual situation: the §7 "pairs with" column gives `S1-emp-home` and `S4-emp-submitted` **no** dedicated must-fail case, so §7's opening rule ("every capability assertion is paired with a must-fail assertion") is already false in the shipped table. **Fix:** make the runner build the pairing map from each case's `pairsWith` and fail if any state in `surfaces.expected.json` has an empty pair set. Then add the missing `S1`/`S4` controls (e.g. `S4`: `update_expense_line` absent *and* the direct write to a submitted report returns `overTheWire(409)`).

---

### 11. [MEDIUM] A browser gap: `getTools()` was measured under a flag the graded runs forbid

HANDOVER:85 records the one measurement that `getTools()` works — *"实测 `getTools()` 由 1 降至 0"* — under **`--enable-features=WebMCPTesting`** on Chrome 152. But C4 iron rule 10 and EVAL §2.2.5 mandate **`--enable-features=WebMCP`** for CDP/automation, and §9.4 requires that exact flag in every admissible result header. **There is no measurement that `getTools()`/`executeTool()` are reachable under the flag every graded run must use.** The failure mode is silent and exactly the one §2.2.5 warns about: an empty tool list reported as an empty tool list.

Compounding this, all three Codex charters state iron rule 1 as *"`document.modelContext.registerTool(def, {signal})` is **the only entry point**"*, while EVAL §2.3 has the kit calling *"the page's real `document.modelContext.getTools()` / `executeTool()`"*. If `getTools`/`executeTool` are agent-side (retrieved by "a different internal mechanism", per the spec text quoted in `countinghouse/solution.html:641`) and not exposed to page JS under `--enable-features=WebMCP` with no agent attached, **the harness's core mechanism does not exist** and every N-01 assertion about "rejects from the browser" is unwritable.

**Fix — make this H2's first hour and gate E1 on it.** Add to §15 and to E1's accept:
```
[ ] under --enable-features=WebMCP (no agent attached), CDP Runtime.evaluate reports
    typeof document.modelContext.getTools === "function"  AND
    typeof document.modelContext.executeTool === "function"
[ ] a page registering exactly 1 tool yields getTools().length === 1 under that flag
```
If either fails, EVAL §2.3's "never fall back" rule means lane E has no admissible mode and PM must be told the same day — that is a Day-0 fact, not a Day-4 discovery. Add a row to §14's dependency table. Also: `--selftest`'s byte-identical-twice check will pass happily against an empty surface; make it assert a non-zero tool count.

Also flag `Page.getFrameTree` in N-10: cross-origin child frames are OOPIFs and need `Target.attachToTarget`/`setAutoAttach`, not a plain `Runtime.evaluate` — the case as written would silently skip exactly the frames it claims to check (moot if N-10 is cut per defect 9).

---

### 12. [LOW] Charter/EVAL drift that will waste a seat's time

- **C4.md:72** gives reference byte counts `395 / 1947 / 6682 / 2070` and instructs *"If your numbers are wildly off these, suspect your harness first."* EVAL §6.2's serializer deliberately produces `397 / 1949 / 6698 / 2074`. C4 will chase a phantom harness bug on its first run. Update C4.md to the post-`canon()` numbers with a one-line pointer to §6.1 (and again after defect 6 is resolved).
- **C4.md:93** names the results path `evals/results.json`; EVAL §9.4 uses `reports/<freeze>/*.json`. Pick one.
- **C4.md:88–94**'s `PASSED: n/m` output format directly invites the pass-rate framing that C4.md:102 and EVAL §10.2 both ban. Replace with the per-case ledger.
- **TEAM.md:63** calls the redteam profile *"max reasoning"*; EVAL §9.2 sets it to `high`. This machine's desktop config lists `["low","medium","high","xhigh","ultra","max"]` as available, so "max" is a real value and the two documents mean different things. Pin one; given defect 3, also verify it took.
- EVAL §9.3's `"$(cat prompts/…)"` form: MEASURED, when stdin is not a TTY `codex exec` prints *"Reading additional input from stdin…"* and appends whatever it finds as a `<stdin>` block. In CI, redirect `< /dev/null` on all five commands or the prompt is silently extended.

---

### What holds up

The four-ruler split with named read-sets, the `overTheWire()` helper requiring both a status and a real `Network.responseReceived` (this is the right instrument and it correctly fails the existing client-side 403 at `erp.js:102`), the refusal to publish proportions with the §10.2 arithmetic behind it, freezing the README columns before any number exists, the `surface-delta:` pre-push trailer, listing discarded verdicts with reasons, the §12 list of things deliberately not measured, and OCF-1's array-order and integer-cents rules (which kill the `merchant+date` sort at `erp.js:387` and the whole float-formatting attack class) are all sound and unusually honest. The `provenance`-inside-the-digest fix with `v6`/`v7` as the standing regression vector is the right shape — defect 1 is that the *same* rigour was not applied one layer up, to whether a human decision occurred at all.

**Suggested order:** defect 1 before the C4 contract freeze (18:00 today) since it is a BREAKING projection change; defects 2/3/4 before any Codex seat is launched, because every result produced before they are fixed is inadmissible; 6 before T5 writes the export; 7 and 8 before the first graded run.