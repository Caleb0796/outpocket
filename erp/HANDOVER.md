# HANDOVER — for the session that picks this up after a compaction

Written 2026-08-29 ~01:30 PT. **Read this, then `erp/README.md`, then stop reading
and start working.** Everything below was established by execution, not by
reasoning. Do not re-derive any of it.

Deadline **2026-09-03 13:00 PT** — about **5.4 days** from this writing.

---

## 0. One line

The plan is finished and executable; **all five unknowns are answered on a real
remote HTTPS origin**, and a sixth was discovered. No product code exists yet.
The next action is Day 0 (`L0` + `V5`), and `V5` is **already done**.

---

## 1. What exists right now

| | |
|---|---|
| `Caleb0796/outpocket` | **PRIVATE**. The product + the plan in `erp/`. HEAD `fdc1671`, clean tree, pushed. |
| `Caleb0796/webmcp-probe` | **PUBLIC**. The throwaway probe. Contains no product content — the name was scrubbed before publishing. |
| `Caleb0796/webmcp-dev-kit` | PRIVATE. README + LICENSE only. **A parallel session left uncommitted work in `docs/`** — not mine, left alone. |
| `Caleb0796/webmcp-eval-kit` | PRIVATE. README + LICENSE only. |
| **https://webmcp-probe.onrender.com** | **LIVE**, Render free tier. Spins down when idle; first request after a nap takes ~50 s. `curl` it once to wake it before any test. |

`erp/` is 49 files, ~22,450 lines. `graph.json` is **v2.5.1**: 68 nodes, 120
edges, **39 rulings** — R-43 landed the measured unknowns, **R-44 repaired R-43**
after an adversarial review found two blockers in it.

---

## 2. The five documents that matter, in order

1. **`erp/README.md`** — the map. Says which two files are authorities and why.
2. **`erp/graph.json`** — **AUTHORITY** for node identity, owner, hours, cut rank, `accept`.
3. **`erp/PATHS.md`** — **AUTHORITY** for every literal path and command name.
4. **`erp/RUNBOOK.md`** — how to actually run the agent team. Written for a first-timer.
5. **`evidence/UNKNOWNS.md`** — what the browser actually does. Newest and most valuable.
   *(Repo **root**, not under `erp/`. `erp/PATHS.md` §2.7 is the authority on that; the
   `erp/evidence/…` form that used to sit here was wrong.)*

Everything else (`PLAN`, `GRAPH`, `TEAM`, `EVAL`, `RISK`, `FACTS`, `CONTRACTS`,
`RUBRIC`, the 16 charters) is a **checked restatement**. Where a restatement and
an authority disagree, the authority wins and the restatement is regenerated.

**The single most expensive lesson in this project's history:** seven writers
worked in parallel and each held a private copy of the node table. It cost five
repair rounds. **If you fan work out, freeze the authority first and regenerate
siblings from it — never in parallel with it.**

---

## 3. MEASURED — the browser facts, all first-hand

ChatGPT desktop built-in browser · model **5.6 Sol** · **Chromium 151**
(*not* the 152 the plan anchors to; your standalone Chrome is 152).

| id | verdict | consequence |
|---|---|---|
| **V0** | `navigator.modelContext` **absent** | The 150 removal holds. |
| **V1** | **PRESENT** — on `https://webmcp-probe.onrender.com` | The agent listed all five tool **names** on a brand-new remote origin the account had never visited. `evidence/V1-remote.json` records names, **not descriptions and not executions**; the one execution on record is `probe_whoami`, after approval. The plan's worst case — judges see a page with zero tools — was not observed. |
| **V2** | **refreshes** *(localhost)* | A tool registered at runtime reached the agent with no page reload. Demo beat 1 works on camera. Keep the narration at "on its next turn". |
| **V3** | **same-session** *(localhost; confirmed remote in `V6-consent-gate.json`)* | `cookiePresent: true, cookieMatches: true`. Kernel ③ survives; **`contingencies[2]`** does NOT fire and `[3]` fires *for the cookie conjunct only* (R-44 — a previous revision said `[0]`, which is the V1 branch); S1 stays 2.5 h. **It measures cookie carriage and nothing about DOM read access.** |
| **V4** | **times out at 22,267 ms** *(localhost, **run 1 of 2**)* | `Timed out running CDP command "Runtime.evaluate"`. Enough to make the handshake the **conservative default**; not enough to close the node. `contingencies[4]` is *provisionally selected, not fired* (R-44). |
| **`V6-consent-gate`** | **consent gate, remote only** | NEW. See below. **Always write the suffix** — bare `V6` is a *node id* (`graph.json.id_collision_warnings`, R-43). |

