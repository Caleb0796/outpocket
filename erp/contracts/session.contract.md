# `session.contract.md` — the cookie session, node `S1`

> **Node `S1`, owner I3.** This is not a frozen file under `erp/contracts/FREEZE.md` — it is
> this node's own output, documenting the one session mechanism `server/index.mjs` implements.
> Downstream nodes (`S2` authorization, `S4` envelopes, `S5` sign gate, `S12` sign lock) read
> sessions through the same cookie; none of them invent a second session mechanism.

## Personas — exactly two

The persona enum is frozen elsewhere, in `erp/contracts/eval-case.schema.json`'s
`persona` property: `["none", "chen", "ruiz"]`. `"none"` is the signed-out state and is never a
value a client can log in as. The two loggable personas:

| persona id | role | 
|---|---|
| `chen` | `employee` |
| `ruiz` | `auditor` |

There is no third persona. `POST /api/login` with any other `persona` value is refused with
`400 E_BAD_PERSONA` — it never silently creates a session for an unrecognised id.

## Endpoints

### `POST /api/login`

Request body: `{ "persona": "chen" | "ruiz" }`.

On success: `200`, JSON body `{ "persona": "chen", "role": "employee" }`, and a
`Set-Cookie` header:

```
Set-Cookie: sid=<random-hex>; HttpOnly; SameSite=Lax; Path=/
```

- **`HttpOnly`** — the session id is never readable from page JavaScript, so an XSS in the
  page cannot exfiltrate it.
- **`SameSite=Lax`** — the cookie is not sent on cross-site subrequests, which closes the
  simplest CSRF path against the write routes `S2` gates.
- The session id is 24 random bytes (`node:crypto.randomBytes`), hex-encoded — unguessable,
  and never derived from the persona id or anything else predictable.

On a bad or missing persona: `400 E_BAD_PERSONA`, no cookie set, no session created.

### `GET /api/me`

Reads the `sid` cookie. With a live session: `200`, JSON body
`{ "persona": "chen", "role": "employee" }`. Without a live session — no cookie, or a cookie
whose session id the server does not recognise: `401 E_NO_SESSION`.

This is the **only** persona check any downstream route may rely on. A route that needs to
know who is asking calls the same session lookup this contract describes; it does not accept a
persona or role from the request body or query string. That client-authored shortcut is exactly
the anti-pattern `S2` exists to close (`countinghouse/src/erp.js:101`'s client-side 403).

## Session storage

Sessions live in an in-memory `Map<sid, personaId>` inside the single Node process. This is
deliberate and matches `S1`'s deployment note: **exactly one server instance.** A second
instance would not share this map, so a session created against one instance would 401 against
the other — one more reason, independent of `S6`'s TOCTOU argument, that the deployed instance
count must stay at one.

## Non-goals of this node

No logout route, no session expiry, no persistence across process restart, no CSRF token
beyond `SameSite=Lax`. Those are either out of `S1`'s scope entirely or belong to a later node
(`S9` reseed-on-boot governs what "process restart" means for state, not for live sessions).
