# outpocket — Codex Multi-Agent Fix Plan

Status: ROADMAP — NOT the record of work that landed.
Execution status: A SUBSET was executed on 2026-08-30 on branch `codex/ship`.

> **Read this first.** What actually landed is the P0 slice only: server-computed
> verdicts with 422 `E_NOT_CLEAN`, the provenance store wired into the write
> routes, two-phase chain publication, the page's submit and day book routed
> through the server, the UI copy scrub, and the judge-facing docs. See the
> commits on `codex/ship`.
>
> **NOT executed, and still the right next work:** the WorkspaceAggregate and
> per-workspace mutation queue, idempotency (G0.7), workspace isolation, the
> Wave 2A header/CSP pass, all of Wave 3 including `harness/drive.mjs
> --product-flow`, and the Wave 6 skeptics. Sections 2-16 below describe that
> work, not work that has been done.
>
> Three defects in this document were found before it was partially executed and
> are NOT fixed in the text below: Wave 7 gates on `harness/drive.mjs
> --product-flow`, a flag no wave creates; nothing in the plan pushes, merges or
> deploys, so its Definition of Done can be met while the judged artifact is
> untouched; and the branch name it specifies is not a seat branch, so
> `.githooks/pre-commit-ownership` skips instead of firing.
Written: 2026-08-30  
Workspace: /Users/calebwei/mcp/outpocket  
Maximum concurrency: 4 active agents, including Root

> This is an execution plan, not evidence that the fixes have landed.
> Root is the only command runner, contract editor, committer, and generated-artifact
> owner. Worker agents edit only their exact file allowlists. Every wave ends at a
> barrier before any command, formatter, generator, integration edit, or next wave.

---

## 0. Scope and cut line

### P0 — mandatory correctness

- [ ] The server is the sole authority for reports, receipts metadata, revisions,
      verdicts, sign records, committed artifacts, and the daybook chain.
- [ ] Sign and commit are atomic, concurrency-safe, recoverable, and idempotent.
- [ ] Each browser gets an isolated workspace; Chen and Ruiz share a workspace only
      when the same browser switches persona.
- [ ] A real Chrome/WebMCP product flow succeeds:

~~~text
document.modelContext
  -> WebMCP tool invocation
  -> same-origin HTTP mutation
  -> sign dialog
  -> server commit
  -> browser reload
  -> Ruiz audit
  -> server daybook and verified chain
~~~

If any P0 item is not proved, the release is NO-GO.

### P1 — release hardening

- [ ] Production cookie and security headers are correct.
- [ ] Strict CSP is enabled only after all inline blockers are removed.
- [ ] UI copy contains no test paths, internal node labels, source paths, or
      unknown-policy placeholders.
- [ ] The product describes a demo-session response honestly and makes no
      personhood or real-identity claim.
- [ ] The committed tool-surface export has no drift.
- [ ] README and Judge Guide describe only verified behavior.

### P2 — independent enhancements

- [ ] WebMCP titles.
- [ ] Explicit readOnlyHint:false on write tools.
- [ ] Exact untrustedContentHint annotations.
- [ ] Signed-out surface inspector.
- [ ] A stable active-project enum.
- [ ] Optional Origin-Agent-Cluster and Permissions-Policy headers, but only after
      real Chrome/WebMCP verification.

P2 work must be isolated in its own checkpoint so it can be cut without weakening
P0. It must never be used as evidence that P0 is complete.

### Explicit non-goals

- Demo video, YouTube upload, narration, storyboard, and video scripts.
- WebAuthn or proof of personhood.
- Multi-instance consistency.
- Persistence across server-process restarts.
- A new database, queue, package, or runtime dependency.
- Server-side storage of raw receipt bytes in this fix.

Do not create or modify:

~~~text
docs/VIDEO-SCRIPT.md
docs/STORYBOARD.md
tools/check-storyboard.mjs
~~~

---

## 1. Verified starting point

The pre-fix audit established:

- npm test passes 229/229 component and partial-integration tests.
- node tools/lint-layer0.mjs passes.
- node tools/export-surface.mjs --check fails because the committed export drifts
  from a fresh generation.
- WebMCP write tools currently mutate browser-local ERP state.
- The browser sign flow does not call POST /api/reports/:id/commit.
- The browser daybook is a local FNV log while the server has a separate SHA-256
  chain.
- A malformed provenance snapshot can return HTTP 500 after chain/sign state has
  already mutated.
- sessions, report state, sign gate, locks, and chain are currently app-global.
- the working tree has user-owned untracked paths:

~~~text
.playwright-mcp/
.team/contracts/E6.txt
~~~

The green 229-test baseline is regression evidence only. It is not product-flow
evidence.

---

## 2. Architecture decision

### Chosen design

Use one server-side WorkspaceAggregate as the only mutable truth:

~~~text
WorkspaceAggregate
  reports
  receipts
  counters
  signRecords
  activeSignByReport
  chain
  idempotencyRecords
  lastAccess
  expiryState
~~~

The global session index contains only:

~~~text
sid -> { workspaceId, personaId, expiresAt }
~~~

Every workspace write goes through:

~~~text
runWorkspaceMutation(workspaceId, mutation)
~~~

The operation:

1. enters a per-workspace serial queue;
2. reads one immutable current aggregate;
3. performs all validation, canonicalization, digest work, and response building;
4. creates one complete next aggregate with copy-on-write;
5. publishes it with one synchronous workspaceMap.set();
6. returns the already-built response.

There must be no await between reading the aggregate and publishing the next
aggregate. Different-report commits are serialized by the workspace queue, so
they cannot read the same chain tail and fork the chain.

### Projection rule

- ReportDomain is the only mutable report truth.
- EditorProjection is derived on read and is never persisted.
- Verdict is computed by the server from ReportDomain and the served policy.
- SignedSnapshot is generated once at sign-open, deep-frozen, and referenced by
  digest.
