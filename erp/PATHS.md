# PATHS.md — the filesystem vocabulary

**Status: AUTHORITY.** This file and `erp/graph.json` are the only two authorities in the
project. `graph.json` owns node identity, ownership, hours and cut rank. **This file owns
every literal path, filename, artifact name and command name.** Every other document quotes
this file and never restates it.

Generated from `erp/graph.json` on 2026-08-28, revision **v2.3.0**. Every table column is
copied from that file, not re-derived. If a row here disagrees with `graph.json`, `graph.json`
wins and this file is regenerated. `node tools/ready.mjs --check-tables` (G0) proves the
agreement mechanically; a restated table anywhere in `erp/` is legal only while that check is
green.

### The three columns, and why there are three

Every master table now carries **two owner columns instead of one**, because the single
`Owner` column it used to carry was the **glob** owner and it disagreed with the seat that
actually writes the file. **RECOUNTED for v2.3.0, and the published figure reproduced neither
half: this file's §2.1–§2.9 master tables hold 166 rows, not 157.** Of those, **150 carry two
plain seat names in the two owner columns** and **57 of those 150 disagree**. The other 16 rows
carry a `—` or a parenthetical in the Writing-seat column — pre-existing files, the merge ritual,
the two files `L0` commits without authoring — and are not seat-vs-seat comparisons at all;
counting them as disagreements is what gives the looser figure of 73. **The measured numbers to
quote are 166 rows / 150 comparable / 57 disagreeing**, counted by script over the nine §2.x
tables with the nine header rows excluded, one per section. Four of the 57 are new in v2.3.0 and
are corrections, not drift: `src/page/sign-bridge.js`, `tools/blind-home.sh`,
`evals/blind/C1-verdict.json` and `evals/redteam/report.md` each had the **writing** seat copied
into the **Glob owner** column, so they read as agreeing when the longest matching glob in
`graph.json.file_ownership` in fact names UX, L1, L2 and C4. All four writes stay legal under
rule (a); only the column was wrong. The Glob-owner column is now **0 rows** out of agreement
with `file_ownership`, checked by script. A reader could not tell whether a disagreement was a defect or the rule working as
designed.

| Column | What it is | Where it comes from |
|---|---|---|
| **Glob owner** | the seat named by the longest matching glob | `graph.json.file_ownership` |
| **Writing seat** | the seat that actually writes the file | the `owner` of the **producing node** |
| **Producing node** | the node whose `outputs` list this path | `graph.json.nodes[].outputs` |

**They are allowed to differ, and when they do the Writing seat wins.**
`graph.json.conventions.ownership_rule` says a seat may write a path if *either* it owns a
node listing that path in `outputs` **(a)**, *or* the longest matching glob names it **(b)** —
and **(a) beats (b)**. So `tests/acceptance/session.test.mjs` has glob owner QA and writing
seat I3, and I3 writes it legitimately, because S1 lists it. `erp/RUBRIC.md` has glob owner PM
and writing seat L1, because L0 produces it. The glob-only rule these rows used to be read
under mechanically rejected 23 of the graph's own node outputs.

A `—` in **Writing seat** means no node produces the file: it is either pre-existing on disk
(the contract files in §2.4) or carried in unchanged.

---

## 0. Why this file exists

Seven writers worked in parallel against a shared skeleton and each ended up holding a private
copy of the filesystem. The result was **two incompatible vocabularies with zero overlap** for
the front end, the policy document, the curl tests, the storyboard, the deploy artifacts and
the hook directory:

- The graph, the ownership matrix and every executable acceptance predicate say
  `src/page/**`, `src/policy.js`, `tests/acceptance/**`, `docs/STORYBOARD.md`, `evidence/**`.
- All sixteen charters brief their seats on
  `web/**`, `policy/**`, `tests/curl/**`, `submission/storyboard.md`, `harness/findings/**`.

Every seat was briefed against a tree the enforcement tooling had never heard of. The
ownership checker would have classified every single I2 commit as unowned, and the first
commit of the sprint would have been an ownership violation.

**The rule from here on: if you need a path, copy it out of this file. Never type one from
memory, and never invent a parallel spelling because it reads better in prose.**

---

## 1. The one rename that had to happen before anything froze

> `erp/contracts/violations.schema.json` **does not exist and never will.**
> The file on disk is **`erp/contracts/violation.schema.json` — SINGULAR.**

The plural spelling appeared in **29 references across 7 files**: the accept predicates of
T3, S4, S10 and X2; three edge contracts; the interface-freeze table; the falsification
register; and the charters of I2, I3 and L1. Every one of those commands would have failed on
a missing path, forever — including S10's own freeze predicate, which is the second-highest
node on the critical path.

This had to be fixed **before S10 froze anything**, because the freeze commit hashes the path.
It is fixed in `graph.json` v2.0.0. Anything still carrying the plural is stale.

```
sed -i '' 's|violations\.schema\.json|violation.schema.json|g' $(grep -rl 'violations\.schema\.json' erp/)
```

**And the second rename, v2.1.0 (R-17): the directory is `erp/contracts/`, never bare
`contracts/`.** Both spellings were live for the same files. The bare one is dead
everywhere — in globs, in accept predicates, in the freeze command and in this file. See §2.4.

```
sed -i '' 's|\([^/[:alnum:].-]\)contracts/|\1erp/contracts/|g' $(grep -rl 'contracts/' erp/)
```

---

## 2. Master table

`—` in the Producing node column means the file is carried in by **L0** as part of the Day-0
bootstrap rather than authored by a later node, or is pre-existing on disk (§2.4).

