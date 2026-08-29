# D1 — deploy runbook

Two blockers stand between this node and the accept in `.team/contracts/D1.txt`.
Neither is mine to close alone. This file is the checklist for whoever closes
them, so the next session does not have to re-derive it.

## Blocker 1 — the Render service does not exist (HUMAN-GATED)

`erp/graph.json`'s V5 node notes (read 2026-08-29) record the account state
from the dashboard: Hobby plan, **zero services**, a $50 "Hackathon
Participant" credit unspent and valid to 2027-07-31, **no card on file**.
This session has no `RENDER_API_KEY` in its environment, so it cannot create
the service through Render's API — only a human with dashboard access can:

1. New Web Service, connect `Caleb0796/outpocket`, root of the repo.
2. Build: none (no compile step). Start command: `node server/index.mjs`.
3. Runtime: Node. Plan: **paid** 0.5 CPU / 512 MB (D-08), applying the $50
   credit — not the free tier, whose 15-minute sleep and 750h/month cap are
   real risks across the unattended 2026-09-04→09-21 judging window (D3).
4. Confirm in the dashboard that exactly **one** instance/autoscale replica is
   configured — the accept and `evidence/D1-url.txt` both require this,
   because S9's digest lives in one process's memory and S6's TOCTOU closure
   is only true of a single process.
5. Whether Render will apply the credit with no card on file is unverified as
   of the note above — resolve that before assuming the paid tier is free to
   turn on.

## Blocker 2 — `/version` is not wired into the server (cross-seat)

`server/routes/version.mjs` (this node's output, written) exports
`createVersionHandler()`, matching the shape of `createStateDigestHandler` in
`server/routes/state-digest.mjs`. Verified standalone: it resolves the commit
from `RENDER_GIT_COMMIT` (set by Render at build time) or falls back to
`git rev-parse HEAD`, and returns it as `text/plain` — confirmed to print the
exact string `git rev-parse HEAD` prints, unit-tested outside the server.

It is not called from `server/index.mjs`. That file is **I3's**
(`erp/charters/I3.md`), not mine — this charter lists "`server/` beyond
`routes/version.mjs`" under things I must never touch. I3 needs to add, in
`createApp()` in `server/index.mjs`, before the static-file fallback:

```js
import { createVersionHandler } from "./routes/version.mjs";
// ...
const versionHandler = createVersionHandler();
// ...
if (versionHandler(req, res, url)) return;
```

## Once both land

Run the accept verbatim from `.team/contracts/D1.txt`:

```sh
curl -sI $URL | tee evidence/headers.txt
grep -i '^origin-agent-cluster:' evidence/headers.txt | grep -q '?0' && exit 1; exit 0
curl -s -o /dev/null -w '%{http_code}' $URL      # expect 200
curl -s $URL/version                             # expect: git rev-parse HEAD
```

and record the URL plus the one-instance configuration and reason in
`evidence/D1-url.txt`.
