# Outpocket — demo storyboard

Authored by node **F0** (lane F, owner UX) before anything grades against it.
Downstream: **D4** (the video) cites the shot ids below; **F6** (the demo skin)
resolves every shot id to a CSS selector on the built page. Both edges are hard.

The companion cue sheet is `docs/VIDEO-SCRIPT.md`. Every timestamp there is the
running sum of the `DUR` column here, in shot-id order — the two files are one
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
tool surface changing on screen because a policy version changed. Judges are
permitted to score from the text, images and video alone without ever running
the project, so anything a still frame cannot carry does not count as shown.

## The three beats, in this order

1. **Policy edit, surface change, the agent finds it gone.** Finance edits a
   policy, the version chip bumps, the open draft stops satisfying it, the tool
   surface visibly changes in the inspector, and the same agent — re-prompted —
   finds the tool it needs is no longer offered and is told which policy version
   removed it.
2. **One sentence, two sessions.** The identical instruction succeeds in an
   employee session; in an auditor session the tool is simply not present; and
   forcing the request past the page reaches a real server 403.
3. **Sign, then tamper.** A human signs a snapshot; the agent then alters the
   amount; the server rejects the write when it re-canonicalises.

A short honesty card closes. Nothing after beat 3 introduces a new claim.

---

## Shot list

Durations are whole seconds. **Total: 162s** (budget: under 170s; finished
video under 3 minutes).

| SHOT | BEAT | DUR | ON SCREEN | SELECTOR | STILL? | SURFACE |
|---|---|---|---|---|---|---|
| `SB-01` | 1 | 10s | Employee home. Surface inspector open, one row per registered tool. Policy chip reads its current version. Environment banner sits at the top of the page. | `#surface-inspector [data-tool-row]` | yes | `page` |
| `SB-02` | 1 | 12s | Finance edits the policy. The version chip changes value on screen. | `[data-policy-version]` | yes | `page` |
| `SB-03` | 1 | 12s | The inspector's row count changes in the same frame as the chip. A tool that was listed is no longer listed. | `#surface-inspector` | yes | `page` |
| `SB-04` | 1 | 14s | The agent's own client window. Re-prompted with the same sentence, the agent finds that the tool it used a moment ago is no longer on the surface. It asks the surface why, and the answer names the policy version that removed it and the rule the draft now breaks. | `n/a` | yes | `agent-client` |
| `SB-05` | 2 | 12s | Employee session, `chen`. One sentence typed to the agent. It succeeds; the draft appears with per-field provenance. | `[data-persona="chen"]` | yes | `page` |
| `SB-06` | 2 | 12s | Auditor session, `ruiz`. The identical sentence. The inspector shows the tool is not on the surface at all. | `[data-persona="ruiz"]` | yes | `page` |
| `SB-07` | 2 | 10s | The agent client's own approval prompt, rendered by the client and not by our page. It asks the human to approve a cookie-bearing call before that call is made. Shown as-is. | `n/a` | yes | `agent-client` |
| `SB-08` | 2 | 14s | The request is forced past the page with a hand-made call. The server answers 403 against the session the human already holds. | `n/a` | yes | `terminal` |
| `SB-09` | 3 | 12s | Receipt attached by a human through the upload control. Beside it, the agent's only receipt affordance: link an id that already exists. | `[data-receipt-channel]` | yes | `page` |
| `SB-10` | 3 | 16s | Signature dialog. The worst-case consequence is printed immediately above the signature line, and the snapshot digest is on screen. | `[data-worst-case]` | yes | `page` |
| `SB-11` | 3 | 10s | The human confirms. The page POSTs the decision to the sign endpoint; the response carries the server's own attribution and timestamp. | `[data-signature-line]` | yes | `page` |
| `SB-12` | 3 | 16s | The agent alters the amount after signing. The server re-canonicalises the snapshot, the digest no longer matches, and the write is rejected. | `[data-region="editor"]` | yes | `page` |
| `SB-13` | close | 12s | Honesty card. Environment banner still on screen, still reporting the installed Chromium major and WebMCP presence. | `#env-banner` | yes | `page` |

`162s` = `10+12+12+14+12+12+10+14+12+16+10+16+12`.

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

### `SB-02` — the policy version bumps

