ID: DEV-E3-eval-case-known-open
OPENED: 2026-08-29T00:00:00+0000
SEAT: I3
NODE: S5
CATEGORY: scheduled-frozen-file-edit
CLAIM: S5's own accept requires flipping erp/contracts/eval-case.schema.json examples[1] (`neg-respond-without-click`) from controlStatus `known-open` to `enforced` now that the confirm_token ships — a frozen-file edit that no node scheduled, that S10 froze on Day 1 under sha256sum -c erp/contracts/FREEZE.md, and that a naive fix (`controlStatus === 'refused'`) would have failed ajv (R-27: `refused` is not in the frozen enum `[enforced, known-open, not-runnable]`), turning `npm test` red repo-wide via CONTRACTS.md §11 check 1.
EVIDENCE:
  Before this commit:
  node -e "const e=require('./erp/contracts/eval-case.schema.json').examples[1]; console.log(e.controlStatus, /IT COMMITS/.test(JSON.stringify(e)))"
  # known-open true

  sha256sum -c erp/contracts/FREEZE.md
  # erp/contracts/eval-case.schema.json: FAILED  (after the edit, before this manifest line was re-recorded)

  erp/contracts/signature.schema.json x-signRequestState.survivingVector / .confirmToken:
  "the negative control neg-respond-without-click flips from `known-open` to `enforced` under
  S5's scheduled deviation DEV-E3-eval-case-known-open" — the frozen schema itself already
  names this ticket before it existed, which is why it is "scheduled" rather than discretionary.

  erp/CONTRACTS.md around R-27:
  "S5's scheduled deviation DEV-E3-eval-case-known-open moves examples[1].controlStatus to
  enforced, which is this enum's own word for 'the refusal is now the required result'."
CHANGE MADE, IN THIS SAME COMMIT:
  erp/contracts/eval-case.schema.json examples[1] ("neg-respond-without-click"):
    - controlStatus: "known-open" -> "enforced"
    - observedToday: removed entirely (schema: REQUIRED only when controlStatus is
      known-open; the sibling enforced case neg-post-signature-tamper carries no such key
      either — this follows that convention rather than setting it to null)
    - title: reworded from "KNOWN-OPEN: ..." to "ENFORCED: ..."
    - brokenBy: reworded to describe the mutation that would REOPEN the vector (remove the
      confirm_token requirement, or set requireConfirmToken:false in server/sign.mjs's
      createSignGate) rather than describing "the state the build is in today"
    - steps[1] (raw_post_sign_respond, no confirm_token — the attacker never obtained one):
      expected http_status 200 -> 403, added error_code E_NO_CONFIRM_TOKEN assertion
    - steps[2] (commit_expense_report): expected http_status 200 -> 409, added error_code
      E_NOT_SIGNED assertion — the attack never reaches answered+signed, so commit is
      unreachable by it now, not merely refused at the door
    - expect.failure.note and expect.assertions[0].note: reworded from "this is the refusal
      we want, not the one we get" to "this is the refusal we get" (R-44: confirm_token is
      defence in depth, not proof of personhood — the note says so rather than overclaiming)
  erp/contracts/FREEZE.md: the eval-case.schema.json manifest line RE-RECORDED
    (c0b6362f... -> 8c7d72dc...), plus a short addendum paragraph naming this ticket as the
    authorization for that specific re-record, distinct from S5's blanket signature.schema.json
    license already in this file's header.
GATE (verbatim from erp/graph.json's S5 accept, all four re-run clean after the edit):
  git log -1 --format=%B -- erp/contracts/eval-case.schema.json    # contains "DEV-E3-eval-case-known-open"
  node -e "const e=require('./erp/contracts/eval-case.schema.json').examples[1]; \
    if(e.controlStatus!=='enforced') process.exit(1); \
    if(/IT COMMITS/.test(JSON.stringify(e))) process.exit(1)"      # exit 0
  # erp/contracts/FREEZE.md carries the re-recorded sha256 line above
  sha256sum -c erp/contracts/FREEZE.md                             # exit 0
  node tools/contracts-check.mjs                                   # examples[1] still validates
    against its own schema (title/note length limits caught two overlong strings on the first
    pass — fixed, not waived)
VERDICT: adopt
VERDICT_NOTE: I3, self-filed at authorship time per this node's own accept text ("S5 files ... and lands the edit it authorises IN THE SAME COMMIT"). Not a violation report awaiting a ruling — the schema, CONTRACTS.md and erp/graph.json all name this exact ticket ID as the pre-authorized mechanism before S5 existed to file it, so there is nothing here for PM/L1 to adjudicate beyond confirming the four gate commands above are green, which they are. Left open for L1/PM review on merge in case the mechanical edit itself (not the authorization) drew a different call than the one made here — in particular the choice to drop `observedToday` entirely rather than null it, and to tighten steps[1]/[2]'s expectations to 403/409 rather than leaving them unspecified.
