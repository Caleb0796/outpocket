# The unknowns register — V0–V4, plus the sixth we found on the way

Measured 2026-08-29 in the **ChatGPT desktop built-in browser**, model **5.6 Sol**,
**Chromium major 151** — not the 152 the plan anchors to — against node `V5`'s probe
at **`https://webmcp-probe.onrender.com`**, a real remote HTTPS origin.

Six rows. Each ends in the literal token `MEASURED` or `UNVERIFIED`; an `UNVERIFIED`
row must name an existing node id from `erp/graph.json` as its fallback. Node `V6`'s
accept asserts that count exactly (`tools/check-unknowns.mjs`).

> **Read the sixth key with its suffix.** The finding is `V6-consent-gate`, never a
> bare `V6` — bare `V6` is a **node id** in `erp/graph.json` (the PM's unknowns
> verdict). See `graph.json.id_collision_warnings`, ruling **R-43**.

| id | question | verdict | consequence |
|---|---|---|---|
| **V0** | Does the `navigator.modelContext` alias survive? | **absent** | The Chromium 150 removal holds. No fallback path is needed and none is built. MEASURED |
| **V1** | Is `document.modelContext` present, and does the agent actually *see* the tools? | **PRESENT** | The agent listed all five tools with their descriptions verbatim, then executed them, on an origin this account had never visited. The plan's worst case — judges land on a page with zero tools — does not occur on this client, so `contingencies[0]` does not fire and `D2` stays cut rank 1. MEASURED |
| **V2** | Does the tool list refresh mid-session, with no reload? | **refreshes** | A sixth tool registered at runtime reached the agent with no page reload. Demo beat 1 is filmable. Keep the narration at "on its next turn" — what refreshed is the list the agent read on its *next* turn. MEASURED |
| **V3** | Does an agent-initiated `execute` carry the page session cookie? | **same-session** | `cookiePresent: true, cookieMatches: true`. Kernel ③ survives and `S1` stays at 2.5 h. **This is also the answer that makes the sign gate worse** — see below and D-19. `contingencies[3]` **fired**. MEASURED |
| **V4** | Does a suspended `execute` time out? | **times out, 22.3 s** | `Timed out running CDP command "Runtime.evaluate" for tab 1` at 22,267 ms. Decisive against suspend-until-signed; `S5` ships the two-call handshake. `contingencies[4]` **fired**. MEASURED |
| **V6-consent-gate** | Does the client gate an agent-initiated *cookie-bearing* request behind human approval? | **yes on a remote origin, no on localhost** | The client blocked the call pending action-time approval on the Render origin and did not prompt at all on `localhost`. Raises the cost of the surviving forgery and **closes nothing**; the demo must script the prompt. Client policy, not a server guarantee. MEASURED |

## The one that changes a design

**V4 at 22.3 seconds ends the suspend-until-signed sign gate.** A person cannot
review a report and sign it inside 22 seconds — the gate would not *risk* a timeout,
it would time out on every take. `S5` ships the two-call handshake: `execute` returns
`{status:"awaiting_signature", ticket}` immediately and the signature arrives on a
separate call. `RISK.md` already required `S5` to be written with **both modes behind
one switch from the start**, so this is a switch position, not a Day-4 rewrite.

What the mode change does **not** cost: the freeze. The report was never frozen by the
unresolved promise — it is frozen by the server-held sign lock (`S12`,
`signature.schema.json` `x-freeze` layer 2), which spans the gap between the two calls
and refuses every mutating request with `423 E_SIGN_IN_PROGRESS`.

## The one that cuts both ways

**V3 = `same-session` is good news for kernel ③ and bad news for the sign gate.**
An agent whose fetch carries the page cookie can POST `/respond` itself — exactly the
surviving forgery the contracts layer documents and does not close (D-19). The
`confirm_token`, delivered only into the rendered dialog's DOM, is the mitigation, and
its residual risk is now **confirmed reachable rather than hypothetical**: this client
both reads the DOM and issues same-origin credentialed fetches.

---

## V6-consent-gate — the finding the localhost run could not have produced

**On a remote origin, this client gates an agent-initiated cookie-bearing request
behind action-time human approval. On localhost it does not.**

Verbatim, when asked to call `probe_whoami` on the Render origin:

> `probe_whoami` may transmit the browser's session cookie to
> `webmcp-probe.onrender.com`, so the browser blocked it pending action-time
> approval. Do you authorize that cookie-bearing request?

After approval it ran and returned `cookiePresent: true, cookieMatches: true`.

**Two consequences, pulling in opposite directions.**

*Against the demo's smoothness:* every cookie-bearing tool call on a real origin may
cost a human approval. Beat 2 of the storyboard **scripts** this rather than being
ambushed by it — and the rehearsal must run on the **remote** origin, because a
localhost rehearsal will not show the prompt at all.

*In favour of the sign gate:* the surviving forgery (D-19) needs the agent to POST
`/respond` carrying the session cookie. On a remote origin this client blocks exactly
that, pending a human.

**Do not overclaim it.** This is a *client policy*, not a server guarantee and not a
browser invariant. Our server cannot detect it, require it, or fall back when it is
absent. A different client, a future version, a localhost origin, or a user who
approves reflexively — each defeats it completely. It raises the attack's cost; it
does not close the hole, and D-19's provable sentence is unchanged.

---

## Caveats, stated plainly

1. **One run each.** `V4`'s own accept requires two independent runs with a 20%
   disagreement threshold (`harness/compare-runs.mjs`). **This is run 1 of 2** and
   `V4` is not closed against its own predicate until run 2 exists. The register
   records the reading, not a passed gate.
2. **Chromium 151** in the ChatGPT built-in browser, while the plan anchors to 152
   (the installed standalone Chrome) and one claim wants 153+. Three different
   browsers are in play and the gap is recorded, not resolved.
3. **`V0`–`V4` are answered; the earlier "re-run all five on a remote origin" caveat
   is discharged.** `V1` and `V3` were re-measured against
   `https://webmcp-probe.onrender.com`; `V2` and `V4` were observed on that same
   origin in the same session. `V0` is a property of the browser build, not of the
   origin.

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
