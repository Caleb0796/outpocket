# RUNBOOK.md — how to actually run this crew

**Audience: a person who has never run a multi-session agent team.** `TEAM.md` is the design.
This file is what you type, in what order, and what you do when it goes wrong. It changes no
authority: `graph.json` and `PATHS.md` remain the only two, and everything quoted below is
copied from them.

**Every command printed here was executed on this machine on 2026-08-28 and re-executed on
2026-08-29**, except the per-seat boot lines in §2 — those would start real sessions, and the
exact flag combination was verified end to end by the three `--bg` boot tests in §0, the third of
which ran a seat's task to completion and read its answer back. "Today" below means that
measurement window. Versions: Claude Code `2.1.251`, `codex-cli 0.144.6`,
node `v22.23.1`, git `2.54.0`, macOS `26.6.2`, login shell `zsh`. Commands that name
`tools/ready.mjs`, `tools/check-ownership.mjs` or `tools/lint-layer0.mjs` are quoted from
`graph.json` and **cannot** have been run: those files are outputs of `G0` and `G4` and do not
exist yet. Every one of those is marked where it appears.

---

## 0. Ground truth — what was run, and what the graph owner must fix

### THE FIRST THING, BEFORE ANYTHING ELSE: CHECK THE CLI'S AUTH, EVERY DAY

MEASURED twice on this machine, **seventeen minutes apart, on 2026-08-28**:

```
23:15  $ claude auth status   → {"loggedIn": false, "authMethod": "none", ...}
       $ claude -p "say ok"   → Failed to authenticate: OAuth session expired
                                and could not be refreshed
23:32  $ claude auth status   → {"loggedIn": true,  "authMethod": "claude.ai",
                                 "subscriptionType": "max", ...}
       $ claude -p "say ok"   → ok
```

**Read the two timestamps.** Nothing in this repository changed between them; the CLI's OAuth
session expired and was restored out of band. That is the finding — not "the CLI is signed out",
which was true for seventeen minutes and is a fact with a shelf life, but **the CLI's auth is
independent state that goes stale on its own clock and must be checked, not assumed.**

Two corollaries you must hold on to:

- **The desktop session you are reading this in holds a different credential and proves nothing
  about the CLI.** Every seat in this design is booted from the CLI.
- **A seat that cannot authenticate boots successfully and reports `idle`.** See boot test 2
  below, where a seat with expired auth sat in the roster as `idle` and said `Login expired` in
  nothing but its own log.

The CLI has since been logged back in and has stayed in: `claude auth status` reports
`{"loggedIn": true, "authMethod": "claude.ai"}` and `claude -p "reply with exactly: OK"` returns
`OK`. So it is a daily check, not a one-time setup — §2 step zero, and line 1 of §7's loop. The
remedy is `claude auth login`.

**What `idle` does and does not tell you — corrected, because an earlier draft of this file
overstated it.** That draft said `idle` is "the same word a seat that is thinking reports." It
is not. A seat that is running its contract reports **`status: busy`, `state: working`**; a seat
that has finished reports **`status: idle`, `state: done`** (boot test 3). So the roster *does*
separate working from not-working. What it cannot do is separate the three ways of not working:

| roster line | the seat is | how you tell |
|---|---|---|
| `busy` / `working` | running its contract | nothing to do |
| `idle` / `done` | **finished**, or **booted with no task**, or **dead on auth** | did its node's `outputs` appear? if not, grep its log (below) |

That narrower ambiguity is still worth a daily command, because two of those three are failures
and the roster spells all three the same way. Under R-38 (below) "booted with no task" no longer
happens by design, which leaves *finished* versus *dead*, and the outputs on disk decide it.

### The three launch flags the plan asserts are all real

`claude --help` lists `--model <model>` and `--effort <level>`, and it prints `--effort`'s legal
values: **`low`, `medium`, `high`, `xhigh`, `max`.** It does **not** list
`--append-system-prompt-file` as an option entry of its own. The string
`--append-system-prompt[-file]` does appear in `--help`, exactly once, in the prose of the
**`--bare`** entry — not in the `--append-system-prompt` entry. So the flag is real and
effectively undocumented. Proof — an unknown flag is rejected, a real one asks for its argument:

```
$ claude --totally-not-a-flag -p "x"  → error: unknown option '--totally-not-a-flag'
$ claude --append-system-prompt-file  → error: option '--append-system-prompt-file <file>' argument missing
$ claude --system-prompt-file         → error: option '--system-prompt-file <file>' argument missing
$ claude --effort                     → error: option '--effort <level>' argument missing
$ claude --model                      → error: option '--model <model>' argument missing
```

No correction is owed here. Do not "fix" the flags against `--help`; `--help` is incomplete.

### There is no `send`. R-37, the operating model.

`claude --help` lists exactly these subcommands: `agents attach auth auto-mode doctor gateway
import install logs mcp plugin project respawn rm setup-token stop ultrareview update`.
`claude auth` takes exactly `login | logout | status | help`. **There is no `claude send` and no
`claude message`, at the top level or under `auth`.** Any instruction anywhere in this corpus
that reads "send template T1 to PM" means the mechanism below and nothing else.

**R-37, ruled by the user, not reopenable. Every seat is booted `--bg` and named `-n <SEAT>`.**
Three reasons: a backgrounded seat survives closing the window; `claude agents --json` becomes a
greppable roster; and you never end up with ten terminal windows. `claude attach --help`,
verbatim: *"Open the background session in this terminal. ← returns to agent view, Ctrl+Z drops
back to your shell. The session keeps running either way."* So the continue verb is: attach,
type, press enter, **Ctrl+Z**.

### R-38, the dispatch primitive: a seat is booted WITH its task, by L1, when the node is ready

**Ruled by the user. Not reopenable, and it is the single most load-bearing correction in this
file**, because an earlier draft booted **eight** seats empty — PM, W, I2, I3, I4, QA, UX, L2 —
called them "the seven", and then never dispatched any of them.

> **`claude --bg -n <SEAT> --model <m> --effort <e> --append-system-prompt-file <charter> "<the node contract>"` IS the dispatch.**
> There is no second step. **No seat is ever booted empty and attached to later.**

MEASURED end to end (boot test 3, below): a `--bg` seat booted with a positional prompt **runs
that prompt immediately and finishes**. A `--bg` seat booted **without** one sits `idle` forever
and does nothing. So the two forms are not "boot now, task later" — they are "dispatched" and
"stranded".

Three consequences you will use every day:

- **L1's standing morning job** is: for every ready node it does not own itself, boot that node's
  seat with that node's contract as the positional prompt. That is what starts Day 1. §2 gives
  the order and §3 walks it.
- **A finished seat is re-dispatched the same way.** It shows `idle`/`done`; you (or L1) clear it
  with `claude stop <id>` then `claude rm <id>` — MEASURED to remove it cleanly from the roster —
  and boot the name again with the next node's contract. Clearing first also sidesteps the
  question of whether the CLI would accept a duplicate `-n` name, which is **not measured here**.
- **`claude attach <id>` is how you CONTINUE a seat mid-task**, not how work is started. It is the
  verb for the human's PM/L1/L2 checkpoints in §3 and §7 **whenever those seats read `working`**.
  When they read `done` — which they will most mornings, having finished the previous evening's
  task — the checkpoint is delivered as a re-dispatch instead, same template, different route.
  §2 has the two-row table that picks the verb for you.

### R-39, liveness: W does not poll, because W cannot

**Ruled by the user.** An agent cannot set a timer and cannot open a terminal window, so "W polls
every 30 minutes" was never implementable and has stopped being the liveness story anywhere in
this file. **Liveness is one command** — the roster below, filtered to this project's `cwd` — run
by **PM at each of its checkpoints** and by **you at the daily gate**. W keeps its whole judgement
role (gather evidence, write deviation tickets, never issue verdicts) and loses only the claim
that it watches the clock. `charters/W.md` and `TEAM.md` still publish the polling story; that is
an upstream correction and it is filed in §8.

Note that `attach`, `logs`, `stop` and `rm` take the **short id**, not the name. The roster maps
one to the other:

```bash
claude agents --json --cwd /Users/calebwei/mcp/outpocket \
  | jq -r '.[] | "\(.name)\t\(.id)\t\(.status // "-")\t\(.state // "-")"'
```

MEASURED today with no seats booted: prints nothing, exit 0. `--cwd` is a real flag and is a
cleaner filter than grepping paths. **Do not add `--all`** — MEASURED, `--all` also lists
sessions that have already exited, which is the one thing a liveness check must not do.

**`codex exec -p` layers a flat file, exactly as `FACTS.md` §14 says.** Verified by building a
scratch `CODEX_HOME` whose base `config.toml` sets `model_reasoning_effort = "ultra"`, then
running the same prompt three ways. Banner lines, verbatim:

| `<name>.config.toml` contains | banner `reasoning effort:` | exit |
|---|---|---|
| flat `model_reasoning_effort = "low"` | `low` | 0 |
| `[profiles.<name>]` table wrapping the same keys | `ultra` | 0 |
| no file at all | `ultra` | 0 |

Two of the three are wrong and neither says so. `FACTS.md` §14 is confirmed: **flat top-level
keys, no `[profiles.*]` table.** And `ls ~/.codex/*.config.toml` still reports **no matches** —
zero profiles exist today; L0 creates all four.

**Corrections to hand to PM. Correction 1 is a live defect and this runbook depends on it, so it
is printed here in full. The stale restatements are collected once, in §8 — they are not
restated here as well, because two homes for one number is how the corpus drifted in the first
place.**

