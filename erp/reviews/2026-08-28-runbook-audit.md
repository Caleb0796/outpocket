All commands executed. Here is what ran and what broke.

---

# DEFECT LIST — most severe first

## RUNBOOK.md

**1. §3's `G1` command is a hand-written substitute for the accept predicate, and its stated output is wrong.** Highest severity: it is the first gate the user personally runs, and following the RUNBOOK leaves `G1` un-acceptable.

RUNBOOK §3: `gh api repos/$REPO -q '.visibility + " " + .license.spdx_id'` must print `public mit`.
`graph.json` `G1.accept`: `gh api repos/$REPO -q '.visibility + " " + .license.spdx_id' | tr 'A-Z' 'a-z' | tee -a evidence/G1-visibility.txt` outputs exactly `public mit`.

MEASURED just now, both repos:
```
Caleb0796/outpocket: private MIT
Caleb0796/webmcp-eval-kit: private MIT
```
Uppercase `MIT`. Without the dropped `| tr`, the command never prints `public mit` — not before the flip, not after. The dropped `| tee -a evidence/G1-visibility.txt` means a user who does exactly what §3 says produces **no evidence file at all**. This is §6 bullet 4 ("Never run a substitute for a command that already exists in a node's `accept`") violated by the RUNBOOK itself, three sections earlier than the rule.
**Fix:** delete the paraphrase; quote `G1.accept` verbatim, pipeline included. Also correct §3's "Run today, both repos return `private mit`" to `private MIT` (raw) / `private mit` (through the accept's `tr`).

**2. The daily loop has no verb. There is no way to send a prompt to a seat, and the RUNBOOK never prints one.** §3 and §7 route four templates a day to `PM`, `L1`, `L2` by name. MEASURED — `claude --help` subcommands are `agents, attach, auth, auto-mode, doctor, gateway, import, install, logs, mcp, plugin, project, respawn, rm, setup-token, stop, ultrareview, update`. **There is no `send` and no `message`.** A `--bg` seat booted per §2 prints `(idle — send a prompt to start)` and the only route in is `claude attach <id>`, which appears nowhere in §3 or §7.
**Fix:** §7 step 3 must read `claude attach <id>` (or the interactive-window equivalent), and §2 must say which of the two operating models the reader is in — see defect 12.

**3. Authentication is expired on this machine right now, and the RUNBOOK gives no remedy.** MEASURED: `claude -p "say ok" --model sonnet` → `Failed to authenticate: OAuth session expired and could not be refreshed`, exit **1**. My `--bg` boot test (`claude --bg -n ERP-CHECK-BOOT --model sonnet --effort low --append-system-prompt-file erp/charters/W.md "…"`) started, registered, and its log ended `Login expired · Please run /login` / `Not logged in · Run /login`. Meanwhile the §2 roster verifier printed:
```
ERP-CHECK-BOOT	idle
```
§0 correctly warns "a seat that cannot authenticate looks exactly like a seat that is thinking," then never says how to fix it and treats it as hypothetical. It is the current state.
**Fix:** promote to a Day-0 step-zero: run `claude auth` / `/login` **before** booting L1, and state the remedy command. Secondary: `claude logs <id>` returns raw ANSI escape sequences (I have the dump — it is unreadable as printed). §0 says "read `claude logs <id>`". Give the sed strip or `claude logs <id> | grep -i login`.

