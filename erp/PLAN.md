# outpocket — PLAN.md

> **Master entry point.** If you are a session picking this project up, this is
> the first file you read and the last one you argue with. Everything in it is
> the residue of four adversarial review rounds and one full competitive census.
> It has already been narrowed. Do not re-widen it.
>
> **This file is NOT an authority.** `erp/graph.json` owns node identity, owner,
> hours, cut rank and acceptance predicates; `erp/PATHS.md` owns every literal
> path, filename and command name. Everything below quotes those two. Where this
> file and an authority disagree, the authority wins and this file is regenerated
> — not argued with.

Written 2026-08-28. Regenerated 2026-08-28 against `graph.json` **v2.3.0**.
Sprint A deadline **2026-09-03 13:00 PT**.

> **Every table in this file is generated and checked, not typed.** The day table
> (§6.3), the cut ladder (§7), the freeze list (§6.2), the critical path (§6.1) and
> the capacity arithmetic (§6.4) are restatements of `graph.json`, and a
> restatement is legal in this project **only while a checker proves it equal to
> the authority** (R-22). `node tools/ready.mjs --check-tables` diffs every one of
> them field by field against `graph.json` and `capacity.schedule_A`;
> `node tools/ready.mjs --check-schedule` proves the day table respects the graph's
> own edges and its own 6 h/seat/day cap. Both subcommands are produced by **G0**
> on Day 1. Until G0 is green these tables are hand-verified — which is exactly the
> condition R-22 exists to end.

---

## 0. READ THIS FIRST

Read in this order. Stop when you have what you need; do not skim past step 3.

| # | File | Why | Time |
|---|---|---|---|
| 1 | `erp/PLAN.md` (this file) | Strategy, claims, schedule, closed decisions | 15 min |
| 2 | `erp/graph.json` | **AUTHORITY.** Every node: owner, inputs, outputs, `accept`, hours, cut rank, horizon | 15 min |
| 3 | `erp/PATHS.md` | **AUTHORITY.** Every canonical path, filename and command. If you are about to type a path from memory, stop and open this | 10 min |
| 4 | `~/mcp/countinghouse/HANDOVER.md` | The carried-over truth. §3 API iron rules, §5 retracted claims, §6 competition, §7 killed directions | 20 min |
| 5 | `erp/GRAPH.md` | The readable human view of `graph.json`. Never the source of a number | 15 min |
| 6 | `erp/` siblings (contracts, charters, eval, risk) | Only the ones for your lane | as needed |
| 7 | `~/mcp/gatehouse/BUILD.md` §2 | A parallel workstream's measured API findings. §2 items 9–14 bind us | 10 min |
| 8 | `~/mcp/countinghouse/src/` | 1,396 lines of pure logic to **port, not rewrite** | when you touch L0/T1/S3 |

### Three prohibitions that apply to every session in this project

1. **NO new web research.** `WebSearch` and `WebFetch` are forbidden for Sprint A
   work. Four rounds of research are already done and are in HANDOVER. Re-running
   them costs days and has, historically, produced worse conclusions than the ones
   already banked. The unknowns register (**V0–V4**, answered by the V-lane nodes
   of the same names) is **measurement on browsers installed on this machine**,
   not research — that is allowed and required.
2. **Never write a claim listed in HANDOVER §5.** The lint hook (**G4**) will block
   the obvious ones; the non-obvious ones are on you. If you are about to write
   "impossible without WebMCP", "the tool surface is the boundary",
   "machine-verified", "structural guarantee", or "we are the first to…", stop.
   **Three more joined the register this round and G4's `--assert-register` fails
   if they are missing from it:** "a commit cannot be made without a human
   decision" (R-13 — see §3), "the five write tools" (R-20 — the count is seven and
   is computed, never written down) and "a specific agent" (R-21 — WebMCP exposes
   no agent identity).
3. **Never cite WindTunnel or arXiv 2508.09171.** Either citation is an
   on-the-spot puncture in front of judges who will know. See HANDOVER §5.

> **Note for the owner of G4 (I4):** this file and `~/mcp/countinghouse/HANDOVER.md`
> quote the banned strings *in order to ban them*. G4's accept already encodes the
> exemption — it excludes `erp/**`, `kb/webmcp/BANNED.txt`,
> `kb/method/BANNED-CITATIONS.md` and `.team/lint/banned.txt`, "and the exclusion
> list is a literal array in the source, never satisfied by deleting quotes"
> (`graph.json`, **G4** `accept`). Verify the exemption exists rather than
> deleting the quotes — the prohibitions are unenforceable if nobody can read
> what is prohibited.

### English only

All three repos are English-only. The user communicates in Chinese; the
artifacts do not. Comments, commit messages, tool descriptions, README, video
narration: English.

---

## 1. What outpocket is

**outpocket is a WebMCP expense-reimbursement desk where the employee's own agent
operates inside the employee's already-authenticated session.** The employee opens
the reimbursement page, is already logged in, and their agent — ChatGPT's built-in
browser, or Chrome with WebMCP enabled — picks up a set of tools that the page
registers on itself. The agent drafts the report. The employee signs it. The
server, per request, decides what was actually allowed. There is no second front
door, no second identity system, no service account minted for a robot, and no
broker in the middle holding a rotating credential on the company's behalf.
Reimbursement was chosen because it is the ordinary, high-frequency, personally-
accountable corporate transaction: the human's signature is not decoration, it is
the thing that makes the claim a claim.

Strategically, this project is not a bid to be novel. Three rounds of hunting for
an original angle hit walls, and the fourth had negative expected value
(HANDOVER §8). The census is unambiguous: **623 candidate repos in the contest
window, 529 of which genuinely call `document.modelContext`; 46% already ship a
dynamic tool surface, 38% already ship a human-approval step, 44% already ship
what looks like a complete product** (MEASURED, 2026-08-28, HANDOVER §6). Shipping
a whole product is the **threshold, not the advantage**. But only **24 of 420
(5%) attached a video**, and the video is a disqualification-level requirement.

> **Read the denominators, they are not the same number.** 623 is the candidate
> set; 529 is the subset that genuinely calls `document.modelContext`; 420 is the
> subset that reached the Devpost gallery. A percentage in this project is
> meaningless without the base it was taken over, and mixing them is how "44%"
> and "199/420" ended up describing different populations in the same table.
So the winning move is not mechanism novelty — it is being one of the small number
of entries that actually lands a compliant, working, demonstrable submission, with
mechanisms that are *specifically* defensible rather than *generally* impressive.
Execution is 25% of the rubric and we are currently at zero on it. That is the gap
this plan closes.

---

## 2. Dual horizon

This plan is deliberately dual-horizon and every node carries an `A` or `B` tag in
`graph.json`. Horizon A holds **62 nodes and 118.0 agent-hours**; lane X is the
whole of horizon B (6 nodes, 15.5 h).

**Sprint A — the contest. 2026-08-28 → 2026-09-03 13:00 PT (~5.5 days).**
Sprint A's deliverable is not "the code"; it is a *public repo + a live URL + a
video*. Contest hard requirements (PUBLISHED, contest rules, restated in
HANDOVER §1 and gatehouse BUILD.md T16.5):

- a **public** repo (GitHub/GitLab), with full running instructions and all assets
- an OSI **LICENSE at the repo root**, visible in the GitHub **About** box
- a **public video under 3 minutes, WITH AUDIO**, in English

**The repos are PRIVATE today** (MEASURED 2026-08-28: `outpocket`,
`webmcp-dev-kit`, `webmcp-eval-kit` all exist on `github.com/Caleb0796/` with one
initial commit each; `outpocket` already carries a 1066-byte LICENSE and a
1376-byte README.md, so **G1** is a visibility flip plus About-box verification,
not a licensing task — `graph.json.contradictions_with_skeleton[0]`). Flipping to
public is node **G1** and it is a *gated* node — a human must perform it.
**G1 executes on Day 6, immediately before D5 (submission).** The contest
requires a public repo *at submission*, not during the build, and keeping work
private until then is the lower-risk default. See §8, D-12 (superseded) and
D-30.

**Track B — after the deadline.** Lane **X** (extraction of the reusable modules
into `webmcp-dev-kit`, and promotion of the eval harness into `webmcp-eval-kit`)
is horizon B **by default and must never sit on Sprint A's critical path**. If a
Sprint A node ever names an X node as an input, that is a graph bug: file a
deviation ticket with PM. During Sprint A the two kit repos may receive README
edits and nothing else. `graph.json` records that firing the X rank frees
**0 horizon-A hours**: "Its 15.5 h are NOT part of `agent_hours_total_A` and
firing this rank changes no Sprint A number."

---

## 3. THE TWO DEFENSIBLE CLAIMS

**This is the most important section in the plan.** Four review rounds narrowed
the pitch from eight original angles to two claims. Everything the video says,
everything the Devpost answers say, everything the README says must reduce to one
of these two. Anything that does not reduce to them is decoration and gets cut
first.

### Claim (a) — outpocket does not add a credential holder

**Precisely:** the agent acts through the employee's existing browser session.
Every *other* way an agent reaches an expense system today requires minting a
credential that is **separate from the employee's login state**, and that
credential must then be **held and rotated by some intermediary** — an integration
broker, a service account, an OAuth app registration. outpocket removes that
intermediary from the picture by never creating the second credential in the first
place.

**What claim (a) does NOT say — memorise these four:**

1. It does **not** say third-party agents cannot reach an ERP. **They can.**
   Truto sells a hosted Fusion Procurement MCP; `cloudorcl-lab/FusionRest-MCP`
   exposes a generic `rest_call`. (PUBLISHED, HANDOVER §4.) Anyone who says
   otherwise in this project is wrong and will be corrected in public.
2. It does **not** say the integration-broker space is empty. **Truto, Merge,
   Paragon and Nango are competitors, not a blank cell.** We must name them
   ourselves before a judge does.
3. It does **not** claim we invented "narrow inputs + reuse existing auth."
   OpenAI and Chrome have both published that as general guidance, **and people
   from both companies are on the judging panel** (PUBLISHED, HANDOVER §5). Framing
   it as our insight is the single fastest way to lose credibility.
4. It does **not** say "raw material never resides in the system." That is
   **false for us** — attachments are uploaded by a human *and stored* (F3). The
   only surviving narrow version: **the derivation context does not enter the
   database.**

> **Standing contingency (`graph.json.contingencies`, owner L2):** if **V3**
> reports that an agent-initiated `execute` does not carry the page session
> cookie, "Kernel 3 is dead as stated. Fall back to a page-held bearer token
> minted at login and passed by the page bridge, and retract 'no new credential
> holder' to 'no credential leaves the page'. Costs about 1.0 h inside S1, which
> S1's 2.5 h does not contain — S1 goes to 3.5 h and the path is recomputed."

### Claim (b) — the write is bound to the snapshot, and the binding is auditable

> **R-44 narrowed this claim, and the previous wording was a straight R-13 violation
> sitting in the pitch.** It read: *"a specific authenticated human reviewed a specific
> canonical snapshot, the write arrived through the tool surface rather than the UI."*
> Both halves are unprovable — the machine cannot establish personhood, and
> `survivingVector` commits over plain HTTP with no tool call. Do not restore it.

**Precisely:** the site turns a consequential write into an auditable record that binds **what was persisted** to
**what was on screen**: the commit carries the digest of the exact canonical snapshot the sign dialog
rendered, the server re-canonicalises and refuses on any difference, and the record names the
authenticated session subject and the server's own clock — neither of which the client can supply.
**What it proves and NOT ONE WORD MORE (R-13, restated by R-44):** *a commit cannot be made without a
POST from the authenticated session to `/api/sign/{request_id}/respond`* — and, if a human did sign,
that what was stored is byte-identical to what they saw. It does **not** establish that a person
reviewed the snapshot, and it does **not** establish that the write arrived through the tool surface:
the surviving forgery uses direct HTTP and no tool call at all.

**What claim (b) does NOT say — memorise these five:**

0. **It does not name an agent, ever (ruling R-21).** The previous revision of this
   very paragraph said we can prove "a specific authenticated human **and a
   specific agent** were on the same page." That is false and it is now a
   retracted claim that G4's `--assert-register` scans for: **WebMCP provides no
   agent identity** — the specification says the browser agent uses a different
   internal mechanism — and H3, our own in-page fallback, is indistinguishable
   from a third-party agent at the tool boundary. Attest **the human**, **the
   snapshot** and **the call**. Never the agent.
1. It does **not** say only WebMCP puts a human in the loop. **A site cannot
   force a human to be present.** We attest to presence when it occurs; we do not
   guarantee it. See the sign-gate paragraph below for exactly how far that goes:
   further than the previous revision claimed, and less far than it wanted.
2. It does **not** say the human-sign gate is our differentiator. **That phrasing
   is already publicly occupied by `webmcpui`** ("That's the line webmcpui draws by
   default", PUBLISHED). Our difference exists only one level down, at the
   mechanism: **the signature binds the SHA-256 of the canonical snapshot the human
   read, and the server re-canonicalises on receipt and rejects on mismatch** (S5 +
   S6). If we say "human in the loop" and stop, we have said nothing.
3. It does **not** claim to be the first confirmation layer. **OpenAI's client
   already ships one**: "Normal website-access and confirmation policies still
   apply, including for consequential actions." (PUBLISHED.) We must state this
   ourselves and then say exactly what we add — the answer is only ever
   *snapshot-digest binding + server-side re-canonicalisation*.
4. It does **not** say "the tool surface is the boundary." **The tool surface is a
   menu, not a lock.** Correct phrasing, mandatory everywhere: **the tool surface is
   the intent surface; the boundary is on the server** (HANDOVER §5). This is a G4
   lint rule.

**The signature protocol is server-owned (ruling R-1, `graph.json.rulings_applied`).**
The server does not verify a client's claim about a human decision; it owns the
decision. Sign requests carry server state `open → answered(signed|declined) →
committed | expired`; the click POSTs `/api/sign/{request_id}/respond`; the server
takes `signed_by` from the **session cookie** and `at` from the **server clock**,
never from the payload. `commit_request` carries a `request_id` and no signature
object. Anyone writing copy that says the page "submits a signature" is describing
a forgery we deliberately removed.

**And here is the exact edge of what that buys us (ruling R-13). Say this
sentence and no stronger one:**

> **A commit cannot be made without a POST from the authenticated session to
> `/api/sign/{request_id}/respond`.**

That is the whole provable claim. **"A commit cannot be made without a human
decision" is deleted from this project** — it is on `kb/webmcp/RETRACTED.txt` and
`node tools/lint-layer0.mjs --assert-register` (G4) fails if it is not — and no
document may flag the sign-gate forgery as closed. The reason is a second forgery
that survives R-1 and is inside our own N-04 threat model (curl, session cookie,
no browser): the attacker submits a report, **never renders the dialog**, POSTs
`/respond` itself with the digest and revision the server just issued, then
commits. It commits **today, and today means before the `confirm_token` ships —
S5, Day 3** (R-36). That qualifier is load-bearing and it belongs in every
sentence that makes the claim: `signature.schema.json`'s `x-signRequestState`
states the vector flatly as *"IT COMMITS"* and walks **twelve of the fourteen**
rejection codes, omitting `E_NO_CONFIRM_TOKEN` and `E_ALREADY_ANSWERED` — and
`E_NO_CONFIRM_TOKEN` is precisely the code that refuses that body once S5 lands.
So: **before Day 3 it commits and every code that exists is walked and none
fires; from Day 3 the same body is refused 403 `E_NO_CONFIRM_TOKEN`, and that
refusal is the control HOLDING, not a silent change nobody wrote down.** It is
scripted as negative control **N-16 `neg-respond-without-click`** in S5's own
accept, which records both outcomes and fails if either moves without the record
moving with it, rather than asserting a refusal we do not have.

**What R-1 bought, and what it cost, stated together because they are the same
fact.** The attacker loses the ability to choose the name and the timestamp. The
record that results is therefore a **true attribution of a false event** — signed
`chen`, at a genuine server time, forensically indistinguishable from a real click
in the day book forever. That is a worse forensic object than the old forgery in
one specific way, and we write it down rather than let a judge find it.

**The `confirm_token` is defence in depth, not a proof.** S5 mints it with the sign
request and delivers it **only into the rendered dialog's DOM** — never in a
tool-call result, never in any `/api/sign/{id}` response body — and `/respond`
requires it. **Residual risk, stated exactly:** this raises the cost of the attack;
it does **not** establish personhood. **`V3` measured COOKIE CARRIAGE ONLY (R-44).** The vector stays open for any caller that **also**
obtains read access to the rendered dialog's DOM — and *nothing measured establishes that second
conjunct for this client*: no run rendered a sign dialog, queried a DOM, or lifted a token. This is
**not** a closure; it removes an unsupported assertion about *which* caller has the access.
`contingencies[3]` fires for the cookie conjunct only; owner L2.
**`V6-consent-gate` gets no credit (R-44)** — a client policy this server cannot
observe, require, or fall back on is demo friction, not a mitigation.

### The third thing we must self-disclose

OpenAI's platform states: *"Website-provided tool definitions and results are
untrusted content."* The platform requires the agent to treat our page as
untrusted input. We say this out loud in the README and in the Devpost answers.
Self-disclosure beats being caught — this is an explicit user preference
(HANDOVER §11).

---

## 4. The five kernel mechanisms

Each mechanism gets **one sentence that makes it non-generic** in a field where
46% already ship a dynamic tool surface and 38% already ship a human-approval
step. If you cannot recite the non-generic sentence, you cannot present the
mechanism.

### ① Tool surface as state machine — lane T
The surface is compiled from `role × object-state × validation-verdict`; the tool
set flips 1 → 5 → 12 → 13 as the report moves through states.

> **Non-generic sentence:** 46% of the field flips tools, so the flip is not the
> differentiator — what we add is the *third* state: a resident read-only
> **absence register** (**T3**) that answers "why is the tool I need not here, and
> what restores it" in the same `{code, severity, field, fix, candidates}`
> envelope as a violation, which is a direct answer to the working group's own
> open issues **#199** and **#262** (opened inside the contest window, still
> unanswered). *(Evidence: issue existence and zero replies = MEASURED 2026-08-28.
> We make no claim about how many other entrants do something similar: our census
> was keyword-based and this project has been wrong three times about
> keyword-derived empty cells. Until a concept-level re-test with three vocabulary
> variants is recorded here, say only what ours does.)*

