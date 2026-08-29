All commands from both files executed. Findings below.

---

# DEFECT TABLE — most severe first

## RUNBOOK.md

**R1. Nothing in the RUNBOOK ever dispatches the five Day-1 building seats, and §6 forbids the reader from doing it.** §2 boots `I2 I3 I4 QA UX` on Day 1 morning with **no positional prompt**, then says their "first task arrives by `claude attach` at the checkpoint that needs them (PM and L1 at §7's T1/T2, L2 only on a day you need an opinion)" — a parenthetical that names three seats, none of them these five. §6 bullet 1 forbids the user from ever attaching to them. §3 asserts they are "building against contracts L1 dispatched", but L1's only Day-0 prompt says *"Your only job today is node L0"*, and L1's only Day-1 prompt (T2, 14:00) asks *"What is actually merged right now"* — neither dispatches anything. MEASURED: a `--bg` seat booted with no positional prompt reports `status:"idle" state:"done"` and does nothing until attached. Following §2 and §3 literally, Day 1's fourteen non-human-gated nodes have no origin. This alone makes Day 1 produce nothing.

**R2. Nothing ever starts W, and §5 tells the reader to wait for output W cannot produce.** §1 calls W "the only liveness detector"; §2 boots it with no positional prompt; `charters/W.md:83` says *"Poll every 30 minutes"* and lines 92-95 say *"you cannot open a terminal window."* An idle backgrounded seat has no timer. §5's first escalation row instructs: *"Nothing, for 90 minutes… It reports `STALLED: I3 (117 min, holds S4)`. **Wait for that line; do not go looking.**"* The reader is directed to do nothing while waiting on a report from a seat that was never started and cannot start itself.

**R3. §3's "what green looks like" READY block is not a possible output of the procedure it illustrates.** §3 defines the ready set as *"nodes whose inbound nodes are all done"*, then prints `READY: G0 G4 G1 G3 T6 S10 S11 S1 T1 F0 G5 G6 H1 H2 V0 V1` and says **"That is what green looks like"**. That list is verbatim `capacity.schedule_A.days["1"]`, not a ready set. Recomputed over horizon-A hard edges with `{L0, V5}` done, the true ready set is **`G0 G1 G4 V0 V1 H1 H5 T6 S11`** — nine nodes. Eight of the sixteen printed have unmet hard predecessors (`G3`←G1,T6 · `S10`←T6 · `S1`←S10 · `T1`←S10,T6 · `F0`←G4 · `G5`←G0 · `G6`←S10,S11 · `H2`←H1), and `H5`, which *is* ready, is omitted. The reader's one worked example of the daily gate cannot occur, and §3 tells them to check it "by eye in ten seconds" against a sample that is wrong by seven names.