1. **The deviation-loop gate fires a false alarm on an empty directory, and it is published in
   two places** — `TEAM.md` §6 and `charters/PM.md`. On Day 0 and Day 1 `.team/deviations/` is
   empty, which is exactly when PM first runs it. MEASURED, this machine, all three shells:

   ```
   bash: grep: .team/deviations/DEV-*.md: No such file or directory
         OPEN .team/deviations/DEV-*.md          ← false OPEN, and this shell is not zsh
   zsh : zsh:1: no matches found: .team/deviations/DEV-*.md   ← the loop never runs at all
   ```

   The user's login shell here is **zsh**, so the published form aborts. Working replacement,
   MEASURED to exit 0 and print nothing with the directory absent, and to behave identically
   under `sh`, `bash` and `zsh`:

   ```bash
   find .team/deviations -name 'DEV-*.md' -print 2>/dev/null | while read -r f; do
     grep -q '^VERDICT: \(adopt\|send-back\|debt\)$' "$f" || echo OPEN "$f"
   done
   ```

   This matters beyond the syntax: `RISK.md` records that **a trigger which fires on correct
   execution trains PM to ignore triggers.** The published form fires on Days 0 and 1 by
   construction. PM should replace it in both homes before Day 1. **The same broken-glob defect
   is published a third time at `charters/W.md:57`, over `.team/log/inbound-*.jsonl`** — but that
   one is **not repaired, it is deleted**, because the file it globs is written by nobody. §6 has
   the reasoning, §8 has the report.
2. **Everything else is a stale restatement or a ruled-away claim, and §8 is the single list.**
   Seven of them, on `TEAM.md` and the `PM`/`W` charters: the retracted 2.5 h/day, the retracted
   165–275 prompt total and the channel columns computed from it, "29.0 h" of graph depth, "eight
   fields", the inbound-log check, and **W's 30-minute poll (R-39)**. Two figures matter for
   reading the rest of this file, so they are stated once here
   and not again: **D-17 is ruled at 3.0 h/day → 16.5 h available**, and the prompt budget is
   **30–50 for the whole sprint**, roughly six per operating day. Every template in §7 is sized
   for that.

**What a "resident seat" physically is here.** A **name**, held across the sprint by a succession
of backgrounded Claude Code sessions, each booted with the same charter file as its appended
system prompt and a different node as its task. The charter is what persists; the session is not.
Sessions are addressable by name and enumerable — `claude agents --json` returned
14 live sessions on this machine, each with `pid`, `sessionId`, `name`, `cwd`, and for
backgrounded ones `id` and `status`.

**Boot test 1, MEASURED end to end.** `claude --bg -n ERP-BOOTTEST --model sonnet --effort low
--append-system-prompt-file erp/charters/W.md "<task>"` printed
`backgrounded · 618c66a3 · ERP-BOOTTEST`, and `claude agents --json` then showed
`{"id":"618c66a3","name":"ERP-BOOTTEST","kind":"background","status":"idle"}`.

**Boot test 2, run today at 23:15 during the signed-out window, and this is the one you must not
skip past.** The same boot line as `ERP-AUTHTEST`, against a CLI whose `auth status` said
`loggedIn: false`. It **succeeded**: it printed
`backgrounded · 00d10c5d · ERP-AUTHTEST`, and the roster then reported

```
ERP-AUTHTEST	00d10c5d	idle
```

**`idle` is one of the things a dead seat looks like.** The failure was visible in exactly one
place, the session's own log — and `claude logs <id>` emits raw ANSI escapes and full-screen
cursor positioning, so as printed it is unreadable. Strip it and **grep it for a fixed string**,
MEASURED identical under `bash` and `zsh`:

```bash
claude logs <id> | sed $'s/\x1b\\[[0-9;?]*[a-zA-Z]//g' | grep -o -i 'login expired\|not logged in'
```

which printed, for a seat the roster called `idle`:

```
Login expired
Not logged in
```

**Read that command for what it is: a fixed-string probe, not a way to read a transcript.**
An earlier draft of this file offered the same `sed` in §2 and §5 as general readability. It is
not. MEASURED on a real transcript, `wc -l` after the strip is **0** — the CLI paints with cursor
positioning rather than newlines, so stripping the escapes concatenates the whole screen into one
line and destroys word boundaries. Reproduced here on a synthetic frame that uses the same
`ESC[2J` / `ESC[1;1H` painting:

```
$ printf 'a\x1b[2Jb\x1b[1;1HLogin expired\x1b[0m c' | sed $'s/\x1b\\[[0-9;?]*[a-zA-Z]//g'
abLogin expired c          ← wc -l 0; "a" and "b" were never adjacent on screen
$ ... | grep -o -i 'login expired'
Login expired              ← the fixed string survives; the layout does not
```

So: **grep this for a phrase you already suspect. Never expect to read a seat's day out of it.**
To actually read a seat, `claude attach <id>` and `Ctrl+Z`.

**Boot test 3, MEASURED end to end today, and it is the evidence R-38 rests on.**

```
$ claude --bg -n SEAT-SMOKETEST --model sonnet --effort low \
    --append-system-prompt-file erp/charters/W.md "Reply with exactly: SEAT-OK"
backgrounded · 497398b6 · SEAT-SMOKETEST
$ claude agents --json
{"id":"497398b6","name":"SEAT-SMOKETEST","kind":"background","status":"idle","state":"done"}
$ claude logs 497398b6 | sed ... | grep -o 'SEAT-OK'
SEAT-OK
```

The seat **ran the positional prompt on its own, without being attached to**, produced its answer,
and settled at `status: idle` / `state: done`. Compare boot test 1, whose seat also read
`status: idle` but had a task, and boot test 2, whose seat read `idle` with no auth. Three
different conditions, one word — which is exactly the table above.

All three test sessions were stopped and removed afterwards (`claude stop <id>` then
`claude rm <id>`), which is also the re-dispatch move in R-38.

**Limits, so you do not plan around a capability we do not have:**

- **`--bg` and `-p/--print` conflict.** MEASURED, the CLI refuses: *"--print never starts the
  interactive session that `claude agents` attaches to, so the job would be unattachable."*
  With `--bg` the prompt is positional. That positional prompt is R-38's dispatch, and it is
  why R-37 is `--bg`, not `-p`: `-p` cannot be attached to, so a `-p` seat can never be continued.
- **An agent cannot open a new terminal window and cannot set a timer.** It can be booted with a
  task, and it can shell out to a headless `claude -p`. It cannot wake itself up in half an hour.
  This is the whole of R-39. **A genuinely dead resident session needs you to restart it**
  (`TEAM.md` §9.1, `charters/W.md`, `charters/L1.md`).
- **Background sessions inherit whatever auth the shell has, and report `idle` when they have
  none.** See boot test 2. In the roster a dead-auth seat is spelled the same as a finished one,
  so the discriminator is its node's `outputs` on disk. The remedy is §2 step zero, and it costs
  one command.

### The token quota — R-41, and the plan has no model for it

**MEASURED, in boot test 3's own log, on this account, today:**

```
You've used 88% of your weekly limit · resets 8am (America/Los_Angeles)
```

Four facts follow, and every one of them is a planning input the graph does not carry:

1. **There is no subcommand for this number.** `claude --help` lists `agents attach auth
   auto-mode doctor gateway import install logs mcp plugin project respawn rm setup-token stop
   ultrareview update` — MEASURED, and there is no `usage`. The percentage is printed **inside a
   session**: attach to any live seat, or grep a seat's log the §0 way. That is the only read.
2. **The whole sprint runs on ONE weekly allotment.** The quota resets **2026-08-29 08:00 PT**
   and not again until roughly **09-05**, which is after the **09-03 13:00 PT** deadline. So
   Days 1 through 6 draw on a single refill, with **88% of the previous one already spent** when
   this was measured.
3. **The four Codex seats draw on a SEPARATE quota.** C1–C4 are `codex exec` runs against
   OpenAI's account, not this one. That makes them the release valve, and it lines up with the
   user's own standing instruction that **evaluation work is mainly Codex**: `E8` (C1, blind),
   `E9` (C3, adversarial) and C4's build load are the natural places to push volume when the
   Claude side tightens.
4. **The plan models wall clock, human hours and agent hours, and models token quota nowhere.**
   `graph.json.capacity` has `human_hours_per_day`, `human_hours_available`, `seat_day_hours_cap`
   and `graph_depth_hours`. It has no token term at all. That is a real gap and it is filed for
   the graph owner in §8.

**The cheapest levers, in the order you should reach for them**, if the percentage climbs faster
than the days do:

| Lever | Why it is first |
|---|---|
| **Drop `--effort` a tier before dropping a seat** | `low medium high xhigh max` are all legal on every boot line. Dropping L2 from `xhigh` to `high`, or the I-seats from `high` to `medium`, keeps every node owned. Amputating a seat removes nodes. |
| **Prefer one long seat session over many short ones** | Each boot re-reads the charter and rebuilds context from nothing. Under R-38 a seat that is still `busy` on a multi-node stretch is cheaper than three dispatch cycles. |
| **Push eval and bulk build to C2/C4** | Separate quota. See fact 3. |
| **Never re-run a finished adversarial review** | `E8` and `E9` are expensive and their output is a document. Re-reading the document costs nothing; re-running the review costs a second full pass and rarely changes the verdict. |

**Grade: OUR-ESTIMATE, and weaker than most of this file.** We have one percentage reading and
one seat's worth of burn. **There is no measured burn rate per seat-hour, because none exists** —
so this section tells you what to watch and what to pull, and it deliberately does not predict
whether you will run out. Take the first reading on Day 1 morning and the second on Day 2
morning; the difference is the first real datum anyone in this project will have.

---

## 1. What an "agent team" is here, in plain language

It is not a product feature you switch on. It is **N backgrounded Claude Code sessions and some
Codex runs, each booted with a different charter file and with the node it is to work.** The
charter is what makes one seat different from another; the positional prompt is what makes it
*do* something (R-38). There is no server, no orchestrator process, and nothing to install.

Under R-37 none of them is a terminal window — they are backgrounded sessions and you hold zero
windows open. **And you do not boot sixteen of them on day one.** From
`graph.json.capacity.schedule_A.days`, by owner:

| Day | Node-owning seats that must be live | Nodes |
|---|---|---|
| **0** | **L1, I1** | L1: `L0` · I1: `V5` |
| 1 | + I2, I3, I4, QA, UX | 16 nodes |
| 2 | + PM (`V6`), C4 | 13 nodes |
| 3 | + L2 (`E4`), C1 (`E8`) | 16 nodes |
| 4 | + C3 (`E9`) | 9 nodes |
| 5 | C4, I3, UX | 4 nodes |
| 6 | I4, QA | 2 nodes |

