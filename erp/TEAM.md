# TEAM.md — outpocket crew, control surface and merge protocol

> **This file is not an authority.** There are exactly two: `erp/graph.json` owns node
> identity, ownership, hours, cut rank and accept predicates; `erp/PATHS.md` owns every
> literal path, filename, artifact name and command name. This file quotes them and never
> restates them. Where this file and either authority disagree about a node, a path or a
> command, **the authority wins and this file is regenerated.**
>
> Scope of this file: **who exists, what model they run on, how they are launched, who is
> allowed to talk to whom, how deviations are adjudicated, how code merges, and what gets
> written down.** Seat existence, model and effort are the only things it decides on its own.
>
> Horizon: Sprint A ends **2026-09-03 13:00 PT**. Track B is everything after. Lane X
> (extraction) is Track B by default and never sits on Sprint A's critical path. Any seat
> that finds itself doing X work before the deadline is deviating and must file a ticket (§6).

---

## 0. Roster reconciliation — say this out loud

The user agreed a **15-seat** crew in which **Codex holds four positions**. The 15 names
actually written down were PM, L1, L2, W, C1, C2, C3, I1, I2, I3, I4, QA, UX, K1, K2 — that
is only **three** Codex seats. The fourth Codex position was agreed but never named.

This plan names it **C4, the Codex eval engineer**, owner of `webmcp-eval-kit` and the graded
runs. That matches the user's separate instruction that eval is mainly Codex-run. The crew is
therefore **16 seats**, not 15. This is the single place where this document knowingly departs
from the agreed headcount, and it departs *upward* by filling a slot the user already
allocated. `graph.json.seats` carries the same reconciliation verbatim.

Evidence grade for the launch flags below: **MEASURED** — `--model` and `--effort` were both
confirmed to exist as session-level flags on the installed CLI (codex 0.144.6).

Evidence grade for the Codex profile mechanism: **UNVERIFIED, and it cannot be graded higher
by the probe this document used to carry.** MEASURED 2026-08-28: `codex exec --strict-config
-p nonexistent-profile-xyz --ephemeral -s read-only --skip-git-repo-check -o /tmp/sc.txt
"Reply with exactly: OK"` **exits 0 with no error and no warning**, silently falling back to
the base config. So "`codex exec -p verifier 'print ok'` returns" proves nothing at all: it
returns identically with no profile file on disk. Ruling **R-3** applies — a profile check must
assert *existence* and *effect*: `test -f ~/.codex/<name>.config.toml`, parse it, and grep the
run banner for `reasoning effort: <level>`. The four profile files do not exist yet
(`ls ~/.codex/*.config.toml` → no matches, MEASURED). **Creating them is node `L0`**, owner L1,
3.5 h, cut rank 0, the head of the critical path. It is a node with hours, not a chore.

**And the file layout is specified, because getting it wrong fails `L0` gate (4) with no pointer
at the cause.** `~/.codex/<name>.config.toml` is a config **layer**, not a container of profiles
— `codex exec --help`, verbatim: *"Layer `$CODEX_HOME/<name>.config.toml` on top of the base user
config"* — so it carries **flat top-level keys** (`model`, `model_reasoning_effort`) and no
`[profiles.<name>]` table. The table form exits 0, warns nothing, sets nothing, and leaves the
banner at the base config's effort. **`FACTS.md` §14 carries the worked file**; L1 copies it
rather than composing one, and C1–C4 read it before reporting a profile as broken.

---

## 1. Roster

Charters live in `erp/charters/`. The launch flag points at `.team/charters/`, which is a
**symlink**, so there is exactly one copy of every charter and it is version-controlled with
the plan.

**Nothing in this file creates `.team/`.** The whole tree — `.team/charters` (the symlink),
`.team/contracts`, `.team/log`, `.team/deviations`, `.team/stalls.md`, `.team/lint/banned.txt`
— plus `package.json`, `package-lock.json`, the ported spike under `src/` and `tests/`, and the
four `~/.codex/*.config.toml` profiles are **all outputs of node `L0`**. (The eight frozen
schemas under `erp/contracts/` are **pre-existing planning artifacts**: `L0` commits them where
they are and neither moves nor copies them — `PATHS.md` §2.4.) `L0`'s accept predicate is in
`graph.json`; L1 copies it verbatim into `.team/contracts/L0.txt` and runs it. Two of its five
clauses are the roster's own acceptance: `ls .team/charters | wc -l` equals **16**, and every
profile is asserted for existence *and* effect. Do not hand-run a substitute symlink command
here; there is one copy of that command and it lives in L0.

> ### The one boot that does not go through `.team/` — R-15, and it is not optional
>
> Every launch command below points at `.team/charters/<seat>.md`. That symlink is created by
> **`L0`**, whose owner is **`L1`**. So the seat that must run `L0` cannot be launched by the
> command in its own row: the charter it needs is behind the symlink it has not created yet.
> The previous revision closed the loop and then forbade the only escape from it, and **`L1`
> could not boot at all.**
>
> **The exception, and it is exactly one line: L1's FIRST boot reads
> `--append-system-prompt-file erp/charters/L1.md` directly, from the repository, before
> `.team/` exists.**
>
> That is the whole permission. It applies to **L1 only**, to its **first** boot only, and to
> **no other seat** — every other seat is dispatched after `L0` is green and uses the
> `.team/charters/` path in its row. It is not a licence to hand-run a substitute symlink
> command: there is still exactly one copy of that command and it still lives in `L0`. Once
> `L0` has landed, `.team/charters/L1.md` and `erp/charters/L1.md` are the same file, so a
> relaunched L1 may use either path and nothing downstream can tell the difference.

