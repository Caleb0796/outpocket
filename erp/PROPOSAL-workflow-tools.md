# PROPOSAL — workflow-shaped tools alongside the atomic surface

**Status: PROPOSAL. Not a plan change.** `graph.json` and `PATHS.md` are unedited
and remain the authorities. Nothing here is booked until the user accepts an
option. Written 2026-08-28 against `graph.json` v2.3.0 (68 nodes, 121 edges,
110 hard / 11 soft). R-42/D-30 deleted `G1 → G3` (121 -> 120) and D-50 added
`H2 → F1` (120 -> 121), so the totals coincide with this line again by accident,
not because nothing moved. Two different edges, one net.

**Decision window: hours, not days.** `S10` runs end of Day 1 (2026-08-29). Stated
precisely, because the loose version of this sentence was wrong: `interface_freezes`
has `S10` freezing **`violation.schema.json` only** — the other four freezes belong
to `S1`, `T5`, `E4` and `F0` — but `S10.accept` ends in
`sha256sum -c erp/contracts/FREEZE.md`, and that manifest covers the whole frozen
set (the eight pre-existing contract files plus `V5`'s `probe-verdict.schema.json`,
nine at freeze time). All three files this proposal must edit are inside it. So the
deadline conclusion is unchanged: every frozen-file edit here is ordinary work
before that commit and a PM deviation ticket after it.

---

## 1. The gap

Every command below carries `--exclude=PROPOSAL-workflow-tools.md
--exclude-dir=reviews`, and that is not cosmetic: without the excludes these greps
stopped reproducing the moment this file and the review that audited it were
written, because both discuss the words being searched for. A document that
presents commands as "run just now" has to stay re-runnable by the reader.

```
$ cd /Users/calebwei/mcp/outpocket
$ X="--exclude=PROPOSAL-workflow-tools.md --exclude-dir=reviews"
$ grep -rniE "openapi|swagger" $X erp/ ; echo "exit=$?"
exit=1
$ grep -rniE "workflow-shaped|workflow tool" $X erp/ | wc -l
       0
$ grep -rn "Oracle Fusion Expense agentic" $X erp/
erp/FACTS.md:858:| The vendor-internal Oracle Fusion Expense agentic prompt the user supplied | Publishability unconfirmed. Never quote it verbatim, never attribute it, and do not use it as a benchmark arm without explicit clearance from the user. |
$ cd /Users/calebwei/mcp/countinghouse && grep -cE '^\s+name: "' src/tools.js
15
```

Three facts, all re-run just now. (In `zsh` an unquoted `$X` does **not** word-split
— write the two flags out literally, or the excludes silently do nothing and every
line above comes back wrong. Measured that failure mode while re-running these.)

**The corpus never asks or answers *"why is this not just a REST API with an
OpenAPI spec?"*** — zero hits. **No line count is published here**, because it
moves under the reader: the two figures a previous revision printed were already
296 lines stale when it printed them (`RUNBOOK.md` grew 481 → 777 four minutes
later), and its retraction of the figure before *those* was itself wrong —
`10,415 − 777 = 9,638` exactly, i.e. "9,638" was this same corpus measured before
`RUNBOOK.md` existed. Three published numbers, three wrong, one wrongly withdrawn.
The claim that does not move is the invariant, and it comes with its command:

```
$ grep -rniE "backend (integration|mcp|server)|REST API|OpenAPI|swagger" \
    --exclude=PROPOSAL-workflow-tools.md --exclude-dir=reviews erp/
erp/RISK.md:400:| BW-26 | `impossible without WebMCP` | Untrue and trivially …
erp/FACTS.md:897:| "Impossible without WebMCP" / "only WebMCP can" | Trivially …
```

**Two lines in the entire corpus address the backend counter, and both are
retraction rows.** The nearest thing we have is `RISK.md` BW-26, which
retracts `impossible without WebMCP` and prescribes *"what WebMCP changes is where
the credential lives, not whether the task is possible."* That is our whole answer,
and it is a sentence, not a screen. **And the tool surface is atomic CRUD** —
fifteen tools, `create_expense_report` through `submit_expense_report` plus reads:
the API, exposed.

