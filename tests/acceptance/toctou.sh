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
#   PART 2 — the literal accept scenario over real HTTP: sign a snapshot,
#            mutate one line through a second request, then commit — 409
#            E_SNAPSHOT_MISMATCH, both digests in the response.
#
# PART 2's "second request" deliberately does NOT go through S2's real
# report-content routes: those are gated by S12's lock (server/locks.mjs),
# which already refuses any such request with 423 while a sign is open —
# proven separately below, against the REAL, unmodified server. Routing
# PART 2 through the locked routes would prove nothing about S6, since the
# mutation would never reach live state for recanon to compare against.
# What S6 is actually responsible for is the case S12's lock is not there
# to catch — the TOCTOU window this node's charter calls "the only part of
# the sign-gate that is actually ours" — so PART 2 uses a small test-only
# bootstrap (below) that wires the REAL server/sign.mjs and server/
# recanon.mjs to a report store that is NOT lock-gated, on purpose, to
# exercise S6 as an independent layer rather than as a redundant echo of
# S12.
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
  const r = reconcile(base, liveReport);
  assert.equal(r.ok, true, label + ": expected the digest to match, it did not");
  console.log("ok: " + label);
}
function expectMismatch(liveReport, label) {
  const r = reconcile(base, liveReport);
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
const r3 = reconcile(signedWithNfc, liveWithNfd);
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

// skipped: no live report at all (a report_id with no live-state entry).
const rSkip = reconcile(base, null);
assert.equal(rSkip.ok, true, "no live report: skipped, not a false mismatch");
assert.equal(rSkip.skipped, true, "no live report: skipped must be true");
console.log("ok: no live-state entry for this report_id is skipped, not falsely flagged");
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

SIGNATURE_EXAMPLE="$(jq -c '.examples[0]' erp/contracts/signature.schema.json)"
sign_open_body_real() {
  jq -cn --arg rid "$1" --argjson ex "$SIGNATURE_EXAMPLE" '
    { report_id: $rid, revision: $ex.revision, policy_version: $ex.policy_version,
      policy_digest: $ex.snapshot.policy_digest, report: ($ex.snapshot.report + {id: $rid}),
      verdict: $ex.snapshot.verdict, worst_case: $ex.worst_case,
      violation_history_count: $ex.violation_history_count }'
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

# ── PART 2b: the literal scenario — sign, mutate through an UNLOCKED second
# request, submit, and get caught at commit. Custom bootstrap: a report
# store that is NOT behind S12's lock, so the mutation in step 2 actually
# reaches live state, which is exactly the case this node exists to cover.
BOOTSTRAP_DIR="$(mktemp -d)"
BOOTSTRAP_SCRIPT="$BOOTSTRAP_DIR/bootstrap.mjs"
cat >"$BOOTSTRAP_SCRIPT" <<NODE_EOF
import { createServer } from "node:http";
import { createApp } from "$ROOT/server/index.mjs";
import { createSignGate } from "$ROOT/server/sign.mjs";

// A report store deliberately outside S2/S12's reach — see toctou.sh's own
// header comment for why: this is what S6 alone must catch.
const reports = new Map();

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

const signGate = createSignGate({ requireConfirmToken: false, getLiveReport: (id) => reports.get(id) ?? null });
const realApp = createApp({ signGate });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "POST" && url.pathname === "/__test__/reports") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    reports.set(body.id, body.report);
    return sendJson(res, 201, { ok: true });
  }
  const mutateMatch = url.pathname.match(/^\\/__test__\\/reports\\/([^/]+)\\/mutate$/);
  if (req.method === "POST" && mutateMatch) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const patch = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const report = reports.get(mutateMatch[1]);
    if (!report) return sendJson(res, 404, { error: "E_NOT_FOUND" });
    const line = report.lines.find((l) => l.id === patch.line_id);
    if (line && typeof patch.merchant === "string") line.merchant = patch.merchant;
    return sendJson(res, 200, { ok: true, report });
  }
  return realApp(req, res);
});
server.listen(0, () => console.log("listening on :" + server.address().port));
NODE_EOF

LOG_BOOT="$(mktemp)"
node "$BOOTSTRAP_SCRIPT" >"$LOG_BOOT" 2>&1 &
BOOT_PID=$!
cleanup_boot() { kill "$BOOT_PID" >/dev/null 2>&1 || true; wait "$BOOT_PID" 2>/dev/null || true; rm -f "$LOG_BOOT"; rm -rf "$BOOTSTRAP_DIR"; }
trap cleanup_boot EXIT

BOOT_PORT=""
for _ in $(seq 1 100); do
  if grep -q "listening on :" "$LOG_BOOT" 2>/dev/null; then
    BOOT_PORT="$(grep -o 'listening on :[0-9]*' "$LOG_BOOT" | grep -o '[0-9]*$')"
    break
  fi
  sleep 0.05
