# EVAL.md — Evaluation and Verification Design

> Lane E. Owner of this document: **C4** (Codex eval engineer).
> Horizon: Sprint A (OpenAI WebMCP Challenge, deadline **2026-09-03 13:00 PT**) unless a node says `horizon: B`.
> Repos: `outpocket` (the product), `webmcp-eval-kit` (the grader), `webmcp-dev-kit` (extraction target, Track B).
>
> This file is the operating manual for the three graders — **C4** (writes and runs the suites),
> **C1** (blind), **C3** (red team) — and the contract that lanes T, S, F and H must satisfy to be gradeable.
>
> **AUTHORITY.** `erp/graph.json` and `erp/PATHS.md` are the only two authorities in this project.
> `graph.json` owns node identity, owner, inputs, outputs, `accept`, hours, cut rank and horizon.
> `PATHS.md` owns every literal path, filename, artifact name and command name. **This file quotes them
> and never restates them.** Where a node's acceptance predicate appears below it is copied verbatim and
> marked as a copy; where a path appears it is copied from `PATHS.md`. If anything here disagrees with
> either authority, the authority wins and this file is regenerated — it is not argued with.
>
> This file previously carried a private lane-E node table with its own owners, hours and cut ranks, and a
> private canonical serializer. Both are deleted. See §4 and §6.1.
>
> Evidence grades used throughout: **MEASURED** (we ran it on this machine), **PUBLISHED**,
> **VENDOR-CLAIMED**, **OUR-ESTIMATE**, **UNVERIFIED**.

---

## 0. The one-paragraph version

We do not measure whether an agent "does better". We measure whether the site's **invariants hold when
an adversary tries to break them**, and we measure it by driving **Chrome's real
`document.modelContext`** — never an injected bridge. Every capability assertion (this tool set exists in
this state) is paired with a must-fail assertion (this call is refused, and refused **by the server**, over
the wire), and every must-fail assertion carries a one-line mutation that must make it go green — a control
that cannot be broken on purpose is not a control. Surface size is reported as **deterministic byte and
token accounting with zero model calls**, where "zero model calls" is proven by denying the syscall, not by
setting an environment variable. Nothing in the results table is a proportion, because a defensible
proportion claim needs roughly 62 samples per arm and we have 5.5 days. The numbers we publish are the
numbers a hostile reader can recompute from the repo in one command.

---

## 1. The four rulers, and the exact artifact each one reads

Four non-overlapping rulers. **A ruler that reads the wrong artifact is broken even if its verdict is
correct.** Node ownership below is copied from `graph.json.rulers`; every path is copied from `PATHS.md`.

| Ruler | Question | Reads **only** | Produces | May NOT read |
|---|---|---|---|---|
| **QA** (resident) | *Is it done?* | the `accept` field of each node in `erp/graph.json`, plus the exit codes and stdout of `npm test` and `node webmcp-eval-kit/bin/eval.mjs` | a per-node pass/fail ledger in QA's own `.team/log/` file | the rubric; the red-team log |
| **L2** (commissar) | *Is it enough to win?* | `README.md` §Results (E7), `docs/STORYBOARD.md`, `docs/DEVPOST.md`, the deployed URL | a win/no-win verdict + the cut demand, citing node ids | test output, source code (L2 writes zero product code and grades the **submission**, not the build) |
| **C3** (Codex red team, `-p redteam`) | *Can it be broken?* | full repo + the deployed URL + this file's §7 | `evals/redteam/report.md` and runnable break files under `tests/redteam/` | nothing (C3 is deliberately omniscient) |
| **C1** (Codex blind verifier, **no `-p`** — see §9.2) | *Can a blind agent use it?* | `artifacts/tools.export.json` and `evals/blind/tasks.md`. **Nothing else. No repo.** | `evals/blind/C1-verdict.json` conforming to `evals/blind/rubric.schema.json` | the repo, the deployed site, this file, the expected-surface fixture, this file's §8.3 rubric |

Node ownership, copied from `graph.json.rulers`: QA owns G3, G6, T4, D6 · L2 owns E4 (its other instrument,
`erp/RUBRIC.md`, **is produced by L0** — R-16, +0.5 h, listed in `PATHS.md` §2.8; the earlier note here that
it was produced by nothing and flagged OPEN in `PATHS.md` §6 is stale and is withdrawn)
· C3 owns E9 · C1 owns E8. **C1 and C3 previously owned no node at all**, which is why E8 and E9 exist.

### 1.1 Blindness is enforced by `CODEX_HOME`, not by `cwd` (R-2)

MEASURED on this machine: `-C` sets the working directory and **is not a jail**; `-s read-only` grants
**full-disk read**; and the base `~/.codex/config.toml` (6,416 bytes — *not* the two keys an earlier
revision of this file claimed) enables an MCP server exposing a Node REPL, `chrome` and `browser` plugins,
and `UserPromptSubmit`/`SessionStart` hooks that inject prior-session handover text. MCP servers are
separate processes and the Codex sandbox does not govern them; during a `-s read-only` smoke run one of
them made an outbound OAuth request while the prompt told the model network access was restricted.
`~/.codex/AGENTS.md` (9,271 chars) is injected even with `cwd` outside any git repo.

#### 1.1.1 The byte numbers, restated — and the block that survives the hermetic home

An earlier revision of this file published, graded MEASURED: *"An empty `CODEX_HOME` drops the rendered
prompt from 32,412 to 11,217 bytes."* **That pair does not reproduce and is retracted.** Re-measured
2026-08-28 with `codex debug prompt-input "hello" | wc -c` (codex-cli 0.144.6), which is the command a
reviewer can re-run:

| `CODEX_HOME` | rendered prompt | `<recommended_plugins>` present |
|---|---:|---|
| the base `~/.codex` | **32,363 B** | yes |
| **`$BH` as `tools/blind-home.sh` actually builds it** — `auth.json` + a two-key `config.toml` | **16,338 B** | **yes** |
| `auth.json` only | 15,640 B | yes |
| two-key `config.toml` only, no `auth.json` | 8,590 B | no |
| a genuinely empty directory | 11,121 B | no |

**The published pair was measured against the last row, and `$BH` is the second.** The blind home copies
`auth.json` in — auth reads `CODEX_HOME` — and `auth.json` is exactly what pulls in the extra block
(rows 3 and 4 isolate it: auth without config has it, config without auth does not). So the real number for
the run we actually ship is **32,363 → 16,338 B**, and the honest sentence is *"the hermetic home removes
AGENTS.md, the MCP servers, the installed-plugin and hook tables — and does not remove the
recommended-plugins catalog"* — not *"it leaves 11 KB"*.

**Name the survivor: `<recommended_plugins>`.** ~3.7 KB of marketplace catalog — a live list of
third-party app names with a `request_plugin_install` instruction — rendered into every authenticated run.
It does not come from `$BH/config.toml`, so `bash tools/blind-home.sh --verify`, which asserts only the
contents of `$BH`, **cannot see it by construction**. C1's prompt therefore carries an uncontrolled,
time-varying block: the earlier reviewer measured 32,359 → 15,666 B for the same two homes on the same day,
and the drift is this catalog. Benign for C1's task — it names no repository and grades nothing — but fatal
to the word *hermetic* and to any byte count published as reproducible.

> **The drift is real and it moved again while this file was being edited.**
> Re-run 2026-08-29, same machine, same `codex-cli 0.144.6`, same command
> (`CODEX_HOME=$HOME/.codex codex debug prompt-input "hello" | wc -c`): the base
> home now renders **32,247 B**, against 32,363 B measured on 2026-08-28 and
> 32,359 B measured by an earlier reviewer the same day. **116 bytes in one
> day, three values in two days, on an input that never changed.** The `$BH`
> row was not re-measured this round — reconstructing it requires copying
> `auth.json`, and that is not a thing to do casually for a byte count. The
> table above therefore stays as the 2026-08-28 reading and is **labelled a
> reading, not a constant**. Operational consequence, and it is the whole
> point: **no published document may quote either number.** §8.5's requirement
> that the report carry the byte count *measured during that run* is the only
> honest form, and this third data point is the argument for landing
> `--disable plugins` in E8's `accept` — PM's call, still flagged in §14.

**The suppression exists and is MEASURED:** `--disable plugins` (equivalently `-c features.plugins=false`)
removes the block, taking `$BH` from 16,338 to **12,537 B**, and two consecutive runs are byte-identical.
`codex exec` accepts the flag. **Lane E does not add it unilaterally**, because the command is frozen
verbatim in E8's `accept` (§8.4) and a runbook that silently diverges from the accept is the failure this
document exists to prevent. It is a one-token change to E8's `accept` in `graph.json`; **PM's call, flagged
in §14.** Until it lands, the blind run is *declared*, not hermetic: §8.5 requires the rendered prompt byte
count in the report, so a reviewer can re-run the command above and see the same class of number.

The mechanism is `tools/blind-home.sh` (an output of **E4**). E4's `accept`, copied verbatim from
`graph.json`:

> `node evals/blind/make-blind-packet.mjs` produces a directory containing EXACTLY TWO files,
> artifacts/tools.export.json copied in and evals/blind/tasks.md copied in, not inside any git repo, and
> `ls -1` in it prints 2. AND `! grep -qi 'outpocket\|countinghouse\|/Users/' evals/blind/prompts/c1.txt` —
> no repo identifier reaches C1. AND an admissibility check: the packet builder EXITS 1 if
> evals/blind/prompts/c1.txt contains any criterion the rubric grades (the
> descriptions-must-not-encode-workflow-order rule, the 500/1500-char budgets, the iframe rule, the
> Origin-Agent-Cluster rule). AND `bash tools/blind-home.sh --verify` exits 0, asserting the constructed
> CODEX_HOME contains auth.json and a config.toml with exactly two keys and NO AGENTS.md, no [hooks], no
> [mcp_servers] and no [plugins] tables.

**The leak matters more than the sandbox.** A grader briefed that missing ordering prose is *intentional*
will never report "I could not tell what order to call these in" — which is the one thing C1 exists to
detect (§8.1). C1's brief carries only what the API **is**; nothing about what our surface **should** look
like. The admissibility clause above is what makes that mechanical rather than a promise.

A verdict that cites a source path is evidence the blindness broke; it is discarded, not corrected, and it
is listed in the report with its reason (§8.5).

---

## 2. Why the harness must drive Chrome's real `document.modelContext`

### 2.1 The lesson, stated as a rule

A widely circulated WebMCP benchmark did not use Chrome's WebMCP at all. It injected **its own bridge**
into every page with Playwright's `addInitScript`, then measured agents against that bridge. Whatever it
measured, it was not WebMCP — **a harness that fakes the API measures the fake.** (Grade: recorded here as
a *harness-design lesson only*. That benchmark is on the do-not-cite list; its name appears nowhere in
outpocket's README, video, or Devpost answers, **and neither do its results** — see §12.1. We learn from
its mistake; we never inherit its beliefs.)

### 2.2 Why the lesson bites *us* specifically

Five concrete failure modes are invisible to an injected-bridge harness and every one of them can cost us
the contest:

1. **The browser does not validate arguments against `inputSchema`.** Chrome parses a JSON string and
   checks "is it an Object", then hands the raw value to the page callback (HANDOVER §3.5, MEASURED).
   A hand-written bridge that validates against the schema would make our malformed-argument negative
   controls *pass* while real Chrome routes the garbage straight into `execute()`. We would ship a
   validation hole and our own harness would certify it closed.
2. **Tools registered inside an iframe are never discovered** (HANDOVER §3.11, MEASURED 2026-08-28,
   same-origin and cross-origin alike). A bridge that collects registrations from all frames reports tools
   no real client can see.
3. **Revocation is `AbortController` only, and from Chrome 153 revocation does not cancel an in-flight
   `execute`** (HANDOVER §3.2, §3.12). A bridge implementing `unregisterTool()` — an API that no longer
   exists — measures semantics the browser does not have.
4. **`Origin-Agent-Cluster: ?0` silently kills WebMCP** (HANDOVER §3.13). This is the single most likely
   way our deployment dies at judging time, and an injected bridge is *completely immune to it*. Our
   harness must be able to fail for this reason, or it cannot warn us.