### ② Policy resident in the page — lane S
A versioned policy document produces deterministic violations shaped
`{code, severity, field, fix, candidates}` on every write tool (**S3**, **S4**).

> **Non-generic sentence:** deterministic policy contracts are **not ours** —
> Oracle Expenses REST already returns per-field `expenseErrors`, UCP has an
> isomorphic error envelope, and `claimready` ships the same claim (PUBLISHED,
> HANDOVER §5); what is ours is that **the violation envelope and the tool surface
> are compiled from the same policy artifact**, so a finance edit that bumps the
> policy version changes what tools exist within the same agent session, instead of
> changing an error message the agent may ignore.

### ③ Session as credential — lane S
Per-request, server-side role authorisation against the cookie session the human
already holds (**S1**, **S2**).

> **Non-generic sentence:** the strongest same-shape competitor, `upgradedev/claimready`,
> is entirely client-side and its own README says *"The page does not know who
> pressed a button, nothing here records it."* (PUBLISHED) — a server, a session and
> a persisted ledger is the one structural blank the field leader left open, and we
> make it *falsifiable by a judge with no agent at all* by shipping curl-level
> privilege-escalation tests in the repo (**S2**).

### ④ Human-sign gate — lane S
The submit tool returns `{status:"awaiting_signature", ticket}` **immediately** and
the signature arrives on a second call — the two-call handshake, which is the
**shipped** mode (R-43). It is not a preference: **V4 is MEASURED at 22.3 s** in the
ChatGPT built-in browser, and nobody reviews and signs a report in 22 seconds, so a
suspended `execute` would not risk a timeout, it would time out every take. What
freezes the report across the gap is the server-held sign lock (**S12**), which is
what froze it all along. A visible dialog shows the worst-case consequence above the
signature line; the signature binds the digest of the canonical snapshot (**S5**),
the atomic sign lock is taken in the same synchronous step (**S12**), and the
server re-canonicalises and rejects on mismatch (**S6**).

> **Non-generic sentence:** 38% of the field ships an approval step and the phrase
> is already publicly claimed, so the only question that separates implementations
> is **what the approval is bound to** — ours binds to a snapshot digest and is
> re-checked server-side before commit, which closes the time-of-check/time-of-use
> window between "the human approved" and "the server persisted" — *given a single
> server instance*, because the sign lock and the snapshot computation are taken in
> one synchronous step (OUR-ESTIMATE, true by construction; `CONTRACTS.md §7.4`).
> D1 must deploy exactly one instance, and the deploy notes must say why.

> **The claim this mechanism may make is bounded (R-13), and the bound is in §3.**
> The gate proves that a POST arrived from the authenticated session; it does not
> prove a person clicked. Do not upgrade that sentence in the video, the README or
> the Devpost answers. **N-16 `neg-respond-without-click` commits today —
> "today" meaning on the build as it stands, before the `confirm_token` ships
> with S5 on Day 3** (R-36). S5's accept says so in both directions; C3's charter
> is rewritten to attack it (E9, Day 5, which is *after* S5, so the expected
> result there is 403 `E_NO_CONFIRM_TOKEN` and that is the control holding); and
> the `confirm_token` raises the cost without closing the hole. Neither half of
> that may be written up as more than it is: not "the forgery is closed", and not
> "the gate is stronger than R-13 permits".

> **The revoked set is COMPUTED, and the number is seven (R-20).** While a sign
> request is open, the tools that disappear are derived from
> `annotations.readOnlyHint !== true` — in `S2-emp-draft-clean` that is **seven
> tools, not five** — and the count is never hard-coded in a document, a schema or
> a narration. **"the five write tools" is a retracted claim** on
> `kb/webmcp/RETRACTED.txt`; `signature.schema.json`'s `x-freeze.does[0]` still
> carries it and is wrong, and `graph.json` is the authority against it. T4's
> accept is what makes the count computable, by asserting that every read-only tool
> actually carries `readOnlyHint: true`.

> **On the consequence line:** printing the worst-case consequence *above the
> signature line* (**F4**) is zero-cost and our keyword scan of 623 repos matched
> it once — but that scan has not been re-tested at the concept level, so treat it
> as "we found one, we did not look hard" (OUR-ESTIMATE), not as evidence of
> rarity. It is in the plan because it costs nothing and it makes the signature
> mean something, not because it is unique.

### ⑤ Per-field provenance — lane S / F
Every field on the report records whether it was agent-proposed or human-edited
(**S8**), and the SHA-256 day-book chain's digest **covers the source field**
(**S7**).

> **Non-generic sentence:** do **not** claim this cell is empty — strict per-line
> provenance matched 0/420 by regex but generalised audit/ledger matched 53%, and
> HANDOVER §7 records that "the empty cell is a vocabulary illusion" is a mistake
> this project has now made **three times**; the defensible statement is narrower
> and mechanical: **because the hash chain's digest covers the provenance field,
> rewriting who authored a number breaks the chain**, which is a property you can
> demonstrate in ten seconds rather than a claim about the field.

> **Both S7 and S8 are cut rank 3.** If PM fires the ladder to rank 3, mechanism ⑤
> is amputated entirely and three of five kernels survive. See §7.

---

## 5. The demo narrative

### Three beats

**Beat 1 — the surface moves under the agent (mechanism ①②).**
Finance edits a policy rule. The policy version bumps, visibly (**F5**), and the
live surface inspector shows the tool set change — *that* is on our own page and
is unconditional. Whether the agent's client re-reads the tool list without a
re-prompt was open unknown **V2**, and **V2 is MEASURED `refreshes`** (2026-08-29,
ChatGPT built-in browser, Chromium 151, on `https://webmcp-probe.onrender.com`): a
tool registered at runtime reached the agent with no page reload. The narration
still says "on its next turn", never "on the spot" — the measurement licenses the
beat, it does not license the stronger phrasing, because what refreshed was the
list the agent read on its **next** turn. The absence register (**T3**) then tells it, in structured
form, why the tool it wants is gone and what would bring it back.

**Beat 2 — the same sentence, two sessions (mechanism ③).**
The identical prompt is given in an employee session and in an auditor session. In
the employee session it works. In the auditor session **the tool does not exist at
all**. Then we bypass the page entirely and hit the endpoint by hand: the server
returns a real **403**. Menu, then lock — in that order, on camera. There are
exactly **two** personas, `chen` (employee) and `ruiz` (auditor), matching the
frozen enum in `erp/contracts/eval-case.schema.json` (ruling R-5).

> **The approval prompt is part of this beat and is scripted, not survived.**
> MEASURED 2026-08-29 (`V6-consent-gate`, `evidence/V6-consent-gate.json`): on a
> **remote** origin the ChatGPT built-in browser refuses to run a tool whose fetch
> would carry the page cookie until the human approves **that specific call** —
> *"the browser blocked it pending action-time approval"* — and on `localhost` the
> identical call runs with no prompt at all. Every tool call in this beat is
> cookie-bearing, so on the judged origin the prompt **will** appear on camera.
> `docs/VIDEO-SCRIPT.md` gives it its own cue, and the narrator says **only** this:
> *the client is asking for approval before this cookie-bearing call.* **R-44 cut the
> line that followed** — *"which is the thing the page is arguing for"* — because it
> reads as our design being vindicated by someone else's client. It is not evidence
> that our design works, it proves neither human review nor co-presence, it is absent
> on localhost, and no claim anywhere may rest on it. And the rehearsal must be done on
> the **remote** origin — a localhost rehearsal will not show the prompt at all and
> will leave the crew surprised on the take that counts.

**Beat 3 — the agent changes the number after the human signed (mechanism ④⑤).**
The human reviews a report and signs. The agent then alters the amount and submits.
The server re-canonicalises, the digest does not match, and the write is **rejected
before it lands**. The day-book chain is shown intact.

### Why the demo must NOT open with form-filling

Four reasons, in descending order of force:

1. **It argues against our own premise.** An agent typing values into an expense
   form is the one part of this workflow that a plain LLM plus a DOM has done for
   two years. Opening there tells a judge that WebMCP was optional.
2. **It is the single most crowded frame in the contest.** 46% of 529 real
   implementations ship a dynamic tool surface, an external "Business Receipt →
   Expense Report" WebMCP demo already exists, and an internal collision estimate
   put head-on overlap at 90–98% for the generic version of this scenario
   (OUR-ESTIMATE, agent-team memo 2026-08-28). Our first ten seconds must be the
   part nobody else's video contains.
3. **The judges may never run it.** Contest rules: *"Judges are not required to
   test the Project and may choose to judge based solely on the text description,
   images, and video."* (PUBLISHED, HANDOVER §5.) Three of our four differentiators
   are server-side invariants that are invisible on screen unless we deliberately
   stage them. **The real deliverable is the video.**
4. **Time.** Under 3 minutes total. Data entry is the most expensive second per
   unit of argument in the whole storyboard.

**Mechanism in the first 10 seconds** is a hard acceptance condition on **F0** and
**D4** alike: both accept predicates require that `docs/VIDEO-SCRIPT.md`'s first
cue is "timestamped <= 00:10 and contains at least one literal token from
`kb/webmcp/MECHANISMS.txt`" (`graph.json`, F0/D4 `accept`).

---

## 6. Sprint A schedule

The gate at the end of each day is a **command**, not a judgement. If the command
does not pass, the day is not done, and PM decides between slipping the day or
executing a cut set (§7).

### 6.1 The critical path — quoted, never asserted

The previous revision of this file asserted a chain of its own
(`V1 → T1 → T2 → S1 → S2 → S5 → S6 → E6 → D1 → D4 → D5`). Five of its ten links
were not edges, one ran backwards, and the hours did not sum. **It is deleted.**
The authority's path, copied verbatim from `graph.json.capacity`:

```
L0 -> V5 -> S10 -> S1 -> S3 -> S4 -> T2 -> H3 -> H6 -> D4 -> D5 -> D6
```

12 nodes, hours `3.5, 1.5, 2, 2.5, 3, 1.5, 3, 2.5, 2, 4, 2, 2` — **29.5 h**, seats
`L1, I1, L1, I3, I3, I3, I2, I1, I1, UX, I4, QA`. **It moved from 29.0 h to 29.5 h
in v2.3.0, and position 2 rerouted from `T6` to `V5`. No estimate moved.** The
mover is the pair of hard edges `V5 -> S10` and `V5 -> G6` that v2.3.0 adds: `V5`
writes `erp/contracts/probe-verdict.schema.json`, the ninth contract file, into the
directory `S10` freezes and `G6` validates, and only the schedule ordered them —
`--check-schedule` proves `day(u) <= day(v)` over **hard edges only**, so with no
edge there was nothing to prove. `V5` is 1.5 h against `T6`'s 1.0 and both feed
`S10` from `L0`, so the deepest walk into `S10` is now through `V5`. `T6` keeps its
hours and its place in the graph; it is simply no longer the deepest way in. The
last ten nodes are unchanged. The longest *divergent* path is **27.5 h**
(`L0 -> V5 -> S10 -> S1 -> S3 -> S4 -> S5 -> S12 -> S6 -> E3 -> E9`), so there is
still 2.0 h of clearance behind the spine. The earlier move, retained: 28.5 h to
29.0 h came from **L0 gaining 0.5 h** when `erp/RUBRIC.md` became one of its
outputs (R-16). Method, quoted:

> "Longest path by earliest-finish over hard edges only, horizon A, computed from
> the hours field. Recompute with `node tools/ready.mjs --path` (G0) after any
> estimate change; never assert it by hand."
> Grade: **OUR-ESTIMATE.** "It is NOT MEASURED: `tools/ready.mjs` does not exist
> yet." It becomes MEASURED on the first green **G0** run, which is Day 1.

An important property: at 29.5 serial hours against ~132 wall-clock hours, the
critical path is **not resource-bound, it is attention-bound**. Agent hours are
118.0 of an available 396. The scarce resource is the user's 2.5 h/day (§6.4).
Every gate below is therefore designed to be *one command the user can run and
read in under a minute*.

### 6.2 Where the day table comes from, and what changed in it

**The schedule stopped living in this file.** In v2.1.0 it became
`graph.json.capacity.schedule_A` — an authority block with its own calendar, its
own day lists and its own `verified` line — and §6.3 below is a **restatement of
that block**, legal only while `--check-tables` and `--check-schedule` are green
(R-22). `erp/PATHS.md` §5 says the same thing from the other side: *"Which day a
node runs on is owned by `graph.json.capacity.schedule_A` and by nothing else."*

That change exists because of a specific failure. **`V1`'s day disagreed across
three documents** — Day 1 in `graph.json`'s notes, Day 1 in `RISK.md`, **Day 2** in
this table — so RISK's "Day 1 23:59" trigger fired by construction against the
plan's own schedule, on a cut-0 human-gated node gating three contingencies. There
is now one place to look.

How `schedule_A` was built, quoted in substance from the authority: all 62
horizon-A nodes list-scheduled in topological order over hard edges, critical-path
priority as the tie-break, one seat treated as one machine at **6 productive
agent-hours per day**. Properties, all re-verified by execution for this revision:

- **62 of 62 horizon-A nodes appear in exactly one day.** No duplicates, no
  omissions, and nothing from horizon B is scheduled.
- **Zero backwards orderings — on hard edges *and* on soft ones.** Every
  predecessor sits on the same day as its consumer or an earlier one.
- **The 6 h/seat/day assumption is now BINDING, and it was fixed on the schedule
  side, not the assumption side (NEW-10).** The previous table broke the graph's
  own figure three times — I3 at 8.0 h on Day 2, I1 at 6.5 h on Day 2 and 7.0 h on
  Day 3 — while quoting that same 6 h to justify the agent-capacity total. It is now a
  named field, `capacity.seat_day_hours_cap: 6.0`, enforced by
  `node tools/ready.mjs --check-schedule`, and **the peak seat-day is exactly 6.0**
  (I1 Day 2, I1 Day 3, I3 Day 3, I3 Day 4, UX Day 4). S9 moved to Day 2, S5 to
  Day 3, S2 to Day 4 and S7 to Day 5 to get there. The cap counts **agent** hours
  only: the five human-gated nodes are drawn from the human's budget, because the
  seat is waiting on a person rather than working.
- Three human floors sit on top of the topological order: **G1** on Day 6, before D5
  (D-12), **D4** not before Day 5, **D5/D6** on Day 6 — so Day 6 carries no code.
- All five interface freezes in `graph.json.interface_freezes` meet or beat their
  stated deadline: `erp/contracts/violation.schema.json` by **S10** (Day 1,
  deadline end of Day 1) · `erp/contracts/session.contract.md` by **S1** (Day 1,
  deadline end of Day 2) · `artifacts/tools.export.json` by **T5** (Day 3, deadline
  end of Day 3) · `evals/blind/rubric.schema.json` by **E4** (Day 3, deadline end
  of Day 4) · `docs/STORYBOARD.md` shot ids by **F0** (Day 1, deadline end of
  Day 2).

**Six nodes moved in v2.1.0, and every move closed a node that could not have run
where it stood** (`schedule_A.changes_from_the_previous_day_table`):

| node | was | now | why it could not run where it was |
|---|---|---|---|
| **V5** | Day 1 | **Day 0** | V1 opens the built-in browser against this origin on Day 1, and I1's Day 1 was over the seat cap |
| **V0** | Day 3 | **Day 1** | both consumers preceded it — H5 Day 0, V6 Day 2 — so V6 could only ever record it `UNVERIFIED`. Dead work as scheduled |
| **V1** | Day 2 | **Day 1** | three documents disagreed; RISK's Day-1 trigger fired against this table (NEW-5) |
| **H5** | Day 0 | **Day 2** | its accept runs `node --test`, which needs L0's tree, and it had **no hard path to L0 at all**. The edge `L0 → H5` was added with the move |
| **T4** | Day 1 | **Day 3** | it asserts a property "in every one of the SIX canonical states"; five of the six do not exist until T2 runs on Day 2 |
| **F6** | Day 1 | **Day 4** | it resolves shot ids against the **built page**; F1 is Day 2 and F4/F5 are Day 3 |

Re-derive it — do not edit it by hand — whenever an estimate or an edge changes.
The edit goes in `graph.json`; this file is regenerated from it.

### 6.3 The day table

Two mechanical properties hold over everything below, and both are checked rather
than asserted:

1. **Day membership is quoted, not decided here.** Every row comes from
   `graph.json.capacity.schedule_A.days`, which is new in v2.1.0 and is now the
   only authority on which day a node runs. `node tools/ready.mjs --check-tables`
   diffs this table against that block row by row and
   `node tools/ready.mjs --check-schedule` proves `day(u) <= day(v)` on every hard
   edge and that no seat exceeds `capacity.seat_day_hours_cap`. **A restatement is
   legal only while those two are green** (R-22).
2. **Every gate block is the named node's `accept` field, quoted byte-for-byte.**
   There is never a second copy of a command in this project. Every gate drift the
   audit found came from hand-writing one.

Within a day, rows are printed in topological order over hard edges, so the table
never reads backwards even where the schedule permits two nodes to share a day.

**The gate for a day is mechanical: the day is done when every cut-rank-0 node
scheduled on it is green.** All 35 cut-0 nodes appear exactly once, on their
scheduled day, with their full predicate. Cut-1/2/3 nodes are listed in the day
table but do not gate the day — that is what a cut rank means.

#### Day 0 — 2026-08-28, evening — Ground zero — nothing exists yet

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **L0** | L1 | 3.5 | 0 | Day-0 bootstrap: repository, .team tree, Codex profiles, ported spike |
| **V5** | I1 | 1.5 | 0 | Throwaway HTTPS probe origin with a cookie-echo endpoint |

