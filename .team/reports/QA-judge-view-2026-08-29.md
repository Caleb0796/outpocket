# QA — judge-view pass of the live site, 2026-08-29

*QA's report, in its own words. L1 transcribed and committed it, because `evidence/**` resolves
to I1 and QA owns only three specific declared files there — the same D-104 class that has now
cost four seats. **Seats report, L1 records**, exactly as pits already work; no new ownership
row was invented for it.*

**Report-only.** No writes, no signing, no automated state change beyond signing in through the
page's own persona cards (real trusted clicks, no scripted POST). Method: real headless
Chromium 151, `--enable-features=WebMCP`, driven over raw CDP — **not a fetch probe**, so it
sees console and exception events.

## 1. Script/link resolution and console — MEASURED, clean

Every `<script src>` resolves 200 under `/page/`. **`skin.css` is now 200** and the favicon is
an inline `data:` URI so **no favicon request exists at all** — QA reproduced UX's fix
independently rather than trusting the report. **Zero console messages and zero exceptions
across the whole walk** (fresh load → chen login → switch → ruiz login). The only non-2xx in
the walk is `/api/me` 401 at first load, before login — the correct signed-out answer.

The 12× AbortError did not recur, **but QA is explicit that this is absence-in-this-walk, not a
targeted regression check** — it did not re-drive `?demo=1` to hunt for it.

## 2. Tool surface — MEASURED, matches the frozen contract, no DOM-vs-API drift

Compared `#surface-inspector [data-tool-row]` against `document.modelContext.getTools()` in the
same real WebMCP browser, at **real logins** rather than `?demo=1`:

- **S0** signed out: 2 tools.
- **S1** chen, real click: **6 tools, DOM and getTools() identical** — create_expense_report,
  explain_missing_tool, get_expense_policy, get_session_scope, list_expense_reports,
  open_expense_report.
- **S5** ruiz, real click: **7 tools, every row DOM-labelled read-only** — matching the frozen
  S5 row and R-20's zero-write-tools claim for the auditor, **seen directly rather than trusted
  from the annotation.**

**It also corrected my dispatch:** I wrote "the five tools rendering"; the real number at S1 is
six, because T3 put `explain_missing_tool` on every state. My number was pre-D-77 and it caught
it rather than matching it.

## 3. Storyboard dry-check — the finding that matters most

**`check-storyboard.mjs`'s `sign-open` state does NOT exercise the real signature pipeline.** It
calls `mountSignDialog()` directly with a hand-written `signRequest` (`sg_1111111111111111`, a
fake digest, a fake report) and **`confirmToken: ''`**. It never calls `submit_expense_report`,
never POSTs `/api/sign`, never touches `openForDialog`, never gets a real token.

So **"SB-10/SB-11 resolve, 13/13 green" proves the dialog CAN RENDER given fabricated data** —
it says nothing about whether F7's provider plus I3's `openForDialog` plus a real click ever
produce that frame on production. Graded **DERIVED** (source read), not measured.

Per shot: SB-01 MEASURED/filmable. SB-02/03 not observed (needs a finance actor, out of
read-only scope). SB-04 inherently off-page. SB-05/06 MEASURED for the login half. SB-07/08
correctly off-page. SB-09 partially observed — the receipts region renders and
`[data-receipt-channel]` is present with no report open; no upload attempted. **SB-10/11/12 NOT
observed on production**, still blocked on the write question. SB-13 MEASURED/filmable.

## 4. Anything a judge should not see — nothing alarming

One **OUR-ESTIMATE**, flagged not asserted: the env banner's *"Chromium 151 is below 153"*
disclosure is honest and intentional, but **could read cold as "something's broken"** to an
unfamiliar judge. A copy call for whoever owns that text.

## What QA did NOT check

SB-02/03/04/07/08, the actual receipt upload, the full SB-10/11/12 chain, and a targeted
re-drive of the demo to hunt the AbortError.

---

**PIT — QA's five fields.** **TRIED:** a read-only judge-view walk over real CDP with WebMCP
enabled — fresh-load check, real chen/ruiz logins, DOM-vs-`getTools()` at three states, and a
source read of `check-storyboard.mjs`'s state machine against the thirteen shots.
**HAPPENED:** resolution clean, zero console errors, surface matching the contract with no
drift, and the synthetic-sign-open finding. **CHANGED:** nothing; the report is the only
artifact. **EARLIER:** this follows directly from tonight's blocked write-flow task — **the
read-only pass makes progress on the same wiring question without needing that permission, by
locating exactly where the existing automated proof is synthetic.** **GRADE:** PASS on
everything graded MEASURED; SB-10/11/12 stays explicitly OPEN.