**R4. `G1` still cannot go green by following §3 — the flip action is absent and one of its two declared outputs is never mentioned.** The `tr`/`tee` repair landed: §3 now quotes `G1.accept` verbatim and its analysis reproduces exactly (MEASURED both repos: raw `private MIT`, through the accept's `tr` `private mit`). But `G1.outputs` is `["evidence/G1-about-box.png", "evidence/G1-visibility.txt"]` and §3 names only the second — the About-box screenshot appears nowhere in the file. And §3 gives only the *verification* predicate; the flip itself (`gh repo edit … --visibility public`) is never printed, so the reader must invent the command for the one gate §6 says must never be improvised.

**R5. There is no Day-0 branch for "L0 is not green", and the escalation target cannot exist yet.** `graph.json.falsification[0]` is *"L0 is not green by the end of Day 0 → Nothing else can start… the single hardest stop in the graph."* §2 boots PM and W only *"once `L0` is green and `.team/charters` exists"* — and both boot lines read `.team/charters/PM.md`, an `L0` output. §5's gate-failure row routes to *"**L1** if the predicate failed; **PM** if the predicate is wrong"*. On Day 0, PM is unbootable by construction, so half of the only triage rule points at a seat that cannot be created.

**R6. §0's most emphatic claim is contradicted by measurement.** §0: *"A seat that cannot authenticate boots successfully and reports `idle` — **the same word a seat that is thinking reports**"*, and *"looks exactly like a seat that is thinking, in the roster, at every poll W makes."* MEASURED just now on this machine, polling the RUNBOOK's own roster command while a seat worked:

```
{"name":"ERP-RECHECK2","status":"busy","state":"working"}   ← thinking
{"name":"ERP-RECHECK","status":"idle","state":"done"}       ← not thinking
```

A thinking seat reports **`busy`**, and the RUNBOOK's own jq (`.status // .state // .kind`) prints it. The real ambiguity is narrower — `idle` cannot separate dead-auth from *booted-and-waiting* or *finished* — which is a genuine problem, but not the one stated. The daily auth check survives; its stated evidential basis does not, and the reader is steered away from the free discriminator sitting in the JSON they already parse.

**R7. §6's inbound-topology "machine check" is self-reported by the party it audits and cannot fire — two bullets after §6 deletes the `%cn` check for exactly that pathology.** §6 bullet 1: *"There is a machine check… `ls .team/log/inbound-*.jsonl` is broken in both shells"* (MEASURED: `bash` rc 1, `zsh` `no matches found`, both correct) and supplies a working `find` replacement (MEASURED: exit 0, silent, all three shells). But `TEAM.md:222` defines the mechanism as *"every inbound human message is **logged by its recipient seat**"*, and only `charters/PM.md:30`, `L1.md:48` and `L2.md:23` declare such a path. A building seat that receives a direct human message has no inbound log to write and every reason not to invent one, so the check returns silence whether or not the rule was broken. §6 bullet 3 deletes the `%cn` check in full prose because it *"passes on the violation it exists to detect"*; this one has identical structure and is kept.

**R8. `claude logs <id> | sed …` does not produce readable output, and §2 and §5 send the reader there to read.** MEASURED on a live seat: after the strip, `wc -l` is **0** — the transcript uses cursor-positioning escapes rather than newlines, so the result is one unbroken run with word boundaries destroyed (`TackleyourtoughestworkwithOpus5`). §0's narrow use — `| grep -o -i 'login expired\|not logged in'` — is sound. But §2 (*"read `claude logs <id>` through the ANSI strip"*) and §5 (*"`claude logs <id>` (through §0's ANSI strip) **shows a dead tail**"*) promise general readability the command does not deliver; there is no tail, there are no lines.

**R9. §2 miscounts its own boot lines.** *"The **seven** seats booted with no positional prompt come up idle and wait."* There are **eight**: `PM W I2 I3 I4 QA UX L2`. (Ten `claude --bg -n` lines total; `L1` and `I1` carry prompts.)

**R10. Two of §8's seven line citations drift, in a table whose whole purpose is to hand the graph owner exact locations.** §8 says *"All six were re-checked today."* MEASURED: `TEAM.md:346` for "eight fields" → the string is at **`TEAM.md:348`**. `TEAM.md:189` for "165–275" → **`TEAM.md:188`**. The other five are exact (`charters/W.md:57`, `TEAM.md:186`, `TEAM.md:203–206`, `TEAM.md:614`, `charters/PM.md:132`), and every claim *about* them is correct.

**R11. §3's framing sentence is not true on the axes it cites.** *"Day 1 is the heaviest day in the sprint: **16 nodes, seven seats**, and 2.5 human-gated hours."* Computed from `schedule_A` × owners: Day 3 also carries **16 nodes**, with **nine** seats and **29.0** agent-hours against Day 1's 24.0. Day 1 is the heaviest *for the human* (2.5 gated hours vs 0), which is the operative point and is the third item; the first two are not maxima.

**R12. §3 "Total spend: three prompts, one decision, and your two gated hours."** It is **2.5** (`G1` 0.5 + `V1` 2.0), stated correctly three paragraphs above and in §7.

### RUNBOOK — verified as repaired, by execution