| Seat | Role | Runtime | Model / effort | Nodes owned (`graph.json`) | Launch command |
|---|---|---|---|---|---|
| **PM** | project manager | resident Claude | opus / medium | **V6** | `claude --model opus --effort medium --append-system-prompt-file .team/charters/PM.md` |
| **L1** | foreman | resident Claude | opus / high | **L0 G0 G5 S10**; **sole pusher to `main`** | **first boot only:** `claude --model opus --effort high --append-system-prompt-file erp/charters/L1.md` — see the boot exception above. Every later boot: `… --append-system-prompt-file .team/charters/L1.md` |
| **L2** | commissar | resident Claude | opus / xhigh | **E4**; writes **zero** product code | `claude --model opus --effort xhigh --append-system-prompt-file .team/charters/L2.md` |
| **W** | overseer | resident Claude | sonnet / medium | **none — unbudgeted overhead (§8)** | `claude --model sonnet --effort medium --append-system-prompt-file .team/charters/W.md` |
| **C1** | blind verifier | `codex exec`, dedicated empty `CODEX_HOME` | profile `verifier` is **not used** for the blind run — see below | **E8** | see the single command below; there is no short form |
| **C2** | build arm | `codex exec -p builder` | builder / medium | **X1–X5** (Track B); loaned into a lane's worktree in Sprint A | `codex exec -p builder -s workspace-write -c sandbox_workspace_write.network_access=true "$(cat .team/contracts/<node>.txt)" < /dev/null` |
| **C3** | red team | `codex exec -p redteam` | redteam / **high** | **E9**, owns `tests/redteam/` | `codex exec -p redteam -s workspace-write -c sandbox_workspace_write.network_access=true "$(cat .team/contracts/E9.txt)" < /dev/null` |
| **C4** | eval engineer | `codex exec -p evaluator` | evaluator / high | **E1 E2 E3 E5 E6 E7 E10** (+ X6 on Track B) | `codex exec -p evaluator -s workspace-write -c sandbox_workspace_write.network_access=true "$(cat .team/contracts/<node>.txt)" < /dev/null` |
| **I1** | loop engineer (seat 1) | resident Claude | opus / high | **V0–V5, H1–H6** | `claude --model opus --effort high --append-system-prompt-file .team/charters/I1.md` |
| **I2** | tool-surface engineer | resident Claude | opus / high | **T1 T2 T3 T5 T6** | `claude --model opus --effort high --append-system-prompt-file .team/charters/I2.md` |
| **I3** | kernel engineer | resident Claude | sonnet / high | **S1–S9, S11, S12** | `claude --model sonnet --effort high --append-system-prompt-file .team/charters/I3.md` |
| **I4** | submission compliance | resident Claude | sonnet / medium | **G1 G2 G4, D1 D2 D3 D5** | `claude --model sonnet --effort medium --append-system-prompt-file .team/charters/I4.md` |
| **QA** | test owner | resident Claude | sonnet / medium | **G3 G6 T4 D6** | `claude --model sonnet --effort medium --append-system-prompt-file .team/charters/QA.md` |
| **UX** | interface + storyboard | resident Claude | opus / medium | **F0–F6, D4** | `claude --model opus --effort medium --append-system-prompt-file .team/charters/UX.md` |
| **K1** | chronicler A — API | resident Claude | sonnet / medium | **none — unbudgeted overhead (§8)** | `claude --model sonnet --effort medium --append-system-prompt-file .team/charters/K1.md` |
| **K2** | chronicler B — method | resident Claude | sonnet / medium | **none — unbudgeted overhead (§8)** | `claude --model sonnet --effort medium --append-system-prompt-file .team/charters/K2.md` |

### C1's launch command — the only form of it that exists

**R-2.** `-C` is not a jail and `-s read-only` still grants full-disk read. The base
`~/.codex/config.toml` (6,416 bytes) enables a `node_repl` MCP server, `chrome`/`browser`
plugins, and `UserPromptSubmit`/`SessionStart` hooks that inject prior-session text — all of
which bypass the Codex sandbox entirely, and all MEASURED. Blindness is therefore enforced by
a **dedicated empty `CODEX_HOME`**, not by `cwd`. `$BH` is built and verified by
`tools/blind-home.sh` (node **E4**, owner L2); `$PACKET` is built by
`evals/blind/make-blind-packet.mjs` (also E4) and contains **exactly two files**,
`tools.export.json` and `tasks.md`.

```bash
CODEX_HOME="$BH" codex exec --strict-config -C "$PACKET" \
  -s read-only --skip-git-repo-check --ephemeral --ignore-rules \
  --output-schema evals/blind/rubric.schema.json \
  -o evals/blind/C1-verdict.json \
  "$(cat evals/blind/prompts/c1.txt)" < /dev/null
```