**4. §6's git-authorship check is both unsatisfiable and undetective, and the RUNBOOK carries both halves of the contradiction.** §6: "`git log main --format='%cn' | sort -u` must show only **L1**." §3: "prints one name, `Caleb0796`. It must still print one name on Day 6." MEASURED: `git config user.name` = `Caleb0796`, globally; no per-seat git identity is configured or planned anywhere in the corpus (`grep -rni "user.name\|GIT_AUTHOR" erp/TEAM.md erp/charters/L1.md erp/PATHS.md` → nothing). So the command prints `Caleb0796` for L1's pushes and for a hand-push identically. It will **never** print `L1`, and it cannot detect the violation it exists to detect — RISK.md's own "a check that passes on the violation" pathology. This should have been RUNBOOK correction 5.
**Fix:** either configure per-seat `user.name` in L0 (then `%cn` works and §3's `Caleb0796` line is wrong), or drop the `%cn` check and say plainly that hand-push is unenforced by machine.

**5. §6 reproduces the exact glob bug §0 correction 1 fixes.** `ls .team/log/inbound-*.jsonl` — MEASURED with no matching files:
```
bash: ls: .team/log/inbound-*.jsonl: No such file or directory   rc=1
zsh : zsh:1: no matches found: .team/log/inbound-*.jsonl          rc=1
```
It fails in **both** shells, and on Day 0/1 there are no inbound logs. The RUNBOOK fixed this class of bug in one place and published it uncorrected in another, in the same file, as a "machine check."
**Fix:** `ls .team/log 2>/dev/null | grep -E '^inbound-.+\.jsonl$'`, or `find .team/log -name 'inbound-*.jsonl' 2>/dev/null`. (Same defect exists upstream at `charters/W.md:57`.)

**6. Deviation Example D is fabricated at both the path and the fact level.** It cites `tests/acceptance/storyboard.test.mjs` and `src/page/storyboard/*.js`. Neither resolves — `grep -c` in `PATHS.md` returns **0** for both. `F2`'s actual outputs are `src/page/ui/editor.js` and `tests/acceptance/editor.test.mjs`. Worse, the example's premise ("the contract text says the panel renders both personas… F2 ships chen only… the auditor path is described in the video, not shown") is wrong: per `EVAL.md:497-503` and `GRAPH.md:369`, `chen` is the **employee** and `ruiz` the **auditor** — two roles, not two storyboard variants — and `F2` is titled *"Report editor with per-field provenance and an agent-proposed vs human-edited diff"*. An auditor does not edit reports. The invented clause contradicts the node it illustrates, which is the failure mode the task names.
**Fix:** re-anchor on a real `F2` deliverable — e.g. the agent-proposed-vs-human-edited diff shipping without per-field provenance — against `src/page/ui/editor.js` / `tests/acceptance/editor.test.mjs`. The *economics* of the verdict happen to be sound and are worth keeping: UX Day 4 is exactly 6.0 h (F2 3.5 + F6 2.5), at `seat_day_hours_cap`. Say that instead.

**7. Example B has PM writing a file PM does not own.** VERDICT_NOTE: *"I have updated graph.json S10's notes and re-run sha256sum to regenerate FREEZE.md."* `PATHS.md:248` — `erp/contracts/FREEZE.md` | writer **L1** | producer **S10**. `TEAM.md`'s adopt rule scopes PM to *"`erp/graph.json`, and `erp/PATHS.md` if a path moved."* This is precisely what `check-ownership.mjs` blocks, modelled as correct behaviour in the manual's flagship adopt example.
**Fix:** PM edits `graph.json` S10's notes and *directs L1* to re-run the freeze; L1 regenerates `FREEZE.md` at the next merge.

**8. §3 restates the 2.5 h/day error that §0 correction 2 exists to retract.** §3: *"2.5 human-gated hours (`G1` 0.5 + `V1` 2.0) — **exactly your whole daily budget**."* D-17 is ruled at **3.0 h/day** (`capacity.human_hours_assumption`), which §0 correction 2 and §6 both state correctly. The Day-1 gated load is 2.5 of 3.0, leaving 0.5 h — which is the whole slack for three prompts and one decision.
**Fix:** "2.5 of your 3.0 h day, leaving 0.5 h for steering."

**9. §4's "eight fields in a fixed order" is a nine-field format, and the RUNBOOK's own examples print nine.** `TEAM.md:346` says "Exactly these eight fields" and then lists `ID, OPENED, SEAT, NODE, CATEGORY, CLAIM, EVIDENCE, VERDICT, VERDICT_NOTE` — nine. RUNBOOK §4 restates the "eight" without catching it, and Examples B/C/D each print nine keys. A restatement that propagates the authority's off-by-one is a missed correction 5 in a file whose stated job is exactly that.
**Fix:** "nine fields", in both places.

**10. Who records D-17 is contradicted between §2 and `graph.json`, and the row format is never printed.** §2: *"Gate (1) is D-17 recorded in `erp/DECISIONS.md` … L1 writes the row."* §1 boots PM only *"at the end of Day 0, once `L0` is green."* But `L0.accept` gate (1) is titled **"PM RULING D-17, BEFORE ANY SEAT IS DISPATCHED"** and `capacity.human_budget_sensitivity.the_decision` says *"PM's Day-0 job is to RECORD this in erp/DECISIONS.md."* Under the RUNBOOK, PM is not alive when its own Day-0 job is due. And the gate's regex is `^\|\s*D-17\s*\|[^\n]*human_hours_per_day\s*=\s*([0-9.]+)` — the RUNBOOK never prints the row that satisfies it.
**Fix:** either boot PM first on Day 0, or state the ruling as already-made and print the literal table row L1 must write.

**11. `V1` is under-specified for the person who has to do it.** §3 says only *"you drive it by hand and QA re-reads your screenshot against `evidence/V1.json`."* `V1.accept` requires an ajv gate **first** over `evidence/V1.json` against `erp/contracts/probe-verdict.schema.json` (fields `{origin, chatgptModel:'Sol'|'Terra', modelContextPresent, toolCount, observedAt}`), **plus** `test -s evidence/V1.png`, and states *"the human read is the second gate, never the only one."* The RUNBOOK never says the user authors those two files, never names the five fields, never mentions the PNG, and never mentions that `probe-verdict.schema.json` arrives from `V5` on Day 0.
**Fix:** print the five fields and both filenames in §3, and note the schema is a Day-0 `V5` output.

**12. §2 gives no Day-0 prompt and no ruling on interactive vs `--bg`.** The boot lines carry a charter and no task. The first prompt template in the file is §3's T1, at 08:30 on **Day 1**. So the reader boots L1 and I1 and is left at a blank prompt on the day the critical path starts. Separately, §2's one sentence offers both operating models with no recommendation; interactive means up to ten open terminal windows by Day 3 (never stated), `--bg` means defect 2.
**Fix:** print the Day-0 kickoff prompt for L1 ("run node L0's accept from `.team/contracts/L0.txt`, seven gates in order, report the gate number that fails") and for I1, and pick one operating model.

**13. §7's channel labels point at a table whose absolute numbers §0 retracted.** "(60% channel)" etc. come from `TEAM.md:203-206`, whose prompt columns are `100–165 / 40–70 / 16–28 / 8–14` — computed off the 165–275 total that §0 correction 4 retracts in favour of 30–50. The percentages survive; the columns do not.
**Fix:** one clause noting the split is still 60/25/10/5 but TEAM.md's absolute prompt columns are stale under correction 4.

**14. (minor) §0 overstates the `--help` gap.** "it does **not** list `--append-system-prompt-file`" — `claude --help` does carry `via: --system-prompt[-file], --append-system-prompt[-file], --add-dir` inside the `--append-system-prompt` entry. The conclusion (the flag is real) is right; the premise is half-wrong.

**15. (minor) `--effort`'s legal values are never listed.** MEASURED: `low, medium, high, xhigh, max`. §2 uses four of them without a reference.

### What the RUNBOOK got right — verified by execution, not reading

- All three launch flags real, error strings reproduce **verbatim** (`--totally-not-a-flag` rejected, exit 1; the four bare flags each print `option '<flag> <arg>' argument missing`).
- The three-flag `--bg` boot works; background records do carry `id` and `status`, exactly as §0 quotes. 14 agents, `pid/sessionId/name/cwd` — all confirmed.
- `--bg`/`--print` conflict message reproduces **verbatim**.
- **The codex silent-fallback table reproduces exactly.** Scratch `CODEX_HOME` with base `xhigh`: flat `<name>.config.toml` → `reasoning effort: low`; `[profiles.<name>]` table → `xhigh`; missing profile → `xhigh`. **All three exit 0, all three silent.** I also tested the obvious remedy the RUNBOOK does not mention: `--strict-config` does **not** catch either case. §5's "grep the banner, not the exit code" really is the only instrument. (Add one cheap pre-flight the RUNBOOK could offer: `test -f "$CODEX_HOME/<name>.config.toml"`.)
- **Correction 1 is a genuine live defect and its replacement is correct.** Published form: bash/sh print a false `OPEN`, zsh aborts `rc=1`. Replacement: exit 0 and silent under `sh`/`bash`/`zsh` with the directory **absent and empty**, and correctly prints `OPEN …/DEV-002.md` when populated. Correctly located at `TEAM.md:368` and `charters/PM.md:62`.
- Corrections 2, 3, 4 all verified at the cited lines (`TEAM.md:186`, `TEAM.md:614` + `charters/PM.md:132`, `TEAM.md:189`) against `graph.json`'s 16.5 / 29.5.
- §1's day→seat→node table is **fully correct** against `schedule_A.days` cross-joined with owners: 2/16/13/16/9/4/2 nodes, new seats per day exactly as printed.
- Every capacity figure checks: 29.5, 16.5, 15.875, 0.625, 10.5, 0.05×107.5, Day-5 and Day-6 at 4.0 each, five human-gated nodes all cut 0.
- `contingencies[0]` quoted accurately; `H3`/`H5` cut ranks correct; W's 30/90 min, `K2 → K1 → W → C2`, `ownership_rule`, adopt/send-back/debt semantics, the three mandatory send-back fields, `erp/DEBT.md` non-existence, `check-ownership.mjs`/`ready.mjs` as `G0` outputs and `lint-layer0.mjs` as `G4` — all correct.
- `git log main --format='%cn' | sort -u` → `Caleb0796`; both repos `private MIT`; countinghouse `grep -cE '^\s+name: "' src/tools.js` → **15**. All as claimed.

---

## PROPOSAL-workflow-tools.md

**16. The recommended option's critical-path cost is understated by 0.5 h, and the recommendation's load-bearing sentence is false.** I recomputed the longest hard-edge horizon-A path from scratch; baseline reproduces exactly (`29.5 — L0 → V5 → S10 → S1 → S3 → S4 → T2 → H3 → H6 → D4 → D5 → D6`), and every one of §4's eight scenario rows reproduces to the decimal, including the `T2 → W → T5` free node at 30.5 and the `T2 → W → H3` reroute at 32.5. Then:

| | proposal | recomputed |
|---|---|---|
| **B** = `T1 +1.0, T2 +0.5, T3 +0.5, S10 +0.5` | **30.0** | **30.5** |
| **C** = `T1 +2.0, T2 +0.5, S4 +0.5, T3 +0.5, T6 +0.25, S10 +0.5` | **30.5** | **31.0** |

Isolated: `S10 +0.5` alone → **30.0**. `T2 +0.5` alone → **30.0**. `S4 +0.5` alone → **30.0**. `T3 +0.5`, `T6 +0.25` → 29.5 (free). Both `S10` and `T2` are on the published path, so B adds **+1.0**, not +0.5.

The proposal's own cost table marks `S10` "**on path**" two paragraphs below a scenario table that never once includes `S10` in any row. It computed every scenario except the one it recommends. Consequences: "**B holds the path at 30.0 h or below**" is false; the parenthetical "(29.5 if `T2` absorbs the numerals…)" is impossible, since `S10 +0.5` alone is already 30.0; and §4's reassurance that "B-lean (`T1 +1.0` only) moves none" of the enumerated republish list quietly redefines B as something B is not — **real B moves the path, so it does republish `capacity.graph_depth_hours`, `graph_depth_path`, all five `reachable_thresholds` rows, `ladder_does_not_shorten_the_schedule`, `capacity.verdict`, all four `cut_ladder.critical_path_after` values and the falsification trigger.**
**Fix:** correct B to 30.5 and C to 31.0; delete "or below"; delete the 29.5 parenthetical; state that B republishes the enumerated list and drop the "B-lean" equivocation. Then re-argue the recommendation against the true number — a 1.0 h path growth on a 132 h wall clock is probably still fine, but the paper must say so on the real figure.

**17. The design argument does not survive the counter it says it survives.** §2 concedes cleanly, then names two survivors. Survivor 1 (credential topology) is honest and is explicitly labelled as the project's existing claim, not a third one — good. **Survivor 2 fails.** It reads: *"a static OpenAPI document cannot make an operation cease to exist because a policy version bumped mid-session, and a backend server can only do so by being told a state it does not otherwise hold."*
- MCP ships `notifications/tools/list_changed`. A backend MCP server changing its tool list mid-session is a first-class spec feature, not an exotic capability. The proposal never names it, which is why the sentence reads as stronger than it is.
- In an expense ERP the backend **is** the system of record for report state and policy version. It already holds exactly the state the sentence claims it "does not otherwise hold." The only thing it lacks is the browser session identity — which is survivor 1.
- Therefore survivor 2 collapses into survivor 1. There is **one** survivor, not two, and it is unchanged by this proposal — which the proposal half-admits ("the WebMCP-specific part is unchanged") while presenting two independent items.

So: the concession is honest in tone but **the accounting after it is wrong**, and the wrongness runs in the proposal's favour. The design argument for the *shape* is real (maintenance ownership, demonstrability); the argument for the shape being *WebMCP-specific* is one claim the project already had.
**Fix:** name `notifications/tools/list_changed` explicitly, concede survivor 2, and rewrite the summary as "one survivor, already ours: credential topology. Workflow tools do not add a claim; they make the existing one demonstrable." That is still a sufficient case for B — it just has to be the case actually made.

**18. §2 walks BW-01 through the door §6.2 is guarding.** "cannot make an operation **cease to exist**" is a lock word. `RISK.md:375` BW-01: *"The surface is a **menu, not a lock**. The client can call whatever it likes; the page-side 403 … is the client talking to itself."* §6.2 catches the *atomicity* paraphrase ("the agent can only run the whole procedure or none of it") and misses the identical move in its own §2.
**Fix:** "cannot make an operation stop being **offered**." Same for W2's "unreachable **by construction**" (§3) — that one is server-enforced and therefore defensible, but write "server-enforced" and stop feeding BW-11's family.

**19. §1's three greps no longer reproduce, because the file now matches its own greps.** MEASURED as printed: `grep -rniE "openapi|swagger" erp/` → `exit=0`, and the workflow grep → **13**, not 0. With `--exclude=PROPOSAL-workflow-tools.md` both claims hold exactly (`exit=1`, `0`). A document that presents commands as "all run just now" must stay re-runnable.
**Fix:** add `--exclude=PROPOSAL-workflow-tools.md` to all four §1 commands and to the §4 restatement grep (whose 17-line/8-file breakdown otherwise reproduces **exactly**: FACTS 2, GRAPH 3, PLAN 4, RISK 1, charters/I2 1, tool-export.schema.json 1, graph.json 4, reviews 1).

**20. "9,638 lines" does not reproduce.** Measured: `erp/*.md` excluding the proposal = **10,119**; adding `graph.json` and the eight contracts = **16,212**. No combination I could construct lands on 9,638.
**Fix:** recompute or drop the number. The substantive claim survives without it — I checked, and only **two** lines in the corpus address the backend counter (`RISK.md:400` BW-26 and `FACTS.md:897`), both retraction rows.

**21. Option C sits exactly on the seat-day cap and the proposal never says so.** It checks `I2` only, correctly (`3.0 / 3.0 / 2.5` on Days 1–3 — verified from `schedule_A` × owners × hours). It does not check the other two seats it spends: under C, `I3` Day 2 goes 5.5 → **6.0**, exactly `capacity.seat_day_hours_cap`, zero slack; `L1` Day 1 goes 5.0 → 5.5. Nothing breaches, but C's real cost includes pinning `I3`'s heaviest early day to the cap.
**Fix:** one row in §5's C paragraph.

**22. (minor) "`S10` freezes `erp/contracts/` at end of Day 1" is loose.** `interface_freezes` shows `S10` freezing `erp/contracts/violation.schema.json` only; the other four freezes belong to `S1`, `T5`, `E4`, `F0`. The three files the proposal actually needs to edit (`tool-export`, `eval-case`, `signature`) are covered instead via `S10.accept`'s `sha256sum -c erp/contracts/FREEZE.md`. The deadline conclusion is right; the stated reason isn't.

### What the PROPOSAL got right

- **§4's entire eight-row scenario table reproduces to the decimal**, including "`T1` has exactly 5.0 h of slack" (I swept +1 through +6: 29.5 flat to +5.0, 30.0 at +5.5) and the `T2 → W → H3` warning at 32.5.
- All human-hour arithmetic is exact: 12.5 h ceiling, `+3.0 → 0.475`, `+7.0 → 0.275`, `+12.5 → 0.000`, B `+0.125 → 0.500`, C `+0.213 → 0.412`.
- Every frozen-file citation is precise: `eval-case.schema.json` `"value": 13` is on **line 844**; `signature.schema.json` carries "SEVEN tools, not five"; `tool-export.schema.json` has `totals.distinct_tool_count: 15` and `x-requiredStates`; `violation.schema.json` is correctly **not** among them, so the falsification trigger stays disarmed. `T6.accept` really does pin six literal auditor names, so W4 really does break it.
- `v2.3.0`, 68 nodes, 121 edges, **110 hard / 11 soft** — all exact. Surface counts 1/5/13/12/6/6 match `FACTS.md:565-571`. R-20's computed seven confirmed. The signoff being one revision behind (119 edges, 29.0 h) is exact.
- **Task item 7 passes cleanly.** I linted the proposal against all 32 BW patterns and the six banned legacy identifiers: **one hit**, `impossible without WebMCP`, inside a retraction-register quote — the same allowance `RISK.md` grants itself. And §6.4 is the strongest paragraph in either file: it holds `46% of 529` as MEASURED, cites `FACTS.md:56`'s "wrong about keyword-derived emptiness three times," refuses to write any uncommonness sentence before a three-variant concept-level re-test, and explicitly scopes §1's zero-hit grep to *our* corpus rather than the field. `erp/**` genuinely is excluded from the `G4` scan, as claimed.

---

# FIRST-TIMER SCORE: 12 stop-and-ask points before Day 0 ends

Auth is dead and unremedied (3) · `claude logs` is ANSI garbage (3) · interactive vs `--bg` unresolved (12) · **no command exists to send T1–T4 to a seat** (2) · no Day-0 prompt for L1 or I1 (12) · who appends `.team/log/inbound-<seat>.jsonl`, and how (5) · how W "polls every 30 minutes" with no timer and no ability to open a terminal (unspecified anywhere in the corpus) · who records D-17 and in what row format (10) · `G1`'s real command (1) · `V1`'s two evidence files and five fields (11) · `idle` is indistinguishable from dead in the only liveness instrument (3) · `--effort`'s legal values (15).

---

**RUNBOOK.md — NOT USABLE by a first-timer.** It is a first-rate audit wearing a manual's clothes. Everything it *checked* holds: I re-ran the flag probes, the codex three-way fallback, the deviation-gate shells and all four corrections, and every one reproduced, including the fact that `--strict-config` does not save you. But the manual's central act — sending a prompt to a named seat — has no command anywhere in it; the machine it was written on cannot authenticate; and the very first gate the user touches, `G1`, is a hand-written substitute that violates the file's own §6 rule and produces no evidence file. Fix defects 1–5 and 10–12 and it becomes usable; as it stands a first-timer stops twelve times and never gets a prompt into PM.

**PROPOSAL-workflow-tools.md — recommendation NOT SOUND as written; probably right on a corrected argument.** B costs 30.5 h of path, not 30.0, and "B holds the path at 30.0 h or below" is the sentence the recommendation rests on. The document computed seven scenarios and skipped the one it recommends, in a section that had already flagged `S10` as on-path. And the design case does not survive the backend counter the way it claims: `notifications/tools/list_changed` plus the fact that an ERP backend already owns report state and policy version collapses survivor 2 into survivor 1, leaving one claim the project already had. The concession is honestly *worded* and dishonestly *counted*. Everything the proposal cites from the corpus is accurate to the line number, and §6.4 is exemplary — which makes the two failures more annoying, not less. Correct the two numbers and the one argument and B is still likely the right call; do not accept it on the paper as it stands.