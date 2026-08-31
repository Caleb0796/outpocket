#!/usr/bin/env bash
# tests/acceptance/toctou.sh — node S6, server-side re-canonicalisation.
#
# GIVEN a single server instance (S1): true by construction, OUR-ESTIMATE,
# not a proven property of a horizontally scaled deployment.
#
# Two parts:
#   PART 1 — reconcile() (server/recanon.mjs), pure-function level, against
#            the five canonicalisation attacks C3 is expected to try (key
#            order, whitespace, unicode normalisation, numeric formatting,
#            duplicate keys) PLUS the real content-change case. Five false
#            positives would be as bad as the one false negative: an honest
#            report reformatted in transit must NOT be rejected.
#   PART 2 — prove the shipped HTTP routes stop mutation at the sign lock,
#            then exercise re-canonicalisation independently against an
#            intentionally mutable injected aggregate.
#
# The real report-content route is gated by S12 and returns 423 while signing.
# A direct createSignGate test supplies the unlocked mutation needed to prove
# S6 remains a separate layer. createApp always installs its own report reader,
# so this test-only seam cannot replace the application aggregate.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FAILS=0
ok() { echo "ok: $1"; }
fail() { echo "FAIL: $1"; FAILS=$((FAILS + 1)); }

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then ok "$desc"; else fail "$desc — expected [$expected], got [$actual]"; fi
}
assert_not_eq() {
  local desc="$1" not_expected="$2" actual="$3"
  if [ "$not_expected" != "$actual" ]; then ok "$desc (got $actual)"; else fail "$desc — got the forbidden value [$actual]"; fi
}

# ── PART 1: reconcile() against the five canonicalisation attacks ───────
VECTORS_DIR="$(mktemp -d)"
VECTORS_SCRIPT="$VECTORS_DIR/vectors.mjs"
cat >"$VECTORS_SCRIPT" <<NODE_EOF
import assert from "node:assert/strict";
import { reconcile } from "$ROOT/server/recanon.mjs";

const base = {
  kind: "outpocket.snapshot",
  ocf: 1,
  policy_digest: "sha256:" + "0".repeat(64),
  policy_version: "2026-08.1",
  request_id: "sg_0000000000000000",
  verdict: { worst: null, count: 0 },
  report: {
    id: "RP-X",
    title: "T",
    lines: [{ id: "ln_1", merchant: "Acme Co", amount_cents: 1500 }],
  },
};

function expectMatch(liveReport, label) {
  const r = reconcile(base, liveReport, base.verdict);
  assert.equal(r.ok, true, label + ": expected the digest to match, it did not");
  console.log("ok: " + label);
}
function expectMismatch(liveReport, label) {
  const r = reconcile(base, liveReport, base.verdict);
  assert.equal(r.ok, false, label + ": expected the digest to MISMATCH, it matched");
  console.log("ok: " + label);
}

expectMatch(base.report, "baseline: an unchanged live report matches what was signed");

// 1. KEY ORDER — same value, keys written in a different order.
expectMatch(
  { lines: [{ amount_cents: 1500, id: "ln_1", merchant: "Acme Co" }], id: "RP-X", title: "T" },
  "attack 1/5 (key order) does not change the digest",
);

// 2. WHITESPACE — by the time this module ever sees a report it has
// already been through JSON.parse, which discards insignificant
// whitespace; the attack is two differently-whitespaced ENCODINGS of the
// identical value collapsing to the same parsed object, which they do.
const spacedLine = JSON.parse('{ "id" : "ln_1" ,   "merchant":"Acme Co", "amount_cents":1500 }');
expectMatch({ ...base.report, lines: [spacedLine] }, "attack 2/5 (whitespace, post-parse) does not change the digest");

// 3. UNICODE NORMALISATION — NFD vs NFC of the identical visible string.
// OCF-1 normalises to NFC (src/canonical.js), so both forms of "é" must
// canonicalise to the same bytes.
const nfc = "Café Co";       // precomposed é
const nfd = "Café Co";      // e + combining acute, same glyph
assert.notEqual(nfc, nfd, "test setup: the two encodings must differ as raw strings");
const signedWithNfc = { ...base, report: { ...base.report, lines: [{ id: "ln_1", merchant: nfc, amount_cents: 1500 }] } };
const liveWithNfd = { ...base.report, lines: [{ id: "ln_1", merchant: nfd, amount_cents: 1500 }] };
const r3 = reconcile(signedWithNfc, liveWithNfd, signedWithNfc.verdict);
assert.equal(r3.ok, true, "attack 3/5 (unicode NFC vs NFD): expected a match, it did not");
console.log("ok: attack 3/5 (unicode NFC vs NFD) does not change the digest");

