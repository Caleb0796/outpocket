#!/usr/bin/env bash
# tests/acceptance/curl-403.sh — node S2, per-request role authorization.
#
# HANDOVER §5's retracted claim about where the tool surface sits does not
# hold — countinghouse/src/erp.js:101 is a client telling itself 403. This
# script proves the boundary is on the SERVER: real HTTP, real cookies, no
# browser.
#
# Three ways this predicate could pass while proving nothing, all closed:
#   1. A server that 403s EVERYONE passes a naive version of this check.
#      Every negative case (auditor -> 403) runs beside a POSITIVE CONTROL
#      (employee, same route, same body -> NOT 403). Without it, "the server
#      says no" is indistinguishable from "the server is broken".
#   2. 403 and 404 are not the same answer. Status must be EXACTLY 403, and
#      the JSON body's `error` field must be exactly E_ROLE_FORBIDDEN — the
#      authz code, not whatever a 404/400 handler would emit.
#   3. A route table with zero entries satisfies "every route in the table
#      is covered" vacuously. The table's length is asserted non-empty
#      before anything is iterated, and printed, so a silent empty table
#      cannot pass by never being noticed.
#
# The table itself is READ FROM THE SERVER'S OWN EXPORT (server/authz.mjs's
# WRITE_ROUTES), never retyped here — a route added there without a
# matching `case` arm below makes this script exit 1 naming the gap, rather
# than silently skipping it (the `*)` arm at the bottom of the loop).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FAILS=0
CHECKS=0

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

# ── boot a real server on an OS-assigned ephemeral port ─────────────────
# PORT=0 -> node:http's .listen(0) picks a free port; the process logs it
# ("outpocket server listening on :<port>") and we read it back from that
# log rather than hardcoding a port, so concurrent test runs on this
# machine (this sprint runs many seats in parallel worktrees) never collide.
LOGFILE="$(mktemp)"
PORT=0 node server/index.mjs >"$LOGFILE" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  wait "$SERVER_PID" 2>/dev/null || true
  rm -f "$LOGFILE"
}
trap cleanup EXIT

PORT_NUM=""
for _ in $(seq 1 100); do
  if grep -q "listening on :" "$LOGFILE" 2>/dev/null; then
    PORT_NUM="$(grep -o 'listening on :[0-9]*' "$LOGFILE" | grep -o '[0-9]*$')"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "FAIL: server process exited before it started listening"
    cat "$LOGFILE"
    exit 1
  fi
  sleep 0.05
done
if [ -z "$PORT_NUM" ]; then
  echo "FAIL: server never logged a listening port within 5s"
  cat "$LOGFILE"
  exit 1
fi
BASE="http://127.0.0.1:$PORT_NUM"

# ── the server's own exported write-route table (not retyped) ───────────
ROUTES_JSON="$(node --input-type=module -e "
import { WRITE_ROUTES } from '$ROOT/server/authz.mjs';
process.stdout.write(JSON.stringify(WRITE_ROUTES));
")"
ROUTE_COUNT="$(echo "$ROUTES_JSON" | jq 'length')"
echo "write-route table: $ROUTE_COUNT route(s) exported by server/authz.mjs"
if [ "$ROUTE_COUNT" -lt 1 ]; then
  echo "FAIL: WRITE_ROUTES is empty — a for-loop over nothing exits 0 and proves nothing"
  exit 1
fi

# ── sessions ──────────────────────────────────────────────────────────────
login() {
  curl -s -D - -o /dev/null -X POST "$BASE/api/login" \
    -H "Content-Type: application/json" -d "{\"persona\":\"$1\"}" \
    | grep -i '^set-cookie:' | sed -E 's/^[Ss]et-[Cc]ookie: *//' | cut -d';' -f1 | tr -d '\r'
}
CHEN_COOKIE="$(login chen)"
RUIZ_COOKIE="$(login ruiz)"
if [ -z "$CHEN_COOKIE" ] || [ -z "$RUIZ_COOKIE" ]; then
  echo "FAIL: could not log in as chen and ruiz — no session cookie captured"
  exit 1
fi

# do_req METHOD PATH COOKIE BODY -> prints "STATUS\nJSON_BODY"
do_req() {
  local method="$1" path="$2" cookie="$3" body="$4" out status
  out="$(curl -s -w '\n%{http_code}' -X "$method" "$BASE$path" \
    -H "Content-Type: application/json" -H "Cookie: $cookie" --data "$body")"
  status="$(echo "$out" | tail -n1)"
  echo "$status"
  echo "$out" | sed '$d'
}

REPLY_STATUS=""
REPLY_BODY=""