### V4 changes a design — act on it

Nobody reviews and signs a report in 22 seconds. **`S5` ships the two-call
handshake**, not suspend-until-signed. `RISK.md` already required S5 to be
written with both modes behind one switch, so this is a switch position, not a
rewrite. Do not let a seat "discover" this on Day 4.

### `V6-consent-gate` is the finding localhost could not have produced

On a **remote** origin this client **blocks an agent-initiated cookie-bearing
request pending action-time human approval**. Verbatim:

> `probe_whoami` may transmit the browser's session cookie to
> `webmcp-probe.onrender.com`, so the browser blocked it pending action-time
> approval. Do you authorize that cookie-bearing request?

The identical call on `localhost` ran with **no prompt**. It cuts both ways:

- **Against the demo** — every cookie-bearing call on a real origin may cost a
  human approval. **Beat 2 must script it**, not be ambushed by it, and the
  rehearsal must run on the **remote** origin: localhost shows no prompt at all.
- **For the sign gate — NO CREDIT. R-44 withdrew the sentence that used to sit
  here** (*"residual risk is materially smaller than the contracts layer states"*).
  One observation does not show every cookie-bearing call prompts, an approval
  click is not a review, and this server cannot detect, require, or fall back on a
  client policy. A disclaimer printed after a reassurance does not undo the
  reassurance, so the reassurance is deleted rather than qualified. **The residual
  risk is exactly what the contract states.**

**Overclaim guard, non-negotiable:** this is a *client policy*, not a server
guarantee and not a browser invariant. Another client, a future version, or a
user who approves reflexively all defeat it. D-19's provable sentence is unchanged.

---

## 4. Environment facts that cost real time to establish

- **`claude auth status` every day.** CLI auth expires independently of the
  desktop app. A seat that cannot authenticate **boots fine and reports `idle`** —
  the error appears only in its own log. A *working* seat reports `busy`/`working`.
- Launch flags are all real: `--model`, `--effort` (`low medium high xhigh max`),
  `--append-system-prompt-file`.
- **There is no `claude send`.** Operating model (R-37/R-38): boot every seat
  `--bg -n <SEAT>` **with its task as the positional prompt** — the boot line *is*
  the dispatch. `claude attach <id>` continues an existing seat. `claude agents
  --json` is the roster and the only liveness instrument.
- **W cannot self-poll** (R-39). An agent has no timer and cannot open a terminal.
- **`codex exec -p <missing-profile>` exits 0 silently** at the base config's
  effort. Grep the run banner for `reasoning effort: <level>`, never the exit
  code. **Zero profiles exist yet** — `L0` creates them. A `[profiles.<name>]`
  table inside `<name>.config.toml` silently fails; use flat top-level keys.
- **ChatGPT built-in browser opens with `⌘T`** (View ▸ Browser ▸ Open Browser
  Tab). *Not* `Cmd+Shift+B` — that carried-over shortcut is wrong.
- ChatGPT → Settings → Browser → Permissions → **Enable site tools** is ON, and
  **Site permissions is an override list on a permissive default, currently
  empty**. It does **not** need populating for a new origin.
- Each ChatGPT chat has its **own browser session** — a new chat starts with an
  empty tab list.
- **Render's first-run onboarding overlay bounces you back** to the service
  chooser, even from a direct `/web/new` URL and even after clicking Skip. Enter
  via the overlay's *own* "New Web Service" link. **This is why the service
  appeared created but was not.**
- Render↔GitHub was **already connected** (`Credentials (1)`, sees private repos).
- Render behind Cloudflare does **not** inject `Origin-Agent-Cluster: ?0`.
- **$50 "Hackathon Participant" credit**, unspent, valid to 2027-07-31. Prefer the
  **paid** instance for `D1` (the product) so the 15-minute free-tier sleep does
  not bite across the 9/04–9/21 unattended judging window. Free is fine for the
  probe. No card is on file; whether credit alone suffices is **UNVERIFIED**.

---

