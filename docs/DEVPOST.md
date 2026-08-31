# Outpocket — Devpost description

**Positioning:** Outpocket is the expense desk where an agent does the paperwork
inside the employee's current web session, while the employee keeps the acts
that carry personal responsibility.

## 1. Why WebMCP fits this use case

Expense reimbursement begins with an employee spending personal money and ends
with that employee making a claim against company policy. The middle is tedious:
transcribe receipts, look up limits, correct rejected fields, and assemble an
audit record. The final decision should not disappear into unattended
automation.

WebMCP lets us divide the work along that line. The employee signs in to the
expense page as usual. The page then registers tools through
`document.modelContext`, and the agent's same-origin calls use that already
authenticated session. For this interaction, authorization begins with the
employee's login rather than a long-lived token held by an intermediary.

A custom API, RPA system, or integration platform such as Truto, Merge, Paragon,
or Nango could automate the same business task. The WebMCP advantage here is
not that reimbursement is otherwise impossible; it is that the agent, employee,
and website share one live session and one state-dependent action menu. As the
report changes, the page revises the tools the agent receives on its next turn.

## 2. How it improves the user experience

The employee starts from a one-click persona and never pastes a password or API
key into the conversation. The agent can read the employee's permitted projects
and the current expense policy, create a draft, add lines, and follow structured
fix hints. The employee sees the same report on the page, attaches receipt files
through a human-only control, and reviews the final snapshot before signing.

The action menu explains where the workflow is. Across 17 tools and six states,
the employee home surface has 6 tools, a draft with blocking findings has 13,
a clean draft has 14, and a submitted report has 7. The auditor receives a
different 7-tool, read-only set. Write tools are derived from `readOnlyHint` in
the current set rather than maintained as a second list.

The menu reduces dead-end calls, while the server remains responsible for each
decision. It rechecks session role on every write and recomputes the expense
verdict at commit; a blocking report is refused with HTTP 422 `E_NOT_CLEAN`.
WebMCP clients treat website-provided definitions and results as untrusted
content, so authorization never rests on a tool description.

The client already has its own confirmation behavior for consequential actions.
Our addition is snapshot binding: the exact report and policy shown for review
are canonically digested, then the server re-canonicalizes current state before
commit. If the report or policy changed after review, the comparison fails.

## 3. What people and agents can now do together

An employee can hand policy lookup, repetitive entry, and correction loops to an
agent without handing a separate integration service a reusable credential,
then inspect and sign the exact report the agent prepared in the page where the
employee is already authenticated.

That collaboration is the product. The agent is good at converting receipt
facts into structured lines and iterating over specific validation errors. The
employee remains the source of login, attachment bytes, contextual judgment,
and signature. Finance gets a submitted artifact with policy version, field
provenance, receipt-digest references, and a linked day-book entry; an auditor
can inspect it through a read-only persona.

The potential impact is practical rather than speculative: less duplicate data
entry for employees, fewer avoidable policy corrections for finance, and a
clearer record of which fields came from an agent and which were edited by a
person. We have not measured time saved, so we do not claim a percentage.

## 4. How we built it

The top-level page owns registration. A compiler combines session role, whether
a report is open, its draft/submitted status, and its fresh validation verdict
into one of six named sets. Registration uses an abort controller per generation
to replace the prior set. A second membership check runs when a tool executes,
and every same-origin write is authorized again by the Node.js server.

Submission is a two-call handshake because a suspended tool execution timed out
in the tested client. The server records sign-request state, derives the signer
from the session and time from its own clock, binds the review snapshot to a
canonical digest, rechecks policy and report state, and appends successful
commits to a SHA-256-linked day book. `GET /api/daybook` returns the entries,
current head, and verification result for the auditor view. Negative evaluations
exercise auditor writes, dirty submission, post-review edits, writes during
review, replay, and the response-without-click path.

There is an important open weakness. The server can establish that its response
endpoint received a POST from the authenticated session, but it cannot establish
that a person reviewed the dialog. A caller with that session plus read access
to the token placed in the rendered dialog can issue
`POST /api/sign/{id}/respond` itself. The evaluated client was not measured for
that DOM-read capability, so we neither assign it nor dismiss the risk. The
token increases effort, but it is not proof of a person. Since account identity
and timestamp are genuine server facts, the result can be a correctly attributed
record of an event that never happened, indistinguishable in the day book from
a real click.

Two more limits matter. The current deployment is a single in-memory Node.js
process: restart loses state and there is no multi-instance coordination. Also,
receipt bytes never reach the server. Only metadata and a browser-computed
SHA-256 value enter the service, so the chain does not show that the server
received or checked the attachment itself.

Judges may choose to assess the submitted description and media without running
the site. For that reason, the repository includes captured browser evidence,
expected-surface fixtures, real-HTTP acceptance tests, negative mutations, and a
five-minute walkthrough that says what each step should show as well as what the
project does not prove.
