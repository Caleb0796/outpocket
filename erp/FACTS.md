# FACTS.md — Carried-Over Ground Truth for `outpocket`

> **Purpose.** This is a lookup table, not an essay. Everything here was already
> established by four adversarial review rounds plus a full competitive census
> ending 2026-08-28. **No session may re-run this research.** If you find
> yourself about to open a browser to check a WebMCP API detail, check this file
> first; if the answer is here, use it.
>
> **This file is not an authority.** `erp/graph.json` and `erp/PATHS.md` are the
> only two, and `graph.json.authority` says so: *"This file and erp/PATHS.md are
> the ONLY authorities. graph.json owns node identity, owner, inputs, outputs,
> accept, hours, cut, horizon AND — new in v2.1.0 — the calendar, in
> capacity.schedule_A. erp/PATHS.md owns every literal path, filename and command
> name. Every other document in erp/ QUOTES these two and never restates them."*
> Where this file names an hour, a day, a path or a command, it is quoting. On
> any disagreement the authority wins and this file is regenerated. What this
> file **does** own is the evidence: the API rules, the measurements, the census,
> the poison list, the retractions.
>
> **Provenance.** Compiled 2026-08-28 from `~/mcp/countinghouse/HANDOVER.md`
> (§1, §3, §5, §6, §7, §8, §10) and `~/mcp/gatehouse/BUILD.md` §2. **Rebuilt
> 2026-08-28 against `graph.json` v2.1.0** under ruling R-14, because the
> previous repair pass never opened this file (`stat` put `FACTS.md` at 17:38:04,
> before the reviews at 18:09 and before every sibling repair at 18:37–18:57), so
> every finding whose site was here was open by construction.
>
> **Hard rule inherited from the assignment.** No new web research for this
> document. Any fact added later must carry a date and an evidence grade.

## 0. How to read the evidence grades

| Grade | Meaning | What you may do with it |
|---|---|---|
| **MEASURED** | We ran it on this machine and observed the result. Date given. | Build on it. Re-verify only if the browser major version changes. |
| **PUBLISHED** | Stated in a vendor's public document or a public repo we read. | Cite it. Quote sparingly. |
| **VENDOR-CLAIMED** | A vendor asserts it; we did not verify. | Never load-bearing on its own. |
| **OUR-ESTIMATE** | Our arithmetic or judgement. | Label it as an estimate in any external text. |
| **UNVERIFIED** | Reported somewhere, contradicts or extends something we measured. | Treat as an open unknown; see §7. |

Where a fact's grade is not stated inline, it is **MEASURED on 2026-08-28**
unless the row says otherwise.

**Two grading rules that this project has broken before, so they are written
down as rules:**

**G-RULE-1 — a grade attaches to the sentence it is on, and to nothing
downstream of it.** "Our scanner matched once in 623 repos" is MEASURED. "This
is therefore rare" is an inference and is at best OUR-ESTIMATE. The corpus has
twice carried the grade across the inference; §4 and §10 both mark where.

**G-RULE-2 — no rarity claim may rest on a keyword count.** `RISK.md:262-265`
makes this binding: *"no claim of the form 'nobody has done X' may be written
until X has been re-tested by concept, with at least three distinct vocabulary
variants, and the search terms and hit counts recorded. If the re-test is not in
the record, the claim does not go in the document."* **This project has been
wrong about keyword-derived emptiness three times** (see §8). No such re-test
exists anywhere in `erp/` today, for any claim.

---

## 1. WebMCP API iron rules

**Eighteen rules: IR-1 … IR-16, plus IR-16b and IR-16c.** Every one was measured
locally between 2026-08-26 and 2026-08-28 unless marked. Each row states the
**consequence for outpocket** — that column is the reason the rule is in this
file.

> **The count "sixteen" is stale wherever it names *this* list.** `TEAM.md:467`
> ("the **sixteen** iron rules") and `charters/K1.md:67` ("Seed
> `kb/webmcp/RULES.md` from the **sixteen** iron rules") both point at the
> HANDOVER list, which really does have exactly sixteen numbered items. This
> file has eighteen, because IR-3, IR-5, IR-13, IR-16b and IR-16c were added
> here and two HANDOVER items were promoted out to §3 and §5. Both statements
> can be true; neither may be used to check the other. See the crosswalk below.

### 1.0 The iron-rule numbering crosswalk — read this before citing "iron rule N"

**There are three incompatible numberings of "the iron rules" in circulation,
and sibling documents cite all three.** Grade: MEASURED 2026-08-28 (I read the
citing lines and the cited lists).

- **HANDOVER `§3` rules 1–16** — Chinese, sixteen items. This is what
  `GRAPH.md:325` ("iron rule 6 — there is no binary channel"), `GRAPH.md:427`
  ("`onrender.com` … PSL, MEASURED, iron rule 14"), `GRAPH.md:381` /
  `EVAL.md:396` / `EVAL.md:960` ("the byte figures … iron rule 10") and
  `GRAPH.md:385` / `EVAL.md:955` ("iron rule 15") all mean.
- **This file's `IR-n`** — twenty-two items, reordered by topic. `IR-6` here is
  the iframe rule, not the binary-channel rule.
- **The Codex charters' own 12-item block** (`charters/C2.md:73`,
  `C3.md:74`, `C4.md:78`, and the reduced 4-item block in `C1.md:74` after the
  answer-key leak was closed). Its "rule 10" is the CDP flag; a review at
  `reviews/2026-08-28-eval-realism.md:128` cites a *different* "rule 10"
  ("descriptions must not encode workflow order") from the pre-reduction C1
  block.

**Verified pairs, so nobody re-derives them:**

| Cited as | Means | Is `IR-` here |
|---|---|---|
| HANDOVER rule 6 | no binary channel | **IR-12** |
| HANDOVER rule 10 | tool-surface byte figures | **§3**, not an IR at all |
| HANDOVER rule 14 | public-suffix-list / origin-trial trap | **IR-9** |
| HANDOVER rule 15 | dynamic surface punches the prefix cache | **IR-15** *(the one number that coincides)* |
| HANDOVER rule 9 | spec instability, `webmcp.idl` disagreement | **§5**, not an IR at all |

**Operational instruction:** when you write a cross-reference, write
`FACTS §1 IR-12`, never "iron rule 6". When you *read* one, check which list the
citing file belongs to before you act on it. This is a live source of
mis-citation, not a tidiness note.

### 1.1 Surface and lifecycle

**IR-1 — `document.modelContext` is the only entry point.**
Grade: MEASURED 2026-08-28. `navigator.modelContext` was removed in Chromium
150. There is an UNVERIFIED report that it survives on Chrome 151 as a stale
alias. Consequence: outpocket calls `document.modelContext.registerTool(def,
{signal})` and nothing else. **Node V0 settles the alias question on the
*installed* major, which is Chrome 152.0.7977.64 (MEASURED 2026-08-28) — 151 is
not present on this machine, so "does it survive on 151" is a question nobody
here can answer and V0 no longer asks it.** Until V0 closes, do not write a
`navigator.modelContext` fallback and do not write a claim that it is gone.

> **Advance reading, 2026-08-29 (MEASURED), which V0 must still reproduce under
> its own predicate:** on Chrome 152.0.7977.64 launched **headed** with
> `--enable-features=WebMCP`, `typeof navigator.modelContext` is `undefined`
> while `typeof document.modelContext` is `object`, on the same page in the same
> evaluation. This is one probe on one machine and it does not close V0 — V0's
> value is the recorded evidence file. **V0's launch may be headless** (IR-16(c),
> corrected 2026-08-28): the earlier "must be headed" requirement rested on the
> retracted IR-16(b). What V0 must carry is the **flag** — `documentPresent`
> under `--enable-features=WebMCP`, and `documentPresent === false` in the
> no-flag negative control — and it must probe `typeof document.modelContext`
> in the page, never a CDP `WebMCP.enable` result, which returns `OK` regardless.
V0 runs **Day 1** (`graph.json.capacity.schedule_A.days["1"]`), moved from Day 3
under R-19 because both its consumers preceded it.

**IR-2 — `provideContext()`, `unregisterTool()`, `clearContext()` are all
dead.** Grade: MEASURED 2026-08-28. The only way to remove a tool is to abort
the `AbortController` whose signal was passed at registration. Consequence: the
whole of lane T is built on one `AbortController` per tool (or per tool group);
there is no other revocation path to fall back on, and no tutorial that shows
one is current.

**IR-3 — The tool definition shape is exactly
`{ name, description, inputSchema, annotations, execute(args, opts) }`.**
Grade: MEASURED 2026-08-28 (gatehouse lab). Consequence: the surface compiler
ported in **T1** must emit this shape and no other key. A stray key is silently
ignored, which is worse than an error. **It is five keys, and `annotations` is
one of them** — C1 grades `readOnlyHint` honesty (rubric R6) and cannot do that
from a three-field view of a tool.

**IR-4 — `outputSchema` does not exist. Annotations are only `readOnlyHint`
and `untrustedContentHint`.** Grade: MEASURED 2026-08-28. Consequence: **T4**
conformance is a two-key whitelist. Any structure in a tool result must be
carried in the result text itself, because there is no schema channel to
declare it. Note the WPT IDL additionally lists `consequentialHint` — see §5.

**IR-5 — Registration cost is negligible; revocation is ~30× cheaper still.**
Grade: MEASURED 2026-08-28, Chrome 152, `--enable-features=WebMCPTesting`.
Amortised `registerTool` 36.9–37.9 µs/tool; 13 tools p50 0.5 ms, p95 1.0 ms;
zero long tasks. `AbortController` revocation 1.1–1.2 µs/tool, and `getTools()`
was observed dropping from 1 to 0 after abort. Consequence: never argue that
outpocket's dynamic surface is "cheap because registration is fast" — that is
true and irrelevant; the real cost is prefix-cache (IR-15). But it does mean
the 1→5→12→13 flips in **T2** are free at the render-process level. **Read the
qualifier in §2 ERR-2 before quoting any of these numbers.**

### 1.2 The rules that break things silently

These five are the ones that produce a working local build and a dead demo.