Every prior-audit item I could re-test on this file now holds. `claude auth status` → `loggedIn: true` and `claude -p "say ok"` → `ok` (the §0 two-timestamp story is consistent with a restored session). The four bare-flag error strings reproduce **verbatim**, and `--totally-not-a-flag` is rejected. §0's `--help` premise is **correct and the prior audit's defect 14 was wrong**: `--append-system-prompt[-file]` appears exactly once, in the `--bare` entry's prose (line 48), not in the `--append-system-prompt` entry (line 25, which carries no `[-file]`). Subcommand list matches exactly; there is no `send` and no `message`; `claude auth` takes exactly `login|logout|status|help`; `claude attach --help` reproduces word-for-word; the `--bg`/`--print` refusal reproduces word-for-word; `agents --all` is documented as including completed sessions. Correction 1 reproduces in full (published form: false `OPEN` under `sh`/`bash`, `no matches found` rc 1 under `zsh`; replacement: exit 0 silent when absent, correct `OPEN` when populated, all three shells). The codex three-way table reproduces exactly — flat `low`, `[profiles.*]` `ultra`, missing `ultra`, **all three exit 0** — and `ls ~/.codex/*.config.toml` reports no matches. The D-17 row printed in §2, written into a scratch `erp/DECISIONS.md` beside this `graph.json`, makes `L0` gate (1)'s `node -e` **exit 0**. `git config user.name` = `Caleb0796` with no local override; `git log main --format='%cn'` = `Caleb0796` — §6's deletion of the `%cn` check is honest and correct. Example B's ownership split is exact (`PATHS.md:248`: `FREEZE.md` writer **L1**, producer **S10**). Example D is now correctly anchored (`F2` outputs are `src/page/ui/editor.js` and `tests/acceptance/editor.test.mjs`; its accept asserts attributes only and never asserts rendering; UX Day 4 = F2 3.5 + F6 2.5 = **6.0** = `seat_day_hours_cap`). Example A's `src/page/tools/compile.js` is a real `T1` output owned by I2 (`PATHS.md:130`). Nine fields, not eight. §1's day→seat→node table is exact on all seven rows (2/16/13/16/9/4/2, new seats per day). Every capacity figure checks: 29.5, 16.5, 15.875, 0.625, 10.5, 0.05×107.5, D4 on Day 5 and D5+D6 on Day 6 at 4.0 each, all five human-gated nodes cut 0. `contingencies[0]`, `ownership_rule`, `non_node_seats`, the ladder's four `critical_path_after` = 29.5, W's 30/90, `K2→K1→W→C2` (TEAM.md:584), the one-third / under-10% adopt rule (TEAM.md:396) — all correct. §7's recomputed channel columns (18–30 / 8–13 / 3–5 / 2–3) are right. `V5`'s and `V1`'s boot/execution details match their accepts field for field.

---

## PROPOSAL-workflow-tools.md

**P1. With survivor 2 conceded, the recommendation's stated gain is not delivered by the tools B ships — and the two sentences that justify it quietly reinstate the withdrawn claim.** §2 lands the concession cleanly and correctly. But its summary reads: *"they turn BW-26's approved sentence into a surface a judge **can watch change**"*, and §5 repeats it: *"BW-26's approved sentence becomes something a judge **watches happen**."* The *changing of the surface* is dynamic registration — precisely the property §2 withdrew three paragraphs earlier on the grounds that `notifications/tools/list_changed` makes it a first-class backend-MCP feature. The demonstrability being sold is survivor 2's, under survivor 1's name.

Test it against what B actually ships. `W1 draft_report_from_receipts` and `W5 explain_next_step` put on screen: one call performing a multi-step procedure, and an ordered plan of what remains. §2 itself concedes *"A backend MCP server can expose exactly these five tools, same names, same envelopes."* So the beat does not discriminate between the two implementations. What *would* show credential topology is the absence of a second login/consent step — and that is equally visible on the existing fifteen atomic tools, so workflow shape adds nothing to it. **B's gain over A on the surviving claim is zero; its gain is rhetorical (a screen reads better than a paragraph in a judged demo), which is real but is not what §5 says it is buying.**

