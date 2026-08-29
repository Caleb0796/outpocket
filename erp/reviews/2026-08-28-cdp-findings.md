> **CORRECTION, measured by the session owner 2026-08-28 on Chrome 152.0.7977.64.**
> Item 8 below — "`--headless=new` enables WebMCP with no flag at all" — is **FALSE**.
> Three launches, `--headless=new`, a clean dedicated `--user-data-dir` each time,
> page served over `http://localhost`:
>
> | launch | `typeof document.modelContext` |
> |---|---|
> | no flag | **`undefined`** |
> | `--enable-features=WebMCP` | `object`, `registerTool` succeeds |
> | `--enable-features=WebMCPTesting` | `object`, `registerTool` succeeds |
>
> The flag is required in every launch mode. Item 6 (the two flag names are
> interchangeable) **is** confirmed. The likely source of the error: `WebMCP.enable`
> over CDP returns OK even in a launch with no page API at all, so a probe that
> reads the CDP domain instead of the page API reads "on" when it is off.
>
> Everything else in this report reproduced under independent re-measurement.

**ESTABLISHED BY EXECUTION** (Chrome 152.0.7977.64, dedicated `--user-data-dir`, page on `http://localhost:8731`, python `websockets` over a page-level CDP socket; ~20 launches):
1. The CDP **`WebMCP`** domain is real but **`Schema.getDomains` never lists it** (35 domains, no entry) — feature-detect via `-32601 "'Bogus.enable' wasn't found"` vs `WebMCP.enable → {}`. `enable` is a hard precondition: `-32000 "WebMCP domain is not enabled"` otherwise, and after `disable`.
2. `invokeTool{frameId,toolName,input}` — `input` must be an **object** (JSON string → CBOR deserialize error). **Its result is `{invocationId}` only**; output arrives on `toolResponded`. Unknown name → `-32602 "Tool not found"`.
3. All four events fire. `toolsAdded` carries `{name,description,inputSchema,annotations,frameId,stackTrace}` and spells annotations **`readOnly`/`untrustedContent`**, not the page's `…Hint` names. `toolResponded.status` ∈ Completed/Error/Canceled; **on Error `errorText` is `""`** and the message is in `exception.description`. `toolsRemoved` fires per tool on `abort()`. Page-side `executeTool` also emits both events.
4. `cancelInvocation{invocationId}` → `{}`, `toolResponded status:"Canceled"` immediately; **the page's `execute` keeps running** (`ended` stayed 0), `opts` has **zero own keys** so no `AbortSignal` reaches the page, and when the page later resolves, **no further event fires**. It releases the *caller*, bounds client exposure, and repairs nothing about IR-7. Unknown id → `-32602 "Invalid invocation id"`.
5. Page JS **is** reachable: `getTools`/`executeTool` are functions under `--enable-features=WebMCP` with no agent.

**CORRECTIONS to the auditor (three, all reproduced repeatedly):**
6. **`--enable-features=WebMCPTesting` DOES expose the CDP domain and `invokeTool` works under it** — verified twice, headed, fresh profiles. Does not reproduce as stated.
7. **`executeTool` is not unusable — the second argument must be a JSON *string*.** `executeTool(descriptor, JSON.stringify(args))` succeeds (plain-object descriptor copy works too); `{}`/`null`/`[]`/`Map` all give `UnknownError: Failed to parse input arguments`. By-*name* is genuinely impossible. Also: **`getTools()` returns a Promise** — `.length` is `undefined`, so `=== 1` is unsatisfiable and `!== 0` passes against an empty surface.
8. **`--headless=new` enables WebMCP with no flag at all**; headed+no-flag is the only empty surface. A headless flag test proves nothing.
9. Also measured: `invokeTool` returns the **identical** `-32602 "Tool not found"` for revoked and never-registered — N-01 may not claim the browser distinguishes them. And `input:{"bad":1}` against `additionalProperties:false` → `Completed`, args verbatim (IR-10 holds on both channels).

**WRITTEN IN:** `FACTS.md` new §1.4 with IR-17/18/19/20 (MEASURED 2026-08-29), IR-16 rewritten and its "known gap" closed, IR-7 reinforced on 152, IR-1 advance reading for V0, §2 `getTools` row and ERR-2 corrected, §5 settled, five new rows in §9 retractions, count 18→22. `EVAL.md` §2.2.5/§2.3 rebuilt around the CDP channel with a six-row instrument table (`Runtime.evaluate` retained for feature detection and page state), §2.5 turned into a regression gate + new §2.5.1 evidence schema, N-01/N-02 and their follow-up paragraph fixed, §14 and §15 updated. `charters/I1.md` H1/H2/H3 and the iron-rules paragraph. `charters/C4.md` rules 3/5/10 plus a new non-numbered "How a tool is actually invoked" block (12-item count preserved) and `HEADLESS`/`CHANNEL` in the output format.

