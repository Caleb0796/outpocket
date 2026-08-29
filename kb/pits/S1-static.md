# Pit — S1 static route (D-50 scope addition)

Reported by **I3** under D-31, in the same message as the green, transcribed by L1.

**TRIED.** Added a static handler in `server/index.mjs` — same single file, no new module. GET/HEAD
only; never matches `/api/*`; traversal-guarded so the resolved path must stay under the page
root, including `%2e%2e`-encoded forms; MIME by extension; falls through to the existing JSON 404
for anything not found. Made `pageRoot` a PARAMETER of `createApp()`/`createHttpServer()`
(defaulting to `src/page/`, F1's not-yet-landed output) rather than hardcoding it, so real tests
could run against an injected fixture without waiting on F1 or faking its output shape.

**HAPPENED.** `tests/acceptance/session.test.mjs` unaffected, 8/8. New
`tests/acceptance/static.test.mjs` 7/7: index.html serving; nested-asset content-type;
missing-asset fallthrough with no crash; traversal refused plain and encoded; `/api/me` still
resolving to the real 401 handler **even when a file named `api/me` exists on disk**, which proves
static never shadows API routes; and one test against the real default root **documenting that
`GET /` is still 404 today because F1 has not landed `index.html`** — the assertion to flip to 200
when it does, not a silent pass. Full suite 69/69, no regressions.

**CHANGED.** `server/index.mjs` only (static handler plus wiring; `createApp`/`createHttpServer`
now take an options object) and the new test file. Cookie session, persona enum and the 400/401
paths untouched and covered green.

**EARLIER.** Read `graph.json`'s S1 node notes for the D-50 text before writing anything,
specifically to get the `S1 -> T2` and `F1 -> D1` edge contracts right rather than guessing at
scope. Chose fixture-based tests over waiting for F1 or hardcoding assumptions about its output
shape, since the DO was time-boxed and F1 landing is out of my hands.

**GRADE.** Green, 0.5 h as scoped. Did not re-measure `GET /` against the unmodified symptom,
since the fixture tests exercise the identical code path the real root will use.

---

**L1's note.** Test 5 is the one to keep in mind: a static handler that silently shadows an API
route produces a failure that reads as a session bug for hours. And test 7 records the remaining
gap as an assertion rather than an absence — on the day this project priced three separate
instances of exit 0 being satisfied by a check that discovered nothing, a seat writing a test
whose job is to fail later is the right instinct.

**Ownership finding, raised to PM and not waived:** `tests/acceptance/static.test.mjs` is DENIED
by `check-ownership` — it matches `tests/**` -> QA and no node declares it, so clause (a) is
empty. D-50 added scope to S1 without adding the file that scope produces to `S1.outputs`. The
model is right and a declaration is short, for the fourth time this sprint.