**P2. §4 identifies a cost as non-zero and §5's ledger books it at zero.** §4: *"The republish itself is mechanical… but it is `L1` and `PM` work, **not zero**"* — covering `capacity.graph_depth_hours`, `graph_depth_path`, all five `reachable_thresholds` rows, `ladder_does_not_shorten_the_schedule`, `capacity.verdict`, all four `cut_ladder.critical_path_after` values, the falsification trigger quoting the depth (verified: `falsification[8]` reads "The 29.5-hour path cannot land…"), plus PLAN.md's 35/35 byte-identity for `T2` and `H3` and 17 restatement lines across 8 files. §5's cost paragraph enumerates *"+1.0 h of critical path, +0.125 human hours, three frozen-file edits, the full §4 republish list, and one swapped video beat"* — then the arithmetic that justifies it (`spare 0.625 → 0.500`) charges only the `+2.5` agent-hours. PM is the 60% channel and the work lands Day 1–2, the exact window §6 risk 1 calls the binding timing constraint. The one cost the paper flags as unmodelled is the one it then omits from the model.

**P3. The corpus line counts no longer reproduce, and the parenthetical retracting the old figure is itself false.** MEASURED now: `erp/*.md` excluding the proposal = **10,415** (published: 10,119); adding `graph.json` and the eight contracts = **16,508** (published: 16,212). Both are stale by exactly **296** — `RUNBOOK.md` grew 481 → 777 lines in the repair pass four minutes after the proposal was re-measured. This is the recurrence of the class §1's own preamble commits to preventing (*"A document that presents commands as 'run just now' has to stay re-runnable by the reader"*). Separately, *"(The previously published '9,638' reproduces nothing and is withdrawn)"* is wrong: **10,415 − 777 = 9,638 exactly** — 9,638 is the same corpus measured before `RUNBOOK.md` existed. The proposal inherited the prior audit's incorrect finding and published a replacement with the same shelf-life problem. The substantive claim (zero hits) is unaffected, as the file says.

### PROPOSAL — verified by independent recomputation

I rebuilt the longest hard-edge horizon-A path from `graph.json` from scratch (62 horizon-A nodes, 102 hard edges within A; 110 hard / 11 soft overall; v2.3.0, 68 nodes, 121 edges — all as stated).

**Baseline reproduces exactly: `29.5 — L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6`.**

**B = 30.5 CONFIRMED. C = 31.0 CONFIRMED.** Neither reroutes; both keep the published twelve nodes in the published order.

| Row | Published | Recomputed |
|---|---|---|
| `T1 +1.0` only | 29.5 | **29.5** |
| `T1 +5.0` (reroutes through T1, ties) | 29.5 | **29.5**, reroutes `…S10 → T1 → T2…` |
| `T1 +5.5` | 30.0 | **30.0** |
| `T1 +1.0, T2 +0.5` | 30.0 | **30.0** |
| `T1 +1.5, T2 +0.5, S4 +0.5` | 30.5 | **30.5** |
| ↳ cumulative + 2.0 h node `T2→W→T5` | 30.5 | **30.5** |
| ↳ same row, `T2→W→H3` | 32.5 | **32.5**, W enters the path |
| standalone-vs-baseline readings of the last two | 29.5 / 31.5 | **29.5 / 31.5** |
| `S10 +0.5` isolated | 30.0 on path | **30.0**, path position 3 |
| `T2 +0.5` isolated | 30.0 on path | **30.0**, path position 7 |
| `S4 +0.5` isolated | 30.0 on path | **30.0**, path position 6 |
| `T3 +0.5`, `T6 +0.25` isolated | 29.5 free | **29.5** |
| `T1` slack | exactly 5.0 | swept +0.5→+6.0: flat 29.5 through **+5.0**, 30.0 at +5.5 |
| B minus `T2` and `S10` | 29.5 | **29.5** |

Every human-hour figure is exact: `15.875 = 10.5 + 0.05×107.5` against 16.5, spare **0.625**; ceiling **12.5** agent-hours (`+3.0→0.475`, `+7.0→0.275`, `+12.5→0.000`); B `+2.5 → +0.125 →` spare **0.500**; C `+4.25 → +0.213 →` spare **0.412**. `30.5/132 = 23.1%`, `1.0/29.5 = 3.4%`. All four `cut_ladder.critical_path_after` values are 29.5 — the ladder-is-not-a-depth-instrument argument holds.