That is node **E8**'s accept predicate, copied from `graph.json`. Three parts of it are not
decoration and must never be dropped:

- **No `-p verifier`.** That home has no profile file, and `-p <missing>` exits 0 with no
  warning and silently falls back to the base config — i.e. exactly the config we removed.
- **No `-c sandbox_workspace_write.network_access=true`.** R-4: the blind verifier never gets
  the network. Every other Codex command needs it, because bare `-s workspace-write` renders
  "Network access is restricted" and cannot reach the deployed origin or run `npm install`.
- **`< /dev/null`.** MEASURED: with a non-TTY stdin, `codex exec` prints "Reading additional
  input from stdin…" and appends whatever it finds as a `<stdin>` block, silently extending
  the prompt.

There is deliberately **no short form of this command anywhere in the corpus.** The previous
revision printed `codex exec -p verifier "$(cat .team/contracts/C1-blind.txt)"` in this table
— no `-C`, no `-s read-only`, no `--output-schema`, no `--ephemeral`, and `.team/` sits inside
`outpocket`, so the roster line an operator would actually copy-paste at 03:00 ran the blind
verifier **inside the product repo with the default sandbox and full read of `src/`**. Deleting
the short form is the fix; a warning next to it was not.

Model assignment rule, stated so it can be argued with: **whoever is blocking gets the good
model.** I1 blocks everything downstream of the harness, so opus/high. I2 owns the one artifact
the judges can actually see (the tool surface), so opus/high. I3's lane is ordinary server
engineering against a frozen contract, so sonnet/high. L2 is the only seat whose output is a
*judgement* rather than a diff, and a wrong judgement is unrecoverable inside 5.5 days, so
opus/xhigh. **L1 is now seat 0, not I1** — L0 precedes every other node in the graph.

### Lane → seat, with the exceptions that are real

`G,D → I4` (except G3/G6/D6 → QA, G0/G5 → L1) · `V,H → I1` (except V6 → PM) · `T → I2`
(except T4 → QA) · `S → I3` (except S10 → L1) · `F → UX` · `L → L1` ·
`E → C4, except E4 → L2, E8 → C1, E9 → C3` · `X → C2, except X6 → C4`.

Lane E is **not** a single-seat lane and treating it as one is what let three of the four
rulers end the plan owning nothing. Its ownership is: C4 builds the harness (E1 E2 E3 E5 E6 E7
E10), **L2 owns E4** because writing a rubric and a blind-packet protocol is ruler work, not
product code, **C1 owns E8** because the blind run *is* the seat, and **C3 owns E9** because
the red-team report *is* the seat.

