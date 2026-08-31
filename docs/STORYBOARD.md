# Outpocket — demo storyboard

Authored by node **F0** (lane F, owner UX) before anything grades against it.
Downstream: **D4** (the video) cites the shot ids below; **F6** (the demo skin)
resolves every shot id to a CSS selector on the built page. Both edges are hard.

**Revision 2 (2026-08-31, coordinating session, user-directed).** Rebuilt
against the shipped two-call signature contract (`9471552`) and the immediate
validation behavior (`23dab22`). Beat 1 as originally authored was not
shootable: `/api/policy` is GET-only and version-locked, the `2026-08.2`
document exists in the lock as a digest only — its content is nowhere in the
repository — and a local source edit plus restart destroys the in-memory draft,
so the before and after frames cannot belong to one continuous run. Per the
freeze rule below, `SB-02` and `SB-03` keep their ids with `CUT` markers and
the replacement shots take the next unused numbers, `SB-14` and `SB-15`.

The companion cue sheet is `docs/VIDEO-SCRIPT.md`. Every timestamp there is the
running sum of the `DUR` column here, **in the RUN column's order** (revision 2
runs `SB-12` before `SB-11`; id order and running order are no longer the same
thing, which the freeze rule below always permitted). The two files are one
artifact split in two, and if you change a duration you change both.

---

## Shot-id freeze rule

Shot ids are `SB-NN`, zero-padded, and they are **stable**: an id, once written
here, names the same moment for the life of the project. They are never
renumbered and never reused. A shot that is cut keeps its id with a `CUT`
marker so a citation elsewhere still resolves; a shot that is inserted takes
the next unused number regardless of where it falls in the running order. D4
and F6 both cite these strings, so moving one silently breaks two nodes.

## What this demo is not allowed to open with

Not a logo, and not form-filling. The first frame is the middle of beat 1 — a
live tool surface on screen that is about to be recomputed. Judges are
permitted to score from the text, images and video alone without ever running
the project, so anything a still frame cannot carry does not count as shown.

## The three beats, in this order

1. **The agent's own over-cap line changes its menu.** The agent adds a $180
   transport line; validation runs in the same call and returns a blocking
   `CAP_TRANSPORT` finding; the tool surface visibly loses
   `submit_expense_report` in the inspector; and the same agent — re-prompted —
   finds the tool it needs is no longer offered and asks
   `explain_missing_tool`, which names the rule the draft now breaks and the
   repair the policy expects.
2. **One sentence, two sessions.** The identical instruction succeeds in an
   employee session; in an auditor session the tool is simply not present; and
   forcing the request past the page reaches a real server 403.
3. **Receipt, lock, then sign.** A human attaches the receipt the corrected
   line now requires; the agent's submit call suspends into an awaiting-
   signature ticket and the dialog opens; while that request is open the agent
   tries to edit the amount and the server answers **HTTP 423
   `E_SIGN_IN_PROGRESS`**; then the human signs, and the page shows the
   server's own read-back.

A short honesty card closes. Nothing after beat 3 introduces a new claim.

---

## Shot list

Durations are whole seconds. **Total: 162s** (budget: under 170s; finished
video under 3 minutes). `RUN` is the running order; note `SB-12` runs before
`SB-11` — the lock is demonstrated while the sign request is open, which is
the only time it can be.