done
if [ -z "$BOOT_PORT" ]; then
  echo "FAIL: toctou bootstrap server never logged a listening port"
  cat "$LOG_BOOT"
  exit 1
fi
BOOT_BASE="http://127.0.0.1:$BOOT_PORT"

CHEN_BOOT="$(login "$BOOT_BASE" chen)"
REPORT_ID="RP-TOCTOU-1"
LINE_ID="ln_1"
LIVE_REPORT="$(jq -n --arg rid "$REPORT_ID" --arg lid "$LINE_ID" '{id:$rid, title:"T", lines:[{id:$lid, merchant:"Acme Co", amount_cents:1500}]}')"
curl -s -X POST "$BOOT_BASE/__test__/reports" -H "Content-Type: application/json" \
  -d "$(jq -cn --arg rid "$REPORT_ID" --argjson report "$LIVE_REPORT" '{id:$rid, report:$report}')" >/dev/null

sign_open_body_boot() {
  jq -cn --arg rid "$1" --argjson report "$2" --argjson ex "$SIGNATURE_EXAMPLE" '
    { report_id: $rid, revision: 0, policy_version: $ex.policy_version,
      policy_digest: $ex.snapshot.policy_digest, report: $report,
      verdict: $ex.snapshot.verdict, worst_case: $ex.worst_case,
      violation_history_count: $ex.violation_history_count }'
}

# step 1: sign the current, unmutated snapshot.
out="$(do_req "$BOOT_BASE" POST /api/sign "$CHEN_BOOT" "$(sign_open_body_boot "$REPORT_ID" "$LIVE_REPORT")")"
sign_status="$(echo "$out" | head -n1)"; sign_body="$(echo "$out" | tail -n +2)"
assert_eq "PART 2b: sign opens" "200" "$sign_status"
REQUEST_ID="$(echo "$sign_body" | jq -r '.sign_request.request_id')"
SNAPSHOT_DIGEST="$(echo "$sign_body" | jq -r '.sign_request.snapshot_digest')"
REVISION="$(echo "$sign_body" | jq -r '.sign_request.revision')"

# step 2: sign it (requireConfirmToken:false in this bootstrap, per its own
# header comment — never the shipped server's default).
out="$(do_req "$BOOT_BASE" POST "/api/sign/$REQUEST_ID/respond" "$CHEN_BOOT" "$(jq -cn \
  --arg rid "$REQUEST_ID" --arg dig "$SNAPSHOT_DIGEST" --argjson rev "$REVISION" \
  '{schema:"outpocket.sign_respond_request/1", request_id:$rid, decision:"signed", reason:null, method:"click", acknowledged_digest:$dig, acknowledged_revision:$rev}')")"
respond_status="$(echo "$out" | head -n1)"
assert_eq "PART 2b: employee signs" "200" "$respond_status"

# step 3: mutate ONE line through the second, unlocked request.
out="$(curl -s -w '\n%{http_code}' -X POST "$BOOT_BASE/__test__/reports/$REPORT_ID/mutate" \
  -H "Content-Type: application/json" -d "$(jq -cn --arg lid "$LINE_ID" '{line_id:$lid, merchant:"Tampered Co"}')")"
mutate_status="$(echo "$out" | tail -n1)"
assert_eq "PART 2b: the second request's mutation itself succeeds (this is the TOCTOU window)" "200" "$mutate_status"

# step 4: submit — the server must catch it.
out="$(do_req "$BOOT_BASE" POST "/api/reports/$REPORT_ID/commit" "$CHEN_BOOT" \
  "$(jq -cn --arg rid "$REQUEST_ID" --arg report_id "$REPORT_ID" '{schema:"outpocket.commit_request/1", request_id:$rid, report_id:$report_id}')")"
commit_status="$(echo "$out" | head -n1)"
commit_body="$(echo "$out" | tail -n +2)"
assert_eq "PART 2b: commit is refused" "409" "$commit_status"
assert_eq "PART 2b: with code E_SNAPSHOT_MISMATCH" "E_SNAPSHOT_MISMATCH" "$(echo "$commit_body" | jq -r '.error.code')"
signed_in_body="$(echo "$commit_body" | jq -r '.error.signed_digest')"
recomputed_in_body="$(echo "$commit_body" | jq -r '.error.recomputed_digest')"
assert_eq "PART 2b: the response carries the SIGNED digest" "$SNAPSHOT_DIGEST" "$signed_in_body"
assert_not_eq "PART 2b: the response carries a DIFFERENT recomputed digest (the day book's two digests)" "$SNAPSHOT_DIGEST" "$recomputed_in_body"
assert_not_eq "PART 2b: recomputed_digest is not null/empty" "null" "$recomputed_in_body"

echo "$FAILS failure(s)"
if [ "$FAILS" -gt 0 ]; then exit 1; fi
exit 0