Day 0 is **two seats**. Add **PM and W at the end of Day 0**, once `L0` is green — PM because you
talk to it from Day 1 morning, W because it is the deviation instrument. (W is **not** the
liveness detector; nothing polls. Liveness is the roster command, run by PM at its checkpoints
and by you at the gate — R-39, §0.) K1 and K2 are
unbudgeted overhead (`graph.json.non_node_seats`); boot them when the machine is comfortable,
and drop them first if it is not (seat amputation order, `TEAM.md` §9.6: **K2 → K1 → W → C2**).

C1–C4 are **not** resident sessions. They are `codex exec` invocations that L1 fires and that
exit. You never boot them and never talk to them.

---

## 2. The boot procedure, literally

Run every one of these from `/Users/calebwei/mcp/outpocket`. Every seat is booted `--bg` with
`-n <SEAT>` (R-37). With `--bg` the prompt is **positional**, so each boot line below carries
its seat's first task as its last argument — the boot and the kickoff are one command.

### Step zero — before you boot anything at all

```bash
claude auth status
```

It must print `"loggedIn": true`. If it prints `"loggedIn": false, "authMethod": "none"` — which
it did on this machine at 23:15 on 2026-08-28 and did not at 23:32 (§0) — then:

```bash
claude auth login
```

and run `claude auth status` again before you continue. **Do not boot a seat first and check
afterwards.** A signed-out seat boots successfully and settles at `idle`/`done` — the same pair a
seat that has *finished its work* reports (§0, boot test 2 against boot test 3). Nothing in the
roster separates them; only the node's `outputs` on disk do. This step costs one command;
skipping it costs Day 0. **Run it on every operating day, not only Day 0** — the expiry above
happened with nobody touching anything.

### Which charter path a boot line uses — R-40

`.team/charters` is a **symlink created by `L0`**. So any seat that must be alive **before `L0`
is green** reads its charter from the repository path `erp/charters/<SEAT>.md`; everything booted
after reads `.team/charters/<SEAT>.md`. Two seats qualify:

| Seat | Charter path on Day 0 | Why |
|---|---|---|
| **L1** | `erp/charters/L1.md` | L1 owns `L0`; the symlink is L1's own output (`TEAM.md` §1, R-15). |
| **PM** | `erp/charters/PM.md` | **R-40.** The Day-0 failure branch below escalates to PM, so PM must be bootable while `L0` is red. |

Nobody else. **Do not hand-run a substitute symlink command** — there is one copy of that command
and it lives in `L0`.

### Day 0, boot 1 — L1, dispatched with `L0` as its contract

```bash
claude --bg -n L1 --model opus --effort high \
  --append-system-prompt-file erp/charters/L1.md \
  "Day 0. Your only job today is node L0 (3.5 h, cut 0, head of the critical path). Copy L0's accept predicate VERBATIM out of erp/graph.json into .team/contracts/L0.txt and work it gate by gate — all seven, IN ORDER; the order is load-bearing three times over. Gate (1) is D-17 and it is a RECORDING, not a decision: the user ruled 3.0 h/day on 2026-08-28, so you CREATE erp/DECISIONS.md and write the row §2 of erp/RUNBOOK.md prints, verbatim, then run gate (1)'s node -e check and confirm it exits 0. Gate (6) is the first push and gate (7) clones the pushed remote, so nothing after gate (5) may be reordered. Gate (7) asserts 24 tests with EXACTLY 1 failure, named 'auditor surface: read-only by construction' — that RED test is expected and T6 fixes it on Day 1; do not fix it and do not make gate (7) demand exit 0. Report back only: which gates are green, and the first one that is not."
```

Once `L0` has landed the two paths are the same file and later L1 boots may use either.

### The D-17 row, literally

`L0` accept gate (1) is titled *"PM RULING D-17, BEFORE ANY SEAT IS DISPATCHED"*, and the
capacity block calls D-17 a Day-0 job. Under this runbook PM is not booted until the end of
Day 0, and that is **not** a conflict, because **the ruling has already been made** — by the
user, directly, on 2026-08-28, at 3.0 h/day (`graph.json.capacity.d17_ruling`). Nothing is left
to decide. What is left is to *record* it, and the recording happens inside `L0`, whose outputs
include `erp/DECISIONS.md`. **L1 writes this row. PM does not need to be alive for it.**

Gate (1)'s regex is
`^\|\s*D-17\s*\|[^\n]*human_hours_per_day\s*=\s*([0-9.]+)`, it then requires the captured value
to be `2.5` or `3.0`, and it requires `graph.json.capacity.human_hours_available` to equal that
value × 5.5. This is the row, and it was MEASURED today to satisfy all three:

```markdown
| ID | Date | Ruling | Consequence |
|---|---|---|---|
| D-17 | 2026-08-28 | human_hours_per_day = 3.0 | RULED by the user, directly, before any seat was dispatched. 3.0 x 5.5 days = 16.5 h available; 15.875 required; 0.625 h spare. NOTHING IS CUT — all 62 horizon-A nodes stay in scope. The 2.5 h/day branch and its 27-node amputation set survive in capacity.human_budget_sensitivity as a contingency, not as the plan of record. |
```

Written into a scratch `erp/DECISIONS.md` beside a copy of this repository's `graph.json`, gate
(1)'s `node -e` predicate exits **0**. Nothing else in this runbook prints a D-17 row; if you
change a digit here, change `graph.json.capacity.human_hours_available` in the same edit or the
gate fails, which is exactly what the gate is for.

### Every other boot — model and effort copied from the `TEAM.md` §1 roster table

```bash
# Day 0, boot 2 — I1 owns V5 (1.5 h), the throwaway HTTPS probe origin, so that V1 can run
# on Day 1 without waiting for the app.
claude --bg -n I1 --model opus --effort high \
  --append-system-prompt-file erp/charters/I1.md \
  "Day 0. Your only job today is node V5 (1.5 h): stand up a throwaway HTTPS probe origin. Take the accept predicate verbatim from erp/graph.json. Three things it requires that are easy to miss: the page must register EXACTLY 5 tools at load and one of them must never resolve; it must expose GET /whoami echoing the request cookie; and 'curl -sI $(cat evidence/V5-origin.txt) | tee evidence/V5-headers.txt' must return 200 over https with Origin-Agent-Cluster absent or not '?0'. You also produce erp/contracts/probe-verdict.schema.json today — it is a V5 output, not a V1 one, and V1 cannot start on Day 1 without it: it must require {origin, chatgptModel one of Sol|Terra, modelContextPresent boolean, toolCount integer, observedAt}. It is inside the set S10 freezes on Day 1, so get it right today. Report back the origin URL and the schema path."

# End of Day 0, once L0 is green and .team/charters exists. Both carry a first task (R-38).
claude --bg -n PM --model opus --effort medium \
  --append-system-prompt-file .team/charters/PM.md \
  "End of Day 0. L1 reports L0 green. Confirm it yourself, then prepare Day 1 and stop. Four things. (1) tools/ready.mjs and tools/check-ownership.mjs are node G0, they are L1's, and they DO NOT EXIST YET — G0 is a Day-1 node. Do not run them and do not report that you did. For Day 1 only, compute the ready set BY HAND over erp/graph.json's hard edges with L0 and V5 done, and say in the block that it is hand-computed. (2) Publish your five-line block for Day 1 morning: READY / BLOCKED / BURNED / DECIDED / ASK. BLOCKED names node ids or says none; BURNED is a number over 29.5; ASK carries AT MOST ONE item. (3) From Day 2 on, your charter's rule binds and you must RUN ready.mjs rather than assert a path. (4) Liveness is yours at every checkpoint and it is one command, not a poll: claude agents --json --cwd /Users/calebwei/mcp/outpocket. Nothing in this design polls on a timer. Do not dispatch anything — L1 boots seats, you do not."

claude --bg -n W --model sonnet --effort medium \
  --append-system-prompt-file .team/charters/W.md \
  "You are live from the end of Day 0. Your job is EVIDENCE, never verdicts: you detect deviations, write .team/deviations/DEV-<NNN>.md with all NINE fields in order (ID OPENED SEAT NODE CATEGORY CLAIM EVIDENCE VERDICT VERDICT_NOTE), leave VERDICT and VERDICT_NOTE empty, and PM adjudicates. Two corrections to your own charter, both ruled and both binding over it. (1) You do NOT poll every 30 minutes — you cannot set a timer, and liveness is PM's one-line roster command. Ignore your charter's polling language and keep the judgement. (2) charters/W.md:57 tells you to run 'ls .team/log/inbound-*.jsonl'; that glob aborts under zsh and errors under bash when nothing matches, which is the case on Days 0 and 1 by construction — and no building seat writes that file anyway, so the check cannot fire. Do not run it. Do NOT edit your own charter or any other document to reflect either correction: both are filed for the graph owner, and editing a restatement is banned. Tonight: read TEAM.md §6 and confirm back, in three lines, the four things you file on and the nine fields. File nothing yet."

# Day 1 onward — L1 boots the building seats, one per ready node, with the node as the prompt.
# You do not type these. They are here so you can recognise a correct one. Model and effort
# come from the TEAM.md §1 roster table and do not change per node:
#   I2 opus/high · I3 sonnet/high · I4 sonnet/medium · QA sonnet/medium · UX opus/medium
claude --bg -n I3 --model sonnet --effort high \
  --append-system-prompt-file .team/charters/I3.md \
  "Node S11 (2.0 h, cut 0): OCF-1 canonicaliser and the seven-vector suite. Copy S11's accept predicate VERBATIM out of erp/graph.json before you write any code, and work to it. Report back only: the accept line you ran and its exit code."

# Day 3 — L2, the commissar. Highest effort in the crew; it writes zero product code.
# L2 is booted the day you first need an opinion, WITH the question as its prompt.
claude --bg -n L2 --model opus --effort xhigh \
  --append-system-prompt-file .team/charters/L2.md \
  "Against erp/RUBRIC.md, is <artifact> enough to win? Cite the clause. Do not tell me whether a test passes — that is QA's scale."
```