**The user's ~600-line exemplar appears exactly once, in the poisoned-citations
table.** They supplied it with an intuition — *WebMCP could expose workflows, not
just concrete APIs* — and the intuition never became design. **That quarantine
stands and this proposal does not weaken it.** Nothing below quotes it,
paraphrases a line, benchmarks against it, or attributes anything to it. What is
used is its *shape*: that a production agentic app needs hundreds of lines of
prompt to describe a reimbursement procedure over an atomic API. That needs no
citation and gets none. This file lives in `erp/`, excluded from the `G4` scan;
none of its text may reach `docs/DEVPOST.md`, `docs/VIDEO-SCRIPT.md`, the README or
the video without passing the same lint as everything else.

The two gaps are one gap. Workflow-shaped tools are the demonstrable answer to the
REST question, and the user's three original arguments — model drift creating
enterprise maintenance cost, generality demanding very long prompts, and
reimbursement carrying personal responsibility — all live there.

---

## 2. The design argument, and the counter-argument

**A workflow tool is not a macro.** A macro bundling
`create → open → add_line → link_receipt` is three CRUD calls behind one name; the
agent still needs the prompt to know *when* to call it and what to do on partial
failure. A workflow tool differs on three axes this codebase already has machinery
for. (i) **Its precondition is presence on the surface** — the surface compiles
from `role × object-state × validation-verdict` (kernel ①), so a workflow tool is
registered only where its procedure is legal and `explain_missing_tool` (`T3`)
answers why when it is not; the ordering rule stops being prompt text. (ii) **Its
failure is the same deterministic record as a validation failure** — an array of
`outpocket.violation/1` envelopes (`S4`), twelve required fields, `fix_class` from
the closed enum, `candidates[].origin` from
`{enum_member, existing_entity, policy_threshold}`. (iii) **Its input domain can be
restricted to values the server itself issued** — the strongest axis, exploited by
`W2` below.

**The maintenance argument, at its strongest and no stronger.** A procedure encoded
in a 600-line prompt is maintained by the enterprise and re-validated on every
model update; the same procedure encoded as a tool on the origin that owns the
policy is maintained once, by the party that owns the rule, and every model gets
it. That is a real argument — and it is **not a WebMCP argument**. Say so before a
judge does. An OpenAPI spec can encode a procedure (operation descriptions,
extensions, generated clients). A backend MCP server can expose exactly these five
tools, same names, same envelopes. A previous revision of this file said what is
left specific to WebMCP is *two* things. **It is one. The second is withdrawn
here.**

