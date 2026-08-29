# `tool-surface.contract.md` — the I2/I3 seam, FROZEN

> **Frozen by node `S10`, owner L1, Day 1.** `webmcp-agent-team.md` names this seam as the
> **only strong coupling** between I2 (tool surface) and I3 (kernel), and states that
> parallelism before the freeze is fake. This document and
> `erp/contracts/violation.schema.json` are what T1, S1 and S4 are permitted to build against.
>
> **There is exactly ONE freeze mechanism and it is not this sentence.** It is
> `erp/contracts/FREEZE.md`, a sha256 manifest, checked from the repository root with
> `sha256sum -c erp/contracts/FREEZE.md`. The wall-clock deadlines in `erp/CONTRACTS.md` §2 are
> **not** authoritative. Any change after the freeze requires a PM deviation ticket referenced
> in the commit body.
>
> **Every table below is GENERATED, not typed** — `tools/validate-contracts.mjs` drives the real
> toolset through every reachable state and fails if this document and `src/tools.js` disagree
> in either direction. A name here that resolves to no definition fails; a definition reachable
> on the surface and absent here fails too, because a freeze that omits a tool freezes nothing.

**Evidence grade: MEASURED**, 2026-08-29, node v22.23.1, against `src/tools.js` at the T6 merge
(`745d560`, 24 tests / 24 pass / 0 fail).

## 1. The six states

The surface **is** the state machine. Workflow rules never live in descriptions: a tool that
must not be called right now is a tool that **does not exist** right now.


| state | who / when | tools | count |
|---|---|---|---|
| **S0** | signed out | get_signin_status | 1 |
| **S1** | employee, no report open | get_session_scope, get_expense_policy, list_expense_reports, create_expense_report, open_expense_report | 5 |
| **S2** | employee, draft open and DIRTY | get_session_scope, get_expense_policy, list_expense_reports, create_expense_report, open_expense_report, get_open_report, add_expense_line, update_expense_line, remove_expense_line, list_receipts, link_receipt, validate_expense_report | 12 |
| **S3** | employee, draft open and CLEAN | get_session_scope, get_expense_policy, list_expense_reports, create_expense_report, open_expense_report, get_open_report, add_expense_line, update_expense_line, remove_expense_line, list_receipts, link_receipt, validate_expense_report, submit_expense_report | 13 |
| **S4** | employee, report submitted | get_session_scope, get_expense_policy, list_expense_reports, create_expense_report, open_expense_report, get_open_report | 6 |
| **S5** | auditor | get_session_scope, get_expense_policy, list_expense_reports, get_report, get_open_report, get_day_book | 6 |

`S2` and `S4` are both six-and-under and they are not the same set — `S4` keeps
`get_open_report` and loses every editing tool, which is what "submitted reports expose no
editing tools" means constructively. `S3` differs from `S2` by exactly one tool,
`submit_expense_report`, and that door opens only when the verdict is clean and the report has
lines. That is the demonstrable claim of the whole project and it is one row of this table.

## 2. The sixteen tools

The distinct-tool count is **16**, and it became 16 on Day 1: R-9 option (B) removed
`open_expense_report` from the auditor surface — it mutates `openReportId` and appends to the
day book, so it is not side-effect-free — and added `get_report`, which is. That is node **T6**.

| tool | read-only | states | description budget |
|---|---|---|---|
| `get_signin_status` | yes | S0 | 264 / 500 |
| `get_session_scope` | yes | S1 S2 S3 S4 S5 | 263 / 500 |
| `get_expense_policy` | yes | S1 S2 S3 S4 S5 | 307 / 500 |
| `list_expense_reports` | yes | S1 S2 S3 S4 S5 | 115 / 500 |
| `create_expense_report` | NO | S1 S2 S3 S4 | 222 / 500 |
| `open_expense_report` | NO | S1 S2 S3 S4 | 142 / 500 |
| `get_open_report` | yes | S2 S3 S4 S5 | 205 / 500 |
| `add_expense_line` | NO | S2 S3 | 224 / 500 |
| `update_expense_line` | NO | S2 S3 | 178 / 500 |
| `remove_expense_line` | NO | S2 S3 | 96 / 500 |
| `list_receipts` | yes | S2 S3 | 217 / 500 |
| `link_receipt` | NO | S2 S3 | 157 / 500 |
| `validate_expense_report` | yes | S2 S3 | 224 / 500 |
| `submit_expense_report` | NO | S3 | 306 / 500 |
| `get_report` | yes | S5 | 307 / 500 |
| `get_day_book` | yes | S5 | 211 / 500 |

**R-20, COMPUTED AND NOT HARD-CODED.** The write set is every tool whose
`annotations.readOnlyHint !== true`. Counted from the table above that is **SEVEN**:
`create_expense_report`, `open_expense_report`, `add_expense_line`, `update_expense_line`,
`remove_expense_line`, `link_receipt`, `submit_expense_report`. The phrase "the five write
tools" is a **retracted claim** and is in `kb/webmcp/RETRACTED.txt` for that reason. Any
document that needs this number derives it the way this paragraph does.

**The auditor set is read-only BY CONSTRUCTION, not by hint.** All six of `S5` carry
`readOnlyHint === true`, and `tests/surface.test.mjs` proves the stronger property: it runs
every tool the auditor actually has and asserts neither `openReportId` nor the day book moved.
The annotation is a label on a fact, not a request to a model.

**Every description is inside the official 500-char budget**, largest 307. The budget is
enforced independently by node G4's `tools/lint-layer0.mjs`; this table records the margin so a
later edit that eats it is visible in a diff.

## 3. What downstream may rely on

| consumer | node | may rely on |
|---|---|---|
| T1 | I2 | the tool names and per-state membership in §1 and §2, and the violation envelope |
| S1 | I3 | the session/scope split behind `get_session_scope` and the state ids `S0`–`S5` |
| S4 | I3 | the seven-tool write set of §2, computed as stated, on every write path |
| T3 | I2 | the absence register — a name in §2 that is NOT in the current state's row |

## 4. What is NOT frozen here

Descriptions may be re-worded inside the 500-char budget without a ticket; the **names**, the
**per-state membership** and the **read-only column** may not. The violation envelope is frozen
separately as `erp/contracts/violation.schema.json` — **singular**, and the plural spelling is
dead everywhere.
