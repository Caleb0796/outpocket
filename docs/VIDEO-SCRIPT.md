# Outpocket — video script

Cue sheet for node **D4**, authored by node **F0** so that the video is graded
against a document it does not itself produce.

**Revision 3 (2026-08-31, coordinating session, owner-directed)** — the film is
now a pitch arc: what it is, the problem and the benefit, the demo, the impact.
`docs/STORYBOARD.md` revision 5 is the companion; `SB-07` and `SB-13` are CUT
there, `SB-16`/`SB-17`/`SB-18` are new, and demo durations are tightened. Cue
INs are the running sum of the storyboard's `DUR` column **in its RUN order**.
Narration is written for a natural speaking voice — short sentences,
contractions, no aphorisms. Total runtime **02:51** (171s), under the 180s
ceiling.

**Revision 5 (2026-09-02, owner-directed).** Captions and narration only were
revised for the equally weighted **WebMCP Leverage** criterion and the video
requirement to explain "how you used WebMCP." Every cue now names the WebMCP
mechanism it shows. Across the film, those mechanisms include
`document.modelContext` registration, state-driven re-registration,
`readOnlyHint`, `explain_missing_tool` as a WebMCP tool in its own right, and
the two-call signature handshake used because a waiting client call times out.
Durations, shots, ON SCREEN blocks, and storyboard anchors are unchanged.

Read the narration in English at conversational pace. Bracketed lines are stage
directions and are not spoken. On-screen captions are burned in and must be
legible in a single still frame lifted from that cue.

---

## Cue 1 — `SB-16` — IN 00:00, OUT 00:12

**ON SCREEN.** The live product, mid-session: employee home, an open clean
draft, the surface inspector visible, the environment banner at the top. No
logo.

**CAPTION.** Outpocket — your own agent, inside your session, through WebMCP.

**NARRATION.**
> This is Outpocket — an expense desk where your own AI agent does the
> reimbursement paperwork inside the web session you're already signed into.
> The page talks to that agent through WebMCP.

---

## Cue 2 — `SB-17` — IN 00:12, OUT 00:36

**ON SCREEN.** A three-column comparison card over live-page b-roll: build a
copilot / wire an integration / Outpocket. Banner still visible.

**CAPTION.** No model shipped. No new credential. Your own agent.

**NARRATION.**
> Today a company that wants this either builds its own copilot — hosting a
> model, tuning prompts, users stuck with whatever it picked — or wires in an
> integration that typically holds its own standing key to the ERP. Outpocket
> does neither. The page publishes tools through WebMCP, you bring your own
> agent, the site ships no model, and no new standing credential is created.

---

## Cue 3 — `SB-01` — IN 00:36, OUT 00:44

**ON SCREEN.** The surface inspector, one row per registered tool;
`submit_expense_report` present in the 14-tool clean state; policy chip
legible.

**CAPTION.** document.modelContext — the page publishes what the agent may do.

**NARRATION.**
> The whole idea on one screen: every tool the agent can call is registered by
> the page through WebMCP — computed, not configured.

---

## Cue 4 — `SB-05` — IN 00:44, OUT 00:54

**ON SCREEN.** One typed sentence in the employee session. The draft appears;
each field carries a server-assigned provenance tag.

**CAPTION.** One prompt. The agent works through the page's WebMCP tools.

**NARRATION.**
> One sentence to a WebMCP client, and the agent builds the draft through the
> page's tools. Every field it wrote is tagged as the agent's — by the server.

---

## Cue 5 — `SB-14` — IN 00:54, OUT 01:04

**ON SCREEN.** The agent adds a $180 airport car; the line lands in the editor
and the agent pane shows the page's blocking `CAP_TRANSPORT` verdict with its
fix hint. Both panes in frame.

**CAPTION.** Validation answers in the same tool call.

**NARRATION.**
> Now it adds a hundred-eighty-dollar car. The tool result carries the policy
> verdict right away — over the per-trip cap, and the draft isn't clean anymore.

---

## Cue 6 — `SB-15` — IN 01:04, OUT 01:13

**ON SCREEN.** The inspector re-renders: the `submit_expense_report` row is
absent. 14 tools clean, 13 dirty.