- DaybookEntry is built only from that SignedSnapshot during commit.
- HTTP responses return clones, never internal mutable references.
- The browser keeps a view cache and the currently selected report id only.

### Receipt boundary

This fix stores filename, size, and a browser-computed SHA-256 value as
workspace-scoped metadata. The server is authoritative over the recorded metadata
and its provenance, but the chain does not prove that the server received or
verified the attachment bytes. UI and docs must say so. Server-side byte upload
and hashing is a separate future workstream.

---

## 3. Wave 0 — Root preflight and contract freeze

No worker may start until every G0 checkbox is complete.

### G0.1 — protect the current workspace

- [ ] Record git status --short --branch.
- [ ] Record the current HEAD and origin/main.
- [ ] Preserve the current ahead commit; do not recreate work from origin/main.
- [ ] Create codex/authoritative-workspace-fix from the current HEAD.
- [ ] Record the complete dirty and untracked list.
- [ ] Mark .playwright-mcp/ and .team/contracts/E6.txt as user-owned.
- [ ] Never use git add ., git add -A, reset, checkout --, or force push.
- [ ] Put browser profiles and evidence in mktemp-created directories.

### G0.2 — caller closure

Root searches at least three ways before freezing ownership:

1. exact symbols, including createErp, submitOpenReport, createSignGate,
   state.reports, state.dayBook, and fnv1a;
2. import paths, route strings, aliases, and method substrings;
3. git log -S for the same symbols and route contracts.

- [ ] Every production caller of the local ERP mutation API is assigned.
- [ ] Every server consumer of report state, locks, sign state, and chain is
      assigned.
- [ ] Every test or harness caller is assigned to a later test owner.
- [ ] No task card contains "maybe", wildcard expansion, or an unnamed new file.

### G0.3 — root-only files

Only Root may edit:

