# Shoot gate — a signature completed on PRODUCTION

**Run by L1, 2026-08-30, against https://outpocket.onrender.com.** Every line below is a
measurement taken in this session, not a claim carried from a test.

**Deployed commit:** live `/version` == local HEAD == `bbbaa80b97ef`.

| step | result |
|---|---|
| `POST /api/login` persona chen — the human act no tool can perform | **200** |
| `POST /api/sign`, well-formed body | **200**, `request_id sg_e3dd36537b735d1f` |
| `GET /api/sign/{id}/confirm-token` — **the D-89 channel** | **200**, `ct_10586b3c…` |
| **INVARIANT:** `confirm_token` in the agent-visible `GET /api/sign/{id}` | **0 occurrences**, and 0 of the literal token value |
| `POST /respond` with a **WRONG** token | **403 `E_NO_CONFIRM_TOKEN`** — the guard bites |
| `POST /respond` with the token **the page obtained** | **200**, `state:"answered" decision:"signed" signed_by:"Chen Xiao"` |
| server alive throughout | `GET /api/me` **200** after every step |

**The crash fix is live and verified on production:** a malformed `POST /api/sign` from a
signed-in session returns **400 `E_BAD_SIGN_REQUEST`** naming the missing fields, and
`/api/me` afterwards returns 200 — the process survives. Pre-fix the same request killed it.

## Two things this run cost me, both of which are the sprint's own lessons

**I guessed a route name and a field value instead of reading the authority.** `POST
/api/session` and `decision:"approve"` were both my invention; the real ones are `/api/login`
and `decision:"signed"`, and the frozen `signature.schema.json` says so. Two 400s I caused
myself.

**FORCE_COLOR bit me, in the exact way `kb/pits/L0.md` documents.** I read a revision out of a
JSON file with `node -e 'console.log(...)'` and the value arrived as `'\e[33m1\e[39m'` —
**Node colourised an inspected value into a shell variable**, so my JSON body was malformed and
the server answered 400. I have quoted that pit into every dispatch brief today. The fix is
`process.stdout.write(String(x))`, which does not inspect and does not colour.

**And the error did not discriminate.** A wrong token and a malformed body both returned
`400 E_BAD_REQUEST`, so I could not tell which I had until I fixed the encoding — at which
point the wrong token became a **403 `E_NO_CONFIRM_TOKEN`**, a different code entirely. A
validation error that masks an authorization error makes the authorization error untestable
from outside; worth someone's attention, not fixed here.

---

# Addendum — the DOM half, partially closed

**Run by L1 against a LOCAL server, real Chrome, `--enable-features=WebMCP`.** Local
deliberately: the wiring question is about CODE, not about which host it runs on, and QA's
harness had blocked the equivalent write on production pending its own user's approval — which
was the right refusal and not one to route around.

## Measured, and this is the D-89 wiring question answered

| | |
|---|---|
| surface state after the seeded demo | **S3** |
| `submit_expense_report` on the surface | **true** |
| `outpocketSignInstall.result` | **`{"installed":true}`** |
| agent calls `executeTool('submit_expense_report')` → dialogs mounted | **0 → 1** |
| **`confirm_token` present in the mounted dialog** | **true** |
| **`confirm_token` shape `ct_<32hex>`** | **true** |
| `[data-worst-case]` (SB-10) | *"You are certifying that expense report RP-1018 — 3 lines, $43.95 — is complete a…"* |
| `[data-signature-line]` (SB-11) | **present** |
| `[data-sign-confirm]` | **present** |

**So F4's mount, F7's provider and I3's `openForDialog` do work together in a real browser:
an agent's submit raises a real dialog that has obtained a real, correctly-shaped token
through the page's own channel.** That is the thing nobody had shown, and it is shown.

## NOT established, and I am not claiming it

**That clicking confirm completes the signature.** My click probe is inconclusive: it captured
no `fetch` call, the dialog remained mounted, and the page's words after the click ("signed",
"submitted") **may have been present before it** — I did not capture a before/after diff of
that text, so it is not evidence. Two follow-up probes to settle it server-side were both
wrong: `GET /api/reports` does not exist (the route is POST-only) so its `signature:null`
proved nothing, and my next attempt at the page's own ERP threw.

**Three probe errors in a row is the point at which the instrument is the problem, not the
subject.** I stopped rather than keep grinding, because a fourth attempt risks producing a
green I would want to believe. **The click-completes step remains OPEN and belongs to QA's
browser run**, which is blocked on QA's own user and correctly so.