Seat-days recomputed from `schedule_A` × owners × hours (human-gated excluded per `seat_day_hours_cap_note`): baseline `I2` = **3.0 / 3.0 / 2.5** on Days 1–3, `I3` Day 2 = **5.5**, `L1` Day 1 = **5.0**, cap 6.0. So B's `I2` 4.0/3.5/3.0 and `L1` 5.5, and C's `I3` Day 2 → **exactly 6.0**, `L1` → 5.5, `I2` Day 1 → 5.25 — all confirmed, including the zero-slack warning C's paragraph now carries.

Every citation checks: `S10.accept` does end in `sha256sum -c erp/contracts/FREEZE.md` and its own text says *"the EIGHT pre-existing contract files plus erp/contracts/probe-verdict.schema.json… NINE at freeze time"*; `interface_freezes` gives `S10` **`violation.schema.json` only**, with the other four on `S1`, `T5`, `E4`, `F0` — the §-preamble's correction of defect 22 is exact. `eval-case.schema.json` `"value": 13` is on **line 844**; `signature.schema.json` carries "SEVEN tools, not five" (line 784); `tool-export.schema.json` has `x-requiredStates` and `x-elidedExample.totals.distinct_tool_count: 15`; `violation.schema.json` is correctly **not** among them, so the "edited more than twice" trigger stays disarmed. `T6.accept` pins exactly six literal auditor names, so W4 does break it. Surface counts 1/5/13/12/6/6 match `FACTS.md:565-571`; 15 distinct tools; draft-clean write tools = 13 − 6 readOnly = **7**, so 7→8 (B) / 7→9 (C) is right; `230+33+17=280`, `ceil(280/4)=70`, digest `630daf55…` all present in `CONTRACTS.md:414-415` and `tool-export.schema.json:176`. The signoff really is one revision behind (119 edges, 29.0 h, v2.2.x). All four §1 commands reproduce **exactly as printed** (`exit=1`; `0`; the single `FACTS.md:858` hit; countinghouse `15`), and the `zsh` unquoted-`$X` caveat is correct — MEASURED, `zsh` returns exit 0 with the excludes inert while `bash` returns 1. §4's restatement grep reproduces exactly: **17 lines, 8 files, 2/3/4/1/1/1/4/1.**

**Banned-wording lint (task item 4).** I regenerated the list with RISK.md's own generator (`sed -n 's/^| BW-[0-9][0-9] | \`\([^\`]*\)\`.*/\1/p'` → 32 patterns) and ran all 32 plus the six banned legacy identifiers over both files. **Two hits, both legitimate quote-to-forbid**: `RUNBOOK.md:471` (`tool surface is the boundary`, inside Example A where the Layer-0 hook catches it) and `PROPOSAL:52` (`impossible without WebMCP`, inside the BW-26 retraction quote). `G4.accept` excludes `erp/**`, so neither is a live lint failure, and the proposal's claim to that effect is accurate. **No node id, hour, day or path drift found in either file beyond R10, R11 and R12.**

---

# FIRST-TIMER STOP COUNT: **10** (was 12)

Walking Day 0 and Day 1 from RUNBOOK.md alone, counting every point where a reader must stop and ask — guessing counts:

**Day 0** — (1) no Day-0 cadence at all: after booting L1 and I1 there is no instruction on when to check back on a 3.5 h node, and §7's loop presupposes a PM that does not exist yet. (2) No branch for "L0 not green at end of Day 0", and §5's gate-failure triage routes half of itself to PM, which is unbootable until L0 lands. (3) Nothing starts W's 30-minute poll, yet §5 says to wait for its output [R2]. (4) Reading a seat's reply without staying attached: the offered `claude logs | sed` is measurably unreadable [R8].

**Day 1** — (5) nothing dispatches I2/I3/I4/QA/UX, and §6 forbids the reader from doing it [R1]. (6) `G1`'s flip command is never printed [R4]. (7) `G1`'s `evidence/G1-about-box.png` is never mentioned, so the node cannot go green [R4]. (8) `V1`: which origin to open (it comes from `evidence/V5-origin.txt`, never said) and how `document.modelContext` is observed in a browser with no devtools. (9) §3's sample `READY` block cannot occur — when PM returns nine names against the printed sixteen, which is right? [R3]. (10) §6's inbound-topology check returns silence whether or not the rule was broken, and the reader is told it is their machine check [R7].