Finance edits the policy in a second pane. The only thing that must read in a
still is that the version chip's text changed. Hold long enough that the before
and after frames are both usable as images.

### `SB-03` — the surface changes with it

The inspector re-renders. A row that was present in `SB-01` is absent here.
This is the cheapest place in the whole demo to make the policy-to-surface link
visible, and it is on our own page, so it does not depend on any client's
behaviour.

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
validation verdict. The policy version is not one of those axes, so a policy
edit reaches the surface indirectly: the edited policy makes the open draft stop
validating, the draft goes clean to dirty, and `submit_expense_report` is simply
not offered in the dirty state. There is nothing to refuse the agent with —
exactly as `SB-06` already says of the auditor session, in this same document.

**The frame therefore has two moments and needs both.** First the agent finds
the tool absent. Then it asks the surface why, and the absence register answers
with the policy version and the real violation code the validator actually
returned. The second moment is the one that carries the causal link back to
`SB-02`, and it does not happen unless the agent asks — so film the asking. A
shot that stops at "I don't have that tool" names no version, and is
indistinguishable from a confused agent.

### `SB-05` / `SB-06` — one sentence, two sessions

Same typed sentence, byte for byte, in both. The employee session produces a
draft; the auditor session's inspector has no row for that tool. Shoot these as
a matched pair so they can be published side by side as a single image.

The two personas are `chen` (employee) and `ruiz` (auditor), logged in from the
plaintext demo credentials in the README. There is no third persona.

### `SB-07` — the client's approval prompt

On a remote origin the client may ask the human to approve each cookie-bearing
call. Give it its own cue, show it plainly, and describe it as exactly what it
is: the client is asking for approval before this cookie-bearing call. It is a
client policy, it is absent on localhost, and it is not evidence about our
design. **Rehearse on the remote origin** — the prompt does not appear on
localhost, and the take that counts is not the place to discover it.

**This is filmed on the client, not on our page, and that is why it carries no
selector.** It was anchored to `#agent-banner`, which is our own banner and does
resolve — so it read as a page shot and would have gone on reading as one.
Beyond the miscategorisation there is a claim cost: a client policy that appears
to be on our surface invites exactly the credit `RUBRIC` §3.3 refuses to let us
take for it. Nothing in this shot is evidence about our design, and the
narration already says so.

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

### `SB-10` — the signature dialog

The worst-case consequence is the element immediately preceding the signature
line in DOM order, it is non-empty, and the dialog cannot be confirmed while it
is empty. Frame both in one shot with the snapshot digest visible. Do not crop
the worst-case line for layout; it is the reason the signature means anything.

This is a mechanism shot, not a claim shot. Other projects show a confirmation
step, and at least one client applies its own confirmation policy for
consequential actions. What is shown here is *how* this one is constructed.

### `SB-11` — the POST

The dialog does not author an attribution or a time. It sends a decision, and
the server supplies who and when from the session cookie and its own clock. The
one sentence this shot is allowed to assert is: a commit cannot be made without
a POST from the authenticated session to `/api/sign/{request_id}/respond`.

The dialog also carries a one-time value that is delivered only into its
rendered markup. Do not put it on screen in close-up, do not read it aloud, and
do not claim it establishes personhood — it raises the cost of a forged
response and nothing more.

### `SB-12` — the tamper

After signing, the agent alters the amount. The server re-canonicalises the
snapshot, compares digests, and rejects the write. This is the payoff shot of
the whole demo and it must read in a still: the altered value, the digest
mismatch, and the rejection in one frame.

### `SB-13` — the honesty card

Three lines, on screen long enough to read:

- We can attest that a tool call arrived and that a human signed the snapshot
  it produced. We cannot attest which agent called — nothing at this boundary
  carries an attested caller.
- If the page is driving itself, the banner says **simulated agent**, and it
  says so for the whole run.
- The environment banner reports the installed Chromium major and whether
  WebMCP is present. The installed major is below the version that ships the
  API, so its warning is on screen for the entire demo. It stays on the first
  screen and is never tucked away — a platform gap that is visible is a fact,
  and a platform gap that is hidden is a mystery.

---

## Standing constraints on every shot

- No shot may rely on motion to carry its mechanism.
- No shot opens on a logo, and no shot is built around filling in a form.
- The banner strings are never cropped out of frame for composition.
- Captions state what changed and when it takes effect, never more.