**Every boot line above ends in a task, and that is R-38, not a style preference.** A seat booted
without one sits `idle` forever (§0, boot test 3). `--effort`'s legal values are
`low medium high xhigh max`, and `xhigh` on L2 is deliberate: it is the only seat whose output is
a judgement.

### Day 0, the failure branch — `L0` is not green by end of day

`graph.json.falsification[0]` names this **"the single hardest stop in the graph"**: with `L0`
red, nothing else can start — `T6` cannot run its own accept, the four Codex profiles do not
exist, `npm ci` has no lockfile, and the plan is not in git. There is no version of Day 1 that
routes around it. So Day 0 has a branch, and it is the reason R-40 exists:

1. **Ask L1 which gate.** `claude attach <L1's id>`, and the question is one line: *"Which of the
   seven is the first that is not green, and is the predicate failing or unwritable?"* That
   distinction is the whole triage — a **failing** predicate is L1's to fix, an **unwritable or
   ambiguous** one is PM's to rewrite. `Ctrl+Z`.
2. **If it is unwritable, boot PM now, from `erp/charters/PM.md`, with the question as its
   contract.** This is the branch R-40 is for; PM does not otherwise exist until `L0` is green.

   ```bash
   claude --bg -n PM --model opus --effort medium \
     --append-system-prompt-file erp/charters/PM.md \
     "Day 0, escalation. L0 gate (<n>) is not green and L1 reports the predicate is unwritable, not failing. You own graph.json and PATHS.md and nothing else. Read L0's accept predicate verbatim from erp/graph.json, decide whether to rewrite that gate or cut it, and if you rewrite it, edit graph.json — L1 does not have that authority and must not improvise a substitute. Answer in three lines: the gate, the ruling, and what L1 does next. Do not touch any file outside graph.json and PATHS.md."
   ```
3. **If gate (7) is the one that is red, read it twice before you escalate anything.** Gate (7)
   asserts 24 tests with **exactly 1 failure**, named `auditor surface: read-only by
   construction`. That RED test is **expected**; `T6` fixes it on Day 1. A gate (7) that demands
   exit 0 is the misreading, not the plan.
4. **Do not start Day 1 on a red `L0`.** Slipping Day 0 by an evening costs one day of a six-day
   sprint. Booting Day 1's seats against a tree with no lockfile costs the seats *and* the day,
   and every one of them will report something plausible while doing it.

### Where Day 1's fourteen non-human-gated nodes actually come from

**L1 boots them.** That is L1's standing morning job and it is the answer to "who starts the
work", which nothing else in this file answers:

> **For every ready node L1 does not own itself, L1 boots that node's seat with that node's
> contract as the positional prompt.** The contract is the node's `accept` predicate, copied
> verbatim out of `graph.json`.

You trigger it with one prompt, **T0**, first thing each morning (§7). You do not write the boot
lines and you do not choose the nodes — `node tools/ready.mjs` chooses them and L1 executes.

**Not all fourteen boot at 08:25, and they should not.** Only **nine** nodes are ready at Day-1
dawn, and three of those are not L1's to boot (`G0` is L1's own; `G1` and `V1` are yours). Six
remain, held by **four seats** — `T6`→I2, `S11`→I3, `G4`→I4, and `V0`→I1, with I1's `H1` and `H5`
queued behind `V0` because a seat works one node at a time. The rest of Day 1's nodes are
dispatched as their predecessors land: `S10` the moment `T6` merges, `S1` and `T1` after `S10`,
and so on. That is why the dispatch is a *standing job* and not a morning ritual — L1 re-runs
`ready.mjs` after every merge it gates and boots whatever the graph just unblocked.

**On Day 1 that standing job has a cold start**, because `ready.mjs` is `G0` and `G0` is not built
until Day 1 itself. §3's `T0-day1` hands L1 the hand-computed ready set so the morning does not
deadlock on a tool that does not exist yet. Every later day uses the short T0 in §7.

Three things to know about the mechanics:

- **A seat that finishes its node reports `idle`/`done` and must be re-dispatched**, not attached
  to: `claude stop <id>`, `claude rm <id>`, then the same boot line with the next node's contract.
  L1 does this; it is the same move §0 measured.
- **One seat, one node at a time.** I3 owns `S11` on Day 1 and five more nodes later in the week;
  it is one name in the roster and it is re-dispatched for each.
- **W is re-dispatched daily too, and it is the one seat you will forget.** W owns no node, so
  `ready.mjs` will never name it and nothing in the graph will remind anyone. A W left at `done`
  files zero tickets, PM's adjudication queue stays empty, and §4's entire deviation machinery
  reports perfect compliance because its only instrument is switched off. T0 names W explicitly
  for that reason.
- **You never boot a building seat yourself**, on any day, for any reason (§6). If a building seat
  is missing from the roster, that is a line to L1, not a boot line for you.

### How you actually talk to a seat that is already running

There is no `claude send`, and **`attach` is for continuing a seat, never for starting work** —
starting work is the boot line above (R-38). You attach to exactly three names, ever: PM, L1, L2.
Find the id, attach, type, drop back:

```bash
claude agents --json --cwd /Users/calebwei/mcp/outpocket \
  | jq -r '.[] | "\(.name)\t\(.id)\t\(.status // "-")\t\(.state // "-")"'
claude attach <id>          # type the template, press enter, then Ctrl+Z
```

`Ctrl+Z` returns you to your shell and **the session keeps running** (`claude attach --help`,
verbatim). You do not need to stay attached to get an answer — re-attach later. **Do not plan to
read the answer out of `claude logs`**: that pipe is a fixed-string probe and nothing more (§0).

**Read the state column first, and pick the verb from it.** This applies to PM and L1 every
morning, because both were booted the previous evening with a task and will have finished it:

| state | verb |
|---|---|
| `working` | **attach**, type, `Ctrl+Z` — you are adding to a live conversation |
| `done` | **re-dispatch**: `claude stop <id>`, `claude rm <id>`, then the §2 boot line with your template as the positional prompt |

Same template either way. The only thing that changes is how it gets in.

### Verify the roster before you trust it

```bash
claude agents --json --cwd /Users/calebwei/mcp/outpocket \
  | jq -r '.[] | "\(.name)\t\(.id)\t\(.status // "-")\t\(.state // "-")"'
```

MEASURED today with nothing booted: prints nothing, exit 0. Every seat that has been booted must
appear under the name it was given; a seat missing here never started. Read the **fourth** column,
not the third: `working` means it is running its contract, `done` means it has stopped — finished,
or dead (§0's table). **On Day 0, after the first boot, check that `L0`'s outputs are appearing on
disk before you trust the word `done`.**

This is also **the whole of the liveness story** (R-39). Nothing polls. PM runs this line at each
of its checkpoints and you run it at the daily gate, and that is the entire instrument.

---

## 3. A day in the life — Day 1, morning to evening

**Day 1 is the heaviest day in the sprint for YOU**, which is the only sense in which it is the
heaviest. Computed from `graph.json.capacity.schedule_A.days`:

| | nodes | owning seats | agent hours | human-gated hours |
|---|---|---|---|---|
| **Day 1** | 15 | 7 | 24.0 | **2.0** — `V1` 2.0 (`G1` moved to Day 6, R-42) |
| Day 3 | 16 | **9** | **29.0** | 0 |

Day 3 ties Day 1 on nodes and beats it on both seats and agent hours. What Day 1 owns alone is
your calendar: **2.5 of your 3.0 h day**, leaving **0.5 h for steering**, spent doing work rather
than steering it. Plan Day 1 as a work day, not a review day.

**08:25 — one prompt, to L1: the dispatch order.** This is the prompt that starts the day's work,
and without it nothing on Day 1 has an origin.

**Day 1's T0 is not the same as every other day's, and here is the trap.** T0 tells L1 to run
`node tools/ready.mjs` — but `tools/ready.mjs` **is node `G0`**, it is L1's own, it takes 2.0 h,
and at 08:25 on Day 1 **it does not exist**. Day 0 shipped `L0` and `V5` and nothing else. So on
Day 1, and only on Day 1, the ready set is computed **by hand** off `graph.json`'s hard edges with
`{L0, V5}` done, and it is the nine nodes in the block below. Send **T0-day1**:

> *"Day 1 dispatch, and read the first sentence twice: `tools/ready.mjs` is `G0`, it is yours, and
> it does not exist yet — do not try to run it. Today's ready set is computed by hand over
> `erp/graph.json`'s hard edges with `L0` and `V5` done, and it is nine nodes:
> `G0 G1 G4 V0 V1 H1 H5 T6 S11`. Three are not yours to boot — `G0` you build yourself, `G1` and
> `V1` are human-gated and I am doing them. **Boot the other six now**, one seat per node, seat
> from the node's `owner` field, model and effort from the `TEAM.md` §1 roster, and the node's
> `accept` predicate copied VERBATIM out of `graph.json` as the positional prompt:
> `T6`→I2, `S11`→I3, `G4`→I4, and `V0`→I1 (I1 also owns `H1` and `H5` today — one node at a time,
> re-dispatch it when `V0` lands). **Also re-dispatch W** — it finished its Day-0 task and is
> sitting at `done`, and a stranded W files no tickets: boot it with today's sweep (open branches
> against frozen contracts, merges on `main` with no `kb/pits/<node>.md`, tool descriptions over
> budget, banned wording that got past the hook). Then build `G0`, and from the moment it exists
> switch to running it after every merge you gate and booting whatever it just unblocked, without
> asking me. Report back now: the node→seat boots you fired, and nothing else."*

**From Day 2 on, T0 is the short form in §7** — `ready.mjs` exists by then and does the choosing.

Every "prompt to <seat>" in this file means the three-step verb — attach, type, `Ctrl+Z` — and
there is no `claude send` (§0, R-37). **The boot lines inside T0 are L1's to write, never yours:
L1 is the one holding the ready set and the `accept` text.**

**If the roster shows L1 at `done`, deliver T0 as a re-dispatch instead of an attach.** L1 was
booted on Day 0 with `L0` as its whole task, so it will have finished. That is the ordinary case
on Day 1 morning, not a fault:

```bash
claude stop <L1's id> && claude rm <L1's id>
claude --bg -n L1 --model opus --effort high \
  --append-system-prompt-file .team/charters/L1.md \
  "<T0, verbatim from §7>"
```

From Day 1 on, L1's charter path is `.team/charters/L1.md` — the symlink `L0` created. This is the
same re-dispatch move as any other finished seat (§0, R-38); L1 is not special about it.

**08:30 — one prompt, to PM.** `claude attach <PM's id>`, then template **T1**, in its Day-1 form:
*"Day 1. Publish your five-line block. `tools/ready.mjs` is `G0` and does not exist yet, so today's
ready set is hand-computed off graph.json's hard edges — say so in the block. Name the blocker node
id for anything blocked."* Then `Ctrl+Z`.

**What the ready-set procedure produces.** From Day 2 on, PM runs `node tools/ready.mjs` (node
`G0`, owner L1) — nodes whose inbound nodes are all done — and `node tools/ready.mjs --path` for
the critical path, and PM's charter forbids asserting a path without running it. **Day 1 is the
one day that rule cannot be met**, because the tool is being built that day; PM computes by hand
and labels it. Either way you get back the fixed block from `charters/PM.md`:

```
READY:    G0 G1 G4 V0 V1 H1 H5 T6 S11
BLOCKED:  G3 S10 S1 T1 F0 G5 G6 H2
BURNED:   5.0 / 29.5 on the critical path
DECIDED:  D-17 recorded 3.0 h/day, nothing cut
ASK:      nothing
```

**That block is recomputed, and it is nine nodes, not sixteen.** An earlier draft of this file
printed all sixteen of `schedule_A.days["1"]` here and called it a ready set. It is not one —
a *schedule* says which nodes are worked on Day 1; a *ready set* says which have every hard
predecessor already done. With `{L0, V5}` done, eight of that sixteen are still blocked, and
`H5` — which the schedule puts on Day 2 — is ready today:

| Blocked node | waits on | | Blocked node | waits on |
|---|---|---|---|---|
| `G3` | `G1`, `T6` | | `G5` | `G0` |
| `S10` | `T6` | | `G6` | `S10`, `S11` |
| `S1` | `S10` | | `H2` | `H1` |
| `T1` | `S10`, `T6` | | `F0` | `G4` |

**On Day 1 this block is checkable, and you should check it** — it is derived from `graph.json`
and nothing else, so PM's answer should match it node for node, and a mismatch on Day 1 morning
is a PM that is guessing. **From Day 2 the real block comes out of `node tools/ready.mjs`**, which
is `G0`, which L1 owns, and you check that one by shape rather than by content. Either way it
takes ten seconds: `BLOCKED` names node ids or says `none` (a bare "blocked" is malformed and
PM must fix it before publishing); `BURNED` is a number over `29.5`, not a mood; `ASK` is one item
or `nothing`; and `READY` is non-empty. **`READY:` empty while nodes remain undone is not green —
it is `tools/ready.mjs` telling you the graph is stuck**, and it is the cheapest alarm in this
system.

**Cross-check T0 against T1 while both are fresh.** The nodes L1 says it booted seats for should
be the nodes PM says are ready, minus the ones L1 owns itself (`G0`) and your two human-gated ones
(`G1`, `V1`). A ready node with no seat booted is the Day-1 failure this manual exists to prevent.

**08:35 — you decide the one thing Day 1 asks of you.** `ASK` carries at most one item; on Day
1 it is likely the scheduling of your own two human-gated nodes. Answer in one line.

**`G1` (0.5 h).** Flip both repos public with a root LICENSE. `G1` has **two** declared outputs
and the manual used to name only one, so here is the whole node:

| `G1.outputs` | Who makes it | How |
|---|---|---|
| `evidence/G1-visibility.txt` | the accept pipeline, via `tee -a` | step 2 below |
| `evidence/G1-about-box.png` | **you, by hand, in a browser** | step 3 below |

**Step 1 — the flip itself.** The accept predicate *verifies*; it does not *act*. Nothing else in
this file prints the acting command, so it is printed here once, and this is the one gate where
you are typing a command that is not lifted from `graph.json`:

```bash
for REPO in Caleb0796/outpocket Caleb0796/webmcp-eval-kit; do
  gh repo edit "$REPO" --visibility public --accept-visibility-change-consequences
done
```

**`--accept-visibility-change-consequences` is not optional and the failure is silent-looking.**
MEASURED today: `gh repo edit <repo> --visibility public` without it prints
`use of --visibility flag requires --accept-visibility-change-consequences flag` and a usage
block, and **changes nothing** — so a reader who fires the short form and does not read the output
will go to the accept predicate believing the flip happened. `gh` is `2.96.0` on this machine.

**Step 2 — the accept predicate, `G1.accept` verbatim from `graph.json`, pipeline included.**
**Run this, not a shortened version of it** (§6):

> For REPO in Caleb0796/outpocket Caleb0796/webmcp-eval-kit:
> `` gh api repos/$REPO -q '.visibility + " " + .license.spdx_id' | tr 'A-Z' 'a-z' | tee -a evidence/G1-visibility.txt ``
> outputs exactly `public mit`. Both repos, not one.

The two dropped pieces are both load-bearing. **`tr` is why the string is lowercase:** MEASURED
today, the raw `gh api` output for both repos is `private MIT` — capital MIT, from the SPDX id —
so without the `tr` this predicate never prints `public mit`, before the flip or after it.
**`tee -a` is the node's evidence:** `evidence/G1-visibility.txt` is a declared `G1` output, and
a hand-typed `gh api` that skips it leaves `G1` with no evidence file and no way to go green.
So: today both repos read `private MIT` raw, `private mit` through the accept's `tr`; the
LICENSE half is already done and only the flip is outstanding.

**Step 3 — the About-box screenshot.** `evidence/G1-about-box.png` is the node's other declared
output and there is no command for it: open the repository page on github.com and capture the
**About** panel in the right rail showing the **MIT licence** and the **Public** label. The node's
title is *"…with a root LICENSE **visible in the GitHub About box**"* — the API says the licence
is detected, the screenshot says a judge would see it, and those are different claims. `G1` is a
**cut-0, disqualification-level** node; it is not green with one of two outputs.

**`V1` (2.0 h).** The ChatGPT built-in browser cannot be driven by CDP, so you drive it by hand
— but **the human read is the second gate, never the only one.** `V1.accept` runs a mechanical
ajv gate FIRST, over `evidence/V1.json` against `erp/contracts/probe-verdict.schema.json`, and
also requires `test -s evidence/V1.png`. Only then does QA re-read the screenshot against the
JSON, and a mismatch fails the node. So while you are in that browser, capture **two files**:

| File | What it must contain |
|---|---|
| `evidence/V1.json` | exactly five fields — `origin`, `chatgptModel` (`Sol` or `Terra`), `modelContextPresent` (bool), `toolCount` (int), `observedAt` |
| `evidence/V1.png` | the screenshot, non-empty |

`erp/contracts/probe-verdict.schema.json` is a **Day-0 `V5` output**, written by I1, and it is
inside the set `S10` freezes on Day 1 — so if it is missing on Day 1 morning, that is a Day-0
failure to escalate, not something to improvise around.

**09:00–12:00 — you do `G1` and `V1` yourself.** No prompts spent. Four building seats are working
against the contracts L1 booted them with at 08:25 — I2 on `T6`, I3 on `S11`, I4 on `G4`, I1 on
`V0` — and W is live. **QA and UX have nothing to do at 08:25 and that is correct, not an
omission**: QA's Day-1 nodes are `G3` (needs `G1` and `T6`) and `G6` (needs `S10` and `S11`), and
UX's is `F0` (needs `G4`). L1 boots them the moment those predecessors merge. You will not read
any of their output, and that is the design, not a lapse (`TEAM.md` §2).

**14:00 — one prompt to L1** (`claude attach <L1's id>`, type, `Ctrl+Z`). Template **T2**:
*"What is actually merged right now, node by node, with the accept line that proved it? Name
anything you are holding because a seam is not frozen."*

L1 answers from merges, not from optimism. Its merge gate is five things (`charters/L1.md` §6
and §8): the accept predicate runs in its presence, the Layer-0 lint hook passes,
`check-ownership.mjs` passes on the diff's file list, `kb/pits/<node>.md` exists with all five
keys, and then `git push origin HEAD:main` plus the `git ls-remote` equality check. **A merge
is not done until `origin/main` carries it** — `G3` clones the remote and requires zero
failures, while `L0` deliberately ships one failing test (`auditor surface: read-only by
construction`) that `T6` fixes on Day 1.

**Do not try to audit that by committer name.** MEASURED today: `git config user.name` is
`Caleb0796`, globally, with no repository-local override and no per-seat git identity configured
or planned anywhere in this design. `git log main --format='%cn' | sort -u` prints `Caleb0796`
and will print `Caleb0796` whoever pushed — including you. See §6: the rule that only L1 pushes
is real and it is **not** machine-enforced.

**16:00 — nothing, if PM has said nothing.** Silence between checkpoints is correct. If you want
the cheap reassurance, it is the roster line, not a prompt: seats at `working` are working.

**End of day — one prompt to PM, the gate** (attach, type, `Ctrl+Z`). Template **T4**: *"End of Day 1. Five-line block,
plus: every ticket in .team/deviations carries a verdict, and today's adopt/send-back/debt
split."* The gate is mechanical and PM must run it — in the §0 correction-1 form, not the
published one:

```bash
find .team/deviations -name 'DEV-*.md' -print 2>/dev/null | while read -r f; do
  grep -q '^VERDICT: \(adopt\|send-back\|debt\)$' "$f" || echo OPEN "$f"
done
```

**It must print nothing.** An open ticket past a checkpoint is a banned behaviour in PM's own
charter. Total spend: **four prompts** — T0, T1, T2, T4 — one decision, and your **2.5** gated
hours.

---

## 4. The deviation playbook

