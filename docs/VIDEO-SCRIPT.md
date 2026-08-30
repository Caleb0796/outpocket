# Outpocket — video script

Cue sheet for node **D4**, authored by node **F0** so that the video is graded
against a document it does not itself produce.

Shot ids are the ones frozen in `docs/STORYBOARD.md` and they are cited here
verbatim. Each cue's `IN` is the running sum of that document's `DUR` column,
in shot-id order. Total runtime **02:42** — under three minutes, with the
narration written to land inside each cue rather than across cue boundaries.

Read the narration in English, at conversational pace. Bracketed lines are
stage directions and are not spoken. On-screen captions are burned in and must
be legible in a single still frame lifted from that cue.

---

## Cue 1 — `SB-01` — IN 00:00, OUT 00:10

**ON SCREEN.** Employee home, mid-session. The surface inspector is open with
one row per registered tool. The policy version chip is legible. The
environment banner sits at the top of the page and stays there.

**CAPTION.** `document.modelContext` — the page publishes what the agent may do.

**NARRATION.**
> Everything this agent is able to do here is published by the page itself,
> through `document.modelContext`. Watch that list — it is about to change,
> and not because anyone touched the agent.

---

## Cue 2 — `SB-02` — IN 00:10, OUT 00:22

**ON SCREEN.** Finance edits the expense policy in the adjacent pane. The
version chip's text changes.

**CAPTION.** Policy version bumped.

**NARRATION.**
> Finance changes one rule. The policy version bumps, and the page reads that
> version straight from the server.

---

## Cue 3 — `SB-03` — IN 00:22, OUT 00:34

**ON SCREEN.** The inspector re-renders. A row that was there in cue 1 is gone.
Chip and inspector are in the same frame.

**CAPTION.** The surface follows the policy version.

**NARRATION.**
> And the surface follows it. A tool that was on offer a moment ago is not on
> offer now. The set of tools that can write is never hard-coded — it is
> computed from each tool's `readOnlyHint`, in whatever state the page is in.

---

## Cue 4 — `SB-04` — IN 00:34, OUT 00:48

**ON SCREEN.** The agent's own client window. Re-prompted with the same
sentence, the agent finds that the tool it used a moment ago is no longer on the
surface. It asks the surface why, and the answer names the policy version that
removed it and the rule the draft now breaks.
<!-- PROVENANCE: L2 supplied this shot's ON SCREEN text as the STORYBOARD cell
     and supplied the CAPTION and NARRATION below for this cue. It did not
     separately supply a cue ON SCREEN line. This is L2's storyboard sentence
     reused verbatim for the same field of the same shot, NOT composed here —
     because leaving the old line would have left this cue asserting a refusal
     that its own narration now denies. Flagged to L1 for L2 to correct if a
     different sentence was intended. -->

**CAPTION.** Re-prompted. The tool is gone — and the surface says which version took it.

**NARRATION.**
> Same agent, same sentence. On its next turn it sees the new surface, with no
> page reload — and the tool it needs is simply not there any more. So it asks
> why, and the page tells it: this policy version removed it, and here is the
> rule the draft now breaks. A tool that has been revoked is gone on the agent's
> next call; a call already in flight is not stopped, and we are not claiming it
> is.

---

## Cue 5 — `SB-05` — IN 00:48, OUT 01:00

**ON SCREEN.** Employee session, persona `chen`. One typed sentence. A draft
report appears, each field marked with where it came from.

**CAPTION.** Employee session — agent-proposed fields, marked as such.

**NARRATION.**
> Now the same sentence in two different sessions. As an employee it works, and
> every field the agent proposed is marked as the agent's, distinct from
> anything a human typed.

---

## Cue 6 — `SB-06` — IN 01:00, OUT 01:12

**ON SCREEN.** Auditor session, persona `ruiz`. Identical sentence. The
inspector has no row for that tool.

**CAPTION.** Auditor session — the tool is not on the surface.

**NARRATION.**
> As an auditor, the same sentence has nothing to call. The tool is not on the
> surface at all — there is nothing to refuse, because there is nothing there.

---

## Cue 7 — `SB-07` — IN 01:12, OUT 01:22

**ON SCREEN.** The client's own approval prompt, shown exactly as it appears.

**CAPTION.** The client is asking for approval before this cookie-bearing call.

**NARRATION.**
> The client is asking for approval before this cookie-bearing call. That is
> the client's policy, not ours.

