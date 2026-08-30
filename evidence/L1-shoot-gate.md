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

---

# Addendum 2 — the sign record is session-scoped by OWNERSHIP, measured on production

Found while preparing to observe a human signature, and worth recording as a POSITIVE
result rather than only as an obstacle to my observation.

`GET /api/sign/{request_id}` is scoped by session **ownership**, not merely by the caller
having *a* session: `server/index.mjs:305` passes `{ sessionId: session.sid }` into
`signGate.get()`. Measured against `https://outpocket.onrender.com`:

| request | result |
|---|---|
| `GET /api/sign/sg_e3dd…` with **no cookie** | **401** |
| the same, with **a different valid session's cookie** | **401** |

**A signed-in user cannot read another user's sign request.** That is a real access-control
property of the shipped product, and it holds on the live host rather than only in a test.
No route in the table exposes sign state without the owner's cookie — checked against the
full route list, not inferred.

**And it is why my own observation protocol was wrong.** I told the relay I would read the
server before and after a human's click. **I could not have** — the record lives under their
cookie and my session is refused, correctly. I had described that step as ready before
testing it, and found it only because the relay said the user might begin at any moment.
The corrected protocol asks the human for one devtools glance at their own `POST
/respond`, because **their session is the only one entitled to see it.**

The thing I would keep: **I asserted a capability of my own instrument without exercising
it, one message before it was to be leaned on.** That is the same defect this sprint has
found in five other instruments, arriving in the observation plan rather than in a tool.

---

# Addendum 3 — what the record CANNOT tell you, and what tonight's live attempt did show

## The projection is identical whether a request was signed or not

Measured by driving the real `signGate` and reading `GET /api/sign/{id}` on both sides of a
real signature:

    while OPEN     schema, request_id, report_id, revision, policy_version, snapshot,
                   snapshot_digest, worst_case, violation_history_count, created_at, expires_at
    after SIGNING  IDENTICAL — state / decision / signed_by all undefined

`stripTicketAndToken` projects exactly `$defs.sign_request`'s shape, and the frozen schema's
`additionalProperties:false` forbids more. **So an auditor holding a `request_id` cannot tell
from the record whether it was ever signed.** The outcome exists only in the EPHEMERAL response
to the act — `toSignResponse`, carrying `state`/`decision`/`signed_by`/`at`.

Not filed as a defect: the day book and commit chain may be the intended durable witness. With
PM and I3 as a design question, because **any change touches a frozen schema.**

**And it is why two versions of my own observation plan were worthless.** I first said I would
read the server before and after the human's click — I could not, the record is session-
OWNERSHIP-scoped and my session is refused. Correcting that, I offered a GET re-read as
equivalent to a devtools read — **and the GET cannot express the answer at all.** Both claims
were measured only after being relayed. **The only external witness to a completed signature is
the `POST /respond` response**, which is what D4's first take must capture.

## What the live attempt DID establish, on production, in a real ChatGPT built-in browser

Observed by the user and the relay, not by me, and recorded because it goes beyond my own runs:

- **The dialog mounted on PRODUCTION** with correct digest and worst-case text — a step past my
  local DOM run.
- **The agent REFUSED to sign, unprompted, in its own words:** *"我不会代替你作出真实性声明"*
  — "I will not make a truthfulness declaration on your behalf." **SB-04's beat happening
  unscripted, on the live site.**
- **The expiry guard fired correctly** on a stale request. The TTL is 300s (`sign.mjs:66`,
  R-43 — deliberately the human's budget). A live demo with an agent in the loop, a chat
  confirmation and a flapping page bridge **can eat that window**; it did. A shooting
  constraint, not a defect: the clock starts at `open`, not at the click.
- **`confirm_token` appears zero times in the full record the OWNER sees** — D-89's invariant,
  confirmed on production by a third party from the one session entitled to look.

## Evidence I destroyed

A possibly-decisive record of that attempt sat in server memory. I pushed on a relayed "freeze
can lift", the redeploy wiped it, and the correction arrived after. **I treated a lift as a
green rather than confirming the user had left the flow.** It happens to cost nothing — the GET
could never have read it, per above — but that is luck, not judgement.
