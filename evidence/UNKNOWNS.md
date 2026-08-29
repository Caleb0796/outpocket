# V0-V4 — the unknowns register

Measured 2026-08-29 in the **ChatGPT desktop built-in browser**, model **5.6 Sol**,
against the V5 probe. **Chromium major 151** — not the 152 the plan anchors to.

| id | question | verdict | consequence |
|---|---|---|---|
| **V0** | `navigator.modelContext` alias status | **absent** | The 150 removal holds. No fallback path needed. |
| **V1** | `document.modelContext` present, and does the agent SEE the tools? | **PRESENT** | The agent listed all five tools with descriptions verbatim, then executed them. The plan's worst case — judges land on a page with zero tools — does not occur on this client. |
| **V2** | Does the tool list refresh mid-session, no reload? | **refreshes** | Demo beat 1 works on camera. Keep the narration at "on its next turn". |
| **V3** | Does an agent-initiated execute carry the page session cookie? | **same-session** | Kernel ③ survives; `contingencies[0]` does NOT fire; S1 stays at 2.5 h. **But this is the answer that makes the sign gate worse** — see D-19. |
| **V4** | Does a suspended execute time out? | **times out, ~22.3 s** | **Decisive against suspend-until-signed.** S5 ships the two-call handshake. |

## The one that changes a design

**V4 at 22.3 seconds ends the suspend-until-signed sign gate.** A person cannot
review a report and sign it inside 22 seconds. `S5` must ship the two-call
handshake — `execute` returns `{status:"awaiting_signature", ticket}` immediately,
and the signature arrives on a separate call. RISK.md already required S5 to be
written with **both modes behind one switch from the start**, so this is a switch
position rather than a Day-4 rewrite.

## The one that cuts both ways

**V3 = same-session is good news for kernel ③ and bad news for the sign gate.**
An agent whose fetch carries the page cookie can POST `/respond` itself — which is
exactly the surviving forgery vector the contracts layer documents and does not
close (D-19). The `confirm_token` delivered only into the rendered dialog's DOM is
the mitigation, and its residual risk is now **confirmed reachable**, not
hypothetical: this client can both read the DOM and issue same-origin fetches.

## Caveats, stated plainly

1. **Measured on `http://localhost:8795`, not on a remote HTTPS origin.** localhost
   is a secure context and the API was present, but V1/V3 as written specify a
   plain remote HTTPS origin. **Re-run all five against the Render origin** before
   treating any of this as final. The result most likely to differ is V1, because
   the built-in browser has a per-site permission layer (see below).
2. **One run each.** V4's own accept requires two independent runs with a
   disagreement threshold. This is run 1 of 2.
3. **Chromium 151**, while the plan anchors to 152 and one claim wants 153+.

## Settings that made this work — verify before any judged demo

ChatGPT → Settings → **Browser**:
- **Browser** ("Let ChatGPT control the built-in browser") — **on**
- Permissions → **Enable site tools** — **on**. Verbatim: *"Allow ChatGPT to
  discover and call site tools exposed by websites, including WebMCP"*
- **Site permissions** — *"Override the defaults above for specific sites"*,
  currently empty, so the global default applies. **This is the per-site
  authorization layer the handover suspected existed.** It is an override on a
  permissive default, not an allowlist that must be populated first.

The built-in browser opens with **⌘T → View ▸ Browser ▸ Open Browser Tab**, not
`Cmd+Shift+B`. The carried-over shortcut was wrong.
