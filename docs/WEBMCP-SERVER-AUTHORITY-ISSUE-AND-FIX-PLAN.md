> **RESOLVED**
>
> Fixed in commits `9471552` and `23dab22`.
> Live verification on 2026-09-01:
> - unknown report at sign open: HTTP 404 `E_REPORT_NOT_FOUND`;
> - known over-limit report at sign open: HTTP 422 `E_NOT_CLEAN`;
> - line edit during an open sign request: HTTP 423 `E_SIGN_IN_PROGRESS`.
> This document is retained as the disclosure record.
> The unchecked boxes below describe the plan at the time, not current status.

# WebMCP server-authority security issue and fix plan

This is a focused, single-issue execution plan for GPT-5.6 Sol High. It is
narrower than `docs/CODEX-MULTI-AGENT-FIX-PLAN.md`; do not expand this task into
that roadmap or unrelated cleanup.

## Execution contract

Implement the recommended fix end to end. Read all applicable `AGENTS.md`
instructions first, preserve unrelated worktree changes, add no dependency
without approval, and do not stop after adding only a guard to `/api/sign`.
The issue is fixed only when the normal WebMCP product path persists and signs
server-owned state.

## GitHub issue draft

### Title

`[Security][High] WebMCP submission can commit a client-only report and forge audit provenance`

### Suggested labels

`security`, `webmcp`, `high-priority`, `data-integrity`

### Classification

- Severity: High
- Confidence: Confirmed by local end-to-end reproduction
- CWE: CWE-602 (Client-Side Enforcement of Server-Side Security), CWE-345
  (Insufficient Verification of Data Authenticity)
- Affected revision: `317a08e629f8eee91330e227e3ecd0efdc106871`

### Summary

The registered WebMCP tools mutate a browser-local `createErp()` instance, but
the sign endpoint and commit kernel accept that client-owned report as a
fallback when no corresponding server report exists. A clean client-supplied
report can therefore be signed, committed, and appended to the server day book
even though the server report store has never contained it.

The same path accepts client-authored receipt hashes and provenance values. A
caller can label every field `human`, and the committed artifact reports those
fields as human-authored. The normal `submit_expense_report` path has the dual
failure: its local report has no server provenance map, so the committed result
reports all fields as unset.

This violates the application's core claims that writes are re-authorized
against server state, provenance is assigned by the server, and commit
re-canonicalizes the live server report.

### Relevant WebMCP threat model

The 26 August 2026 WebMCP draft explicitly calls out tool implementations as
attack targets and warns that the WebMCP path can have different validation or
security checks from the UI path:

- https://webmachinelearning.github.io/webmcp/#tool-implementation-as-attack-targets
- https://webmachinelearning.github.io/webmcp/#security-and-privacy-considerations

WebMCP agents inherit the browser's authenticated session. Consequently,
browser mediation, tool registration, `inputSchema`, and annotations are not
server authorization boundaries.

### Root cause

1. `src/page/register.js` creates the authoritative working report in a local
   `createErp()` instance.
2. The write tools in `src/page/tools/defs.js` mutate that local instance rather
   than the server report store.
3. `src/page/sign-install.js::buildOpenBody()` serializes the local report into
   the sign request.
4. `server/index.mjs` chooses
   `reportProjection(body.report_id) ?? body.report`, promoting client content
   to the report used for signing when the ID is absent server-side.
5. `server/sign.mjs::commit()` chooses
   `getLiveReport(rec.report_id) ?? rec.snapshot.report`, so the missing server
   state is silently replaced by the previously accepted client snapshot.
6. `server/sign.mjs::authoritativeReport()` validates the shape and policy but
   accepts `line.provenance` and `receipt_sha256` from that client report. Shape
   validation and canonicalization establish consistency, not authenticity.

### Confirmed reproduction

Against the default `createApp()` wiring:

1. Log in as the employee persona.
2. Confirm `GET /api/reports/RP-FORGED-WEBMCP` returns 404.
3. Send `POST /api/sign` with that ID and a clean report body whose 20 line
   provenance fields are all `human`.
4. Complete the existing same-session sign response and commit flow.
5. Observe:

```text
report before sign: 404
sign open:           200
sign respond:        200
commit:              200 committed
provenance summary:  20 human / 0 agent / 0 seed
report after commit: 404
day-book entry:      signed & submitted RP-FORGED-WEBMCP
```

A second reproduction through the actual `createToolset()`
`submit_expense_report` dispatch returned `Signed and submitted` for local
`RP-1018`; the server still returned 404 for that report while its day book
contained `signed & submitted RP-1018`.

The reproduction does not claim a new human-presence bypass. The repository
already documents that a same-session caller able to obtain the dialog token
can answer the sign request. This issue is independent: even a genuine click is
currently signing client-owned, non-persistent state and can attest forged
provenance.

### Impact

- A committed audit-chain entry can name a report that does not exist in the
  server report store.
- Client-controlled report fields, receipt identifiers/hashes, and provenance
  can enter a signed snapshot.
- The artifact can falsely count agent-authored fields as human-authored.
- The normal WebMCP path can report all provenance as unset even after agent
  writes.