| SHOT | RUN | BEAT | DUR | ON SCREEN | SELECTOR | STILL? | SURFACE |
|---|---|---|---|---|---|---|---|
| `SB-01` | 1 | 1 | 10s | Employee home, mid-session, an open clean draft (one $20 transport line). Surface inspector open, one row per registered tool, `submit_expense_report` present. Policy chip legible. Environment banner at the top of the page. | `#surface-inspector [data-tool-row]` | yes | `page` |
| `SB-02` | — | — | 0s | **CUT (rev 2).** "Finance edits the policy in a second pane" has no trigger path in the product: the policy route is GET-only and version-locked, and the `2026-08.2` content does not exist in the repository. Id kept per the freeze rule. | `[data-policy-version]` | — | `page` |
| `SB-03` | — | — | 0s | **CUT (rev 2).** Downstream of `SB-02`; superseded by `SB-15`, which shows the same surface change driven by the validation verdict — the axis the surface is actually compiled from. Id kept per the freeze rule. | `#surface-inspector` | — | `page` |
| `SB-04` | 4 | 1 | 14s | The agent's own client window. Re-prompted, the agent finds the tool absent — absence, not refusal — and calls `explain_missing_tool`; the answer names the violated rule and the repair the policy expects. | `n/a` | yes | `agent-client` |
| `SB-05` | 5 | 2 | 12s | Employee session, `chen`. One sentence typed to the agent. It succeeds; the draft appears with per-field provenance, assigned by the server. | `[data-persona="chen"]` | yes | `page` |
| `SB-06` | 6 | 2 | 12s | Auditor session, `ruiz`. The identical sentence. The inspector shows the write tools are not on the surface at all — 7 read-only tools. | `[data-persona="ruiz"]` | yes | `page` |
| `SB-07` | 7 | 2 | 10s | The agent client's own approval prompt, rendered by the client and not by our page. It asks the human to approve a cookie-bearing call before that call is made. Shown as-is. | `n/a` | yes | `agent-client` |
| `SB-08` | 8 | 2 | 14s | The request is forced past the page with a hand-made call. The server answers 403 against the session the human already holds. | `n/a` | yes | `terminal` |
| `SB-09` | 9 | 3 | 12s | Receipt attached by a human through the upload control, for the corrected $48 line (at/above the $25 receipt threshold). Beside it, the agent's only receipt affordance: link an id that already exists. | `[data-receipt-channel]` | yes | `page` |
| `SB-10` | 10 | 3 | 16s | The agent calls `submit_expense_report`; the call correctly suspends into an awaiting-signature ticket, and the signature dialog opens: the worst-case consequence is printed immediately above the signature line, and the snapshot digest is on screen. | `[data-worst-case]` | yes | `page` |
| `SB-11` | 12 | 3 | 10s | The human confirms. The page then shows the server's own read-back: status submitted, attribution, method, timestamp, and the linked day-book entry. | `[data-signature-line]` | yes | `page` |
| `SB-12` | 11 | 3 | 16s | With the sign request open, the agent tries to alter the amount. The report is locked: the server answers **423 `E_SIGN_IN_PROGRESS`**. Altered attempt and rejection in one frame. | `[data-region="editor"]` | yes | `page` |
| `SB-13` | 13 | close | 12s | Honesty card. Environment banner still on screen. | `#env-banner` | yes | `page` |
| `SB-14` | 2 | 1 | 12s | The agent adds a $180 airport car (transport). Validation runs in the same call: a blocking `CAP_TRANSPORT` finding renders in the editor — "$180.00 exceeds the $150.00 per-trip transport cap" — with its fix hint. | `[data-region="editor"]` | yes | `page` |
| `SB-15` | 3 | 1 | 12s | The inspector re-renders in the same frame: the `submit_expense_report` row is absent. Clean state offered 14 tools; the dirty state offers 13 — the difference is exactly this row. | `#surface-inspector` | yes | `page` |

`162s` = `10+12+12+14+12+12+10+14+12+16+16+10+12` in run order
(`SB-01,14,15,04,05,06,07,08,09,10,12,11,13`); the cut rows contribute `0s`.

Every row answers **yes** to STILL. That column is the acceptance bar for this
document, not a nicety: a mechanism that only reads in motion is not shown.

---

## Per-shot notes

### `SB-01` — cold open, the surface as it stands

Open mid-state, not on a title. The inspector panel is the point of the frame:
one rendered row per entry in `document.modelContext.getTools()`, and a policy
version chip whose text is the value returned by `GET /api/policy`. A judge
looking only at this still should be able to see that the page is publishing
what it offers, and that the offer is versioned.

Do not caption a tool count as a fixed number. The write set is **computed per
state** — every tool whose `readOnlyHint` is not true — and the inspector
prints whatever that computation yields in the state on screen.

### `SB-02` / `SB-03` — CUT

Kept for citation stability. The mechanism they were written to show — a
third-party policy edit propagating to the surface — has no trigger path on
the shipped product (GET-only, version-locked policy route; the `2026-08.2`
document exists as a digest only). The surface is compiled from role, report
state and validation verdict; `SB-14`/`SB-15` show the same propagation on the
axis that actually exists.

### `SB-14` — the over-cap line, and the verdict in the same call

Since `23dab22`, `add_expense_line` validates in the same call: the blocking
finding is on screen the moment the line lands, with no separate
`validate_expense_report` needed to trigger it. Film the editor: the $180
amount and the `CAP_TRANSPORT` finding — "$180.00 exceeds the $150.00 per-trip
transport cap" — must both read in one still, with the fix hint visible.

The fix hint for this rule says an over-cap trip needs a written exception
from an approver. The agent's on-camera repair is therefore to correct the
line (the real fare, $48), not to argue with the cap.

### `SB-15` — the surface changes with it

The inspector re-renders. The row that was present in `SB-01` —
`submit_expense_report` — is absent here. The clean state offers 14 tools and
the dirty state 13; the difference is exactly this row, so the frame is
checkable against `artifacts/tools.export.json`.

Say what changed and no more: a tool that has been revoked is refused on the
agent's **next** call. A call already in flight is not stopped, and nothing in
this shot claims otherwise.

### `SB-04` — the same agent, re-prompted

**Re-prompt the agent.** Do not imply the running turn changed underneath it.
The measured behaviour is that the surface reaches the agent on its next turn
with no page reload, and "on its next turn" is the phrasing this shot, its
caption and its narration all use.

**This shot is filmed in the agent's own client window, and what it shows is
ABSENCE, NOT REFUSAL.** The surface is compiled from role, report state and
validation verdict; the dirty draft simply does not offer
`submit_expense_report`. There is nothing to refuse the agent with.

