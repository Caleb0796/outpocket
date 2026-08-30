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