- Policy validation still runs, but it validates attacker-selected content; it
  does not restore source authenticity or server ownership.

### Expected behavior

- A sign request references an existing, authorized, draft report by ID only.
- The server builds report content, provenance, receipt metadata, revision,
  policy identity, and verdict solely from its own current state.
- Commit fails atomically if that server state is missing or changed; there is
  no snapshot fallback.
- Every WebMCP write is persisted and authorized by the server before the tool
  returns success or updates the visible local projection.
- A successful commit transitions that same server report to `submitted` and
  the report remains readable with the committed artifact.

## Fix design decision

### Considered approaches

1. **Server-authoritative WebMCP and UI path — selected.** Route every mutation
   through one server domain service, keep browser state as a projection, and
   sign by report ID. This closes the trust-boundary defect and preserves the
   product's audit claims.
2. **Reject unknown IDs only.** Small patch, but it breaks the current normal
   WebMCP flow because those reports exist only in the browser and leaves two
   mutation paths with different validation and provenance.
3. **Deliberately sign client documents.** This would require removing or
   weakening the server-state and provenance claims and still would not
   authenticate receipt metadata. It does not meet the current product model.

Use approach 1. Do not ship approach 2 as the final fix.

## Implementation plan

### Phase 0 — protect the baseline

- [ ] Re-read the current versions of every file before editing it.
- [ ] Record `git status --short --branch`; preserve `.playwright-mcp/`,
      `.team/contracts/E6.txt`, and any later unrelated changes.
- [ ] Run `npm test` and record the baseline totals. At the affected revision the
      result is 244 passing tests, zero failures, skips, cancellations, or TODOs.
- [ ] Re-run the reproduction as an automated test and make sure it fails for
      the security reason, not because the test fixture is malformed.

### Phase 1 — add red security tests first

Add focused integration coverage, preferably in a new
`tests/acceptance/server-authority.test.mjs` so the complete client-to-server
invariant is visible in one place.

- [ ] Prove `POST /api/sign` for an unknown report returns 404 and creates no
      sign record, lock, commit, or day-book entry, even when `body.report` is a
      clean, schema-shaped report.
- [ ] Create a real report through the server, then send a conflicting
      `body.report`, `body.verdict`, `body.revision`, `body.policy_version`, and
      `body.policy_digest`; require 400 `E_BAD_SIGN_REQUEST` and no state change.
- [ ] Attempt to flip line provenance from `agent` to `human` in the sign body;
      prove the client value cannot enter the snapshot or artifact.
- [ ] Attempt to invent `receipt_id` and `receipt_sha256`; prove signing cannot
      use receipt metadata absent from the server receipt store.
- [ ] Exercise the real `createToolset()` write and submit flow against
      `createApp()`; after each tool success, read the same server report and
      assert equal content, revision, and provenance.
- [ ] Prove a successful commit leaves the server report readable with status
      `submitted`, the returned artifact, and a matching day-book entry.
- [ ] Prove a missing live report at commit never falls back to the signed
      snapshot and appends nothing.

The tests must assert negative state as well as status codes: report store,
provenance ledger, locks, sign records, revision, and chain length/head.

### Phase 2 — establish one server-owned report aggregate

Use `server/store.mjs` or a small `server/expense-service.mjs` facade as the one
authority. Do not leave `seedState().reports`, `reportStore`, and browser ERP as
three independently mutable report stores.

- [ ] Store owner, status, report fields, all line fields, receipt metadata,
      provenance, revision, and artifact in one server-owned aggregate. The
      page's selected report ID may remain local view state, but it must never
      authorize access or supply report content.
- [ ] Make Domain, Editor, and Signed projections derive from that aggregate;
      return copies so HTTP callers cannot mutate stored objects by reference.
- [ ] Move report creation, open, line add/update/remove, receipt link, policy
      validation, revision bump, and status transition behind one service.
- [ ] Derive write provenance from the authenticated route/tool being executed.
      Never accept `source`, `actor`, `tool`, provenance maps, revision, owner,
      status, receipt hashes, totals, or converted amounts from a client.
- [ ] Authorize the session against the target report on every read and write.
      Keep auditor reads explicit and keep employee writes owner-scoped.
- [ ] Reject unknown and extra write fields instead of silently dropping them.
      Reuse existing validators; do not add a runtime schema dependency without
      approval.

### Phase 3 — close the sign and commit boundary

- [ ] Change the public sign-open body to the minimum required reference,
      normally `{report_id}` plus non-authoritative presentation metadata only
      if still necessary.
- [ ] In `server/index.mjs`, reject client authority fields (`report`, `verdict`,
      `revision`, `policy_version`, `policy_digest`) with 400
      `E_BAD_SIGN_REQUEST`. Do not ignore them silently.
- [ ] Change `createSignGate().open()` so it obtains the report through its
      injected server-state reader using `reportId`; remove the public `report`
      argument.
- [ ] Build the signed projection, policy identity, verdict, provenance, totals,
      and revision entirely inside the server boundary.
