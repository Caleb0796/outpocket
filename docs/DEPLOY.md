# Deployment runbook

Outpocket runs on Render at <https://outpocket.onrender.com/>. The service
starts the repository's Node server with:

```sh
node server/index.mjs
```

The Render plan and billing settings are configured in the Render dashboard.

## Deployment identity

`GET /version` returns the deployed commit SHA as plain text. The server wires
`createVersionHandler()` before its static-file fallback, and the handler reads
Render's deployed commit value at process start (falling back to the local Git
HEAD outside Render).

```sh
curl -fsS https://outpocket.onrender.com/version
```

Compare that value with the exact commit selected for deployment.

## Keep exactly one instance

Configure exactly one instance and disable autoscaling in the Render dashboard.
Sessions, reports, sign requests, the day book, and the state used for digest
comparison all live in process memory. With multiple instances, review and
commit requests could reach different state, invalidating the digest binding
and the single-process TOCTOU guarantee. A process restart also clears this
in-memory state.

## Verify a deploy

1. Confirm the dashboard shows one running instance and the start command
   `node server/index.mjs`.
2. Request the root URL and confirm it returns HTTP 200.
3. Request `/version` and confirm it equals the commit selected for deployment.
4. Open the [seed-7 demo](https://outpocket.onrender.com/?demo=1&seed=7) and
   confirm the labelled demo reaches a clean draft without submitting it.

## Measured deployment observations

- On 2026-08-29, the interval from the wiring push to the first recorded green
  live check was at most 9 minutes 49 seconds. This is an upper bound on build
  and rollout time, not the exact deployment duration.
- On 2026-08-30, after this observer sent no requests for 960 seconds, the first
  request returned HTTP 200 in 0.414423 seconds; an immediate follow-up returned
  HTTP 200 in 0.148939 seconds. Because other traffic was not controlled, this
  did not establish that the service had slept or measure cold-start latency.
  Use Render's dashboard logs for authoritative sleep and wake events.