**The frame has two moments and needs both.** First the agent finds the tool
absent. Then it asks the surface why — `explain_missing_tool`, the absence
register, resident in all six states — and the answer names the violated rule
(the validator's real violation code) and the repair the policy expects. The
second moment carries the causal link back to `SB-14`, and it does not happen
unless the agent asks — so film the asking. A shot that stops at "I don't have
that tool" names no rule, and is indistinguishable from a confused agent.

### `SB-05` / `SB-06` — one sentence, two sessions

Same typed sentence, byte for byte, in both. The employee session produces a
draft; the auditor session's inspector has no row for that tool. Shoot these as
a matched pair so they can be published side by side as a single image.

The two personas are `chen` (employee) and `ruiz` (auditor), logged in from the
plaintext demo credentials in the README. There is no third persona.

Provenance in `SB-05` is server-assigned: the fields the agent proposed are
marked as the agent's by the server, not claimed by the client. Rehearse what
the marking looks like on the built page before the take.

### `SB-07` — the client's approval prompt

On a remote origin the client may ask the human to approve each cookie-bearing
call. Give it its own cue, show it plainly, and describe it as exactly what it
is: the client is asking for approval before this cookie-bearing call. It is a
client policy, it is absent on localhost, and it is not evidence about our
design. **Rehearse on the remote origin** — the prompt does not appear on
localhost, and the take that counts is not the place to discover it.

**This is filmed on the client, not on our page, and that is why it carries no
selector.** A client policy that appears to be on our surface invites exactly
the credit `RUBRIC` §3.3 refuses to let us take for it. Nothing in this shot is
evidence about our design, and the narration already says so.

### `SB-08` — forcing the request past the page

The page's own 403 is an affordance, not enforcement. What this shot is for is
the other one: the tool surface is the intent surface; the boundary is enforced
on the server, per request, against the session the human already holds. Show
the hand-made call and the server's answer to it.

### `SB-09` — the receipt channel

There is no binary channel here: an agent cannot deliver an image or a PDF, and
may only link an id that already exists. That asymmetry is **page-enforced** —
no registered tool takes a file-shaped argument — and the shot should make the
two channels visibly different rather than hide the difference.

Do not say the raw material stays outside the store. It does not: attachments
are uploaded and stored. The honest narrowing is that the derivation context
does not enter the store.

The corrected $48 line is what forces this beat: lines at or above $25.00
require a linked receipt, and the finding's own text says the employee attaches
the file in the page.

### `SB-10` — the signature dialog

The worst-case consequence is the element immediately preceding the signature
line in DOM order, it is non-empty, and the dialog cannot be confirmed while it
is empty. Frame both in one shot with the snapshot digest visible. Do not crop
the worst-case line for layout; it is the reason the signature means anything.

Submitting does not submit: the call correctly **suspends** into the two-call
handshake (an opaque awaiting ticket; the page records the human decision; the
commit claims the bound snapshot exactly once). Do not await the suspended
call in any driving harness — the suspension is the tool behaving as designed.

The server-side sign request expires in five minutes. From this shot to
`SB-11` is one continuous take, planned before the camera rolls.

This is a mechanism shot, not a claim shot. Other projects show a confirmation
step, and at least one client applies its own confirmation policy for
consequential actions. What is shown here is *how* this one is constructed.

### `SB-12` — the tamper, while the human is reviewing

Runs **before** `SB-11`: the lock exists only while the sign request is open,
so the attempt must be filmed before the human clicks. Every mutating report
route calls `assertUnlocked` first; the attempt draws **HTTP 423
`E_SIGN_IN_PROGRESS`** — "report has an open sign request in progress". What
the human is reviewing cannot be moved underneath them.

This is the payoff shot of the whole demo and it must read in a still: the
attempted edit and the 423 rejection in one frame. The narration may add — as
a statement about commit, not about this frame — that the server also
re-canonicalises the bound snapshot and recomputes the verdict at commit.

### `SB-11` — the human confirms, the server answers

The dialog does not author an attribution or a time. It sends a decision, and
the server supplies who and when from the session cookie and its own clock. The
one sentence this shot is allowed to assert is: a commit cannot be made without
a POST from the authenticated session to `/api/sign/{request_id}/respond`.

What the page shows after the click is the server's **read-back** — status
submitted, attribution, method, timestamp, and the linked day-book entry — not
the click's local echo.

The dialog also carries a one-time value that is delivered only into its
rendered markup. Do not put it on screen in close-up, do not read it aloud, and
do not claim it establishes personhood — it raises the cost of a forged
response and nothing more.

### `SB-13` — the honesty card

Three lines, on screen long enough to read:

- The signature binds the authenticated session and the presented snapshot. It
  does not prove a person clicked, and nothing at this boundary carries an
  attested caller.
- A revoked tool stops the agent's next call, not a call already in flight.
- The personas are one-click by design; this is not an authentication demo.

If the page is driving itself at any point, the banner says **simulated
agent**, and it says so for the whole run. The environment banner reports the
running Chromium major and whether WebMCP is present; it stays on the first
screen and is never tucked away, and it is left to say whatever is true of the
take's actual client.

---

## Standing constraints on every shot

- No shot may rely on motion to carry its mechanism.
- No shot opens on a logo, and no shot is built around filling in a form.
- The banner strings are never cropped out of frame for composition.
- Captions state what changed and when it takes effect, never more.