**Survivor 1 — credential topology.** A backend MCP server needs its own credential
and its own view of the session to know what state the report is in; the origin
already holds that session (kernel ③), and workflow tools inherit it rather than
adding to it. Honest, server-checkable, and **the project's existing claim**
(BW-26's approved sentence) — not a third one.

**Survivor 2 — WITHDRAWN.** It read: *"a static OpenAPI document cannot make an
operation cease to exist because a policy version bumped mid-session, and a backend
server can only do so by being told a state it does not otherwise hold."* Both
halves fail. **MCP ships `notifications/tools/list_changed`**: a backend MCP server
changing its advertised tool list mid-session is a first-class spec feature, not an
exotic capability, so a dynamic surface is not ours to claim — and the OpenAPI half
of the sentence was never the live counter anyway, the backend MCP server was. The
second half is exactly backwards for *this* application: in an expense ERP the
**backend is the system of record** for report state and policy version, so it
already holds precisely the state the sentence asserts it does not. Survivor 2
therefore collapses into survivor 1 — the one thing a backend would have to be
*told* is the browser session, which is survivor 1 restated. It was never a second
claim; it was the first one wearing a second hat.

**One survivor, already ours: credential topology — and workflow tools do not
strengthen it either.** A previous revision, having withdrawn survivor 2, still
wrote that workflow tools "make the existing claim demonstrable" by turning BW-26's
approved sentence into "a surface a judge can watch change." **That is survivor 2
walking back in through the recommendation.** The *changing of the surface* is
dynamic registration — the exact property just withdrawn, because
`notifications/tools/list_changed` makes it a first-class backend-MCP feature.
Test the sentence against what is actually shipped: `W1` puts a multi-step
procedure on screen and `W5` an ordered remaining plan, and this section has just
conceded that a backend MCP server can expose those same five tools under the same
names with the same envelopes. **The beat does not discriminate.** What *would*
show credential topology is the **absence of a second login step** — and that is
equally visible on the existing fifteen atomic tools. So: workflow tools add no
claim and make no claim more demonstrable. Their gain is **rhetorical** — a screen
reads better than a paragraph in front of a judge — which is real, and is not a
property of WebMCP. §5 decides on that and on nothing else; any argument for
shipping them that reaches for a technical gain is reinstating survivor 2 a third
time.

**And note the vocabulary that sentence was written in.** *"Cannot make an operation
cease to exist"* is **lock language** — BW-01 in new clothes, walking through the
exact door §6.2 exists to guard, three sections above the guard. The surface is a
**menu, not a lock**. The only admissible form of that claim is *"cannot make an
operation stop being **offered**"*, which is a statement about registration, not
authorization. §6.2 was written to catch the atomicity paraphrase and did not catch
this one; assume it will not catch the next one either, and write "offered".

**Concede the rest.** Workflow shape is not WebMCP-specific, it is not novel, and
we claim nothing about how many others ship it (§6.4). Honest framing: *workflow
tools answer the REST question with a demonstration instead of a paragraph; the
WebMCP-specific part is unchanged and is still just the one claim.* And **one part
of the intuition cannot be written down at all** — "and doing so would raise
accuracy." We have no admissible evidence: `FACTS.md` §8 forbids the external
accuracy sources (a mock simulator with zero model calls; a misread column), `E5`
proves our own eval kit makes zero model calls, and BW-05/06/07 forbid the
originality framing. Build for maintenance and demonstrability; say nothing about
accuracy.

---

## 3. Proposed tool set

Five tools alongside the fifteen atomic ones. Money crosses as integer cents named
`<thing>_cents` (R-6). Every input schema is `additionalProperties: false`, closed
enums, `maxItems` on every array. Read-only tools carry `readOnlyHint: true`,
keeping them out of the computed revoked set (R-20).

| | Tool | RO | Input | Returns | Procedural knowledge moved onto the origin |
|---|---|---|---|---|---|
| W1 | `draft_report_from_receipts` | no | `{title ≤80, project (enum_member), receipt_ids (existing_entity, maxItems 12)}` | `{report_id, lines[{line_id, receipt_id, provenance:"agent_proposed"}], violations[]}` | The order (create → open → add → link), one-line-per-receipt pairing, and that money fields are **not** invented — each new line returns one `provide_missing_data` envelope naming the absent field. No receipt parsing, so no OCR and no accuracy claim. |
| W2 | `apply_violation_fix` | no | `{report_id, rule_id ^[RS][0-9]{2,3}$, field, candidate_value}` | `{applied, before, after, remaining_violations[]}` | Rejects any `candidate_value` the server did not issue in that violation's own `candidates` array. Since `candidates[].origin` is closed to enum members, entities already in the session, and the crossed threshold, **there is no origin for a value derived from the disputed claim** — the evasive rewrite `x-fixLint` bans by substring is refused **server-enforced**, by a per-request check against the candidate set the server itself issued, rather than by grep. (Written "server-enforced", not "unreachable by construction": that phrasing is BW-11's family — a structural-guarantee claim — and this one is defensible only because a server actually checks it on every call.) |
| W3 | `prepare_for_submission` | **yes** | `{report_id}` | `{ready, blocking[], warnings[], snapshot_digest, consequence_line}` | "Validate before submit; `warn` does not block, `block` does; here is the exact snapshot the signature will bind and the worst-case consequence you will attest." Returns the digest `S5` binds and the line `F4` prints above the signature line. |
| W4 | `recheck_under_current_policy` | **yes** | `{report_id}` | `{from_version, to_version, resolved[], newly_blocking[]}` | Kernel ② made callable: a finance edit that bumps the policy version is recomputed in-session and the caller learns what appeared and what cleared. Never carries a stale violation across a bump. |
| W5 | `explain_next_step` | **yes** | `{}` | ordered `[{step, envelope}]` | The absence register's twin. `explain_missing_tool` answers "why is this tool gone"; this answers "what is the ordered procedure from here to a signable report", as `entity:"surface"`/`"report"` envelopes under `S`-prefixed surface rule ids. **This is where the 600-line procedure actually lands.** |