**IR-6 — Tools register only in the top-level document.**
Grade: MEASURED 2026-08-28 (gatehouse A-line). The ChatGPT built-in browser
discovers **no** tool registered inside an iframe — same-origin or cross-origin,
no difference. Consequence, load-bearing: any outpocket design that puts the
receipt preview or the signature panel in an iframe and registers a tool there
**fails silently**. **T1** is specified as "top-level document only". If a
sandboxed iframe is ever used, it may execute code but must never call
`registerTool`.

**IR-7 — Revocation does not cancel an in-flight `execute`.**
Grade: MEASURED, Chrome 153 behaviour, 2026-08-28. Aborting the signal blocks
the **next** call; it does not interrupt the call that is currently running.
Consequence, load-bearing on kernel ④: the human-sign gate in **S5** must never
be described or implemented as "revocation blocks the write". The gate is a
*suspended* `execute` plus **server-side** re-canonicalisation (**S6**). Copy in
**F4** and in the video script (**D4**) must be precise about this. Writing
"deregistering the tool prevents the write" is a factual error a judge can
reproduce. `RISK.md` BW-22/23/24 lint the three spellings.

> **Reinforced on the installed major, and it survives contact with the one
> API that looked like a way out.** MEASURED 2026-08-29 on Chrome
> **152**.0.7977.64: `execute(args, opts)` is called with an `opts` object that
> has **zero own keys** — there is no `AbortSignal` in it — so a running
> `execute` cannot be told to stop by any means, abort or otherwise. The CDP
> `WebMCP.cancelInvocation` (IR-19) releases the *caller* and reports
> `status:"Canceled"`, and the page's `execute` keeps running to completion with
> its result discarded. IR-7 is therefore not a 153-only property to be waited
> out; **on 152 the page-side situation is strictly worse**, because there is no
> signal at all. Do not write "cancellation stops the call" in any layer.

**IR-8 — An `Origin-Agent-Cluster: ?0` response header silently kills WebMCP.**
Grade: MEASURED 2026-08-28. Consequence: **D1** is not a formality. After
deploy, dump every response header and assert the string is absent. This is a
header the *host* may add without you asking. Related: if a CSP is set at all,
`script-src` must include `'wasm-unsafe-eval'` (outpocket uses no WASM today,
but any sandbox addition makes it mandatory), and COOP/COEP and
`frame-ancestors` can only be set via response headers, never via `<meta>`.

> **The test is `?0`, not "the header".** `Origin-Agent-Cluster: ?1` is the
> opposite setting and is harmless. Both **D1** and **V5** now carry the correct
> predicate — quoting `graph.json` V5 `accept` verbatim:
> `grep -i '^origin-agent-cluster:' evidence/V5-headers.txt | grep -q '?0' && exit 1; exit 0`
> — *"the header must be absent, or present with a value that is not ?0."* The
> earlier `grep -ci … returns 0` form was doubly broken: it failed on a benign
> `?1`, **and** `grep -c` printing `0` exits **1**.

**IR-9 — The public-suffix-list domain trap blocks origin-trial tokens.**
Grade: MEASURED/PUBLISHED 2026-08-28. `pages.dev`, `vercel.app`,
`netlify.app`, `github.io`, `chatgpt.site` and **`onrender.com`** are all on the
public suffix list, so no subdomain token can be issued. Consequence: the
"plain Chrome with no flag just works" path requires a domain we own. **But the
origin trial is a bonus, not a deadline risk** — judges reach the page either
through the ChatGPT built-in browser or through a Chrome flag, and both bypass
the token entirely. **D2 is explicitly non-blocking. Do not let it sit on the
critical path.** The trial itself is ACTIVE, self-serve with no approval,
Chrome 149–156, through 2026-11-17, and multiple tokens on one page are allowed
(PUBLISHED).

> **This rule does not constrain V5, and R-18 settles that in the authority.**
> `graph.json` V5 `notes`: *"a FREE Render instance on a `*.onrender.com`
> subdomain, in the same Render account D1 uses, created and deleted inside
> Sprint A. Public-suffix-list membership is irrelevant here — `onrender.com` is
> on the PSL … but V5 mints no origin-trial token and D2 is the only node that
> ever wanted one."* Two accepted costs, also from the authority: the probe needs
> `GET /whoami` to echo a cookie, **so it is a free Web Service and not a Static
> Site**; and the free tier sleeps after 15 idle minutes, which is harmless
> because V1–V4 are attended, single-sitting probes. V5 runs **Day 0**.

**IR-10 — The browser does not validate arguments against `inputSchema`.**
Grade: MEASURED + PUBLISHED 2026-08-28. The browser does two things only: parse
a JSON string, and check "is it an Object". Then it hands the value to the page
callback. Chrome's own guidance: *"Validate strictly in code, loosely in
schema."* Consequence, load-bearing: every validation guarantee outpocket makes
is **page-enforced, not browser-enforced**, and must be phrased that way. See
the retraction of "no binary channel = structural guarantee" in §9. **S2/S4**
must validate server-side, and the curl-level privilege tests in **S2** exist
precisely because the schema is decorative. **This rule is why the surface is a
menu, not a lock**, and it is the substantive reason — not merely the lint
reason — that §1.3's cache-trade sentence was rewritten.

### 1.3 Budgets, environments, flags

**IR-11 — Description ≤500 chars and single output ≤1500 chars are official
*recommendations*, not enforcement.** Grade: PUBLISHED 2026-08-28. Consequence:
**G4** lints description length at 500 as a hard local rule anyway (a
mechanically checkable proxy for surface discipline), and **T4** owns the
budget. Tool output must be truncated by us; nothing truncates it for us.

**IR-12 — There is no binary channel.** Grade: MEASURED 2026-08-28. A
third-party agent cannot deliver an image or a PDF into the page. Consequence:
**F3** — receipt upload is a human-only channel; the agent may only link an
already-existing receipt id. **Phrase this as a product decision we enforce in
page code, not as a browser-level guarantee** (§9, row 5).

**IR-13 — Workflow control must not live in tool descriptions.**
Grade: MEASURED/PUBLISHED 2026-08-28. "Call A before you may call me" does not
work. The registration state machine is the mechanism. Consequence: **T2** and
**T3** carry the workflow; **G4**'s banned-wording list should catch
description text that tries to sequence calls in prose.

**IR-14 — ChatGPT desktop built-in browser preconditions.**
Grade: MEASURED/PUBLISHED 2026-08-28. Requires GPT-5.6 **Sol or Terra** —
**Luna has WebMCP disabled**. Not available in Enterprise/Edu workspaces. No
declarative API. No iframe registration (= IR-6). **It cannot be driven by
CDP** — every V-lane probe against it is attended and manual, which is why V1 is
human-gated. Enable at Settings → Browser → Permissions → Enable site tools;
open with Cmd+Shift+B; the address bar needs the full `http://` prefix typed.
Consequence: **H5**'s first-screen banner must name the model requirement,
because a judge on Luna sees a page with zero tools and no error. H5 runs
**Day 2** and now takes a hard input from L0 (R-19/R-15).

**IR-15 — A dynamic tool surface punches through the prompt prefix cache.**
Grade: MEASURED/OUR-ESTIMATE 2026-08-28. Each surface flip triggers roughly
**1.25× cache write**. Consequence, load-bearing on messaging: **you may not
claim "a stable prefix saves tokens" — the direction is the opposite** (`RISK.md`
BW-20/BW-21).

> **The honest framing, and the only one permitted in the README, the video and
> the Devpost answers.** Pasted from `RISK.md` BW-01's replacement block, which
> is the corpus-wide agreed wording:
>
> *"we spend prompt-cache efficiency to buy a page-enforced workflow constraint:
> the tool the agent would need is not on the surface until the state permits it.
> The boundary that actually holds is the server's per-request check (`S2`), not
> the surface."*
>
> **The phrase this replaces is banned** (`RISK.md` BW-11, case-insensitive over
> a whitespace-normalised stream). A previous revision of this file both used it
> and licensed it for the three most-read external documents — the worst possible
> place, because `erp/**` is excluded from G4's scan and README / video script /
> Devpost answers are not. Two independent reasons it had to go: it is a lint
> hit, and it is *false* — the thing the flip buys is the tool surface, and
> IR-10 establishes the surface is page-enforced. Calling it structural repeats
> the retracted "no binary channel" error one noun over.

**E5** measures the surface bytes and tokens so this trade is stated in numbers
rather than adjectives.

**IR-16 — Either feature flag turns the API on. The flag is required; headless
does not substitute for it.** Grade: **MEASURED 2026-08-28**, by the session
owner first-hand, Chrome 152.0.7977.64, `--headless=new`, a **clean dedicated
`--user-data-dir` per launch**, page served over `http://localhost`. This
measurement is the authority on the question and supersedes every earlier
reading in this corpus:

| Launch (`--headless=new`, clean profile, `http://localhost`) | `typeof document.modelContext` | `registerTool` |
|---|---|---|
| **no flag** | **`undefined`** | n/a — no page API |
| `--enable-features=WebMCP` | `object` | **succeeds** |
| `--enable-features=WebMCPTesting` | `object` | **succeeds** |

Two consequences follow, and both matter operationally.

**(a) `WebMCPTesting` is not manual-only — the two flag names are
interchangeable. CONFIRMED.** Both expose the page API, and both expose the CDP
`WebMCP` domain (IR-17). On 152 the two flags are equivalent for everything this
project does. **This supersedes the carried-over rule that the flag name differs
by scenario.** Any surviving "flag split" language in this corpus is a **house
rule about our own configuration** — we standardise on `--enable-features=WebMCP`
so evidence files compare — and **not a claim about the browser**. H1 may still
take the scenario as a parameter, but it must not assert that the other flag
produces an empty surface: that assertion is false and a judge can break it in
one launch.

**(b) RETRACTED 2026-08-28 — "`--headless=new` enables WebMCP with no flag."**
This rule previously asserted that a headless launch with no flag exposed the
API, and hung a "headed-only gating" requirement on it. **It is FALSE.** The
table above is the measurement: headless with no flag gives `undefined`.