~~~text
erp/contracts/**
erp/CONTRACTS.md
erp/graph.json
package.json
package-lock.json
pnpm-lock.yaml
artifacts/tools.export.json
~~~

Root reads each complete contract file before editing it, follows the existing
amendment/freeze procedure, and recalculates hashes with project tooling.

### G0.4 — canonical persona and claim

- [ ] server/personas.json is the only persona authority.
- [ ] The auditor display name is Elena Ruiz everywhere.
- [ ] Chain source is server, not human.
- [ ] The permitted claim is:

> The server recorded the current demo session's response to this exact snapshot.

- [ ] confirm_token is described as an anti-confusion nonce, not evidence of
      personhood, real identity, browser presence, or a physical click.
- [ ] signed_by, if retained for schema compatibility, is documented as the demo
      session display name.

### G0.5 — HTTP contract

All DTOs use additionalProperties:false or equivalent strict boundary validation.
Unknown authority fields are rejected rather than ignored.

| Method and path | Frozen request | Frozen response/behavior |
|---|---|---|
| GET /api/me | none | current persona and role |
| GET /api/session-scope | none | server-owned name, role, cost center, projects, approver, currency |
| GET /api/reports | none | visible ReportSummary array |
| GET /api/reports/:id | none | report, verdict, editor, provenance, sanitized active_sign |
| POST /api/reports | title, project | authoritative report, verdict, revision |
| POST /api/reports/:id/open | empty object | validate access, return authoritative report/view; no content revision bump |
| POST /api/reports/:id/lines | line fields; If-Match | authoritative report, verdict, revision |
| PATCH /api/reports/:id/lines/:lineId | allowed line fields; If-Match | authoritative report, verdict, revision |
| DELETE /api/reports/:id/lines/:lineId | If-Match | authoritative report, verdict, revision |
| GET /api/receipts | none | current workspace receipt metadata |
| POST /api/receipts | filename, size, sha256 | server-created receipt id and recorded metadata |
| POST /api/reports/:id/lines/:lineId/receipt | receipt_id; If-Match | authoritative report, verdict, revision |
| POST /api/sign | report_id; If-Match; Idempotency-Key | server-built sign_request and ticket |
| POST /api/sign/continue | existing frozen ticket fields | existing frozen continuation result |
| GET /api/sign/:id | none | session-scoped request state, never confirm_token |
| GET /api/sign/:id/confirm-token | none | dialog-only token channel; Cache-Control:no-store |
| POST /api/sign/:id/respond | frozen response fields; Idempotency-Key | recorded session response |
| POST /api/reports/:id/commit | request_id; Idempotency-Key | frozen commit_result; no extra report field |
| GET /api/daybook | none | entries, head, verification |
| GET /api/state-digest | none | deterministic digest of this workspace only |

Authority fields forbidden in client mutation bodies include:

~~~text
owner
workspace
status
revision
verdict
policy_version
policy_digest
snapshot_digest
active_sign
signed_by
artifact
~~~

Every successful report mutation returns:

~~~text
{ report, verdict, revision, receipts? }
~~~

### G0.6 — revision and sign state machine

Use the existing frozen rejection status where it already exists:

- E_REVISION_MISMATCH: HTTP 409.
- E_SIGN_IN_PROGRESS: HTTP 423.
- E_SNAPSHOT_MISMATCH: HTTP 409.
- E_POLICY_VERSION_MOVED: HTTP 409.
- E_POLICY_DIGEST_MOVED: HTTP 409.
- E_NOT_CLEAN: HTTP 422.
- E_FORBIDDEN: HTTP 403.
- E_SIGN_REQUEST_UNKNOWN: HTTP 404.
- E_SIGN_REQUEST_EXPIRED: HTTP 410.

The state machine is:

~~~text
draft(revision N)
  -> signing(request_id, revision N, immutable snapshot)
  -> ready_to_commit(request_id)
  -> submitted/committed(chain entry)
~~~

Rules:

- [ ] Sign-open, active-sign binding, report lock, revision freeze, snapshot, and
      idempotency response are one workspace transaction.
- [ ] A signed-relevant mutation during signing returns E_SIGN_IN_PROGRESS.
- [ ] The sign record stores an immutable report projection, verdict projection,
      revision, policy version, policy digest, snapshot digest, actor, and expiry.
- [ ] Commit re-reads current server Domain, current policy, current revision, and
      active-sign binding inside the workspace queue.
- [ ] The server fails closed if current policy version or digest moved.
- [ ] Provenance summary, canonical bytes, chain candidate, artifact, and complete
      commit_result are computed before publication.
- [ ] Technical failures leave report, sign state, chain, lock, and idempotency
      table unchanged.
- [ ] Expected decline/expiry/policy-invalidated transitions may atomically change
      sign state and release the lock, but must not write report status or chain.
- [ ] A successful commit publishes report, sign record, chain, and idempotency
      result together.

### G0.7 — idempotency

Open, respond, and commit require Idempotency-Key.

Scope:

~~~text
(workspaceId, personaId, route, key)
~~~

Rules:

- [ ] Store payload hash, HTTP status, and the complete response.
- [ ] Same key plus same payload replays the exact first response.
- [ ] Same key plus different payload returns 409 E_IDEMPOTENCY_CONFLICT.
- [ ] Respond replay lookup occurs before confirm-token-consumed checks.
- [ ] Commit replay returns the byte-identical first commit_result.
- [ ] A different key for the same session/report/revision/snapshot resumes the
      existing active sign rather than returning an internal-state error.
- [ ] A conflicting actor, revision, or snapshot does not resume it.
- [ ] Idempotency records live until workspace expiry.

### G0.8 — workspace and session model

- [ ] First login without a valid session creates a high-entropy workspace id and
      a new SID.
- [ ] Persona switch with a valid SID keeps workspaceId, rotates SID, and deletes
      the old SID.
- [ ] workspaceId is never accepted from body, query, or a client-controlled
      header.
- [ ] All report, receipt, sign, commit, daybook, and state-digest lookups resolve
      workspace from SID first.
- [ ] Cross-workspace resource access returns 404.
- [ ] New browser profiles receive separate workspaces.
- [ ] A workspace with an active lock, respond, or commit cannot be reaped.
- [ ] Idle TTL and capacity cleanup use an injectable clock.
- [ ] No public global-reset endpoint is added.

### G0.9 — client adapter contract

- [ ] src/erp.js becomes an API-backed view store, not a second business model.
- [ ] It cannot generate authoritative ids, revisions, verdicts, status,
      confirmation, artifact, or daybook entries.
- [ ] Client writes are serialized per page.
- [ ] Cache accepts only the current session generation and a non-decreasing
      revision.
- [ ] HTTP failure never produces a local success or ghost mutation.
- [ ] Revision conflict forces a refresh and is not automatically replayed.
- [ ] sessionStorage keeps idempotency keys and pending request identity across a
      reload.
- [ ] Auditor report/daybook reads always refresh from the server.
- [ ] Surface compilation consumes a pure SurfaceContext, not a mutable local ERP
      world.

### G0.10 — worker prompt contract

Every worker prompt must include:

> You are not alone in this repository. Modify only the exact owned paths listed
> below. Do not revert, overwrite, stage, commit, format, or repair another
> agent's files. Do not add dependencies. Do not run shell commands, tests,
> builds, servers, browser automation, formatters, or generators. Read every
> owned file completely before editing it, and re-read it before a second edit.
> Report out-of-scope callers to Root; do not edit them. Return STATUS, changed
> files, contract assumptions, unresolved callers, and Root verification steps.

Allowed statuses:

~~~text
DONE
DONE_WITH_CONCERNS
BLOCKED
UNVERIFIABLE
~~~

Wave 1 may start only after G0 is complete and Root has copied the frozen contract
into every worker task.

---

## 4. Execution DAG

~~~text
Wave 0  Root contract freeze and caller closure
  |
  +-- Wave 1A  ServerCore
  +-- Wave 1B  ClientCutover
  +-- Wave 1C  UI/CSP-prep
  |
  +-- Barrier 1: stop all writers; Root review and focused verification
  |
  +-- Root contract amendment checkpoint
  |
  +-- Wave 2A  SecurityHeaders
  +-- Wave 2B  ToolSurface
  +-- Wave 2C  TestInfra
  |
  +-- Barrier 2: stop all writers; Root review and focused verification
  |
  +-- Wave 3A  Sign/Atomicity tests
  +-- Wave 3B  Authority/Security tests
  +-- Wave 3C  Product/WebMCP tests
  |
  +-- Barrier 3: Root runs all tests and routes failures to original owners
  |
  +-- Wave 4  Root source checkpoint, export generation, artifact-only checkpoint
  |
  +-- Wave 5  Docs/claims
  |
  +-- Wave 6A  Correctness skeptic
  +-- Wave 6B  Security skeptic
  +-- Wave 6C  Contract/release skeptic
  |
  +-- Wave 7  Root final release gates
~~~

Root must not inspect a "final diff", run a generator, or run tests while any
writer in the current wave is active. Agents share one filesystem; there is no
private merge step.

---

## 5. Wave 1 — core implementation

### Wave 1A — ServerCore

Owner: server_core

Exact owned paths:

~~~text
server/index.mjs
server/store.mjs
server/provenance.mjs
server/seed.mjs
server/authz.mjs
server/sign.mjs
server/chain.mjs
server/locks.mjs
server/recanon.mjs
server/personas.json
server/routes/policy.mjs
server/routes/state-digest.mjs
NEW server/expense-service.mjs
NEW server/workspaces.mjs
~~~

Forbidden: src/**, tests/**, harness/**, erp/contracts/**, artifacts/**, docs/**.

Deliverables:

- [ ] One WorkspaceAggregate and one mutation queue per workspace.
- [ ] Complete report, receipt-metadata, provenance, revision, and status store.
- [ ] Pure Domain, Editor, and Signed projections.
- [ ] Server policy validation and verdict computation for every write.
- [ ] buildAuthoritativeState() from server state only.
- [ ] Atomic sign-open and atomic commitSignedReport().
- [ ] Open/respond/commit idempotency.
- [ ] Workspace-scoped reports, locks, signs, chain, daybook, and state digest.
- [ ] Persona switch preserves workspace and rotates SID.
- [ ] No global state or provided global sign-gate compatibility shim.
- [ ] Cross-workspace existence is concealed with 404.
- [ ] Chain source and labels use honest server/session language.
- [ ] Receipt metadata claim remains narrow and explicit.

Required negative self-review:

- [ ] No route passes body.report, body.verdict, body.revision, body.policy_version,
      or body.policy_digest into the sign kernel.
- [ ] No lock module owns a second revision map.
- [ ] No chain append mutates seq/head/entries before digest succeeds.
- [ ] No commit constructs response or provenance after publication.
- [ ] No mutable store object escapes through an HTTP response.

### Wave 1B — ClientCutover

Owner: client_cutover

Exact owned paths:

~~~text
src/erp.js
NEW src/page/api.js
src/page/tools/defs.js
src/page/register.js
src/page/sign-bridge.js
src/page/sign-install.js
~~~

Forbidden: server/**, src/page/ui/**, src/page/index.html, tests/**,
erp/contracts/**, tools/export-surface.mjs, artifacts/**, docs/**.

Deliverables:

- [ ] Replace production createErp local authority with an API-backed view store.
- [ ] Delete local submit, confirmation, artifact, FNV daybook, and local policy
      verdict authority.
- [ ] Make every write tool async and server-backed.
- [ ] Replace cache only from authoritative server responses.
- [ ] Add If-Match to content writes and sign-open.
- [ ] Add stable Idempotency-Key handling for open/respond/commit.
- [ ] Add submit open -> respond -> commit -> GET-report flow.
- [ ] Refresh daybook from GET /api/daybook.
- [ ] Add session-generation and revision-order guards.
- [ ] Recover active sign after reload.
- [ ] Preserve current report id only as page-view state.
- [ ] Never return confirm_token through a registered WebMCP tool.

Required negative self-review:

- [ ] No submitOpenReport.
- [ ] No fnv1a.
- [ ] No state.dayBook mutation.
- [ ] No local id/revision/verdict/artifact generation.
- [ ] No optimistic cache change on rejected transport.
- [ ] No stale session response can overwrite a newer persona.

### Wave 1C — UI/CSP preparation

Owner: ui_csp_prep

Exact owned paths:

~~~text
src/page/index.html
src/page/skin.css
src/page/ui/shell.js
src/page/ui/receipts.js
src/page/ui/sign-dialog.js
src/page/ui/editor.js
src/page/ui/inspector.js
NEW src/page/bootstrap.js
~~~

Forbidden: server/**, src/erp.js, src/page/register.js, src/page/tools/**,
tests/**, erp/**, docs/**.

Deliverables:

- [ ] Move every inline style into skin.css.
- [ ] Remove every inline event handler.
- [ ] Load modules through external bootstrap error handling.
- [ ] Remove internal node labels, test paths, and source paths from user-visible
      copy.
- [ ] Hide editor and sign regions until their real state exists.
- [ ] Keep the surface inspector visible while signed out.
- [ ] Mount the real editor after authoritative hydration.
- [ ] Fail closed if sign policy version or digest is absent.
- [ ] Remove the policy "?" placeholder.
- [ ] Post receipt metadata through the frozen API.
- [ ] Render all user-controlled values with textContent or an equivalent safe
      text node.

### Barrier 1

Root waits for all three agents to stop, then:

- [ ] Reads every changed file in full.
- [ ] Reviews every diff hunk.
- [ ] Searches every changed symbol and lists callers outside the assigned scope.
- [ ] Confirms each worker stayed inside its allowlist.
- [ ] Runs syntax/import checks.
- [ ] Runs focused server/client/UI tests that still apply.
- [ ] Runs npm test and records every failure verbatim.
- [ ] Classifies failures as intended contract migration or unexpected regression.
- [ ] Sends each defect back to its original owner with followup_task.

Unexpected failures block Wave 2. Known test-contract failures may proceed only
when they have an explicit Wave 3 owner.

---

## 6. Root contract amendment checkpoint

Before Wave 2, Root alone updates any required frozen contracts and hashes.

Mandatory decisions:

- [ ] Preserve frozen sign response and commit_result shapes.
- [ ] Do not add report to commit_result.
- [ ] Use existing source:"server" rather than inventing a new enum.
- [ ] Align success chain entries with additionalProperties:false.
- [ ] Map mismatch details to expected_digest, actual_digest, and diff_paths.
- [ ] Record idempotency semantics without creating a second sign-message shape.
- [ ] Correct confirm-token/personhood residual-risk prose.
- [ ] Amend the tool-export contract before adding title.
- [ ] Include title bytes in export accounting if title is added.
- [ ] Clarify that app_commit means the last commit touching derived surface
      sources; deployment identity remains /version.
- [ ] Update erp/graph.json executable counts from actual MEMBERSHIP, not prose.

Root must not manually edit artifacts/tools.export.json here.

---

## 7. Wave 2 — hardening, surface contract, and test infrastructure

### Wave 2A — SecurityHeaders

Owner: security_headers

Exact owned paths:

~~~text
server/index.mjs
NEW server/security-headers.mjs
~~~

Prerequisite: UI/CSP-prep is complete and Root has performed a full inline
style/handler/script inventory.

Deliverables:

- [ ] Apply common headers before any route or static handler writes its response.
- [ ] Cover HTML, JS, CSS, JSON, HEAD, 2xx, 4xx, and 5xx.
- [ ] Add X-Content-Type-Options:nosniff.
- [ ] Add Referrer-Policy:no-referrer.
- [ ] Add frame-ancestors and X-Frame-Options:SAMEORIGIN.
- [ ] Enforce strict same-origin CSP after blockers are gone.
- [ ] Add HSTS only in explicitly configured production HTTPS mode, without
      includeSubDomains or preload.
- [ ] Issue production __Host-outpocket_sid with Secure, HttpOnly, SameSite=Lax,
      Path=/, and no Domain.
- [ ] Use an explicit non-Secure cookie mode for local HTTP tests.
- [ ] Do not derive production security from Host or X-Forwarded-Proto.
- [ ] Require the configured same Origin on unsafe production requests.
- [ ] Reject unsupported content type and oversized JSON at the boundary.
- [ ] Add Cache-Control:no-store to sensitive sign/session/daybook responses.
- [ ] Enable Origin-Agent-Cluster and Permissions-Policy only if real Chrome
      product-flow tests prove WebMCP still works.

Target CSP:

~~~text
default-src 'self';
script-src 'self';
script-src-attr 'none';
style-src 'self';
style-src-attr 'none';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self';
worker-src 'none'
~~~

### Wave 2B — ToolSurface

Owner: tool_surface

Exact owned paths:

~~~text
src/page/tools/defs.js
src/page/tools/compile.js
src/page/tools/absence.js
src/page/register.js
tools/export-surface.mjs
~~~

Forbidden: erp/contracts/**, artifacts/tools.export.json, server/**, docs/**,
tests/**.

Deliverables:

- [ ] Surface compilation consumes a pure SurfaceContext.
- [ ] tools/export-surface.mjs no longer creates or mutates a production ERP.
- [ ] All 17 tool definitions have short, unique titles if the Root amendment
      approved title.
- [ ] Read tools retain readOnlyHint:true.
- [ ] The seven write tools explicitly carry readOnlyHint:false.
- [ ] untrustedContentHint:true is applied to exactly:

~~~text
list_expense_reports
create_expense_report
open_expense_report
get_open_report
get_report
add_expense_line
update_expense_line
remove_expense_line
list_receipts
link_receipt
validate_expense_report
submit_expense_report
get_day_book
~~~

- [ ] create_expense_report.project gets only the current session's stable active
      project enum.
- [ ] report_id, line_id, and receipt_id do not get volatile dynamic enums.
- [ ] toRegistration(), document.modelContext.getTools(), and export projection
      expose the same title and annotations.
- [ ] Export byte accounting includes every model-visible title byte.
- [ ] No navigator.modelContext alias.
- [ ] No exposedTo without a cross-origin-document requirement.
- [ ] No declarative tools.
- [ ] No generated artifact write.

### Wave 2C — TestInfra

Owner: test_infra

Exact owned path:

~~~text
NEW tests/acceptance/support.mjs
~~~

Deliverables:

- [ ] Random-port HTTP server lifecycle helper.
- [ ] Deterministic close/cleanup.
- [ ] Cookie-jar helper that does not parse a hard-coded cookie name.
- [ ] Two independent workspace/session helpers.
- [ ] Persona-switch helper that captures old and new SID behavior.
- [ ] Explicit local-versus-production security configuration.
- [ ] Fault-injection seam for pre-publication transaction stages.
- [ ] No production behavior, business logic, or assertion helper that can fake a
      product outcome.

### Barrier 2

Root waits for all Wave 2 agents to stop, then:

- [ ] Re-reads every handed-off hotspot before reviewing it.
- [ ] Reviews the full diff.
- [ ] Runs static contract checks.
- [ ] Inventories all remaining inline script/style/event constructs.
- [ ] Starts local HTTP in test mode and production-config mode.
- [ ] Checks security headers on HTML, API, static, HEAD, 401, 404, and 500.
- [ ] Loads the page in Chrome with final CSP and confirms zero CSP violations.
- [ ] Confirms document.modelContext still registers the expected surface.
- [ ] Confirms exporter generation is not run while source is dirty.

---

## 8. Wave 3 — independent test owners

Test agents may edit only tests and harness files. They must not repair production
code. A test must not be weakened, skipped, marked todo, or special-cased to make
the suite green.

### Wave 3A — Sign and atomicity tests

Owner: test_sign_atomicity

Exact owned paths:

~~~text
tests/signature.test.mjs
tests/acceptance/sign-state.test.mjs
tests/acceptance/sign-lock.test.mjs
tests/acceptance/chain.test.mjs
tests/acceptance/confirm-token.test.mjs
tests/acceptance/toctou.sh
~~~

Required cases:

- [ ] Missing provenance returns a stable 4xx and changes no state.
- [ ] Malformed provenance changes no state.
- [ ] Failure injection at canonicalize, provenance, digest, chain preparation,
      response build, and immediately before publish changes no state.
- [ ] The next legal commit after any injected failure still starts from the
      correct chain sequence and head.
- [ ] Open response is dropped; same-key retry returns the same request.
- [ ] Respond response is dropped; same-key retry returns the same response even
      after token consumption.
- [ ] Commit response is dropped; same-key retry returns byte-identical result and
      no second chain entry.
- [ ] Same key with different payload returns E_IDEMPOTENCY_CONFLICT.
- [ ] Same report receives 20 concurrent commits and appends once.
- [ ] Two different reports commit concurrently and append two consecutive,
      non-forking entries.
- [ ] Full chain verification passes after all concurrency cases.
- [ ] Stale revision, snapshot mismatch, and both policy-move cases write no chain.
- [ ] A second conflicting respond still returns E_ALREADY_ANSWERED.

### Wave 3B — Authority, workspace, authorization, and headers

Owner: test_authority_security

Exact owned paths:

~~~text
tests/acceptance/provenance.test.mjs
tests/acceptance/session.test.mjs
tests/acceptance/static.test.mjs
tests/acceptance/curl-403.sh
NEW tests/acceptance/workspace-isolation.test.mjs
NEW tests/acceptance/security-headers.test.mjs
~~~

Required cases:

- [ ] Two cookie jars cannot read or mutate each other's reports.
- [ ] Two workspaces may safely contain the same report id.
- [ ] A's active sign lock does not block B's same-named report.
- [ ] A's sign request and idempotency key are unknown in B.
- [ ] A's daybook entries are absent from B.
- [ ] Chen-to-Ruiz persona switch keeps A's workspace.
- [ ] The pre-switch SID returns 401.
- [ ] A new browser/session gets a clean workspace.
- [ ] Auditor writes return the frozen authorization code.
- [ ] Actor is derived from server session, never response body.
- [ ] Client attempts to set owner, workspace, status, revision, verdict, policy,
      digest, active sign, or artifact are rejected.
- [ ] Malformed cookie, prototype-shaped persona, malformed JSON, oversized JSON,
      and cross-Origin writes produce stable 4xx with no mutation.
- [ ] Static and API responses carry required headers on every status class.
- [ ] Production-cookie fixture includes Secure/HttpOnly/SameSite/Path and no
      Domain.
- [ ] HSTS is present only in production HTTPS configuration.

### Wave 3C — Product path, client, WebMCP, UI, metadata, and harness

Owner: test_product_webmcp

Exact owned paths:

~~~text
tests/helpers.mjs
tests/surface.test.mjs
tests/acceptance/conformance.test.mjs
tests/acceptance/sign-install.test.mjs
tests/acceptance/sign-dialog.test.mjs
tests/acceptance/receipt-channel.test.mjs
tests/acceptance/inspector.test.mjs
tests/acceptance/readme-credentials.test.mjs
NEW tests/acceptance/product-flow.test.mjs
NEW tests/acceptance/judge-guide.test.mjs
harness/drive.mjs
harness/dump-state.mjs
harness/rehearse.mjs
harness/scenarios/happy.json
~~~

Required Node/integration cases:

- [ ] Every registered write tool reaches its frozen server route.
- [ ] A rejected transport produces no cache or UI ghost state.
- [ ] Stale N+1 response cannot overwrite cached N+2.
- [ ] Two tabs editing one revision cannot both succeed.
- [ ] submit performs sign-open, dialog respond, server commit, and report refresh.
- [ ] get_day_book fetches the server chain.
- [ ] Reload hydrates the same submitted report and confirmation.
- [ ] Pending open, pending responded, and lost-commit-response states recover.
- [ ] Policy version/digest absence disables confirmation.
- [ ] Signed-out inspector displays the exact S0 set.
- [ ] User-controlled title, merchant, filename, and decline reason cannot execute
      HTML or script.
- [ ] Tool title, annotations, registration, getTools(), and export projections
      agree.
- [ ] Executable surface counts are derived from MEMBERSHIP and no stale
      1/5/12/13 narration remains.
- [ ] Production page text contains no test path, local absolute path, node label,
      source filename, or policy "?".

Required real-browser product flow:

1. Start the real createHttpServer() and a clean Chrome profile.
2. Record Chrome version and WebMCP testing flag.
3. Assert document.modelContext exists.
4. Assert signed-out getTools() and the visible inspector are the exact S0 set.
5. Use trusted browser input to choose Chen.
6. Invoke every agent action through CDP WebMCP.invokeTool.
7. Run scope -> create -> add -> validate.
8. Invoke submit, wait for the real dialog, and use trusted input to confirm.
9. Wait for the matching WebMCP tool response.
10. Independently read server state and assert submitted plus one chain entry.
11. Reload the page and hydrate the same report.
12. Switch to Ruiz and invoke get_report and get_day_book through WebMCP.
13. Independently verify the non-empty chain.
14. Retry commit/submit and prove no second entry.
15. Run a second clean profile concurrently and prove workspace isolation.
16. Assert zero CSP violations.

This release gate is invalid if it calls a tool handler directly, mocks fetch,
injects a fake document.modelContext, calls globalThis.outpocketTools.executeTool,
calls a local ERP submit method, or substitutes a shared in-process object for a
page reload.

### Barrier 3

Root runs the tests. Workers do not.

Required focused commands:

~~~sh
node --test tests/acceptance/sign-state.test.mjs \
  tests/acceptance/sign-lock.test.mjs \
  tests/acceptance/chain.test.mjs \
  tests/acceptance/confirm-token.test.mjs

node --test tests/acceptance/session.test.mjs \
  tests/acceptance/workspace-isolation.test.mjs \
  tests/acceptance/security-headers.test.mjs

node --test tests/acceptance/sign-install.test.mjs \
  tests/acceptance/product-flow.test.mjs \
  tests/acceptance/inspector.test.mjs

bash tests/acceptance/curl-403.sh
bash tests/acceptance/toctou.sh
~~~

Root then runs npm test and requires:

~~~text
fail = 0
cancelled = 0
skipped = 0
todo = 0
~~~

Do not assert a fixed total such as 229.

Each P0 regression must map to a pre-fix failing reproduction. Where the new test
can run against the baseline, Root proves red-before-green in a detached baseline
worktree. Otherwise Root records why the existing reproduction is the equivalent
baseline evidence.

Any failure goes to the original implementation owner. After two failed repair
rounds for the same cause, stop and re-plan instead of weakening the test.

---

## 9. Wave 4 — source checkpoint and generated artifact

No agent writes during this wave.

### G4.1 — pre-commit review

- [ ] Re-read the original request and map every P0/P1 requirement to code or a
      test.
- [ ] Review the complete diff hunk by hunk.
- [ ] Re-run exact-symbol, substring/import, and git-log caller searches.
- [ ] Run git diff --check.
- [ ] Scan staged content for private keys and known AWS, GCP, OpenAI, Anthropic,
      GitHub, and Slack secret prefixes without echoing any match.
- [ ] Confirm .playwright-mcp/ and .team/contracts/E6.txt remain untouched and
      unstaged.
- [ ] Stage by explicit file path only.

### G4.2 — source checkpoint

Commit all source, contract, harness, and test changes that affect the tool
surface before generating the export.

Suggested checkpoint subjects:

~~~text
Make workspace state authoritative
Make signed commits atomic and recoverable
Align the WebMCP surface with server state
Add product-path and isolation gates
~~~

No amend and no hook bypass.

### G4.3 — generate and commit the export

The actual write command is:

~~~sh
node tools/export-surface.mjs
~~~

Then:

- [ ] Inspect artifacts/tools.export.json.
- [ ] Stage only artifacts/tools.export.json.
- [ ] Commit it in an artifact-only commit.
- [ ] Do not touch derived source in the artifact commit.

Suggested subject:

~~~text
Refresh the verified tool surface export
~~~

Run:

~~~sh
node tools/export-surface.mjs --check
node tools/export-surface.mjs --check
git diff --check
~~~

Create a detached clean worktree at the artifact commit and run the check twice
again. Every run must exit zero and leave no diff.

If the artifact-only commit changes the expected app_commit, stop and fix the
provenance design. Never hide a self-reference by repeated regeneration.

Any later edit under the export's derived source set requires a new source
checkpoint and a new artifact-only checkpoint.

---

## 10. Wave 5 — documentation and claims

Owner: docs_claims

Prerequisite: final source contract and generated export are committed.

Exact owned paths:

~~~text
README.md
NEW docs/JUDGE-GUIDE.md
erp/RISK.md
~~~

Forbidden: production source, tests, contracts, artifact, and all video files.

README requirements:

- [ ] One-sentence product and architecture description.
- [ ] Live URL placeholder or verified URL only.
- [ ] Exact local start and demo-persona instructions.
- [ ] WebMCP surface and state explanation derived from the final artifact.
- [ ] One copyable example prompt.
- [ ] Chrome WebMCP flag, restart, version, DevTools, and self-check steps.
- [ ] Server-authoritative tool -> API -> validate -> sign -> commit -> audit flow.
- [ ] Accurate repository layout.
- [ ] Honest limitation: demo-session response, not personhood or real identity.
- [ ] Honest limitation: metadata hash does not prove attachment bytes.
- [ ] Honest limitation: in-memory single process; no restart/multi-instance
      persistence.
- [ ] Related private repositories removed from the judge path unless publicly
      accessible.

Judge Guide requirements:

- [ ] Five-minute smoke path.
- [ ] Expected signed-out inspector.
- [ ] Chen create/add/validate/submit path.
- [ ] Reload persistence check.
- [ ] Ruiz report/daybook audit check.
- [ ] Second-profile workspace-isolation check.
- [ ] Troubleshooting for missing document.modelContext, flag, restart, and
      surface source label.
- [ ] No internal sprint graph or test-path language.
- [ ] No demo-video section.

Root runs every command printed in README and Judge Guide. A command that was not
run must be removed or labeled unverified.

---

## 11. Wave 6 — fresh adversarial review

These skeptics are read-only and must not be implementation agents from earlier
waves.

### Wave 6A — correctness skeptic

Attempt to refute:

> Every production write travels from a registered WebMCP tool to the authoritative
> server workspace, and reload/audit read the same committed state.

Checks:

- Trace every write tool backward and forward.
- Find any remaining local ERP mutation, local submission, local verdict, local
  artifact, or FNV daybook.
- Compare report id, revision, policy digest, snapshot digest, confirmation, and
  chain entry across page, server, reload, and auditor.

### Wave 6B — security skeptic

Attempt to refute:

> A failure cannot partially commit, retries cannot duplicate, concurrent commits
> cannot fork the chain, and one workspace cannot observe another.

Checks:

- Missing provenance and every injected failure point.
- Same-report and different-report commit races.
- Dropped open/respond/commit responses.
- Cross-workspace ids and idempotency keys.
- Actor spoofing, policy drift, stale revision, and lock expiry.
- Final CSP, cookie, and security headers.

### Wave 6C — contract and release skeptic

Attempt to refute:

> API DTOs, WebMCP metadata, generated artifact, tests, docs, and release evidence
> describe the same product.

Checks:

- Endpoint paths, methods, request/response fields, status codes, and error codes.
- Root-only frozen amendments.
- title and annotations across registration/getTools/export.
- app_commit provenance and clean-regeneration behavior.
- README/Judge Guide commands and claims.
- No video work in this scope.

### Skeptic gate

- [ ] No BLOCKER remains.
- [ ] No HIGH remains.
- [ ] Every accepted MEDIUM is written as an explicit residual risk.
- [ ] Any fix returns to the original file owner.
- [ ] Relevant tests and barrier are repeated after each fix.
- [ ] A repaired load-bearing claim is re-reviewed by a fresh skeptic.

---

## 12. Wave 7 — Root final gates

Run from /Users/calebwei/mcp/outpocket.

### Repository and scope

~~~sh
git status --short --branch
git diff --check
git diff --cached --check
git diff --name-only BASELINE_SHA...HEAD
~~~

Pass conditions:

- [ ] Only planned files changed.
- [ ] No user-owned untracked path changed or staged.
- [ ] No browser profile, log, screenshot, secret, or temporary artifact is
      tracked.
- [ ] Root reviewed every final hunk.

### Static and contracts

~~~sh
node tools/lint-layer0.mjs
node tools/check-toplevel.mjs --selftest
find src/page -name '*.js' -print0 | xargs -0 node tools/check-toplevel.mjs
node tools/validate-contracts.mjs
node tools/contracts-check.mjs
node tools/check-unknowns.mjs
node tools/ready.mjs --all
node tools/export-surface.mjs --check
~~~

Pass conditions:

- [ ] Frozen hashes and amendments agree.
- [ ] Export has exact no-drift.
- [ ] Executable surface counts agree with MEMBERSHIP.
- [ ] No production file exposes tests/acceptance, a local absolute path, internal
      node labels, or policy "?".

### Unit and integration

~~~sh
npm test

node --test tests/acceptance/sign-state.test.mjs \
  tests/acceptance/chain.test.mjs \
  tests/acceptance/workspace-isolation.test.mjs \
  tests/acceptance/security-headers.test.mjs \
  tests/acceptance/product-flow.test.mjs

bash tests/acceptance/curl-403.sh
bash tests/acceptance/toctou.sh
~~~

Pass conditions:

~~~text
fail = 0
cancelled = 0
skipped = 0
todo = 0
~~~

### Static negative searches

Production paths must not contain active use of:

~~~text
submitOpenReport
fnv1a
state.dayBook
client body.report/body.verdict/body.policy_*
source:"human"
proof of personhood
human signed
Ava Ruiz
tests/acceptance
local absolute paths
internal node labels
policy ?
~~~

Search exact symbols, substrings/aliases/imports, and git history. Historical risk
documents may contain banned phrases only when they are explicitly recording and
rejecting the claim.

### Real Chrome/WebMCP

~~~sh
node harness/drive.mjs --assert-flips 2,6,13,14
node harness/drive.mjs --fallback --scenario happy
node harness/drive.mjs --product-flow
~~~

Pass conditions:

- [ ] Browser version and WebMCP flag recorded.
- [ ] Real document.modelContext present.
- [ ] Real CDP WebMCP invocation used for all agent operations.
- [ ] Trusted sign click used.
- [ ] Server commit and non-empty chain independently observed.
- [ ] Reload rehydrates the submitted report.
- [ ] Ruiz reads the same report and daybook.
- [ ] Repeated commit does not append.
- [ ] Second profile is isolated.
- [ ] Final CSP has zero violations.
- [ ] No mock/shim/direct-handler path is counted as product evidence.

If the required real WebMCP environment is unavailable, status is UNVERIFIABLE.
Do not publish or claim end-to-end success.

---

## 13. External manual gates

These actions require user authority and external credentials. Local tests cannot
complete them.

- [ ] User authorizes deployment of a named release SHA.
- [ ] Production /version equals that exact SHA.
- [ ] HTTPS response carries final CSP and security headers.
- [ ] Production login cookie has the expected __Host-, Secure, HttpOnly,
      SameSite, Path, and no-Domain attributes.
- [ ] An anonymous clean browser completes the product flow.
- [ ] A second clean browser proves workspace isolation.
- [ ] User explicitly authorizes changing repository visibility to public.
- [ ] An unauthenticated browser or public clone can access the repository.
- [ ] The hosting site recognizes the root MIT license.

Without the required authority or credentials, final status is:

~~~text
CODE READY; EXTERNAL RELEASE GATES NOT COMPLETED
~~~

### Rollback

If any P0 defect appears after deployment:

1. stop further release actions;
2. create a new revert commit;
3. deploy the last known-good release SHA;
4. verify /version matches that SHA;
5. rerun the core browser smoke path;
6. record the failed release and evidence.

Never reset, amend published history, or force push.

---

## 14. Agent return template

Every implementation or test agent returns:

~~~text
STATUS:

OWNED FILES READ:

FILES CHANGED:

DELIVERABLES COMPLETED:

CONTRACT ASSUMPTIONS:

OUT-OF-SCOPE CALLERS FOUND:

CONCERNS:

ROOT VERIFICATION TO RUN:
~~~

Root records each result in the ledger below before opening the next wave.

---

## 15. Execution ledger

| Wave | Agent | Status | Files reviewed by Root | Focused checks | Follow-up |
|---|---|---|---|---|---|
| 0 | Root contract freeze | NOT STARTED | — | — | — |
| 1A | server_core | NOT STARTED | — | — | — |
| 1B | client_cutover | NOT STARTED | — | — | — |
| 1C | ui_csp_prep | NOT STARTED | — | — | — |
| 2A | security_headers | NOT STARTED | — | — | — |
| 2B | tool_surface | NOT STARTED | — | — | — |
| 2C | test_infra | NOT STARTED | — | — | — |
| 3A | test_sign_atomicity | NOT STARTED | — | — | — |
| 3B | test_authority_security | NOT STARTED | — | — | — |
| 3C | test_product_webmcp | NOT STARTED | — | — | — |
| 4 | Root provenance barrier | NOT STARTED | — | — | — |
| 5 | docs_claims | NOT STARTED | — | — | — |
| 6A | correctness skeptic | NOT STARTED | — | — | — |
| 6B | security skeptic | NOT STARTED | — | — | — |
| 6C | contract/release skeptic | NOT STARTED | — | — | — |
| 7 | Root release gate | NOT STARTED | — | — | — |

---

## 16. Definition of done

The fix is DONE only when all of the following are true:

- [ ] Server authority, atomicity, idempotency, and workspace isolation are
      implemented.
- [ ] Every P0 regression has authoritative passing evidence.
- [ ] Full mandatory tests pass with no fail/cancelled/skipped/todo.
- [ ] Real Chrome/WebMCP product flow passes without mocks or direct handlers.
- [ ] Security headers and production-cookie behavior are verified.
- [ ] Export regeneration is deterministic and drift-free from a clean checkout.
- [ ] README and Judge Guide describe only verified behavior.
- [ ] Three fresh skeptics report no BLOCKER or HIGH.
- [ ] User-owned untracked files remain untouched.
- [ ] No video-related file was changed.
- [ ] External deployment/public-repository gates are either completed or
      explicitly reported as incomplete.

Anything without a concrete mapping to code, a test, browser evidence, or an
explicit external manual gate is not complete.