**Composition, not adjacency.** W1/W2 emit the `S4` envelope; W3 reuses `S5`'s
snapshot digest and `F4`'s consequence string; W4 is `S3`'s policy engine over an
existing report; W5 generalises `T3`'s absence register from one tool to an ordered
plan. No new `entity`, `fix_class` or `candidates[].origin` member — all three
enums are documented **closed, adding a member is BREAKING**, and nothing here
needs one.

**Measured effect on the six canonical states.** Baseline verified by running the
spike compiler here (`S0-anon` 1, `S1-emp-home` 5, draft-clean 13, auditor 6;
draft-dirty is clean minus `submit_expense_report` = 12):

| State | now | +full (C) | +minimal (B: W1, W5) |
|---|---|---|---|
| S0-anon | 1 | 1 | 1 |
| S1-emp-home | 5 | 6 | 6 |
| S3-emp-draft-dirty | 12 | 17 | 14 |
| S2-emp-draft-clean | 13 | 18 | 15 |
| S4-emp-submitted | 6 | 7 | 7 |
| S5-aud | 6 | **7** (W4) | 6 |

`1 → 5 → 12 → 13` becomes `1 → 6 → 17 → 18` (C) or `1 → 6 → 14 → 15` (B). Write
tools in draft-clean go 7 → 9 (C) or 7 → 8 (B), computed as always from
`readOnlyHint !== true` and hard-coded nowhere. `S0-anon` is untouched, so the
published surface digest `sha256:630daf55…` and its
`230 + 33 + 17 = 280 / ceil(280/4) = 70` accounting survive unchanged.

---

## 4. Cost against the frozen plan

**Critical path**, recomputed from scratch by script over `graph.json` (longest
path by earliest finish, hard edges, horizon A). Baseline reproduces exactly:
`29.5 h — L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6`.

| Scenario | depth | path |
|---|---|---|
| baseline | 29.5 | published twelve nodes, published order |
| `T1 +1.0` only | **29.5** | unchanged |
| `T1 +5.0` | **29.5** | reroutes through T1, ties |
| `T1 +5.5` | 30.0 | grows hour for hour past that |
| `T1 +1.0, T2 +0.5` | 30.0 | unchanged order |
| `T1 +1.5, T2 +0.5, S4 +0.5` | 30.5 | unchanged order |
| ↳ *plus* a new 2.0 h node on `T2 → W → T5` | **30.5** | unchanged — the node is free |
| ↳ *same row* but `T2 → W → H3` | 32.5 | **W enters the path** |

The last two rows are **cumulative on the row above them**, not on baseline — read
standalone against baseline they measure 29.5 and 31.5. The `+2.0` node is free
either way; only its sink matters.

**Per-node isolation — the table above never contained these, which is how the
recommendation went wrong.** Each measured alone against baseline:

| Isolated change | depth | on path? |
|---|---|---|
| `S10 +0.5` | **30.0** | **YES** — path position 3 |
| `T2 +0.5` | **30.0** | **YES** — path position 7 |
| `S4 +0.5` | **30.0** | **YES** — path position 6 |
| `T1 +0.5 … +5.0` | 29.5 | no — 5.0 h of slack |
| `T3 +0.5` | 29.5 | no |
| `T6 +0.25` | 29.5 | no |