> **The reusable lesson — why the original error happened.** The earlier probe
> read the **CDP `WebMCP` domain** rather than the **page API**. `WebMCP.enable`
> over CDP returns `OK` even in a launch that has no page API at all. So a probe
> that asks the CDP domain whether WebMCP is on reads **"on" when it is off**.
> **Never grade flag-presence off a CDP `enable` result. The only sound probe is
> `typeof document.modelContext` evaluated in the page.** This generalises past
> WebMCP: a protocol-level `enable` that succeeds is evidence the *domain
> handler* is registered, not that the *feature* is active in the page.

**(c) NEW, and it is the useful half: the eval suite can run headless in CI.**
Because the flag works under `--headless=new`, there is **no headed
requirement** on the graded suites. The previously-imposed `headless:false`
predicate rested entirely on the false (b) and is **dropped**. What survives is
the **flag requirement**: every graded launch passes `--enable-features=WebMCP`
(or `WebMCPTesting`) and records the flag, and the discriminating negative
control is **no flag**, headless or headed alike. This is what makes **node E6**
— evals against the deployed commit in CI — feasible at all; without it E6 would
need a headed display in the runner.

Launch line used in the lab (both flags equivalent; drop `--headless=new` to run
headed — the result is the same):
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --enable-features=WebMCP --user-data-dir="$(mktemp -d)" <url>`

**The former "Known gap, UNVERIFIED" is closed.** `getTools()` and
`executeTool()` *are* reachable from page JS under `--enable-features=WebMCP`
with no agent attached — see IR-18 for the calling convention, which is not the
one this corpus assumed.

**IR-16b — Secure-context surface.** Grade: MEASURED 2026-08-28.
`localhost` / `127.0.0.1` work. `192.168.x.x` and `.local` **do not** — the
object is silently `undefined`. Consequence: never demo from a LAN IP.

**IR-16c — Debugging.** Grade: MEASURED 2026-08-28. Chrome DevTools →
Application → WebMCP sidebar can run a tool by hand. **"Registered but call
count stays 0" means the description is not persuasive, not that the code is
broken.** Consequence: this is the first hypothesis whenever an agent ignores a
tool, and it belongs in the K1 knowledge base.

### 1.4 How a tool is actually invoked — the four rules the corpus was missing

Everything in §1.4 is **MEASURED 2026-08-29** on Chrome 152.0.7977.64, headed,
dedicated `--user-data-dir`, page on `http://localhost:8731`, driven over a
page-level CDP WebSocket. These three rules replace an assumption that appeared
in ~900 KB of planning and was never tested: that `Runtime.evaluate` calling
`executeTool(name, argsObject)` is how the harness calls a tool. **It is not,
and it never worked.**

**IR-17 — There is a CDP `WebMCP` domain, and it is the invocation channel.**
Grade: MEASURED 2026-08-29. The domain is **not** listed by
`Schema.getDomains` (which returns 35 domains and no WebMCP entry — a stale,
deprecated inventory; do not feature-detect with it). It is nonetheless real:
an unknown method returns `-32601 "'Bogus.enable' wasn't found"`, whereas
`WebMCP.enable` returns `{}`. The surface, all of it exercised:

| Call / event | Shape as measured |
|---|---|
| `WebMCP.enable` / `WebMCP.disable` | result `{}`. **`enable` is a hard precondition** — `invokeTool` before it, or after `disable`, returns `-32000 "WebMCP domain is not enabled"` and no events fire |
| `WebMCP.invokeTool` | params `{frameId, toolName, input}`. `frameId` from `Page.getFrameTree`. `input` **must be an object** (a JSON *string* fails deserialization: `"Failed to deserialize params.input - CBOR: map start expected"`). Result is **`{invocationId}` and nothing else — the tool's output is not in the result** |
| `WebMCP.cancelInvocation` | params `{invocationId}`. Result `{}`; unknown id → `-32602 "Invalid invocation id"`. See IR-19 |
| `WebMCP.toolsAdded` | `{tools:[{name, description, inputSchema, annotations, frameId, stackTrace}]}`. Note `annotations` arrives over CDP as **`{readOnly, untrustedContent}`** — *not* the `readOnlyHint`/`untrustedContentHint` spelling the page registers and page JS reads back. Two spellings of one field; C1's `readOnlyHint` honesty check (rubric R6) must read the page-JS spelling or the CDP spelling deliberately, never "whichever" |
| `WebMCP.toolsRemoved` | `{tools:[{name, frameId}]}` — fires per tool on `AbortController.abort()`, one event per tool. After it, `invokeTool` on that name returns `-32602 "Tool not found"` |
| `WebMCP.toolInvoked` | `{toolName, frameId, invocationId, input}` where `input` is a **JSON string** |
| `WebMCP.toolResponded` | `{invocationId, status, …}`. `status:"Completed"` carries `output` (the page's return value as a structured object). `status:"Error"` carries `errorText:""` **plus an `exception` RemoteObject** with the thrown `description` — the error text is in `exception.description`, and `errorText` was empty in every error we produced. `status:"Canceled"` carries `errorText:""` and no output |

All four events fire. Consequence, load-bearing on the harness: **an invocation
is asynchronous and correlated by `invocationId`** — `invokeTool` returns the
id immediately and the result arrives later on `toolResponded`. A harness that
treats the `invokeTool` result as the tool's answer reads `{invocationId}` and
finds no `content` field. **A page-initiated `executeTool` also emits
`toolInvoked`/`toolResponded`**, so the event stream is a complete record of
calls from either side, which is what E3's "record which layer refused" needs.

**IR-18 — `executeTool` takes a live descriptor and a JSON *string*; it never
takes a name.** Grade: MEASURED 2026-08-29. Both halves of the corpus's
assumption are wrong, and one of them is recoverable:

- `document.modelContext.getTools()` returns a **Promise**, not an array.
  `getTools().length` is `undefined` and `getTools()[0]` throws. It resolves to
  an Array of plain objects whose own keys are exactly
  `["annotations","description","inputSchema","name","origin","title","window"]`
  — with `inputSchema` handed back as a **JSON string**, not an object.
- `executeTool('whoami', {})` rejects with `TypeError: Failed to execute
  'executeTool' on 'ModelContext': The provided value is not of type
  'RegisteredTool'.` **There is no by-name invocation from page JS.** It also
  requires two arguments: one argument → `TypeError: 2 arguments required, but
  only 1 present.`
- `executeTool(descriptor, {})` — descriptor object, args **object** — rejects
  with `UnknownError: Failed to parse input arguments`. So does `null`,
  `undefined`, `[]`, and a `Map`.
- **`executeTool(descriptor, JSON.stringify(args))` succeeds**, resolving to a
  **JSON string** of the tool result. A hand-built plain-object copy of the
  descriptor works too, so this is a dictionary conversion, not object identity.

Consequence: page-JS invocation is *possible* but is the awkward path — it
needs an awaited `getTools()`, a descriptor, and stringified args, and it gives
back a string you must re-parse. **The CDP channel (IR-17) is the harness's
instrument; `Runtime.evaluate` stays for feature detection, where it is
excellent, and for reading page state.** Both rejections above are Promise
rejections, not synchronous throws: the synchronous call returns without
throwing, so a harness that does not `await` sees success and measures nothing.

**IR-19 — `cancelInvocation` detaches the caller; it does not stop the page.**
Grade: MEASURED 2026-08-29, and this is the rule with the most room to be
overclaimed. Against a tool whose `execute` awaits a promise the page controls:

- `cancelInvocation{invocationId}` returns `{}` and **`toolResponded` fires
  immediately with `status:"Canceled"`**.
- The page's `execute` **keeps running**. Its `ended` timestamp stayed `0`; the
  awaited promise was still pending minutes later.
- **No `AbortSignal` reaches `execute`.** The second parameter `opts` was an
  object with **zero own keys** — `opts.signal` is falsy. The page has no way
  to learn it was cancelled.
- When the page later resolves its promise, **no further CDP event fires**. The
  result is discarded silently.
- A second `invokeTool` of the same tool is accepted while the first is still
  running.

**What this buys, exactly:** the *agent side* of an in-flight call can be
released on demand, deterministically, with a recorded `Canceled` status — so a
harness or client never has to hang waiting on a suspended `execute`, and
`RISK.md` §5.2's revocation weakness gains a real bound on *client* exposure.
**What it does not buy, and this must not be blurred:** it does not cancel the
page's work, does not interrupt a write in progress, and delivers the page no
signal at all. IR-7 stands unamended — *revocation does not cancel an in-flight
`execute`* — and `cancelInvocation` does not repair it. Anyone writing
"cancellation stops the call" is making the same error IR-7 exists to prevent,
one layer up. The gate that holds is still S5's suspended `execute` plus S6's
**server-side** re-canonicalisation.

> **Do not put IR-19 on the critical path.** It is an instrument for the
> harness and a sentence for the risk register. It changes no product
> behaviour, and the eval suites must keep asserting only **next-call**
> semantics (EVAL §2.4, R-8).

**IR-20 — The browser does not validate `input` on the CDP path either.**
Grade: MEASURED 2026-08-29. `invokeTool` with `input:{"bad":1}` against a tool
whose `inputSchema` is `{type:"object",properties:{q:{type:"string"}},
additionalProperties:false}` returned `status:"Completed"` and the page
callback received `{"bad":1}` verbatim. This is IR-10 confirmed on the second
channel: **N-07 is a test of our code on both paths**, and the CDP path is not
a stricter one to hide behind.

**Version-floor risk (OUR-ESTIMATE).** IR-7's behaviour is a Chrome 153
property; the contest baseline given to judges is 149+. Requiring 153+ is four
majors above the floor. Consequence: outpocket must not *depend* on the 153
behaviour for correctness — **S6**'s server-side re-canonicalisation is what
makes the gate hold on any version.

---

## 2. Measured performance numbers, and the two errors not to repeat

Environment: Chrome 152, `--enable-features=WebMCPTesting`, this machine,
2026-08-28. Grade: MEASURED.

| Quantity | Value |
|---|---|
| `registerTool`, amortised | 36.9–37.9 µs / tool |
| 13-tool registration, p50 | 0.5 ms |
| 13-tool registration, p95 | 1.0 ms |
| Long tasks during registration | 0 |
| `AbortController` revocation | 1.1–1.2 µs / tool (≈30× cheaper than registration) |
| `await getTools()` length after abort | observed 1 → 0; re-observed 2026-08-29 as **4 → 3** on a four-tool surface aborting one |

> **Read that last row with IR-18 in hand.** `getTools()` returns a **Promise**;
> `getTools().length` is `undefined`. Every observation of this row — the
> original and the re-run — is of `(await getTools()).length`. Written without
> the `await`, the check compares `undefined` to `undefined` and passes against
> any surface, including an empty one.

### The two errors that must not be repeated

**ERR-1 — The ~50 ms CDP screenshot latency is frame quantisation, not CPU.**
Grade: MEASURED 2026-08-28 — 39 of 40 samples landed on a 3-frame boundary
±1 ms. Consequence: **that number may never be added to, or divided by,
main-thread timings.** Any performance table in the README or the video that
mixes screenshot latency into a WebMCP cost is wrong and is checkable by a
judge. **E5** is specified as deterministic and model-call-free partly to keep
this contamination out.

**ERR-2 — Every WebMCP timing above was taken with no agent connected.**
Grade: MEASURED 2026-08-28. With no agent attached, `registerTool` **returns a
`Promise` that resolves to `undefined`** — *corrected 2026-08-29; the earlier
wording "returns `undefined` synchronously" was graded MEASURED and is wrong on
the installed binary.* Measured directly:
`Object.prototype.toString.call(r)` → `[object Promise]`,
`r.constructor.name` → `Promise`, `typeof r.then` → `function`, and
`await r` → `undefined`. **The conclusion the old wording carried survives
intact** — `registerTool` hands back no tool handle, so `AbortController` is
still the only revocation path (IR-2), and what the timings measured is still
renderer-process bookkeeping only. Only the grade on the *shape* was wrong.
Two live consequences of the shape: an amortised-cost loop that does not await
is timing promise *creation*, not registration; and `registerTool` can reject,
which a non-awaiting caller will never see.
Consequence: these numbers describe *page cost*, never *end-to-end agent
latency*. State that qualifier wherever the numbers appear. Do not extrapolate
to "the agent sees the new surface in 0.5 ms" — whether the built-in browser
even refreshes mid-session was unknown **V2**, and **V2 is MEASURED `refreshes`**
(2026-08-29): it does, on the agent's *next turn*, which is still not the same
claim as the page-cost number above.

Adjacent measured fact carried from the A-line, kept because it is the kind of
thing nobody re-derives: after `iframe.remove()`, an orphan renderer process
was observed spinning at ~100% CPU for **9.51 / 9.98 / 10.04 s** before the
browser reclaimed it; `worker.terminate()` returned in 0.1 ms and dropped
400% → 1% CPU within 0.6 s (MEASURED 2026-08-28). Consequence for outpocket:
iframe teardown is cleanup, never an execution-control mechanism. outpocket
runs no untrusted code today; this exists so that if sandboxing is ever added
the wrong design is not re-invented.

---

## 3. Measured tool-surface sizes — six states, not four

**Re-measured by execution 2026-08-28** (this rebuild) by driving
`countinghouse/src/tools.js` through `tests/helpers.mjs` and reading
`toolset.surface()` in each state. The compiler's six branches are at
`src/tools.js:343-354` and there are exactly six: signed-out → auditor →
employee-no-report → employee-with-a-non-draft-report → draft-dirty →
draft-clean.

**Tool counts, name sets and `readOnlyHint` counts: MEASURED.**
**Character counts: MEASURED, under the named serializer below.**
**Token counts: OUR-ESTIMATE** — `ceil(chars / 4)`, no tokenizer was run.

| State id | Tools | Chars | Tokens (est.) | readOnly |
|---|---:|---:|---:|---:|
| `S0-anon` | 1 | 395 | ≈99 | 1/1 |
| `S1-emp-home` | 5 | 1,947 | ≈487 | 3/5 |
| `S2-emp-draft-clean` | 13 | 6,682 | ≈1,671 | 6/13 |
| `S3-emp-draft-dirty` | 12 | 6,278 | ≈1,570 | 6/12 |
| `S4-emp-submitted` | 6 | 2,280 | ≈570 | 4/6 |
| `S5-aud` | 6 | 2,070 | ≈518 | **5/6 today**, 6/6 after **T6** |

Distinct tools across all six states: **15** today, **16** after T6 adds
`get_report` (`graph.json` T6 `notes`).

**The serializer, named, because a byte figure with no named serializer is the
failure this section exists to prevent.** The character column is
`JSON.stringify` over `[{name, description, inputSchema, annotations}]` — the
spike's own shape. It reproduces HANDOVER §3 rule 10's four published figures
exactly (395 / 1,947 / 6,682 / 2,070) and fills in the two states HANDOVER never
listed. **These are not OCF-1 canonical bytes.** No OCF-1 byte count exists yet,
because S11 has not run; **E5** computes them once into `evals/accounting.json`
and **E7** publishes them, and they will not equal the numbers above. A third
quantity, the export's `accounting.total_bytes` (`description_bytes +
schema_bytes + framing`), is smaller again and is an internal cross-check only.
**Three quantities are called "bytes". Exactly one — OCF-1 `canon()` bytes — is
the published figure.**

**Description lengths, re-measured today over the 15 distinct tools:
96 – 307 chars, median 217.** The shortest is `remove_expense_line` (96); the
longest is `get_expense_policy` (307). **This supersedes HANDOVER §3 rule 10's
"115–307, median ≈208"**, which excludes the shortest tool and does not
reproduce; the range and median above came out of `tools.js` on this machine at
rebuild time. All fifteen are comfortably inside the 500-char recommendation
(IR-11).

**The old hedge about "12 vs 13" is closed.** Both are real and both are in the
table: 12 is `S3-emp-draft-dirty` (the submit door shut by a blocking violation)
and 13 is `S2-emp-draft-clean` (the door open). The `1 → 5 → 12 → 13` sequence
**T2** demonstrates is therefore literal, not a rounding of the old four-state
table. There is nothing left to reconcile here.

**Why `S4-emp-submitted` must never be dropped again.** It and `S5-aud` both
carry **6** tools and their sets differ by exactly one element — the employee
gets `create_expense_report`, the auditor gets `get_day_book`. A count assertion
passes even if the auditor is handed the employee's surface. This is why
**E2 asserts set equality on names and never count equality**, and it is the
reason the five-state export was a contract defect rather than a naming quibble.

**Consequence:** this table is the baseline **E5** must reproduce. If the ported
surface compiler (**T1**) produces different numbers, either the port changed
behaviour or the domain changed — say which.

---

## 4. Competitive landscape, in numbers

Census run 2026-08-28, full sweep. Grade: MEASURED (repository counts are from
our own scan, not a vendor claim) — **for the counts. Not for what the counts
imply; see G-RULE-1.**

**The denominator column is mandatory and is new in this rebuild.** The previous
single-column table implied one shared base for rows that do not share one, and
that is the direct source of the "199 of 420 = 47%" error that two charters
inherited (`I4.md`, `L2.md`, both since corrected to 44%).

| Quantity | Value | Denominator |
|---|---:|---|
| Candidate repos in the contest window | 623 | *(this is the pool)* |
| Source actually calls `document.modelContext` | 529 | of 623 (85%) |
| Repos explicitly naming this contest | 357 | of 623 (57%) |
| Mechanism: provenance / audit | 254 (48%) | of **529** |
| Mechanism: dynamic tool surface | 243 (46%) | of **529** |
| Mechanism: human-sign gate | 201 (38%) | of **529** |
| Mechanism: evals | 152 (29%) | of **529** |
| Structured `violation` envelopes | 2 (0.5%) | of **420** fully surveyed |
| Per-field provenance, strict keyword match | 0 (0%) | of **420** |
| Generalised audit / ledger, concept-level re-test | ≈53% | of **420** — *numerator not recorded, see below* |
| LICENSE **and** ≥20 source files | 199 (44%) | of **~452** — *base not recorded, see below* |
| **Repos with a video link** | **24** | **of 420 = 5.7%** |

**Three honest caveats on this table, none of which existed before the
rebuild:**

1. **The 44% row's base was never written down.** 199 at 44% implies a base
   between about 447 and 457; "~452" is reconstructed arithmetic, not a recorded
   count. **Quote it as "199 surveyed entries (44%)" and never as "199 of 420"**
   — 199/420 is 47.4% and a judge can recompute it against our own README.
2. **The 53% row has no numerator.** The concept-level re-test's raw counts did
   not survive into HANDOVER. It is quotable as *"a concept-level re-test found
   occupants in about half the surveyed corpus"* and never as a precise figure.
3. **24/420 is 5.7%, written as "5%" elsewhere in the corpus.** Quote the
   fraction, not the percentage, and the two never disagree.

Two readings that are load-bearing:

1. **A complete product is the threshold, not the edge.** 44% already clear it.
   Our Execution score is a real 0 until the repo is public, licensed, runnable
   and filmed. Lane **G** and lane **D** are therefore worth more marginal
   points than any mechanism work.
2. **The video is the actual deliverable.** Only 24 of 420 shipped one, and it is
   a disqualification-level requirement. Contest text, PUBLISHED: *"Judges are
   not required to test the Project and may choose to judge based solely on the
   text description, images, and video."* Three of our four differentiators are
   server-side invariants invisible on screen. **D4** must therefore *show* the
   invariant being enforced, not describe it.

**The 0/420 row is the project's own worked example of G-RULE-2.** §8's
meta-lesson names it explicitly: a strict regex returning zero is a vocabulary
artefact, and the generalised re-test on the adjacent row returns ≈53%. The
strict zero more likely reflects *no payoff* than *nobody thought of it*. **No
document may turn that zero into a novelty claim.**

### The single strongest comparable: `upgradedev/claimready`

Read line by line, 2026-08-28. Grade: MEASURED (we read the repo and the live
site).

What it already does: MIT licence; live site on GitHub Pages; deployed bytes
byte-identical to HEAD; 8 tools; conditional tools revoked via `AbortController`
(verified working); **evals run in CI against the deployed commit using Chrome's
native WebMCP, including must-fail negative controls, all green**; a readiness
gate with `--selftest`.

**It implements kernels ①②④⑤.** Its only compliance gap is that no video was
shot.

**The one structural gap it leaves:** it has **no server, no session, no
persistence** — cookies, `localStorage` and `sessionStorage` are all empty. Its
own README says the page does not know who pressed a button and records
nothing.

Consequence, and this is the reason lane **S** exists: outpocket's defensible
ground is kernel ③ (**session as credential**, per-request server-side
authorization) plus the server-side half of ④ (**S6** re-canonicalisation) and
the hash chain (**S7**). Those are exactly what claimready structurally cannot
have. Anything we build that duplicates ①②⑤ without the server half is a tie,
not a win. Note also that claimready has publicly occupied the *claim* of the
human-sign gate; our difference must be stated as **mechanism** — snapshot-digest
binding plus server-side re-canonicalisation — never as the idea itself
(`RISK.md` BW-14).

### Other known entrants (MEASURED, 2026-08-28)

`witnessops/webmcp-witnessed-refund` (revocation + Ed25519 receipts + a
login-free public verifier) · `BuFi007/bufi-webmcp` (invoices + expenses) ·
`vela-science/problems` (1,057 files, `authority-boundary.test.ts`) ·
`Rylogix/thread` (46 tools, D1, one-click login-free judge entry) · `clearance`
(server-side budget envelope + hash chain) · `tallow` (burn-down to per-tool
deregistration) · `caveat` (digit-by-digit reconciliation) ·
`Joe-Simo/paradox-webmcp` (expense-approval lane — direct topical neighbour).

---

## 5. The specification is unstable — three different artefacts

Grade: PUBLISHED / MEASURED 2026-08-28.

| Feature | Entered the spec |
|---|---|
| `getTools()` | 2026-07-21 |
| `executeTool()` | 2026-08-14 |
| Two-parameter `execute` | 2026-08-18 |
| `AbortSignal` support | 2026-08-19 |
| Latest commit seen | 2026-08-26 |

**The entire "iron rules" section above is roughly ten days old.**

And the WPT conformance file `webmcp.idl` **disagrees with the spec prose**: the
IDL has no second parameter, does not carry `getTools()`/`executeTool()`, and
adds a `consequentialHint` that the prose does not have.

**Therefore: spec text, conformance tests, and browser implementation are three
different things. Never treat agreement between two of them as evidence about
the third.**

**That split had a live consequence, and it is now settled by measurement
rather than by H2.** All three Codex charters state that
`document.modelContext.registerTool` is *the only entry point*, while the eval
kit calls the page's real `getTools()` / `executeTool()`. The open question was
whether those two are agent-side and therefore absent from page JS.
**MEASURED 2026-08-29, Chrome 152.0.7977.64, `--enable-features=WebMCP`, no
agent attached: both are present and both work** — `typeof
document.modelContext.getTools === 'function'` and `typeof
document.modelContext.executeTool === 'function'`, and a real call returns a
real result. So the harness's core mechanism exists. **But not in the shape the
corpus assumed** — `getTools()` is a Promise and `executeTool` refuses a name
(IR-18) — and the invocation channel we are actually building on is CDP
`WebMCP.invokeTool` (IR-17). H2 no longer *discovers* this; H2 now *regresses*
it against whatever Chrome is installed on the day.

The negative-control caution stands and is now sharper: **"the browser rejects
an unregistered name" is measurable, and its answer is channel-dependent.** On
CDP, `invokeTool` with an unknown `toolName` returns `-32602 "Tool not found"`
and this is the same code returned after `AbortController.abort()` — so a
revoked tool and a never-registered tool are **indistinguishable to the
client**. From page JS there is no by-name call to reject at all. N-01 must
therefore keep recording *which layer refused* and asserting only that state is
unchanged; it may not claim the browser distinguishes revoked from unknown,
because it does not.

Operational consequence, and it is a standing instruction: **on the day work
starts, re-confirm against the latest spec commit and against the target browser
by measurement — do not copy this file.** The correct use of §1 is "this is what
we found, and here is what to re-check", not "this is settled". Any discrepancy
found on re-check gets appended here with a date, and K1 records it.

---

## 6. Deployment facts

Grade: MEASURED / PUBLISHED 2026-08-28.

**Chosen for the product (D1): Render paid 0.5 CPU / 512 MB ($7/month).** The
only target that runs the single-file Node server with **no code change**.

Why the free tier is not an option for the product (PUBLISHED): 15-minute sleep,
and a 750-hour/month allowance against a 744-hour month — a keep-warm ping
saturates the allowance and **suspends every free service in the workspace**.
That is a whole-account failure mode during an unattended judging window.

**The V5 probe origin is the deliberate exception and it *is* free.** It is a
throwaway `*.onrender.com` **Web Service** (not a Static Site — it must echo a
cookie at `GET /whoami`), in the same Render account, created and deleted inside
Sprint A, and the 15-minute sleep is harmless because V1–V4 are attended
single-sitting probes. Authority: `graph.json` V5 `notes`, R-18. **The free-tier
suspension hazard above is about a keep-warm ping on a service that must stay
up; V5 has no such ping and must not acquire one.**

Structurally out for the product:

| Host | Why it is out |
|---|---|
| Vercel | Fluid does not guarantee memory persistence — our session/day-book state would evaporate. |
| Netlify | Ephemeral compute; same problem. |
| ChatGPT Sites | No Node runtime, **and** terms prohibit *"enable financial transactions"* — an expense desk is squarely in the prohibited zone. |
| Anything on the PSL (see IR-9) | Cannot hold an origin-trial token on a subdomain — which bites **D2 only**. |

Cloudflare Workers is a live fallback but requires a storage-layer rewrite —
Track B only, never Sprint A.

**D1 must deploy exactly one instance, and the deploy notes must say why.**
The TOCTOU closure between "the human approved" and "the server persisted" is
OUR-ESTIMATE, *true by construction of a single-process Node server with
synchronous state mutation inside each request handler*. A second instance
reintroduces the race and **no test in this repository would notice**. Render's
instance count is a dashboard setting, so this is one click away from being
false in production while every test stays green.

**Judging window: 2026-09-04 10:00 → 2026-09-21 17:00 PT, unattended.**
Consequence: **S9** — deterministic reseed on boot, so that "the service was
restarted" is indistinguishable from "clean initial state". **D3** checks
survival across the window. A cold-start measurement after ~20 minutes idle was
the planned acceptance test on the paid tier.

**Deploy acceptance (D1):** dump all response headers and assert
`Origin-Agent-Cluster: ?0` is absent **or present with a non-`?0` value**
(IR-8), assert HTTP 200, and assert `GET /version` equals `git rev-parse HEAD`.

---

## 7. Open unknowns

These are the five things whose answers change the design. Lane **V** exists to
close them and has the highest information value per hour on the board. All
grade: UNVERIFIED. **Days are quoted from
`graph.json.capacity.schedule_A`, which is the only schedule authority.**

| Node | Day | Question | What it decides |
|---|---|---|---|
| **V0** | 1 | Does `navigator.modelContext` still exist as a stale alias on the **installed** Chrome (152.0.7977.64)? | Contradicts IR-1 if yes. Affects what we may write publicly. |
| **V1** | 1 | Is `document.modelContext` ABSENT in the ChatGPT built-in browser on a plain HTTPS origin? There are reports that the origin must be authorised — and 45 in-window repos deployed to `*.chatgpt.site`, which may be a workaround for exactly this. | **If true and we use an ordinary domain, judges see a page with no tools at all, and local testing would never reveal it.** The single highest-stakes unknown on the board. Human-gated; runs against **V5's throwaway origin**, not against D1 and not against localhost. |
| **V2** | 2 | Does the built-in browser refresh the tool list mid-session? | Whether kernel ① is *demonstrable* at all. Until V2 returns `refreshes`, **no document, storyboard, video cue or Devpost answer may say the surface changes "on the spot"** — the honest phrasing is "on its next turn". |
| **V3** | 2 | Does an agent-initiated tool `execute` carry the page's session cookie on `fetch`? | Kernel ③ — the entire lane S premise. **And, since R-13, the sign gate's residual risk: see the warning below.** |
| **V4** | 2 | Does a suspended `execute` time out in the built-in browser? | Kernel ④ — how long the human has to sign before the call dies. If the maximum is below the time a human needs to read a dialog, S5 ships in two-call handshake mode. |

**V3 is not only an attribution question, and this is the correction R-13
forced.** Quoting `graph.json`'s own contingency: *"This is the answer that makes
the sign gate worse, not better… An agent that carries the cookie AND can read
the DOM can reach the `confirm_token` and drive `POST /respond` itself: N-16
`neg-respond-without-click` stays KNOWN-OPEN for that caller… No wording
anywhere may upgrade to 'a human decided'."* See §9a.

---

## 8. Citations that are poison

Sources that look supportive and destroy credibility the moment a judge or
reviewer checks them. **Never cite any of these.** Grade: MEASURED (we checked
each one). `RISK.md` BW-15 … BW-19 lint the literal strings.

| Poison source | Why it kills you |
|---|---|
| **WindTunnel** | Its WebMCP arm injects a home-built bridge through Playwright — it **never goes through Chrome's WebMCP**. Also the publisher, nekuda, sells a WebMCP integration plugin, so it is an interested party. Citing it says we did not read past the abstract. **This is the third recurrence of the same class of error in this project.** |
| **arXiv 2508.09171** | Same name, different thing — an independent client-side scheme by D. Perera. Citing it is an on-the-spot puncture. |
| **TDS, "Prompt Engineering Fails Quietly"** | It is a deterministic mock simulator. **Not one model call happened.** Any number quoted from it is fiction dressed as measurement. |
| **"Adding semantically similar tools costs 8–19%"** | Wrong column read. The real drop is **1–8%, median ~3%**, and the paper itself flags that column as an evaluation artefact. Do not cite a number here at all. |
| The vendor-internal Oracle Fusion Expense agentic prompt the user supplied | Publishability unconfirmed. Never quote it verbatim, never attribute it, and do not use it as a benchmark arm without explicit clearance from the user. |

**Laundering a poison source's *result* is the same offence as citing it.** The
belief travels even when the name is removed; a judge who asks "which published
data?" gets either a poison citation or no answer. The correct move is to state
that we make no accuracy claim and cite no external accuracy data, and to give
our own arithmetic reason for excluding it.

### The meta-lesson that generated this section

**An "empty cell" found by keyword search is a vocabulary artefact, not a
conceptual gap.** Every time a strict regex returned 0/623, a concept-level
re-test found occupants. **Any claim of novelty based on keyword counting must
be re-tested at the concept level before it may be written down** — that is
G-RULE-2, and `RISK.md:262-265` makes it binding with a recorded-search-terms
requirement. The 0/420 per-field-provenance figure in §4 is exactly this shape.
So is the 1-in-623 figure in §10.

---

## 9. Retracted claims — never write any of these

Reproduced from HANDOVER §5 so that no writer has to go looking. **Writing any
left-hand phrase is a defect, and `G4`'s banned-wording lint is the mechanical
check** — `RISK.md §5` holds the full BW-01 … BW-29 table with the exact
patterns. Grade: MEASURED / PUBLISHED, all 2026-08-28.

| Banned | The truth |
|---|---|
| "The tool surface is the boundary" | It is a **menu, not a lock**. `erp.js:101` currently has the client telling itself 403. Correct form: **"the tool surface is the intent surface; the boundary is on the server, per request."** |
| "We invented the deterministic policy contract" | Oracle Expenses REST already returns per-field `expenseErrors` with ErrorCode/Type/Name/ErrorDescription; UCP has an isomorphic error envelope; `claimready` already ships the same claim. |
| "Narrow inputs + reusing existing auth is our insight" | Published as general guidance by both OpenAI and Chrome — **and people from both are on the judging panel.** |
| "Source material never resides in the system" | False for us: attachments are uploaded by a human **and stored**. Narrow to "the derivation context is not persisted". |
| "No binary channel = a structural guarantee" | It is **page-enforced**, not browser-enforced (IR-10). |
| "…a structural guarantee about the workflow" *(the cache trade)* | Same error one noun over. Use IR-15's replacement paragraph. **This file licensed the banned form for the README, the video and the Devpost answers until this rebuild; that licence is revoked.** |
| "An approved-agent allowlist is sufficient" | The official text names **ChatGPT Work and Codex**; the word Business never appears. The Work↔Business relation is unevidenced. |
| "The human-sign gate is our differentiator" | Publicly occupied by the `webmcpui` docs. Our difference must be the **mechanism**: snapshot-digest binding + server-side re-canonicalisation. |
| "Tamper-proof" *(the day book)* | **Tamper-evident.** Anything with write access to the store can recompute the whole chain. |
| "Machine-verified" | Overstates what an in-page check establishes. Write "executed, replayable evidence". |
| "Impossible without WebMCP" / "only WebMCP can" | Trivially disproven: a backend integration does the same task with a different credential topology. Write "what WebMCP changes is *where the credential lives*, not whether the task is possible". |
| **"A commit cannot be made without a human decision"** | **Retracted under R-13. See §9a — this one is live, and it is the newest.** |
| **"We attest that a specific agent did X"** | **WebMCP exposes no agent identity.** The specification says the browser agent uses a different internal mechanism; `execute(args, opts)` carries no attested caller. The page cannot distinguish ChatGPT-Sol from a CDP script from **H3**, our own in-page fallback agent — which exists precisely to drive the same surface with no agent at all. `graph.json` G4 `--assert-register` carries `'a specific agent'` as a scannable retracted string (R-21). We may attest *that a tool call arrived and that a human signed the snapshot it produced*, and nothing about who called. |
| **"The five write tools"** | **Seven.** R-20, in `graph.json` G4's accept: *"the count is SEVEN and is computed from `annotations.readOnlyHint !== true`, never hard-coded"*. The old five omitted `submit_expense_report` and `open_expense_report`. **Never write the number as a literal anywhere** — derive it, in code, from the annotation. |
| **"`executeTool(name, args)` calls the tool"** *(added 2026-08-29)* | **It rejects** — `TypeError: … not of type 'RegisteredTool'`. There is no by-name invocation from page JS at all, and `Runtime.evaluate` — the only instrument this corpus ever named — therefore cannot execute a tool. The working forms are CDP `WebMCP.invokeTool` and, in page JS, `executeTool(descriptor, JSON.stringify(args))`. **IR-17 / IR-18.** |
| **"`getTools()` returns an array"** *(added 2026-08-29)* | **It returns a `Promise`.** `getTools().length` is `undefined`, so `=== 1` is unsatisfiable and `!== 0` passes against an empty surface — the exact silent-empty failure the harness rules exist to prevent. Always `(await getTools()).length`. **IR-18.** |
| **"`--enable-features=WebMCP` is required for automation; the other flag gives an empty surface"** *(added 2026-08-29)* | **Both flags work — CONFIRMED 2026-08-28.** Keeping `WebMCP` as the graded flag is a **house rule about our configuration**, not a property of the browser; asserting the browser requires it is false and a judge can break it in one launch. **IR-16(a).** |
| **"`--headless=new` enables WebMCP with no flag"** *(added 2026-08-28, and this row retracts the claim)* | **FALSE.** Headless with no flag → `typeof document.modelContext === "undefined"`. The flag is required, headless or headed. The error came from probing the **CDP domain** instead of the page: `WebMCP.enable` returns `OK` even where no page API exists, so the probe read "on" when it was off. Grade flag-presence only off `typeof document.modelContext` in the page. **IR-16(b), retracted.** |
| **"`registerTool` returns `undefined` synchronously"** *(added 2026-08-29)* | **It returns a `Promise` resolving to `undefined`.** Graded MEASURED and wrong on the installed binary. The conclusion it carried survives — no tool handle comes back — but a timing loop that does not `await` measures promise creation. **§2 ERR-2.** |
| **"Cancellation stops the call"** *(added 2026-08-29)* | Same error as BW-22/23/24 one layer up. CDP `cancelInvocation` releases the **caller** and reports `Canceled`; the page's `execute` runs to completion and receives **no signal at all** (`opts` has zero own keys). **IR-19**, and IR-7 stands. |

### 9a. The sign gate's claim, narrowed to what is provable (R-13)

This is the newest retraction and the one most likely to be re-introduced by a
writer working from an older draft.

**The only provable sentence:**

> **A commit cannot be made without a POST from the authenticated session to
> `/api/sign/{id}/respond`.**

**Every stronger headline is deleted and may not be restored** — not "a commit
cannot be made without a human decision", not "Layer 0 answers *did a human
decide*", not any forgery-closed flag.

**Why.** A second forgery survives the R-1 repair. The attacker holds the
session cookie, never renders the dialog, POSTs `/respond` itself with
`{schema, request_id, decision:'signed', reason:null, method:'click',
acknowledged_digest, acknowledged_revision}` — every field a constant or copied
verbatim from the response the server just issued — then commits. All eleven
rejection codes were walked and **none fires**. This is inside the plan's own
**N-04** threat model: curl, session cookie, no browser.

**What R-1 bought, and what it cost — state both.** The attacker loses the
ability to choose the name and the timestamp; `signed_by` comes from the session
cookie and `at` from the server clock. **The resulting record is therefore a
true attribution of a false event** — signed `chen` at a genuine server time,
forensically indistinguishable from a real click in the day book forever. That
is arguably worse than the old forgery, and it is written down here on purpose.

**The `confirm_token` is defence in depth, not a proof.** It is minted with the
sign request, delivered **only** into the rendered dialog's DOM, never returned
in any tool-call result or any `/api/sign/{id}` response body, and required by
`/respond`. It raises the cost of the attack; **it does not establish
personhood.** Its value was a direct function of unknown **V3** — **MEASURED
`same-session` on 2026-08-29 (R-43), the unfavourable branch.** The
agent-initiated fetch **does** carry the page session cookie and that client
**does** read the DOM, so the token **is** reachable. Present tense. The client's
own action-time consent prompt on a remote origin (`V6-consent-gate`) raises the
attacker's cost and closes nothing — client policy, absent on `localhost`,
defeated by a different client or a reflexive click. State the residual risk in
exactly those terms wherever the sign gate is described, including in
`docs/DEVPOST.md` and `docs/VIDEO-SCRIPT.md`.

**Negative control N-16 `neg-respond-without-click`** is scripted verbatim as
the attack and **records the current outcome honestly**: with no `confirm_token`
required the commit **SUCCEEDS** (HTTP 200, a chain entry attesting Chen Xiao at
a genuine server time) and the case is recorded `KNOWN-OPEN`; with the token
required, a caller that cannot read the rendered dialog's DOM gets 403
`E_NO_CONFIRM_TOKEN` and the case is recorded `REFUSED`. **The test fails if the
outcome changes silently in either direction. Delete the stronger sentence; do
not weaken the test.**

**C3's charter must point the instrument at this vector.** Its four enumerated
sign-gate attacks — replay, race a second respond, wrong `request_id`,
expire-and-commit — do **not** include "POST `/respond` yourself", and it told
the red team to *prove that closure, not rediscover the hole*. **E9** owns the
rewrite; the standing target list must carry the live vector.

### The three things we must disclose about ourselves

Not optional. The document's purpose is to let experts find the holes; naming
them first is strictly better than being caught. All PUBLISHED.

1. **The OpenAI client already has a confirmation layer.** *"Normal
   website-access and confirmation policies still apply, including for
   consequential actions."* The sign gate must therefore prove what it adds —
   and after §9a the only honest answer is digest binding plus server-side
   re-canonicalisation, not personhood.
2. **OpenAI treats us as untrusted.** *"Website-provided tool definitions and
   results are untrusted content."* The platform instructs the agent to distrust
   our page. Design accordingly; never argue from page authority.
3. **Judges may never open the site.** See §4. The video is the deliverable.

---

## 10. Killed directions — never re-propose

Grade: MEASURED 2026-08-28. Each was killed with a specific finding, given here
so the kill does not have to be re-argued.

**Scenario changes — all rejected:**
- *Customs / HTS classification*: we pulled CBP HQ H350722 in full and the text
  **overturned** the argument rather than narrowing it. Avalara already runs a
  Classification MCP server.
- *Insurance claims*: the legal spine is real (NFIP proof of loss must be signed
  and sworn) but `claimready` occupies the position head-on.
- *Government permits*: the legal basis was a misreading — CA B&P §7031.5
  contains no perjury language anywhere. ProjectPermit shipped a live endpoint
  on 2026-08-27.
- *Medical prior authorisation*: collides with the named Da Vinci DTR profile;
  the HIPAA BAA layer is not the WebMCP layer; CMS-0057-F is pushing the
  workflow toward back-end APIs anyway.
- *IT ticketing*: first-party ServiceNow and Atlassian MCP servers already
  shipped.

**Eight "original angles"** were sent to adversarial review; five were killed,
four judged "should abandon", one "needs major rework". The revocation desk /
opposing-counsel / affidavit desk / deposition / warrant angles are all dead;
per-item reasoning is in `countinghouse/solution.html` §11.3.

**Strategic conclusion carried forward (OUR-ESTIMATE):** three rounds of hunting
for an original angle all hit walls and the fourth had negative expected value.
At a density of 529 real implementations with 44% already shipping complete
products, **differentiation no longer comes from mechanism novelty. It comes
from being one of the few entries that actually files a compliant submission.**

**The two small things that survived** (never adversarially killed, therefore
treat as **unverified** rather than proven):

1. **The absence register** — when a tool is not present, leave a resident
   read-only tool that explains, in the `{code, severity, field, fix,
   candidates}` shape, *why it is absent and how to restore it*. ~95% reuse,
   half a day. It answers Drasner's own open issues **#199** and **#262** (both
   opened inside the contest window, still with zero replies) and turns kernel ①
   from a deduction into "we supplied the third state the WG asked for". This is
   node **T3**, and it is present in **all six** states, not five.
   **Say what ours does; make no claim about what others do not do.** The census
   that suggested nobody else ships it was keyword-based (G-RULE-2). Issue
   existence and zero replies = MEASURED 2026-08-28; everything else about its
   uniqueness is unrecorded.
2. **Print the worst-case consequence above the signature line.** Node **F4**.
   Carried verbatim from `graph.json` F4 `notes`, which is the agreed wording:
   *"the consequence line is zero-cost and our keyword scan of 623 repos matched
   it once — but that scan has not been re-tested at the concept level, so treat
   it as 'we found one, we did not look hard' (OUR-ESTIMATE), not as evidence of
   rarity. It is in the plan because it costs nothing and makes the signature
   mean something, not because it is unique."*
   **The bare form "1 hit in 623 repos (MEASURED)" is retired.** MEASURED covers
   "our scanner matched once"; it does not cover "therefore this is rare"
   (G-RULE-1). A regex cannot see a consequence line rendered from a template,
   worded as a warning, or living in a component the scanner never read.

---

## 11. Inherited assets and the one red test

Grade: MEASURED 2026-08-28. Source tree at `~/mcp/countinghouse/src/`, 1,396
lines of pure logic, no DOM anywhere. Line counts re-verified by `wc -l` at
rebuild time.

| File | Lines | What it is |
|---|---:|---|
| `src/tools.js` | 401 | Tool-surface compiler (domain-agnostic). **The most valuable asset.** Ported by **T1**. |
| `src/erp.js` | 425 | Personas, seeds, permission gate, day book, canonical digest. |
| `src/policy.js` | 250 | Policy engine, **19 deterministic violation codes** (15 line-level, 4 report-level), integer cents. Ported by **S3**. |
| `src/scenarios.js` | 187 | Four scenarios + replay runner. |
| `src/samples.js` | 133 | Receipt SVGs + transcriptions + demo prompts. |
| `tests/` | 290 | 24 tests across `helpers.mjs`, `policy.test.mjs`, `surface.test.mjs`. |

**Nineteen rules, not sixteen. This is the correction, and it is the one this
file most owed.** Re-counted from source at rebuild time, by execution:
`grep -o 'push("[A-Z_0-9]*"' src/policy.js | sort -u | wc -l` returns **15**
line-level codes, and four report-level codes are pushed at
`src/policy.js:193/197/199/218` — `EMPTY_REPORT`, `PROJECT_SCOPE`,
`PROJECT_INACTIVE`, `REPORT_REVIEW`. 15 + 4 = **19**. The frozen contract agrees:
`erp/contracts/policy.schema.json` `examples[0]` carries **R01–R19**, and its
digest `sha256:b7ccc1ff…` over 2,458 canonical bytes is pinned in
`erp/contracts/policy-versions.json` and has been independently recomputed twice.
**"16" matched nothing in the file** — not the codes (19), not `LIMITS` (9 keys),
not the push sites (23). It was carried from HANDOVER §1 without re-counting,
which is exactly what this file exists to prevent. `RISK.md:580` states that any
document still saying "16 rules" is stale; **this was that document, and it is
now fixed.** S3's accept in `graph.json` requires `p.rules.length === 19` and
`R01`…`R19` in order, so the old number made the predicate unsatisfiable.

> **Do not confuse the two sixteens.** §1's "sixteen iron rules" (a stale count
> of a *different* list, corrected to twenty-two there) and this "16 rules" (a
> wrong count of `policy.js`) are unrelated errors that happen to share a number.

**These are ported, not rewritten.** Rewriting 1,396 reviewed lines inside a
5.5-day sprint is the most expensive mistake available. **S3 is nevertheless not
a straight port and is budgeted 3.0 h, not 1.0:** `src/policy.js:28` is
`export const FX = { USD: 1, EUR: 1.09, GBP: 1.28, CNY: 0.14, JPY: 0.0067 }` —
floats, which cannot enter a canonical form two implementations agree on.
Amounts stay integer cents; **FX rates become integer micro-units (rate × 1e6)**,
and every digest downstream is re-derived. **No float ever enters a canonical
form**, which is why a non-integer amount is a malformed-argument case (N-07),
not a rounding question.

**The one red test.** `tests/surface.test.mjs:28`, *"auditor surface: read-only
by construction"*, **FAILS**. Confirmed by execution 2026-08-28: `node --test
tests/*.test.mjs` in `countinghouse` reports **24 tests, 23 pass, 1 fail**, and
the single failure is this one. `open_expense_report` lacks `readOnlyHint` **and
it genuinely writes state** — it mutates `openReportId` and appends to the day
book. The failing assertion is the core assertion of kernel ①, and it is why
§3's `S5-aud` row reads 5/6 today.

**Resolution (B) is ratified** in `graph.json` T6: `open_expense_report` is
**removed** from the auditor surface and a genuinely side-effect-free
`get_report(report_id)` replaces it, on the stated principle that read-only must
be **constructive**, not maintained by a hint we ask the model to respect. The
auditor set becomes `{get_day_book, get_expense_policy, get_open_report,
get_report, get_session_scope, list_expense_reports}` and readOnly becomes 6/6.
Distinct tools go 15 → 16. **L0 is a hard input to T6** — until L0 ports the
spike into outpocket there is no `npm test` to run.

---

## 12. Contest compliance facts

Grade: PUBLISHED 2026-08-28.

- Deadline **2026-09-03 13:00 PT** (= Day 6 in `capacity.schedule_A.calendar`).
- Public repo required (GitHub or GitLab), with an **OSI licence at the root,
  visible in the GitHub About box** — Devpost and GitHub each detect it
  differently, so the root file is what satisfies both.
- The repo must contain full run instructions and all assets.
- **Video: under 3 minutes, public, English, and WITH AUDIO.** Missing audio is
  disqualification-grade.
- Multiple submissions are allowed but must be **substantially different**. Three
  in-house concepts (outpocket, gatehouse, countersign) share the
  "tool-surface-as-boundary" motif; dilution risk is real and is a PM decision.
- Judge baseline browser is Chrome **149+** (see the version-floor note in §1.3).
- Final acceptance must be run from a **logged-out / incognito** window, item by
  item: repo opens, LICENSE visible, video plays and has sound. That is **D6**.

---

## 13. Fixed vocabulary

So that parallel writers do not invent synonyms. **`erp/PATHS.md` is the
authority for every literal path, filename and command name; this section holds
only the names that are not paths.**

**Repos.** `outpocket` (the product) · `webmcp-dev-kit` (modules extracted from
it) · `webmcp-eval-kit` (the harness that grades it). All three exist and are
pushed, and **all three are currently private** — flipping to public is node
**G1**, and **G3 clones a repo G1 makes public**, which is why the `G1 → G3`
edge exists (R-19).

**Horizons.** **Sprint A** = everything due 2026-09-03. **Track B** =
post-deadline; lane **X** is Track B by default and must never touch Sprint A's
critical path.

**Lanes.** G Ground · V Verification · H Harness · T Tool surface · S Server ·
F Front-end · E Eval · X Extraction · D Delivery.

**Application state ids** — six, quoted from `PATHS.md §5`:
`S0-anon` · `S1-emp-home` · `S2-emp-draft-clean` · `S3-emp-draft-dirty` ·
`S4-emp-submitted` · `S5-aud`. **Never write a bare `S1`/`S5` for a state** —
those are server-lane **node** ids.

**Unknowns register keys** — `V0` … `V4`, matching the V-lane nodes that answer
them. **`T0`–`T4` is dead**: `T1`–`T4` are live tool-surface node ids (port
`tools.js`, real `registerTool`, absence register, description budget) and `T0`
exists nowhere.

**Day labels** — always `Day 0` … `Day 6` in prose. `D1`–`D6` are delivery
**nodes**.

**Cut ranks** — write `Cut X1–X6`, never "cut rank 4". There is exactly one
ladder, in `graph.json.cut_ladder`.

**The contracts path is `erp/contracts/**` and only that** (R-17). The eight
frozen schemas are pre-existing planning artifacts and live there; **L0 does not
move or copy them, S10 freezes them where they are**, and the bare `contracts/**`
glob does not exist.

**The five kernel mechanisms.**
① the tool surface is a state machine (role × object state × validation outcome,
compiled) ② policy resident in the page (versioned policy document +
deterministic `{code, severity, field, fix, candidates}` violations) ③ the
session is the credential (per-request server-side authorization) ④ the
human-sign gate (`execute` suspended; the signature binds the digest of the
snapshot that was reviewed; the server re-canonicalises before it commits)
⑤ per-field provenance.

**The two defensible claims, after four rounds of contraction.**
**(a) We add no new credential holder** — the agent reuses the employee's
already-authenticated browser session. The correct statement is **not** "a
third-party agent cannot reach the ERP" (it can: Truto sells hosted MCP for
Fusion Procurement; `cloudorcl-lab/FusionRest-MCP` exposes a generic
`rest_call`), but **"every path that does reach it requires minting a credential
separate from the login session, held and rotated by some intermediary."** And
we must concede that Truto / Merge / Paragon / Nango are **competitors, not
whitespace**.
**(b) The site can attest to joint presence and turn that presence into auditable
evidence** — not "only WebMCP allows a human to be present", which no site can
enforce. **And read §9a before writing anything about what the signature
proves:** what is attested is that a tool call arrived and that a POST from the
authenticated session answered the sign request over a bound snapshot digest.
Not personhood, and not the identity of the agent.

**The four non-overlapping rulers.** QA measures *is it done* (acceptance
predicates) · L2 measures *is it enough to win* (rubric, whose instrument is
`erp/RUBRIC.md`, **produced by L0** under R-16 — it is no longer a dead name) ·
C3 measures *can it be broken* (adversarial) · C1 measures *can a blind agent use
it* (surface export only, no repo access).

---

## 14. Resident session control

Grade: MEASURED 2026-08-28.

```
claude --model <m> --effort <level> --append-system-prompt-file .team/charters/<seat>.md
codex exec -p <profile>          # with ~/.codex/<name>.config.toml
```

`--model` and `--effort` are both real, session-level flags.

**`codex exec -p <missing-profile>` exits 0 and silently falls back.** MEASURED
on Codex CLI 0.144.6, this machine: no warning, banner reads
`reasoning effort: medium`, and `ls ~/.codex/*.config.toml` finds **no matches**
— **zero profiles exist today**. L0's gate (3) creates all four
(`verifier:low`, `builder:medium`, `redteam:high`, `evaluator:high`) and checks
them by grepping the banner, because existence alone proves nothing. The banner
does print to non-TTY stdout, so the grep is a working check.

**THE PROFILE FILE LAYOUT — FLAT TOP-LEVEL KEYS, NEVER A `[profiles.<name>]`
TABLE.** Grade: MEASURED on codex-cli 0.144.6, this machine, and corroborated by
the CLI's own help text, which is the authority and states the mechanism in one
line — `codex exec --help`:

```
-p, --profile <CONFIG_PROFILE_V2>
        Layer $CODEX_HOME/<name>.config.toml on top of the base user config
```

**The file is a config *layer*, not a container of profiles.** Its keys are read
at the same level as `~/.codex/config.toml`'s own keys. Wrapping them in a
`[profiles.<name>]` table therefore layers a `profiles` table and sets **nothing**:
`model` and `model_reasoning_effort` stay at the base config's values, the run
proceeds silently at the wrong effort, and **`L0` gate (4) fails with no pointer at
the cause** — the banner simply does not say what the gate greps for. MEASURED
symptom of the wrong layout: `model: gpt-5.6-sol` and `reasoning effort: none`.
Nothing warns; `codex exec -p <name>` does not complain about a file it read and
found nothing usable in, exactly as it does not complain about a file that is not
there (above).

**Worked example — the whole of a working file.** `~/.codex/verifier.config.toml`:

```toml
# ~/.codex/verifier.config.toml — layered ON TOP OF ~/.codex/config.toml by
# `codex exec -p verifier`. Top-level keys only. No [profiles.*] table, no
# [verifier] table, no nesting of any kind.
model = "gpt-5.6-sol"
model_reasoning_effort = "low"
```

and the four `L0` creates are that file four times over, with
`model_reasoning_effort` = `low` (`verifier`), `medium` (`builder`), `high`
(`redteam`), `high` (`evaluator`). **Check the effect, never the existence**: the
run banner prints `reasoning effort: <level>` to non-TTY stdout, which is what
`L0` gate (4) greps and why `test -f` alone is not a check.

> **Why the failure is silent, stated once so no seat re-derives it.** Both wrong
> layouts and one right one all exit 0. A missing file falls back to the base
> config; a `[profiles.<name>]` file falls back to the base config; only the flat
> file moves the banner. So **every negative result looks like the base config**,
> and the base config is a moving target — `~/.codex/config.toml` on this machine
> reads `model_reasoning_effort = "ultra"` today and read `medium` when this
> section was first written. Grep the banner for the level you asked for; do not
> grep for the level you expect to see when it goes wrong.

**`workspace-write` has no network by default.** MEASURED: bare
`workspace-write` reports *"Network access is restricted"*;
`-c sandbox_workspace_write.network_access=true` reports *"Network access is
enabled"*.

**C1's blindness needs a hermetic `CODEX_HOME`.** MEASURED: under the default
home, even `-s read-only` fired an `oracle_dbtools` OAuth request and both
`SessionStart` and `UserPromptSubmit` hooks; a hermetic `CODEX_HOME` suppressed
all of it, along with `AGENTS.md`, `node_repl` and plugins. **The rendered
prompt is not fully controlled even so**, and the ~3.7 KB `<recommended_plugins>`
marketplace catalog **survives** the hermetic home. It does not come from
`$BH/config.toml`, so a verifier that asserts only the contents of `$BH` cannot
see it. Benign for C1's task; fatal to the word "hermetic" and to any MEASURED
byte count quoted for the blind prompt.

> **No byte pair is quoted here, deliberately.** `EVAL.md` §1.1.1 is the single
> home for these numbers and it carries the full five-row table with the command
> to re-run. Three readings of the *same* base home now exist — 32,359 B and
> 32,363 B on 2026-08-28, and **32,247 B re-measured 2026-08-29** with the same
> `codex-cli 0.144.6` and the same input. The catalog drifts; the number is a
> reading, not a constant. An earlier revision of this file published the
> 32,359 → 15,666 pair as "measured today", which both fixed a moving number and
> disagreed with `EVAL.md`'s pair for a differently-constructed home. Cite
> `EVAL.md` §1.1.1; do not copy a pair out of it into anything published.

**Honest limitation, stated so nobody plans around a capability we do not have:**
an agent cannot open a new terminal window. It can wake an idle session, or
shell out to a headless `claude -p`. **A genuinely dead resident session needs a
human to restart it.**

**Seat-count reconciliation.** The user agreed **15 seats with four Codex
positions**, but only three Codex seats were ever named (C1 verifier, C2 builder,
C3 red team). This plan names the fourth as **C4, eval engineer**, owning
`webmcp-eval-kit` and the graded runs — which matches the user's own instruction
that eval is primarily Codex-run. That makes **16 named seats**, and the
discrepancy is the fourth Codex position finally being given a name rather than a
new seat being invented. **L0's gate (2) asserts
`ls .team/charters | wc -l` equals 16**, so 16 is the operative number.

**L1 cannot boot from `.team/charters`, and this is the one-sentence exception
(R-15).** `.team/charters` is a symlink that only **L0** creates, so **L1's
first boot reads `erp/charters/L1.md` directly.** Every later boot uses the
symlink like every other seat.

---

## 15. User working preferences

Grade: PUBLISHED (stated by the user directly).

- Conversation in Chinese; **all three repos and all their documents are
  English-only**.
- Real research, never impressions. **Every load-bearing claim carries an
  evidence grade.**
- Documents exist so experts can find holes. **Volunteering a weakness beats
  having it found.**
- Explicitly ruled out of scope: enterprise browser-policy risk.
- Explicitly instructed: **build against the current Chromium version; if that
  breaks, require an upgrade** rather than back-porting.
- Human budget **2.5 h/day** is the working assumption (PUBLISHED — the user
  stated 2–3 h/day and 30–50 prompts). PM settles 2.5 vs 3.0 on Day 0. This one
  figure decides whether the cut ladder is needed at all, so it is the most
  load-bearing number in the plan and it is **not** MEASURED.
- Standing red-team line, worth keeping in view: *if there is no site you can
  open by the end of day 3, every narrative above is worth zero.*

---

## 16. What this file deliberately does not contain

So that no one comes here looking and then invents an answer.

- **Node hours, owners, inputs, outputs, accept predicates, cut ranks, the
  critical path, and which day a node runs on.** All `erp/graph.json`. The
  schedule specifically is `capacity.schedule_A`, new in v2.1.0.
- **Literal paths, filenames, command names, glob ownership.** All
  `erp/PATHS.md`.
- **Any table restated from either authority.** `graph.json.falsification`
  makes the rule mechanical: a restatement is legal *"only while a checker proves
  the equality mechanically"*, and **G0's `node tools/ready.mjs --check-tables`**
  is that checker (R-22). The tables in §3, §4 and §11 above are **measurements,
  not restatements** — they are this file's own evidence and no other document
  owns them.
- **Anything found by new web research.** Forbidden for this document. A new
  fact arrives only with a date and a grade, appended, never silently edited in.

**One open item this file records and does not own.** `graph.json` reports the
human-gated load as 2.5 h on Day 1 but **4.0 h on Day 5 and 4.0 h on Day 6**
against a 2.5 h/day budget, and records it as
`capacity.human_hours_are_budgeted_in_total_not_per_day`. No rank of the cut
ladder touches it — all five human-gated nodes are cut rank 0 — so it is a
**D4-scope decision for PM**, not a defect any writer can close.