Three layers (`TEAM.md` §6): **Layer 0** is a git hook with no model in it and blocks the
commit; **Layer 1** is W, which produces evidence and never verdicts; **Layer 2** is PM, which
issues one of exactly three verdicts. Tickets are `.team/deviations/DEV-<NNN>.md`, `NNN`
zero-padded to 3, **nine fields in a fixed order** — `ID OPENED SEAT NODE CATEGORY CLAIM
EVIDENCE VERDICT VERDICT_NOTE`, which is what every example below prints and what W's charter
prints byte-for-byte. (`TEAM.md` §6 says "eight"; that is an off-by-one in a restatement, §8.)
You see Layer 2 only, and mostly as a count.

### Example A — a Layer-0 block. You never see this one.

**Trigger.** I2 writes a tool description into `src/page/tools/compile.js` containing the phrase
*"the tool surface is the boundary"* and commits.

**What happens.** No ticket, no model, no token. `node tools/lint-layer0.mjs` (node `G4`, owner
I4, cut 0) fails the commit. The phrase is `BW-01` in `RISK.md` §2 and the hook points at the
replacement — *"the tool surface is the intent surface; the boundary is enforced on the server,
per request"*. I2 edits and re-commits inside a minute.

**Why it never reaches you.** Layer 0 costs nothing per commit and catches the majority of real
deviations, because most deviations are careless, not strategic — which is why your ticket
queue stays small enough to adjudicate in one line a day. The same hook covers the five entries
in `kb/webmcp/RETRACTED.txt` and any tool `description` over 500 characters. **If a
banned-wording ticket ever does reach you, the hook was bypassed with `--no-verify`: that is a
`discipline` ticket, not a wording one.**

### Example B — scope drift, adjudicated **ADOPT**

**Trigger.** W, inspecting branches at the checkpoint it was woken for, finds I2's branch
`seat/I2-T2` carrying a change to
`erp/contracts/violation.schema.json`, which `S10` froze on Day 1.

```
ID: DEV-014
OPENED: 2026-08-30T11:42:00-07:00
SEAT: I2
NODE: T2
CATEGORY: unilateral-interface-change
CLAIM: erp/contracts/violation.schema.json gained a `candidates` field with no freeze bump
EVIDENCE:
  git diff --name-only HEAD~1 | grep violation.schema.json
  erp/contracts/violation.schema.json
  sha256sum -c erp/contracts/FREEZE.md
  erp/contracts/violation.schema.json: FAILED
VERDICT:
VERDICT_NOTE:
```

**PM's verdict.**

```
VERDICT: adopt
VERDICT_NOTE: The schema was under-specified at freeze — the violation envelope had no way to
  name the field that caused it, and T2's accept requires exactly that. The plan was wrong, the
  work was right. I have updated graph.json S10's notes to carry the `candidates` field, which
  is the whole of my edit. L1 owns erp/contracts/FREEZE.md and is DIRECTED to re-run the freeze
  commit and regenerate the hashes; I do not touch that file. No rework, no branch time, I2
  keeps working.
```

**Reasoning that makes this adopt and not send-back:** the acceptance predicate did not fail
because the *work* was wrong; it failed because the *authority* was wrong. PM owns
`graph.json` and `PATHS.md` and absorbs that edit itself.

**And note precisely where PM stops.** PM's adopt authority is scoped to `graph.json` and
`PATHS.md` — those two files, nothing else (`TEAM.md` §6). `erp/contracts/FREEZE.md` has a
different writer: `PATHS.md:248` gives it **writer L1, producer `S10`**. A PM that regenerates
`FREEZE.md` itself writes a file it does not own, and `node tools/check-ownership.mjs` blocks
exactly that. So an adopt that lands in a frozen contract is always **two acts**: PM edits the
authority, and L1 re-freezes. This is the flagship example on purpose — if the model example
walks through the ownership wall, every seat learns the wall is decorative.

### Example C — the same shape, adjudicated **SEND BACK**

Identical detection: a frozen file changed with no bump. Shown adjudicated.

```
ID: DEV-021
OPENED: 2026-08-31T09:05:00-07:00
SEAT: I3
NODE: S4
CATEGORY: unilateral-interface-change
CLAIM: erp/contracts/violation.schema.json had `additionalProperties` relaxed to true on S4's branch
EVIDENCE:
  sha256sum -c erp/contracts/FREEZE.md
  erp/contracts/violation.schema.json: FAILED
  git diff HEAD~1 -- erp/contracts/violation.schema.json | grep additionalProperties
  -  "additionalProperties": false
  +  "additionalProperties": true
VERDICT: send-back
VERDICT_NOTE:
  (1) FAILED CLAUSE — S4's accept requires the rejection body to validate against the frozen
      violation.schema.json. Relaxing additionalProperties makes every malformed body pass, so
      the clause is satisfied by construction and proves nothing. This is silent-descope
      wearing an interface change as a costume.
  (2) REWORK DEADLINE — 2026-08-31T16:00-07:00.
  (3) BRANCH — seat/I3-S4, which L1 marks blocked until the revert lands.
```

**Reasoning:** the plan was right and the work was wrong. All three numbered fields are
mandatory; **a send-back missing any of them is malformed and the IC may refuse it.** That rule
exists so "send back" cannot become a way to shift the cost of a vague objection onto a builder.

### Example D — adjudicated **BOOK AS DEBT**

```
ID: DEV-027
OPENED: 2026-09-01T15:20:00-07:00
SEAT: UX
NODE: F2
CATEGORY: silent-descope
CLAIM: F2's title is "Report editor with per-field provenance AND an agent-proposed vs
  human-edited diff". The provenance attributes ship; the diff is attributes only — there is
  no rendered agent-proposed vs human-edited view anywhere on the page.
EVIDENCE:
  node --test tests/acceptance/editor.test.mjs
  # 6 pass, 0 fail — the suite asserts data-source in {agent,human} and data-prev-source
  # on the edited cell. It asserts attributes. It asserts nothing rendered.
  grep -c 'data-prev-source' src/page/ui/editor.js
  3
  grep -ci 'diff' src/page/ui/editor.js
  0
VERDICT: debt
VERDICT_NOTE: One line appended to erp/DECISIONS.md — "F2 ships per-field provenance and the
  data-prev-source attribute; the rendered agent-vs-human diff view is deferred; cost: the
  distinction is readable in the DOM and stated in the video, not shown on the page." Work
  merges as-is. UX's Day 4 is F2 3.5 + F6 2.5 = 6.0 h, which IS capacity.seat_day_hours_cap,
  with zero slack — a rendered diff panel does not fit today and there is no tomorrow before
  D4. D4 is the video at 4.0 human-gated hours on Day 5, and I will not spend Day-4 hours on
  a panel D4 does not film.
```

**Note what makes this a real detection and not a pedantic one.** `F2.accept` asserts
*attributes*: `data-source` in `{agent,human}` on every field cell, and `data-prev-source="agent"`
alongside `data-source="human"` after a human edit. It never asserts that anything is *rendered*.
So the gate is genuinely green while the deliverable named in the node's own title is half
absent — which is precisely the gap W is for, and precisely why the verdict is debt rather than
send-back: nothing failed, something is missing.

`erp/DEBT.md` does not exist and is not created — the decision log is the surviving consumer.
Debt is the honest verdict when the work is smaller than the contract, everyone knows it, and
buying the difference costs more than it is worth **right now**.

### The control-theory point, operationally

**ADOPT must be cheaper for the IC than SEND BACK, or seats learn to hide deviations.**
Concretely: adopt costs the IC **zero rework and zero branch time** — PM absorbs the document
edit. Send-back is used only when the acceptance predicate genuinely fails. If declaring "I
changed the interface" reliably costs more than not declaring it, the rational IC stops
declaring, W's ticket rate collapses, and the mechanism reports perfect compliance precisely
when compliance has failed.

**Before any of this can happen, W has to be running today.** W owns no node, so nothing in the
graph schedules it and `ready.mjs` will never mention it; it finishes whatever it was last booted
with and sits at `done`. **T0 re-dispatches it every morning** (§3, §7) and that line is the only
thing standing between this playbook and an empty ticket queue that looks like a clean crew.

**The one number to watch: the adopt share of adjudicated tickets, per day.** Healthy is
roughly **one-third adopt** over the sprint — grade **OUR-ESTIMATE**, a prior rather than a
measurement, and it should be replaced with this sprint's measured split before anyone reuses
it. **Your threshold is adopt under 10% for two consecutive days.** A near-zero adopt rate does
**not** mean the crew is clean; it means W has started predicting PM's verdicts instead of
reporting evidence, and W has stopped being an instrument. Your intervention is one line to PM:
*"Adopt is under 10% two days running. Loosen W's threshold and say so in writing."* Treat Days
1 and 2 as calibration, not as evidence about the crew (`TEAM.md` §9.3). The other tail is the
same failure with a different face: **zero tickets filed at all.** W's charter says it plainly
— being overruled is not a failure mode for W; filing nothing is.

---

## 5. Escalation and failure modes

