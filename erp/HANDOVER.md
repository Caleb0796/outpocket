# HANDOVER — for the session that picks this up after a compaction

Rewritten 2026-08-29 08:30 PDT, mid–Day 1. **Read this, then `erp/README.md`, then stop
reading and start working.** Everything below was established by execution.

Deadline **2026-09-03 13:00 PT** — **4 days 4.5 hours** from this writing.

---

## 0. One line

Day 0 is closed and **eleven nodes are merged**. The agent team runs itself: `L1` boots
a seat the moment a merge unblocks its node, unprompted. What still needs a human is §6.

---

## 1. State

`origin/main = ea43c13`, local synced, working tree clean. **`erp/contracts/` is FROZEN**
(`S10`, ten-file sha256 manifest) — an edit now costs a deviation ticket, a re-recorded
hash and a PM verdict.

**Merged** — `.team/log/merges.txt` is the record, one line per node with sha and pit:
`L0 V5 T6 S10 S11 G4 V0 G3 G0 T1 G5`

**Day-1 still open:** `F0` `G6` `H1` `S1` — all committed on their seat branches,
awaiting L1's gate · `H2` waits on `H1` · **`V1` is yours, see §6**

**Main is green on every instrument.** All of these were run against the MERGED tree in a
detached checkout, not on anyone's branch — twice today a node passed in isolation and
went red after merging:

```
npm test                               40 / 40 / 0
tools/lint-layer0.mjs                  exit 0
tools/ready.mjs --check-cuts           exit 0
             --check-accept-paths      exit 0   (0 unresolved)
             --check-tables            exit 0   (16 node tables, 2 day tables, 145 rows)
             --path                    29.5 h == capacity.graph_depth_hours
sha256sum -c erp/contracts/FREEZE.md   exit 0
```

---

## 2. Seats

Nine live: `L1 I1 I2 I3 I4 QA UX PM W`. The roster and the only liveness instrument is
`claude agents --json --cwd /Users/calebwei/mcp/outpocket`.

> **`I1` is `waiting/blocked` on an interactive selection menu.** That state needs a
> **keypress**, and `SendMessage` cannot deliver one (§4). Either
> `claude attach 20427ad3` → choose → `Ctrl+Z`, or stop/rm/re-boot with the decision
> written into the prompt. **Read §3 before any `rm`.**

---

## 3. THE ONE THAT DESTROYED WORK — read before touching any seat

**`claude rm` deletes the seat's worktree along with its job state.** L1 ran
`claude stop` + `claude rm` on `UX` while it was **`busy/working`**;
`docs/STORYBOARD.md` and `docs/VIDEO-SCRIPT.md` were uncommitted in that worktree and
went with it. One hour of `F0`, paid twice. Every other seat cycled that day was
`idle/done` — the safe case — and the same two commands were applied to the one that
was not.

**Rule, in `kb/pits/G5.md`: never `claude rm` a seat that is not `idle/done`, and read
the status in the same breath as the stop.**

The watcher at `scratchpad/watch-day.py` now records each worktree's uncommitted file
count every poll and shouts when one vanishes dirty. **That count is the only warning
this failure ever gives.**

---

## 4. Measured facts about the mechanism

- **`SendMessage` continues a seat** that is `idle/done` or `idle/blocked` — measured
  three times; it wakes and works. **It cannot answer a menu**: the text lands in the
  input line while the menu holds focus and the seat sits at `waiting/blocked`.
- **Seat states mean three different things.** `idle/done` = finished ·
  `idle/blocked` = answered, awaiting input · `waiting/blocked` = a menu is up. And a
  seat that cannot authenticate boots fine and reports `idle` — the discriminator is its
  node's `outputs` on disk, or
  `claude logs <id> | sed $'s/\x1b\[[0-9;?]*[a-zA-Z]//g' | grep -o -i 'login expired\|not logged in'`.
- **`FORCE_COLOR=3` is injected into every seat.** Any accept predicate that greps a
  *colourising* tool's output fails inside a seat and passes in a bare shell.
  `tools/accept-gate.mjs --run-clean` is the remedy.
- **Seats work in `.claude/worktrees/*`, and `L1` also switches the PRIMARY tree's
  branch.** A watcher that looks only at the main path sees nothing and reports a stall
  while the sprint is productive. Label trees by **checked-out branch**, never by path.

---

## 5. Rulings that bind everyone