Exception worth naming: **V3** ("does an agent-initiated tool execute carry the page's session
cookie") looks like an S-lane question and is nonetheless owned by I1. Reason: if V3 waits for
I3's real server it lands on day 3, and a negative answer on day 3 invalidates kernel ③ with no
time to recover. I1 answers it against V5's throwaway probe origin with a cookie-echo endpoint.
The information arrives on day 0 and lane S is not on the path. Cost: the probe is not the real
server, so a positive V3 result must be **re-confirmed once** against S1 before D1 ships.

---

## 2. Communication topology, and the arithmetic that forces it

**The hard constraint: the human talks to PM, L1, L2 and off-rails only. The other twelve
seats are never addressed directly, in either direction.**

The arithmetic, taken from `graph.json.capacity` and not recomputed here:

- Sprint A is 5.5 days ≈ **132 hours** of wall clock (`capacity.wall_clock_hours`).
- Human bandwidth is **2.5 h/day → 13.75 h** (`capacity.human_hours_available`). The user's
  stated budget is 2–3 h/day; **the agreed team design says 2.5, and 2.5 is what this plan
  assumes.** §9.7 states what that costs, with the arithmetic, and what changes at 3.0.
- Human throughput is **30–50 prompts/day** → **165–275 prompts** total.

Divide evenly across 16 seats: **~52 minutes and ~10–17 prompts per seat for the entire
sprint.** That is under two prompts per seat per day. Two prompts per day is not steering; it
is not even enough to notice that a seat has drifted. An evenly-distributed org is therefore
not a slower org — it is an org with **no control loop at all**, because at that budget the
human cannot close the loop on any single seat.

So the budget is concentrated instead. Note that this table divides the **review-overhead**
share only — the 5.375 h of `0.05 × non-gated agent-hours`. The 10.5 human-**gated** hours (G1
0.5 + V1 2.0 + D4 4.0 + D5 2.0 + D6 2.0) are not steering time; they are the human doing the
work, and no channel split applies to them.

| Channel | Share of review overhead | ≈ hours | ≈ prompts | What it is for |
|---|---|---|---|---|
| **PM** | 60% | ~3.2 h | 100–165 | schedule, scope cuts, deviation verdicts the human wants to override |
| **L1** | 25% | ~1.3 h | 40–70 | "what is actually built right now", unblocking a merge |
| **L2** | 10% | ~0.5 h | 16–28 | "is this good enough to win" — the only opinion channel |
| off-rails | 5% | ~0.3 h | 8–14 | the human's own curiosity, ad-hoc questions, anything |

> **And none of this steering time falls on Day 5 or Day 6.** `capacity.schedule_A` puts 4.0 h
> of human-**gated** work on each of those two days against a 2.5 h/day figure that is a
> **total** over 5.5 days, not a per-day cap (§9.5). On those two days the human is doing the
> work, not steering it, and the twelve silent seats get **no** signal. Whatever brief they
> need for the endgame has to be issued on Day 4 or earlier.

The twelve silent seats get their entire steering signal through PM and L1. This is the price
of the design and it should be stated as a price: **a bad brief issued to I2 on day 1 will not
be corrected by the human, because the human will never read I2's output directly.** The
mitigations are W (evidence), C3 (adversarial, node E9), C1 (blind, node E8), and QA
(acceptance) — four independent detectors, none of which requires human attention to fire.
Three of the four sit in the cut ladder; see §9.8.

Machine-checkable form of the constraint: every inbound human message is logged by its
recipient seat to `.team/log/inbound-<seat>.jsonl` (the directory is an L0 output). At any
time, `ls .team/log/inbound-*.jsonl` must contain only `PM`, `L1`, `L2`. A file for any other
seat is a topology violation and W raises it as a deviation.

---

## 3. Why the two leads are ASYMMETRIC

The obvious design is two identical leads who check each other. It does not work, for a reason
that is structural rather than stylistic: **two leads on the same model with the same prompt
share their failure modes.** When both are wrong in the same direction, "mutual accountability"
degenerates into mutual confirmation, and the pair produces *more* confidence than a single
lead would while producing no more correctness.

There is live evidence for this from the parallel workstreams: a self-estimated probability was
carried forward and placed side by side with figures that had each been through an external
ruler, and nothing in the process objected, because the seat that would have objected was
calibrated the same way as the seat that produced it. Evidence grade: **OUR-ESTIMATE** — the
incident is real and is in our own artefacts, but only the 7.5% codex review figure is recorded
in `HANDOVER.md`; the others are not carried over and must not be quoted as measurements. Cite
the incident, never the numbers.

So the two leads are given **different jobs, different efforts, and different success
criteria**:

- **L1, the foreman (opus/high).** Optimises *throughput*. Bootstraps the repository (L0),
  dispatches contracts, reviews diffs, merges, and is the sole pusher to `main`. Succeeds when
  work lands. Has no authority to say the work is not good enough — only that it does not meet
  its own written acceptance predicate.
- **L2, the commissar (opus/xhigh).** Optimises *standard*. Writes **zero product code** —
  enforced by `graph.json.file_ownership`, not by good intentions. Its one node, **E4**, is a
  rubric, a prompt, a packet builder and a hermetic-home script: ruler instruments, not
  product. Succeeds when the submission would survive a hostile judge. Has no authority to
  dispatch, merge, or schedule.

Neither can do the other's job, so neither can quietly absorb the other's failure. When they
disagree, PM adjudicates; PM's tiebreak rule is written in `PM.md`.

Note the availability question this design does *not* solve: the second lead is no longer a hot
spare. Liveness is handled separately by W's stall detection (§7), not by lead redundancy.

---

## 4. Four non-overlapping rulers

Four seats measure the work. Their scales are deliberately disjoint, and each charter says so
in the second person so a seat cannot drift into another's scale.

| Ruler | Question | Instrument (node) | Passes when | Cannot say |
|---|---|---|---|---|
| **QA** | *is it done?* | G3 G6 T4 D6 | every acceptance predicate on the node executes and returns success | "this is not impressive" |
| **L2** | *is it enough to win?* | `erp/RUBRIC.md` — an **`L0` output** since R-16 | the submission survives the rubric | "this test fails" (that is QA's) |
| **C3** | *can it be broken?* | **E9** | an adversarial attempt has been made and is recorded, pass or fail | "this is not enough to win" |
| **C1** | *can a blind agent use it?* | **E8**, against E4's packet | a verdict is produced from the tool surface alone | anything about the source |

> **Closed by R-16 — this was an open item for two revisions and is no longer one.**
> `erp/RUBRIC.md` is L2's only instrument and is cited by L2's charter, by PM's escalation path
> and by this table, and it used to be produced by **no node**, which made every "cite a clause
> in `erp/RUBRIC.md`" instruction unexecutable. It is now an **`L0` output at +0.5 h**
> (`PATHS.md` §2.8; glob owner PM, writing seat L1, rule (a) beats (b)), so it is on disk before
> any seat is dispatched. **No PM ruling is owed on it and no document may go on calling it
> missing.** It was never repointed at some other file, because no other file holds the content.

A finding that lands outside your own scale is not suppressed — it is **handed to the ruler who
owns that scale**, via PM. Adjudicating cross-scale traffic is one of PM's standing jobs.

---

## 5. Why C1 must be blind — as a mechanism, not a preference

C1 is given **only** the two-file blind packet: `artifacts/tools.export.json` (node **T5**,
owner I2) and `evals/blind/tasks.md` (node **E4**, owner L2). No repo access, no source, no
README, no screenshots.

The mechanism: the judging agent — Sol in the ChatGPT desktop browser — sees exactly four
things about each of our tools: its `name`, its `description`, its `inputSchema`, and its
`annotations` (which can only ever be `readOnlyHint` and/or `untrustedContentHint`). It does
not see our source. It cannot infer intent from a variable name or a comment. A verifier that
*can* read the source will reconstruct the missing meaning from the code and then score the
surface as if that meaning were present — silently, consistently, in the direction of
over-scoring. This is not a discipline problem that a stern instruction fixes; it is an
information problem, and the only fix is to remove the information.

**And the leak that matters most is not the source — it is the answer key.** The previous C1
briefing shipped the grader a twelve-item rules block that included "descriptions must not
encode workflow order; the registration state machine is the workflow", the 500/1500-character
budgets, the iframe rule and the `Origin-Agent-Cluster` rule. Those are exactly the criteria
C1's rubric grades. A grader told in advance that missing ordering prose is intentional will
never report "I could not tell what order to call these in", which is the single most valuable
sentence C1 could produce. `charters/C1.md` now carries only rules about **what the API is** —
entry point, dead members, the two real annotations, no binary channel — and nothing about what
our surface should look like. The full rule set stays in `C2.md`, `C3.md` and `C4.md`, where the
seat is a builder and not an instrument. E4's accept enforces this mechanically: the packet
builder exits 1 if `evals/blind/prompts/c1.txt` contains any criterion the rubric grades.

Blindness is enforced by the isolated `CODEX_HOME` in §1, plus E8's three admissibility
clauses: no repo identifier appears in the verdict, the transcript shows **zero tool calls
outside `$PACKET`**, and the run banner reads `reasoning effort: low`. If any of the three
fails, the run is void and is redone from a fresh home and a fresh packet.

---

## 6. The three-layer deviation mechanism

**Layer 0 — zero-token hook.** A git hook, no model involved. Blocks the commit outright. This
is node **G4** (owner I4, cut rank 0) for the lint hook and node **G5** (owner L1, cut rank 1)
for the ownership hook; both accept predicates are in `graph.json`. G4's four checks: (a) banned
legacy WebMCP identifiers (`navigator.modelContext`, `provideContext`, `unregisterTool`,
`clearContext`, `outputSchema`, `consequentialHint`); (b) any tool `description` over 500
characters; (c) banned wording, and (d) retracted claims. It costs nothing per commit and it
catches the majority of real deviations, because most deviations are careless, not strategic.

**G4 authors `kb/webmcp/BANNED.txt`, `RETRACTED.txt` and `MECHANISMS.txt` itself.** It does not
consume them from K1. The previous revision made a cut-rank-0 hook hard-depend on a file owned
by a seat with no nodes, no hours and no day assignment; **no acceptance predicate anywhere may
hard-depend on an artifact produced by a non-node seat** (`graph.json.non_node_seats_note`).
K1 enriches those files afterwards, as overhead, and its edits are subject to the same hook.

**Layer 1 — W writes a ticket.** W is an agent, produces **evidence only, never verdicts**, and
files a fixed-format ticket in exactly four categories: scope drift, silent descoping,
unilateral interface change, discipline violation.

**Layer 2 — PM adjudicates.** Three verdicts, no fourth.

### Deviation ticket format

One file, `.team/deviations/DEV-<NNN>.md`, `NNN` zero-padded to 3. Exactly these eight fields,
in this order, each on its own line as `KEY: value` except `EVIDENCE` and `VERDICT_NOTE` which
may be blocks:

```
ID: DEV-014
OPENED: 2026-08-30T11:42:00-07:00
SEAT: I2
NODE: T2
CATEGORY: unilateral-interface-change   # one of: scope-drift | silent-descope |
                                        #   unilateral-interface-change | discipline
CLAIM: erp/contracts/violation.schema.json gained a `candidates` field without a freeze bump
EVIDENCE:
  git diff --name-only HEAD~1 | grep violation.schema.json
  sha256 before 9f2c… after 4b81…, erp/contracts/FREEZE.md still says v1
VERDICT: adopt            # adopt | send-back | debt   — PM only, blank when filed
VERDICT_NOTE: schema was under-specified at freeze; graph.json S10 notes updated, no rework
```

Acceptance predicate for the mechanism itself:
`for f in .team/deviations/DEV-*.md; do grep -q '^VERDICT: \(adopt\|send-back\|debt\)$' "$f" || echo OPEN "$f"; done`
— at any freeze checkpoint this must print nothing.

### The three verdicts

- **adopt** — *the plan was wrong, the work was right.* PM edits the authority
  (`erp/graph.json`, and `erp/PATHS.md` if a path moved) to match reality, then the documents
  that quote it. **Nothing is sent back.** The IC keeps working.
- **send-back** — PM must name (1) the specific acceptance clause that failed, (2) a rework
  deadline, (3) the branch, which L1 marks blocked. A send-back without all three is malformed
  and the IC may refuse it.
- **debt** — appended to `erp/DECISIONS.md` (node **V6**, owner PM) with the node id and a
  one-line cost. The work merges as-is. `erp/DEBT.md` does not exist and is not created; the
  decision log is the surviving consumer.

### The control-theory point (do not delete this paragraph)

**Adopt must be cheaper for the IC than send-back, or ICs learn to hide deviations.** If
declaring "I changed the interface" reliably costs more than not declaring it, the rational IC
stops declaring, W's ticket rate collapses, and the mechanism reports perfect compliance
precisely when compliance has failed. Concretely: adopt costs the IC **zero rework and zero
branch time**; PM absorbs the document edit. Send-back is used only when the acceptance
predicate genuinely fails.

The rate is itself an instrument. **A long-run adopt rate of zero means W is mis-calibrated**,
not that the crew is perfect — it means W is only filing tickets it already knows PM will
uphold, i.e. W has started predicting the judge instead of reporting evidence. PM reviews the
adopt/send-back/debt split at each daily checkpoint and tunes W's threshold. A healthy split
over a 5-day sprint is roughly one-third adopt; if it is under 10% for two consecutive days, PM
loosens W. Evidence grade: **OUR-ESTIMATE** — the one-third figure is a prior, not a
measurement, and should be replaced with the measured split from this sprint before it is
reused.

---

## 7. Merge protocol

**Branches do not reduce merge cost. They only make it visible.** What actually reduces it is
the rules below; the branch is just where they are enforced.

1. **Interface freeze precedes parallelism.** The single hard coupling in this build is
   **`erp/contracts/violation.schema.json` — SINGULAR** — between I2 (T1, T3) and I3 (S1, S4).
   `graph.json.interface_freezes` is the authority for what unblocks what; the plural spelling
   `violations.schema.json` appeared in 29 references across 7 files, matches nothing on disk,
   and is dead (`PATHS.md §1`). The freeze is node **S10, owner L1** — not I2, not I3. There
   is **one** freeze mechanism: `sha256sum -c erp/contracts/FREEZE.md`, asserted in S10's accept.
   L1 does not dispatch a downstream contract until that passes. Before the freeze, parallel
   work across that seam is speculative rework, and the plan should not pretend otherwise.
2. **File ownership.** `graph.json.conventions.ownership_rule`: a seat may write a path if
   **either** it owns a node that lists that path in `outputs`, **or** the longest-matching
   glob in `graph.json.file_ownership` names it — and **outputs beat the glob**. The old
   glob-only rule mechanically rejected 23 of the graph's own node outputs. The check is
   `node tools/check-ownership.mjs --seat <S> --files-from <file>` (node **G0**), run from a
   fixture file, never from an ambient `git diff`. `erp/OWNERS.md` does not exist and is not
   created.
3. **Branch lifetime ≤ 4 hours or ≤ 1 contract, whichever comes first.** A branch older than 4h
   is auto-flagged by W:
   `git for-each-ref --sort=committerdate --format='%(refname:short) %(committerdate:relative)' refs/heads/`.
4. **One `git worktree` per building seat.** Mandatory for C2/C3/C4 — a Codex process that
   shares a checkout with a resident session will produce diffs neither of them can explain.
   `git worktree add ../wt-C2 seat/<owner>-<node>` etc. L0 commits `erp/` (including
   `graph.json` and `PATHS.md`) so a worktree contains the plan it is briefed against.
5. **L1 is the sole pusher to `main` — and pushing is L1's STANDING OBLIGATION, not a
   one-time bootstrap gate.** The rule has two halves and only the first was ever written
   down; the missing half is what created the push knot (R-26, confirmation NEW-1).

   **(a) Permission.** `git push` is **L1's, and only L1's**. No other seat runs it. The
   charters' "Never `git push`" lines are a **restriction on the other fifteen seats**, never
   a prohibition on L1. Checkable after the fact: `git log main --format='%cn' | sort -u`.

   **(b) Obligation — R-26(b). L1 pushes on EVERY merge to `main`.** A merge is not complete
   until `origin/main` carries it. Concretely, the last two steps of every merge L1 performs
   are:

   ```
   git push origin HEAD:main
   test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | cut -f1)"
   ```

   Both must succeed before L1 records the merge in `.team/log` or releases the seat.

   **Why this is a rule and not a nicety.** L0 pushes a tree that deliberately contains one
   known failing test (`auditor surface: read-only by construction`), which **T6** fixes on
   Day 1. **G3** (Day 1, cut 0) clones `origin/main` and requires **zero** failures. If L1
   merges T6 and does not push, `origin/main` still carries the red tree, G3 fails, and the
   only `git push` anywhere in the graph has already run. The old text made L0's gate (6) read
   as the *only* push that is ever permitted; it is the *first* push, and every merge after it
   carries the same duty. **G3 now takes a hard input from T6 for exactly this reason** — see
   `graph.json` and R-26(c).

   **Corollary for the other fifteen charters:** "Never `git push`" means *you* never push, so
   ask L1 to merge; it never means "this repository is not pushed". Any seat blocked on a
   change reaching `origin` escalates to L1, and L1 pushing is the normal answer, not a
   deviation.

### C2's ownership carve-out

C2 is a build arm loaned into another seat's lane. Its commits therefore land on the **owning
seat's branch**, and the **owning seat signs off** before L1 merges. Ownership binds
*branches*, not keystrokes. Stated explicitly so nobody reports C2 as a permanent ownership
violation.

### The closing ritual

**A task cannot be closed without a five-field pit entry appended to the knowledge base.** This
is the only new ceremony in the whole design, and it is hung on the merge gate that already
exists, so it costs one paragraph per merge.

Appended to `kb/pits/<node-id>.md`:

```
TRIED:      what you attempted
HAPPENED:   what actually happened, with the measurement
CHANGED:    what you did instead
EARLIER:    the cheapest signal that would have caught this sooner
GRADE:      MEASURED | PUBLISHED | VENDOR-CLAIMED | OUR-ESTIMATE | UNVERIFIED
```

**"No pit" is a legal entry** — `TRIED: node T6 as written. HAPPENED: worked first attempt.
CHANGED: nothing. EARLIER: n/a. GRADE: MEASURED.` Making the null entry legal is what keeps the
ritual honest; if the only acceptable entry were a war story, seats would invent war stories.

Merge gate predicate: `test -f kb/pits/<node-id>.md` and the file contains all five keys. L1
does not merge without it.

> **Named cost.** `PATHS.md §2.8` records `kb/pits/<node-id>.md` as *merge ritual, unbudgeted* —
> it is produced by no node and no seat's hours carry it. It is one paragraph per merge and it
> is deliberately kept, but it is overhead, not budgeted work, and if the schedule bites it is
> PM's to drop by ruling rather than by silence. The same is true of `.team/deviations/DEV-*.md`,
> `.team/log/inbound-*.jsonl`, `.team/stalls.md` and the 68 `.team/contracts/<node>.txt` briefs
> L1 writes. L0 creates the directories; nothing budgets the writing.

---

## 8. W, K1, K2 — the three seats that own no node

`graph.json.non_node_seats` names **W, K1 and K2**. They own no node, no output path and no
hour, and they appear in no total. **They are explicitly unbudgeted overhead, not idle
rulers.** This is stated plainly rather than papered over, because the previous revision let
three of them appear in the roster owning nothing while a cut-rank-0 acceptance predicate
hard-depended on K1's output. The rule that prevents a recurrence: **no acceptance predicate
anywhere may hard-depend on an artifact produced by a non-node seat.** G4 authors its own
banned-wording files (§6); W's tickets gate nothing mechanically; K1/K2's KB gates nothing
mechanically.

They are kept because they are cheap and because their failure mode is expensive:

**W** is Layer 1 of the deviation mechanism and the only liveness detector. Its output is
evidence, never verdicts.

**K1 / K2 — the chroniclers.** Wrong shape: wait until the end, read the finished repo, extract
lessons. Right shape: maintain a structured KB incrementally *during* the run, and **compile it
into a skill at the end**. The reason is specific and is the whole justification for spending
two seats on it: **failed attempts are unrecoverable from finished code.** Reading
`worker.terminate()` in a final diff will never tell you that it is there because
`iframe.remove()` leaves an orphaned renderer spinning at ~100% CPU for 9.51 / 9.98 / 10.04
seconds before the browser reclaims it. That measurement exists only in the moment it was
taken. If it is not written down that day, it is gone, and the next project pays for it again.

**Input is the deviation ledger, not raw transcripts.** A ticket adjudicated *adopt* is already
a complete pit record: it names what was planned, what was actually done, why the plan was
wrong, and it is short. Subscribing to transcripts instead would drown both seats in tokens and
produce worse records. K1/K2 additionally read `kb/pits/*.md` from the merge gate, and nothing
else.

- **K1 — WebMCP API knowledge base** → `kb/webmcp/**`. Day-0 seed: the **sixteen** iron rules
  of `HANDOVER.md` §3 and the **fourteen** of `gatehouse/BUILD.md` §2 (its items are numbered
  1–14 but printed out of order — item 12 appears last, which is where "twelve" came from).
  Each rule carries its own grade; most are MEASURED, but the ≤500-char / ≤1500-char budgets
  are PUBLISHED official *guidance*, not enforcement, and the spec-change dates are PUBLISHED.
- **K2 — method and measurement knowledge base** → `kb/method/**`. Day-0 seed:
  `kb/method/BANNED-CITATIONS.md` (an **L0** output that K2 then maintains) — why WindTunnel
  and arXiv 2508.09171 are unciteable; the screenshot-token patch formula; pre-registration
  effect sizes are 2–4× not 20×; Wilcoxon needs n≥6; the unit of analysis is the task variant;
  and the meta-lesson of HANDOVER §7 — *a keyword-derived "empty cell" is a vocabulary artefact
  until it has been re-tested at the concept level.*

Compilation at the end is a **separate one-shot opus/xhigh run**, not the resident sonnet
seats. Synthesis is a different job from stenography and should not be done by the model that
was chosen for cheap continuous note-taking.

Soft acceptance, non-gating by construction: `test -s kb/webmcp/BANNED.txt` (G4 guarantees it
exists), and at freeze `ls kb/pits/*.md | wc -l` equals the number of nodes marked done in
`erp/graph.state.json` (node **G0**).

---

## 9. Honest limitations

1. **An agent cannot open a new terminal window.** It can wake an idle session, or shell out to
   a headless `claude -p`, but a genuinely dead resident session **needs a human to restart
   it**. This is the design's sharpest single point of failure, because §2 spends 95% of human
   review attention on three seats — so a dead I2 could go unnoticed for hours. Mitigation, not
   a fix: W polls liveness and reports stalls to PM, and PM has standing authority to have L1
   dispatch the stalled node to C2 instead. The restart itself still needs the human.
2. **Twelve seats never hear from the human.** A brief that was wrong at dispatch stays wrong
   until a ruler fires. Accepted cost, named in §2.
3. **W's calibration is unmeasured.** The one-third adopt-rate target is **OUR-ESTIMATE**,
   carried over from nothing. Treat the first two days as calibration, not as evidence about
   the crew.
4. **The Codex profiles do not exist yet, and the obvious probe cannot tell you so.** All four
   `-p` launch commands are inert until `~/.codex/{verifier,builder,redteam,evaluator}.config.toml`
   are written by **L0**. Grade: **UNVERIFIED**, and it stays UNVERIFIED until L0's clause (4)
   runs — existence, `tomllib` parse, and `grep "reasoning effort: <level>"` on the banner
   (R-3). `codex exec -p <name> 'print ok'` returning is **not** evidence: MEASURED, it returns
   identically when no profile file exists at all, and the consequence is that C3 and C4 could
   run at `medium` for the entire sprint with every result file still green.
5. **The human-gated hours are not spread evenly, and two consecutive days blow the daily
   budget.** The 2.5 h/day figure is a **total over 5.5 days**, not a per-day cap, and
   `capacity.schedule_A` makes that visible: **Day 1 carries 2.5 h** (`G1` + `V1`), **Day 5
   carries 4.0 h** (`D4`) and **Day 6 carries 4.0 h** (`D5` + `D6`); the other four days carry
   zero. No rank of the ladder touches it — all five gated nodes are cut 0 — so the only levers
   are the user planning two half-days of attention or PM shortening `D4`'s scope. That is a
   **D-17-scope decision on Day 0**, and it is recorded in
   `capacity.human_hours_are_budgeted_in_total_not_per_day`.
6. **Sixteen resident sessions is more concurrency than has ever been run here.** If the
   machine cannot hold them, the **seat** amputation order is K2 → K1 → W → C2, with their
   duties folding into PM (K1/K2/W) and the owning IC (C2). This is separate from the **node**
   cut ladder, which lives in `graph.json.cut_ladder` and is the only ladder in the project —
   `RISK.md`'s 10-rank ladder is deleted, not deprecated. Triggers name **node ids**, never
   rank numbers: write "Cut X1–X6", never "Cut rank 4".
7. **The human budget decides whether the crew is cut, and the arithmetic is half an hour per
   day.** From `graph.json.capacity`, not recomputed here:

   ```
   human-gated (G1 0.5 + V1 2.0 + D4 4.0 + D5 2.0 + D6 2.0)      = 10.500 h   [all cut 0,
                                                                               IRREDUCIBLE]
   review overhead = 0.05 x 107.5 non-gated agent-hours          =  5.375 h
                                                          required = 15.875 h
   available at 2.5 h/day x 5.5 days                              = 13.750 h   short by 2.125
   available at 3.0 h/day x 5.5 days                              = 16.500 h   spare  0.625
   ```

   **At 2.5 h/day the full graph does not fit.** The first rank that fits is **ranks 1–3
   fired**, at 13.475 h required with 0.275 h spare — less than one video re-shoot. That deletes
   **27 of the 62 horizon-A nodes**, named exactly in
   `graph.json.capacity.human_budget_sensitivity.amputation_set_if_2.5_holds`:
   V0 G5 G6 T4 D2 D3 F6 E5 · T3 T5 F3 F5 E1 E2 E3 E4 E6 E7 E8 E9 E10 · V2 V3 V4 S7 S8 F2.
   **At 3.0 h/day nothing needs cutting.** This is a PM decision on Day 0, logged as D-17 in
   `erp/DECISIONS.md`, taken before any seat is dispatched — not discovered on Day 4.
8. **Cutting ranks 1–3 is a governance change, not only a scope change.** It deletes E4, E8 and
   E9 — so **C1 and C3 stop being rulers**, and four rulers become two: QA measures done, L2
   measures enough-to-win, and nobody measures whether a blind agent can drive the surface or
   whether an adversary can break it. §2 names those four detectors as the whole mitigation for
   twelve seats the human never speaks to. PM must say this out loud when firing rank 2.
9. **The ladder cannot rescue the schedule.** `capacity.ladder_does_not_shorten_the_schedule`:
   every node on the critical path is cut rank 0, so graph depth is **29.0 h after every rank**
   — the ladder shortens the path by exactly zero and frees exactly zero human-gated hours. It
   is a pure review-overhead instrument. If the deadline is the problem, cutting is the wrong
   tool and scope must come out of D4/D5/D6, or the deadline moves.
10. **The whole crew is scaffolding for a submission the judges may never run.** The contest
    rules permit judging from the text, images and video alone. No amount of process quality
    substitutes for D4. If a choice must be made between crew discipline and the video
    shipping, the video ships.