**`S10` and `T2` are both on the published path, so their costs add**: any option
touching both pays `+1.0`, not `+0.5`. This is what the scenario table missed — it
computed seven scenarios and never once included `S10`, in a section whose own cost
table marks `S10` **on path** two paragraphs below.

| Option, fully computed | depth | Δ |
|---|---|---|
| **B** = `T1 +1.0, T2 +0.5, T3 +0.5, S10 +0.5` | **30.5** | **+1.0** |
| **C** = B `+ T1 +1.0 more, S4 +0.5, T6 +0.25` | **31.0** | **+1.5** |

Neither reroutes: the path stays the published twelve nodes in the published order
in both. B at "30.0 h" was **wrong** and is corrected everywhere in this file.

Two operational facts: **`T1` has exactly 5.0 h of slack** — tool definitions
written there are free until the sixth hour — and **a workflow-tool node must never
take a hard edge into `H3`**; hang it off `T5`, or keep it inside `T1`/`T2`.

**Human budget.** `15.875 = 10.5 gated + 0.05 × 107.5` against 16.5 available,
spare **0.625**. Extra non-gated agent hours cost `0.05×`, so the ceiling is
**12.5 agent-hours** before D-17's spare is gone (`+3.0 → 0.475`; `+7.0 → 0.275`;
`+12.5 → 0.000`). **Hours on a human-gated node cost 1:1** — `D4` (video, 4.0 h,
Day 5) is gated, so a new beat eats 0.5 of the 0.625 directly. Replace a beat, do
not add one.

| Node | change | h |
|---|---|---|
| `T1` (I2, Day 1, cut 0) | workflow tool defs and their tests | +1.0 (B) / +2.0 (C) |
| `T2` (I2, Day 2, cut 0, **on path**) | flip numerals; revoke/restore new write tools | +0.5 |
| `S4` (I3, Day 2, cut 0, **on path**) | envelope over new write routes; W2's issued-candidate check | 0 (B) / +0.5 (C) |
| `S10` (L1, Day 1, cut 0, **on path**) | `tool-surface.contract.md` gains 2–5 names | +0.5, **only if decided pre-freeze** |
| `T3` (I2, Day 3, cut 2) | `S`-prefixed surface rules; W5 shares its machinery | +0.5 |
| `T6` (I2, Day 1, cut 0) | **C only** — its accept pins the auditor set to six literal names; W4 breaks it | +0.25 |
| `H3` (I1, Day 3, cut 0, **on path**) | `--assert-flips` numerals | 0 h, text only |
| `F0` (UX, Day 1, cut 0) | one storyboard beat swapped, not added | 0 h |

Generic and self-updating, no change: `T4`, `T5`, `E2` (set equality off the
generated export), `E5`, `F5`, `S5` (revoked set is computed).

**Re-freezing.** Three frozen files carry a literal that moves:
`contracts/tool-export.schema.json` (`x-requiredStates`, six counts, and
`x-elidedExample.totals.distinct_tool_count: 15`);
`contracts/eval-case.schema.json` (case id `cap-surface-flips-1-5-12-13` and
`"kind": "tool_count", "value": 13`, line 844);
`contracts/signature.schema.json` (the "SEVEN tools, not five" sentence — a
restatement of a value R-20 already says is computed). **Checked good news:** none
is `violation.schema.json`, so the falsification trigger *"edited more than twice
after its freeze commit"* is **not** armed by this proposal.

**Restatements to regenerate** — 17 lines across 8 files:

```
$ grep -rn -E "1 ?(->|→|,) ?5 ?(->|→|,) ?12 ?(->|→|,) ?13" \
    --exclude=PROPOSAL-workflow-tools.md erp/ | awk -F: '{print $1}' | sort | uniq -c
   2 erp/FACTS.md      3 erp/GRAPH.md     4 erp/PLAN.md       1 erp/RISK.md
   1 erp/charters/I2.md  1 erp/contracts/tool-export.schema.json
   4 erp/graph.json    1 erp/reviews/2026-08-28-executability.md
```

(`reviews/` is archive and stays as written.)