Nothing existed before L0. MEASURED 2026-08-28 (`graph.json.contradictions_with_skeleton`):
`outpocket` tracked exactly `.gitignore`, `LICENSE` and `README.md`; `ls ~/.codex/*.config.toml`
returned no matches; `erp/` was entirely untracked. Four of sixteen seats could not boot and the
first node in the graph could not run its own accept.

**L0's seven gates run in the order printed, and the order is the fix (R-15, extended by R-24
and R-25).** Two revisions ago the repository was cloned in gate (2) and committed in gate (5), so
`npm ci` ran against a clone of a tree that tracked three files and reproduced `npm error code
EUSAGE … can only install with an existing package-lock.json` — the exact error this node exists to
eliminate. The commit is now gate (5). Two more gates were added this revision, both for defects
that could not have been caught by reordering. **Gate (1) is the PM ruling `D-17`** (R-24): it
decides whether 27 of the 62 horizon-A nodes exist and is due "before any seat is dispatched", yet
its only recorded home was `erp/DECISIONS.md`, a `V6` output on **Day 2**, while Day 0 held only
`L0` and `V5` — so `L0` now creates that file and gate (1) fails unless the row parses and
`capacity.human_hours_available` equals the ruled per-day figure × 5.5. **Gate (6) pushes** (R-25):
`origin/main` is still the three-file initial commit and `erp/` is untracked, nothing else in the
graph pushed, and `G3` (Day 1, cut 0) clones the GitHub URL and runs `npm ci` against a tree it
never sees locally. Gate (7) therefore clones the **pushed remote**, not `.`, because cloning `.`
proved a property of a tree no downstream node reads.

**And R-26 unties the knot R-25 tied, which was the first thing a Day-0 seat hit.** Gate (2)
declares that the tree gate (6) pushes carries **exactly one failing test** — `auditor surface:
read-only by construction`, the known red test `T6` fixes on Day 1. Gate (7) then required a fresh
clone of **that same commit** to `npm test` **exit 0**. One node demanded zero failures and exactly
one failure of one commit, so the first node of the sprint failed itself, roughly ninety minutes
in. The same knot re-tied at `G3`, which clones the same remote and requires zero failures, while
gate (6) read "nothing else in this graph pushes" and all sixteen charters say never `git push` —
so `T6`'s fix never reached `origin` for anyone to clone. **Three edits, all landed:**

1. **Gate (7) asserts the one known failure by name** — 24 tests, exactly 1 failure, and that
   failure named — not exit 0. This is *stronger*: exit 0 is also satisfied by a suite that
   silently stopped discovering tests, which is precisely the failure `npm test -- <name>`
   already produced once in this project (R-23).
2. **L1 pushes on every merge to main**, as a **standing obligation** of the merge protocol rather
   than a one-time gate. Gate (6) is the *first* push, not the only one; no other node's `accept`
   runs `git push` and the charters' rule stands unchanged. The obligation itself is stated in
   `TEAM.md`'s merge protocol and `charters/L1.md`.
3. **`G3` keeps its hard edge from `T6` and asserts zero failures** — plus `HEAD` equality between
   the clone and the working tree, which is the clause that actually catches "the fix was never
   pushed". Re-verified by execution after the change: bijection 119/119, acyclic, cut invariant
   **0 violations over 100 qualifying edges**, critical path **29.0 h** unchanged, schedule 62/62
   with peak seat-day **6.0**.

**L1's first boot is the one permitted exception to the symlink rule (R-15).** `.team/charters` is
a symlink L0 itself creates, so L1 cannot read `.team/charters/L1.md` before running L0. **L1's
first boot, and only its first, reads `erp/charters/L1.md` directly**; every later boot and every
other seat uses `.team/charters/`. That sentence also stands in `TEAM.md` §1 and in L0's notes, and
it is the only substitute-path instruction anywhere in this project.

**V5 moved from Day 1 to Day 0** so the probe origin is already up when the human opens the
built-in browser on Day 1, and so I1's Day 1 stays inside the six-agent-hour cap. **Its host is now
named (R-18):** a **free Render Web Service on a `*.onrender.com` subdomain**, in the same Render
account D1 uses, created and deleted inside Sprint A. It must be a Web Service and not a Static
Site, because the probe needs `GET /whoami` to echo a cookie. `onrender.com` is on the public
suffix list (MEASURED, HANDOVER §3 rule 14) and that is **irrelevant here** — V5 mints no
origin-trial token; D2 is the only node that ever wanted one. The free tier sleeps after 15 idle
minutes, which is harmless: V1–V4 are attended, interactive, single-sitting probes.

**Gate Day-0** — 2 cut-0 nodes, each quoted verbatim from `graph.json`:

> **L0** — All SEVEN must pass, IN THIS ORDER — the order is load-bearing three times over: gate (1) is the ruling that decides which nodes exist at all and must land before any seat is dispatched; gate (6) pushes; and gate (7) clones the PUSHED REMOTE, which is the tree G3 will see, so a clone taken before the commit-and-push carries no lockfile to install from. (1) PM RULING D-17, BEFORE ANY SEAT IS DISPATCHED — this gate is the ruling's home and its gate: `node -e "const fs=require('fs');const t=fs.readFileSync('erp/DECISIONS.md','utf8');const m=t.match(/^\|\s*D-17\s*\|[^\n]*human_hours_per_day\s*=\s*([0-9.]+)/m);if(!m)process.exit(1);const v=Number(m[1]);if(v!==2.5&&v!==3.0)process.exit(1);const g=JSON.parse(fs.readFileSync('erp/graph.json','utf8'));if(g.capacity.human_hours_available!==v*5.5)process.exit(1)"` exits 0. erp/DECISIONS.md is CREATED HERE, on Day 0, carrying the D-17 row; V6 appends its unknowns rows to the same file on Day 2 and does not create it. This is the 2.5-vs-3.0 h/day ruling and it decides whether 27 of the 62 horizon-A nodes exist: at 2.5 the graph does not fit and these 27 nodes are deleted, named by id per R-12 — V0 G5 G6 T4 D2 D3 F6 E5 T3 T5 F3 F5 E1 E2 E3 E4 E6 E7 E8 E9 E10 V2 V3 V4 S7 S8 F2, the same list capacity.human_budget_sensitivity and erp/PLAN.md §6.4 carry; at 3.0 nothing is cut. It was previously due 'Day 0 before any seat is dispatched' while its only recorded home was erp/DECISIONS.md, a V6 output on Day 2, and Day 0 contained only L0 and V5 — so the ruling had no node, no gate and no file that existed when it was due. The gate also proves capacity.human_hours_available in erp/graph.json equals the ruled figure times 5.5 days, so ruling 3.0 without updating the graph fails here rather than silently downstream. (2) PORT, AND package.json's `scripts` BLOCK, CONCRETELY: package.json declares exactly `"scripts": {"test": "node --test", "start": "node server/index.mjs"}` — `node --test` with NO path arguments, which recursively discovers every *.test.mjs in the tree, tests/acceptance/ included. MEASURED 2026-08-28 on node v22.23.1: with this block `npm test` runs the whole suite and exits 0; `npm test -- <name>` is NOT a filter — with `"test": "node --test"` it exits 1 printing `Could not find '<name>'`, and with `"test": "node --test tests/*.test.mjs"` it exits 0 having run the WHOLE suite with the argument inert. R-23: no acceptance predicate in this graph may use `npm test -- <name>`; a predicate that means to select one file says `node --test <path>`, and T1, T4, T6, S11 and S3 (twice) were rewritten that way. Then: `test -f src/tools.js && test -f tests/surface.test.mjs && node --test tests/*.test.mjs` reports 24 tests with exactly 1 failure, and that failure is 'auditor surface: read-only by construction' — the known RED test T6 fixes. (3) TEAM TREE: `test -d .team/charters && test -d .team/contracts && test -d .team/log && test -d .team/deviations && test -f .team/lint/banned.txt` and `ls .team/charters | wc -l` equals 16. (4) PROFILES, R-3, existence AND effect, with `$want` BOUND BY THE LOOP: `for pair in verifier:low builder:medium redteam:high evaluator:high; do p=${pair%%:*}; want=${pair##*:}; test -f ~/.codex/$p.config.toml || exit 1; python3 -c "import tomllib,sys;tomllib.load(open(sys.argv[1],'rb'))" ~/.codex/$p.config.toml || exit 1; codex exec --strict-config -p "$p" --ephemeral -s read-only --skip-git-repo-check -o /dev/null 'Reply with exactly: OK' < /dev/null 2>&1 | grep -q "reasoning effort: $want" || exit 1; done` exits 0. The previous revision wrote `$want` as unbound prose and the loop could never have run. A missing profile exits 0 with no warning and silently falls back to the base config, so the banner grep is the ONLY real check. (5) DEPENDENCIES, THEN COMMIT: `node -e "const d=JSON.parse(require('fs').readFileSync('package.json','utf8')).devDependencies; if(!d||!d.ajv) process.exit(1)"` — ajv (2020-12 build) is declared HERE, because S10, G6 and V1 all invoke it on Day 1 and no other node declares it — then `npm install && test -f package-lock.json && git add -A && git commit -m 'bootstrap: outpocket sprint A'`, after which `git ls-files erp | wc -l` is greater than 30 and `git log -1 --format=%s` matches '^bootstrap:'. (6) PUSH — THE FIRST PUSH, AND THE ONLY ONE ANY NODE'S ACCEPT PERFORMS: `git remote get-url origin | grep -q '^https://github.com/Caleb0796/outpocket\(\.git\)\?$'` exits 0 — MEASURED it prints the URL WITH the `.git` suffix, so an equality test against the bare URL would fail here — then `git push -u origin HEAD:main` exits 0, and `test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)"` exits 0. MEASURED 2026-08-29, AND THIS SENTENCE WAS RESTATED BECAUSE ITS PREVIOUS VERSION WENT STALE UNDER US: origin/main now carries erp/ (50 files), evidence/ and probe/ - the planning corpus IS pushed. What is NOT pushed, and what this gate exists for, is the PRODUCT tree: package.json, package-lock.json, src/**, tests/** and .team/** do not exist on origin/main or on disk. The argument is unchanged and the fact is now true as written.Committing locally is not enough: G3 (Day 1, cut 0) clones the GitHub URL and runs `npm ci`, and it never sees this working tree, so an unpushed lockfile is invisible to it. R-26(b) — READ THIS WITH GATE (7) AND WITH G3, BECAUSE THE THREE USED TO CONTRADICT EACH OTHER: no other node's accept predicate runs `git push`, and the sixteen charters' `never git push` rule stands unchanged, but this gate is the FIRST push and not the only one. L1 carries a STANDING OBLIGATION to push every merge to main, as part of the merge protocol — that obligation is erp/TEAM.md's merge protocol and erp/charters/L1.md's to state, and it is named here because it is the only thing that carries T6's fix to origin/main for G3 to clone on Day 1. Read as 'nothing else in this graph ever pushes', the old wording made G3 unsatisfiable for the whole sprint. (7) LOCKFILE FROM A CLONE OF THE PUSHED REMOTE, AFTER THE PUSH — AND IT ASSERTS THE ONE KNOWN FAILURE BY NAME, NOT EXIT 0: `rm -rf /tmp/l0 && git clone https://github.com/Caleb0796/outpocket /tmp/l0 && cd /tmp/l0 && test -f package-lock.json && npm ci` exits 0; then `npm test > /tmp/l0/out.txt 2>&1; node -e "const t=require('fs').readFileSync('/tmp/l0/out.txt','utf8'); if(!/^# tests 24$/m.test(t))process.exit(1); if(!/^# fail 1$/m.test(t))process.exit(1); if(!/auditor surface: read-only by construction/.test(t))process.exit(1)"` exits 0 — the `# tests` and `# fail` lines are node --test's TAP summary, which is what it emits when stdout is not a TTY (MEASURED, node v22.23.1), and this predicate redirects to a file. The clone is taken from the REMOTE, not from `.`, because the remote is the tree G3 installs from; cloning `.` proved a property of a tree no downstream node reads. R-26(a), AND THIS IS THE FIRST THING A SEAT HITS ON DAY 0: the previous wording required this clone's `npm test` to EXIT 0, while gate (2) three paragraphs above declares that the very tree gate (6) pushes carries EXACTLY ONE failing test — the known RED test T6 fixes on Day 1. One node cannot demand zero failures and exactly one failure of the same commit, and the first node of the sprint failed itself. The executable form is the specific one: 24 tests, exactly 1 failure, and that failure named. This is STRONGER than exit 0, not weaker — exit 0 is also satisfied by a suite that silently stopped discovering tests, which is the failure `npm test -- <name>` already produced once in this project (R-23). Zero failures on origin/main becomes true only after T6 is merged and L1 pushes that merge; asserting THAT is G3's job, which is why G3 carries a hard edge from T6.

> **V5** — `curl -sI $(cat evidence/V5-origin.txt) | tee evidence/V5-headers.txt` returns 200 over https AND the Origin-Agent-Cluster check passes: `grep -i '^origin-agent-cluster:' evidence/V5-headers.txt | grep -q '?0' && exit 1; exit 0` — the header must be absent, or present with a value that is not ?0. The page must register exactly 5 tools at load, one of which never resolves, and expose GET /whoami echoing the request cookie.

#### Day 1 — 2026-08-29 — Instrumentation, contract freeze, the two human probes

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **G0** | L1 | 2 | 0 | Graph instrumentation: tools/ready.mjs and tools/check-ownership.mjs |
| **G4** | I4 | 1.5 | 0 | Layer-0 lint hook: banned identifiers, description budget, banned wording, retracted claims |
| **T6** | I2 | 1 | 0 | Fix the red test: auditor surface read-only by construction |
| **S10** | L1 | 2 | 0 | Freeze the I2/I3 contracts |
| **S11** | I3 | 2 | 0 | OCF-1 canonicaliser and the seven-vector suite |
| **S1** | I3 | 2.5 | 0 | Single-file Node server with cookie session |
| **T1** | I2 | 2 | 0 | Port tools.js surface compiler into the page, top-level document only |
| **F0** | UX | 1 | 0 | Storyboard and video script, authored before anything grades against them |
| **G5** | L1 | 1 | 1 | File-ownership pre-commit hook |
| **G6** | QA | 2 | 1 | Contracts conformance runner over every schema in erp/contracts/ |
| **H1** | I1 | 1.5 | 0 | Chrome launcher with the right flag per scenario |
| **H2** | I1 | 3 | 0 | CDP driver: enumerate tools, execute a tool, assert on the result |
| **V0** | I1 | 1 | 1 | navigator.modelContext alias status on the INSTALLED Chrome major |
| **V1** | I1 | 2 | 0 | document.modelContext presence in the ChatGPT built-in browser on a plain HTTPS origin |
| **G3** | QA | 1.5 | 0 | Green npm test from a clean clone |

**This is the widest day in the sprint and it is deliberate**: everything with no
dependency but L0 starts here, because the whole graph's slack lives on Day 1 and nowhere else.

**S11 is first in lane S** — six frozen contracts publish digests over OCF-1 and nothing
implemented it. **G0 is on Day 1 and out of the cut ladder**, because the tool the graph is
*operated with* previously sat inside the first cut; it now also ships `--check-tables` and
`--check-schedule`, which are what make every restated table in this corpus legal (R-22).

**H2's first hour gates everything else.** If `getTools`/`executeTool` are not reachable from page
JS under `--enable-features=WebMCP` with no agent attached, lane E has no admissible mode and PM
must be told the same day (`graph.json.contingencies`). H2 runs against V5's probe, not the
product, which is why the driver is finished and trusted before T2 exists.

**Day 1 has exactly ONE human-gated node, and it is the whole of Day 1's human budget: V1 2.0 h.**

- **G1 does NOT execute on Day 1. It executes on Day 6, immediately before D5** — R-42/D-30,
  ruled by the user 2026-08-29, overturning D-12. The supposed mechanical consumer, the hard edge
  `G1 → G3`, was deleted: MEASURED, an authenticated `git clone` of a PRIVATE repo succeeds, so
  G3 needs L0's PUSH and not the visibility flip. Booting G1 on Day 1 publishes both repositories
  five days early for no downstream benefit. Day 1's human-gated load is 2.5 → **2.0 h**; Day 6's
  is 4.0 → **4.5 h**.
- **V1 runs on Day 1 — everywhere.** `graph.json.capacity.schedule_A` is the only authority on
  which day a node runs, and it says Day 1. The previous revision had V1 on Day 1 in `graph.json`
  and in `RISK.md` and on **Day 2** in this table, so RISK's "Day 1 23:59: V5 is not up, or V1 has
  not run against it" trigger fired **by construction** against the plan's own schedule, on a cut-0
  human-gated node that gates three contingencies. It is Day 1 in all three documents now.

**V1 is the highest information value per hour in the whole plan.** If `document.modelContext` is
ABSENT in ChatGPT's built-in browser on a plain HTTPS origin, judges see a page with **no tools at
all** and local testing will never reveal it: `graph.json.contingencies` then flips **D2 from cut
rank 1 to cut rank 0** and a custom domain becomes mandatory. It is human-gated because the ChatGPT
desktop built-in browser cannot be driven by CDP — a human must open it, select GPT-5.6 Sol or
Terra, and read the tool list — and it runs **against V5's throwaway origin**, not against the
production deploy and not against localhost. Any trigger anywhere that fires because V1 has not run
against production is wrong and must name V5.

**V0 moved from Day 3 to Day 1.** Both of its consumers used to precede it — H5 on Day 0 and V6 on
Day 2 — so V6 could only ever have recorded V0 as `UNVERIFIED`. It was dead work as scheduled.

**Gate Day-1** — 13 cut-0 nodes, each quoted verbatim from `graph.json`:

> **G0** — `node tools/ready.mjs --check-cuts` exits 0, proving key(u) >= key(v) on every hard edge of erp/graph.json; `node tools/ready.mjs --path` prints the longest hard-edge horizon-A path and its total, and that total equals capacity.graph_depth_hours; `node tools/ready.mjs --check-accept-paths` exits 0, proving every file path named in any node's `accept` either APPEARS VERBATIM in some node's `outputs`, IS A DIRECTORY PREFIX OF ONE, or is a PRE-EXISTING planning artifact under erp/ that `test -f` finds on disk. R-36 CLOSES THE ONE GAP BETWEEN THIS TOKENIZER AND THIS RESOLVER: step (t4) below admits a token that is a directory prefix of a declared output as a CANDIDATE, and the resolution rule as previously written did not RESOLVE one — seven tokens survived only if `appears in outputs` was read as prefix-of-output, and a strict implementation exited 1 on Day 1 on a cut-0 node. The prefix class is now named, resolved and PRINTED SEPARATELY rather than folded into the output count. Outputs are compared with any trailing `/` removed, matching step (t3), which is what makes E9's declared output tests/redteam/ resolve the token tests/redteam EXACTLY rather than as a prefix. THE TOKENIZER IS SPECIFIED HERE, IN FIVE STEPS, because exit 0 vs exit 1 used to turn on an unstated one: (t1) in the accept string, replace every character OUTSIDE the set [A-Za-z0-9_./*$~@+-] with a space — this removes backticks, both quote characters, commas, semicolons, colons, parentheses, braces, brackets, pipes, ampersands, exclamation and question marks, `=` and the em dash, and it splits https://github.com/... into `https` and `//github.com/...`; (t2) split on whitespace; (t3) strip trailing `.`, `/` and `-` repeatedly, strip leading `-` repeatedly, then strip exactly one leading `./`; (t4) a token is a CANDIDATE PATH only if its basename matches ^[A-Za-z0-9_.@+-]+\.[A-Za-z0-9]{1,6}$ — i.e. it carries a file extension — or the token is itself a declared output or a directory prefix of one. Everything else is DISCARDED as `not-a-path`, which is what keeps prose like `getTools/executeTool`, `origin/main`, `refs/heads/main`, `2.5-vs-3.0 h/day`, `500/1500-char`, `ajv/dist/2020`, `outpocket/snapshot/1` and the regex fragment `.+/i` out of the resolver; (t5) a candidate with NO `/` is a BARE WORD: it resolves only if it matches the basename of some node output (no-net.mjs to E1's webmcp-eval-kit/test/no-net.mjs, eval.yml to E6's .github/workflows/eval.yml, package.json, package-lock.json and README.md to L0's and G2's) or is a repository-root file on disk; otherwise it is DISCARDED as `bareword`, which is what absorbs JSON.parse, process.exit, dns.lookup, tomllib.load, v22.23.1 and 2026-08.1. THEN four declared DISCARD CLASSES apply, in order: (d1) absolute — the token begins with `/`, which covers /tmp/a.json and /tmp/b.json that H4's predicate creates itself, /dev/null, every URL route such as /api/sign and /respond, and the //github.com/... remnant of step (t1); (d2) glob — the token contains `*`, `?` or `[`, which covers tests/*.test.mjs in L0 gate (2) and erp/**.md in this node's own --check-tables clause; (d3) variable — the token contains `$` or begins with `~`, which covers ~/.codex/$p.config.toml in L0 gate (4), $URL/version in D1 and E6, and E4's $CODEX_HOME/auth.json, $CODEX_HOME/config.toml and $CODEX_HOME/AGENTS.md, which name files inside a directory tools/blind-home.sh builds at run time and which this repository never contains; (d4) the not-a-path and bareword classes of (t4) and (t5). ONLY THEN does the exemption list apply, and it now covers exactly EIGHT entries: the six contract files under erp/contracts/ that some accept actually names — violation.schema.json (S10, S4, T3, X2), canonical-vectors.json (S11, E1), eval-case.schema.json (S1, S5, E3), policy.schema.json (S3), policy-versions.json (S3, G6) and signature.schema.json (S5) — plus erp/charters/C3.md which E9's and this node's accepts grep, plus countinghouse/src/policy.js, cited verbatim by S4 and by this file's notes as the source of a live spike defect and living in a SIBLING checkout at ../countinghouse that this repository never produces. Two entries were DROPPED this revision because no accept in this graph names them: erp/contracts/provenance.schema.json and erp/contracts/tool-export.schema.json. An exemption nothing uses is a licence waiting for a mistake to walk into. It must print the discarded and the exempted tokens rather than silently swallowing them, and the exemption list is a closed literal in the source, never a directory glob — it strips exactly one leading `./` before matching, and E5's `--import ./webmcp-eval-kit/test/no-net.mjs` is the ONLY accept path in this file permitted to carry that prefix (node resolves a bare relative specifier as a package name and throws ERR_MODULE_NOT_FOUND). RUN 2026-08-28 against this file under exactly these rules, RECOMPUTED AFTER THE v2.3.0 ACCEPT EDITS AND WITH THE PREFIX CLASS BROKEN OUT: 182 candidate tokens resolved — 152 VERBATIM in some node's outputs, 7 as DIRECTORY PREFIXES of one (the runner prints them by name; they fall one each in E5, L0, T1, G0 and G6 and two in X6), 12 as output basenames under (t5), and 11 PRE-EXISTING under erp/ found by test -f — 21 hits over the 8 exemption entries, 0 UNRESOLVED, exit 0. The previous publication of this run split it as `157 in node outputs, 12 as output basenames'; 157 was the verbatim count with the seven directory prefixes silently folded into it, and that fold is precisely what R-36 forbids — the prefix class is now counted and printed on its own line, so a strict implementation and this published figure cannot drift apart again. The seven tokens that were unresolvable last revision are gone: no-net.mjs and eval.yml resolve as output basenames under (t5), $CODEX_HOME/auth.json, $CODEX_HOME/config.toml and $CODEX_HOME/AGENTS.md fall in (d3) once E4's accept writes them with the directory they live in, and F4's and L0's prose references to sibling documents are now written erp/CONTRACTS.md and erp/PLAN.md, which resolve on disk; `node tools/ready.mjs --check-freezes` exits 0, proving every id in every interface_freezes[].unblocks is a node with a hard edge from that entry's frozen_by; `node tools/ready.mjs --check-ownership-globs` exits 0, proving every output path and every accept path is resolvable under conventions.ownership_rule; `node tools/ready.mjs --check-tables` exits 0, diffing every restated node table in erp/**.md against erp/graph.json field by field (id, owner, inputs, hours, cut, horizon) and every restated day table against capacity.schedule_A, and printing the offending row on any disagreement; `node tools/ready.mjs --check-schedule` exits 0, proving every hard edge u->v has day(u) <= day(v) and no seat exceeds capacity.seat_day_hours_cap on any day.