5. **The flag is not the one we thought, and the launch mode is NOT a trap.** Measured by the session
   owner 2026-08-28 on Chrome 152.0.7977.64, `--headless=new`, a clean dedicated `--user-data-dir` per
   launch, page over `http://localhost` (`FACTS.md` IR-16 — this is the authority):

   | launch (`--headless=new`, clean profile) | `typeof document.modelContext` | `registerTool` |
   |---|---|---|
   | **no flag** | **`undefined`** | n/a |
   | `--enable-features=WebMCP` | `object` | succeeds |
   | `--enable-features=WebMCPTesting` | `object` | succeeds |

   **(a) CONFIRMED — the two flag names are interchangeable.** The old scenario-split ("Testing for
   manual, `WebMCP` for automation") is **retracted**; keeping `WebMCP` as the graded flag is a house
   rule about our own configuration, not a claim about the browser.
   **(b) RETRACTED 2026-08-28 — "`--headless=new` turns them on with no flag at all" is FALSE.** Headless
   with no flag is `undefined`. The reusable lesson: the original probe read the **CDP `WebMCP` domain**,
   and `WebMCP.enable` returns `OK` even in a launch with no page API at all — so a probe that reads the
   CDP domain instead of the page API reads "on" when it is off. **Grade flag-presence only off
   `typeof document.modelContext` evaluated in the page** (see NEW-4 / §2.5.1: `cdpDomainEnabled` is
   vacuous for the same reason).
   **(c) NEW — the graded suites may run headless, and this is what makes E6 possible.** Because the flag
   works under `--headless=new`, the `headless:false` requirement imposed by the previous revision is
   **dropped**; it rested entirely on the false (b). What remains mandatory is the **flag**: every graded
   launch passes `--enable-features=WebMCP` and records `chromeMajor`, `flag` and `headless` in the
   result file, and the discriminating negative control is **no flag** (headless or headed — both give
   `undefined`). Without this, **node E6 — evals against the deployed commit in CI — is not feasible at
   all**, because a CI runner has no display.

### 2.3 The consequence for lane E — and the channel that actually executes a tool

The eval-kit **never** injects a `modelContext`. It attaches over CDP to a real Chrome launched by H1 and
records the Chromium major, the flag and `headless` in every result file. **If WebMCP is absent, the run
fails; it does not fall back.** The in-page fallback agent (`src/page/fallback-agent.js`, H3) exists for
*demo degradation in front of a judge*, not for grading. Any result file whose `mode` is not
`"cdp-real-webmcp"` is inadmissible for the README table.

**What changed, and it is the largest single correction in this document.** Every previous revision said
the kit "calls the page's real `getTools()` / `executeTool()` through `harness/drive.mjs`" via
`Runtime.evaluate`. `Runtime.evaluate` was the only instrument named anywhere in the corpus, and **it
cannot execute a tool by name**. MEASURED 2026-08-29 on the installed Chrome 152.0.7977.64, headed,
`--enable-features=WebMCP`, no agent attached:

```
executeTool('whoami', {})              -> TypeError: ... not of type 'RegisteredTool'
executeTool(descriptor, {})            -> UnknownError: Failed to parse input arguments
executeTool(descriptor, JSON.stringify(args))   -> OK, resolves to a JSON *string*
getTools().length                      -> undefined      (getTools() returns a Promise)
(await getTools())[0] own keys         -> annotations, description, inputSchema, name, origin, title, window
```

So the page API is reachable — the H2 gate's underlying worry was unfounded — but the calling convention
is not the one the suites were written against, and a by-name call does not exist at all.

**`harness/drive.mjs` executes over the CDP `WebMCP` domain** (`FACTS.md` IR-17, MEASURED 2026-08-29).
`Schema.getDomains` does not list it; that inventory is stale and must not be used to feature-detect it.
The division of instruments is now explicit and is a rule, not a preference:

| Purpose | Instrument | Why this one |
|---|---|---|
| **Executing a tool** | `WebMCP.invokeTool {frameId, toolName, input}` after `WebMCP.enable` | the only by-name channel that exists. `enable` is a hard precondition: without it, `-32000 "WebMCP domain is not enabled"` |
| **Reading the result** | the `WebMCP.toolResponded` event matching the returned `invocationId` | **`invokeTool`'s result is `{invocationId}` and nothing else.** A harness that reads the command result finds no `content` |
| **Enumerating the surface** | `WebMCP.toolsAdded` / `toolsRemoved` events, accumulated after `enable` | event-driven and frame-tagged; no `await` bug to get wrong |
| **Feature detection** | **`Runtime.evaluate`** — `typeof document.modelContext`, `typeof …getTools`, `typeof navigator.modelContext` | unchanged, and this is what it is good for. V0 stays on `Runtime.evaluate` |
| **Reading page state** | `Runtime.evaluate` | unchanged (N-02's captured-closure test, day-book head, report status) |
| **Releasing a hung call** | `WebMCP.cancelInvocation {invocationId}` | see the warning below |

Four constraints the suites must honour, each measured:

1. **`input` must be an object over CDP** — a JSON string fails deserialization
   (`"Failed to deserialize params.input - CBOR: map start expected"`). This is the exact opposite of the
   page-JS convention, where args must be a **string**. Two channels, two conventions; do not copy one
   into the other.
2. **Errors carry no `errorText`.** `status:"Error"` arrived with `errorText:""` and the thrown message
   only in `exception.description`. A harness reading `errorText` reports every failure as blank.
3. **Annotations have two spellings.** The page registers and reads back `readOnlyHint` /
   `untrustedContentHint`; `WebMCP.toolsAdded` reports `readOnly` / `untrustedContent`. C1's `readOnlyHint`
   honesty check (rubric R6) must pick a channel deliberately.
4. **Revoked and unknown are indistinguishable.** `invokeTool` returns `-32602 "Tool not found"` both for a
   name that was never registered and for one revoked via `AbortController`. N-01 may therefore record
   *which layer refused* and assert state is unchanged, but may **not** assert the browser distinguishes
   the two cases.

> **`cancelInvocation` — what it buys, and the sentence not to write.** MEASURED 2026-08-29:
> `cancelInvocation{invocationId}` returns `{}`, `toolResponded` fires immediately with
> `status:"Canceled"`, and **the page's `execute` keeps running** — its completion timestamp stayed 0, and
> `execute`'s second parameter `opts` arrived with **zero own keys**, so no `AbortSignal` reaches the page
> at all. When the page later resolved, no further event fired; the result was discarded silently.
> **It releases the client, not the page.** It gives the harness a deterministic way never to hang on a
> suspended `execute` — worth having, and it bounds *client* exposure for `RISK.md` §5.2 — and it does
> **not** repair `FACTS.md` IR-7. §2.4's rule stands unchanged: no assertion in this repo may depend on
> in-flight cancellation, and no copy anywhere may say revocation, or cancellation, blocks a call in
> progress.

### 2.4 Locally measured environment facts that constrain the suites

| Fact | Value | Grade |
|---|---|---|
| Installed Chrome on the build machine | **152.0.7977.64** (only Chrome present) | MEASURED 2026-08-28 |
| Codex CLI | `codex-cli 0.144.6` at `/opt/homebrew/bin/codex` | MEASURED |
| `codex exec -p <name>` semantics | *"Layer `$CODEX_HOME/<name>.config.toml` on top of the base user config"* | MEASURED (`codex exec --help`) |
| `codex exec -p <missing-profile>` | **exits 0, no error, no warning**, silently falls back to the base config | MEASURED |
| Base `~/.codex/config.toml` | 6,416 bytes; enables `[mcp_servers]`, `[plugins]`, `[hooks]` | MEASURED |
| Bare `-s workspace-write` | *"Network access is restricted"* — **no network, no `npm install`** | MEASURED |
| `HTTPS_PROXY` vs Node's global `fetch` | undici **ignores** proxy env vars without an explicit `ProxyAgent` | MEASURED (Node v22.23.1) |
| Codex profiles on this machine before L0 | **zero** (`ls ~/.codex/*.config.toml` → no matches) | MEASURED |
| `python3 -c "import tomllib"` | works, Python 3.14.6 (zero-cost TOML lint) | MEASURED |

**Consequence — R-8, and write it into the suites.** Everything is anchored to the **installed major, 152**.
We build against the current version and demand an upgrade only if something actually breaks. Therefore
every revocation negative control asserts only the **next-call** semantics (*the revoked tool is refused on
the following call*), which holds on 152 and 153 alike. No assertion in this repo may depend on in-flight
cancellation behaviour, and no copy anywhere may say "revoking blocks the call in progress". H5's banner
already renders `[data-warn="chrome-lt-153"]` below 153; that is a recorded fact, not an assertion.

### 2.5 The Day-1 gate: reachability is answered; the gate now regresses it

**This section used to ask an open question. It is answered, and the answer is mixed.** MEASURED
2026-08-29 on Chrome 152.0.7977.64, headed, `--enable-features=WebMCP`, no agent attached:
`document.modelContext.getTools` and `.executeTool` **are both functions and both work**. The feared
outcome — the two calls being agent-side and absent from page JS, leaving **lane E with no admissible
mode** — did not happen. What *did* happen is worse in a smaller way and better overall: the calls exist
but the corpus's calling convention for them was wrong on every count (§2.3), and the channel the harness
should have been built on, the CDP `WebMCP` domain, was named nowhere.

So H2's first hour stops being a discovery and becomes a **regression gate** against whatever Chrome is
installed on the day. It keeps its 3.0 hours and its position; nothing downstream moves. Three things it
must now check that the old predicate did not:

- **`await`.** `getTools()` is a Promise. `getTools().length === 1` compares `undefined` to `1` and fails;
  written as `!== 0` it would pass against an empty surface. Every count assertion in this document means
  `(await getTools()).length`.
- **The flag, and a no-flag negative control — NOT headed.** The previous revision demanded `headless:false`
  here on the strength of IR-16(b); **IR-16(b) is retracted and that requirement is dropped** (`FACTS.md`
  IR-16, MEASURED 2026-08-28: headless with no flag is `undefined`). What the gate must prove is the
  **flag**: `pageApiReachable` true under `--enable-features=WebMCP`, and a second launch **with no flag**
  where `typeof document.modelContext === "undefined"`. The negative control is the whole discrimination;
  headedness is not. And the probe must read the **page API**, never `WebMCP.enable`, which returns `OK`
  even where no page API exists.
- **The CDP domain.** Page-API reachability is necessary and not sufficient: the harness executes through
  `WebMCP.invokeTool`, so the gate must prove `WebMCP.enable` succeeds and that `toolsAdded` names the
  registered tool.

The replacement predicate is in §2.5.1 and is `graph.json`'s to adopt; this document does not carry a
private copy of a predicate that disagrees with the authority.

E1 is a hard consumer of H2 and of `evidence/H2-reachability.json` (edge `H2 → E1`). **If the gate fails,
PM hears it on Day 1 and lane E's mode question is reopened the same day** — it is not a Day-4 discovery.
The dependency is listed in §14.

### 2.5.1 What `evidence/H2-reachability.json` must record

Not a boolean. The failure mode this file exists to catch is "it worked on my launch", so the file records
the launch as well as the result: `chromeMajor` (from the binary, never the user-agent string), `flag`,
`headless` (**recorded, but free — `true` is allowed**; the `headless:false` requirement was dropped when
IR-16(b) was retracted on 2026-08-28), `pageApiReachable`, `cdpDomainEnabled`, `toolCount` (from
`await getTools()`), `invokeToolRoundTrip` — an actual `invokeTool` whose matching `toolResponded`
carried `status:"Completed"` — and **`noFlagPageApiAbsent`**, a second launch with **no** feature flag in
which `typeof document.modelContext === "undefined"`. A reachability file that does not contain a completed
round trip records an opinion, not a measurement; one without the no-flag control proves the browser has
WebMCP but not that our flag is doing anything.

**`cdpDomainEnabled` is vacuous on its own (confirmation NEW-4) and is retained only as a launch record.**
`WebMCP.enable` returns `OK` with no flag and zero tools — this is exactly the error that produced the
retracted IR-16(b). Only `invokeToolRoundTrip` and `noFlagPageApiAbsent` discriminate; the two fields are
not equals and this document no longer lists them as if they were.

**Why this makes E6 possible.** E6 runs the eval suite against the deployed commit **in CI**, where there
is no display. It is feasible only because the flag works under `--headless=new` (IR-16(c)). Had IR-16(b)
been true, every graded run would have needed a headed session and E6 would have had to be cut. E6 passes
the same flag and records the same fields, with `headless: true`.

Related, and why `--selftest` is not a substitute: a byte-identical-twice check passes happily against an
empty surface, so E1's `accept` additionally asserts a non-zero tool count.

---

## 3. Repository split — what lives where, and why

The split is chosen so that X6 (Track B, promote the harness to a standalone package) is a **deletion of a
relative path**, not a rewrite.

**Every path below is copied from `PATHS.md` §2.9.** No path in this document was typed from memory, and
none is invented locally. The eval-kit's entry point is `webmcp-eval-kit/bin/eval.mjs`, invoked as
`node webmcp-eval-kit/bin/eval.mjs …` from the outpocket root, or as `npx webmcp-eval …` once the package
is installed; both spellings mean that one file. `bin/eval.mjs` bare and `eval/run.mjs` are dead.

### `webmcp-eval-kit/` — domain-free mechanism (C4 owns `webmcp-eval-kit/**`)

| Path | Producing node |
|---|---|
| `webmcp-eval-kit/bin/eval.mjs` | **E1** |
| `webmcp-eval-kit/package.json` | **E1** |
| `webmcp-eval-kit/src/canon.mjs` | **E1** — *a PORT of `src/canonical.js`; **never** a second definition (§6.1)* |
| `webmcp-eval-kit/test/no-net.mjs` | **E1** |
| `webmcp-eval-kit/fixtures/reference-site/index.html` | **X6** (horizon B) |
| `webmcp-eval-kit/README.md` | **X6** (horizon B) |

### `outpocket/` — domain-specific expectations, the rulers' instruments, and the outputs

| Path | Producing node | Owner |
|---|---|---|
| `evals/suites/capability.suite.json` | **E2** | C4 |
| `evals/surfaces.expected.json` | **E2** | C4 |
| `evals/suites/negative.suite.json` | **E3** | C4 |
| `evals/accounting.json` | **E5** | C4 |
| `evals/latest.json` | **E6** | C4 |
| `evals/mutants/`, `evals/mutation-report.json` | **E10** | C4 |
| `evals/blind/rubric.schema.json` | **E4** | L2 |
| `evals/blind/prompts/c1.txt` | **E4** | L2 |
| `evals/blind/tasks.md` | **E4** | L2 |
| `evals/blind/make-blind-packet.mjs` | **E4** | L2 |
| `tools/blind-home.sh` | **E4** | L2 |
| `evals/blind/C1-verdict.json` | **E8** | C1 |
| `evals/redteam/report.md`, `tests/redteam/` | **E9** | C3 |
| `.github/workflows/eval.yml` | **E6** | C4 |
| `artifacts/tools.export.json` | **T5** | I2 |

> Dead spellings, from `PATHS.md` §2.9 and §6: `outpocket/tools.export.json`, bare `tools.export.json`,
> `evals/results.json`, `reports/<freeze>/*.json`, `reports/blind/<freeze>.json`,
> `reports/redteam/<freeze>.md`, `suites/capability.json`, `surfaces.frozen.json`,
> `schemas/blind-verdict.schema.json`, `prompts/E4-blind.md`, `https://example-webmcp-site`.
> An earlier revision of this file used most of them. They resolve to the table above.

**Why the expectations live in `outpocket` and not the kit:** an expectation is a claim about *this
product*. It must be editable in the **same commit** as the code change that alters the surface, by the
seat that owns that code. If it lived in the kit, a surface change would need a cross-repo commit and the
team would learn to skip it. The kit stays domain-free precisely so X6 is cheap — and X6's `accept` proves
it by running the kit end to end against `webmcp-eval-kit/fixtures/reference-site/index.html`, a site that
is **not** outpocket, plus `! grep -rq 'outpocket' webmcp-eval-kit/src/ webmcp-eval-kit/bin/`.

**The Sprint-A coupling we accept, out loud:** during Sprint A the kit consumes I1's CDP driver
(`harness/drive.mjs`) from `outpocket`. The kit is *not* standalone until X6 (horizon B). E1 builds the
package **skeleton, CLI and the OCF-1 port**; X6 severs the umbilical. `webmcp-eval-kit/README.md` (X6)
must carry that sentence too.

---

## 4. Lane E node list — quoted from the authority

**This file no longer owns a node table.** The table below is copied field-for-field from
`erp/graph.json`. It restates nothing: `accept` predicates are referenced by node id and are copied
verbatim only in the sections that are *about* them (§1.1, §6.1, §7, §8, §10, §11). On any disagreement
`graph.json` wins.

| id | title | owner | inputs | hrs | cut | repo | horizon |
|---|---|---|---|---:|---:|---|---|
| **E1** | Eval-kit driver package skeleton with an OCF-1 port | C4 | H2, S11 | 2 | 2 | webmcp-eval-kit | A |
| **E2** | Capability suite: the expected tool set for each application state | C4 | E1, T5 | 2 | 2 | webmcp-eval-kit | A |
| **E3** | Negative-control suite with a declared pairing map | C4 | E1, T2, S2, S6 | 2 | 2 | webmcp-eval-kit | A |
| **E4** | Blind grading protocol, rubric, packet builder and the hermetic Codex home | **L2** | T5 | 2 | 2 | webmcp-eval-kit | A |
| **E5** | Deterministic surface accounting, provably zero model calls | C4 | T5, E1 | 1 | 1 | webmcp-eval-kit | A |
| **E6** | CI running the evals against the DEPLOYED commit, not the working tree | C4 | E2, E3, E5, D1 | 2 | 2 | outpocket | A |
| **E7** | Results table published in the README | C4 | E6 | 1 | 2 | outpocket | A |
| **E8** | C1 blind grading run | **C1** | E4, T5 | 1 | 2 | webmcp-eval-kit | A |
| **E9** | C3 red-team break attempts | **C3** | E3, D1 | 3.5 | 2 | webmcp-eval-kit | A |
| **E10** | Mutation check: prove the negative controls are not vacuous | C4 | E3 | 3 | 2 | webmcp-eval-kit | A |
| **X6** | Promote the eval harness to eval-kit as a standalone package | C4 | E6 | 3 | 4 | webmcp-eval-kit | **B** |

**Four corrections this table carries**, all made in `graph.json` and recorded here so nobody re-derives
the old numbers:

- **E4's owner is L2, not C4.** It is a ruler's instrument, not product code, and writing a rubric does not
  violate L2's zero-product-code charter. This file's earlier private table gave it to C4; that is overruled.
- **E8 is the C1 blind grading *run*.** A different node — a mutation check owned by C4 — was also published
  as "E8" in CONTRACTS §12. That one is **E10**. `graph.json.id_collision_warnings` records the split.
- **E1's inputs are H2 and S11**, not T5. S11 is the OCF-1 canonicaliser; the edge exists because
  `canon.mjs` is a port of it (§6.1). E5's only input is T5.
- **Nothing in lane E is `cut: 0`, and nothing in lane E is on the critical path.** The earlier claim that
  "E2 → E3 → E7 → D5 is on Sprint A's critical path" was false: E7 → D5 is a **soft** edge, and the critical
  path is `L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6`, **29.5 h**
  (`graph.json.critical_path_A`, grade OUR-ESTIMATE — recompute with `node tools/ready.mjs --path`, never
  by hand; the earlier 28.5 h restated here predated the four hour moves L0 +0.5, G0 +0.5, S5 +0.5,
  E9 +0.5, and the later 29.0 h predated the ordered hard edges `V5 → S10` and `V5 → G6`, which rerouted
  position 2 from `T6` (1.0 h) to `V5` (1.5 h) — both feed S10 from L0. `PLAN.md` and `GRAPH.md` carry
  29.5). Lane E never blocks D4 (the video), which is the real deliverable.

### 4.1 Amputation — there is exactly one ladder, and it is not here

`graph.json.cut_ladder` is the only cut ladder in the project. This file publishes no ordering of its own;
the "cut 1 = E6, cut 2 = E9 depth, cut 3 = E4 + E8" sequence an earlier revision carried is deleted.
Copied from the authority, the two ranks that touch lane E:

- **Rank 1** fires `V0 G5 G6 T4 D2 D3 F6 E5`. Lane E loses **E5** — "no surface accounting numbers in the
  README".
- **Rank 2** fires `T3 T5 F3 F5 E1 E2 E3 E4 E6 E7 E8 E9 E10`. That is **the entire eval lane**, and with it
  three of the four rulers' instruments: C1 loses E4/E8, C3 loses E9, C4 goes idle. Four rulers become
  three, and **nobody measures whether a blind agent can drive the surface or whether an adversary can
  break it.** PM should treat this as a governance change, not only a scope change.

Two consequences lane E must not misstate. **Firing any rank shortens the critical path by exactly zero
hours** — every node on the path is `cut: 0`. And **the ladder frees exactly zero human-gated hours**. It
is a pure agent-hour instrument. Triggers elsewhere must name node ids ("cut `E5`", "cut `E1`–`E10`"),
never rank numbers.

**E7 → D5 is soft, with a written degradation** (copied from the edge record): *"If E7 is cut, D5 REMOVES
the §Results section from docs/DEVPOST.md and cites T5's export instead. That removal is part of D5's
accept: without it, `tools/lint-layer0.mjs` fails D5 on numbers that no longer exist."*

---

## 5. Reaching each state deterministically

The eval must never depend on UI choreography. States are reached through `harness/drive.mjs` (H2) against
a server that reseeds deterministically on boot — **S9**, whose `accept` is a state digest that is
byte-identical across a restart. The setup recipe for each state is a field in
`evals/suites/capability.suite.json` (E2's own output); there is no separate contract file.

> **Flagged, per `PATHS.md` §3 — do not invent this locally.** An earlier revision of this file specified a
> test-kit endpoint (`POST /api/testkit/reset` with an `X-Outpocket-Eval` header) and a
> `states.contract.json`. **Neither appears in `PATHS.md`, neither is an output of any node, and neither is
> named in any `accept` predicate.** They are not adopted here. Until a node owns the endpoint and its
> hours are funded, the two controls that test it (N-08, N-09) are **NOT RUNNABLE** and are listed that way
> in §7.2 — they do not count toward the pairing map and they must not be reported as green. Adding the
> endpoint is a `PATHS.md` row plus a `graph.json` node, and it is PM's call, not lane E's.

### 5.1 The six canonical state ids

Copied from `PATHS.md` §5. **There are six, they are always written with the hyphenated suffix, and a bare
`S1`/`S5` is a server-lane *node* id meaning something else entirely.**

`S0-anon` · `S1-emp-home` · `S2-emp-draft-clean` · `S3-emp-draft-dirty` · `S4-emp-submitted` · `S5-aud`

| state id | session | application state |
|---|---|---|
| `S0-anon` | no cookie | signed out |
| `S1-emp-home` | employee (`chen`) | signed in, no open report |
| `S2-emp-draft-clean` | employee | open draft, **zero** blocking violations |
| `S3-emp-draft-dirty` | employee | open draft, ≥1 blocking violation |
| `S4-emp-submitted` | employee | open report, `status = submitted` |
| `S5-aud` | auditor (`ruiz`) | signed in |

**Exactly two personas exist** — `chen` (employee) and `ruiz` (auditor) — matching the frozen enum in
`erp/contracts/eval-case.schema.json` and S1's `accept` (R-5). The "third persona" of earlier drafts is deleted;
F1's predicate is `document.querySelectorAll('[data-persona]').length === 2`.

**`S6-emp-signing` is not a canonical state.** An open sign request is a *transient condition* of
`S2-emp-draft-clean`, not a seventh row: E2's `accept` reports "6 of 6 canonical states", T3/T4/T5 all
enumerate the same six, and the export carries six. The sign-open condition is exercised by N-05, N-06,
N-15 and N-16 (§7.1, §7.2.1) and appears in no surface table.

---

## 6. E2 — the capability suite

### 6.1 One canonicaliser, and it is not defined here (R-11)

**This file no longer defines a serializer.** It previously shipped a `canon()` over an array sorted by
`localeCompare`, with no `kind` prefix and nested key order untouched, while `CONTRACTS.md` §3 defined
OCF-1 with a recursive **codepoint** key sort, NFC strings, integers only, and
`digest(kind, value) = sha256(kind + "\n" + canon(value))`. **Those produce different bytes for the same
surface, always** — so every "the deployed surface digest equals the frozen one" assertion in this document
was unsatisfiable by construction. Two published assertions could never hold. `localeCompare` is
additionally ICU-dependent: a stranger's clean clone can sort differently.

The single definition is **OCF-1 in `CONTRACTS.md` §3**, implemented exactly once by **S11** as
`src/canonical.js`. `webmcp-eval-kit/src/canon.mjs` (**E1**) is a **port** of it. E1's `accept`, copied
verbatim from `graph.json`:

> `cd webmcp-eval-kit && npm ci && npm test` exits 0 — and `npm test` includes a vector suite asserting
> webmcp-eval-kit/src/canon.mjs reproduces ALL SEVEN vectors in erp/contracts/canonical-vectors.json
> byte-for-byte — AND `node webmcp-eval-kit/bin/eval.mjs --version` prints a semver AND `--selftest` runs
> the whole pipeline twice against a fixed local fixture, asserts the two result files are byte-identical
> AND asserts a non-zero tool count (a byte-identical-twice check passes happily against an empty surface).

Two facts lane E consumes and does not restate:

- **The surface digest is `digest("outpocket/surface/1", tools)`** over one state's `tools` array — the
  same quantity `artifacts/tools.export.json`'s `surface_digest` holds, recomputed independently by T5's
  own checker.
- **OCF-1 carries a carve-out permitting `$`-prefixed keys inside an `inputSchema` subtree** (`$schema`,
  `$ref`, `$defs`) and a numeric carve-out for JSON Schema keywords. Without it, OCF-1's key rule
  (`^[A-Za-z0-9_]{1,64}$` or `E_CANON_KEY`) makes every real `inputSchema` uncanonicalisable and its
  integer rule rejects `"multipleOf": 0.01`. S11's `accept` asserts the carve-out.
- **Money never floats** (R-6): amounts are integer cents and FX rates are integer micro-units
  (rate × 1e6), so no float ever enters a canonical form. A non-integer amount is therefore a
  malformed-argument case (N-07), not a rounding question.

### 6.2 The pre-registered expectation

Measured 2026-08-28 against `countinghouse/src/{tools,erp}.js` — the code L0 ports and T1/T2 register.
**Tool counts and name sets: MEASURED.** They come from the compiler at `countinghouse/src/tools.js:343-354`.

| state | tools | tool names (sorted) | readOnly |
|---|---:|---|---:|
| `S0-anon` | **1** | `get_signin_status` | 1/1 |
| `S1-emp-home` | **5** | `create_expense_report` `get_expense_policy` `get_session_scope` `list_expense_reports` `open_expense_report` | 3/5 |
| `S2-emp-draft-clean` | **13** | `add_expense_line` `create_expense_report` `get_expense_policy` `get_open_report` `get_session_scope` `link_receipt` `list_expense_reports` `list_receipts` `open_expense_report` `remove_expense_line` `submit_expense_report` `update_expense_line` `validate_expense_report` | 6/13 |
| `S3-emp-draft-dirty` | **12** | as `S2` **minus** `submit_expense_report` | 6/12 |
| `S4-emp-submitted` | **6** | `create_expense_report` `get_expense_policy` `get_open_report` `get_session_scope` `list_expense_reports` `open_expense_report` | 4/6 |
| `S5-aud` **after T6** | **6** | `get_day_book` `get_expense_policy` `get_open_report` `get_report` `get_session_scope` `list_expense_reports` | **6/6** |

**On bytes — the one number this file is not allowed to publish yet.** The byte counts an earlier revision
printed (397 / 1949 / 6698 / 2074) were produced by the deleted serializer. **No OCF-1 byte count exists
yet**, because S11 has not run. What is MEASURED (iron rule 10) is the spike's own byte figures — signed-out
1 tool / 395 chars, employee 5 / 1,947, clean draft 13 / 6,682, auditor 6 / 2,070 — under the spike's
serializer, and they will not equal the OCF-1 numbers. E5 computes the OCF-1 bytes once, into
`evals/accounting.json`, and E7 publishes them. Until then this document prints no byte figure, because a
byte figure with no named serializer is exactly the failure this section exists to prevent.

**And there are three quantities called "bytes", not one.** `canon()` OCF-1 wire bytes are **the published
figure**. The export's `accounting.total_bytes` block (`description_bytes + schema_bytes + framing`) is an
**internal cross-check**, is a different and smaller quantity, and is labelled as such wherever it is
shown. They are never mixed into one column. E7's `accept` says exactly this and is copied in §13.
`tokensApprox` is `ceil(canon_bytes / 4)` — **OUR-ESTIMATE**, no tokenizer.

### 6.3 Set equality, not count equality

Every capability case asserts **set equality on names**, plus set equality on the subset carrying
`readOnlyHint: true`. E2's `accept`, copied verbatim:

> `node webmcp-eval-kit/bin/eval.mjs --suite capability --url $URL` exits 0 reporting 6 of 6 canonical
> states matching the expected sets taken from artifacts/tools.export.json, by SET EQUALITY on tool names
> and never by count equality; zero states skipped; a single extra or missing tool in any state exits 1.

**Why set equality is not pedantry — a worked example from the table above.** `S4-emp-submitted` and
`S5-aud` both have **6** tools. Their sets differ by exactly one element: the employee looking at a
submitted report gets `create_expense_report`; the auditor gets `get_day_book`. A count assertion passes
even if the auditor is handed the employee's surface. Only set equality catches it — and that swap is
precisely the failure the whole product claims not to make. A five-state export cannot express it, which is
why `S4-emp-submitted` is in the six.

**T6 is settled: option (B), ratified as R-9.** `open_expense_report` genuinely writes state — it mutates
`openReportId` and appends to the day book — so it is **removed** from the auditor surface and a genuinely
side-effect-free `get_report(report_id)` is added. Read-only must be constructive, not a hint to the model.
T6's `accept` names the resulting auditor set, and it is the set in §6.2. The distinct-tool count across
all states is 15 before T6 and 16 after. Lane E does not choose the fix; lane E requires only that after T6
the fixture and the surface agree.

### 6.4 Fixture governance — how the expectation is allowed to change

This is the anti-fitting rule and it is the most important paragraph in the file.

1. `evals/surfaces.expected.json` is **pre-registered**: written before the run, derived from the surface
   delta ledger, never copied from a captured export.
2. It may be changed **only** in the same commit as the product change that caused it, and the commit
   message must carry a trailer of the form `surface-delta: <node-id>` matching `^surface-delta: (T|S|F)[0-9]+$`.
3. Editing the fixture to make a failing run pass, without a product change, is a **deviation** in the sense
   of the team's deviation ledger and goes to PM for adopt / reject / debt.
4. At each freeze the surface digests are pinned by inclusion in `erp/contracts/FREEZE.md` (S10), verified with
   `sha256sum -c erp/contracts/FREEZE.md`. **There is one freeze mechanism and that is it** — the alias
   `surfaces.frozen.json` is dead, and so are the per-contract wall-clock deadlines an earlier revision
   treated as a second mechanism. E6 asserts that the deployed commit is the commit under test (§11), which
   is what makes *what C1 graded is what the judge will see* a checkable sentence rather than a slogan.

> **Flagged, per `PATHS.md` §3.** The pre-push hook that would enforce rule 2 mechanically **is not in
> `PATHS.md` and is produced by no node**: the only two hook files in the authority are
> `.githooks/pre-commit` (G4) and `.githooks/pre-commit-ownership` (G5), and neither covers this. Rather
> than invent `.githooks/pre-push` locally, lane E records the gap: **until a node owns it, the trailer is
> enforced by L1 at the merge window**, and a fixture edit arriving without one is a deviation on sight.

### 6.5 Known surface deltas already on the books

These change the expectation and must land as fixture edits with the trailer above. Counts are OUR-ESTIMATE
until the owning node lands.

| node | change | effect on every state |
|---|---|---|
| **T3** absence register | one resident read-only tool explaining *why* a tool is missing, in the same `{code, severity, field, fix, candidates}` shape as a violation, validating against `erp/contracts/violation.schema.json` | **+1 tool in all six states**: `S0-anon` → 2, `S1-emp-home` → 6, `S2-emp-draft-clean` → 14, `S3-emp-draft-dirty` → 13, `S4-emp-submitted` → 7, `S5-aud` → 7; `readOnly` +1 everywhere |
| **T6** red-test fix | §6.3, option (B) | `S5-aud` becomes `get_report` in place of `open_expense_report`, `readOnly` 6/6 |
| **S5/S12** sign gate | a transient condition of `S2-emp-draft-clean` | **no new state row**; exercised by N-05/N-06/N-15, and by N-16 which is `known-open` (§7.2.1) |

**What "revoked while a sign request is open" means for the fixture (R-20).** The set revoked in the page is
**every non-read-only tool on the current surface**, **computed at run time from
`annotations.readOnlyHint !== true`** and **never hard-coded — not in the page, not in the suite, not in
this document, not in any prose count**. In `S2-emp-draft-clean` that set has **SEVEN** members, not five;
the number is stated here only as a consequence of the computation, and if the surface changes the
computation is right and this sentence is stale. The suite asserts the **set**, not a count, for the reason
§6.3 gives, and a new write tool is covered on the day it is added.

> **Flagged for L1.** `x-freeze.does[0]` in the frozen `erp/contracts/signature.schema.json` still says
> **five** write tools and omits `submit_expense_report` and `open_expense_report`. That sentence is wrong;
> `graph.json`'s S5 is the authority and says so. `'the five write tools'` is one of the five literal
> strings G4's `--assert-register` requires in `kb/webmcp/RETRACTED.txt`, so it may not reappear anywhere.

The page-side revocation is layer 1 and is explicitly **not a control**: the control is S12's 423 lock and
S5's `E_NOT_SIGNED`, which is what N-15 tests — and N-15 proves the POST, not the human (§7.2.1).

The absence-register tool is **`explain_missing_tool`** (singular). That name is not a placeholder: it is
written into T3's `accept` predicate, which asserts one instance of it in each of the six states and
validates its output against `erp/contracts/violation.schema.json`. If lane T needs a different name, it moves
in the T3 commit together with `evals/surfaces.expected.json`; that is the only permitted route.

T3 is a **soft** input to T5 — the export works with or without the register — and T3 is `cut: 2`. Say what
ours does; make **no** claim about what other projects do not do. The register is UNVERIFIED as a
differentiator: it was never sent through a hostile review, and the census that suggested nobody else ships
it was keyword-based, which this project has been wrong about three times.

---

## 7. E3 — the negative-control suite, in full

**Rule 1: every capability assertion is paired with a must-fail assertion**, and the pairing is *built*,
not counted. **Rule 2: a must-fail case that *passes* fails the run.** **Rule 3: "refused" must be refused
*over the wire* where a server is involved.**

E3's `accept`, copied verbatim from `graph.json`:

> `node webmcp-eval-kit/bin/eval.mjs --suite negative --url $URL` exits 0 ONLY IF every must-fail case
> failed as required, INCLUDING N-15 neg-commit-without-human returning 409 E_NOT_SIGNED. The runner builds
> the pairing map from each case's `pairsWith` field and fails the run if ANY state in
> evals/surfaces.expected.json has an empty pair set — the old predicate
> `count(mustFail) >= count(capability states)` was 14 >= 7, trivially true, and permitted the actual
> situation in which S1-emp-home and S4-emp-submitted had no dedicated must-fail case at all. Every case
> declares `provingNode` and `brokenBy`.

The old arithmetic predicate is gone for the reason the predicate itself now records: `14 >= 7` is true of a
suite in which two states have no control at all, which was the shipped situation. The runner builds the map
from `pairsWith` and fails on any empty set.

`overTheWire(status)` requires **both** (a) a CDP-captured `Network.responseReceived` with that status and
(b) a matching request actually leaving the page. This exists because `erp.js:101` today is *the client
telling itself 403*. A client-side 403 produces no network event and therefore fails `overTheWire` — which
is exactly the point. The correct framing everywhere in this project is **"the tool surface is the intent
surface; the boundary is on the server"**, and this helper is how we prove we mean it.

### 7.1 The mechanical definition of a real negative control

**Every must-fail case declares three fields, and the suite file is invalid without them:**

| field | meaning |
|---|---|
| `pairsWith` | the state id(s) or case id(s) this control pairs with. The runner builds the pairing map from this and fails if any state in `evals/surfaces.expected.json` has an empty pair set. |
| `provingNode` | the node id whose mechanism this case proves. If that node is cut, the case is `not-runnable`, not `refused`. |
| `brokenBy` | **a one-line mutation that makes this case go green.** If you cannot write one, the case is not a negative control. |

`brokenBy` is what E10 executes. E10's `accept`, copied verbatim:

> `node webmcp-eval-kit/bin/eval.mjs run --suite negative --verify-controls` exits 0: for every must-fail
> case it applies that case's declared one-line `brokenBy` mutation, re-runs the case, and FAILS THE RUN if
> the case does not flip from refused to permitted. evals/mutation-report.json records one row per case.

> ### R-27 — the one word: `enforced`, never `refused`, in `controlStatus`
>
> **The frozen enum of `eval-case.schema.json` `controlStatus` is exactly
> `["enforced", "known-open", "not-runnable"]`.** `refused` is **not** a member and never was.
> This document's *report* vocabulary below says a case "reports `refused`", meaning the
> refusal happened; that is prose about a run, **not** a value of the field. Anything that
> **writes** the field writes `enforced`.
>
> This bit: **S5's scheduled deviation (`DEV-E3-eval-case-known-open`) flips
> `examples[1].controlStatus` from `known-open` to `enforced`** — the enum's own word for
> "the refusal is now the required result". A gate asserting `controlStatus === 'refused'`
> makes the frozen file fail its own schema, and CONTRACTS.md §11 check 1 — which is wired
> into `npm test` — turns the whole suite red repo-wide on Day 3. Confirmed by ajv:
> `refused` → *"must be equal to one of the allowed values"*.
>
> When you read "flips to `refused`" anywhere in §7 or §13, read it as **the row now reports a
> refusal, and the field it is stored in reads `enforced`.**

**Three statuses, not two.** A must-fail case reports a refusal — stored in `controlStatus` as
**`enforced`** — or `not-runnable` (its
`provingNode` is cut or absent — N-08, N-09), or **`known-open`**: the case runs, the attack **succeeds**,
and that is the recorded, expected result of a hole we have not closed. `known-open` exists for exactly one
row — **N-16** — and it is the honest alternative to deleting a control we cannot yet pass. Rules:

- a `known-open` case is **excluded from the pairing map** and from `--verify-controls` (E10 flips
  controls; there is nothing to flip in a case that is already permitted), and it declares
  `brokenBy: null` with `knownOpen: "<one line naming the open vector>"`;
- it **fails the run if the outcome changes in either direction without the suite changing with it** —
  a silently refused `known-open` case is as much a defect as a silently permitted `refused` case, because
  it means the mechanism moved and nobody wrote it down;
- it appears in README Table 2 with the word `known-open` and never as `refused` (§13);
- **it may not be introduced to make a red row disappear.** N-16 is in the suite because C3's charter now
  names its vector as a standing target (§7.4) and PM asked for the result in writing.

**This is the only mechanical definition of "real negative control" this project has**, and it implements
C4's own charter bar — *these tests must be red when the mechanism is removed* — which the eval design
previously stated nowhere. It exists because five of the shipped controls were verified as passing
**vacuously** against the current tree (no server, no `http.createServer`, no iframes, no test kit, no
header configuration): they were green then, green if the S lane never shipped, and green if the check they
claim to test were later deleted.

### 7.2 The suite — must-fail controls

Every row except N-16 is red today and goes green only when its `provingNode` lands. **N-16 is the one
row that is not red**, and §7.1's `known-open` status is why it is still in the table rather than deleted.

| id | must-fail case | driven how | assertion | pairsWith | provingNode | brokenBy |
|---|---|---|---|---|---|---|
| **N-01** | **a revoked tool cannot be called** | `S2-emp-draft-clean` → drive the report dirty → re-read the surface from `toolsRemoved` (or `await getTools()`) | `submit_expense_report` ∉ the surface; then `WebMCP.invokeTool{toolName:"submit_expense_report"}` **does not reach state**. Record **which layer refused** as evidence, and assert only that the report `status` is unchanged and the day-book head is unchanged. **Now measured, and it narrows the claim rather than widening it (2026-08-29):** the browser *does* refuse — `-32602 "Tool not found"` — but it returns **the identical code for a name that never existed**, so the two are indistinguishable to the client and **no assertion may claim the browser tells revoked from unknown**. N-02 covers the captured-handle case at the page layer, which is the one we control | `S2-emp-draft-clean`, `S3-emp-draft-dirty` | T2 | delete the `AbortController` abort on the dirty transition |
| **N-02** | the page's `execute` closure remains reachable after abort | hold the closure captured before the flip and invoke it directly in page context | the **closure itself** refuses (`tools.js:370` double lock) and state is unchanged. This is a code test, not a browser test: Chrome hands the client no callable handle — page-JS invocation needs a **live descriptor from `await getTools()`**, and a revoked tool is not in it (`FACTS.md` IR-18); the by-name form N-01 uses exists only over CDP | N-01 | T2 | remove the `tools.js:370` state re-check from `execute` |
| **N-03** | **auditor cannot write, and gets a real server 403** | `S5-aud`, POST the write endpoint directly from the page context | `overTheWire(403)`; body carries the deterministic violation envelope; **and** the write tool is absent from `getTools()` (double lock) | `S5-aud` | S2 | make `server/authz.mjs` fall through for the auditor role |
| **N-04** | **bypassing the page handler still hits server authorization** | `curl` from CI, auditor cookie, no browser at all | `HTTP/1.1 403`; day book unchanged; the identical `curl` with the employee cookie returns 200 (proving the 403 is authorization, not a broken route) | N-03, `S5-aud` | S2 | same as N-03 |
| **N-05** | **data changed after signing is rejected at commit** | sign-open condition of `S2`: obtain a sign request over snapshot digest `D`, mutate a line, then commit | commit returns `overTheWire(409)` with `E_SNAPSHOT_MISMATCH`; server-side re-canonicalisation reports digest ≠ `D` under OCF-1; hash-chain head **unchanged**; no new day-book entry | `S2-emp-draft-clean`, N-15 | S6 | skip the re-canonicalisation in `server/recanon.mjs` |
| **N-06** | a **sign request cannot be replayed** onto a second report | present an answered `request_id` in a commit against a *different* report id | `overTheWire(404)` with **`E_SIGN_REQUEST_UNKNOWN`** — under the repaired contract the server's own record lookup refuses first (*"no such request_id, it belongs to another session, or its report_id does not match the URL"*), **before** any digest comparison; day-book head unchanged, no chain entry. **Not 409**: the codes moved under R-1 and this row moves with them | N-05 | S5 | in `server/sign.mjs`'s commit path, resolve the report from the sign record instead of from the URL (`const reportId = rec.report_id`) — the mismatch becomes unobservable and the replayed commit returns 200 |
| **N-07** | **malformed arguments do not reach state** | `executeTool` with a string where the schema says number, an extra property, a missing required property, and a **non-integer amount** | each returns a violation envelope, **not** a stack trace and **not** a 500; state unchanged. *Chrome does not validate against `inputSchema` (§2.2.1), so this is a test of our code, and it is the only reason it is worth testing* | all six states | T2 | delete the argument guard at the top of `execute` |
| **N-08** | **the test kit cannot escalate privilege** | — | **NOT RUNNABLE.** No node produces a test-kit endpoint; see §5. Reported as `not-runnable`, never as `refused`, and it does not count toward the pairing map | — | *(none — flagged)* | — |
| **N-09** | **the test kit is invisible without the token** | — | **NOT RUNNABLE**, same reason. Had the endpoint existed, the assertion is the *distinguishing pair* — **with** the token → 200/400, **without** → 404 — never the bare 404, which any unknown path returns and which was green against a tree containing no test kit at all | — | *(none — flagged)* | — |
| **N-12** | **an untrusted-content tool output cannot smuggle instructions** | request a report whose free-text fields contain agent-directed text | the tool's `annotations.untrustedContentHint === true`, and the output is clipped to the 1500-char budget | `S2-emp-draft-clean`, `S5-aud` | T4 | remove the clip in the tool's `execute` |
| **N-15** | `neg-commit-without-human` — **a commit cannot be made without a POST from the authenticated session to `/api/sign/{request_id}/respond`** *(R-1, narrowed by R-13(a))* | `submit_expense_report` creates sign request `sg_…`; **never POST `/respond`**; POST `/api/reports/R/commit` with just that `request_id` | `overTheWire(409)` with **`E_NOT_SIGNED`**; no chain entry; no artifact; and the stored record's `signed_by` and `at` are shown to come from the session cookie and the server clock, unaffected by anything in the request body. **This row asserts the POST, not a human** — see §7.2.1 | `S2-emp-draft-clean`, N-05 | S5 | let commit accept a sign request still in state `open` |
| **N-16** | `neg-respond-without-click` — **the gate does not establish that a human decided**; scripted verbatim as the attack | `curl`, employee session cookie, **no browser at all** (this is N-04's threat model): create `sg_…`, **never render the dialog**, POST `/api/sign/{sg}/respond` echoing the values the server just issued — `{schema, request_id, decision:'signed', reason:null, method:'click', acknowledged_digest, acknowledged_revision}` — then POST the commit | **`known-open` today — that is, *before the `confirm_token` ships (S5, Day 3)*, R-34 — and the case asserts exactly that**: the commit **SUCCEEDS**, HTTP 200, and a chain entry is written attesting the session's own name at a genuine server-clock time. From **Day 3**, with the `confirm_token` required (§7.2.1), a caller that cannot read the rendered dialog's DOM gets **403 `E_NO_CONFIRM_TOKEN`** — a **scheduled** change, not a finding — and this row flips to reporting a refusal, stored as **`controlStatus: "enforced"`** — R-27; `refused` is not in the frozen enum. **A silent change in either direction fails the run** | *(none — `known-open`, excluded from the pairing map)* | S5 | `null` — §7.1: there is nothing to flip in a case that is already permitted |
| **N-17** | **the home state cannot edit lines** | `S1-emp-home` (no open report): attempt a line mutation by name, then the same route directly | `update_expense_line` absent from `getTools()` **and** the direct route returns `overTheWire(409)` — there is no report to edit | `S1-emp-home` | S2 | drop the open-report precondition from the write-route table |
| **N-18** | **a submitted report is append-only** | `S4-emp-submitted`: attempt a line mutation by name, then the same route directly | `update_expense_line` absent from `getTools()` **and** the direct write returns `overTheWire(409)`; day-book head unchanged | `S4-emp-submitted` | S2 | allow the `submitted` status through the write-route table |
| **N-19** | **the anonymous surface cannot read the ledger** *(was N-16; renumbered because `graph.json`'s S5 `accept` binds the id N-16 to `neg-respond-without-click`, and `graph.json` wins)* | `S0-anon`, no cookie: attempt the read tool by name, then the same route by `curl` | the tool is absent from `getTools()` **and** the direct route returns `overTheWire(401)` | `S0-anon` | S1 | make `GET /api/me` fall through without a cookie |
| **N-20** | `neg-policy-content-swap` — **the signature binds the policy's CONTENT, not its version name** *(R-33, 2026-08-28; the N-number is assigned by `graph.json`'s E3 accept, which states that it assigns it, and this row is that assignment written down here)* | scripted: seed `2026-08.1`, open a sign request over `S2-emp-draft-clean`, then swap the **served** policy document for the `sha256:17bc4b2d…` trap — `2026-08.1`'s own document with `transport_per_line` dropped to 5000 and the `version` string **not** bumped, already shipped in `policy-versions.json` — and commit | commit returns **409 `E_POLICY_DIGEST_MOVED`**, nothing committed, day-book head unchanged; **`E_POLICY_VERSION_MOVED` correctly does *not* fire**, because the version NAME did not move, and that is the whole point of the row. `controlStatus: "enforced"` (R-27) and **RED until `policy_digest` is inside the snapshot projection**. **Honest scope, and it travels with the case:** the attack needs **write access to the served policy**, arguably *outside* the declared N-04 curl-and-cookie model — it is a **weaker** vector than N-16, which needs only the cookie. Never write it up as a break of the curl-and-cookie model; it is in the set because the same hole fires on an honest operator hot-editing a limit without bumping the version | `S2-emp-draft-clean` | S5, with S3 for the load-time lock | drop `policy_digest` from the snapshot projection |
| **N-21** | `neg-decline-to-unlock` — **the sign machine is one-shot: the FIRST respond wins and a second cannot overwrite it** *(R-34, 2026-08-28; the audit's Invented D, now claimed and coded)* | two actors, and the ordering is the test: the human submits and the dialog renders, so a `confirm_token` exists in the DOM; the **attacker**, who can read that DOM (the attack additionally requires DOM read access; **V3 does not measure that precondition** — R-44), POSTs `/api/sign/{sg}/respond` with `decision:'declined'` **first**; the **human** then clicks Sign and their genuine respond arrives second | **both** observed statuses, not just the first: the human's respond → **409 `E_ALREADY_ANSWERED`**, and the commit → **200 `E_DECLINED`**. Asserting only the 409 would pass against a server that merely dropped the second request. `controlStatus: "enforced"` (R-27 — `refused` is not in the enum) and **RED until `E_ALREADY_ANSWERED` ships** | the `answered` state | S5, with S12 | remove the one-shot guard on `/respond` so a second respond overwrites the first — the human's signature then lands and the control goes green |

**Pairing coverage** (what the runner builds from `pairsWith`, and why no state is empty):
`S0-anon` → N-19 · `S1-emp-home` → N-17 · `S2-emp-draft-clean` → N-01, N-05, N-15, **N-20**, **N-21** · `S3-emp-draft-dirty`
→ N-01 · `S4-emp-submitted` → N-18 · `S5-aud` → N-03, N-04. Plus N-07 across all six. **N-19, N-17 and
N-18 are new**: `S0-anon`, `S1-emp-home` and `S4-emp-submitted` previously had no dedicated control, which
is the situation the old arithmetic predicate permitted. **N-16 is deliberately absent from this map** — a
`known-open` case pairs with nothing, or a state would be "covered" by a control that does not refuse.

> **N-21 and severity — read this before you write it up.** N-21 is a **nuisance-grade denial, not a forgery**, and it goes in its own row with the word *denial* on it. Nothing commits, nothing is attested, no false chain entry is written: the attacker **cancels** a signature and cannot **produce** one, so the day book ends up strictly emptier rather than falser. Its precondition — DOM read access for the `confirm_token` — is *strictly stronger* than N-16's cookie-only vector, so anyone who can run N-21 can already run the worse one. **Reporting N-21 at the same severity as N-16 is itself a finding against the report.** It is claimed here rather than left for a reviewer because a hole we can name costs less than a claim we cannot defend. Full statement: `signature.schema.json` `x-signRequestState.declineToUnlock`.

**Why N-06's old `brokenBy` had to be replaced, and why this is not bookkeeping.** The row previously
asserted `overTheWire(409)` and declared `brokenBy: drop report_id from the snapshot projection`. Under
R-1 the server owns the sign record, so a replay onto a second report is refused by the **record lookup**
(404 `E_SIGN_REQUEST_UNKNOWN`) before the canonicaliser is ever reached. The old mutation therefore
changed an assertion the case never evaluates: the case would not flip, and **E10 would have failed the
whole run on N-06 by construction** — the exact failure mode §9.5 routes to C4. Note also what N-06 now
tests and what it does not: it tests the record lookup, not the digest. The digest binding is N-05's job,
and N-05 is where a claim about re-canonicalisation belongs.

**N-01 and N-02 were mutually exclusive as previously written.** N-01 asserted the browser rejects the call
as an unknown tool; N-02 asserted the result text matches `/no longer on the surface/`, which is *our page's*
text and can only be produced if the tool was never actually unregistered. N-02 therefore passed only when
N-01's invariant was broken. So N-01 **records** which layer refused instead of asserting one, and N-02 is
restated at the layer we control.

**That decision is now vindicated by measurement, and the measurement would have broken the stronger
form.** MEASURED 2026-08-29: over CDP, `invokeTool` with an unregistered `toolName` returns
`-32602 "Tool not found"` — and returns **exactly the same code and message** for a tool revoked by
`AbortController`. So "the browser rejects it as an *unknown* tool" is unprovable from the client: unknown
and revoked are one response. From page JS there is no by-name call to reject at all (`FACTS.md` IR-18).
Had N-01 asserted the browser distinguishes the two, it would now be a false test that passes for the wrong
reason. **Record-which-layer stands, and the reason it stands is stronger than the reason it was
written.**

### 7.2.1 The sign gate: the only sentence we can prove, and the one we deleted (R-13)

**A second forgery survives R-1 and is open today — meaning *before the `confirm_token` ships*, which is
node `S5` on Day 3, and that clause is part of the claim (R-34).** From Day 3 the body below is refused
**403 `E_NO_CONFIRM_TOKEN`** at `/respond`, because `confirm_token` is one of the eight required fields of
the frozen `$defs.sign_respond_request` under `additionalProperties:false` and the body carries seven.
**That refusal is scheduled, not a discovery** — N-16 flips to `controlStatus: "enforced"` under S5's
deviation `DEV-E3-eval-case-known-open` — **and it does not make the gate stronger than the provable
sentence below**, because a caller that can read the dialog's DOM lifts the token and the vector is open
again for that caller — and V3 measured **cookie carriage only**, so the honest statement is that the walk
holds for any caller that *also* obtains DOM read access, which this evidence neither establishes nor
excludes for this client (R-44). The attacker does not need to synthesise anything: it
POSTs `/api/sign/{request_id}/respond` **itself**, from the authenticated session, echoing the digest the
server just issued, and then commits. Every rejection code in `erp/contracts/signature.schema.json` `x-rejectionCodes`
were walked against that sequence and **none fires**. This is inside our own declared threat model — N-04's
`curl`, a session cookie, no browser — so it cannot be waved off as out of scope.

**The only provable sentence is:**

> *A commit cannot be made without a POST from the authenticated session to
> `/api/sign/{request_id}/respond`.*

Every stronger headline is **deleted from this document and may not be restored**: not *"a commit cannot be
made without a human decision"*, not *"Layer 0 answers did a human decide"*, and there is no
`forgeryClosed` flag in any result file. G4's `--assert-register` carries the first of those as a
retracted claim, and lane E is bound by it like every other lane.

**What R-1 bought, and what it cost — both, in the same breath.** The attacker loses the ability to choose
the name and the timestamp: `signed_by` now comes from the session cookie and `at` from the server clock.
What the day book therefore records is a **true attribution of a false event** — signed by the real
session-holder, at a real time, and **forensically indistinguishable from a real click, permanently**.
That is arguably worse than the old forgery, which at least left a client-chosen name as a tell. It is
written here on purpose, and any surface that describes the sign gate carries this sentence with it.

**The `confirm_token` is defence in depth, not a proof.** A token is minted with the sign request and
delivered **only** into the rendered dialog's DOM — never in a tool-call result, never in any
`/api/sign/{id}` response body — and `/respond` requires it. It raises the cost of the attack. **It does
not establish personhood**. **`V3` measured COOKIE CARRIAGE ONLY (R-44).** The vector stays open for any caller that **also**
obtains read access to the rendered dialog's DOM — and *nothing measured establishes that second
conjunct for this client*: no run rendered a sign dialog, queried a DOM, or lifted a token. This is
**not** a closure; it removes an unsupported assertion about *which* caller has the access.
N-16 stays `known-open` for any such caller. **`V6-consent-gate` gets no credit (R-44)**: a client policy
this server cannot observe is not a property of the token. Do not describe the token, or the prompt, as a
closure anywhere — in the README, the video, or Devpost — and do not let a
green N-16 be read as one.

### 7.3 Guards — regression lints, not negative controls

These three cannot fail in any reachable state today: nobody writes flow prose, nobody sets the header,
nobody registers in an iframe. They are **regression guards**, and calling them negative controls made
Table 2's "every row must read `enforced`" mean less than it says. They live in a **separate table** in the
README (§13) and they are excluded from the pairing map.

| id | guard | run how | assertion |
|---|---|---|---|
| **G-10** | **no tool is registered in an iframe** | build-time lint over the built page | `! grep -rq '<iframe' src/page/` passes and no registration site is inside a frame document. *(Was N-10, a CDP walk of `Page.getFrameTree` — which would have silently skipped exactly the frames it claimed to check, because cross-origin child frames are OOPIFs needing `Target.attachToTarget`, not a plain `Runtime.evaluate`.)* §2.2.2 stays as the design rationale |
| **G-11** | **the deployment does not carry `Origin-Agent-Cluster: ?0`** | header dump of the deployed origin | `grep -i '^origin-agent-cluster:' evidence/headers.txt \| grep -q '?0' && exit 1; exit 0` — **only `?0` is fatal; `?1` is the opposite setting and is harmless.** Requires D1 |
| **G-13** | **surface descriptions do not encode flow control** | lint `artifacts/tools.export.json` | no description matches `/\b(first\|then\|before\|after) (call\|use\|invoke)\b/i` — the state machine is the registration, not the prose |
| **G-14** | **description budget** | lint `artifacts/tools.export.json` | every `description.length <= 500`; report the max and the median. The 500/1500-char budgets are **PUBLISHED guidance, not enforcement** — do not grade them MEASURED |

`! grep -q <pat> <file>` is the only correct "must not appear" idiom in this project. **`grep -c … returns
0` EXITS 1**; written in an `&&` chain it always fails, and that bug was in four accept predicates before
this revision.

### 7.4 What C3 adds, and what it may write

C3 (E9) ratchets this suite. E9's `accept`, copied verbatim:

> erp/charters/C3.md's standing target list has been REWRITTEN before this node runs, and `grep -q 'POST
> /api/sign/{request_id}/respond yourself' erp/charters/C3.md` exits 0 while `! grep -q 'prove that closure,
> not to rediscover the hole' erp/charters/C3.md` also exits 0 — the instrument must be pointed AT the live
> vector. AND evals/redteam/report.md lists at least 8 attempted breaks, each with a reproduction command,
> and the list MUST include the four sign-gate attacks the charter already enumerated (replay, race a second
> respond, wrong request_id, expire-and-commit) AND the fifth that none of them covered: POST /respond
> yourself from the authenticated session without ever rendering the dialog, then commit. Every SUCCESSFUL
> break lands as a runnable file in tests/redteam/ in the same commit, and C4 mirrors it into
> evals/suites/negative.suite.json in the same merge window. The report is a file C3 writes with the shell
> tool; `-o` captures only a status line.

Three things this fixes. C3's charter forbids it from touching `evals/`, so the old predicate — "C3 appends
to `negative.suite.json`" — was unsatisfiable under C3's own charter. **C3 writes `tests/redteam/`, which it
owns; C4 mirrors.** And `-o` captures only the agent's *last message*, which cannot hold eight breaks with
repro commands, so the report is a file written with the shell tool. A break with no runnable file is not a
finding, it is an anecdote.

**And the third, which is the one that matters (R-13(e)).** The charter enumerated exactly four sign-gate
attacks — replay an `answered` request, race a second respond, commit against a different `request_id`,
expire and commit — **none of which is "POST `/respond` yourself"**, and then instructed the red team to
*prove that closure, not to rediscover the hole*. The one instrument that could have found the live vector
was pointed away from it by a sentence. Both the enumeration and that sentence are rewritten in
`erp/charters/C3.md`, and **the rewrite is asserted by E9's own `accept` above**, with a literal `grep` in
each direction, so it cannot be quietly skipped. **A ruler pointed away from the live vector is worse than
no ruler**: it converts an open hole into a certificate.

C3's standing target #6 — *provenance laundering: get an agent-proposed field to present as human-edited* —
stays first on the list. It is the target that found the sign-gate forgery, and its rewritten form now names
N-16's vector explicitly.

---

## 8. E4 / E8 — the blind grading protocol for C1

### 8.1 The mechanism, stated plainly

**A grader that can read the source systematically over-rates the surface.** The agent on the judge's side
sees exactly **four** things per tool: `name`, `description`, `inputSchema`, `annotations`. It does not see
`erp.js`. It does not see this document. Every time a source-reading grader thinks *"the description is thin
but obviously it means X"*, it is silently substituting knowledge the real client does not have, and it will
certify a surface that a real agent cannot drive.

This bites us harder than most projects because of a rule we impose on ourselves: **flow control must not be
written into descriptions** (the workflow is the registration state machine, not prose). That rule makes the
surface leaner and the mechanism sharper, and it also removes the crutch that would have rescued a thin
description. The blind grader is the only instrument that can tell us whether the state machine communicates
itself. It is therefore not a nicety; it is the test of that kernel.

**Which is exactly why C1 must not be told the rule.** The admissibility clause in E4's `accept` (§1.1)
fails the packet build if `evals/blind/prompts/c1.txt` contains any criterion the rubric grades. C1's brief
carries only what the API **is** — registration, `AbortController` revocation, the four visible fields, and
that annotations exist — and nothing about what our surface should look like, no character budgets, no
iframe rule, no `Origin-Agent-Cluster` rule.

### 8.2 What C1 receives — the packet, and nothing else

`node evals/blind/make-blind-packet.mjs` builds a directory containing **exactly two files**, and `ls -1`
in it prints `2`:

1. **`artifacts/tools.export.json`** — produced by node **T5**. Its envelope is the frozen one:
   `erp/contracts/tool-export.schema.json`, which carries `policy_digest` and holds `states` as an **array**.
   Illustrative shape only — the schema is the authority, not this snippet:
   ```json
   { "schema": "outpocket.tool_export/1",
     "app_commit": "<40 hex>", "policy_version": "2026-08.1",
     "policy_digest": "sha256:…",
     "states": [
       { "state_id": "S1-emp-home", "label": "…",
         "preconditions": { "role": "employee", "open_report": "none", "verdict": "n_a" },
         "tools": [ { "name": "…", "description": "…", "inputSchema": {}, "annotations": {} } ],
         "surface_digest": "sha256:…",
         "accounting": { "tool_count": 5, "description_bytes": 0, "schema_bytes": 0,
                         "total_bytes": 0, "estimated_tokens": 0 } }
     ],
     "totals": { "state_count": 6, "distinct_tool_count": 16, "max_description_bytes": 0 } }
   ```
   An earlier revision of this file published a **different, incompatible envelope**
   (`{freeze, chromiumMajor, capturedAt, states: {<id>: {digest, tools}}}` — `states` as an **object**).
   T5 can only build one, and the frozen contract wins. That envelope is dead.

   The export contains **only** `name`, `description`, `inputSchema` and `annotations` per tool — no source,
   no file paths, no repo identifiers. T5's `accept` asserts that; E4's packet builder asserts it again with
   `! grep -qi 'outpocket\|countinghouse\|/Users/'`.

2. **`evals/blind/tasks.md`** — eight fixed task statements in the employee's voice, written **before** the
   export is captured and never edited after seeing one. Example shape (final wording is L2's, frozen with
   `erp/contracts/FREEZE.md`): *"You are the employee's assistant. Add last Tuesday's 42-euro taxi to the open
   report and submit it."*

C1 gets no repo, no URL, no network. **Enforced by `CODEX_HOME`, not by `cwd`** — §1.1 and §9.3 command (4).

> **Two flags for L1, per `PATHS.md` §3 — not fixed here, because `erp/contracts/tool-export.schema.json` is
> L1's file and it is frozen.** (a) Its `state_id` pattern is `^[a-z][a-z0-9_.]{2,63}$`, which does not match
> the canonical ids `S0-anon` … `S5-aud` that `PATHS.md` §5 and T5's `accept` both mandate. (b) Its
> `minItems`/`state_count` minimum is 5, while the authority requires **six** states. Both need an L1 edit
> before S10 freezes the file. Lane E follows the authority — six states, hyphenated ids — and does not
> resolve the schema locally.

### 8.3 What C1 must produce

A single JSON document at `evals/blind/C1-verdict.json`, validating against `evals/blind/rubric.schema.json`
and forced by `codex exec --output-schema`. Two halves: an **operational** half (mechanically comparable)
and a **rubric** half (judgement).

**Operational half — one record per task.** This is the part that carries weight, because it can be
compared to a pre-registered answer key:

```json
{ "task": "T3", "state": "S2-emp-draft-clean",
  "firstTool": "add_expense_line",
  "canConstructArgs": true,
  "missingInfo": [],
  "ambiguousWith": ["update_expense_line"],
  "wouldAskHuman": false }
```

- `firstTool` is compared to a pre-registered answer key held by L2 and **never shown to C1**.
  **Mismatch is a finding about our descriptions, not about C1.**
- `canConstructArgs: false` plus a populated `missingInfo` is the single most actionable output of the whole
  eval: it names a required field the surface never explains how to obtain.
- `ambiguousWith` names tools C1 could not tell apart from the export alone.

**Rubric half — six dimensions, 0/1/2 with explicit anchors, plus one binary gate.**

| # | dimension | 0 | 1 | 2 |
|---|---|---|---|---|
| R1 | **Nameability** — can the right tool be chosen from names alone? | names collide or mislead | mostly clear, ≥1 pair confusable | each name maps to one intent |
| R2 | **Argument constructibility** — can required args be built from the surface? | ≥2 tasks blocked | 1 task blocked | all tasks constructible |
| R3 | **Failure legibility** — does the surface say what happens when a call is refused? | silent | mentioned generically | refusal shape is described or discoverable via a read-only tool |
| R4 | **Absence legibility** — when an expected tool is missing, can C1 tell *why*? | no signal | inferable | an explicit absence tool answers it (this is what T3 buys) |
| R5 | **Budget discipline** — is any description bloated or padded with flow prose? | >500 chars or flow prose present | verbose | tight, no flow prose |
| R6 | **Read-only honesty** — do `readOnlyHint` claims match what the description says the tool does? | a hinted tool clearly writes | unclear | consistent |
| **G** | **binary gate**: could C1 complete ≥6 of 8 tasks without asking for information the surface does not contain? | — | — | pass / fail |

C1 must also emit `confidence` per dimension and a free-text `worstProblem` (≤300 chars). The rubric total
(0–12) goes in the README table as a raw number with the freeze id — **never** as a percentage, and never
compared to any competitor's number. **R6 is why the packet carries `annotations`**: a grader shown only
name/description/inputSchema cannot grade `readOnlyHint` honesty at all.

### 8.4 How the run is launched

E8's `accept`, copied verbatim from `graph.json` — this is the command, not a paraphrase of it:

> The run executes as `CODEX_HOME="$BH" codex exec --strict-config -C "$PACKET" -s read-only
> --skip-git-repo-check --ephemeral --ignore-rules --output-schema evals/blind/rubric.schema.json -o
> evals/blind/C1-verdict.json "$(cat evals/blind/prompts/c1.txt)" < /dev/null`, where $BH is built by
> tools/blind-home.sh. The verdict validates against evals/blind/rubric.schema.json. ADMISSIBILITY, all
> required: `! grep -qi 'outpocket\|countinghouse\|/Users/\|\.mjs\|src/' evals/blind/C1-verdict.json`
> passes; the transcript shows ZERO tool calls outside $PACKET; and the run banner shows
> `reasoning effort: low`.

Four things in that command are load-bearing and none may be dropped:

- **No `-p verifier`** (R-2). The dedicated blind home has no profile file, and `-p <missing>` exits 0 with
  no warning and silently falls back to the base config — which is the config `$BH` exists to escape. The
  two keys go directly into `$BH/config.toml`.
- **No network override** (R-4). The blind verifier never gets
  `-c sandbox_workspace_write.network_access=true`.
- **`< /dev/null` is mandatory.** MEASURED: when stdin is not a TTY, `codex exec` prints *"Reading additional
  input from stdin…"* and appends whatever it finds as a `<stdin>` block, silently extending the prompt.
- **The banner grep is a positive check on the *effect*, not the profile** (R-3). It is the only assertion
  that the run happened at the intended reasoning effort.

**And one thing that is missing from it, stated rather than patched.** The command as frozen above does
**not** carry `--disable plugins`, so the run renders the `<recommended_plugins>` catalog into C1's prompt
(§1.1.1): ~3.7 KB of live, third-party, time-varying text that `tools/blind-home.sh --verify` cannot see,
because it is not in `$BH`. Lane E does not add the flag to the runbook on its own authority — a runbook
that diverges from a frozen `accept` is how a node passes QA while the run differs from the plan. **PM/L1:
adding `--disable plugins` to E8's `accept` in `graph.json` is a one-token change and it makes the blind
prompt reproducible (16,338 → 12,537 B, two runs byte-identical, MEASURED).** Until then the block is
declared, not removed, and §8.5 records the byte count so a reviewer can re-run it.

### 8.5 When C1's verdict is admissible

All of the following, or the verdict is discarded and the packet is rebuilt:

- every admissibility clause in E8's `accept` above passes — including **zero tool calls outside the packet
  directory**, which is the positive form of the blindness check;
- `bash tools/blind-home.sh --verify` exited 0 for the home the run used (§1.1);
- the report records the **rendered prompt byte count** for the home the run used —
  `CODEX_HOME="$BH" codex debug prompt-input "$(cat evals/blind/prompts/c1.txt)" | wc -c` — **and whether
  `<recommended_plugins>` was present** (§1.1.1). This does not make the run hermetic; it makes the
  non-hermetic part *visible and re-runnable*, which is the most this instrument can honestly claim while
  the flag is not in E8's `accept`;
- the packet was built by `evals/blind/make-blind-packet.mjs` and its admissibility clause passed, so the
  brief did not leak a graded criterion;
- `chromiumMajor` in the export matches the run that produced it;
- the export's `surface_digest` values match the digests pinned in `erp/contracts/FREEZE.md` for that freeze.

**Discarded verdicts are listed in the report with their reason.** We do not quietly re-roll until we like
the number.

---

## 9. The Codex runbook

### 9.1 Reality check before anything else

**MEASURED 2026-08-28 on this machine:** `codex-cli 0.144.6`; `~/.codex/config.toml` exists and is
**6,416 bytes**, setting `model = "gpt-5.6-sol"` and `model_reasoning_effort = "medium"` **and** enabling
`[mcp_servers]`, `[plugins]` and `[hooks]` tables; and **zero profiles exist**
(`ls ~/.codex/*.config.toml` → no matches). An earlier revision of this file described that base config as
containing only two keys. It does not, and the difference is the whole of §1.1.

**MEASURED semantics of `-p`,** verbatim from `codex exec --help`:
> `-p, --profile <CONFIG_PROFILE_V2>` — Layer `$CODEX_HOME/<name>.config.toml` on top of the base user config

So the `~/.codex/<name>.config.toml` form is **correct for this CLI version** — one file per profile,
layered over `~/.codex/config.toml`. (A `[profiles.x]` table inside `config.toml` is a *different*, older
shape; do not mix them.)

### 9.2 The four profiles are created by L0, and proved to have taken effect (R-3, R-4)

**Profile creation is not lane E's node.** It is gate **(3)** of **L0**'s `accept` — it was item (4) before
R-15 reordered L0's gates so the commit precedes the clone — copied verbatim from `graph.json`:

> (3) PROFILES, R-3, existence AND effect, with `$want` BOUND BY THE LOOP: `for pair in verifier:low
> builder:medium redteam:high evaluator:high; do p=${pair%%:*}; want=${pair##*:}; test -f
> ~/.codex/$p.config.toml || exit 1; python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))"
> ~/.codex/$p.config.toml || exit 1; codex exec --strict-config -p "$p" --ephemeral -s read-only
> --skip-git-repo-check -o /dev/null 'Reply with exactly: OK' < /dev/null 2>&1 | grep -q "reasoning effort:
> $want" || exit 1; done` exits 0. The previous revision wrote `$want` as unbound prose and the loop could
> never have run. A missing profile exits 0 with no warning and silently falls back to the base config, so
> the banner grep is the ONLY real check.

**Why all three parts are required.** MEASURED, verbatim:

```
$ codex exec --strict-config -p nonexistent-profile-xyz --ephemeral -s read-only \
    --skip-git-repo-check -o /tmp/sc.txt "Reply with exactly: OK"
… model: gpt-5.6-sol … reasoning effort: medium …
codex: OK          EXIT=0
```

No error, no warning; it fell back to the base config's `medium`. The old acceptance check ran exactly this
shape and then did `grep -q OK` — **it passes with no profile file present at all**, which means C3
("maximum reasoning") and C4 could have run at `medium` for the entire sprint, and C1 at `medium` instead of
`low`, with every result file still green. That is the single cheapest way for the whole eval to be quietly
wrong. `test -f` catches the missing file; the banner grep catches the silent fallback.

The reasoning efforts are `verifier: low · builder: medium · redteam: high · evaluator: high`, and **`high`
is the pinned value for redteam** — this machine's config lists `["low","medium","high","xhigh","ultra","max"]`,
so "max reasoning" is a *different, real* value and the two words must not be used interchangeably.
Also MEASURED: `--strict-config` does **not** reject the real `config.toml`, and `-o` writes correctly.

**R-4, encoded in the profile files L0 writes:** `builder`, `redteam` and `evaluator` each set
`sandbox_workspace_write.network_access = true`; **`verifier` does not**, and is never used for a blind run
anyway (§8.4). Bare `-s workspace-write` renders *"Network access is restricted"* — MEASURED — so without
this, C3 could not reach the deployed origin at all and C4's `npm install` in a fresh `webmcp-eval-kit`
would fail.

### 9.3 The five standing commands

All paths absolute or repo-root-relative and copied from `PATHS.md`. `--json` gives a JSONL event stream for
the transcript; `-o` gives the final message. **`< /dev/null` on every Codex command, no exceptions.**

```bash
OP=/Users/calebwei/mcp/outpocket
EK=/Users/calebwei/mcp/webmcp-eval-kit
URL=$(cat "$OP/evidence/D1-url.txt")

# (1) C4 — build/extend the suites and the driver.  R-4: needs the network for npm install.
codex exec --strict-config -p evaluator -C "$EK" \
  -s workspace-write -c sandbox_workspace_write.network_access=true --json \
  -o /tmp/c4-last.txt "$(cat "$OP/.team/charters/C4.md")" < /dev/null

# (2) C4 — the graded capability + negative suites against a real Chrome.  NOT a Codex call.
node "$OP/webmcp-eval-kit/bin/eval.mjs" --suite capability --suite negative --url "$URL"

# (3) C4 — deterministic accounting, zero model calls, syscall denied (not an env var).  NOT a Codex call.
node --import "$OP/webmcp-eval-kit/test/no-net.mjs" \
     "$OP/webmcp-eval-kit/bin/eval.mjs" --suite accounting

# (4) C1 — blind grading.  Hermetic CODEX_HOME, no -p, no network, packet dir only.
BH=$(bash "$OP/tools/blind-home.sh")            # builds $BH; --verify asserts its contents
PACKET=$(node "$OP/evals/blind/make-blind-packet.mjs")
CODEX_HOME="$BH" codex exec --strict-config -C "$PACKET" \
  -s read-only --skip-git-repo-check --ephemeral --ignore-rules \
  --output-schema "$OP/evals/blind/rubric.schema.json" \
  -o "$OP/evals/blind/C1-verdict.json" \
  "$(cat "$OP/evals/blind/prompts/c1.txt")" < /dev/null
# NOT ADDED HERE ON PURPOSE (§1.1.1, §8.4): `--disable plugins` would suppress the ~3.7 KB
# <recommended_plugins> catalog that survives $BH, but it is not in E8's frozen accept.  Record the
# prompt byte count instead:  CODEX_HOME="$BH" codex debug prompt-input "$(cat "$OP/evals/blind/prompts/c1.txt")" | wc -c

# (5) C3 — red team against the DEPLOYED origin.  R-4: without the override it has no network at all.
codex exec --strict-config -p redteam -C "$OP" \
  -s workspace-write -c sandbox_workspace_write.network_access=true --json \
  -o /tmp/c3-status.txt "$(cat "$OP/.team/charters/C3.md")" < /dev/null
# the report itself is evals/redteam/report.md, written by C3 with the shell tool; -o holds a status line
```

Note the deliberate asymmetry in commands (2) and (3): **the graded run is not a Codex call.** Codex writes
the suites; a plain `node` command executes them. A grader whose result depends on a model's turn is not
reproducible, and the README table has to be reproducible by a stranger with a clean clone.

`tools/blind-home.sh` (E4) is what command (4) depends on. Its content, in one sentence: create an empty
directory, copy in `~/.codex/auth.json` (auth reads `CODEX_HOME`), write a `config.toml` holding exactly
`model` and `model_reasoning_effort = "low"`, and **nothing else** — no `AGENTS.md`, no `[hooks]`, no
`[mcp_servers]`, no `[plugins]`. `--verify` asserts all of that and is part of E4's `accept`.

### 9.4 How results come back

Result files are `evals/latest.json` (E6), `evals/accounting.json` (E5), `evals/mutation-report.json` (E10),
`evals/blind/C1-verdict.json` (E8) and `evals/redteam/report.md` (E9). Every machine-readable result file
carries the same header block:

```json
{ "freeze": "<label from erp/contracts/FREEZE.md>", "commit": "<git rev-parse HEAD>",
  "deployedCommit": "<GET /version>",
  "chromiumMajor": 152, "chromeFlags": ["--enable-features=WebMCP"],
  "mode": "cdp-real-webmcp", "startedAt": "…", "durationMs": 0,
  "netDenial": "node --import ./test/no-net.mjs",
  "cases": [ { "id": "N-03", "kind": "mustFail", "outcome": "refused", "status": 403,
               "overTheWire": true, "provingNode": "S2", "evidence": "…" } ] }
```

`mode` must be `"cdp-real-webmcp"` for the file to be admissible (§2.3). `chromeFlags` must contain
`--enable-features=WebMCP` and must **not** contain `WebMCPTesting` — H1's `accept` asserts both spellings
at the launcher. `netDenial` names which mechanism denied the network (§10.1), because "zero model calls" is
a published claim. `durationMs` is recorded but **never published** (§12.4).

> No `schemas/result.schema.json` exists in the authority and one is not invented here. The header is a
> convention enforced by the runner E1 builds, and adding a schema file would need a `PATHS.md` row and
> funded hours.

### 9.5 What a failing run obliges the team to do

Routed through the team's existing three-way adjudication (PM is the sole judge; this is the lane-E instance
of it, not a new mechanism):

| failure | first responder | obligation | deadline |
|---|---|---|---|
| **the H2 reachability gate fails** (§2.5) | I1 (lane H), and **PM the same day** | lane E has no admissible mode; the grading approach itself is reopened | **Day 0/1, immediately** |
| a **capability** case fails (set mismatch) | owner of the node named in the fixture's `sourceNode` | either fix the code, or land a fixture edit with the `surface-delta:` trailer and a one-line reason | next merge window |
| a **must-fail** case **passes** | **L1 blocks the branch immediately** | the invariant is gone; no merges into `main` on that path until the case is red again | same day |
| **`--verify-controls` finds a case that does not flip** (E10) | C4 | the case is not a control; either write a real `brokenBy` or delete the case and say so | before the next freeze |
| **G-11** fails (`Origin-Agent-Cluster: ?0` present) | I4 (lanes G/D) | deployment is dead for WebMCP regardless of code; D1 reopens | immediately, ahead of all feature work |
| the run cannot start (WebMCP absent) | I1 (lane H) | H5's banner must already have said so on the first screen; if it did not, H5 is broken too | same day |
| C1's binary gate **G** fails | I2 (lane T) | descriptions or the absence register are inadequate; T3/T4 rework | before the next freeze |
| C3 lands a successful break | C3 **and** the owning lane | a runnable file in `tests/redteam/` in the same commit; C4 mirrors into `evals/suites/negative.suite.json` in the same merge window | before the next freeze |

**The prohibited response, in every row: editing the assertion to make it pass.** That is a deviation and
goes to PM as adopt / reject / debt like any other. The team's own rule holds — *adopting must be cheaper
than reverting, or engineers learn to hide deviations* — so "the expectation was wrong" is a perfectly
respectable outcome **when it arrives with the trailer and the reason**.

---

## 10. E5 — deterministic accounting instead of statistics

### 10.1 What we compute, and how "zero model calls" is actually proven

Per state, from `artifacts/tools.export.json`, under OCF-1 (§6.1) and with **zero model calls**: `tools`
count · `bytes` (canonical wire bytes) · `tokensApprox` = `ceil(bytes/4)` (**OUR-ESTIMATE**; no tokenizer is
invoked, and the README label says so) · `descBytes`, `descMax`, `descMedian` · `readOnlyCount` ·
`digest` = `digest("outpocket/surface/1", tools)`.

**The old proof was vacuous and it was the one claim this design made about itself.** MEASURED on this
machine, Node v22.23.1:

```
$ HTTPS_PROXY=http://127.0.0.1:1 https_proxy=http://127.0.0.1:1 node pxt.mjs
proxy env: http://127.0.0.1:1
FETCH REACHED SERVER, status 401 -> HTTPS_PROXY did NOT block it
```

Node's global `fetch` (undici) **ignores proxy environment variables** without an explicit `ProxyAgent`. A
run that called `api.openai.com` would have exited 0 and been recorded as model-free.

The replacement denies the syscall. E5's `accept`, copied verbatim from `graph.json`:

> `node --import ./webmcp-eval-kit/test/no-net.mjs webmcp-eval-kit/bin/eval.mjs --suite accounting` writes
> evals/accounting.json and exits 0, where no-net.mjs throws from net.Socket.prototype.connect and
> dns.lookup — the syscall is denied, not an environment variable; two runs are byte-identical (diff exits
> 0); `! grep -rq 'api\.openai\|api\.anthropic' webmcp-eval-kit/src/` passes; and evals/accounting.json's
> header records WHICH denial mechanism ran.

**That leading `./` is load-bearing and it is the whole node (NEW-10).** VERIFIED BY EXECUTION on this
machine, Node v22.23.1:

```
$ node --import webmcp-eval-kit/test/no-net.mjs webmcp-eval-kit/bin/eval.mjs --suite accounting
node:internal/modules/package_json_reader:314
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);
$ node --import ./webmcp-eval-kit/test/no-net.mjs webmcp-eval-kit/bin/eval.mjs --suite accounting
hook loaded
kit ran
```

Node resolves a bare specifier as a **package name**, not a path. Written without the `./` the denial hook
never loads — and because the failure is a throw before the kit starts, the shape of the mistake in CI is a
red run, but the shape of it in a hand-edited `&&` chain is a suite that runs **with the network wide open
while reporting itself model-free**. It is the same class of defect as the `HTTPS_PROXY` proof above: the
one claim the design makes about itself, not tested. **Every `--import` in this project is either `./`-
prefixed or absolute**; per `PATHS.md` §3 this is the only permitted `./` in an `accept` predicate, and
`G0 --check-accept-paths` enforces both halves of that sentence.

Two acceptable stronger alternatives, if CI prefers them, recorded in the same `netDenial` header field:
`codex sandbox -s read-only -- node webmcp-eval-kit/bin/eval.mjs --suite accounting` (read-only ⇒ network
denied, MEASURED), or on Linux CI `unshare -rn …`. **The `! grep -q` form is deliberate**: `grep -rc …
returns 0` exits 1, so the old `&&` chain always failed.

### 10.2 What we refuse to compute, and the arithmetic behind the refusal

We are **not** running a two-arm comparison (agent-with-outpocket vs agent-without) and publishing a success
rate. Detecting a difference between two proportions of the size anyone would care about — roughly 0.50 vs
0.75, at α = 0.05 and 80% power — needs on the order of **62 observations per arm** (PUBLISHED: standard
two-proportion power calculation). And the unit of analysis is the **task variant**, not the trial: running
the same task 62 times measures sampling noise, not capability, so 62 means 62 *distinct* task variants per
arm, authored and validated. At two arms that is ~124 hand-built tasks plus the model calls to run them,
inside 5.5 days that must also produce a working site, a deploy and a video. It does not fit, and a
20-sample version of the same table is worse than nothing: it invites exactly the hostile question we cannot
answer.

So the rule for this project is: **no proportion claims, no percentages of success, no "N% better".** Counts
and bytes only. Where we want to say something is reliable, we say *how many times we ran it and how many
times it did what it does*, as a fraction with both numbers visible, and we do not call it a rate.

### 10.3 Two accounting traps we already fell into once

- **Do not claim the dynamic surface saves tokens.** It does not: flipping the surface breaks the prompt
  prefix cache, costing about **1.25× cache write** per flip (**iron rule 15**, MEASURED). The honest
  framing: *we spend prompt-cache efficiency to buy a page-enforced workflow constraint: the tool the agent
  would need is not on the surface until the state permits it. The boundary that actually holds is the
  server's per-request check (S2), not the surface.* Any sentence in the README, video or Devpost answers
  that implies token savings is a wording violation and G4's layer-0 lint catches it.
- **The token figures are not measurements.** The byte counts are MEASURED (iron rule 10); the token figures
  (~99 / ~487 / ~1,671 / ~518) are exactly `ceil(bytes/4)` — the same OUR-ESTIMATE formula, not tokenizer
  output. Citing them to a judge as measured token counts would be circular, and E5 must not do it.
- **Do not publish latency.** The CDP screenshot path costs ~50 ms, and that is **frame quantization, not
  CPU** — 39 of 40 samples landed exactly on a 3-frame boundary ±1 ms (MEASURED). It must never be added to,
  or divided by, main-thread time. All existing WebMCP timings were taken with **no agent connected**, where
  `registerTool` **returns a `Promise` that resolves to `undefined`**; they measure renderer bookkeeping and
  nothing else. `durationMs` stays in the result files for debugging and stays out of the README.
  *(Corrected 2026-08-29. The earlier wording, "returns `undefined` synchronously", was graded MEASURED and
  is wrong on the installed binary: `Object.prototype.toString.call(r)` → `[object Promise]`, `await r` →
  `undefined`. The point it was making survives — no tool handle comes back, so `AbortController` remains
  the only revocation path, and these numbers remain page-cost only. But an amortised-registration loop
  that does not `await` is timing promise creation, not registration, so **E5 must not restate the µs
  figures as its own measurement**; it cites `FACTS.md` §2 with that qualifier or it says nothing.)*

---

## 11. E6 — CI against the deployed commit

### 11.1 The requirement

Evals run against **the deployed origin**, not the working tree. A green working tree proves nothing about
what a judge will open between 2026-09-04 and 2026-09-21.

> **E6 is feasible at all only because the WebMCP flag works headless — IR-16(c), and nobody had drawn
> this.** A GitHub Actions runner has no display. As long as the corpus believed the retracted IR-16(b)
> (*"`--headless=new` enables WebMCP with no flag"*), the defensive conclusion drawn from it was that every
> graded launch had to be **headed** so the flag assertion meant something — and a headed requirement puts
> the entire eval suite out of CI's reach, which would have forced E6 to be cut or downgraded to a
> hand-recorded run. **MEASURED 2026-08-28: the flag works under `--headless=new`, and with no flag the page
> API is `undefined` headless just as it is headed.** So headlessness never discriminated anything and the
> headed requirement bought nothing; what discriminates is the **flag**, and a no-flag negative control runs
> as well in CI as anywhere.
>
> Concretely, `eval.yml` launches Chrome with `--headless=new --enable-features=WebMCP` and a clean
> `--user-data-dir`, records `chromeMajor` / `flag` / `headless: true` in every result file, and runs the
> `noFlagPageApiAbsent` control in a second launch (§2.5.1). **Never grade the flag off CDP
> `WebMCP.enable`** — it returns `OK` with no flag and zero tools, which is exactly the mistake that
> produced IR-16(b); probe `typeof document.modelContext` in the page.

### 11.2 The predicate

E6's `accept`, copied verbatim from `graph.json`:

> The workflow's first step asserts `curl -s $URL/version` equals `git rev-parse HEAD` and fails the job
> otherwise, and fails if the response headers carry Origin-Agent-Cluster: ?0. Green run proven mechanically
> before D5: `gh run list --workflow eval.yml --json conclusion -q '.[0].conclusion'` equals `success`.

```bash
URL=$(cat evidence/D1-url.txt)
# 1. deployed commit == the commit under test.  The route is GET /version (server/routes/version.mjs, D1).
[ "$(curl -fsS "$URL/version")" = "$(git rev-parse HEAD)" ]
# 2. no header that silently kills WebMCP.  This is G-11, and it is also D1's acceptance.
curl -fsSI "$URL/" | tee evidence/headers.txt
grep -i '^origin-agent-cluster:' evidence/headers.txt | grep -q '?0' && exit 1; exit 0
# 3. the graded suites, against the deployed origin
node webmcp-eval-kit/bin/eval.mjs --suite capability --suite negative --url "$URL"
```

Two corrections this section carries. **The build-manifest route is `GET /version`**, produced by
`server/routes/version.mjs` (D1) — an earlier revision invented `GET /__buildinfo` with a per-file hash map,
a route no node produces and no predicate names. And **"a green run must be visible on the public repo's
Actions tab" is a human looking at a web page, not a predicate**; the `gh run list` form above is the
predicate. `evidence/headers.txt` is D1's own output, so the two nodes share one artifact rather than
writing two.

**E5 is a soft input to E6**: the accounting suite may be absent from CI and E6 records the absence.

### 11.3 Judging-window survival

D3 owns the unattended survival check (`tools/survive.mjs`, `evidence/survive.json`); lane E contributes the
probe. A scheduled workflow runs the capability suite against the deployed origin through 2026-09-21 and
asserts only two things, deliberately: the `S0-anon` surface digest still matches the digest pinned in
`erp/contracts/FREEZE.md`, and `GET /version` still reports the submitted commit. If S9's deterministic reseed
works, a restart is indistinguishable from a clean boot and this probe stays green across it. **Cut with E6.**

---

## 12. What this eval design deliberately does NOT measure

Stated as commitments, because each one is a place where a plausible-sounding metric would have made the
project weaker.

1. **Task accuracy / success rate.** We make no accuracy claim, and we cite no external accuracy data — the
   only public WebMCP two-arm results we know of come from a harness that injected its own bridge instead of
   using Chrome's WebMCP, so they are not evidence about anything we build (FACTS §8). Our reason for
   excluding accuracy is arithmetic, not comparative: see §10.2 — the sample size does not exist inside the
   deadline. We compete on invariants, which we can prove.
2. **Any two-arm comparison at all.** See §10.2 — the sample size does not exist inside the deadline.
3. **LLM-as-judge scoring.** A model grading model output introduces a second unvalidated instrument. The
   only model-in-the-loop instrument we keep is C1, and C1 is deliberately constrained to a *structural*
   question (can a blind agent construct the call?) with a pre-registered answer key, not a quality opinion.
4. **Latency, throughput, memory.** §10.3. The existing numbers were measured with no agent connected and
   the screenshot path is frame-quantized. There is no honest performance claim available in the time we
   have, so there is no performance row.
5. **Token savings.** §10.3 — the direction is *against* us.
6. **Security posture.** We test authorization invariants (N-03, N-04, N-05, N-06, N-15, N-17, N-18, N-19)
   and we publish one **`known-open`** row, N-16, which says in the results table that the sign gate does
   not establish personhood (§7.2.1). We do not claim a security property, do not use the phrase "security
   gate", and do not model a malicious client. The threat model is an **honest-but-careless agent** plus an *honest-but-fallible human*; a
   malicious client is out of scope and the server is the escalation path, not the tool surface.
7. **Comparison to any named competitor.** Our results table reports our own numbers only. Benchmarking
   against a competitor we cannot re-run fairly is how a submission acquires a claim it cannot defend. Note
   that must-fail negative controls in CI against a deployed commit are **parity, not lead** — at least one
   competing repo already does it.
8. **Anything about ChatGPT's built-in browser that V0–V4 have not answered.** V1 resolved 2026-08-29:
   `document.modelContext` is PRESENT on `https://webmcp-probe.onrender.com`. That licenses a claim about
   *that* origin in *that* client on Chromium 151 and nothing wider, and V1's node has not passed its own
   predicate (no `evidence/V1.png`). The harness still records only what it measured on the Chrome it drove.
   **The results table would have stayed valid either way — it is a Chrome result and says so in the header
   row.** That is the point of putting `chromiumMajor` and `chromeFlags` in every file. (The unknowns are
   keyed **`V0`–`V4`** plus **`V6-consent-gate`**, the first five matching the V-lane nodes that answer them; `T0`–`T4` is dead numbering and
   `T1`–`T4` are live tool-surface node ids meaning something else.)

---

## 13. E7 — the README results table, columns fixed in advance

**These columns are frozen now, before any number exists.** E7's `accept`, copied verbatim:

> `node tools/check-results-table.mjs` exits 0: the README table's row count equals the suite count in
> evals/latest.json and every number in the table matches the JSON. The published Bytes column is canon()
> wire bytes; the export's `accounting` block is an internal cross-check and is labelled as such wherever it
> is shown, never mixed into the same column.

Columns may not be added, removed or reordered after a run without a PM-adjudicated deviation — which is the
whole point: the numbers cannot be chosen after seeing them.

**Table 1 — surface by application state** (source: `evals/accounting.json`) — **six rows, not seven.**

| State | Tools | Read-only | Bytes | Tokens ≈ | Max desc | Surface digest (first 12) |
|---|---:|---:|---:|---:|---:|---|
| `S0-anon` | | | | | | |
| `S1-emp-home` | | | | | | |
| `S2-emp-draft-clean` | | | | | | |
| `S3-emp-draft-dirty` | | | | | | |
| `S4-emp-submitted` | | | | | | |
| `S5-aud` | | | | | | |

Footnote, mandatory, verbatim: *Bytes are OCF-1 canonical wire bytes (`CONTRACTS.md` §3), the single
serializer used everywhere in this project. Tokens are `ceil(bytes/4)` — an estimate, computed with no model
call and no tokenizer. The export's `accounting.total_bytes` is a different, smaller quantity and is an
internal cross-check only.*

**Table 2 — negative controls** (source: `evals/latest.json`)

| ID | Must-fail case | Refused by | Status | Over the wire | Proving node | Flips under `brokenBy` | Result |
|---|---|---|---|---|---|---|---|
| N-01 … N-21 | | browser / server / page | | yes / no / n-a | | yes / no / n-a | `enforced` / `not-runnable` / `known-open` |

**The Result column prints the case's `controlStatus` and nothing else, so its three values are the frozen
enum — `enforced`, `not-runnable`, `known-open` — and `refused` is not among them (R-27, §7.1).** An earlier
revision of this template offered `refused` here; that was the *report* vocabulary of §7 leaking into a
column that carries a schema value, and a run emitting it would fail `eval-case.schema.json`. The
per-case `outcome` field inside `evals/latest.json` keeps its own vocabulary and is a different field; this
column never copies it.

Footnotes, mandatory: *Every row must read `enforced` except the two `not-runnable` rows (N-08, N-09) and
the one `known-open` row (N-16). A row reading `passed` is a failed run, not a good number.* And: *Every
`enforced` row must read `yes` under `Flips under brokenBy` — a control that cannot be broken on purpose is
not a control (E10).* Rows whose proving node is cut, or which are `not-runnable`, are shown with that word
and never as `enforced`.

**The `known-open` row is published, not footnoted away.** N-16 carries, verbatim in the table: *the commit
succeeds; a POST to `/api/sign/{request_id}/respond` from the authenticated session is the only thing the
gate requires, and it does not establish that a human decided* (§7.2.1). When the `confirm_token` lands — **S5, Day 3**, a scheduled change (R-34) — the
row flips to reporting a refusal — `controlStatus: "enforced"`, R-27 — and the caption changes with it — **the caption never says "closed"**, because
against a caller that can read the dialog's DOM it is not — and V3 measured cookie carriage only, so
whether this client is such a caller is **unmeasured**, not settled either way (R-44).

**Table 2b — guards** (source: `evals/latest.json`) — a separate table, on purpose.

| ID | Guard | Result |
|---|---|---|
| G-10, G-11, G-13, G-14 | | pass / fail |

Footnote, mandatory: *Guards are regression lints, not negative controls: nothing in the product can make
them fail today. They are listed separately so that Table 2's "every row must read `enforced`" means what it
says.*

**Table 3 — blind grading** (source: `evals/blind/C1-verdict.json`)

| Freeze | Tasks with correct first tool | Args constructible | Gate G | R1 | R2 | R3 | R4 | R5 | R6 | Total /12 |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|

Footnote, mandatory: *Graded by a Codex session given only the exported tool surface and eight task
statements — no repository access, a hermetic `CODEX_HOME`, and a brief that contains none of the criteria
being graded. Counts, not rates.*

**Table 4 — environment** (source: any result header)

| Chromium major | Chrome flags | Mode | Net denial | Commit | Deployed commit | Captured at |
|---|---|---|---|---|---|---|

**Prohibited in all four tables:** any percentage, any comparison to another project, any latency column,
any cell computed by a model, and any column added after the first run.

---

## 14. Open dependencies lane E cannot resolve alone

| Depends on | Why lane E is blocked without it | Fallback if it stays unresolved |
|---|---|---|
| **H2** reachability gate (§2.5) | **Reachability is now MEASURED green on Chrome 152 (2026-08-29) and this dependency is downgraded from existential to regression.** What replaced it: the harness must execute through CDP `WebMCP.invokeTool`, because `Runtime.evaluate` cannot call a tool by name (§2.3). If a future Chrome removes the CDP domain *or* the page API, lane E has no admissible mode | **none.** §2.3 forbids grading against a fake bridge. PM hears a red gate on **Day 1**, not Day 4 |
| **H2 / graph.json accept text** | H2's `accept` in the authority still specifies `Runtime.evaluate` + `getTools().length === 1` + `--exec whoami`, which is **unsatisfiable as written** (§2.3). Lane E cannot edit `graph.json` | replacement predicate handed to the `graph.json` owner this round; until it lands, §2.5.1 is what the seat executes, and the divergence is declared, not silent |
| **S11** OCF-1 canonicaliser | `canon.mjs` is a port of it; without S11 there is no definition to port and no vectors to verify against | none — E1 cannot start |
| **T5** blind export | E2, E4, E5 and E8 all have no input | none — E4/E8 are cut with the lane |
| **T3** absence-register naming | `explain_missing_tool` is written into T3's accept; a rename moves in the T3 commit | fixture updated in the T3 commit, with the trailer |
| **T6** red-test fix | `S5-aud` expectation is red *by design* until it lands | table 2 ships with the red row visible and a one-line note; **do not hide it** |
| **S1/S2** server + per-request auth | `overTheWire(403)` cannot be satisfied by a client-side refusal | N-03/N-04/N-17/N-18/N-19 fail loudly; that is the correct outcome, not a harness bug |
| **S5/S6/S12** sign-gate state machine | N-05, N-06, N-15 and N-16 have no mechanism to exercise | N-05/N-06/N-15 read `not-runnable` and the first forgery stands until they land. **N-16 does not become safe when they land** — it reads `known-open` afterwards and flips only if the `confirm_token` ships (§7.2.1) |
| **`--disable plugins` in E8's `accept`** (`graph.json`) | without it C1's prompt carries the ~3.7 KB `<recommended_plugins>` catalog, which `blind-home.sh --verify` cannot see, so the blind run is not byte-reproducible (§1.1.1) | run as frozen and **declare** it: §8.5 records the prompt byte count and whether the block was present. Lane E does not edit the accept; **PM/L1's one-token call** |
| **H1** launcher | the flag per scenario is asserted at the launcher, not by the kit | none |
| **V1** modelContext in ChatGPT's browser | scope of every published claim | header row already scopes results to Chrome; see §12.8 |
| **D1** deploy | E6 and E9 have no target; G-11 cannot run | E6 is cut 2; a manually recorded run plus `evidence/headers.txt` substitutes |
| **a test-kit endpoint** | N-08 and N-09 have no mechanism, and there is no node that produces one | both read `not-runnable` (§5). Adding it is a `PATHS.md` row plus a funded `graph.json` node — **PM's call** |
| ~~**`erp/RUBRIC.md`**~~ | **CLOSED, R-16.** It is now an **L0 output** (+0.5 h) and sits in `PATHS.md` §2.8. L2's rulings cite a clause in a file that a funded node produces; this row stops being an open dependency | — |

---

## 15. Checklist for the seat that executes this file

```
[ ] H2 reachability gate green, WITH --enable-features=WebMCP. Headless is
    ALLOWED (IR-16(b) retracted 2026-08-28: headless with NO flag gives
    undefined, so headless is not a substitute for the flag; the old
    "must be headed" line is withdrawn): getTools/executeTool reachable;
    1 registered tool -> (await getTools()).length === 1 -- the await is
    load-bearing; AND WebMCP.enable succeeds, toolsAdded names the tool,
    and one invokeTool round trip returns toolResponded Completed       §2.5.1
[ ] the no-flag NEGATIVE CONTROL ran: a second launch with no feature flag
    where typeof document.modelContext === "undefined". This, not
    headedness, is what proves the flag matters. Never grade the flag off
    WebMCP.enable -- it returns OK with no flag and zero tools           §2.5.1
[ ] evidence/H2-reachability.json carries chromeMajor, flag, headless
    (free -- true is fine), pageApiReachable, cdpDomainEnabled (vacuous,
    a launch record only), toolCount, invokeToolRoundTrip,
    noFlagPageApiAbsent                                                 §2.5.1
[ ] E6 runs the same suite headless in CI with the same flag and the same
    fields, headless:true -- feasible ONLY because of IR-16(c)          §2.5.1
[ ] no suite executes a tool through Runtime.evaluate; execution is
    WebMCP.invokeTool, and Runtime.evaluate is feature-detect + page state §2.3
[ ] four Codex profiles exist AND their banners show the intended effort        §9.2
[ ] the redteam and evaluator commands carry
    -c sandbox_workspace_write.network_access=true; the blind run does NOT      §9.3
[ ] every Codex command ends with < /dev/null                                   §9.3
[ ] tools/blind-home.sh --verify exits 0: auth.json + a two-key config.toml,
    no AGENTS.md, no [hooks], no [mcp_servers], no [plugins]                    §1.1
[ ] the blind run uses CODEX_HOME=$BH and NO -p flag                            §8.4
[ ] make-blind-packet.mjs exits 1 if the brief names any graded criterion       §1.1
[ ] blind packet builds with exactly 2 files, outside any git tree              §8.2
[ ] canon.mjs reproduces all SEVEN vectors in
    erp/contracts/canonical-vectors.json                                        §6.1
[ ] the revoked write set is COMPUTED from annotations.readOnlyHint !== true,
    never hard-coded; it is SEVEN in S2-emp-draft-clean, and no document
    anywhere says "the five write tools"                                        §6.5
[ ] no byte figure is published until E5 computes it under OCF-1                §6.2
[ ] surfaces.expected.json pre-registered BEFORE the first run                  §6.4
[ ] every capability state has a non-empty pair set; the runner builds the map
    from pairsWith and fails on any empty one                                   §7
[ ] every must-fail case declares provingNode AND a one-line brokenBy           §7.1
[ ] --verify-controls flips every must-fail case; none survives its mutation    §7.1
[ ] N-15 neg-commit-without-human returns 409 E_NOT_SIGNED, and the claim it
    proves is "no commit without a POST to /respond" — NOT "without a human"    §7.2.1
[ ] N-06 asserts 404 E_SIGN_REQUEST_UNKNOWN (not 409) and its brokenBy is the
    one that actually flips it                                                  §7.2
[ ] N-16 neg-respond-without-click is in the suite, recorded known-open, and
    fails the run if the outcome changes silently in EITHER direction           §7.2.1
[ ] no document says "a commit cannot be made without a human decision" and no
    result file carries a forgeryClosed flag                                    §7.2.1
[ ] erp/charters/C3.md names "POST /api/sign/{request_id}/respond yourself" as a
    standing target, and "prove that closure" is gone (E9 greps for both)       §7.4
[ ] guards are in their own table, not counted as negative controls             §7.3
[ ] overTheWire() asserts BOTH a status and an actual network event             §7
[ ] accounting runs under node --import ./test/no-net.mjs — the ./ is
    mandatory, a bare specifier throws ERR_MODULE_NOT_FOUND — and the header
    records which denial mechanism ran                                          §10.1
[ ] the blind run's rendered prompt byte count is recorded, with whether
    <recommended_plugins> was present                                     §1.1.1, §8.5
[ ] E6 asserts GET /version == git rev-parse HEAD (there is no /__buildinfo)    §11.2
[ ] README tables regenerate byte-identically from the result JSONs             §13
[ ] no percentage appears anywhere in the README results section                §13
```