## 5. Decisions closed this session — do not reopen

- **D-17 = 3.0 human-hours/day.** 16.5 available vs 15.875 required, 0.625 spare,
  **nothing is cut**, all 62 horizon-A nodes stay in scope. The 2.5 branch and its
  27-node amputation set survive as a *contingency*, re-keyed to fire on the
  ruling not being met in practice.
- **D-30 / R-42: `G1` (flip repos public) moved to Day 6**, immediately before
  `D5`. The contest needs a public repo *at submission*, not during the build.
  MEASURED: a private repo clones fine when the CLI is authenticated, so `G3`
  needed the *push*, not the *visibility*; the `G1→G3` edge is deleted.
  **The G1 rehearsal is already DONE** — creating `webmcp-probe` ran G1's accept
  predicate verbatim and got `public mit`. Account can create public repos, no org
  policy blocks it, About-box license populates. See `evidence/G1-rehearsal.json`.
- **R-37..R-41** — the operating model, W's non-polling, PM/L1 booting from
  `erp/charters/` on Day 0, and the token quota as a named constraint.

---

## 6. Open, and what I would do next

**The three queued doc edits are LANDED**, 2026-08-29, under ruling **R-43**
(`evidence/V6-consent-gate.json` → `docsUpdated` carries the full change list).
They grew in the doing, and the reasons are worth carrying:

- The sweep found that **`V2`, `V3` and `V4` were still written as *open unknowns*
  in ten live files** while §3 above called them measured. Every one is now in the
  present tense. `erp/reviews/` is deliberately untouched — those are records of
  what was known on their date.
- **`S5`'s accept** now tests the handshake arm and keeps `suspend` as the switch's
  other position and the node's own negative control. It also states, so nobody
  records it as a win, that the handshake is **not** a mitigation of the surviving
  forgery: withholding the digest from the tool *result* does not withhold it from a
  caller who can `GET /api/sign/{request_id}`.
- **Two id collisions and one wrong path** were found and fixed: the finding is
  `V6-consent-gate` because bare `V6` is a node id, and `evidence/UNKNOWNS.md` lives
  at the repo **root** — the `erp/evidence/…` form in this file and in the evidence
  JSON was wrong against `PATHS.md`.
- Landed **before `S10` freezes `erp/contracts/` on Day 1**. After that freeze the
  same edit costs a deviation ticket, a re-recorded sha256 and a PM adopt ruling.

**Still open on the unknowns:** `V4` is **run 1 of 2**. Its own accept wants two
independent runs compared at 20% tolerance. The reading is decisive enough to have
moved the design; the *node* is not passed until run 2 exists.

**Then Day 0.** It is now just `L0` — `V5` is done and live.

**Watch the token quota.** The weekly allotment reset 2026-08-29 08:00 PT and does
**not** reset again until ~09-05, *after* the deadline. The whole sprint runs on
one allotment. Codex seats draw on a **separate** pool — an argument for pushing
build and eval work to C2/C4, which matches the user's own instruction that eval
is mainly Codex. If short: drop effort tiers before dropping seats, and **never
re-run a finished adversarial review**.

---

## 7. Do not redo

- **No new web research.** `WebSearch`/`WebFetch` are forbidden for sprint work.
  Four rounds are banked in `FACTS.md` and `~/mcp/countinghouse/HANDOVER.md`.
- **Do not re-propose the killed directions** in `RISK.md` — customs, insurance,
  permits, prior auth, IT tickets, and the eight original angles.
- **Never write a claim from `RISK.md`'s banned table.** The corpus is currently
  clean: every occurrence of `structural guarantee`, `16 rules`, `eight frozen
  schemas` and `violations.schema.json` is a retraction or a ban row.
- **No emptiness or novelty claim from a keyword count.** This project has been
  wrong about that three times. A concept-level re-test with three vocabulary
  variants must be *recorded* before such a sentence may be written.
- **Five adversarial reviews are archived in `erp/reviews/`.** They are why the
  claims are narrow. Read them before arguing a claim is too modest.

---

## 8. The user

Chinese-speaking; wants real measurement, not impressions, and every claim graded.
Documents exist **to be picked apart by experts** — self-disclosing a weakness
beats having it found. They push back well: the `G1` reschedule happened because
they challenged a decision the plan had closed, and **they were right**. Take that
seriously rather than defending the plan.