**Review conclusions put back in play.** The **35/35 byte-identity** between
PLAN.md's gate blocks and the node accepts breaks for `T2` and `H3` until PLAN's
table is regenerated. **Any path movement republishes an enumerated list** that
`graph.json` names itself: `capacity.graph_depth_hours`, `capacity.graph_depth_path`,
all five `reachable_thresholds` rows, `ladder_does_not_shorten_the_schedule`,
`capacity.verdict`, all four `cut_ladder` `critical_path_after` values, and the
falsification trigger quoting the depth.

**A previous revision said "B-lean (`T1 +1.0` only) moves none." That sentence
quietly redefined B into a sub-option that is not B.** Real B moves the path to
30.5 h and therefore **republishes every item on that list**. `T1 +1.0` alone is
free, but B is `T1 +1.0` *and* `T2 +0.5` *and* `T3 +0.5` *and* `S10 +0.5`, and two
of those four are on the path. The only genuinely path-free variant is B **minus
`T2` and `S10`** (`T1 +1.0, T3 +0.5`, measured 29.5) — which is B without the
numeral flip and without the contract-name edit, i.e. B that does not ship. Price
the republish list into the decision; do not price it out by renaming the option.
The republish itself is mechanical — `graph.json`'s own numbers regenerated by
script — but it is `L1` and `PM` work, not zero, **and §5 now prices it: `L1`
+0.5 h to regenerate the enumerated values and PLAN.md's gate blocks, `PM` +0.5 h
to adjudicate the three frozen-file edits, +1.0 agent-hour on top of every option
that moves the path.** It buys no depth (neither seat sits on the critical path)
and it lands Day 1–2, the window §6 risk 1 names as binding.
**`E10`'s mutation check** must be re-derived: a workflow tool is a new place for a
negative control to be vacuous. And note the archived sign-off is already one
revision behind — it verified 119 edges and a 29.0 h path against v2.2.x; the live
graph is 121 and 29.5 — so accepting this does not re-open its twenty defects.

---

## 5. Three options

**(A) Do nothing.** Keep atomic CRUD; answer the REST question in prose in `D5`'s
Devpost answers using BW-26's approved sentence. Cost **zero**: depth stays 29.5 h,
spare stays 0.625 h, no frozen file moves, no restatement drift. What you lose: the
answer stays a paragraph, and the surface a judge sees is exactly what "expose the
API" looks like.

**(B) Minimal — W1 + W5.** One write tool showing a whole procedure land in one
call with per-line `provide_missing_data` envelopes, and one read-only tool
printing the ordered remaining procedure. One on-camera beat: *ask the agent to
start the claim; it calls one tool; the page answers with the plan and the gaps.*
Cost `T1 +1.0`, `T2 +0.5`, `T3 +0.5`, `S10 +0.5` = +2.5 agent-hours **plus the
+1.0 republish (§4: `L1` +0.5, `PM` +0.5) = +3.5 agent-hours → +0.175 human-hours,
spare 0.625 → 0.450** (`10.5 + 0.05 × 111.0 = 16.05` against 16.5); depth
**30.5 h, +1.0 over baseline** — because `T2` and `S10` are both on the path and
both costs land, while the republish buys no depth at all. `T6` and the auditor
surface untouched. Same three frozen edits, plus the full republish list in §4.
Swap a video beat. **Seat-days:** `I2` goes 4.0 / 3.5 / 3.0 on Days 1–3, all under
the 6.0 h `seat_day_hours_cap`; `L1` Day 1 goes 5.0 → **5.5** — and **`L1`'s half
of the republish must be scheduled Day 2**, because on Day 1 it lands on top of
`S10 +0.5` and puts `L1` at exactly 6.0, the zero-slack seat-day this file rejects
`C` for. `PM`'s +0.5 is a third of `PM`'s entire horizon-A load of 1.5 h, so it is
visible in `PM`'s day wherever it lands.

