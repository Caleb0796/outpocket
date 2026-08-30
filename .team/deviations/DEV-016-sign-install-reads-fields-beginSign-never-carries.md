ID: DEV-016-sign-install-reads-fields-beginSign-never-carries
OPENED: 2026-08-30T00:00:00+0000
SEAT: I3
NODE: D-89 (S5 follow-up — NOT a graph node; ruled by PM 2026-08-29)
CATEGORY: ownership-hook-collision
CLAIM: D-89's own dispatch text (.team/contracts/D-89-confirm-token.txt) lists
  OUTPUTS as "server/sign.mjs and whatever channel the honest implementation
  needs" and its ACCEPT field says, verbatim, "PROPOSE ONE WITH YOUR GREEN" —
  i.e. this seat's own accept-predicate test is an explicit, named part of the
  dispatch, not a discretionary extra. D-89 has no graph.json entry to carry a
  declared `outputs` array (it is a PM ruling, not a lane node), so
  conventions.ownership_rule clause (a) has nothing to match against, and
  clause (b)'s longest-matching glob (`tests/**` -> QA) is the only thing left
  standing, which the hook correctly flags as a collision rather than silently
  waiving.
EVIDENCE:
  cat .team/contracts/D-89-confirm-token.txt | grep -A2 "^OUTPUTS:"
  OUTPUTS:   server/sign.mjs and whatever channel the honest implementation
             needs. If a frozen contract must be amended, SAY SO...

  cat .team/contracts/D-89-confirm-token.txt | grep -A6 "^ACCEPT:"
  ACCEPT:    ** OWED BY PM — DO NOT WAIT ON IT TO START, DO NOT INVENT ONE. **
             ...PROPOSE ONE WITH YOUR GREEN...

  git commit attempt, pre-commit-ownership:
  DENY  tests/acceptance/confirm-token.test.mjs  [longest matching glob `tests/**` -> QA, not I3]
CHANGE MADE, IN THIS SAME COMMIT:
  tests/acceptance/confirm-token.test.mjs (new): proves PM's D-96 three-clause
  accept for D-89 — the positive end-to-end signature completion using the
  real F4 dialog code and a real server, the negative sweep across the real
  compiled tool surface, and D-90's precondition (the token demonstrably
  exists and is page-readable in the same run). No other file under tests/**
  is touched by this ticket.
GATE: `node --test tests/acceptance/confirm-token.test.mjs` 2/2, full suite
  `npm test` 189/189, `sha256sum -c erp/contracts/FREEZE.md` unaffected (this
  ticket touches no contract file).
VERDICT: adopt
VERDICT_NOTE: I3, self-filed at authorship time. Not a violation report
  awaiting a ruling — D-89's own dispatch text names "propose [the accept]
  with your green" as this seat's job, which requires a test file to exist
  somewhere, and the only candidate path collides with the tests/** default
  precisely because D-89 predates and sits outside graph.json's node
  machinery. Left open for L1/PM review on merge in case a different path or
  a formal graph.json entry for D-89 was intended instead.