# check_route TOOL METHOD PATH EMPLOYEE_BODY EXPECT_SUCCESS_STATUS
check_route() {
  local tool="$1" method="$2" path="$3" employee_body="$4" expect_status="$5"
  CHECKS=$((CHECKS + 1))

  local out status body
  out="$(do_req "$method" "$path" "$RUIZ_COOKIE" '{}')"
  status="$(echo "$out" | head -n1)"; body="$(echo "$out" | tail -n +2)"
  assert_eq "$tool ($method $path): auditor gets exactly 403" "403" "$status"
  local code; code="$(echo "$body" | jq -r '.error // "MISSING"' 2>/dev/null || echo MISSING)"
  assert_eq "$tool: auditor body carries the authz code, not a 404/400 code" "E_ROLE_FORBIDDEN" "$code"

  out="$(do_req "$method" "$path" "$CHEN_COOKIE" "$employee_body")"
  status="$(echo "$out" | head -n1)"; body="$(echo "$out" | tail -n +2)"
  assert_not_eq "$tool: employee (positive control) is NOT 403" "403" "$status"
  assert_eq "$tool: employee gets the expected success status" "$expect_status" "$status"

  REPLY_STATUS="$status"
  REPLY_BODY="$body"
}

REPORT_ID=""
LINE_ID=""
SIGNATURE_EXAMPLE="$(jq -c '.examples[0]' erp/contracts/signature.schema.json)"

sign_open_body() {
  jq -cn --arg rid "$1" --argjson ex "$SIGNATURE_EXAMPLE" '
    {
      report_id: $rid,
      revision: $ex.revision,
      policy_version: $ex.policy_version,
      policy_digest: $ex.snapshot.policy_digest,
      report: ($ex.snapshot.report + {id: $rid}),
      verdict: $ex.snapshot.verdict,
      worst_case: $ex.worst_case,
      violation_history_count: $ex.violation_history_count
    }'
}

i=0
while [ "$i" -lt "$ROUTE_COUNT" ]; do
  ENTRY="$(echo "$ROUTES_JSON" | jq -c ".[$i]")"
  METHOD="$(echo "$ENTRY" | jq -r '.method')"
  PATH_TPL="$(echo "$ENTRY" | jq -r '.path')"
  TOOL="$(echo "$ENTRY" | jq -r '.tool')"

  case "$PATH_TPL" in
    "/api/reports")
      check_route "$TOOL" "$METHOD" "/api/reports" \
        '{"title":"Boston client workshop","project":"FALCON"}' "201"
      REPORT_ID="$(echo "$REPLY_BODY" | jq -r '.report_id')"
      ;;
    "/api/reports/:report_id/open")
      check_route "$TOOL" "$METHOD" "/api/reports/$REPORT_ID/open" '{}' "200"
      ;;
    "/api/reports/:report_id/lines")
      check_route "$TOOL" "$METHOD" "/api/reports/$REPORT_ID/lines" \
        '{"date":"2026-08-20","merchant":"Test Co","category":"meals","amount_cents":1500,"currency":"USD"}' "201"
      LINE_ID="$(echo "$REPLY_BODY" | jq -r '.line.id')"
      ;;
    "/api/reports/:report_id/lines/:line_id")
      if [ "$METHOD" = "DELETE" ]; then
        check_route "$TOOL" "$METHOD" "/api/reports/$REPORT_ID/lines/$LINE_ID" '{}' "200"
      else
        check_route "$TOOL" "$METHOD" "/api/reports/$REPORT_ID/lines/$LINE_ID" \
          '{"merchant":"Updated Co"}' "200"
      fi
      ;;
    "/api/reports/:report_id/lines/:line_id/receipt")
      check_route "$TOOL" "$METHOD" "/api/reports/$REPORT_ID/lines/$LINE_ID/receipt" \
        '{"receipt_id":"rc_1"}' "200"
      ;;
    "/api/sign")
      check_route "$TOOL" "$METHOD" "/api/sign" "$(sign_open_body "$REPORT_ID")" "200"
      ;;
    *)
      echo "FAIL: curl-403.sh has no case for route $METHOD $PATH_TPL ($TOOL) — the table has a route this script does not cover; add one rather than skip it"
      exit 1
      ;;
  esac

  i=$((i + 1))
done

echo "checked $CHECKS/$ROUTE_COUNT route(s), $FAILS failure(s)"
if [ "$FAILS" -gt 0 ]; then
  exit 1
fi
if [ "$CHECKS" -ne "$ROUTE_COUNT" ]; then
  echo "FAIL: checked $CHECKS routes but the table has $ROUTE_COUNT — a gap"
  exit 1
fi
exit 0
