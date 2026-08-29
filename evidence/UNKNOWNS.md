# The unknowns register — V0–V4, plus the sixth we found on the way

All observations 2026-08-29, **ChatGPT desktop built-in browser**, model **5.6 Sol**,
**Chromium major 151** — one client, one model, one Chromium major. The 152 the plan
anchors to is a *different browser* (the installed standalone Chrome); the gap is
recorded, not resolved.

> **Provenance is per row, not blanket.** An earlier revision of this file said all
> five were measured on the remote origin. That was false for three of them, and
> `V6-consent-gate` is the standing proof that localhost and remote **differ in this
> client** — so the distinction is never cosmetic. Origins are stated in each row and
> in each `evidence/V*.json`. Ruling **R-44**.

> **These are readings, not passed gates.** None of `V0`, `V1`, `V2` or `V4` satisfies
> its answering node's `accept`: `V1` wants a canonical `evidence/V1.json` plus a
> non-empty `evidence/V1.png`; `V2` wants a before/after count pair and a wall-clock
> gap; `V4` wants two runs and `harness/compare-runs.mjs`; `V0` wants a nine-field CDP
> artifact from the **installed** Chrome. They are decisive enough to steer the design
> and **not** sufficient to close their nodes. No document may cite them as passed.

Six rows. Each **ends in the literal token** `MEASURED` or `UNVERIFIED` **with no
trailing table pipe** — that is node `V6`'s byte-literal predicate, and the missing
final `|` is deliberate. Do not "fix" it. An `UNVERIFIED` row must carry an explicit
`fallback:<node-id>` token naming a node in `erp/graph.json`.

> **Read the sixth key with its suffix.** The finding is `V6-consent-gate`, never a
> bare `V6` — bare `V6` is a **node id** in `erp/graph.json` (the PM's unknowns
> verdict). See `graph.json.id_collision_warnings`, ruling **R-43**.

| id | question | verdict | consequence |
|---|---|---|---|
| **V0** | Does the `navigator.modelContext` alias survive? | **absent** (localhost) | The Chromium 150 removal holds; a separate prose note records it absent on standalone Chrome 152 too. No fallback path is needed and none is built. MEASURED
| **V1** | Is `document.modelContext` present, and does the agent *see* the tools? | **PRESENT** (remote, `webmcp-probe.onrender.com`) | `evidence/V1-remote.json` records `toolCount: 5` and the agent listing all five **tool names** on an origin the account had never visited, with the per-site permission layer unpopulated. It records **names, not descriptions, and not executions** — the one execution on record is `probe_whoami`, after approval, in `V6-consent-gate.json`. The plan's worst case, judges landing on a page with zero tools, was not observed. `contingencies[0]` does not fire. MEASURED
| **V2** | Does the tool list refresh mid-session, with no reload? | **refreshes** (localhost) | A sixth tool registered at runtime reached the agent with no page reload, on a **subsequent turn** of the same conversation. It does **not** establish that a surface change reaches the model mid-turn. Narration stays "on its next turn"; "on the spot" remains forbidden. Not re-run remotely. MEASURED
| **V3** | Does an agent-initiated `execute` carry the page session cookie? | **same-session** (localhost; confirmed remote in `V6-consent-gate.json` after approval) | `cookiePresent: true, cookieMatches: true`, `Sec-Fetch-Site: same-origin`. Kernel ③ survives and `S1` stays at 2.5 h; `contingencies[2]` does not fire and `[3]` fires **for this conjunct only**. It measures cookie carriage and **nothing about DOM read access** — see below. MEASURED
| **V4** | Does a suspended `execute` time out? | **times out, 22,267 ms** (localhost, **run 1 of 2**) | `Timed out running CDP command "Runtime.evaluate" for tab 1`. Enough to make the handshake the conservative default; **not** enough to close the node, which wants two runs compared at 20%. `contingencies[4]` is **provisionally selected, not fired**. MEASURED
| **V6-consent-gate** | Does the client gate an agent-initiated *cookie-bearing* request behind human approval? | **prompted once on a remote origin; no prompt on localhost** | Treat solely as **demo friction and a rehearsal requirement**. It is a client policy this server cannot observe, require, or fall back on. It reduces no server-side risk and infers no co-presence. MEASURED