**(C) Full set.** `T1 +2.0`, `T2 +0.5`, `S4 +0.5`, `T3 +0.5`, `T6 +0.25`,
`S10 +0.5` = +4.25 agent-hours **plus the same +1.0 republish = +5.25 agent-hours
→ +0.263 human-hours, spare 0.625 → 0.363** (`10.5 + 0.05 × 112.75 = 16.1375`);
depth **31.0 h, +1.5**. Adds `T6`'s auditor-set accept to the blast radius. W2 is the
strongest tool in the set and W4 the cleanest demonstration of kernel ②, but neither
is filmable in the ten seconds `D4` has. **And C spends two seat-days this file
previously checked only for `I2`: `I3` Day 2 goes 5.5 → 6.0, sitting *exactly* on
`seat_day_hours_cap` with zero slack — one estimate miss on `S4` and
`--check-schedule` fails — and `L1` Day 1 goes 5.0 → 5.5. `I2` Day 1 lands at 5.25
(`T1 +2.0` and `T6 +0.25` on a 3.0 h day).**

### Recommendation: B

**Still B — but for a materially weaker reason than this file has previously given,
and the weaker reason has to be stated first or the recommendation is dishonest.**

*What B buys, exactly.* On the surviving claim — credential topology — **B's gain
over A is zero** (§2). A backend MCP server ships the same five tools under the
same names with the same envelopes; the one thing that actually shows credential
topology, the absent second login, is already visible on the fifteen atomic tools.
B adds no claim, strengthens no claim, and makes no claim more demonstrable. **Its
entire gain is rhetorical: in a judged demo, a screen answers "why is this not just
a REST API?" better than a paragraph does.** That is the whole of it.

*What B costs, with the item §5 previously booked at zero.*
**+1.0 h of critical path** (29.5 → 30.5); **+3.5 agent-hours** — 2.5 for the tools
and **+1.0 for the §4 republish (`L1` +0.5, `PM` +0.5)**, which the ledger used to
omit; **+0.175 human-hours**, spare 0.625 → **0.450**; three frozen-file edits
inside `S10`'s `FREEZE.md` manifest; the full §4 republish list; and one **swapped**
`D4` beat — 0 h, but it displaces a beat, and the flip sequence is not the beat to
displace.

*Is a purely rhetorical gain worth that?* The arithmetic, re-run: +1.0 h is **3.4%**
growth in graph depth, and 30.5 h against **132 h of wall clock is 23.1%**, so it
comes out of **76.9% headroom** — the schedule has never been depth-bound, and the
cut ladder is not a depth instrument (all four `critical_path_after` values are 29.5
at every rank; they move to 30.5 as *restatements*, which is why they are on the
republish list). +3.5 agent-hours is **3.0%** of 118.0. The binding resource is
human hours under D-17, and B spends **28% of the 0.625 h spare**, keeping 0.450 —
no rank fires. **Verdict: yes, and narrowly.** What is being judged is a
180-second video and a Devpost answers box; there, presentation is the deliverable
and not packaging around it, so buying a better answer to the one question the
corpus has never answered is a real purchase — but it is a *presentation* purchase
bought with 3.4% of a resource that is 77% idle and 28% of the one that is not.
**Recommend B on that basis and no other.**

*Where that stops.* The estimate is 3.5 h written before anything was built, and
two of its four tool components sit on the path where growth is 1:1. If `T2` or
`S10` overruns by an hour the path is 31.5 and the ratio above is being computed
about a different number. **B is worth +1.0 h of path and 0.175 human-hours for a
rhetorical gain; it is not worth +3.0, and it is not worth the last of the spare.**
Book it with that ceiling stated.

**What would change it. To A — and this is now the primary flip, not a secondary
one** — if the concept-level census re-test (§6.4) shows workflow-shaped tools are
already common. Rhetoric is the *only* gain B has left; if the screen is
unremarkable there is no gain at all, the prose answer is free, and B is 3.5
agent-hours spent on nothing. **To A, immediately** — if this is not decided before
`S10` runs on Day 1; three deviation tickets, a re-freeze and PM adjudication on
Day 2 is not a price to pay for a presentation improvement. **To C** — if the
decision lands today *and* all three of C's seats hold, not just `I2`; but note C
is now the *weaker* case, because W2, W3 and W4 improve the repo for a reader who
is not who decides, and §5 already concedes W2 and W4 are unfilmable in `D4`'s ten
seconds — i.e. C buys almost none of the one thing B is being bought for, at
+5.25 agent-hours, spare 0.363, and `I3` Day 2 pinned to exactly the 6.0 h cap with
no absorber. **To void** — if `V1` reports ABSENT on Day 1, the graph re-roots on
DNS and none of this is the question.