| Symptom | Who owns it | What you do |
|---|---|---|
| **A seat goes silent** | **you, with one command; then PM** | **Nothing polls, so nothing will tell you unprompted** (R-39). Run the §2 roster line and read the fourth column. `working` → it is thinking; leave it. `done` → it stopped: check whether its node's `outputs` exist. Outputs present = it finished and needs re-dispatching by L1. Outputs absent = it died, and the next row is yours. An earlier draft of this file said to wait for W to report `STALLED: I3 (117 min, holds S4)`. **W cannot produce that line** — it has no timer — and waiting for it is how you lose a morning. |
| **A seat is genuinely dead** | **you — nobody else can** | It is missing from the roster, or sitting at `done` with none of its node's outputs on disk. Two moves, in order: **(1)** `claude auth status` — a dead-auth seat looks exactly like this (next row). **(2)** Tell L1 to re-dispatch it: `claude stop <id>`, `claude rm <id>`, then the §2 boot line with the node's contract as the positional prompt. **You still do not boot a building seat yourself.** Meanwhile PM has standing authority to have L1 re-dispatch that node to **C2**; you do not need to authorise that. |
| **Every seat reads `done` and nothing has moved all morning** | **you** | Not a stall — check auth before anything else. `claude auth status`; if `loggedIn` is false, `claude auth login`, then have L1 re-dispatch. MEASURED: a signed-out seat boots, prints its id, reports `idle`, and says `Login expired · Please run /login` **only** in its own log, which you reach with §0's fixed-string grep. Nothing else in the system can see this, so the daily auth check is not ceremony. |
| **Two seats edit the same file** | **L1**, adjudicated by **PM** | Nothing from you. `node tools/check-ownership.mjs --seat <S> --files-from <file>` runs on the diff at the merge gate. The rule is `graph.json.conventions.ownership_rule`: a node's own `outputs` beat the glob. **C2 committing on another seat's branch is the documented carve-out, not a violation** (`TEAM.md` §7). |
| **A gate fails at end of day** | **L1** if the predicate failed; **PM** if the predicate is wrong | Ask which one it is — that is the whole triage. L1 has no authority to invent a substitute predicate; an ambiguous or unwritable predicate goes to PM to be rewritten or cut. If PM rewrites the authority, that is an adopt, and it should already be a ticket. **On Day 0 this row has no PM yet — use §2's Day-0 failure branch, which boots PM from `erp/charters/PM.md` (R-40) for exactly this.** |
| **A ready node has no seat working on it** | **L1** | The one thing that can silently cost you a whole day, because nothing else in the system notices. Compare T1's `READY` against T0's boot list every morning (§3). Remedy is one line to L1: *"`<node>` is ready and has no seat. Boot `<SEAT>` with its contract now."* Under R-38 there is no such thing as a seat that is up and waiting for work — up means dispatched. |
| **A Codex run comes back green but implausible** | **L1** | Suspect the profile before you suspect the model. `-p <missing-profile>` and a `[profiles.*]`-shaped file both exit 0, warn nothing, and run at the base config's effort — MEASURED, §0. One prompt to L1: *"Grep the run banner for `reasoning effort: <level>`, not the exit code."* This is exactly how C3 and C4 could run the whole sprint at the wrong effort with every result file green. |
| **You are out of prompts for the day** | you | Stop. Do not borrow tomorrow's. The crew has four detectors that fire without you — W (evidence), C3 (`E9`, adversarial), C1 (`E8`, blind), QA (acceptance). Losing a day of steering costs less than losing the Day-5/Day-6 budget, which is **4.0 human-gated hours each** (`D4`; `D5`+`D6`) and cannot be cut: all five human-gated nodes are cut rank 0. |
| **`V1` comes back ABSENT** | **PM** | Three things fire and PM runs all three. **(1)** `graph.json.contingencies[0]`: **`D2` flips from cut rank 1 to cut rank 0**, a custom domain becomes mandatory "because judges would otherwise see a page with zero tools while local testing stays green", and `node tools/ready.mjs --check-cuts` is re-run after the flip. **(2)** `H5`'s banner is a hard requirement and is cut 0: the first screen states the Chromium major and whether `document.modelContext` was found, so a judge landing on a toolless page sees the page say so and offer the fallback. **(3)** `H3`, the in-page fallback agent, carries the video — it is cut 0 and on the critical path. Your part is one line: *"V1 ABSENT. Fire contingency 0, confirm --check-cuts, confirm H3 and H5 are still cut 0."* |
| **A disqualification-level risk appears** (repo private, no LICENSE, no audio on the video) | **PM**, work to **I4** | This outranks every schedule concern. PM stops the ready set and tells you. Answer immediately, out of budget if necessary. |

---

## 6. What you must never do

- **Never talk directly to a building seat** — I1, I2, I3, I4, QA, UX, W, K1, K2, or any Codex
  run. Two reasons, both structural. It destroys the four-ruler separation: QA measures *is it
  done*, L2 *is it enough to win*, C3 *can it be broken*, C1 *can a blind agent use it*, and a
  seat that has heard your opinion has heard a fifth ruler with no instrument. And it burns the
  bandwidth the whole design is built on — 3.0 h/day split 60/25/10/5 across PM, L1, L2 and
  off-rails.

  **There is no machine check for this, and the one an earlier draft printed is deleted — for
  the same reason `%cn` was deleted two bullets down.** That check was
  `ls .team/log/inbound-*.jsonl` must list only `PM`, `L1`, `L2`. It fails twice over.
  *Syntactically*: MEASURED today with no matching files, `bash` prints
  `ls: .team/log/inbound-*.jsonl: No such file or directory` rc 1, and `zsh` prints
  `zsh:1: no matches found:` and never runs the command — and on Days 0 and 1 there are no
  matching files by construction. *Structurally, and this is the fatal half*: `TEAM.md:222` makes
  **the recipient seat** write that file. Only PM, L1 and L2 declare an inbound-log path in their
  charters, so a building seat that receives a direct message **has no log to write** — the check
  is self-reported by the party it audits, and it reports clean **precisely on the violation it
  exists to detect**. Repairing the glob would have produced a check that still cannot fire.

  So this rule is **human-held, like the never-push rule**, and you should know that rather than
  trust a green light that cannot turn red. The nearest real observable is R-38's: the only thing
  that puts a prompt into a building seat is L1's boot line, and the only way you can add one is
  to deliberately `claude attach` a name that is not PM, L1 or L2. That is not something you do by
  accident. **Attach to three names. Ever.** The upstream defect is filed in §8.

  **Booting a seat is not talking to it.** You boot exactly four in the whole sprint — L1 and I1
  on Day 0, PM and W at the end of Day 0 — and each of those boot lines carries a task because
  R-38 requires it. After that, **L1 boots everything and you boot nothing.** The ban is on
  attaching to a building seat and putting your opinion into it, which is a different act.
- **Never skip T0.** It is the newest rule here and the most expensive to break. Under R-38 work
  only exists because a seat was booted with it, and the only thing that boots seats is L1 acting
  on T0. A day without T0 is a day where every seat sits at `done`, the roster looks calm, PM's
  block still prints, and nothing is built. **That is the failure this manual was rewritten to
  prevent**, and no other check in the system catches it — §5's "a ready node has no seat" row is
  a cross-check you perform, not an alarm that fires.
- **Never hand-edit a restated table.** `graph.json` and `PATHS.md` are the only authorities;
  `PLAN.md`, `GRAPH.md`, `TEAM.md`, `RISK.md`, `EVAL.md` and this file are checked restatements.
  Editing a restatement makes the corpus disagree with itself and hides the disagreement from
  `node tools/ready.mjs --check-tables`. If a number is wrong, PM fixes the authority once and
  the documents are regenerated.
- **Never `git push` by hand.** L1 is the sole pusher and pushing is L1's **standing
  obligation** on every merge, not a one-time bootstrap step. Your hand-push lands a tree that
  passed none of the five merge gates, and `G3` clones `origin/main`.

  **This rule is unenforced by machine, and you should know that rather than trust a check that
  cannot fail.** An earlier draft of this file said `git log main --format='%cn' | sort -u` must
  show only `L1`. It never will: MEASURED today, `git config user.name` is `Caleb0796` globally,
  there is no repository-local override, and no per-seat git identity is configured or planned
  anywhere in this design — so `%cn` reads `Caleb0796` for L1's pushes and for yours alike. That
  check passes *on the violation it exists to detect*, which is the exact pathology `RISK.md`
  names. It is deleted, not weakened. The nearest real detector is indirect and already in W's
  charter: a merge on `main` with no `kb/pits/<node>.md` is a `discipline` ticket, and a
  hand-push is the only way to produce one. If the graph owner wants `%cn` to mean something,
  the fix is upstream — configure a per-seat `user.name` in `L0` — and until that lands, this
  rule holds because you hold it.
- **Never run a substitute for a command that already exists in a node's `accept`.** There is
  exactly one copy of every gate command and it lives in `graph.json`. Every gate drift the five
  review rounds found came from someone hand-writing a second copy.
- **Never order a cut by rank number.** Name the node ids — "Cut T3, T5, F3, F5, E1–E10", never
  "fire rank 2". Two incompatible ladders once issued opposite orders in the same words. And
  know before you fire: the ladder shortens the critical path by **exactly zero** and frees
  **exactly zero** human-gated hours. If the deadline is the problem, cutting is the wrong tool.
- **Never treat a green Codex exit code as evidence.** Grep the banner. See §5.

---

## 7. The one-page card

**Two verbs, not one.** **Dispatch** is a boot line carrying the node's contract, and L1 fires
every one of them (R-38, §2). **Continue** is attach, and it is the only verb you use, on three
names — PM, L1, L2. Everywhere below, "T<n> to <seat>" means continue:

```bash
claude agents --json --cwd /Users/calebwei/mcp/outpocket \
  | jq -r '.[] | "\(.name)\t\(.id)\t\(.status // "-")\t\(.state // "-")"'   # name → id
claude attach <id>            # type the template, press enter, then Ctrl+Z
```

`Ctrl+Z` returns you to the shell and the session keeps running. **If the seat's state column
reads `done`, attach is the wrong verb** — `claude stop`, `claude rm`, then re-boot it with the
template as the positional prompt (§2). PM and L1 read `done` most mornings; that is normal.

**The daily loop, eleven lines.**

1. `claude auth status` → `"loggedIn": true`. Then the roster command above. A dead-auth seat is
   spelled `idle`/`done` like a finished one, so this line is two checks, not one.
2. Read the roster's **state** column. `working` = working. `done` = finished *or* dead; the
   node's `outputs` on disk decide which. Nothing polls; this line is the whole liveness story.
3. **T0 to L1.** The dispatch order. **This is the line that makes the day happen** — every ready
   node gets its seat booted with its contract. Skip it and the day has no work in it. If L1
   reads `done`, deliver T0 as a re-dispatch: `claude stop` + `claude rm`, then the boot line with
   T0 as the positional prompt (§3).
4. **T1 to PM.** Read the five-line block.
5. Cross-check: every node in `READY` should appear in T0's boot list, minus L1's own and your
   human-gated ones. A ready node with no seat is the alarm nothing else raises.