**CAPTION.** Submit is gone — the page re-registered its WebMCP tools.

**NARRATION.**
> And look — submit is gone. The page re-registers its WebMCP tools on every
> state change: fourteen when the draft was clean, thirteen now.

---

## Cue 7 — `SB-04` — IN 01:13, OUT 01:25

**ON SCREEN.** The agent's client window. Re-prompted, it finds nothing to
call, asks `explain_missing_tool`, and relays the answer's `message` and `fix`
text.

**CAPTION.** Absence, not refusal — explain_missing_tool is a WebMCP tool too.

**NARRATION.**
> Asked to submit anyway, the agent finds nothing to call. It asks the page why
> — through another WebMCP tool — and gets the rule and the fix: clear every
> violation, and the door opens by itself.

---

## Cue 8 — `SB-06` — IN 01:25, OUT 01:33

**ON SCREEN.** Auditor session, `ruiz`, the identical sentence. The inspector
shows 7 read-only tools.

**CAPTION.** Same sentence, auditor session: 7 tools registered, all read-only.

**NARRATION.**
> The same sentence as an auditor gets seven tools, every one marked read-only.
> Nothing refuses her — the write tools were never registered.

---

## Cue 9 — `SB-08` — IN 01:33, OUT 01:42

**ON SCREEN.** A terminal. The request is forced past the page with the
session cookie. The server answers 403.

**CAPTION.** Past the page, the server still says no.

**NARRATION.**
> Skip the WebMCP tools and hit the server directly? Four-oh-three. The tool
> list is the interface; the server is the boundary.

---

## Cue 10 — `SB-09` — IN 01:42, OUT 01:52

**ON SCREEN.** The corrected $48 line demands a receipt. A human attaches the
file through the upload control; beside it, the agent's only affordance: link
an existing id.

**CAPTION.** No WebMCP tool takes a file. Receipts enter through a human control.

**NARRATION.**
> The corrected fare needs a receipt — and receipts only come in through this
> human control. No tool on the page takes a file.

---

## Cue 11 — `SB-10` — IN 01:52, OUT 02:06

**ON SCREEN.** The agent submits; the call comes back with an awaiting-signature
ticket; the signature dialog opens with the snapshot digest and the worst-case
consequence printed above the signature line.

**CAPTION.** Submitting doesn't submit. The tool returns a ticket; the human is asked, on the record.

**NARRATION.**
> Submitting doesn't actually submit. The WebMCP call returns a ticket — a
> waiting call would time out — and the page shows what I'd be signing: the
> snapshot, its digest, and what happens if this is wrong, above the signature
> line.

---

## Cue 12 — `SB-12` — IN 02:06, OUT 02:17

**ON SCREEN.** The dialog is still open on the page. In the agent pane, the
attempt to alter the amount and the **423 `E_SIGN_IN_PROGRESS`** refusal read
in one frame.

**CAPTION.** While a human reviews, the report is locked. HTTP 423.

**NARRATION.**
> And while that's open, the report is locked. The agent's next tool call tries
> to change the amount — four-twenty-three, sign in progress. What I'm reviewing
> can't be moved under me.

---

## Cue 13 — `SB-11` — IN 02:17, OUT 02:27

**ON SCREEN.** The human clicks. The page shows the server's confirmation; the
agent reads the report back — who signed, how, when, and the day-book entry —
from the server's record.

**CAPTION.** The outcome is the server's record, not the click's echo.

**NARRATION.**
> I click — and the confirmation comes back from the server, not from my
> click. The agent's second call reads it back: who signed, how, and when.

---

## Cue 14 — `SB-18` — IN 02:27, OUT 02:51

**ON SCREEN.** Quiet tail footage of the signed report, banner visible, then
an end card with one limit and the URL.

**CAPTION.** Any page can publish its tools through WebMCP — and keep the signature human.

**NARRATION.**
> Every company reimburses expenses — but this isn't really about expenses. Any
> page that moves money can publish its tools through WebMCP, let people bring
> their own agents, and keep the signature human. One honest limit: we bind a
> signature to the session and the snapshot — we can't prove which finger
> clicked. Everything else you saw, the server enforces. Outpocket.

---

**END 02:51.**