---

## 6. Risks

1. **A scope change five days from a deadline**, on a plan five review rounds
   signed off as executable. The plan's own discipline makes this a PM deviation,
   not a good idea acted on directly. The one thing making B affordable is timing:
   decide before `S10`, or take A.

2. **BW-01/02/03 will try to come back through this door.** `tool surface is the
   boundary` is retracted — the surface is a *menu, not a lock*, and the page-side
   403 is the client talking to itself. A workflow tool is *more* tempting to
   describe as a boundary ("the agent can only run the whole procedure or none of
   it"), and that sentence is BW-01 in new clothes, false the same way: a workflow
   tool is not one authorization decision, it is N, and every one is `S2`'s
   per-request server-side check. Any workflow tool that skips a per-step check to
   be "atomic" is a regression, not a feature. `G4`'s lint catches the literal
   strings, not the proposition — and one paraphrase (BW-31) has already walked
   past it. **Make that two: this risk was written to catch the atomicity
   paraphrase, and §2's own withdrawn survivor-2 sentence — "cannot make an
   operation cease to exist" — walked straight past it in this very file, three
   sections above the guard.** The lint is not the control; reading for the
   proposition is. Write "stop being **offered**" (registration) whenever the
   sentence is about the surface, and "server-enforced" whenever it is about
   authorization.

3. **A wide input schema is a worse envelope target than a narrow one.** `S4`'s
   accept requires that *the same input produces a byte-identical envelope on two
   runs*, and each extra input dimension is another way to fail it. `W1` with 12
   receipt ids yields up to 12 findings from one call while
   `violation.schema.json` carries a single `field` per record — so W1 must return
   an **array** with a per-item `entity_id` in a deterministic order, or the
   envelope claim degrades on the very tool meant to showcase it. A tool that
   cannot be specified as `additionalProperties: false` with closed enums and
   `maxItems` on every array does not ship. Narrow inputs are also published
   OpenAI/Chrome guidance (BW-08): we follow it, we do not claim it.

4. **Novelty must not be asserted before a concept-level re-test.** 46% of 529
   repos already ship a dynamic tool surface (MEASURED) — from a **keyword-based**
   census, and `FACTS.md` §8 records that keyword-derived empty cells have been
   wrong in this project **three times**: an empty cell found by keyword search is
   a vocabulary artefact, not a conceptual gap. "Workflow-shaped tools" has never
   been census-tested at all; the 0-hit grep in §1 measures *our* corpus, not the
   field. **Before any sentence claiming this is uncommon is written anywhere, run
   a concept-level re-test with three vocabulary variants and record it here.**
   Until then, describe what ours does and claim nothing about others
   (BW-05/06/07/31/32).

5. **The demo is the constraint, not the repo.** `D4` is 4.0 **human-gated** hours
   on Day 5, under 180 seconds, mechanism in the first 10. A new beat costs 1:1
   against a 0.625 h spare and competes with the flip sequence that is already
   kernel ①'s only on-screen proof. B is scoped to *one* beat, swapped in.

6. **The quarantine is permanent.** Nothing derived from the supplied prompt — a
   paraphrase of its procedure, a benchmark arm built against it, or a "we compared
   against a production prompt" sentence — reaches `docs/DEVPOST.md`,
   `docs/VIDEO-SCRIPT.md`, the README or the video. Laundering a poison source's
   *result* is the same offence as citing it (`FACTS.md` §8). The tools above are
   specified from the countinghouse spike surface and the frozen contracts; they
   need nothing from that prompt and take nothing.