6. `READY:` empty while nodes remain → the graph is stuck. That is the other alarm.
7. `ASK:` has at most one item. Answer it in one line, now.
8. Do your own human-gated nodes. Day 1: `V1`. Day 5: `D4`. Day 6: `G1`, `D5`, `D6`.
9. **T2 to L1**, once, mid-afternoon. Merged nodes only, with the accept line that proved each.
10. **T3 to L2**, only on a day you need an opinion. Not daily.
11. **T4 to PM** at end of day. The deviation loop (§0 correction 1 form) must print nothing.
    Then stop. Silence between checkpoints is correct.

**The five prompt templates.** At 30–50 prompts total that is about six a day; these five, minus
T3 on most days, plus one answer to `ASK`, is five.

- **T0 — first thing, L1 (25% channel). The one that starts the work. Days 2–6; on Day 1 use
  `T0-day1` in §3, because `ready.mjs` is `G0` and is not built until Day 1 itself.**
  `Day <N> dispatch. Run node tools/ready.mjs. For every ready node you do not own yourself, boot that node's seat now: claude --bg -n <SEAT> --model <m> --effort <e> --append-system-prompt-file .team/charters/<SEAT>.md "<the node's accept predicate, verbatim from graph.json>". Models and efforts from the TEAM.md §1 roster. Re-dispatch any seat sitting at state done with claude stop / claude rm first, W included — a stranded W files no tickets, so boot it with today's sweep. Then keep doing it all day without asking me: after every merge you gate, re-run ready.mjs and boot whatever it just unblocked. Report back now the node→seat boots you fired this morning, and nothing else.`
- **T1 — morning, PM (60% channel).**
  `Day <N>. Publish the ready set from tools/ready.mjs and your five-line block. Name the blocker node id for anything blocked.`
- **T2 — mid-afternoon, L1 (25% channel).**
  `What is actually merged right now, node by node, with the accept line that proved it? Name anything you are holding because a seam is not frozen.`
- **T3 — as needed, L2 (10% channel). The only opinion channel.**
  `Against erp/RUBRIC.md, is <artifact> enough to win? Cite the clause. Do not tell me whether a test passes — that is QA's scale.`
- **T4 — end of day, PM.**
  `End of Day <N>. Five-line block, plus: every ticket in .team/deviations carries a verdict, and today's adopt/send-back/debt split.`

**The 60/25/10/5 split in whole prompts.** `TEAM.md:203–206` prints those percentages against
columns of `100–165 / 40–70 / 16–28 / 8–14`, which are computed off a **165–275** sprint total
that §8 retracts. The split survives; the columns do not. Recomputed against
**30–50 total**:

| Channel | Share | Prompts, whole sprint | What it buys |
|---|---|---|---|
| **PM** | 60% | **18–30** | schedule, scope, deviation verdicts — T1 and T4, every day |
| **L1** | 25% | **8–13** | **T0 every morning** and T2 most afternoons |
| **L2** | 10% | **3–5** | "is this enough to win" — T3, three to five times in the whole sprint |
| off-rails | 5% | **2–3** | your own curiosity |

**The L1 row is now the tight one, and you should see that coming.** T0 daily plus T2 most days
is 6 + 5 = **11 over six operating days, against a band of 8–13** — inside it, near the top, with
no room to spend L1 on curiosity. If it binds, the prompt to drop is T2, not T0: T0 starts work
and T2 only reports on work already started, and L1's merge discipline runs whether you ask about
it or not. **Never drop T0 to save a prompt.** Take the shortfall out of off-rails.

Read the L2 row twice. Three to five prompts is the entire opinion budget, so **T3 is not a
daily template** — spending it daily consumes the channel by Day 2.

**The four numbers to watch.**

| Number | Where it comes from | Act when |
|---|---|---|
| **Adopt share of adjudicated tickets** | T4's split, daily | **< 10% two days running** → tell PM to loosen W. Zero tickets at all is the same failure. |
| **`BURNED` on the critical path, against 29.5 h** | T1's block; `graph.json.capacity.graph_depth_hours` | Burn outruns the day's share → the fix is scope in `D4`/`D5`/`D6`, never the cut ladder, which shortens the path by zero. |
| **Human hours spent, against 16.5 total** | `graph.json.capacity.human_hours_available`; required **15.875**, spare **0.625** | You have **0.625 h** of slack for the whole sprint. Day 5 and Day 6 each carry **4.0 human-gated hours** and no rank of the ladder frees one of them. Plan two half-days before Day 4 ends, or shorten `D4`'s scope by ruling — not by discovering it at noon on Day 5. |
| **Weekly token quota, % used** | R-41, §0. **No subcommand prints it** — attach to any live seat and read the status line, or grep a seat's log. **MEASURED 88% used on 2026-08-28**, resetting **08-29 08:00 PT** and not again before the **09-03 13:00 PT** deadline | The whole sprint runs on **one** allotment. Take a reading Day 1 morning and Day 2 morning; the difference is your only real burn rate, and **there is no prior — this is the one number in this table nobody has ever measured for this workload.** If it outruns the days: drop an `--effort` tier before dropping a seat, prefer one long seat session over three short ones, push eval and bulk build to **C2/C4** (separate quota), and never re-run a finished adversarial review. |

---

## 8. Stale upstream restatements — for the graph owner, not for you

`graph.json` and `PATHS.md` are the only authorities, and §6 forbids hand-editing a restatement.
So the following are **reported here and not fixed in place**. Each is a restatement that
disagrees with an authority or with a measurement made on this machine; this runbook is written
against the authority in every case, which is why it and its upstream now differ. Every line
number below was re-checked with `sed -n '<n>p'` today; two had drifted since the last pass and
are corrected here.

| Where | What it says | What the authority or the machine says |
|---|---|---|
| `charters/W.md:57`, `TEAM.md:220–224` | the inbound-topology check is `ls .team/log/inbound-*.jsonl`, which must list only `PM`, `L1`, `L2` | **Broken twice, and the second break is not repairable by fixing the glob.** (a) MEASURED broken in both shells with no matching files — `bash` rc 1, `zsh` `no matches found` and the command never runs — and there are no matching files on Days 0 and 1 by construction; same defect as §0 correction 1, in a third home, on the seat whose job is instrumentation. (b) `TEAM.md:222` makes **the recipient seat** write the file, and only PM/L1/L2 declare that path, so a building seat that receives a direct message has no log to write: the check is self-reported by the audited party and reads clean on the violation it exists to detect. **Delete it, as `%cn` was deleted** — §6 now states the rule as human-held. |
| `charters/W.md` (the polling story), `TEAM.md` §6 Layer 1 | W "polls every 30 minutes" and declares a stall at 90 min, reporting `STALLED: <seat> (<n> min, holds <node>)` | **R-39, ruled by the user: unimplementable.** An agent cannot set a timer and cannot open a terminal window, so W can neither poll nor emit that line, and a runbook that tells the reader to wait for it costs a morning. Liveness is one command — `claude agents --json --cwd <project>` — run by **PM at each checkpoint** and by the **human at the daily gate**. W keeps the whole judgement role (evidence, tickets, never verdicts) and loses only the clock. Both files should say so. |
| `TEAM.md:348` | the deviation ticket has "exactly these **eight** fields" | **Nine**: `ID OPENED SEAT NODE CATEGORY CLAIM EVIDENCE VERDICT VERDICT_NOTE`. W's own charter prints nine, and so does every example in `TEAM.md` §6 itself. (Cited as `:346` in an earlier pass; it is `:348` today.) |
| `TEAM.md:186` | "the agreed team design says **2.5**, and 2.5 is what this plan assumes" | D-17 was RULED at **3.0** on 2026-08-28 (`capacity.d17_ruling`, `capacity.human_hours_available` = 16.5). The same bullet states 3.0 two lines earlier, so the file contradicts itself inside one bullet. |
| `TEAM.md:188` | "30–50 prompts/day → **165–275** total" | The sprint figure is **30–50 total**, ~6 a day. (Cited as `:189` in an earlier pass; it is `:188` today.) |
| `TEAM.md:203–206` | channel columns **100–165 / 40–70 / 16–28 / 8–14** | Computed off the retracted 165–275. The 60/25/10/5 **split is right**; at 30–50 total the columns are **18–30 / 8–13 / 3–5 / 2–3** (§7). |
| `TEAM.md:614`, `charters/PM.md:132` | "graph depth stays **29.0 h**" | `capacity.graph_depth_hours` is **29.5**. |

**Two structural items**, which are design gaps rather than stale numbers, and which the graph
owner must **rule on** rather than correct.

**(i) `graph.json.capacity` has no token-quota term.** It models `human_hours_per_day`,
`human_hours_available`, `seat_day_hours_cap` and `graph_depth_hours`, and it does not model the
resource that was **MEASURED at 88% consumed on 2026-08-28** with one weekly reset
(**08-29 08:00 PT**) standing between here and the **09-03 13:00 PT** deadline. The sprint runs on
one allotment; nothing in the plan knows that. §0 and §7 now carry it as a watched number, at
grade OUR-ESTIMATE with **no measured burn rate**, which is the best this runbook can do from
outside the authority. The graph owner should decide whether it becomes a capacity field, and if
so, whether the Codex seats' separate quota is modelled as the release valve it is.

**(ii) No per-seat git identity exists anywhere in this plan.**
`git config user.name` is `Caleb0796` globally, with no repository-local override, so
`git log main --format='%cn'` cannot distinguish L1's pushes from a hand-push and cannot enforce
`TEAM.md`'s never-push rule. Either `L0` configures a per-seat `user.name` — after which `%cn`
becomes a real detector and this runbook's §6 gains a check back — or the rule stays
human-enforced and every document that cites `%cn` as its proof should stop.

**§6 now holds two human-enforced rules and zero machine checks for them** — never hand-push, and
never talk to a building seat. Both had a published check; both checks reported clean on the
violation they existed to detect; both are deleted rather than weakened. That is a pattern, not
two coincidences, and it is the thing in this corpus most worth the graph owner's attention: a
check that cannot fail is worse than no check, because it spends the reader's trust.