- **D-38 — a figure goes into a message only if a command printed it in this session and
  the seat can point at the line.** L1 had sent a measurement derived by reasoning from a
  real run instead of executing the patched mode. PM: *Day 0's `FORCE_COLOR` pit with the
  sign flipped — there an observation with an invented explanation, here an explanation
  with an invented observation.*
- **D-39 — `W` filed zero tickets across a seven-merge day; PM ruled that an instrument
  failure, not a clean crew.** Every deviation caught that day was self-disclosed or
  found by a peer sweep. Brief restated: **file on the evidence, never on the
  significance.** W has since filed nine (`DEV-001`…`DEV-009`).
- **D-37 — a node's `outputs` lists what it AUTHORS.** Putting a file under version
  control is a git act, not authorship.
- **R-42/D-30 — `G1` (flip repos public) is DAY 6.** It has no inputs, so it is ready on
  hard edges from the start; the **schedule**, not the ready set, governs it. Sixteen
  documents placed it on Day 1 and all sixteen are now fixed or annotated. **If a ready
  set hands you `G1`, that is the one node where acting on "ready" is irreversible.**

---

## 6. What needs the human

1. **`V1`, 2.0 h, human-gated, yours.** Open `https://webmcp-probe.onrender.com` in the
   **ChatGPT built-in browser** (`⌘T`), confirm `document.modelContext` and that the
   agent sees five tools, and **capture `evidence/V1.png`** — the node has a reading but
   has never passed, because the PNG does not exist and QA's gate compares the screenshot
   to the JSON. **`curl` the origin first to wake it**: Render's free tier sleeps, a cold
   start took 12.3 s, and a sleeping origin produces `documentPresent:false` —
   shape-indistinguishable from a real finding about the browser.
2. **Day 5 needs 4.0 h of your attention, Day 6 needs 4.5 h, against the ruled
   3.0 h/day.** All five human-gated nodes are cut 0, so no rung of the ladder frees any
   of it. Two levers: plan two half-days, or shorten `D4`'s scope. **Undecided.**
3. **The deviation enum has no member for "withdrawn by the raiser, nothing asked".**
   `[adopt, send-back, debt]`. `DEV-L0-gate4-banner-grep` is closed and asks nothing, so
   PM's checkpoint grep prints OPEN on it every checkpoint for the rest of the sprint.
   Stamping it would record a false verdict to buy a quiet grep. **Yours to rule.**

---

## 7. Open, not blocking

- **`T1`'s `check-toplevel` is checked once, before it can fail.** `T1` is the only
  accept that invokes it; `T2` — where `registerTool` call sites first appear — mentions
  it zero times; and `T1`'s clause does not pass `--selftest`, so the tool's own vacuity
  arm never runs. Candidates for PM: add `--selftest` to `T1`; add the clause to `T2`.
  **Do not "fix" it by failing on zero call sites** — a zero is legitimate today and the
  tool already distinguishes a real zero from an unexamined one.
- **`erp/FACTS.md:1148`** asserts the deleted `G1 → G3` edge; the retraction is 250 lines
  away at `:1404`.
- **`.githooks/pre-commit` does not chain to `pre-commit-ownership`,** so the ownership
  hook never runs — git invokes hooks only by canonical name. L1 proved it by committing
  a file it may not write and watching it succeed. In `kb/pits/G5.md`.

---

## 8. How to be useful here, and how this session was wrong

What a monitoring session actually catches, it catches by **running the accept predicate
against the merged tree** rather than the seat's branch. Twice today a node was green in
isolation and red on main; once the merge gate itself went red after `G4` merged and
blocked four verified nodes.

**Six times this session reported something that did not survive checking.** One shape
every time: measure, conclude, never test the conclusion.

- a `localeCompare` "violation" that was a comment stating the ban
- "V0 has no pit" — checked the wrong path
- "pit gaps are systemic, 2 of 3" — actually 1 of 4
- "the lint does not catch violations" — the probe file was untracked
- "the pit exclusion is safe" — a staged probe had contaminated the tree
- **"`T1`'s clause is VACUOUS"** — the tool has a section headed VACUITY and that guard
  is the most careful thing in the file. The word reached `main`'s commit message and
  PM's escalation before the correction caught up (`ea43c13`).

The last is the worst and is different in kind: the first five were flawed tests, that
one was **judging code without reading it**. An exit code tells you the result, not the
intent.

`kb/pits/L0.md` carries the sentence it all reduces to, and it is L1's:

> **Confirming an observation three ways is not the same as testing the explanation once.**