### 2.1 Repository root

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `package.json` | L1 | L1 | **L0** | *(was claimed by G3, which cannot create what its own `npm ci` needs)*. `L0` gate (2) fixes the `scripts` block concretely: `"test": "node --test"` with no path arguments. **`npm test -- <name>` is not a filter and no predicate may use it (R-23)** |
| `package-lock.json` | L1 | L1 | **L0** | *(existed nowhere; `npm ci` fails without it in 4 documented call sites)* |
| `README.md` | I4 | I4 / C4 | **G2**, §Results by **E7** | — |
| `LICENSE` | I4 | — | — | — |
| `.githooks/pre-commit` | L1 | I4 | **G4** | `.git/hooks/**` |
| `.githooks/pre-commit-ownership` | L1 | L1 | **G5** | — |

### 2.2 Page source tree — `src/`

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `src/tools.js` | I3 | L1 / I2 | **L0**, corrected by **T6** | — |
| `src/erp.js` | I3 | L1 | **L0** | — |
| `src/policy.js` | I3 | L1 / I3 | **L0**, ported by **S3** | `policy/**`, `policy/engine.js` |
| `src/scenarios.js` | I3 | L1 | **L0** | — |
| `src/samples.js` | I3 | L1 | **L0** | — |
| `src/canonical.js` | I3 | I3 | **S11** | `canon.mjs` *(that is the eval-kit's PORT, not this)*, `src/canonical.mjs` |
| `src/page/index.html` | UX | UX | **F1** | `web/index.html`, `public/index.html` |
| `src/page/register.js` | I2 | I2 | **T2** | `web/surface.js`, `src/page/surface.js` |
| `src/page/tools/compile.js` | I2 | I2 | **T1** | `web/tools/compile.js` |
| `src/page/tools/defs.js` | I2 | I2 | **T1** | `web/tools/defs.js` |
| `src/page/tools/absence.js` | I2 | I2 | **T3** | `web/tools/absence.js` |
| `src/page/ui/shell.js` | UX | UX | **F1** | `web/ui/shell.js` |
| `src/page/ui/editor.js` | UX | UX | **F2** | `web/ui/editor.js` |
| `src/page/ui/receipts.js` | UX | UX | **F3** | `web/ui/receipts.js` |
| `src/page/ui/sign-dialog.js` | UX | UX | **F4** | `web/ui/sign.js` |
| `src/page/ui/inspector.js` | UX | UX | **F5** | `web/ui/inspector.js` |
| `src/page/skin.css` | UX | UX | **F6** | `web/skin.css` |
| `src/page/sign-bridge.js` | UX | I3 | **S5** | `web/sign-bridge.js` |
| `src/page/fallback-agent.js` | I1 | I1 | **H3** | `web/agent.js` |
| `src/page/env-banner.js` | I1 | I1 | **H5** | `web/banner.js` |
| `src/page/demo-mode.js` | I1 | I1 | **H4** | `web/demo.js` |

> **`web/**` matches no glob in the ownership matrix and no accept predicate anywhere.
> It is dead. So are `policy/**`, `public/**` and `deploy/**`.**

### 2.3 Server tree — `server/`

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `server/index.mjs` | I3 | I3 | **S1** | `server.js`, `api/index.mjs` |
| `server/personas.json` | I3 | UX | **F1** | `personas.json`, `server/users.json` |
| `server/authz.mjs` | I3 | I3 | **S2** | — |
| `server/envelope.mjs` | I3 | I3 | **S4** | — |
| `server/sign.mjs` | I3 | I3 | **S5** | — |
| `server/locks.mjs` | I3 | I3 | **S12** | `src/locks.js` |
| `server/recanon.mjs` | I3 | I3 | **S6** | — |
| `server/chain.mjs` | I3 | I3 | **S7** | — |
| `server/provenance.mjs` | I3 | I3 | **S8** | — |
| `server/seed.mjs` | I3 | I3 | **S9** | — |
| `server/store.mjs` | I3 | I3 | **S8** | — |
| `server/routes/policy.mjs` | I3 | I3 | **S3** | — |
| `server/routes/state-digest.mjs` | I3 | I3 | **S9** | — |
| `server/routes/version.mjs` | I3 | I4 | **D1** | — |

### 2.4 Contracts — `erp/contracts/` (SINGULAR filenames throughout)

> **`erp/contracts/` is the canonical directory and the only one (R-17).** The bare
> `contracts/**` spelling is dead — it and `erp/contracts/**` were both live for the same
> files, `CONTRACTS.md` addressed them at one path while L0, S10, G6 and this file
> addressed them at another, and nothing said whether L0 moved, copied or duplicated them.
> **It does none of those.** The contract files are **PRE-EXISTING planning artifacts**:
> they were authored before the graph, they are on disk today, no node lists one as an output,
> and L0 commits them where they are.
>
> **R-28 — never state this directory as a count.** `erp/contracts/` holds **eight FILES**, of
> which **six are `*.schema.json`** (`violation`, `policy`, `eval-case`, `signature`,
> `provenance`, `tool-export`) and **two are frozen data documents** (`canonical-vectors.json`,
> `policy-versions.json`). It becomes **nine on Day 0**, when `V5` adds
> `erp/contracts/probe-verdict.schema.json`. So "the eight frozen schemas" was wrong about the
> composition *and* stale from Day 0, and it is dead vocabulary. Predicates say **every
> `*.schema.json` in `erp/contracts/`**, or they name `erp/contracts/FREEZE.md`.
>
> `tools/ready.mjs --check-accept-paths` now exempts **eight entries, not ten**: the **six**
> contract files that some `accept` actually names — `violation.schema.json` (S10, S4, T3, X2),
> `canonical-vectors.json` (S11, E1), `eval-case.schema.json` (S1, S5, E3),
> `policy.schema.json` (S3), `policy-versions.json` (S3, G6) and `signature.schema.json` (S5)
> — plus `erp/charters/C3.md` and `countinghouse/src/policy.js`. **`provenance.schema.json` and
> `tool-export.schema.json` were dropped**: no accept in the graph names them, and an exemption
> nothing uses is a licence waiting for a mistake to walk into. The first seven are proved with
> `test -f`; `countinghouse/src/policy.js` cannot be, and is exempt by name — it is the spike
> tree, a SIBLING checkout at `../countinghouse`, cited verbatim by `S4`'s accept as the source
> of a live defect and never produced by this repository.
>
> **The tokenizer is specified in `G0`'s own accept, in five steps, and this is the summary.**
> Exit 0 vs exit 1 used to turn on an unstated one, which left seven tokens unclassifiable.
> (t1) replace every character outside `[A-Za-z0-9_./*$~@+-]` with a space; (t2) split on
> whitespace; (t3) strip trailing `.`, `/`, `-`, then leading `-`, then exactly one leading
> `./`; (t4) a token is a **candidate path** only if its basename carries an extension
> (`^[A-Za-z0-9_.@+-]+\.[A-Za-z0-9]{1,6}$`) or the token is itself a declared output or a
> directory prefix of one — which is what keeps `getTools/executeTool`, `origin/main`,
> `refs/heads/main`, `500/1500-char`, `ajv/dist/2020`, `outpocket/snapshot/1` and the regex
> fragment `.+/i` out of the resolver; (t5) a candidate with **no `/`** is a **bare word** and
> resolves only if it matches the basename of some node output (`no-net.mjs` → `E1`'s
> `webmcp-eval-kit/test/no-net.mjs`, `eval.yml` → `E6`'s `.github/workflows/eval.yml`,
> `package.json`, `package-lock.json`, `README.md`) or is a repository-root file on disk;
> otherwise it is discarded, which is what absorbs `JSON.parse`, `process.exit`, `dns.lookup`,
> `v22.23.1` and `2026-08.1`.
>
> Then **four declared discard classes**: **absolute** (begins with `/` — `/tmp/a.json` and
> `/tmp/b.json` that `H4`'s own predicate creates, `/dev/null`, every URL route such as
> `/api/sign`, and the `//github.com/...` remnant of step (t1)); **glob** (`*`, `?`, `[` —
> `tests/*.test.mjs` in `L0` gate (2), `erp/**.md` in `G0`'s `--check-tables` clause);
> **variable** (`$` or a leading `~` — `~/.codex/$p.config.toml` in `L0` gate (4),
> `$URL/version`, and `E4`'s `$CODEX_HOME/auth.json`, `$CODEX_HOME/config.toml` and
> `$CODEX_HOME/AGENTS.md`, which name files inside a tree `tools/blind-home.sh` builds at run
> time); and **not-a-path / bareword** from (t4) and (t5). Both lists are printed.
>
> **RUN 2026-08-28 under exactly these rules: 182 candidate tokens resolved — 152 verbatim in
> node outputs, 7 as directory prefixes of an output, 12 as output basenames, 11 pre-existing
> under `erp/` found by `test -f` — 21 hits over the 8 exemption entries, 0 UNRESOLVED,
> exit 0.** (The earlier "179 / 157 in node outputs" was 150 verbatim with the 7 directory
> prefixes folded in and before the directory-prefix class was named.) The seven tokens that were
> unclassifiable last revision are gone: `no-net.mjs` and `eval.yml` resolve as output
> basenames; `E4`'s three `CODEX_HOME` files are now written with the directory they live in;
> and `F4`'s and `L0`'s prose references to sibling documents are now written
> `erp/CONTRACTS.md` and `erp/PLAN.md`, which resolve on disk. Stating only "the eight schemas
> and `C3.md`" is what made this flag exit 1 on the very graph it validates.
>
> In this section only, a **bold node id after `*(pre-existing)*` names the node that
> FREEZES, READS or LOCKS the file — not one that produces it.** `S10` freezes
> `violation.schema.json`, `S11` reads the seven vectors, `S3` locks the policy version. The
> Writing seat is `—` for every row because none of these files is written by a sprint node.

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| **`erp/contracts/violation.schema.json`** | L1 | — | *(pre-existing)*, frozen by **S10** | **`contracts/violation.schema.json`** *(the bare spelling — dead)*, **`erp/contracts/violations.schema.json`** *(PLURAL, 29 refs — the single most damaging alias in the project)* |
| `erp/contracts/canonical-vectors.json` | L1 | — | *(pre-existing)*, read by **S11** | `vectors.json`, `contracts/canonical-vectors.json` |
| `erp/contracts/eval-case.schema.json` | L1 | — | *(pre-existing)* | `contracts/eval-case.schema.json` |
| `erp/contracts/policy.schema.json` | L1 | — | *(pre-existing)* | `contracts/policy.schema.json` |
| `erp/contracts/policy-versions.json` | L1 | — | *(pre-existing)*, locked by **S3** | `contracts/policy-versions.json` |
| `erp/contracts/provenance.schema.json` | L1 | — | *(pre-existing)* | `contracts/provenance.schema.json` |
| `erp/contracts/signature.schema.json` | L1 | — | *(pre-existing)* | `contracts/signature.schema.json` |
| `erp/contracts/tool-export.schema.json` | L1 | — | *(pre-existing)* | `contracts/tool-export.schema.json` |
| `erp/contracts/probe-verdict.schema.json` | L1 | I1 | **V5** | — |
| `erp/contracts/session.contract.md` | L1 | I3 | **S1** | — |
| `erp/contracts/tool-surface.contract.md` | L1 | L1 | **S10** | — |
| `erp/contracts/FREEZE.md` | L1 | L1 | **S10** | **`erp/contracts/FREEZE`** *(no extension — L1's charter and TEAM.md both use this; the file has `.md`)* |

> There is **one** freeze mechanism: `sha256sum -c erp/contracts/FREEZE.md`, run **from the
> repository root** so the paths inside it resolve, and asserted in S10's
> accept. The per-contract wall-clock deadlines in CONTRACTS.md §2 are a third mechanism and
> are not authoritative; note in particular that a "C1 freeze at Day-1 09:00" sits two days
> ahead of its own producer, S4.

### 2.5 Tests — `tests/`

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `tests/helpers.mjs` | QA | L1 | **L0** | — |
| `tests/surface.test.mjs` | I2 | L1 / I2 | **L0**, fixed by **T6** | — |
| `tests/policy.test.mjs` | I3 | L1 / I3 | **L0**, ported by **S3** | — |
| `tests/canonical.test.mjs` | I3 | I3 | **S11** | — |
| `tests/policy-lock.test.mjs` | QA | I3 | **S3** | *(named twice inside the FROZEN `erp/contracts/policy-versions.json` and `policy.schema.json` as the check that enforces the version lock, and produced by no node until v2.1.0)* |
| `tests/signature.test.mjs` | QA | I3 | **S5** | *(named inside the FROZEN `erp/contracts/signature.schema.json` as the owner of the tampered-snapshot fixture, and produced by no node until v2.1.0)* |
| `tests/fix-lint.test.mjs` | QA | I3 | **S4** | *(named twice inside the FROZEN `erp/contracts/violation.schema.json` as the `x-fixLint` enforcer — no JSON Schema keyword can catch that instance — and produced by no node until v2.1.0)* |
| `tests/acceptance/launcher.test.mjs` | QA | I1 | **H1** | — |
| `tests/acceptance/banner.test.mjs` | QA | I1 | **H5** | — |
| `tests/acceptance/session.test.mjs` | QA | I3 | **S1** | — |
| `tests/acceptance/curl-403.sh` | QA | I3 | **S2** | **`tests/curl-escalation.sh`** *(PLAN Day-3 gate)*, **`tests/curl/**`** *(I3 charter)* |
| `tests/acceptance/envelope.test.mjs` | QA | I3 | **S4** | — |
| `tests/acceptance/sign-state.test.mjs` | QA | I3 | **S5** | **`tests/sign-gate.test.mjs`** *(PLAN Day-4 gate — produced by no node)* |
| `tests/acceptance/sign-lock.test.mjs` | QA | I3 | **S12** | — |
| `tests/acceptance/toctou.sh` | QA | I3 | **S6** | — |
| `tests/acceptance/chain.test.mjs` | QA | I3 | **S7** | — |
| `tests/acceptance/provenance.test.mjs` | QA | I3 | **S8** | — |
| `tests/acceptance/conformance.test.mjs` | QA | QA | **T4** | — |
| `tests/acceptance/readme-credentials.test.mjs` | QA | I4 | **G2** | — |
| `tests/acceptance/editor.test.mjs` | QA | UX | **F2** | — |
| `tests/acceptance/receipt-channel.test.mjs` | QA | UX | **F3** | — |
| `tests/acceptance/sign-dialog.test.mjs` | QA | UX | **F4** | — |
| `tests/acceptance/inspector.test.mjs` | QA | UX | **F5** | — |
| `tests/fixtures/banned-sample.js` | I4 | I4 | **G4** | — |
| `tests/fixtures/ownership-ok.txt` | I4 | L1 | **G5** | — |
| `tests/fixtures/ownership-bad.txt` | I4 | L1 | **G5** | — |
| `tests/redteam/` | C3 | C3 | **E9** | — |

> **Ownership note.** `tests/acceptance/**` defaults to QA, but under
> `graph.json.conventions.ownership_rule` **a node's own `outputs` beat the glob** — so I3
> writes `tests/acceptance/session.test.mjs` legitimately, because S1 lists it. The old
> glob-only rule mechanically rejected 23 of the graph's own node outputs, including 9 files
> under `tests/acceptance/**`. Charters that say "you must never touch `tests/`" are wrong and
> are regenerated from `graph.json.file_ownership` plus this rule.

### 2.6 Tooling — `tools/`

Every one of these was named in an acceptance predicate. **Sixteen of them were produced by
no node at all**, including four on cut rank 0 and two on the critical path — the plan
terminated on `tools/freeze-check.mjs`, which nobody was assigned to write. Each now has a
producing node and the hours are funded there.

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `tools/ready.mjs` | L1 | L1 | **G0** | *(was G5, cut rank 1 — the tool the graph is operated with sat inside the first cut)* |
| `tools/check-ownership.mjs` | L1 | L1 | **G0** | — |
| `tools/validate-contracts.mjs` | L1 | L1 | **S10** | — |
| `tools/contracts-check.mjs` | QA | QA | **G6** | — |
| `tools/lint-layer0.mjs` | I4 | I4 | **G4** | `tools/lint.mjs` |
| `tools/chrome.mjs` | I1 | I1 | **H1** | — |
| `tools/check-toplevel.mjs` | I2 | I2 | **T1** | — |
| `tools/export-surface.mjs` | I2 | I2 | **T5** | — |
| `tools/check-unknowns.mjs` | L1 | PM | **V6** | — |
| `tools/check-storyboard.mjs` | UX | UX | **F6** | — |
| `tools/check-results-table.mjs` | L1 | C4 | **E7** | — |
| `tools/check-psl.mjs` | I4 | I4 | **D2** | — |
| `tools/survive.mjs` | I4 | I4 | **D3** | — |
| `tools/freeze-check.mjs` | QA | QA | **D6** | — |
| `tools/blind-home.sh` | L1 | L2 | **E4** | — |

### 2.7 Harness, probe, evidence, artifacts

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `harness/drive.mjs` | I1 | I1 | **H2** | `harness/driver.mjs` |
| `harness/probe-v0.mjs` | I1 | I1 | **V0** | — |
| `harness/compare-runs.mjs` | I1 | I1 | **V4** | — |
| `harness/dump-state.mjs` | I1 | I1 | **H4** | — |
| `harness/rehearse.mjs` | I1 | I1 | **H6** | — |
| `harness/scenarios/happy.json` | I1 | I1 | **H3** | — |
| `probe/index.html` | I1 | I1 | **V5** | `web/probe.js` |
| `probe/server.mjs` | I1 | I1 | **V5** | — |
| `evidence/V0.json`, `evidence/V1.json`, `evidence/V2.json`, `evidence/V3.json`, `evidence/V4.json` | I1 | I1 | **V0**, **V1**, **V2**, **V3**, **V4** | **`harness/findings/V<n>.md`** *(I1 charter)*, **`erp/VERIFY.md`** *(PLAN Day-1 gate — produced by no node)* |
| `evidence/V1.png` | I1 | I1 | **V1** | — |
| `evidence/V4-run1.json`, `evidence/V4-run2.json` | I1 | I1 | **V4** | — |
| `evidence/V5-origin.txt`, `evidence/V5-headers.txt` | I1 | I1 | **V5** | — |
| `evidence/UNKNOWNS.md` | I1 | PM | **V6** | `erp/VERIFY.md` |
| `evidence/H2-reachability.json` | I1 | I1 | **H2** | — |
| `evidence/rehearsal.json` | I1 | I1 | **H6** | — |
| `evidence/headers.txt` | I1 | I4 | **D1** | — |
| `evidence/D1-url.txt` | I1 | I4 | **D1** | `<live-host>`, `https://<live-host>` *(unresolved placeholder in PLAN's Day-5 gate)* |
| `evidence/G1-about-box.png`, `evidence/G1-visibility.txt` | I1 | I4 | **G1** | — |
| `evidence/G3-clean-clone.txt` | I1 | QA | **G3** | — |
| `evidence/G6-contracts.txt` | I1 | QA | **G6** | — |
| `evidence/survive.json` | I1 | I4 | **D3** | — |
| `evidence/D2-domain.txt` | I1 | I4 | **D2** | — |
| `evidence/D4-video-url.txt` | I1 | UX | **D4** | — |
| `evidence/submission.png`, `evidence/D5-submission-url.txt` | I1 | I4 | **D5** | — |
| `evidence/freeze-check.json` | I1 | QA | **D6** | — |
| `evidence/L0-bootstrap.txt` | I1 | L1 | **L0** | — |
| **`artifacts/tools.export.json`** | I2 | I2 | **T5** | **`outpocket/tools.export.json`** *(EVAL §3, §8.2)*, **`tools.export.json`** bare *(PLAN Day-2 gate)* |

### 2.8 Docs, video, knowledge base, team tree

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `docs/STORYBOARD.md` | UX | UX | **F0** | **`submission/storyboard.md`** *(UX charter)*, **`erp/STORY.md`** *(EVAL)* |
| `docs/VIDEO-SCRIPT.md` | UX | UX | **F0** | *(was output AND graded by D4 — a self-referential predicate)* |
| `docs/DEVPOST.md` | I4 | I4 | **D5** | `submission/devpost.md` |
| `video/outpocket.mp4` | UX | UX | **D4** | **`video.mp4`** *(graph v1)*, **`submission/demo.mp4`** *(I4 charter)* |
| `kb/webmcp/BANNED.txt` | K1 | I4 | **G4** | `.team/lint/banned.txt` *(that is a separate operational copy, not this)* |
| `kb/webmcp/RETRACTED.txt` | K1 | I4 | **G4** | — |
| `kb/webmcp/MECHANISMS.txt` | K1 | I4 | **G4** | — |
| `kb/method/BANNED-CITATIONS.md` | K2 | L1 | **L0** | — |
| `kb/pits/<node-id>.md` | L1 | — | *(merge ritual, unbudgeted)* | — |
| `.team/charters/<seat>.md` | L1 | L1 | **L0** | *(symlink to `erp/charters/`; nothing created it before L0)* |
| `.team/contracts`, `.team/log`, `.team/deviations`, `.team/stalls.md`, `.team/lint/banned.txt` | L1 | L1 | **L0** | *(no trailing slashes — these are the literal strings in `L0.outputs`)* |
| `.team/deviations/DEV-E3-eval-case-known-open.md` | L1 | I3 | **S5** | *(the one deviation ticket the graph SCHEDULES: the `confirm_token` flips `eval-case.schema.json` `examples[1]` from `known-open` to **`enforced`** (R-27 — `refused` is **not** in the frozen enum `[enforced, known-open, not-runnable]`, and the gate that demanded it would have failed ajv and turned `npm test` red repo-wide on Day 3), that file is frozen by `S10` on Day 1, and `E3` failed by construction until this was booked — R-13, and the worked adopt-not-send-back example)* |
| `~/.codex/verifier.config.toml`, `builder`, `redteam`, `evaluator` | L1 | L1 | **L0** | — |
| `erp/graph.state.json` | L1 | L1 | **G0** | — |
| `erp/graph.json` | PM | L1 | **L0** *(committed, not authored — PM authors it, L0 puts it in git)* | — |
| `erp/PATHS.md` | PM | L1 | **L0** *(committed, not authored — this file. A seat working in a worktree must have it, which is why L0 commits it)* | — |
| `erp/DECISIONS.md` | PM | L1 | **L0** *(created on Day 0 carrying the `D-17` row; `V6` **appends** its unknowns rows on Day 2 and does not create it)* | *(was in §6 only, annotated "real", with no master-table row — and §7.3 calls a missing path a defect in THIS file. `L0` accept gate (1) parses the `D-17` row and fails unless `graph.json.capacity.human_hours_available` equals the ruled per-day figure × 5.5, so this is a gated Day-0 output, not a note)* |
| `erp/RUBRIC.md` | PM | L1 | **L0** | *(was in §6 as a dead name — L2's only instrument, cited by four charters and produced by nothing. R-16 funds it in L0 at +0.5 h. Glob owner PM, writing seat L1: rule (a) beats (b).)* |
| `erp/charters/<seat>.md` | PM | — | *(pre-existing)* | *(`erp/charters/C3.md` is greppped by E9's accept; `erp/charters/L1.md` is what L1's FIRST boot reads, because `.team/charters` is a symlink only L0 creates)* |

### 2.9 Eval-kit and eval outputs

The eval-kit's entry point is **`webmcp-eval-kit/bin/eval.mjs`**, invoked as
`node webmcp-eval-kit/bin/eval.mjs …` from the outpocket root, or as `npx webmcp-eval …` once
the package is installed. Both spellings mean this one file.

| Canonical path | Glob owner | Writing seat | Producing node | Aliases to eradicate |
|---|---|---|---|---|
| `webmcp-eval-kit/bin/eval.mjs` | C4 | C4 | **E1** | **`bin/eval.mjs`** bare, **`eval/run.mjs`** *(PLAN Day-5 gate)* |
| `webmcp-eval-kit/package.json` | C4 | C4 | **E1** | — |
| `webmcp-eval-kit/src/canon.mjs` | C4 | C4 | **E1** | *(a PORT of `src/canonical.js`; **never** a second definition — see §4)* |
| `webmcp-eval-kit/test/no-net.mjs` | C4 | C4 | **E1** | — |
| `webmcp-eval-kit/fixtures/reference-site/index.html` | C4 | C4 | **X6** | `https://example-webmcp-site` *(a host that does not resolve)* |
| `webmcp-eval-kit/README.md` | C4 | C4 | **X6** | — |
| `evals/suites/capability.suite.json` | C4 | C4 | **E2** | `suites/capability.json`, `webmcp-eval-kit/suites/capability.json` |
| `evals/suites/negative.suite.json` | C4 | C4 | **E3** | `suites/negative.json` |
| `evals/surfaces.expected.json` | C4 | C4 | **E2** | `surfaces.frozen.json` |
| `evals/accounting.json` | C4 | C4 | **E5** | `reports/<freeze>/accounting.json` |
| `evals/latest.json` | C4 | C4 | **E6** | **`evals/results.json`** *(C4 charter)*, `reports/<freeze>/*.json` |
| `evals/mutants/`, `evals/mutation-report.json` | C4 | C4 | **E10** | — |
| `evals/blind/rubric.schema.json` | L2 | L2 | **E4** | `schemas/blind-verdict.schema.json` |
| `evals/blind/prompts/c1.txt` | L2 | L2 | **E4** | `prompts/E4-blind.md` |
| `evals/blind/tasks.md` | L2 | L2 | **E4** | — |
| `evals/blind/make-blind-packet.mjs` | L2 | L2 | **E4** | — |
| `evals/blind/C1-verdict.json` | L2 | C1 | **E8** | **`artifacts/c1-verdict-<state>.json`** *(C1 charter, one per state)*, `reports/blind/<freeze>.json` |
| `evals/redteam/report.md` | C4 | C3 | **E9** | `reports/redteam/<freeze>.md` |
| `.github/workflows/eval.yml` | I4 | C4 | **E6** | — |
| `webmcp-dev-kit/src/surface/` | C2 | C2 | **X1** | — |
| `webmcp-dev-kit/src/envelope/` | C2 | C2 | **X2** | — |
| `webmcp-dev-kit/src/siggate/` | C2 | C2 | **X3** | — |
| `webmcp-dev-kit/src/ledger/` | C2 | C2 | **X4** | — |
| `webmcp-dev-kit/src/lint/` | C2 | C2 | **X5** | — |
| `webmcp-dev-kit/bin/webmcp-lint.mjs` | C2 | C2 | **X5** | — |

**The blind packet directory** is built by `evals/blind/make-blind-packet.mjs` outside any git
repo. It contains **exactly two files: `tools.export.json` and `tasks.md`** — `ls -1` prints
`2`. The C1 charter's "exactly one file" and its `ls -a` check (which prints three entries on
a one-file directory and so never matched its own stated output) are both wrong.

---

## 3. Commands

| Canonical command | Meaning |
|---|---|
| `node tools/ready.mjs --path` | recompute the critical path. **Never assert the path by hand.** |
| `node tools/ready.mjs --check-cuts` | the cut invariant over every hard edge |
| `node tools/ready.mjs --check-accept-paths` | every path in any `accept` appears in some node's `outputs`, is an output **basename**, is pre-existing under `erp/` and found by `test -f`, or is one of the **eight** named exemptions (the six contract files any accept actually names, `erp/charters/C3.md`, `countinghouse/src/policy.js` — `provenance.schema.json` and `tool-export.schema.json` were dropped as unused). The **tokenizer is specified in `G0`'s accept**, in five steps; four discard classes (absolute, glob-bearing, `$`-bearing, not-a-path/bareword) are applied first and both lists are printed. **Run 2026-08-28: 182 resolved (152 verbatim, 7 directory-prefix, 12 output-basename, 11 pre-existing), 21 exemption hits, 0 unresolved, exit 0** |
| `node tools/ready.mjs --check-freezes` | every `interface_freezes[].unblocks` id is a node with an edge from `frozen_by` |
| `node tools/ready.mjs --check-tables` | every restated node table and day table in `erp/**.md` diffed against `graph.json` and `capacity.schedule_A`. **A restatement is legal only while this is green** — the falsification rule used to forbid restatement outright and so fired against four of the graph's own siblings while nothing checked them |
| `node tools/ready.mjs --check-schedule` | `day(u) <= day(v)` on every hard edge, and no seat above `capacity.seat_day_hours_cap` (6.0 agent-hours) on any day |
| `node tools/check-ownership.mjs --seat <S> --files-from <file>` | ownership, from a **fixture file**, never from an ambient `git diff` |
| `node --import ./webmcp-eval-kit/test/no-net.mjs …` | the leading **`./` is mandatory** — node resolves a bare relative specifier as a PACKAGE name and throws `ERR_MODULE_NOT_FOUND` (MEASURED). This is the **only** path in any accept predicate permitted to carry `./`; `--check-accept-paths` strips exactly one leading `./` before matching, and everything else is written bare. `require('./artifacts/tools.export.json')` in T5 was the other one and is now `fs.readFileSync('artifacts/tools.export.json')` |
| `sha256sum -c erp/contracts/FREEZE.md` | run **from the repository root**, so the paths listed inside resolve |
| `npm ci` | requires `package-lock.json` — **L0** produces it. `npm ci` without one fails with `EUSAGE`. |
| `gh api repos/Caleb0796/<repo> -q '.visibility + " " + .license.spdx_id'` | the **only** working visibility+licence probe. `gh repo view --json licenseInfo -q .licenseInfo.spdxId` returns empty: `licenseInfo` has no `spdxId` field. |
| `! grep -q <pat> <file>` | the **only** correct "must not appear" idiom. **`grep -c … returns 0` EXITS 1** — written in an `&&` chain it always fails. This bug was in D1, E4, E5 and V5. |
| `grep -i '^origin-agent-cluster:' f \| grep -q '?0' && exit 1; exit 0` | the Origin-Agent-Cluster test. **Only `?0` is fatal; `?1` is harmless.** |
| `find src/page -name '*.js' -print0 \| xargs -0 node tools/check-toplevel.mjs` | shell-independent. `src/page/**/*.js` needs `shopt -s globstar` and passes vacuously under `sh`. |
| `CODEX_HOME="$BH" codex exec --strict-config -C "$PACKET" -s read-only --skip-git-repo-check --ephemeral --ignore-rules --output-schema … -o … "$(cat …)" < /dev/null` | the blind run (**E8**). No `-p` — that home has no profile file. `< /dev/null` is mandatory: with a non-TTY stdin, `codex exec` appends what it finds as a `<stdin>` block. |
| `-c sandbox_workspace_write.network_access=true` | append to **every** Codex command that needs the network or `npm install` — C2, C3, C4. Bare `-s workspace-write` has **no network**. **Never** append it to the blind run. |
| `test -f ~/.codex/<p>.config.toml` + parse + `grep "reasoning effort: <level>"` | the profile check. `codex exec -p <missing>` **exits 0 with no warning** and silently falls back to the base config, so the banner grep is the only real assertion. |

---

## 4. One canonicaliser, one export envelope

`src/canonical.js` (**S11**) is the single OCF-1 implementation: recursive **codepoint** key
sort, NFC strings, integers only, `digest(kind, value) = sha256(kind + "\n" + canon(value))`,
with a carve-out permitting `$`-prefixed keys inside an `inputSchema` subtree.
`webmcp-eval-kit/src/canon.mjs` (**E1**) is a **port** of it, verified against all seven
vectors in `erp/contracts/canonical-vectors.json`.

There was a second, incompatible definition — `JSON.stringify` over an array sorted by
`localeCompare`, no kind prefix, nested key order untouched. It produced different bytes for
the same surface **always**, which made every "the deployed digest equals the frozen digest"
assertion unsatisfiable by construction. It is deleted. `localeCompare` is additionally
ICU-dependent: a stranger's clean clone can sort differently.

The export envelope is `erp/contracts/tool-export.schema.json`'s (it is frozen and carries
`policy_digest`), with `states` as an **array** of `{state_id, preconditions, tools,
surface_digest, accounting}`. EVAL's `{freeze, chromiumMajor, capturedAt, states:{…}}` — an
**object** — is dead.

---

## 5. Identifiers that are not paths

**Application state ids** — six, always written with the hyphenated suffix, in `x-requiredStates`,
`surface_digest` keys and every suite:

`S0-anon` · `S1-emp-home` · `S2-emp-draft-clean` · `S3-emp-draft-dirty` · `S4-emp-submitted` · `S5-aud`

The previous five-state set omitted `S4-emp-submitted`, which is precisely the state that
motivates set-equality over count-equality: it and `S5-aud` both carry 6 tools and differ by
exactly one name. Never write a bare `S1`/`S5` for a state — those are **server-lane node ids**.

**Unknowns register keys** — `V0` … `V4`, matching the V-lane nodes that answer them.
`T0`–`T4` is dead: `T1`–`T4` are live tool-surface node ids meaning Port tools.js, Real
registerTool, Absence register and Description budget, and `T0` exists nowhere.

**Day labels** — always `Day 0` … `Day 6` in prose. `D1`–`D6` are delivery **nodes**. PLAN's
"Gate D0 … Gate D6" is renamed `Gate Day-0` … `Gate Day-6`.

**Which day a node runs on** is owned by **`graph.json.capacity.schedule_A`** and by nothing
else (new in v2.1.0). PLAN.md's day table and every RISK.md trigger that names a day are
restatements, checked by `node tools/ready.mjs --check-tables`. Before this block existed,
`V1` was on Day 1 in `graph.json` and RISK.md and on Day 2 in PLAN.md, so RISK's Day-1 23:59
trigger fired by construction against the plan's own schedule. Six nodes moved in v2.1.0:
**V5** → Day 0, **V0** and **V1** → Day 1, **H5** → Day 2, **T4** → Day 3, **F6** → Day 4;
`S9`, `S5`, `S2` and `S7` also moved to keep every seat inside 6 agent-hours a day.

**Cut ranks** — never cited by number in an operational trigger. Write `Cut X1–X6`, not
`Cut rank 4`. There is exactly one ladder, in `graph.json.cut_ladder`.

---

## 6. Names that appear in the corpus and do not exist

Referenced by at least one document; produced by no node; not created by anything.

**`erp/RUBRIC.md` has left this table.** It was the one row here that was escalated rather
than repointed — L2's only instrument, cited by four charters, produced by nothing, flagged
OPEN. R-16 makes it an **L0** output at +0.5 h; see §2.8. Nothing in this project may go on
calling it missing.

| Dead name | What to use instead |
|---|---|
| `erp/contracts/violations.schema.json` | `erp/contracts/violation.schema.json` |
| `erp/VERIFY.md` | `evidence/V0.json`…`evidence/V4.json`, summarised in `evidence/UNKNOWNS.md` |
| `erp/OWNERS.md` | `graph.json.file_ownership` + this file |
| `erp/STORY.md` | `docs/STORYBOARD.md` |
| `contracts/**` *(the bare spelling)* | `erp/contracts/**` — R-17. Both were live for the same files; the bare glob is deleted from `file_ownership` and from every predicate, and `L0` neither moves nor copies the contract files (§2.4) |
| `erp/DEBT.md`, `erp/VERDICTS.md` | no consumer survives; delete the references |
| `erp/DECISIONS.md` | real — **created by `L0` on Day 0** carrying the `D-17` ruling row, which `L0` accept gate (1) gates; **V6 appends** its unknowns rows on Day 2 and does not create it (R-24) |
| `web/**`, `policy/**`, `public/**`, `deploy/**`, `submission/**`, `tests/curl/**`, `harness/findings/**`, `QA-STATUS.md` | see §2; every one is a charter-only vocabulary with zero overlap with the executable tree |
| `video.mp4`, `submission/demo.mp4` | `video/outpocket.mp4` |
| `eval/run.mjs`, `evals/results.json` | `webmcp-eval-kit/bin/eval.mjs`, `evals/latest.json` |
| `https://example-webmcp-site` | `webmcp-eval-kit/fixtures/reference-site/index.html`, served locally |
| `erp/contracts/FREEZE` | `erp/contracts/FREEZE.md` |

---

## 7. How every other document uses this file

1. A charter's **"You own, by path"** block is generated from `graph.json.file_ownership`
   plus `conventions.ownership_rule`. It is never hand-written. Generating it is a `G5` check.
2. PLAN's day-gate command blocks are **copied verbatim** from the nodes' `accept` fields.
   There is never a second copy of a command. Every gate drift the audit found — eight of
   them, one per day — came from hand-writing a second copy.
3. Any document needing a path quotes the canonical column here. If a path is missing from
   this file, that is a defect in **this** file: add the row, name the producing node and fund
   the hours in `graph.json` — do not invent a spelling locally. Three rows were added in
   v2.1.0 for exactly this reason: `tests/policy-lock.test.mjs`, `tests/signature.test.mjs`
   and `tests/fix-lint.test.mjs` are each named **inside a frozen schema** as the thing that
   enforces it, and each was produced by no node and absent from this file.
4. A charter's "you own" block reads the **Writing seat** column, not the Glob owner column.
   Charters that say "you must never touch `tests/`" are wrong: nine files under
   `tests/acceptance/**` have glob owner QA and a different writing seat, and rule (a) beats
   rule (b).
5. Which day a node runs on comes from `graph.json.capacity.schedule_A` (§5), never from
   PLAN.md and never from a RISK.md trigger.