// 4. NUMERIC FORMATTING — JSON permits exponential notation; JS's Number
// has no memory of which form parsed it, so 1500 and 1.5e3 are the same
// value by the time recon ever sees them.
const expForm = JSON.parse('{"id":"ln_1","merchant":"Acme Co","amount_cents":1.5e3}');
assert.equal(expForm.amount_cents, 1500, "test setup: 1.5e3 must parse to 1500");
expectMatch({ ...base.report, lines: [expForm] }, "attack 4/5 (numeric formatting, 1.5e3 vs 1500) does not change the digest");

// 5. DUPLICATE KEYS — JSON.parse resolves a duplicate key deterministically
// (last value wins, per the JSON/ECMA-262 spec), on both the signing side
// and the live-fetch side, so there is nothing left for recon to see once
// either has been parsed.
const dup = JSON.parse('{"id":"ln_1","merchant":"Acme Co","amount_cents":1,"amount_cents":1500}');
assert.equal(dup.amount_cents, 1500, "test setup: a duplicate key must resolve to its LAST value");
expectMatch({ ...base.report, lines: [dup] }, "attack 5/5 (duplicate keys, resolved by JSON.parse) does not change the digest");

// ── AND the one thing that MUST be caught: a real content change ────────
expectMismatch(
  { ...base.report, lines: [{ id: "ln_1", merchant: "Tampered Co", amount_cents: 1500 }] },
  "a genuine merchant change IS caught (not masked by the five attacks being harmless)",
);
expectMismatch(
  { ...base.report, lines: [{ id: "ln_1", merchant: "Acme Co", amount_cents: 999999 }] },
  "a genuine amount change IS caught",
);

// Missing live state is never a successful reconciliation.
const rMissing = reconcile(base, null);
assert.equal(rMissing.ok, false, "no live report must not reconcile successfully");
assert.equal(rMissing.skipped, false, "no live report must not be marked skipped");
console.log("ok: no live-state entry for this report_id is a refusal, never a skipped success");
NODE_EOF

if node "$VECTORS_SCRIPT"; then
  ok "PART 1: reconcile() vector suite exited 0"
else
  fail "PART 1: reconcile() vector suite exited nonzero"
fi
rm -rf "$VECTORS_DIR"

# ── PART 2a: confirm the REAL server blocks the same mutation EARLIER ───
# (S12's lock, 423, before S6 ever needs to run) — proves S6 is a second,
# independent layer, not the only thing standing between a client and a
# stale commit in the shipped configuration.
LOG_REAL="$(mktemp)"
PORT=0 node server/index.mjs >"$LOG_REAL" 2>&1 &
REAL_PID=$!
cleanup_real() { kill "$REAL_PID" >/dev/null 2>&1 || true; wait "$REAL_PID" 2>/dev/null || true; rm -f "$LOG_REAL"; }
trap cleanup_real EXIT

REAL_PORT=""
for _ in $(seq 1 100); do
  if grep -q "listening on :" "$LOG_REAL" 2>/dev/null; then
    REAL_PORT="$(grep -o 'listening on :[0-9]*' "$LOG_REAL" | grep -o '[0-9]*$')"
    break
  fi
  sleep 0.05
done
if [ -z "$REAL_PORT" ]; then
  echo "FAIL: real server never logged a listening port"
  cat "$LOG_REAL"
  exit 1
fi
REAL_BASE="http://127.0.0.1:$REAL_PORT"

login() {
  curl -s -D - -o /dev/null -X POST "$1/api/login" -H "Content-Type: application/json" -d "{\"persona\":\"$2\"}" \
    | grep -i '^set-cookie:' | sed -E 's/^[Ss]et-[Cc]ookie: *//' | cut -d';' -f1 | tr -d '\r'
}
do_req() { # base method path cookie body -> "STATUS\nJSON"
  local base="$1" method="$2" path="$3" cookie="$4" body="$5" out
  out="$(curl -s -w '\n%{http_code}' -X "$method" "$base$path" -H "Content-Type: application/json" -H "Cookie: $cookie" --data "$body")"
  echo "$out" | tail -n1
  echo "$out" | sed '$d'
}

