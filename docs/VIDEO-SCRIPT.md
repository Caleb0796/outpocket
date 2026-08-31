# Outpocket — video script

Cue sheet for node **D4**, authored by node **F0** so that the video is graded
against a document it does not itself produce.

**Revision 2 (2026-08-31, coordinating session, user-directed)** — rebuilt with
`docs/STORYBOARD.md` revision 2 against the shipped two-call signature contract
(`9471552`) and immediate validation (`23dab22`). `SB-02`/`SB-03` are CUT
there; `SB-14`/`SB-15` replace them; `SB-12` now runs before `SB-11`. Cue INs
are the running sum of the storyboard's `DUR` column **in its RUN order**.
Total runtime **02:42** — under three minutes, with the narration written to
land inside each cue rather than across cue boundaries.

Read the narration in English, at conversational pace. Bracketed lines are
stage directions and are not spoken. On-screen captions are burned in and must
be legible in a single still frame lifted from that cue.

---

## Cue 1 — `SB-01` — IN 00:00, OUT 00:10

**ON SCREEN.** Employee home, mid-session, an open clean draft with one $20
transport line. The surface inspector is open with one row per registered tool;
`submit_expense_report` is on the list. The policy version chip is legible. The
environment banner sits at the top of the page and stays there.

**CAPTION.** `document.modelContext` — the page publishes what the agent may do.

**NARRATION.**
> Everything the agent can do here is published by the page — computed, not
> configured. The site ships no model; the agent is the employee's own. Watch
> the list.

---

## Cue 2 — `SB-14` — IN 00:10, OUT 00:22

**ON SCREEN.** The agent adds a $180 airport car. The editor renders the
blocking finding in the same beat: `CAP_TRANSPORT` — "$180.00 exceeds the
$150.00 per-trip transport cap" — with its fix hint.

**CAPTION.** Validation answers in the same call. The draft is no longer clean.

**NARRATION.**
> The agent adds a hundred-eighty-dollar car. The policy engine answers on the
> spot — over the per-trip transport cap — and the draft is no longer clean.

---

## Cue 3 — `SB-15` — IN 00:22, OUT 00:34

**ON SCREEN.** The inspector re-renders in the same frame. The
`submit_expense_report` row from cue 1 is absent; the count reads 13 where the
clean state read 14.

**CAPTION.** The surface follows the verdict. 14 tools clean, 13 dirty.

**NARRATION.**
> The submit tool is gone. Not disabled, not refused — recomputed away. A call
> already in flight is never stopped; the offer itself is withdrawn for the
> agent's next turn.

---

## Cue 4 — `SB-04` — IN 00:34, OUT 00:48

**ON SCREEN.** The agent's own client window. Re-prompted, the agent finds the
tool absent, calls `explain_missing_tool`, and receives the violated rule and
the repair the policy expects.

**CAPTION.** Absence, not refusal — and the surface says which rule took it.

**NARRATION.**
> Re-prompted, the agent finds nothing to call. So it asks the tool that always
> exists — explain-missing-tool, our answer to the working group's open issue —
> and is told which rule removed it, and what repair the policy expects.

---

## Cue 5 — `SB-05` — IN 00:48, OUT 01:00

**ON SCREEN.** Employee session, persona `chen`. One typed sentence. A draft
report appears, each field marked with server-assigned provenance.

**CAPTION.** Employee session — agent-proposed fields, marked by the server.

**NARRATION.**
> Now the same sentence in two different sessions. As an employee it works —
> and every field the agent proposed is marked as the agent's by the server,
> not claimed by the client.

---

## Cue 6 — `SB-06` — IN 01:00, OUT 01:12

**ON SCREEN.** Auditor session, persona `ruiz`. Identical sentence. The
inspector shows 7 read-only tools; no write row exists.

**CAPTION.** Auditor session — the tool is not on the surface.

**NARRATION.**
> As an auditor, the same sentence has nothing to call. The write tools are not
> on this surface at all — there is nothing to refuse, because there is nothing
> there.

---

## Cue 7 — `SB-07` — IN 01:12, OUT 01:22

**ON SCREEN.** The client's own approval prompt, shown exactly as it appears.

**CAPTION.** The client is asking for approval before this cookie-bearing call.

**NARRATION.**
> The client is asking for approval before this cookie-bearing call. That is
> the client's policy, not ours.

---

## Cue 8 — `SB-08` — IN 01:22, OUT 01:36

**ON SCREEN.** A terminal. The same request is forced past the page with a
hand-made call carrying the session cookie. The server answers 403.

**CAPTION.** Past the page, the server still answers 403.

**NARRATION.**
> Force the same request past the page entirely — the server answers 403,
> against the very session the human holds. The surface is the interface. The
> server is the boundary.

---

## Cue 9 — `SB-09` — IN 01:36, OUT 01:48

**ON SCREEN.** The corrected $48 line demands a receipt. A human attaches the
file through the upload control; beside it, the agent's only receipt
affordance: link an id that already exists.

**CAPTION.** Files enter through a human-only control.

**NARRATION.**
> The corrected forty-eight-dollar fare needs a receipt — and the receipt
> enters through a human-only control. No tool on this surface takes a file.
> The agent can only link what a person has attached.

---

## Cue 10 — `SB-10` — IN 01:48, OUT 02:04

**ON SCREEN.** The agent calls `submit_expense_report`. The call suspends; the
signature dialog opens with the snapshot digest visible and the worst-case
consequence printed immediately above the signature line.

**CAPTION.** Submitting does not submit. The human is asked, on the record.

**NARRATION.**
> Submitting does not submit. The call suspends into an awaiting-signature
> state, and the page presents the request to the human — the exact snapshot,
> its digest, and the worst-case consequence printed above the signature line.

---

## Cue 11 — `SB-12` — IN 02:04, OUT 02:20

**ON SCREEN.** The dialog is still open. The agent attempts to alter the
amount; the attempt and the rejection — **423 `E_SIGN_IN_PROGRESS`** — read in
one frame.

**CAPTION.** While a human reviews, the report is locked. HTTP 423.

**NARRATION.**
> And while that request is open, the report is locked. The agent tries to
> touch the amount — four-twenty-three, sign in progress. What the human is
> reviewing cannot be moved underneath them. At commit, the server
> re-canonicalises and re-checks everything anyway.

---

## Cue 12 — `SB-11` — IN 02:20, OUT 02:30

**ON SCREEN.** The human clicks. The page shows the server's read-back: status
submitted, attribution, method, timestamp, and the linked day-book entry.

**CAPTION.** The outcome is the server's record, not the click's echo.

**NARRATION.**
> A person clicks. What the page shows next is the server's own read-back —
> attribution, method, timestamp. The local echo of a click proves nothing; the
> server's record is the outcome.

---

## Cue 13 — `SB-13` — IN 02:30, OUT 02:42

**ON SCREEN.** Honesty card, three lines, environment banner still visible:
session-and-snapshot not personhood; next call, not in-flight; demo personas by
design.

**CAPTION.** Three limits, on the record.

**NARRATION.**
> Three limits, on the record. The signature binds a session and a snapshot —
> not a fingerprint. Revocation acts on the next turn. The personas are
> demo-grade by design. Everything else you saw, the server enforces.

---

**END 02:42.**