- [ ] Delete the `getLiveReport(...) ?? rec.snapshot.report` fallback. Missing
      live state must be a refusal before chain publication.
- [ ] At commit, re-read the same aggregate, re-authorize it, revalidate policy,
      compare the snapshot, transition the report to `submitted`, store the
      artifact, and append the prepared chain entry as one failure-atomic
      operation.
- [ ] Preserve the existing lock, expiry, one-shot response, policy-movement,
      and snapshot-mismatch behavior.

### Phase 4 — cut the WebMCP and human UI paths over to the server

- [ ] Add a small same-origin API client module for JSON requests and response
      validation. It must always use the existing session cookie and propagate
      the tool invocation's abort signal.
- [ ] Convert every WebMCP write in `src/page/tools/defs.js` to call that API.
      The tool may update the local view and return success only after the server
      accepts the mutation and returns its fresh projection.
- [ ] Keep the synchronous surface compiler by treating local browser state as
      a cache of server responses, never as authority. Hydrate it on session
      changes, report opens, successful writes, and commit.
- [ ] Remove the full report, verdict, policy identity, and revision from
      `buildOpenBody()`; the sign provider should send the report ID only.
- [ ] Persist human edits through explicit human UI routes so the signed server
      projection is the same content the dialog renders.
- [ ] When a human attaches a receipt, persist only the documented metadata
      required by the current product (filename, size, browser-computed SHA-256)
      through a page-only route that is not registered as a WebMCP tool. Keep
      the existing disclosure that the server does not receive or verify bytes.
- [ ] Make `list_receipts` and `link_receipt` use server-issued receipt IDs;
      refuse missing, already-linked, or unauthorized IDs server-side.
- [ ] Preserve current tool names, descriptions, annotations, output budgets,
      dynamic registration lifecycle, and surface membership unless a contract
      change is strictly required.

### Phase 5 — remove the insecure paths completely

- [ ] Delete production use of `body.report`, `body.verdict`, client policy
      claims, and client revision claims at sign open.
- [ ] Delete production fallback to `rec.snapshot.report` at commit.
- [ ] Delete direct local report mutations from WebMCP execute callbacks.
- [ ] Delete any compatibility shim that permits a client-only report to sign or
      commit; all in-repo callers can be updated together.
- [ ] Update stale comments and docs that say server authorization already backs
      every write. Do not weaken the claim to hide an incomplete fix.

## Acceptance criteria

- [ ] The original unknown-report reproduction stops at sign open with 404 and
      the day book remains unchanged.
- [ ] The normal WebMCP `create -> add/update/link -> validate -> submit` flow
      reads and mutates one server-owned report throughout.
- [ ] After each successful tool write, `GET /api/reports/:id` reflects the same
      content and a server-derived `agent` provenance entry.
- [ ] No sign or commit request can provide report content, provenance, receipt
      hashes, owner, status, totals, revision, verdict, or policy identity.
- [ ] Commit has no client-snapshot fallback and publishes nothing on any
      precondition failure.
- [ ] A successful commit changes the existing server report to `submitted`,
      persists its artifact, and appends exactly one matching chain entry.
- [ ] Auditor sessions still have a read-only WebMCP surface and receive 403 on
      every write route.
- [ ] Tool surface counts and membership remain `2 / 6 / 13 / 14 / 7 / 7` for
      S0 through S5, including `explain_missing_tool`.
- [ ] No confirmation token, snapshot digest, or internal receipt bytes leak
      through a registered tool result.

## Required verification

Run all applicable checks and report exact results:

```sh
npm test
node --test tests/acceptance/server-authority.test.mjs
bash tests/acceptance/curl-403.sh
bash tests/acceptance/toctou.sh
node tools/check-toplevel.mjs --selftest
node tools/validate-contracts.mjs
git diff --check
```

Run these negative searches over production paths. They must find no active
authority path; test fixtures and this issue document may contain the strings:

```sh
rg -n 'reportProjection\(body\.report_id\) \?\? body\.report|body\.verdict|body\.policy_(version|digest)' server src
rg -n 'getLiveReport\([^)]*\) \?\? rec\.snapshot\.report' server src
rg -n 'erp\.(createReport|addLine|updateLine|removeLine|linkReceipt)\(' src/page/tools src/page/register.js
```

If a compatible Chrome/WebMCP runtime is available, also run the real browser
surface and product-flow checks. If it is unavailable, state that explicitly;
do not present fallback-agent coverage as real browser coverage.

## Non-goals

- Replacing the intentionally simple demo login with production SSO.
- Claiming proof that a person clicked the sign dialog.
- Adding durable storage or multi-instance coordination.
- Redesigning the tool catalogue or dynamic surface state machine.
- Fixing separate output-injection annotation or security-header findings.
- Implementing the broader multi-agent roadmap.

## Final handoff requirements

The implementing model's final response must state:

1. Whether the server is now the sole authority for the WebMCP product flow.
2. Which insecure fallbacks were deleted.
3. The exploit regression's exact result before and after the fix.
4. Full test totals and every skipped verification step.
5. Any remaining trust limitation without upgrading it into a guarantee.