> **G4** — `node tools/lint-layer0.mjs` exits 0 over the repo AND `node tools/lint-layer0.mjs tests/fixtures/banned-sample.js` exits 1 naming every planted violation AND `node tools/lint-layer0.mjs --selftest` exits 0. The fixture must plant one of each class: navigator.modelContext, provideContext, unregisterTool, clearContext, outputSchema, consequentialHint, a 501-char description, one banned phrase and one retracted claim. AND `node tools/lint-layer0.mjs --assert-register` exits 0, proving kb/webmcp/RETRACTED.txt carries at least these five entries as literal scannable strings, each of which some document in this project asserted and lost the right to assert: 'structural guarantee' · 'the five write tools' (R-20: the count is SEVEN and is computed from `annotations.readOnlyHint !== true`, never hard-coded) · 'a specific agent' (R-21: WebMCP exposes no agent identity, the specification says the browser agent uses a different internal mechanism, and H3 is indistinguishable from a third-party agent at the tool boundary — no document may claim attestation of a specific agent) · 'a commit cannot be made without a human decision' (R-13) · 'the tool surface is the boundary'. The scan EXCLUDES erp/**, kb/webmcp/BANNED.txt, kb/method/BANNED-CITATIONS.md and .team/lint/banned.txt — the files that quote banned strings in order to ban them — and the exclusion list is a literal array in the source, never satisfied by deleting quotes.

> **G1** — For REPO in Caleb0796/outpocket Caleb0796/webmcp-eval-kit: `gh api repos/$REPO -q '.visibility + " " + .license.spdx_id' | tr 'A-Z' 'a-z' | tee -a evidence/G1-visibility.txt` outputs exactly `public mit`. Both repos, not one.

> **T6** — `node --test tests/surface.test.mjs` reports 0 failures, and specifically the named test 'auditor surface: read-only by construction' passes with the auditor set equal to {get_day_book, get_expense_policy, get_open_report, get_report, get_session_scope, list_expense_reports}.

> **S10** — `node tools/validate-contracts.mjs` exits 0 — an ajv 2020-12 metaschema check on erp/contracts/violation.schema.json, plus every tool name in erp/contracts/tool-surface.contract.md resolving to a definition — AND `git log -1 --format=%s -- erp/contracts/FREEZE.md` matches '^freeze:' AND `sha256sum -c erp/contracts/FREEZE.md` exits 0. R-31, AND IT WAS THE LAST UNSATISFIABLE PREDICATE IN THIS FILE: the commit-subject probe used to name erp/contracts/violation.schema.json, which R-17 established is a PRE-EXISTING contract file that NO node lists as an output. L0 gate (5) commits that path exactly once, under the subject `bootstrap: outpocket sprint A`, and nothing in the graph ever touches it again, so `git log -1 --format=%s -- erp/contracts/violation.schema.json` returns the bootstrap subject forever and this gate could never go green — on cut 0, on Day 1, on critical-path node 3, the node that unblocks T1, S1 and S4. MEASURED BOTH WAYS IN A SCRATCH REPOSITORY: after a `bootstrap:` commit of the contract tree followed by a `freeze:` commit that adds erp/contracts/FREEZE.md, the old probe still reads `bootstrap: outpocket sprint A` and its grep exits 1, while the new probe reads the freeze subject and exits 0. ONLY THE PROBE'S PATH MOVES: erp/contracts/FREEZE.md is an output THIS NODE genuinely produces, in that same freeze commit, so the subject it carries is this node's own; the `sha256sum -c erp/contracts/FREEZE.md` verification of the frozen set is untouched and still covers the whole frozen set — the EIGHT pre-existing contract files plus erp/contracts/probe-verdict.schema.json, which V5 writes into the same directory on Day 0, NINE at freeze time, and the two hard edges V5 -> S10 and V5 -> G6 are what make that ordering a provable claim rather than a scheduling coincidence, and S5's pattern one node over — `git log -1 --format=%B -- erp/contracts/eval-case.schema.json` — keeps working for the opposite reason, because S5 really does edit that file. Any later change requires a PM deviation ticket referenced in the commit body.

> **S11** — `node --test tests/canonical.test.mjs` exits 0: all SEVEN vectors in erp/contracts/canonical-vectors.json reproduce byte-for-byte, including the two provenance vectors v6 and v7 which are the standing regression case. The implementation sorts object keys recursively by CODEPOINT (never localeCompare, which is ICU-dependent and can sort differently in a stranger's clean clone), NFC-normalises strings, accepts integers only, and exposes `digest(kind, value) = sha256(kind + '\n' + canon(value))`. It carries the OCF-1 carve-out permitting $-prefixed keys ($schema, $ref, $defs) inside an inputSchema subtree, and a numeric carve-out for JSON Schema keywords, so a real tool definition is canonicalisable at all.

> **S1** — `node --test tests/acceptance/session.test.mjs` — POST /api/login sets a Set-Cookie with HttpOnly and SameSite=Lax; GET /api/me with that cookie returns the persona; GET /api/me without it returns 401. Exactly two personas exist, chen (employee) and ruiz (auditor), matching the frozen enum in erp/contracts/eval-case.schema.json.

> **T1** — `node --test tests/surface.test.mjs` passes all ported surface tests in the new repo AND `find src/page -name '*.js' -print0 | xargs -0 node tools/check-toplevel.mjs` exits 0, finding zero registerTool call sites reachable from an iframe or worker entry file.

> **F0** — `node tools/lint-layer0.mjs docs/STORYBOARD.md docs/VIDEO-SCRIPT.md` exits 0 (zero banned wording, zero retracted claims) AND docs/STORYBOARD.md lists every shot with a stable shot id and a duration, the durations summing to under 170 seconds AND docs/VIDEO-SCRIPT.md's first cue is timestamped <= 00:10 and contains at least one literal token from kb/webmcp/MECHANISMS.txt.

> **H1** — `node --test tests/acceptance/launcher.test.mjs` — asserts `node tools/chrome.mjs --scenario cdp --print-flags` prints a line containing '--enable-features=WebMCP' and NOT 'WebMCPTesting', and that `node tools/chrome.mjs --scenario manual --print-flags` prints '--enable-features=WebMCPTesting'.

> **H2** — FIRST HOUR, gating everything else — and it is a REGRESSION gate on the installed Chrome, not a discovery: launch WITH --enable-features=WebMCP (or WebMCPTesting; MEASURED 2026-08-28 they are interchangeable, so either satisfies this gate) and no agent attached, and record the LAUNCH as well as the result in evidence/H2-reachability.json. Six things must hold. (i) THE FLAG IS ON THE LAUNCH: a no-flag launch is recorded and MUST FAIL this gate — MEASURED 2026-08-28 on Chrome 152.0.7977.64 over http://localhost with a clean dedicated --user-data-dir per launch, no flag leaves `typeof document.modelContext === 'undefined'`, headed and under --headless=new alike. (ii) THE PAGE API IS REACHABLE: CDP Runtime.evaluate reports `typeof document.modelContext.getTools === 'function'` AND `typeof document.modelContext.executeTool === 'function'`. (iii) COUNT, AWAITED: on a page registering exactly 1 tool, `(await document.modelContext.getTools()).length === 1`. THE AWAIT IS LOAD-BEARING AND THIS IS THE DEFECT THIS PREDICATE REPLACES — MEASURED, getTools() returns a Promise, so the old `getTools().length === 1` compared `undefined` to `1` and could never hold on any browser; and `!== 0` MUST NOT be substituted for it, because `!== 0` passes against an empty surface. (iv) `WebMCP.enable` over CDP returns OK — recorded, NEVER asserted on, see below. (v) exactly one `WebMCP.toolsAdded` event names that tool and carries its frameId. (vi) ONE `WebMCP.invokeTool{frameId, toolName, input}` ROUND TRIP whose matching `WebMCP.toolResponded` carries `status: 'Completed'`. evidence/H2-reachability.json records {chromeMajor — from the binary, never from a user-agent string —, flag, headless, pageApiReachable, toolCount from `await getTools()`, cdpDomainEnabled, invokeToolRoundTrip}, and THE GATE TURNS ON invokeToolRoundTrip ALONE: MEASURED 2026-08-28, `WebMCP.enable` returns OK in a launch with NO flag, NO tools and NO page API at all, so cdpDomainEnabled is a VACUOUS field that reads 'on' when the feature is off. It is kept in the launch log and it may not be the thing anything passes on; a reachability file without a completed round trip records an opinion, not a measurement. `headless` is RECORDED AND NOT CONSTRAINED: MEASURED the same day, `--headless=new` PLUS the flag gives `typeof document.modelContext === 'object'`, registerTool succeeds and the invokeTool round trip completes, exactly as headed does — so a headless gating run is admissible, and this is also what makes E6 (evals against the deployed commit, in CI) feasible at all. THEN: `node harness/drive.mjs --url $(cat evidence/V5-origin.txt) --list` prints 5 tool names and exits 0; `--exec whoami` prints a content block and exits 0; `--exec no_such_tool` exits 2 with a nonzero-only stderr message — and `--exec` drives `WebMCP.invokeTool` BY NAME over CDP, never `document.modelContext.executeTool(name, args)`, which MEASURED throws `TypeError: ... not of type 'RegisteredTool'` (executeTool takes the handle from getTools() and a JSON STRING of arguments); an unknown tool name over the CDP domain returns -32602 'Tool not found', which is what `--exec no_such_tool` converts into exit 2.

> **V1** — MECHANICAL FIRST, a real command and not an ellipsis: `node -e "const fs=require('fs'); const Ajv=require('ajv/dist/2020'); const s=JSON.parse(fs.readFileSync('erp/contracts/probe-verdict.schema.json','utf8')); const d=JSON.parse(fs.readFileSync('evidence/V1.json','utf8')); const v=new Ajv({strict:false}).compile(s); if(!v(d)){console.error(v.errors); process.exit(1)}"` exits 0 — the schema requires {origin, chatgptModel:'Sol'|'Terra', modelContextPresent:bool, toolCount:int, observedAt} — AND `test -s evidence/V1.png` passes. HUMAN SECOND: QA re-reads the screenshot against the JSON and a mismatch fails the node. Both gates are required; the human read is the second gate, never the only one.

> **G3** — `rm -rf /tmp/oc && git clone https://github.com/Caleb0796/outpocket /tmp/oc && npm ci --prefix /tmp/oc && (cd /tmp/oc && npm test) > evidence/G3-clean-clone.txt 2>&1` exits 0 — the redirect is taken in the repository root, NOT inside the clone, because evidence/G3-clean-clone.txt is this node's output and a `| tee` written after `cd /tmp/oc` landed it in /tmp/oc/evidence/ where nothing reads it. Then `node -e "const t=require('fs').readFileSync('evidence/G3-clean-clone.txt','utf8'); if(!/^# fail 0$/m.test(t))process.exit(1); const m=t.match(/^# tests ([0-9]+)$/m); if(!m||Number(m[1])<24)process.exit(1)"` exits 0 — ZERO failures over at least 24 tests, the ported count. The `# tests` and `# fail` lines are node --test's TAP summary, which is what it emits when stdout is NOT a TTY (MEASURED, node v22.23.1: the spec reporter is the TTY default and tap the non-TTY default), and this predicate redirects to a file, so TAP is what it reads. AND `test "$(git -C /tmp/oc rev-parse HEAD)" = "$(git rev-parse HEAD)"` exits 0, proving the clone carries the merge under test and not a stale origin/main. R-26(c): zero failures is a property of origin/main ONLY AFTER T6's fix is merged AND L1 has pushed that merge — T6 is a hard input for exactly that reason, and L0 gate (7) deliberately asserts the OPPOSITE of this predicate (exactly one failure, named) about the pre-T6 bootstrap commit. If this node runs against a remote whose HEAD predates T6's merge it fails with exactly one failure, `auditor surface: read-only by construction`, and the correct response is to push the merge, never to edit the test.

#### Day 2 — 2026-08-30 — Server kernel, policy, surface flips, unknowns closed

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **F1** | UX | 2.5 | 0 | Application shell, login, two personas |
| **G2** | I4 | 1 | 0 | README with two plaintext demo credentials and both ways to open the app |
| **S3** | I3 | 3 | 0 | Policy engine port, integer micro-USD FX, versioned policy document |
| **S4** | I3 | 1.5 | 0 | Deterministic violation envelope on every write tool |
| **S9** | I3 | 1 | 0 | Deterministic reseed on boot |
| **T2** | I2 | 3 | 0 | Real registerTool plus AbortController revocation, the 1->5->12->13 flips |
| **V2** | I1 | 1.5 | 3 | Does the built-in browser refresh the tool list mid-session |
| **V3** | I1 | 1.5 | 3 | Does an agent-initiated tool execute carry the page's session cookie |
| **V4** | I1 | 1.5 | 3 | Does a suspended execute time out in the built-in browser |
| **V6** | PM | 1.5 | 0 | Unknowns verdict and fallback election |
| **H5** | I1 | 1.5 | 0 | Environment probe and first-screen banner |
| **F3** | UX | 1.5 | 2 | Receipt upload as a human-only channel; the agent can only link an existing id |
| **E1** | C4 | 2 | 2 | Eval-kit driver package skeleton with an OCF-1 port |

**H5 moved from Day 0 to Day 2 and gained a hard input from L0.** Its accept runs
`node --test`, which needs L0's `package.json` and test tree, and it had no hard path to L0 at all
while sitting beside it on Day 0. It now also runs after V0 (Day 1), so its soft input is actually
available rather than nominally so.

**S3 is on the critical path and its predicate was unsatisfiable until this revision.** The old
final clause `if(JSON.stringify(p).match(/\d+\.\d+/)) process.exit(1)` matched `08.1` inside the
mandatory `version: "2026-08.1"` that the same predicate asserts three clauses earlier: a perfectly
correct 19-rule integer-only document exited 1. The scan now deletes `version` and `effective_from`
from a copy first. Re-run by execution during this round: old predicate exit 1 on a correct
document, new predicate exit 0, and exit 1 on a planted `150.5` and on a planted `fx.EUR: 1.09`.

**V6 converts the unknowns into a decision the same day the last of them lands.** V1 is its only
hard input; V0/V2/V3/V4 are soft, which is exactly why V6 is cut 0 while V2–V4 are cut 3.

**V3 is worth reading twice this round.** If it reports that an agent-initiated `execute` *does*
carry the page session cookie, that is the answer that makes the sign gate **worse**, not better:
an agent that carries the cookie and can read the DOM can reach the `confirm_token` and drive
`POST /respond` itself. See §4④ and `graph.json.contingencies`.

**Gate Day-2** — 8 cut-0 nodes, each quoted verbatim from `graph.json`:

> **F1** — `node harness/drive.mjs --smoke-login chen,ruiz` exits 0 for both, and a DOM assertion reports `document.querySelectorAll('[data-persona]').length === 2`.

> **G2** — `node --test tests/acceptance/readme-credentials.test.mjs` — parses every `login:` line out of README.md, POSTs each to the live /api/login, asserts 200, and asserts the set of roles covered equals {employee, auditor} over exactly two logins. Also asserts README.md contains both the ChatGPT-built-in-browser path and the Chrome-flag path with the literal string '--enable-features=WebMCPTesting'.

> **S3** — `node --test tests/policy.test.mjs` passes all ported policy tests AND `node --test tests/canonical.test.mjs` still passes with the migrated rates — R-23: BOTH were `npm test -- <name>`, which is not a filter (see L0 gate (2)), so this node believed it had two gates and had one whole-suite run twice — AND `node --test tests/policy-lock.test.mjs` exits 0, recomputing the OCF-1 digest of the shipped policy document and asserting the (version, digest, canonical_bytes) triple is present in erp/contracts/policy-versions.json — AND, R-33 HALF TWO AND THIS NODE OWNS IT, the same lock runs at SERVER POLICY LOAD and not only in the test suite: server/routes/policy.mjs recomputes the digest when it loads a policy document and REFUSES TO SERVE one whose (version, digest) pair is absent from erp/contracts/policy-versions.json, so the test asserts both the in-suite triple and that a doctored document is refused at load with the server declining to serve any policy at all rather than serving the doctored one. THE OWNER OF THE SERVER-SIDE POLICY-LOAD LOCK IS THIS NODE, S3, AND THAT IS THE ASSIGNMENT THE CONTRACT LEFT OPEN: S3 already produces server/routes/policy.mjs and tests/policy-lock.test.mjs, and erp/CONTRACTS.md §11 check 3 already names S3 as the owner of the version lock. NO HOURS MOVE FOR IT — R-33 relocates a check S3's 3.0 hours already carry from the test suite into the loader; it does not add one. As a test-only check the lock guarded the repository and nothing else, which is the half of the same-version content swap that the snapshot projection change cannot reach AND `curl -s $URL/api/policy | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8")); if(p.version!=="2026-08.1") process.exit(1); if(p.rules.length!==19) process.exit(1); const want=Array.from({length:19},(_,i)=>"R"+String(i+1).padStart(2,"0")); if(want.some((c,i)=>p.rules[i].id!==c)) process.exit(1); if(p.rules.some(r=>!/^[A-Z][A-Z0-9_]{2,39}$/.test(r.code))) process.exit(1); const q=JSON.parse(JSON.stringify(p)); delete q.version; delete q.effective_from; if(JSON.stringify(q).match(/[0-9]+\.[0-9]+/)) process.exit(1)'` exits 0 — version 2026-08.1; exactly 19 rules whose `id` fields are R01..R19 IN ORDER; every `code` matching the frozen named-string pattern `^[A-Z][A-Z0-9_]{2,39}$` (R01 lives in `.id`, and `.code` carries the human name like CAP_MEALS — the previous predicate asserted `p.rules[i].code === "R01".."R19"`, which is unsatisfiable against erp/contracts/policy.schema.json and its pinned digest, on a cut-0 node at position 5 of 12 on the critical path); and NO decimal number anywhere in the served document once the two DATE-SHAPED fields the document is required to carry have been removed from the scan.

> **S4** — `node --test tests/acceptance/envelope.test.mjs` — every error body from every write route validates against erp/contracts/violation.schema.json with all of code, severity, field, fix, candidates present; and the same input produces a byte-identical envelope on two runs. AND `node --test tests/fix-lint.test.mjs` exits 0, implementing the substring lint erp/contracts/violation.schema.json declares in `x-fixLint`: it must REJECT the schema-valid instance the contract files under `x-invalidExamples` for exactly this purpose, the one whose `fix` names the evasive edit (verbatim from countinghouse/src/policy.js:133, a live defect in the spike). No JSON Schema keyword can catch that instance, so without this test the contract's own check would report green on a case it is documented to fail.

> **S9** — boot the server, `curl -s $URL/api/state-digest > /tmp/d1`; restart; `curl -s $URL/api/state-digest > /tmp/d2`; `diff /tmp/d1 /tmp/d2` exits 0.

> **T2** — `node harness/drive.mjs --assert-flips 1,5,12,13` exits 0: it drives a real Chrome with --enable-features=WebMCP against the served application, calls getTools() after each state transition and asserts the counts in order, and asserts that submit_expense_report disappears from getTools() after a blocking violation is introduced through the real policy engine.

> **V6** — `node tools/check-unknowns.mjs` exits 0. THE PREDICATE IS BYTE-LITERAL AND THE CHECKER IS SPELLED OUT HERE BECAUSE A LOOSE READING OF IT ALREADY PASSED A FILE THAT A STRICT ONE REJECTS (R-44). It: (1) locates the four-column unknowns table in evidence/UNKNOWNS.md; (2) requires EXACTLY SIX contiguous data rows and no seventh — the count is asserted, not floored, because a register that grows a row without a ruling is not a register; (3) parses the first cell, strips ONLY the surrounding `**`, and compares the ordered list to the EXACT STRINGS ["V0","V1","V2","V3","V4","V6-consent-gate"] — exact comparison, NEVER a regex with \b, because /^\|\s*\**V6\b/ matches `V6-consent-gate` (the hyphen is a word boundary) AND matches this node's own id; (4) requires each raw data line's FINAL BYTES to be `MEASURED` or `UNVERIFIED` with no trailing table pipe, so a row ending `… MEASURED |` FAILS; (5) for any UNVERIFIED row requires an explicit `fallback:<node-id>` token in the consequence cell and compares `<node-id>` exactly against a node id in erp/graph.json — there was previously no syntax distinguishing a fallback from any other node the row happens to mention; (6) rejects duplicate ids, extra cells, duplicate fallback tokens, a bare `V6`, and the status token appearing anywhere but the terminal position. ALL SIX ROWS ARE CURRENTLY MEASURED, so branch (5) has no fixture — the checker ships with a synthetic UNVERIFIED row in its own unit test rather than an unexercised branch.

> **H5** — `node --test tests/acceptance/banner.test.mjs` asserts the banner text matches /^Chromium \d+ · WebMCP (present|absent)( · simulated agent)?$/ and that a Chromium major below 153 additionally renders a node with [data-warn="chrome-lt-153"].

#### Day 3 — 2026-08-31 — Sign gate, deploy, blind grading, the export freeze

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **S5** | I3 | 4 | 0 | Human sign gate: server-owned decision state, snapshot-digest binding, one-shot guard |
| **S12** | I3 | 2 | 0 | Report revision counter and atomic sign lock |
| **H3** | I1 | 2.5 | 0 | In-page fallback agent (getTools + executeTool self-drive) |
| **H4** | I1 | 1.5 | 0 | Deterministic demo mode and fixed seed |
| **H6** | I1 | 2 | 0 | Unattended two-minute rehearsal rig |
| **D1** | I4 | 2 | 0 | Deploy live, single instance, with a response-header dump |
| **D2** | I4 | 2 | 1 | Custom domain and origin trial token (bonus, explicitly non-blocking) |
| **F4** | UX | 1.5 | 0 | Signature dialog with the worst-case consequence printed above the signature line |
| **F5** | UX | 2 | 2 | Policy-version indicator and live surface inspector panel |
| **T3** | I2 | 1.5 | 2 | Absence register: a resident read-only tool explaining why a tool is missing |
| **T4** | QA | 1 | 1 | Description budget and annotations conformance |
| **T5** | I2 | 1 | 2 | Blind surface export for C1 and the eval-kit |
| **E2** | C4 | 2 | 2 | Capability suite: the expected tool set for each application state |
| **E4** | L2 | 2 | 2 | Blind grading protocol, rubric, packet builder and the hermetic Codex home |
| **E5** | C4 | 1 | 1 | Deterministic surface accounting, provably zero model calls |
| **E8** | C1 | 1 | 2 | C1 blind grading run |

This is the day the red team's original warning bites: *"if there is still no site you
can open by the end of Day 3, everything above is worth zero."* **D1 is here, not on Day 5**, and it
deploys **exactly one instance** — the TOCTOU closure in §4④ is only true of a single instance and
no test in this repository would notice a second one.

**S5 is 4.0 h, not 3.5, and the extra half hour is R-13**: the `confirm_token`, and the honest
scripting and recording of **N-16 `neg-respond-without-click`**. Read §4④ before implementing it.

**T5 moved onto Day 3 with its freeze deadline** and **T4 moved from Day 1 to Day 3**: T4 asserts a
property "in every one of the SIX canonical states", and the six states do not exist until T2 has
driven the real registration lifecycle against F1's page on Day 2. On Day 1 only T1's static
definition list existed, so five of the six states could not be entered and the assertion was
unrunnable.

**C1's blindness is enforced by `CODEX_HOME`, not by `cwd`** (R-2). E4 builds the hermetic home
(`tools/blind-home.sh`) and E8 runs inside it with `--ephemeral --ignore-rules --strict-config` and
**no `-p`** — that home has no profile file — and never gets
`-c sandbox_workspace_write.network_access=true`. The blind packet is **exactly two files**,
`artifacts/tools.export.json` and `evals/blind/tasks.md` (PATHS.md §2.9).

**Gate Day-3** — 7 cut-0 nodes, each quoted verbatim from `graph.json`:

> **S5** — R-43, AND READ THE MODE BEFORE YOU READ THE PREDICATE: THE SHIPPED MODE IS THE TWO-CALL HANDSHAKE, NOT SUSPEND-UNTIL-SIGNED. contingencies[4] HAS FIRED. AND READ THE SCOPE OF THE MEASUREMENT BEFORE YOU QUOTE IT, BECAUSE IT IS NARROWER THAN THE DECISION IT SUPPORTS (R-44). ONE run, 2026-08-29, ChatGPT desktop built-in browser (Chromium 151, model 5.6 Sol), ON http://localhost:8795 AND NOT ON THE REMOTE ORIGIN - evidence/V4.json records the origin, and a previous revision of this text claimed the remote one. A tool whose execute() never settled was abandoned after 22,267 ms with `Timed out running CDP command "Runtime.evaluate" for tab 1`. WHAT THAT DOES NOT ESTABLISH: it does not separate a WebMCP client timeout from a CDP evaluation-wrapper timeout; it does not show the underlying execute() was cancelled; it does not carry to a remote origin, and V6-consent-gate is the standing proof that localhost and remote DIFFER in this client; and one run is not repeatability. V4's own predicate wants TWO runs compared at 20 percent by harness/compare-runs.mjs, and NEITHER RUN FILE NOR THE COMPARATOR EXISTS, so V4 HAS NOT PASSED. What the reading IS sufficient for is a CONSERVATIVE DEFAULT: no person reviews and signs a report in 22 seconds, so the handshake is the position to build toward and suspend stays behind the switch. Anything stronger than 'provisionally selected on one localhost run' is an overclaim. What does NOT change: `mode` is still one switch and BOTH implementations still ship (RISK.md section 4/V4), because the suspend path is correct in a client with no timeout and is this node's own negative control. What changes is which position the switch defaults to and which position this accept tests. `node harness/drive.mjs --scenario sign` exits 0 having observed, IN MODE `handshake`: (i) execute RESOLVES within 2 seconds carrying `{status:'awaiting_signature', ticket}`, where `ticket` is an opaque handle to the server's open record - THE RESULT BODY CARRIES NO confirm_token, NO snapshot_digest AND NO revision, and the test asserts their absence by key, because a result that carried the digest and the revision would hand x-signRequestState.survivingVector its two echoed values directly out of a tool call; (ii) a sign-request record in state `open`; (iii) a snapshot digest equal to `digest('outpocket/snapshot/1', snapshot)` under src/canonical.js with request_id INSIDE the projection; and (iv) the record moving to `answered` ONLY after POST /api/sign/{request_id}/respond, observed from a SECOND tool call that presents the ticket and returns the server's own sign_response. WHAT THIS NODE DOES **NOT** PROVE, AND THE SENTENCE THAT USED TO SIT HERE CLAIMED IT: CROSS-CALL REPORT IMMUTABILITY. The handshake opens a real gap that suspension did not have, and the thing that closes it is the server-held sign lock (x-freeze layer 2) - which is built and tested by S12, DOWNSTREAM of this node on a hard edge. S5 therefore proves the sign-record and answer-transition properties only, and makes NO claim about immutability across the gap until S12 passes. A previous revision of this accept asserted the 423 E_SIGN_IN_PROGRESS observation here and called it 'why the mode change costs no guarantee'; that was circular - it graded S5 on an artefact S5 does not output and S12 has not yet written (R-44). AND THE TICKET IS AN AGENT-VISIBLE CONTINUATION CAPABILITY, DISTINCT FROM confirm_token, AND CALLING IT 'NOT A CREDENTIAL' PROVES NOTHING BY ITSELF: rejecting it at /respond proves field separation and nothing more, while the second tool call still presents it to reach the record. The test therefore asserts, explicitly: it is unguessable and domain-prefixed; bound server-side to the authenticated session, the request_id AND the report_id; rejected when presented from another session or for another report; rejected after expiry and after terminal consumption; idempotent and side-effect-free under concurrent continuation calls; confirm_token rejected in the ticket position and the ticket rejected in the confirm_token position (403 E_NO_CONFIRM_TOKEN); losing or omitting the ticket cannot mutate or answer the record; a continuation call against a record still `open` returns the awaiting status rather than answering it; AND THE ORPHAN PATH THE HANDSHAKE CREATES AND SUSPENSION DID NOT - the first call succeeds normally and the agent simply stops, so the test advances the clock past expires_at and asserts the lock releases and a new sign request can be opened. DO NOT RECORD THE HANDSHAKE AS A MITIGATION OF survivingVector, AND THIS SENTENCE IS THE GUARD ON IT: withholding the digest from the TOOL RESULT does not withhold it from the CALLER, because any caller holding the session cookie reads the same values from GET /api/sign/{request_id}, so the forgery walk costs one extra request and is otherwise unchanged. AND IN MODE `suspend`, driven in the same scenario against the no-timeout fake client embedded in harness/drive.mjs: the execute promise still unresolved 2 seconds after the call, and resolution only after the same POST. That arm is what makes the switch real rather than a comment, and it is EXPECTED TO BE UNRUNNABLE against the built-in browser - which is precisely what V4 measured. AND `node --test tests/signature.test.mjs` exits 0, reproducing every published digest in erp/contracts/signature.schema.json from its own fixtures — including the consistent-re-total tampered row, whose fixture must state in words that its itemisation still sums to 18640 against an amount of 8640 and that this internal inconsistency is NOT what the digest catches. AND `node --test tests/acceptance/sign-state.test.mjs` asserts all three of: (N-15) neg-commit-without-human — synthesising a client-side sign_response and POSTing it to commit returns 409 E_NOT_SIGNED, and `signed_by` and `at` in the stored record came from the session cookie and the server clock and are NOT influenced by anything in the request body; (N-16) neg-respond-without-click, scripted verbatim as the attack — submit a report, NEVER render the dialog, POST /api/sign/{id}/respond with `{schema, request_id, decision:'signed', reason:null, method:'click', acknowledged_digest, acknowledged_revision}` echoing the values the server just issued, then POST the commit. This test asserts the CURRENT, HONESTLY RECORDED outcome and fails if it changes silently in either direction: with no confirm_token required, the commit SUCCEEDS (HTTP 200, a chain entry attesting Chen Xiao at a genuine server time) and the case is recorded controlStatus `known-open`; with the confirm_token required, a caller that cannot read the rendered dialog's DOM receives 403 `E_NO_CONFIRM_TOKEN` and the case is recorded controlStatus `enforced`; (confirm_token) the token is minted with the sign request, delivered ONLY into the rendered dialog's DOM, never returned in any tool-call result or any /api/sign/{id} response body, and required by /respond; (N-21) neg-decline-to-unlock AND THE ONE-SHOT GUARD, R-34, AND THIS NODE SHIPS THE CODE THE FROZEN TABLE ALREADY NAMES: erp/contracts/signature.schema.json's `x-signRequestState.answered` asserted that a second respond on an already-answered record is refused, and no entry in `x-rejectionCodes` claimed that condition — the table's own first rule is that no two entries may claim one condition, and the dual, that no condition may claim zero codes, now holds both ways. `E_ALREADY_ANSWERED` (409, raised at /respond, not at commit) is that code. The test drives the attack end to end: a caller holding the confirm_token POSTs a `declined` decision first; the human's genuine click then POSTs a `signed` decision to the same request_id and receives 409 `E_ALREADY_ANSWERED`; the commit that follows returns 200 `E_DECLINED`; and the stored record is asserted to be `answered`/`declined` after the first POST and BYTE-UNCHANGED after the second, so a server that silently overwrote the first answer fails here rather than in E9. THE SEVERITY TRAVELS WITH THE CASE AND MAY NOT BE INFLATED: this is a NUISANCE-GRADE DENIAL, not a forgery — nothing commits, nothing is attested, no false chain entry is written, the attacker cancels a signature and cannot produce one, and its precondition (read access to the rendered dialog's DOM, where the confirm_token is the only thing ever delivered) is STRICTLY STRONGER than the cookie-only vector N-16 sits on. The recovery the human sees is F4's, and it is 'already answered — start a new one'. AND — THIS IS THE SCHEDULED DEVIATION, AND IT IS WHY THE MECHANISM EXISTS — S5 files .team/deviations/DEV-E3-eval-case-known-open.md and lands the edit it authorises IN THE SAME COMMIT: erp/contracts/eval-case.schema.json examples[1] hard-codes controlStatus 'known-open' with observedToday 'IT COMMITS', which is the honest record of N-16 BEFORE the confirm_token; the confirm_token this node ships flips that case to `enforced` (R-27: `refused` is not a member of the frozen enum, and this sentence used to break the rule its own next clause states); E3's runner fails if the behaviour moves in EITHER direction without the record moving with it; and S10 froze that file on Day 1 under `sha256sum -c erp/contracts/FREEZE.md`. So the edit is mandatory, it is a frozen-file edit, and no node scheduled it — E3 (Day 4, and downstream of this node through S6) failed by construction. The gate: `git log -1 --format=%B -- erp/contracts/eval-case.schema.json` contains the literal string DEV-E3-eval-case-known-open, `node -e "const e=require('./erp/contracts/eval-case.schema.json').examples[1]; if(e.controlStatus!=='enforced') process.exit(1); if(/IT COMMITS/.test(JSON.stringify(e))) process.exit(1)"` exits 0, erp/contracts/FREEZE.md carries the RE-RECORDED sha256 line for that file, and `sha256sum -c erp/contracts/FREEZE.md` exits 0 afterwards. R-27, ONE WORD, AND IT IS THE WHOLE OF WHY THIS GATE WAS RED: the gate previously demanded `controlStatus === 'refused'`, and `refused` IS NOT A MEMBER of the frozen enum in erp/contracts/eval-case.schema.json, which is [enforced, known-open, not-runnable]. The edit this deviation authorises would therefore have failed ajv; CONTRACTS.md §11 check 1 (owner G6, wired into npm test) is DEFINED to fail when any examples[*] fails validation against its own schema; so the fix for a Day-4 trap turned npm test red repo-wide on Day 3. The enum's own word for 'this control now holds' is `enforced`, and that is what the case becomes. Adopt, do not send back: the contract is right about what it recorded and wrong only about the date.

> **S12** — `node --test tests/acceptance/sign-lock.test.mjs` — while a sign request is open, `curl` to any mutating endpoint returns 423 with a code field; the report's revision counter increments on every accepted mutation and is carried in the sign request; and the lock is taken in the SAME synchronous step as the snapshot computation, asserted by a test that interleaves two requests and shows no window between them.

> **H3** — `node harness/drive.mjs --fallback --scenario happy` runs Chrome with --disable-features=WebMCP, drives the same tool surface through the page's own getTools/executeTool, completes the 1->5->12->13 walk and exits 0.

> **H4** — `node harness/drive.mjs --url "$URL/?demo=1&seed=7" --dump-state > /tmp/a.json && node harness/drive.mjs --url "$URL/?demo=1&seed=7" --dump-state > /tmp/b.json && diff /tmp/a.json /tmp/b.json` exits 0.

> **H6** — `node harness/rehearse.mjs --runs 5` exits 0 and writes evidence/rehearsal.json showing 5 of 5 passes, each under 120 seconds, with per-step timings.

> **D1** — `curl -sI $URL | tee evidence/headers.txt` then the Origin-Agent-Cluster check `grep -i '^origin-agent-cluster:' evidence/headers.txt | grep -q '?0' && exit 1; exit 0` — the header must be ABSENT, or present with a value that is not ?0 — AND `curl -s -o /dev/null -w '%{http_code}' $URL` returns 200 AND `curl -s $URL/version` equals `git rev-parse HEAD` AND the deploy is configured for exactly ONE instance, recorded in evidence/D1-url.txt with the reason.

> **F4** — `node --test tests/acceptance/sign-dialog.test.mjs` — the element immediately preceding [data-signature-line] in DOM order has non-empty text matching /you are certifying .+ if this is wrong, .+/i; the dialog cannot be confirmed while that element is empty; and confirming POSTs to /api/sign/{request_id}/respond a body that VALIDATES against the frozen sign_respond_request — all eight required fields {schema, request_id, decision, reason, method, acknowledged_digest, acknowledged_revision, confirm_token} under additionalProperties:false — which carries NO signed_by, NO at, AND NO KEY FOR EITHER, both of which the server takes from the session cookie and its own clock; and whose confirm_token is read out of THIS dialog's rendered DOM, the only place it is ever delivered. AND — R-34, THE RECOVERY, AND IT IS A REQUIRED ASSERTION AND NOT A NOTE: when /respond answers 409 `E_ALREADY_ANSWERED` — the decline-to-unlock case, in which a holder of the confirm_token answers the request before the human's click lands — this dialog renders `already answered — start a new one` and offers a control that MINTS A FRESH SIGN REQUEST. The test asserts the rendered string and asserts that the control produces a NEW request_id. It may not be rendered as a transport error, as a retry of the same request_id, or as a silent no-op: the record is one-shot by construction, so a retry against the answered id can only fail again, and a human who is told nothing has had a signature cancelled without being shown that it was. The previous wording said the body carries ONLY {decision, reason}. That was unsatisfiable: such a body fails `required`, carries no acknowledged_digest for E_DIGEST_ACK_MISMATCH to check and no confirm_token for /respond to require. erp/CONTRACTS.md §7.3 names this defect, prescribes this wording and logs the correction in §15; the substantive point — no signed_by and no at, because the server takes both itself — is the part that was right and it survives verbatim.

#### Day 4 — 2026-09-01 — Re-canonicalisation, provenance, adversarial

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **S2** | I3 | 2 | 0 | Per-request role authorization with curl-level privilege-escalation tests |
| **S6** | I3 | 2 | 0 | Server-side re-canonicalisation and reject on mismatch |
| **S8** | I3 | 2 | 3 | Per-field provenance record |
| **D3** | I4 | 1.5 | 1 | Unattended survival check across the 2026-09-04 to 09-21 judging window |
| **F2** | UX | 3.5 | 3 | Report editor with per-field provenance and an agent-proposed vs human-edited diff |
| **F6** | UX | 2.5 | 1 | Demo skin aligned to the storyboard shot ids |
| **E3** | C4 | 2 | 2 | Negative-control suite with a declared pairing map |
| **E9** | C3 | 3.5 | 2 | C3 red-team break attempts |
| **E10** | C4 | 3 | 2 | Mutation check: prove the negative controls are not vacuous |

**F6 moved from Day 1 to Day 4.** Its predicate requires every storyboard shot id to
resolve to a CSS selector matching at least one element on the **built page**, and there was no
built page on Day 1 — F1 is Day 2 and F4/F5 are Day 3. It now runs on the same day as its last soft
input, F2, and after all three of F1, F4 and F5.

**E9 is 3.5 h, not 3.0, and the extra half hour is the C3 charter rewrite (R-13e), which this
node's own accept asserts so it cannot be quietly skipped.** `erp/charters/C3.md` enumerated exactly
four sign-gate attacks — replay, race a second respond, wrong `request_id`, expire-and-commit —
**none of which is "POST `/respond` yourself"**, and it told the red team to *"prove that closure,
not to rediscover the hole"*. The one instrument that would have found the live vector was pointed
away from it, by a sentence. E9 does not start until `grep -q 'POST /api/sign/{request_id}/respond
yourself' erp/charters/C3.md` exits 0 and `! grep -q 'prove that closure, not to rediscover the
hole' erp/charters/C3.md` also exits 0.

**Gate Day-4** — 2 cut-0 nodes, each quoted verbatim from `graph.json`:

> **S2** — `bash tests/acceptance/curl-403.sh` exits 0: for every route in the server's exported write-route table, an auditor cookie receives 403 with a JSON body carrying a code field; the script fails if the table has a route it does not cover (no silent gaps).

> **S6** — `bash tests/acceptance/toctou.sh` exits 0: sign a snapshot, mutate one line through a second request, then submit — the server answers 409 with code E_SNAPSHOT_MISMATCH and the day book contains both the signed digest and the recomputed one. The re-canonicalisation uses src/canonical.js (OCF-1), the same implementation the client used, never a second definition.

#### Day 5 — 2026-09-02 — Video and CI

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **S7** | I3 | 1.5 | 3 | SHA-256 hash chain over the day book, digest covering the source field |
| **D4** | UX | 4 | 0 | Video under 3 minutes, with audio, English, mechanism in the first 10 seconds |
| **E6** | C4 | 2 | 2 | CI running the evals against the DEPLOYED commit, not the working tree |
| **E7** | C4 | 1 | 2 | Results table published in the README |

**D4 moved off the final day deliberately.** It is 4.0 h — the single largest human item
in the plan — and it is human-gated for audio narration. Shooting it on submission day left zero
tolerance for a re-shoot. **Day 5 therefore carries 4.0 human-gated hours against a 2.5 h/day
average**; see §6.4, where that is stated plainly rather than hidden.

**Gate Day-5** — 1 cut-0 node, each quoted verbatim from `graph.json`:

> **D4** — `ffprobe -v error -show_entries format=duration -show_streams video/outpocket.mp4` reports duration < 180 AND at least one stream with codec_type=audio; the public URL in evidence/D4-video-url.txt returns 200 from a logged-out fetch; and docs/VIDEO-SCRIPT.md's first cue is timestamped <= 00:10 and contains at least one literal token from kb/webmcp/MECHANISMS.txt.

#### Day 6 — 2026-09-03, submit by 13:00 PT — Submission and freeze rehearsal

| Node | Owner | h | Cut | Title |
|---|---|---|---|---|
| **G1** | I4 | 0.5 | 0 | Flip both repos public with a root LICENSE visible in the GitHub About box |
| **D5** | I4 | 2 | 0 | Devpost four answers and submission |
| **D6** | QA | 2 | 0 | Freeze rehearsal on a clean profile / incognito |

Nothing else. No code. **G1 runs first**, immediately before D5 (R-42/D-30). **Day 6 carries 4.5
human-gated hours** — G1 0.5 + D5 2.0 + D6 2.0 —
against a 2.5 h/day average, on the morning of a 13:00 PT deadline. §6.4 states what to do about
that, and it is not "fire a rank": all five human-gated nodes are cut 0.

**Gate Day-6** — 2 cut-0 nodes, each quoted verbatim from `graph.json`:

> **D5** — docs/DEVPOST.md contains exactly 4 H2 sections matching the four required questions AND `node tools/lint-layer0.mjs docs/DEVPOST.md` exits 0 — zero banned wording, and zero claims appearing in kb/webmcp/RETRACTED.txt — AND the Devpost submission URL recorded in evidence/D5-submission-url.txt returns 200 from a logged-out fetch.

> **D6** — `node tools/freeze-check.mjs` exits 0 against the PUBLIC URLs from a fresh --user-data-dir with no session: the repo page loads logged out; `gh api repos/Caleb0796/outpocket -q .license.spdx_id` returns MIT; the video URL returns 200 and ffprobe confirms an audio stream; the live URL returns 200 and the first screen shows the env banner.

### 6.4 The human budget, and the arithmetic that hangs on it

Quoted from `graph.json.capacity` — **do not re-derive these numbers here**:

- Human-gated work is **10.5 h**: `G1 0.5 + V1 2.0 + D4 4.0 + D5 2.0 + D6 2.0`.
  All five are cut rank 0, "so this figure is IRREDUCIBLE: no rank of the ladder
  frees a single human-gated hour."
- Review overhead is **0.05 × the NON-human-gated agent hours only** — "a human
  does not review their own gated hours at 5%" — which is `0.05 × 107.5 = 5.375`.
- **Required: 15.875 h.**

| Working assumption | Available | Required | Verdict |
|---|---|---|---|
| 2.5 h/day × 5.5 days *(contingency)* | 13.75 | 15.875 | Does **not** fit, short by 2.125 |
| **3.0 h/day × 5.5 days — RULED 2026-08-28, THE PLAN OF RECORD** | **16.5** | **15.875** | **Fits. Nothing is cut, 0.625 h spare** |

**D-17 is settled at 3.0 h/day, so no rank fires and all 62 horizon-A nodes stay in scope.**
The rest of this section is the contingency, retained in case the budget slips in practice.

At 2.5 h/day the ladder would have to be fired to **rank 3** — the first rank that fits, at
13.475 h required with **0.275 h of spare, which is less than one video re-shoot.**
Ranks 1 and 2 do not get there (15.275 and 14.05 against 13.75), and rank 4 frees
zero horizon-A hours. Firing ranks 1–3 amputates **27 of the 62 horizon-A nodes**,
named exactly, in `graph.json.capacity.human_budget_sensitivity`:

```
V0 G5 G6 T4 D2 D3 F6 E5 T3 T5 F3 F5 E1 E2 E3 E4 E6 E7 E8 E9 E10 V2 V3 V4 S7 S8 F2
```

That is the whole eval lane and the instruments of **two** of the four rulers, the
absence register, the surface inspector, per-field provenance, the hash chain,
three of five unknowns, and the demo skin. What survives is the server kernel, the
tool-surface flips, the harness, the deploy and the video. *(The count is two, not
three. §7 works it through node by node; `graph.json.cut_ladder` rank 2 now says
"FOUR RULERS BECOME TWO" and this file agrees with it.)*

**The entire cut ladder hangs on a difference of half an hour per day.** PM settles
2.5 vs 3.0 on **Day 0, before any seat is dispatched** — see D-17, whose home and gate
is **`L0` accept gate (1)**: `L0` creates `erp/DECISIONS.md` on Day 0 with the ruling row
and the gate fails unless `capacity.human_hours_available` equals the ruled per-day figure
× 5.5. Do not discover it on Day 4, and do not hide it behind a verdict word.

**The ladder does not shorten the schedule.** Every one of the twelve nodes on the
critical path is cut rank 0 — `V5` included — so graph depth stays **29.5 h after every rank**. The
previous revision's "19.5 h → ~19.0 h via an H-lane reroute" was fabricated and is
retracted.

#### The human-hours figure is a TOTAL, not a per-day cap — and the schedule makes that visible

This is new in v2.1.0 and it is stated here because the day table now exposes it
(`capacity.human_hours_are_budgeted_in_total_not_per_day`). Human-gated work is
**not spread evenly**. It lands on exactly three days:

REGENERATED 2026-08-29 against `capacity.schedule_A.days` and the **ruled** D-17 figure of
**3.0 h/day** (not the 2.5 h/day contingency): R-42/D-30 moved `G1` from Day 1 to Day 6, and the
10.5 h TOTAL was right throughout while the per-day figures were not.

| day | human-gated nodes | hours | against the ruled 3.0 h/day |
|---|---|---|---|
| **Day 1** | V1 2.0 | **2.0** | 1.0 h of steering left |
| **Day 5** | D4 4.0 | **4.0** | **1.0 h over** |
| **Day 6** | G1 0.5 + D5 2.0 + D6 2.0 | **4.5** | **1.5 h over**, on the morning of a 13:00 PT deadline |
| Days 0, 2, 3, 4 | none | 0 | the review-overhead term only |

**No rank of the ladder touches this.** All five human-gated nodes are cut rank 0,
so firing rank 1, 2 or 3 frees exactly zero of these hours. If the user cannot give
roughly half a day to the video on Day 5 and half a day to submission on Day 6,
**the answer is to shorten D4's scope, not to fire a rank.** That is a D4-scope
decision and it belongs to PM alongside D-17, on Day 0 — not to whoever is holding
the camera on Day 5.

### Judging window
**2026-09-04 10:00 → 2026-09-21 17:00 PT, unattended.** **S9** (deterministic
reseed on boot) exists so that "the service was restarted" is equivalent to "clean
initial state" rather than "the demo is now broken." **D3** is the survival check —
and D3 is cut rank 1, so if the ladder fires, the judging window is unmonitored.

---

## 7. Cut sets

Cutting means **PM deletes a whole subgraph by decision**. It never means a seat
quietly shrinks a node — that is a deviation and W will report it.

**There is exactly one cut ladder and it lives in `graph.json.cut_ladder`.**
RISK.md's 10-rank ladder is **deleted, not deprecated**: it was inverted against
this one, and "fire ranks 1–3" meant opposite things in the two documents, in the
same words, at the hour when nobody re-reads a disclaimer. **Every trigger in
every document now names NODE IDS, never rank numbers.**

Quoted from the authority:

| Rank | Nodes | Horizon-A agent-h freed | Path after | Human-gated h freed |
|---|---|---|---|---|
| 1 | `V0 G5 G6 T4 D2 D3 F6 E5` | 12.0 | 29.5 | 0 |
| 2 | `T3 T5 F3 F5 E1 E2 E3 E4 E6 E7 E8 E9 E10` | 24.5 | 29.5 | 0 |
| 3 | `V2 V3 V4 S7 S8 F2` | 11.5 | 29.5 | 0 |
| 4 | `X1 X2 X3 X4 X5 X6` | **0.0** (15.5 h, all horizon **B**) | 29.5 | 0 |

**The third column is horizon-A hours only, and rank 4's entry is 0.0 on purpose.**
It used to report `15.5` in the same column as ranks 1–3, so a reader summing the
column got 63.0 h of relief out of a graph that contains only 48.0 h of cuttable
horizon-A work. Lane X's 15.5 h are horizon B, are not part of
`agent_hours_total_A`, and firing this rank changes **no Sprint A number**.

Cuts are **cumulative**: firing rank *r* deletes every node ranked 1..*r*.
The 35 horizon-A nodes not listed above are cut rank 0 and are never cut. That set is
exactly
`G1 G2 G3 G0 G4 L0 S1 S2 S3 S4 S5 S6 S9 S10 S11 S12 T1 T2 T6 F0 F1 F4 H1 H2 H3 H4
H5 H6 V1 V5 V6 D1 D4 D5 D6`.

What each rank costs, quoted:

- **Rank 1** — "No ownership pre-commit hook… No contracts conformance runner:
  nothing ajv-validates the schemas in `erp/contracts/` and nothing runs
  CONTRACTS.md check 3b, the frozen policy over the frozen snapshot… No custom
  domain. No unattended-window proof. No demo skin: the video is shot on the plain
  build, which F0 and D4 are explicitly designed to permit."
- **Rank 2** — "The ENTIRE eval lane… TWO rulers are idled — C1 and C3 — and FOUR
  RULERS BECOME TWO: nobody measures whether a blind agent can drive the surface,
  and nobody measures whether an adversary can break it, **which at this rank
  includes the live sign-gate vector N-16**. PM should treat this as a governance
  change, not only a scope change." Also lost: the absence register — the one
  un-killed original idea — and the live surface inspector, "so kernel 1 is no
  longer visible on screen and the video carries it entirely."

  > **The ruler count is TWO, and the arithmetic is worth doing once.** Rank 2 cuts
  > E4 and E8 (C1's only nodes) and E9 (C3's only node). **QA** keeps G3 and D6 at
  > cut 0, so QA keeps ruling. **L2** keeps ruling because its instrument is
  > `erp/RUBRIC.md`, which since R-16 is an **L0 output at cut rank 0** — not a
  > node, not cuttable, and no longer a missing file. **C1 and C3 both lose
  > everything.** The previous revision of the authority said "three of the four
  > rulers' instruments" and then "four rulers become THREE" while naming two
  > survivors; all three statements are gone. C4 goes idle too, but **C4 was never
  > a ruler** — it is the eval engineer.
- **Rank 3** — "Three of the five unknowns ship UNVERIFIED with named fallbacks;
  H3 becomes the unconditional demo path. Kernel 5 (per-field provenance) and the
  hash chain are amputated entirely, leaving three of five kernel mechanisms."
- **Rank 4** — "Nothing in Sprint A."

**D2 deserves a specific warning:** do not let it creep onto the critical path.
`pages.dev`, `vercel.app`, `netlify.app`, `github.io`, `chatgpt.site` and
`onrender.com` are **all on the public suffix list**, so none of them can obtain a
subdomain origin-trial token (MEASURED, HANDOVER §3.14). Chasing a token means
buying a domain. It is a bonus — **unless V1 returns ABSENT**, at which point
`graph.json.contingencies` flips **D2 from rank 1 to rank 0** and PM re-runs
`node tools/ready.mjs --check-cuts`.

> **That PSL fact is about D2 and only D2.** It does **not** apply to **V5**, whose
> host is now named: a free Render **Web Service** on `*.onrender.com` (R-18). V5
> mints no origin-trial token, so public-suffix-list membership is irrelevant to
> it. Do not let a true sentence about D2 delete a node that does not need it.

---

## 8. Decision log — closed, do not reopen

| # | Decision | Rationale | Grade |
|---|---|---|---|
| D-01 | **One entry: outpocket.** Not three parallel submissions | Multiple entries must be "substantially different"; three cases sharing one motif dilute rather than multiply. User ruled on this | user decision |
| D-02 | **Scenario is expense reimbursement.** Customs/HTS, insurance claims, government permitting, prior authorisation, IT ticketing are all **killed** | HANDOVER §7, each with a specific reason. Re-proposing any of them re-runs a dead search | MEASURED / PUBLISHED |
| D-03 | **Port `countinghouse/src/`, do not rewrite.** 1,396 lines: `tools.js` (401L surface compiler — the most valuable asset), `erp.js` (425L), `policy.js` (250L, **19 deterministic violation codes** — 15 line-level plus 4 report-level, `R01`–`R19` — integer cents), `scenarios.js` (187L), `samples.js` (133L). The port is node **L0**; the policy port is **S3** | Rewriting spends the sprint's scarcest hours reproducing tested logic. *(Ruling R-7: the count was re-counted from source 2026-08-28 and matches `erp/contracts/policy.schema.json` `examples[0]`. HANDOVER §1's "16 rules" is superseded and every occurrence of it is wrong.)* | MEASURED |
| D-04 | **T6 resolves as option (B):** remove `open_expense_report` from the auditor surface and replace it with a genuinely side-effect-free `get_report(report_id)` | HANDOVER §1 offered (A) add `readOnlyHint` or (B) make it constructive. Read-only must be a property of construction, not a hint we ask the model to respect. Ruling R-9; T6's accept names the resulting six-name auditor set | plan ruling |
| D-05 | **The two claims in §3 are the whole pitch.** No third claim is added without PM sign-off | Four review rounds produced exactly two survivors | MEASURED (review history) |
| D-06 | **Tools register in the top-level document only.** No `registerTool` inside any iframe, ever | The ChatGPT built-in browser discovers none of them, same-origin or not — and it fails **silently**. T1's accept enforces it with `find src/page -name '*.js' -print0 \| xargs -0 node tools/check-toplevel.mjs` | MEASURED 2026-08-28 |
| D-07 | **Revocation does not cancel an in-flight `execute` on the installed Chrome.** Copy and implementation say "blocks the *next* call" | MEASURED 2026-08-28: installed Chrome is **152.0.7977.64**, which is below 153, so this is the **expected state, not an alarm**. H5's banner renders `[data-warn="chrome-lt-153"]` for the whole demo and G4 blocks any copy claiming revocation stops an in-flight call | MEASURED |
| D-08 | **Deploy target: Render paid 0.5c-512mb, $7/mo** | The only landing spot requiring zero code change. The free tier sleeps at 15 min and a keep-warm ping exhausts the 750 h/month allowance, which suspends **every** free service in the workspace | MEASURED / PUBLISHED |
| D-09 | **Origin trial + custom domain are a bonus, never a blocker** — unless V1 returns ABSENT (§7) | Judges arrive via the ChatGPT built-in browser or a Chrome flag; both bypass the token | MEASURED |
| D-10 | **Build against the Chromium major installed now — 152.** If it breaks, we require the upgrade rather than back-porting | Explicit user preference. Ruling R-8: **V0 asks about the installed major, not 151**, and every version claim in the corpus anchors to 152 | user decision |
| D-11 | **Enterprise browser-policy risk is out of scope** | Explicit user instruction | user decision |
| D-12 | ~~G1 (repos public) executes on Day 1~~ — **SUPERSEDED by D-30 (2026-08-29)**. The original reasoning stands as a warning and is kept: these same disqualification gaps opened all four review rounds and were still open at the end of each, and *deferral is how they stayed open*. What was wrong was the remedy | OUR-ESTIMATE on leakage; MEASURED on the review history | superseded |
| D-13 | **Lane X is Track B.** Extraction into the two kits happens after 09-03 | Extraction on a deadline produces a worse product and a worse library. Firing the X rank frees 0 horizon-A hours | plan ruling |
| D-14 | **HANDOVER §12.1's code freeze is lifted.** It read "do not touch code until the user answers"; the user has answered and the repos exist | MEASURED: three repos created and pushed 2026-08-28 | MEASURED |
| D-15 | **The demo does not open with form-filling.** §5 | Four reasons, §5 | plan ruling |
| D-16 | **The fourth Codex seat is named C4 (eval engineer).** The roster is **16 seats, 13 of which own nodes**; `W`, `K1` and `K2` are declared **non-node seats** — "explicitly unbudgeted overhead, not idle rulers" — and **no acceptance predicate anywhere may hard-depend on an artifact produced by a non-node seat** (so G4 authors `kb/webmcp/BANNED.txt` itself; K1 enriches it afterwards) | The agreed roster said "15 seats, Codex takes all four positions" but only three Codex seats were ever named. `graph.json.non_node_seats` closes the "five seats own zero nodes" hole for the three that are overhead, and gives **E8** to C1 and **E9** to C3 so both rulers own an instrument | reconciliation |
| D-17 | **RULED 2026-08-28 by the user: the human daily budget is 3.0 h/day (16.5 h total).** The full graph fits with **0.625 h of spare and nothing is cut** — no rank of the ladder fires and all 62 horizon-A nodes stay in scope. PM's Day-0 job is to **record** this, not to decide it: write the `human_hours_per_day = 3.0` row into `erp/DECISIONS.md`, which `L0` CREATES on Day 0 for this purpose, and `L0` accept gate (1) proves it equals `capacity.human_hours_available / 5.5`. *Contingency, not the plan:* at 2.5 h/day the graph would be short by 2.125 h and ranks 1–3 would fire, deleting the 27 nodes named in §6.4. | ruled by the user |
| D-18 | **Seven `erp/*.md` files referenced across this corpus do not exist.** Each reference is repointed rather than stubbed, except one, which is escalated. `erp/VERIFY.md` → **`evidence/V0.json`…`evidence/V4.json`, summarised in `evidence/UNKNOWNS.md`** (V0–V4, V6). `erp/OWNERS.md` → **`graph.json.file_ownership` + `erp/PATHS.md`**. `erp/STORY.md` → **`docs/STORYBOARD.md`** (F0). `erp/DECISIONS.md` → **real, and CREATED BY `L0` ON DAY 0** carrying PM's `D-17` ruling row, gated by `L0` accept gate (1); `V6` appends its unknowns rows on Day 2 (R-24). The earlier repoint made it a `V6` output, which left the Day-0 ruling due into a Day-2 file — closed this revision. `erp/DEBT.md` and `erp/VERDICTS.md` → **no consumer survives; the references are deleted**, and §9's "book it" verdict writes a `.team/deviations/DEV-*.md` entry instead. **`erp/RUBRIC.md` → CLOSED by ruling R-16: it is an output of `L0`, which took +0.5 h for it (3.0 → 3.5).** It is L2's only instrument, four charters cite it, and it was produced by nothing; it is now authored on Day 0 at cut rank 0 and is no longer flagged OPEN anywhere. The whole of D-18 is now closed | PATHS.md §6 is the register of dead names. Stubbing all seven would have created seven empty files that lint clean and answer nothing. RUBRIC.md was the one that could not be repointed, so it was funded instead | plan ruling; **all seven closed** |
| D-19 | **The sign gate's claim is narrowed to what is provable, and the surviving forgery is written down rather than closed.** The only sentence anyone may say is *"a commit cannot be made without a POST from the authenticated session to `/api/sign/{request_id}/respond`."* **"A commit cannot be made without a human decision" is retracted**, along with every forgery-closed flag. The `confirm_token` (S5, +0.5 h) is defence in depth, not a proof, and its value is a function of open unknown **V3**. *(Row as recorded 2026-08-28; **V3 MEASURED `same-session` 2026-08-29, R-43**, the unfavourable branch — R-43.)* **N-16 `neg-respond-without-click` is scripted as the attack and records that it COMMITS today.** C3's charter is rewritten to point at that vector, asserted by E9's own accept (+0.5 h) | R-1 killed the one-request forgery. A two-request forgery survives it and is inside our own N-04 threat model: POST `/respond` yourself with the digest the server just issued, then commit — every rejection code was walked and none fires. What R-1 bought is the loss of attacker-chosen name and timestamp; what it cost is a record that is a **true attribution of a false event**, indistinguishable from a real click in the day book forever. Ruling R-13 | the vector: **MEASURED** by code walk; the claim: narrowed to what the state machine proves |
| D-20 | **No document may claim attestation of "a specific agent."** §3's claim (b) is *a specific authenticated **human**, a specific canonical **snapshot**, a write that arrived through the **tool surface***. `a specific agent` is on `kb/webmcp/RETRACTED.txt` and G4's `--assert-register` fails if it is not | WebMCP provides no agent identity — the specification says the browser agent uses a different internal mechanism — and H3, our own fallback, is indistinguishable from a third-party agent at the tool boundary. §3 of the previous revision claimed it anyway, inside the block seats are told to memorise, in direct contradiction of `graph.json`. Ruling R-21 | PUBLISHED (the specification); the correction is a plan ruling |
| D-21 | **Seven write tools, not five — and the number is COMPUTED from `annotations.readOnlyHint !== true`, never hard-coded** in a document, a schema or a narration. `the five write tools` joins the retracted register | The frozen `signature.schema.json`'s `x-freeze.does[0]` names five and omits `submit_expense_report` and `open_expense_report`. T4's accept — every read-only tool actually carries `readOnlyHint: true` — is what makes the count derivable rather than asserted. Ruling R-20 | MEASURED from the surface compiler; the enforcement is a plan ruling |
| D-22 | **The canonical contracts path is `erp/contracts/**`, and there is exactly one glob — and the directory is never stated as a count (R-28).** `erp/contracts/` holds **eight files** today — six `*.schema.json` and two frozen data documents, `canonical-vectors.json` and `policy-versions.json` — and **nine from Day 0**, once V5 adds `erp/contracts/probe-verdict.schema.json`. "The eight frozen schemas" was wrong about the composition and stale from Day 0; predicates say **every `*.schema.json` in `erp/contracts/`**. The contract files are **pre-existing planning artifacts**: L0 does not move, copy or re-author them, no node lists one as an output, and S10 freezes them where they are. The bare `contracts/**` glob is deleted | Both globs were live for the same eight files, which is how CONTRACTS.md addressed them at one path while L0, S10, G6 and PATHS.md addressed them at another, with nothing saying whether L0 moved or copied. 51 references were repointed. Ruling R-17 | MEASURED (the files are on disk at `erp/contracts/`) |
| D-23 | **`graph.json.capacity.schedule_A` is the only day table, and a restated table is legal only while a checker proves it equal to the authority.** G0 gains `--check-tables` and `--check-schedule` (+0.5 h) | The falsification rule used to forbid restatement outright, and therefore fired against four of the graph's own siblings — GRAPH.md, EVAL.md §4, PLAN.md §6.3, RISK.md §7.1 — while nothing checked any of them. All four happened to reproduce exactly, which is worse, not better: the agreement was hand-maintained and the rule was decorative. Rulings R-19 and R-22 | the tables: **verified by execution** this round; the checker: does not exist until G0 |
| D-24 | **V5's host is named: a free Render Web Service on `*.onrender.com`.** Web Service, not Static Site, because the probe must echo a cookie from `GET /whoami`. Public-suffix-list membership is irrelevant — V5 mints no origin-trial token | V5 is cut 0 and gates V1, the highest-information node in the plan, and it depended on an unstated hosting decision. The free tier's 15-minute sleep is harmless: V1–V4 are attended, single-sitting probes and the origin is thrown away. Ruling R-18 | plan ruling; the PSL fact is MEASURED and applies to **D2** only |
| D-25 | **The push knot is untied (R-26).** L0 gate (7) asserts the **one known failure by name** — 24 tests, exactly 1 failure, `auditor surface: read-only by construction` — instead of exit 0; **L1 pushes every merge to main** as a standing obligation, not a one-time gate; and `G3` keeps its hard edge from `T6`, asserts **zero** failures, and additionally proves the clone's `HEAD` equals the working tree's | Gate (2) declared exactly one failing test in the tree gate (6) pushes; gate (7) demanded exit 0 of that same commit; `G3` (Day 1, cut 0) demanded zero failures of the same remote while gate (6) said nothing else ever pushes. The first node of the sprint failed itself and `T6`'s fix could never reach `origin`. Ruling R-26 | MEASURED (the pushed tree's `npm test` exits 1 with exactly that failure) |
| D-26 | **`controlStatus` is `enforced`, never `refused` (R-27).** S5's scheduled deviation and E3's assertion both move to `enforced` | `refused` is not a member of the frozen enum `[enforced, known-open, not-runnable]` in `eval-case.schema.json`. CONTRACTS.md §11 check 1 (owner G6) fails when any `examples[*]` fails validation against its own schema, and every §11 check is wired into `npm test` — so the Day-3 fix for a Day-4 trap turned `npm test` red repo-wide. Ruling R-27 | MEASURED (ajv rejects `refused`) |
| D-27 | **"Eight frozen schemas" is dead vocabulary (R-28).** `erp/contracts/` holds eight **files** — six `*.schema.json` and two frozen data documents — and **nine from Day 0**, once V5 adds `probe-verdict.schema.json`. Predicates say **every `*.schema.json` in `erp/contracts/`**; no predicate or title states a count | The phrase was wrong about the composition and stale from Day 0, and it survived in `graph.json`'s own G6 title the same round CONTRACTS.md declared it dead. Ruling R-28 | MEASURED (the files are on disk) |
| D-28 | **G6's catch is CONTRACTS.md §11 check 3b (R-29):** run the frozen policy over the frozen snapshot and compare the computed verdict to the carried one | G6's advertised catch — a known `canonical_bytes` error in `policy-versions.json` — is **stale: 2458 and 2457 both recompute correctly**. Check 3b is a real catch, already implemented, and its absence is the whole of CONTRACTS.md §7.2a. Ruling R-29 | MEASURED (both byte counts recomputed) |
| D-29 | **The two WebMCP flag names are interchangeable, the flag works headless, and the eval suite may therefore run headless in CI (R-30).** "The flag name differs by scenario" is demoted to a **house rule about our own configuration**; H2's and V0's evidence files **record** `headless` and do not constrain it, while **keeping the flag requirement**; `cdpDomainEnabled` is recorded and never asserted on | MEASURED 2026-08-28 by the session owner, Chrome 152.0.7977.64, `--headless=new`, a clean dedicated `--user-data-dir` per launch, page over `http://localhost`: no flag → `undefined`; `WebMCP` → `object`, `registerTool` succeeds; `WebMCPTesting` → `object`, `registerTool` succeeds. `FACTS.md` IR-16(b) is **false and retracted** — `WebMCP.enable` returns OK even in a launch with no page API at all, so a probe reading the CDP domain instead of the page API reads "on" when it is off. This is what makes **E6** feasible at all. Ruling R-30 | MEASURED |
| D-30 | **G1 (flip both repos public) moves to Day 6, immediately before D5.** Ruled by the user 2026-08-29, overturning D-12. The contest requires a public repo **at submission**, not during the build, and keeping work in progress private until then is the lower-risk default. The supposed technical dependency was false: **MEASURED — `git clone` of a PRIVATE repo succeeds when the CLI is authenticated** (52 files cloned from `Caleb0796/outpocket` while private), so `G3`'s clean-clone gate needed the *push*, not the *visibility*; the `G1→G3` edge is deleted. D-12's process argument is preserved at zero leakage by a **Day-1 rehearsal against a throwaway repo** (see `G1.notes`) — never by flipping outpocket public and back, which is a real publish event. Day 1's human-gated load drops 2.5 → 2.0 h; Day 6 rises 4.0 → 4.5 h | MEASURED on the clone; user ruling on the schedule | ruled by the user |

---

## 9. Method — why this is a graph and a team, not a checklist

A checklist has one reader and one failure mode: the reader silently decides an
item is "basically done." A graph plus a team has an owner per item and an
acceptance predicate per item, so "basically done" is not expressible.

### The eight graph principles (applied everywhere; the data is in `graph.json`)

> **An eighth rule, added in v2.1.0 and aimed at this file (R-22): a restated table
> is legal only while a checker proves it equal to the authority.** The previous
> falsification rule forbade restatement outright, so it fired against four of the
> graph's own siblings — GRAPH.md, EVAL.md §4, this file's §6.3, and RISK.md §7.1 —
> while nothing checked any of them. All four happened to agree, which is the worse
> outcome, not the better one: the agreement was hand-maintained, and a decorative
> rule is how seven writers ended up each holding a private node table.
> `node tools/ready.mjs --check-tables` (G0) is what converts a restatement from a
> liability into a legal convenience.

1. A node is **the smallest unit that carries its own mechanically checkable
   acceptance predicate**. If you cannot write the check, the node is not a node.
2. An edge is **a frozen artifact, not a feeling**. If you cannot name the file
   that crosses the edge, the edge is fake and the two nodes are actually one node.
   All 122 edges carry a `kind` and a `contract`. Two were added in v2.3.0:
   **`V5 → S10`** and **`V5 → G6`** — `V5` writes the ninth contract file into the
   directory `S10` freezes and `G6` validates, and only the schedule ordered them,
   which `--check-schedule` cannot prove because it walks hard edges only. Two were
   added in v2.1.0: **`G1 → G3`** (G3 clones a repo that is private until G1 flips
   it) — **SINCE DELETED by R-42/D-30, 2026-08-29**, because an authenticated `git
   clone` of a private repo succeeds (MEASURED), so G3 needs the push and not the
   visibility flip — and **`L0 → H5`** (H5 runs `node --test` and had no hard path
   to L0 at all), which stands.
3. **Exactly one owner seat per node.** A seat may write a path if **either** it
   owns a node listing that path in `outputs`, **or** the longest-matching glob in
   `file_ownership` names it — **(a) beats (b)**
   (`graph.json.conventions.ownership_rule`). `tools/check-ownership.mjs` (**G0**)
   implements exactly this and nothing else; **G5** is the pre-commit hook. The
   previous glob-only rule mechanically rejected 23 of the graph's own node
   outputs, so a charter that says "you must never touch `tests/`" is wrong.
4. **The critical path is computed** from the estimates, never asserted. §6.1
   quotes it; `node tools/ready.mjs --path` recomputes it. This file no longer
   holds a second copy to drift against.
5. **Cut sets are declared in advance with a rank** (§7) and there is **one**
   ladder. Cutting deletes a subgraph by PM decision; it never means silently
   shrinking a node. Triggers name node ids, never rank numbers.
6. **The ready set is recomputed each morning**: nodes whose inbound nodes are all
   done. A blocked node **must name the node it waits on**.
7. **Interface freeze precedes parallelism.** Five freezes are declared in
   `graph.json.interface_freezes`, each naming the node that freezes it and the
   node ids it unblocks — and `node tools/ready.mjs --check-freezes` asserts that
   every unblocked id is a real node with a hard edge from the freezing node. The
   one hard coupling between **I2** (lane T) and **I3** (lane S) is
   **`erp/contracts/violation.schema.json` — SINGULAR** — frozen by **S10** on Day 1,
   unblocking **T1, S1, S4**. The plural spelling `erp/contracts/violations.schema.json`
   appeared 29 times across 7 files and **does not exist and never will**
   (PATHS.md §1). Until that file is frozen, T and S running "in parallel" is
   fiction.

### How a session picks up work

1. Read §0 of this file, then `erp/graph.json` and `erp/PATHS.md`.
2. Find your seat id. Take **only** nodes whose `owner` is your seat.
3. Compute your ready set: nodes whose `inputs` are all marked done. If nothing is
   ready, say **which node id you are waiting on** — never "waiting on I3".
4. Before writing code, re-read your node's `accept` field. If you cannot run that
   command today, the node is under-specified: raise it with **PM** before starting,
   not after.
5. Work only inside the file paths your lane owns, and **take every path from
   `erp/PATHS.md`** — never from memory, and never invent a parallel spelling
   because it reads better in prose. `web/**`, `policy/**`, `public/**`,
   `deploy/**`, `submission/**`, `tests/curl/**` and `harness/findings/**` are
   **dead**: they match no glob in the ownership matrix and no accept predicate
   anywhere.
6. Close the node by running its `accept` command and pasting the output. Closing a
   node also requires **one five-field pit-entry** (`kb/pits/<node-id>.md`) for the
   knowledge base — "no pit" is a legal entry. This is the only new ceremony in the
   system and it hangs on the existing merge gate. It is unbudgeted overhead
   (PATHS.md §2.8); if PM is short on hours, drop it from the merge gate rather
   than letting it silently block merges.

### The four non-overlapping rulers

Write this into every relevant document. Overlapping rulers is how a team talks
itself into shipping. Quoted from `graph.json.rulers` — each ruler now owns at
least one node, which was not true before:

| Seat | Measures | Instrument | Owns |
|---|---|---|---|
| **QA** | *Is it done?* | Acceptance predicates met | G3, G6, T4, D6 |
| **L2** | *Is it enough to win?* | The rubric. **L2 writes zero product code** | E4 (instrument is `erp/RUBRIC.md` — **an `L0` output at cut rank 0** since R-16, so it is not a node, not cuttable, and no longer missing; see D-18) |
| **C3** | *Can it be broken?* | Adversarial, max reasoning | E9 |
| **C1** | *Can a blind agent use it?* | **Only** the two-file blind packet. **C1 gets no repo access** — a verifier who can read the source systematically over-rates the tool surface, because the judge's model sees only `description` + `inputSchema` | E8 |

**Blindness is enforced by `CODEX_HOME`, not by `cwd`** (ruling R-2). `-C` is not a
jail and `-s read-only` still grants full-disk read; the base `~/.codex/config.toml`
enables MCP servers, plugins and hooks that bypass the sandbox entirely. If the
ladder fires to rank 2, **C1 and C3 both lose their instruments and four rulers
become TWO** — QA and L2 — because QA keeps G3 and D6 at cut 0 and L2's instrument
is an L0 output at cut 0. Treat that as a governance change, not only a scope
change. §7 does the arithmetic node by node.

### Seats and control

16 seats, 13 of which own nodes (D-16). Resident Claude sessions boot with
`claude --model <m> --effort <level> --append-system-prompt-file .team/charters/<seat>.md`
(MEASURED: `--model` and `--effort` are real session-level flags); `.team/charters`
is a symlink to `erp/charters/` created by **L0**, and nothing created it before.
Codex seats run `codex exec -p <profile>` against `~/.codex/<name>.config.toml`.

Two Codex facts that L0's accept asserts and every dispatcher must respect:

- **A missing profile is silent.** `codex exec -p <missing-profile>` exits 0 with
  no warning and falls back to the base config. A profile check must `test -f` the
  file, parse it, **and** grep the run banner for `reasoning effort: <level>`
  (ruling R-3).
- **Bare `-s workspace-write` has no network.** Any Codex command that must reach
  the network or run `npm install` appends
  `-c sandbox_workspace_write.network_access=true` — C2, C3, C4. **Never** the
  blind run (ruling R-4).

Two leads on purpose, and **asymmetric on purpose**: **L1** is the foreman
(bootstrap, contract dispatch, merges, **sole pusher to main**), **L2** is the
commissar (the only ruler of "good enough to win"). Two identical leads from the
same vendor with the same prompt share failure modes, and "mutual accountability"
degrades into mutual confirmation.

**Honest limitation, stated so nobody plans around a capability we do not have:**
an agent cannot open a new terminal window. It can wake an idle session, or shell
out to a headless `claude -p`, but a genuinely dead resident session requires a
human to restart it. **W** (overseer) exists to detect the stall — it produces
**evidence only, never verdicts** — and W owns no node and no hours.

### Deviations

Three layers: (0) zero-token hooks block banned identifiers, over-long
descriptions, banned wording and ownership violations (**G4**, **G5**); (1) **W**
files a fixed-format deviation ticket in `.team/deviations/DEV-*.md`; (2) **PM**
rules one of three ways — **adopt** (the plan was wrong: edit PLAN.md, no rework),
**reject** (name the specific failed acceptance clause, a rework deadline, and
block the branch), or **book it** (a `.team/deviations/DEV-*.md` entry marked
`booked`; there is no `erp/DEBT.md` and nothing creates one — D-18).

**Adoption must be cheaper than rejection**, or engineers learn to hide deviations.
An adoption rate that stays at zero means W is too strict — that is a signal to
tune, not a sign of discipline.

Note that **G5 is cut rank 1**. If the ladder fires, layer 0 loses its ownership
hook and ownership reverts to L1 reading diffs by hand; `tools/check-ownership.mjs`
itself survives in **G0**, so the check can still be run manually.

---

## 10. Standing risks

Triggers name **node ids**, never rank numbers. Responses are quoted from
`graph.json.contingencies` where one exists.

| Risk | Trigger | Response |
|---|---|---|
| ~~**V1 comes back ABSENT**~~ **DID NOT FIRE — V1 is MEASURED `PRESENT`** (2026-08-29, remote HTTPS origin) | `document.modelContext` missing in the ChatGPT built-in browser on a plain HTTPS origin | Fatal to the primary demo path. **D2 flips from cut rank 1 to cut rank 0** — a custom domain becomes mandatory "because judges would otherwise see a page with zero tools while local testing stays green" — and PM re-runs `node tools/ready.mjs --check-cuts`. **H3** (in-page fallback agent) carries the video, banner-labelled honestly by **H5**. Owner: PM |
| ~~**V2 comes back `does-not-refresh`**~~ **DID NOT FIRE — V2 is MEASURED `refreshes`** | The built-in browser does not re-read the tool list mid-session | "Kernel 1 is not demonstrable live in that client. The demo runs through H3 or Chrome with `--enable-features=WebMCP`, and `docs/VIDEO-SCRIPT.md` says which. The storyboard re-prompts the agent after the flip and the narration says 'on its next turn', never 'on the spot'." Owner: L2 |
| ~~**V3 comes back `no-cookie`**~~ **DID NOT FIRE — V3 is MEASURED `same-session`** | An agent-initiated `execute` does **not** carry the page session cookie | "Kernel 3 is dead as stated. Fall back to a page-held bearer token minted at login and passed by the page bridge, and retract 'no new credential holder' to 'no credential leaves the page'. Costs about 1.0 h inside S1, which S1's 2.5 h does not contain — S1 goes to 3.5 h and the path is recomputed." Owner: L2 |
| **V3 comes back `same-session`** — **FIRED 2026-08-29**, this response is now mandatory prose and not a branch | An agent-initiated `execute` **does** carry the page session cookie | **This is the answer that makes the sign gate worse, not better**, and the previous revision framed V3 only as an attribution question. "An agent that carries the cookie AND can read the DOM can reach the `confirm_token` and drive POST /respond itself: N-16 `neg-respond-without-click` stays **KNOWN-OPEN** for that caller, and S5's residual-risk sentence must say so verbatim in DEVPOST and the video script. No wording anywhere may upgrade to 'a human decided'." (R-13.) Owner: L2 |
| **Anyone writes that a commit requires a human decision** | Any document, in any wording, says a commit cannot be made without a human decision, or flags the sign-gate forgery as closed | **R-13 has been violated.** N-16 commits today and the plan knows it. The only provable sentence is *"a commit cannot be made without a POST from the authenticated session to `/api/sign/{request_id}/respond`."* **Delete the stronger sentence; do not weaken the test.** G4's `--assert-register` and D5's lint both scan for it. Owner: L2 |
| **V4 reports a timeout** — **FIRED 2026-08-29 at 22.3 s**, this response is now mandatory and S5's accept tests the handshake arm | A suspended `execute` times out before the sign gate can complete | "S5 must ship the two-call handshake mode, not the suspend-until-signed mode. S5 is written with BOTH modes behind one switch from the start; this is not a Day-4 rewrite." Owner: I3 |
| **H2's first hour fails** | The regression gate records `invokeToolRoundTrip:false` — no completed CDP `WebMCP.invokeTool` round trip on the installed Chrome under the flag | "The channel `harness/drive.mjs` executes through is gone on this browser and lane E's mode question is reopened the same day. PM must be told that day; it is a Day-1 fact, not a Day-4 discovery. **Page-API reachability is no longer the question** — MEASURED 2026-08-28 on Chrome 152.0.7977.64, `getTools` and `executeTool` are both functions under **either** flag name, headed and under `--headless=new` alike, so the flag-mismatch worry this row used to carry is retired. Two traps: an un-awaited `getTools().length` is `undefined`, and `WebMCP.enable` returns OK in a launch with no page API at all. Only the round trip discriminates." Owner: I1 |
| **The spec moves under us** | The WebMCP spec has changed weekly: `getTools()` 07-21, `executeTool()` 08-14, two-arg 08-18, `AbortSignal` 08-19. **The "iron rules" are ~10 days old** | Re-verify against the installed browser on the day you build. Spec text, WPT conformance tests, and browser implementation are **three different things** — `webmcp.idl` already disagrees with the spec body |
| **Judges never open the site** | Contest rules explicitly permit judging from text, images and video alone | **D4** is cut rank 0 and now sits on Day 5, not Day 6. Mechanism in the first 10 seconds, asserted by both **F0** and **D4** |
| **Nothing runnable by end of Day 3** | Gate Day-3 fails — specifically **D1** or **S2** | PM fires the ladder through **rank 3** (the node set is named in §6.4 and §7) and re-baselines. Note that this frees review overhead, **not** schedule depth: graph depth stays 29.5 h. The red team's original line stands: with no openable site by the end of Day 3, every narrative above is worth zero |
| **The ruled 3.0 h/day does not hold in practice** | Two consecutive days close with under 3.0 h of the human's attention actually spent, so the D-17 ruling is not being met | The full graph then does not fit — 13.75 available against 15.875 required. Ranks 1–3 fire and 27 of 62 horizon-A nodes are deleted, leaving 0.275 h of spare. At 3.0 h/day nothing is cut and 0.625 h is spare. **And note what the ladder cannot touch:** Day 5 and Day 6 each carry 4.0 human-gated hours against a 2.5 h/day average, all of it cut 0. If that is the problem, cut D4's scope — §6.4 |
| **Prefix-cache cost gets mis-stated** | Someone writes "a stable prefix saves tokens" | It is the **opposite**: each surface flip triggers roughly 1.25× cache write. The honest framing: we spend prompt-cache efficiency to buy a page-enforced workflow constraint: the tool the agent would need is not on the surface until the state permits it. The boundary that actually holds is the server's per-request check (**S2**), not the surface |

---

*Last closed decision: **D-24**. D-18's `erp/RUBRIC.md` clause is closed too
(R-16), so §8 has no open rows. To reopen any row, file a deviation ticket with
PM. To add a claim to §3, you need L2. To change a number in §6 or §7, change
`erp/graph.json` and regenerate this file — **never edit a table here**, and never
reconcile one by hand: `node tools/ready.mjs --check-tables` is what makes the
restatement legal (R-22).*