Eight of the prior twelve are genuinely closed (auth + remedy, the missing send verb, interactive-vs-`--bg`, Day-0 kickoff prompts, D-17's recorder and row format, `V1`'s two files and five fields, `--effort`'s values, `idle`-vs-dead as an operating instruction). Four survive in altered form (3, 4, 6, 7 above) and four are new (1, 2, 5, 9) — three of the four new ones are gaps that only became visible once the sending mechanism was specified.

---

# Item 5 — is what remains sufficient?

**No.**

The concession itself is correct and well made: `notifications/tools/list_changed` is real, an expense backend *is* the system of record for report state and policy version, and survivor 2 does collapse into survivor 1. But what remains — *"one survivor, already ours: credential topology; workflow tools make the existing claim demonstrable"* — is not sufficient as the paper deploys it, for two independent reasons.

First, **B does not demonstrate survivor 1.** `W1` and `W5` show a multi-step procedure in one call and an ordered remaining plan; the file concedes a backend MCP server can expose those same five tools with the same names and envelopes, so the beat does not discriminate. The only visible signature of credential topology is the *absence* of a second auth step, and that is already visible on the fifteen atomic tools — workflow shape adds nothing to it. Meanwhile the two sentences that carry the recommendation ("a surface a judge can watch **change**", "something a judge **watches happen**") describe dynamic registration, which is the property just withdrawn. The concession is made in §2 and undone in §2's own summary and again in §5.

Second, **the ledger omits the cost §4 itself flags.** The republish of `graph.json`'s enumerated capacity block, PLAN.md's `T2`/`H3` gate blocks and 17 restatement lines is "`L1` and `PM` work, not zero" in §4 and zero in §5's arithmetic — landing on the 60% channel during Day 1–2, the window §6 risk 1 names as the binding timing constraint.

What survives intact is a narrower and honest case: *a screen answers "why not REST?" better than a paragraph does in a judged demo, at +1.0 h of a 132 h wall clock and +0.125 of 0.625 spare human hours.* That is a presentation argument, not a claims argument, and it is very likely still enough to pick B over A — but it is not the argument the paper makes, and B should not be accepted on the reasoning as written.

---

# VERDICTS

**RUNBOOK.md — NOT USABLE.** The repair pass is substantial and largely successful: everything it re-measured reproduced on this machine, including the codex fallback table, all four corrections, the flag probes, the `%cn` deletion, and the D-17 row that MEASURED exits 0 against `L0` gate (1). Its factual accuracy against `graph.json` and `PATHS.md` is now near-total. But the manual's operating loop still has a hole where the work goes in: no seat ever dispatches the five Day-1 builders, nothing starts the sole liveness detector, there is no Day-0 clock and no Day-0 failure branch, and the single worked example of the daily gate prints a ready set the graph cannot produce. A first-timer following it books ten seats and gets no nodes. Close the dispatch path (R1), give W a run loop or delete it from §1/§5 (R2), regenerate §3's sample block from the real ready set (R3), and add G1's flip plus its screenshot (R4), and it becomes usable.

**PROPOSAL-workflow-tools.md — NOT SOUND.** The numbers are now right and I confirm them independently: **B = 30.5, C = 31.0**, baseline 29.5 over the published twelve nodes in the published order, every scenario row, every isolation, every human-hour figure and every frozen-file citation reproducing to the decimal and the line number. The prior audit's numeric findings are fully repaired and its argumentative one is honestly conceded. What is left unsound is downstream of that concession: the recommendation is justified by a demonstrability the recommended option does not deliver, in sentences that reinstate the withdrawn survivor 2, and its cost ledger drops the one item its own §4 calls non-zero. Fix the gain statement to what W1 and W5 actually put on screen, price the republish, and B is probably still the right call — but the case has to be made on the demonstration's rhetorical value in a judged demo, not on a claim the file has already given up.