CHEN_REAL="$(login "$REAL_BASE" chen)"
out="$(do_req "$REAL_BASE" POST /api/reports "$CHEN_REAL" '{"title":"T","project":"FALCON"}')"
REAL_REPORT_ID="$(echo "$out" | tail -n +2 | jq -r '.report_id')"
out="$(do_req "$REAL_BASE" POST "/api/reports/$REAL_REPORT_ID/lines" "$CHEN_REAL" '{"date":"2026-08-20","merchant":"Acme Co","category":"meals","amount_cents":1500,"currency":"USD"}')"
REAL_LINE_ID="$(echo "$out" | tail -n +2 | jq -r '.line.id')"

sign_open_body_real() {
  jq -cn --arg rid "$1" '{report_id: $rid}'
}
out="$(do_req "$REAL_BASE" POST /api/sign "$CHEN_REAL" "$(sign_open_body_real "$REAL_REPORT_ID")")"
real_sign_status="$(echo "$out" | head -n1)"
assert_eq "PART 2a setup: real /api/sign opens" "200" "$real_sign_status"

out="$(do_req "$REAL_BASE" PATCH "/api/reports/$REAL_REPORT_ID/lines/$REAL_LINE_ID" "$CHEN_REAL" '{"merchant":"Tampered Co"}')"
lock_status="$(echo "$out" | head -n1)"
lock_body="$(echo "$out" | tail -n +2)"
assert_eq "PART 2a: S12's lock refuses the mutation while sign is open, BEFORE S6 is needed" "423" "$lock_status"
assert_eq "PART 2a: the lock's own code" "E_SIGN_IN_PROGRESS" "$(echo "$lock_body" | jq -r '.error')"

cleanup_real
trap - EXIT

# ── PART 2b: exercise S6 independently with an injected mutable aggregate.
# createApp always replaces a supplied gate's reader with its own aggregate;
# this direct gate test is therefore the only intentional unlocked seam.
MUTATION_DIR="$(mktemp -d)"
MUTATION_SCRIPT="$MUTATION_DIR/mutation.mjs"
cat >"$MUTATION_SCRIPT" <<NODE_EOF
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSignGate, GENESIS_DIGEST } from "$ROOT/server/sign.mjs";

const schema = JSON.parse(readFileSync("$ROOT/erp/contracts/signature.schema.json", "utf8"));
const reportId = "RP-TOCTOU-1";
let liveReport = JSON.parse(JSON.stringify(schema.examples[0].snapshot.report));
liveReport.id = reportId;
let prepareCalls = 0;
const gate = createSignGate({
  requireConfirmToken: false,
  getLiveReport: () => liveReport,
  prepareReportCommit: () => {
    prepareCalls += 1;
    return () => {};
  },
});
const sessionId = "toctou-session";
const { signRequest } = gate.open({
  sessionId,
  personaId: "chen",
  personaName: "Chen Xiao",
  reportId,
});
gate.respond({
  requestId: signRequest.request_id,
  sessionId,
  decision: "signed",
  reason: null,
  method: "click",
  acknowledgedDigest: signRequest.snapshot_digest,
  acknowledgedRevision: signRequest.revision,
});

liveReport = JSON.parse(JSON.stringify(liveReport));
liveReport.lines[0].merchant = "Tampered Co";
let refusal;
try {
  gate.commit({ requestId: signRequest.request_id, reportId, sessionId });
} catch (error) {
  refusal = error;
}
assert.equal(refusal?.code, "E_SNAPSHOT_MISMATCH");
assert.equal(refusal?.http, 409);
assert.equal(refusal?.detail?.signed_digest, signRequest.snapshot_digest);
assert.notEqual(refusal?.detail?.recomputed_digest, signRequest.snapshot_digest);
assert.equal(prepareCalls, 0, "a mismatch must not prepare report publication");
assert.deepEqual(gate.chain.list(), [], "a mismatch must append nothing");
assert.equal(gate.chain.currentHead(), GENESIS_DIGEST, "a mismatch must not move the chain head");
console.log("ok: PART 2b: an unlocked live mutation is refused with E_SNAPSHOT_MISMATCH before publication");
NODE_EOF

if node "$MUTATION_SCRIPT"; then
  ok "PART 2b: independent re-canonicalisation test exited 0"
else
  fail "PART 2b: independent re-canonicalisation test exited nonzero"
fi
rm -rf "$MUTATION_DIR"

echo "$FAILS failure(s)"
if [ "$FAILS" -gt 0 ]; then exit 1; fi
exit 0