[No further comment. Do not present this as evidence about our design. Rehearse
on the remote origin — this prompt does not appear on localhost.]

---

## Cue 8 — `SB-08` — IN 01:22, OUT 01:36

**ON SCREEN.** A hand-made request goes straight at the API, past the page. The
server answers 403.

**CAPTION.** Forced past the page. Server: 403.

**NARRATION.**
> A menu is not a lock, so let us skip the page entirely and call the API by
> hand, with the same session cookie. The tool surface is the intent surface;
> the boundary is enforced on the server, per request. Four-oh-three.

---

## Cue 9 — `SB-09` — IN 01:36, OUT 01:48

**ON SCREEN.** Human uploads a receipt image. Alongside it, the agent's only
receipt affordance: link a receipt id that already exists.

**CAPTION.** Upload: human channel. Link-by-id: agent channel.

**NARRATION.**
> Receipts arrive through a human channel. No registered tool here takes a
> file-shaped argument, so the agent cannot hand over an image — it can only
> link one that already exists. That asymmetry is page-enforced, and the page
> shows it rather than hides it.

---

## Cue 10 — `SB-10` — IN 01:48, OUT 02:04

**ON SCREEN.** The signature dialog. The worst-case consequence sits directly
above the signature line. The snapshot digest is visible.

**CAPTION.** Worst case, printed above the signature line.

**NARRATION.**
> Before anyone signs, the worst thing this signature can cause is printed
> directly above the line they sign — not in a tooltip, not behind a hover. The
> dialog will not confirm while that line is empty. Beside it: the snapshot
> digest, the exact thing being signed.

---

## Cue 11 — `SB-11` — IN 02:04, OUT 02:14

**ON SCREEN.** The human confirms. The POST goes out. The response shows the
server's own attribution and timestamp.

**CAPTION.** Who and when come from the server, not from the page.

**NARRATION.**
> The dialog does not write down who signed or when. It sends a decision, and
> the server fills in both from the session and its own clock. A commit cannot
> be made without a POST from the authenticated session to
> `/api/sign/{request_id}/respond`.

---

## Cue 12 — `SB-12` — IN 02:14, OUT 02:30

**ON SCREEN.** The agent alters the amount after signing. The server
re-canonicalises, the digest mismatches, the write is rejected. All three
visible in one frame.

**CAPTION.** Amount altered after signing. Digest mismatch. Write rejected.

**NARRATION.**
> Last one. After the signature, the agent changes the amount. The server
> re-canonicalises the snapshot, compares it against the digest that was
> actually signed, and refuses the write. The signature covers the numbers, so
> changing the numbers throws the signature away.

---

## Cue 13 — `SB-13` — IN 02:30, OUT 02:42

**ON SCREEN.** Honesty card. The environment banner is still on screen.

**CAPTION.** What we can attest, and what we cannot.

**NARRATION.**
> What we can attest: that a tool call arrived, and that a human signed the
> snapshot it produced. What we cannot: which agent called. Nothing at this
> boundary carries an attested caller. If the page is driving itself, the
> banner says so for the whole run — and that banner at the top has been
> telling you all along which browser this is and whether the API is present.

---

## Notes for the take

- **First cue is timestamped 00:00 and carries a literal mechanism token**
  (`document.modelContext`). That is graded by grep against
  `kb/webmcp/MECHANISMS.txt`, not by anyone's judgement. Do not paraphrase it,
  do not shorten it, and do not move it later in the cue sheet.
- **Rehearse on the remote origin**, not on localhost. Cue 7 does not exist on
  localhost, and the first time you see it should not be the take that counts.
- **Do not read the one-time value in the sign dialog aloud, and do not frame a
  close-up of it.** It is delivered only into that dialog's rendered markup and
  that placement is the whole of its value.
- **Say "on its next turn."** That is what V2 measured: the surface reaches the
  agent on its next turn, with no page reload. Every cue above already words it
  that way; keep it that way if you ad-lib. Do not substitute any wording that
  implies the agent noticed during the turn already in progress — that class of
  phrasing is banned as **BW-33** in `kb/webmcp/BANNED.txt`.
- **Do not state a tool count as a fixed number** in narration or caption. The
  write set is computed per state from `readOnlyHint`, and the inspector prints
  whatever that yields.
- The banners are never cropped for composition, in any cue.