**ALSO CORRECTED:** `registerTool` returns a **Promise resolving to `undefined`** (`[object Promise]`, `await r → undefined`) — fixed at FACTS ERR-2, EVAL §10.3, I1; conclusion survives, grade did not, and a non-awaiting timing loop measures promise creation. E5's "zero model calls" needed no change — I re-ran the `--import` proof: bare specifier → `ERR_MODULE_NOT_FOUND`, `./`-prefixed → `hook loaded / kit ran`, Node v22.23.1. Blind-home: base prompt re-measured **32,247 B** today vs 32,363 B and 32,359 B on 2026-08-28 — third value in two days; EVAL §1.1.1 now labels the table a reading and FACTS §"C1's blindness" no longer publishes a rival pair (it also said ~4.5 KB where EVAL said ~3.7 KB; now consistent). `$BH` row not re-measured — it needs copying `auth.json` and I did not.

**HANDOFF — H2 accept (replace verbatim):**
`FIRST HOUR, gating everything else: HEADED Chrome (never --headless=new, which enables WebMCP with no flag) under --enable-features=WebMCP with no agent attached: CDP Runtime.evaluate reports typeof document.modelContext.getTools === 'function' AND typeof document.modelContext.executeTool === 'function' AND (await document.modelContext.getTools()).length === 1 on a page registering exactly 1 tool — the await is load-bearing, getTools() returns a Promise and .length is undefined; AND WebMCP.enable returns without error, one WebMCP.toolsAdded event names that tool, and one WebMCP.invokeTool round trip yields a WebMCP.toolResponded with status Completed — recorded in evidence/H2-reachability.json as {chromeMajor, flag, headless:false, pageApiReachable, cdpDomainEnabled, toolCount, invokeToolRoundTrip}. THEN: node harness/drive.mjs --url $(cat evidence/V5-origin.txt) --list prints 5 tool names and exits 0, enumerated from WebMCP.toolsAdded after WebMCP.enable, not from Runtime.evaluate; --exec whoami issues WebMCP.invokeTool{frameId,toolName,input} with input as an OBJECT and prints the content block carried by the matching WebMCP.toolResponded (invokeTool's own result is {invocationId} only) and exits 0; --exec no_such_tool exits 2 with a nonzero-only stderr message carrying CDP error -32602 "Tool not found".`

**HANDOFF — V0 accept (replace verbatim):**
`node harness/probe-v0.mjs writes evidence/V0.json containing {chromeMajor:int, navigatorAlias:bool, documentPresent:bool, flag:string, headless:false, method:'cdp'} and exits 0. chromeMajor must equal the major reported by the installed binary; both booleans must be obtained via CDP Runtime.evaluate on a live page, never from a user-agent string; and the launch must be HEADED, because --headless=new enables WebMCP with no flag and would make documentPresent true regardless of the flag under test. The probe records what it finds and exits 0 either way; it fails only if it cannot obtain both booleans over CDP.`

**ALSO FOR THE GRAPH OWNER (not mine to edit):** H1's `notes` assert "the flag name differs by scenario … getting this wrong produces a silently toolless page" — **false as measured**; suggest `HANDOVER §3 rule 16 is superseded: FACTS.md IR-16 (MEASURED 2026-08-29) — both flags work and --headless=new needs none; only headed-with-no-flag is toolless. The scenario split is a house rule, and the launcher test asserts our configuration, not browser behaviour. Hours unchanged.` H1's `accept` itself needs no change. `PLAN.md:692` and `GRAPH.md:230` restate H2/V0 verbatim and must move with them; `RISK.md:437` restates V0's predicate; the old flag split also survives in `RISK.md`, `PLAN.md`, `GRAPH.md`, `charters/K1.md`, `C2.md`, `C3.md`, `I4.md`, and 5 places in `graph.json`.

**DID NOT REPRODUCE:** the auditor's "`--enable-features=WebMCPTesting` does not expose it" (it does), and "cannot execute a tool at all" (page JS can, with a descriptor and stringified args — only *by name* is impossible). Not attempted: the `$BH` blind-home byte row (blocked, requires copying credentials); ChatGPT built-in browser behaviour (IR-14 says it cannot be driven by CDP, and no V-lane probe is in scope this round).