# Outpocket — five-minute judge guide

No local build is required. Use the
[live app](https://outpocket.onrender.com/) and one of the two passwordless demo
personas.

For a 30-second visual preview, open the
[seed-7 moving demo](https://outpocket.onrender.com/?demo=1&seed=7). It labels
itself, signs in through the page's chen control, reads the session scope,
creates a report, adds clean lines, and validates them through the same tool
dispatcher an agent uses. Watch the inspector move from the 6-tool employee
home state through the 13-tool draft state to the 14-tool clean state. The run
intentionally stops before signature and submission.

## Open with WebMCP

The ChatGPT desktop built-in browser needs no flag. Open the live app directly.

For Chrome 149 or later, use one platform line:

```text
Linux:   google-chrome --enable-features=WebMCP
macOS:   open -a "Google Chrome" --args --enable-features=WebMCP
Windows: chrome.exe --enable-features=WebMCP
```

You can instead visit `chrome://flags/#enable-webmcp-testing`, choose
**Enabled**, and restart Chrome.

In the deployed page's DevTools console, check:

```js
'modelContext' in document
```

Expected: `true`.

## Five-minute smoke path

Start at the [live app](https://outpocket.onrender.com/) in a fresh browser
session so there is no existing persona cookie.

### 0:00 — signed out

Before choosing a persona, inspect the agent's available tools. Expect exactly
two:

- `get_signin_status`
- `explain_missing_tool`

The report controls stay hidden. This is the signed-out registration state, not
an authorization error.

### 0:30 — chen sees the employee menu

Click **Sign in as chen**. No password is required. The page should identify
**Chen Xiao · employee**, and the surface inspector should show 6 tools. There
is no open report yet, so editing and submission tools are absent.

Paste this prompt into the connected agent:

```text
Work only through the tools registered by this page. Read my signed-in scope and the current expense policy. Create a report titled "Judge smoke test" under the first active project in my scope. Add one line dated today for City Cab Co., category transport, USD 20.00, business purpose "Airport transfer". Follow any returned fix hints until there are no blocking findings, then validate the report. Stop when submit_expense_report becomes available, tell me the report id, and do not submit it.
```

Expected sequence:

1. `get_session_scope` and `get_expense_policy` establish an active project and
   the current policy.
2. `create_expense_report` opens a draft; the inspector shows 13 tools.
3. `add_expense_line` adds a below-receipt-threshold transport line.
4. `validate_expense_report` reports no blocking findings; the inspector shows
   14 tools and includes `submit_expense_report`.

The revised list reaches the agent on its next turn. If it stops after a state
change, reply: `Continue with the newly available tools.`

### 2:30 — submit only after a human review

Send:

```text
Call submit_expense_report once for the open clean report. It should return awaiting_signature with a ticket and open the page review. Stop there while I review it; do not answer the page's signature prompt for me.
```

The page should open a review dialog beside the report. Check the report,
policy version, worst-case explanation, and snapshot digest, then click
**Sign this report** yourself. The page records the server's decision, but the
draft is not submitted by that click alone. Send one follow-up:

```text
Call submit_expense_report again to continue the pending signature and finish submission.
```

That second call reads the signed decision, commits exactly once, and returns
the final confirmation. The employee surface then contracts to 7 tools;
editing and submission are gone.

### 3:45 — reload the committed state

Reload the page. The chen session and submitted report should still be present,
because a page reload does not restart the server process. Reopen the report if
needed and confirm that it remains submitted with a 7-tool employee surface.

This is not a durability claim across a server restart: the current deployment
stores state in one process's memory.

### 4:15 — ruiz audits without write tools

Click **Switch persona**, then **Sign in as ruiz**. The page should identify
**Elena Ruiz · auditor** and show 7 tools, all marked read-only. Send:

```text
Use list_expense_reports to find the report just submitted, get_report to read it, and get_day_book to summarize the latest entry, current head, and verification result. Do not make changes.
```

Expect the submitted report and its committed day-book entry. The day-book
response contains `entries`, `head`, and `verification`. The auditor menu has
no report creation, editing, signing, or submission tool; the server also
refuses an auditor's direct write request.

## What the smoke path demonstrates

- The page registers a state-dependent WebMCP menu rather than one static tool
  catalogue.
- One authenticated employee session is reused by the page and its agent; no
  password or API token is passed in the prompt.
- Validation changes the next set of actions the agent receives, and the server
  recomputes the verdict again at commit.
- Submission uses a two-call review handshake: the first call returns an opaque
  awaiting ticket, the page records the human decision, and the second call
  commits the bound snapshot and leaves a linked day-book entry visible to a
  read-only auditor.

It does not demonstrate durable storage across process restart, server receipt
of attachment bytes, or proof that every response POST corresponds to a real
human click. Those are documented limits, not conclusions of this smoke test.

## Scoring criteria → repository evidence

| Official criterion | What to inspect | Repository evidence |
| --- | --- | --- |
| WebMCP Leverage | Top-level registration and state changes delivered to the browser | [`src/page/register.js`](../src/page/register.js), [`src/page/tools/compile.js`](../src/page/tools/compile.js), [`evidence/V1-remote.json`](../evidence/V1-remote.json), [`evidence/V2.json`](../evidence/V2.json) |
| Execution | Repeatable flow plus tests that fail when the relevant mechanism is removed | [`evidence/rehearsal.json`](../evidence/rehearsal.json), [`tests/surface.test.mjs`](../tests/surface.test.mjs), [`tests/acceptance/sign-state.test.mjs`](../tests/acceptance/sign-state.test.mjs), [`evals/mutation-report.json`](../evals/mutation-report.json) |
| Potential Impact | Existing-session authorization and an auditor who cannot write | [`erp/contracts/session.contract.md`](../erp/contracts/session.contract.md), [`server/authz.mjs`](../server/authz.mjs), [`tests/acceptance/curl-403.sh`](../tests/acceptance/curl-403.sh), [`evals/mutants/neg-auditor-write.json`](../evals/mutants/neg-auditor-write.json) |
| Creativity & Ambition | Review-snapshot binding, commit-time re-canonicalization, and a linked audit record | [`server/recanon.mjs`](../server/recanon.mjs), [`server/chain.mjs`](../server/chain.mjs), [`tests/acceptance/toctou.sh`](../tests/acceptance/toctou.sh), [`evals/mutants/neg-post-signature-tamper.json`](../evals/mutants/neg-post-signature-tamper.json) |
| Public, reachable project | Deployed URL and captured response headers | [`evidence/D1-url.txt`](../evidence/D1-url.txt), [`evidence/headers.txt`](../evidence/headers.txt) |

## Troubleshooting

### `document.modelContext` is missing

1. Confirm the browser is Chrome 149 or later.
2. Enable `chrome://flags/#enable-webmcp-testing`, then fully restart Chrome.
3. Or quit Chrome and relaunch it with the `--enable-features=WebMCP` line for
   your platform above.
4. Reopen the deployed HTTPS URL and rerun `'modelContext' in document`.

ChatGPT's built-in browser does not need the flag.

If the page labels itself **simulated agent**, its in-page fallback is driving
the same dispatcher because the browser API was absent. That is useful for
walking the UI, but it is not a reading from Chrome's WebMCP implementation. For
the real-browser path, require the DevTools check to return `true` and the
surface inspector source to read `document.modelContext` without a simulated
label.

### A newly available tool is not in the agent's list

Ask the agent to list its tools again on its next turn. The page inspector shows
the current registered set, while the client refreshes the agent-facing list at
the next turn boundary.

### The manual report is gone after reload

Check whether the hosting process restarted. The current build survives a page
reload but deliberately makes no persistence claim across a process restart or
across multiple instances. Rerun the seed-7 preview if you only need the visible
6 → 13 → 14 transition.