## The one that changes a design

**V4's 22.3 seconds makes suspend-until-signed the wrong default.** A person cannot
review a report and sign it in that window. `S5` therefore ships the two-call
handshake: `execute` returns `{status:"awaiting_signature", ticket}` immediately and
the signature arrives on a separate call. `RISK.md` already required `S5` to carry
**both modes behind one switch**, so this is a switch position, not a rewrite.

**State the reading at its real strength (R-44).** One run, on localhost. It does not
separate a WebMCP client timeout from a CDP evaluation-wrapper timeout; it does not
show the underlying `execute()` was cancelled; it does not carry to a remote origin;
and one run is not repeatability. "Provisionally selected on one localhost run" is the
strongest honest phrasing. Anything firmer is an overclaim.

**What the mode change costs, stated plainly.** Suspension gave automatic call/result
correlation, no agent-visible continuation handle, one pending call instead of a
success followed by an optional continuation, and cancellation tied to that
invocation. The handshake gives those up and opens a real gap between the two calls.
What closes the gap is the server-held sign lock — and that is **`S12`'s** property,
built and tested downstream of `S5`, not something `S5` may assert about itself.

## The one that cuts both ways — and the half of it that is *not* measured

**V3 = `same-session` is good for kernel ③ and bad for the sign gate.** An agent whose
fetch carries the page cookie can POST `/respond` itself — the surviving forgery the
contracts layer documents and does not close (D-19).

**But the forgery's precondition has two conjuncts and we measured one.** Cookie
carriage: measured. **Read access to the rendered dialog's DOM, where the
`confirm_token` is the only thing ever delivered: measured nowhere.** No run rendered
a sign dialog, queried a DOM, or extracted a token. The permitted sentence is: *the
vector remains open for any caller that also obtains DOM read access, and this
evidence does not establish that second conjunct for this client.* That is not a
closure — it removes an unsupported assertion about *which* caller has the access.

---

## `V6-consent-gate` — the finding the localhost run could not have produced

**On a remote origin this client asked for approval before an agent-initiated
cookie-bearing request. On localhost it did not.** Verbatim, for `probe_whoami` on
the Render origin:

> `probe_whoami` may transmit the browser's session cookie to
> `webmcp-probe.onrender.com`, so the browser blocked it pending action-time
> approval. Do you authorize that cookie-bearing request?

After approval it ran and returned `cookiePresent: true, cookieMatches: true` — which
is also the only remote confirmation of `V3` on record.

**It gets no security credit. R-44, and this is a correction of the previous
revision of this file.** One observation does not show that *every* cookie-bearing
call prompts. An approval click is not a review and is not co-presence. This server
cannot detect the policy, cannot require it, and cannot fall back when it is absent —
a different client, a future version, a localhost origin, or a reflexive click each
defeats it. A disclaimer printed *after* a reassurance does not undo the reassurance,
so the reassurance is deleted rather than qualified: **the sign gate's residual risk
is exactly what the contract states, unchanged.**

**What it is good for, and it is worth having for this:** on the judged origin a
cookie-bearing call may cost a human approval on camera. Beat 2 scripts it. And the
rehearsal must run on the **remote** origin — a localhost rehearsal shows no prompt at
all and leaves the crew surprised on the take that counts.

---

## Settings that made this work — verify before any judged demo

ChatGPT → Settings → **Browser**:
- **Browser** ("Let ChatGPT control the built-in browser") — **on**
- Permissions → **Enable site tools** — **on**. Verbatim: *"Allow ChatGPT to
  discover and call site tools exposed by websites, including WebMCP"*
- **Site permissions** — *"Override the defaults above for specific sites"*,
  currently empty, so the permissive global default applies. **This is the per-site
  authorization layer the handover suspected existed.** It is an override on a
  permissive default, not an allowlist that must be populated first — a brand-new
  origin needs no entry.

The built-in browser opens with **⌘T → View ▸ Browser ▸ Open Browser Tab**, not
`Cmd+Shift+B`. The carried-over shortcut was wrong. Each ChatGPT chat carries its own
browser session; a new chat starts with an empty tab list.
