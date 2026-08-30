#!/usr/bin/env bash
# tools/blind-home.sh — node E4 (lane E, owner L2). The hermetic Codex home.
#
# R-2: BLINDNESS IS ENFORCED BY `CODEX_HOME`, NOT BY `cwd`. MEASURED on this
# machine: `-C` sets the working directory and is NOT a jail; `-s read-only`
# still grants full-disk read; and the base `~/.codex/config.toml` enables an
# MCP server exposing a Node REPL, chrome/browser plugins, and
# UserPromptSubmit/SessionStart hooks that inject prior-session text. MCP
# servers are separate processes and the Codex sandbox does not govern them.
# `~/.codex/AGENTS.md` is injected even with `cwd` outside any git repo.
#
# So the blind run gets a home of our own construction: `auth.json` (auth reads
# CODEX_HOME, and without it there is no run at all) plus a two-key
# `config.toml`, and nothing else.
#
# ── "HERMETIC" IS DOING LESS WORK THAN IT LOOKS, AND THAT IS SAID OUT LOUD ────
#
# An empty CODEX_HOME drops the rendered prompt from roughly 32 KB to roughly
# 16 KB — APPROXIMATE, and deliberately written that way. The figures drift:
# the same command on the same machine with the same codex-cli 0.144.6 returned
# 32,363 B on 2026-08-28 and 32,247 B on 2026-08-29, and an earlier reviewer
# read 32,359 B. THREE VALUES IN TWO DAYS ON AN INPUT THAT NEVER CHANGED. The
# retracted pair "32,412 -> 11,217" must not be requoted anywhere.
#
# The drift has a name: `<recommended_plugins>`, roughly 3.7 KB of live,
# time-varying marketplace catalog. It is pulled in by `auth.json` — which this
# script MUST copy — and it does NOT come from `$BH/config.toml`. THEREFORE
# `--verify` CANNOT SEE IT, BY CONSTRUCTION: this script asserts the contents of
# $BH, and that block is not in $BH. It is benign for C1's task (it names no
# repository and grades nothing) and it is fatal to any byte count published as
# reproducible.
#
# The honest sentence, and the only one this script supports: THE BLIND RUN IS
# ISOLATED FROM OUR REPOSITORY, NOT BYTE-REPRODUCIBLE RUN TO RUN. Suppressing
# the block needs `--disable plugins` in E8's frozen accept, which is PM's call
# and is not taken here — a runbook that silently diverges from an accept is the
# failure this project exists to prevent.
#
# ── EVERY ASSERTION HERE IS AN ABSENCE ASSERTION, WHICH IS THE DANGEROUS SHAPE ─
#
# "no AGENTS.md", "no [hooks]", "no [mcp_servers]", "no [plugins]" are ALL
# satisfied by a home that is simply empty — and a home that is empty is also a
# home with no auth.json, which cannot run at all. D-90: A NEGATIVE CONTROL
# SATISFIABLE BY THE SUBJECT BEING ABSENT IS NOT A CONTROL. So `--self-test`
# does not delete things to prove the verifier notices; it ADDS the forbidden
# thing to an otherwise-valid home and requires the verifier to still say no,
# and it separately requires a correct home to PASS so that "always fails" is
# not a way to pass the self-test.
#
# usage:
#   bash tools/blind-home.sh              build $BH, print its path on stdout
#   bash tools/blind-home.sh --verify     build if absent, then assert contents
#   bash tools/blind-home.sh --verify DIR assert the contents of DIR
#   bash tools/blind-home.sh --self-test  prove --verify can still return NO
set -euo pipefail

# Neutral directory name on purpose: $BH is handed to a process we are trying to
# keep ignorant of this repository, and a path is a string it can read.
BH_DEFAULT="${TMPDIR:-/tmp}/bh-codex-blind"
BASE_HOME="${CODEX_BASE_HOME:-$HOME/.codex}"

MODEL_KEY_VALUE='gpt-5.6-sol'
EFFORT_KEY_VALUE='low'

say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

# ── build ────────────────────────────────────────────────────────────────────
#
# Two keys, written directly into $BH/config.toml. NOT a profile: `-p <missing>`
# exits 0 with no warning and silently falls back to the base config, which is
# the exact config $BH exists to escape (R-2/R-3). There is no profile file here
# and no `-p` flag in the run.
build_home() {
  local bh="$1"
  rm -rf "$bh"
  mkdir -p "$bh"
  chmod 700 "$bh"

  if [ ! -f "$BASE_HOME/auth.json" ]; then
    warn "FAIL: no $BASE_HOME/auth.json to copy — auth reads CODEX_HOME, so the blind run cannot authenticate."
    return 1
  fi
  # Copied, never read, never echoed: it is a credential.
  cp "$BASE_HOME/auth.json" "$bh/auth.json"
  chmod 600 "$bh/auth.json"

  cat > "$bh/config.toml" <<TOML
model = "$MODEL_KEY_VALUE"
model_reasoning_effort = "$EFFORT_KEY_VALUE"
TOML
}

# ── verify ───────────────────────────────────────────────────────────────────
#
# Structural, via tomllib — the same parser L0's profile gate uses. grep cannot
# tell a real [hooks] table from the characters "[hooks]" inside a comment, and
# the whole value of this check is that it is not fooled by text.
verify_home() {
  local bh="$1" fails=0

  if [ ! -d "$bh" ]; then
    warn "FAIL: $bh is not a directory"
    return 1
  fi

  # (1) auth.json present and non-empty. This is the one POSITIVE assertion, and
  # it is what stops an empty directory from satisfying everything below.
  if [ ! -s "$bh/auth.json" ]; then
    warn "FAIL: $bh/auth.json missing or empty — an empty home satisfies every"
    warn "      absence check below and cannot run; that is the D-90 trap."
    fails=$((fails + 1))
  fi

  # (2) config.toml present.
  if [ ! -f "$bh/config.toml" ]; then
    warn "FAIL: $bh/config.toml missing"
    fails=$((fails + 1))
  else
    # (3) parses, has EXACTLY TWO top-level scalar keys, and declares none of
    # the three forbidden tables. Any TOML error is a failure, not a skip.
    local out
    if ! out="$(python3 - "$bh/config.toml" <<'PY'
import sys, tomllib
path = sys.argv[1]
try:
    with open(path, "rb") as fh:
        doc = tomllib.load(fh)
except Exception as exc:                       # noqa: BLE001 - any parse error fails
    print("PARSE %s" % exc)
    sys.exit(0)

scalars = sorted(k for k, v in doc.items() if not isinstance(v, dict))
tables  = sorted(k for k, v in doc.items() if isinstance(v, dict))
print("KEYS %d %s" % (len(scalars), ",".join(scalars)))
print("TABLES %s" % ",".join(tables))
PY
    )"; then
      warn "FAIL: python3/tomllib could not run — this check cannot be skipped, it is the check"
      fails=$((fails + 1))
      out=""
    fi

    case "$out" in
      *PARSE*)
        warn "FAIL: $bh/config.toml is not valid TOML: ${out#PARSE }"
        fails=$((fails + 1))
        ;;
    esac

    local nkeys keylist tables
    nkeys="$(printf '%s\n' "$out"   | awk '/^KEYS/   {print $2}')"
    keylist="$(printf '%s\n' "$out" | awk '/^KEYS/   {print $3}')"
    tables="$(printf '%s\n' "$out"  | awk '/^TABLES/ {print $2}')"

    if [ "${nkeys:-0}" != "2" ]; then
      warn "FAIL: $bh/config.toml has ${nkeys:-0} top-level key(s) [${keylist:-}], expected exactly 2"
      fails=$((fails + 1))
    fi

    # (4) the three forbidden tables, named individually so the message says
    # which one fired rather than 'a forbidden table'.
    local t
    for t in hooks mcp_servers plugins; do
      case ",${tables}," in
        *",${t},"*)
          warn "FAIL: $bh/config.toml declares a [$t] table — that is what \$BH exists to escape"
          fails=$((fails + 1))
          ;;
      esac
    done
  fi

  # (5) no AGENTS.md. The base home's is injected even with cwd outside any repo.
  if [ -e "$bh/AGENTS.md" ]; then
    warn "FAIL: $bh/AGENTS.md exists — it is injected into the prompt regardless of cwd"
    fails=$((fails + 1))
  fi

  if [ "$fails" -ne 0 ]; then
    warn "blind-home: $fails assertion(s) failed for $bh"
    return 1
  fi

  say "blind-home: OK  $bh"
  say "  auth.json present; config.toml parses with exactly 2 keys; no AGENTS.md, no [hooks], no [mcp_servers], no [plugins]"
  say "  NOT ASSERTED, AND IT CANNOT BE FROM HERE: the <recommended_plugins> block (~3.7 KB, live and"
  say "  time-varying) is pulled in by auth.json and does not come from \$BH/config.toml. Record the"
  say "  rendered prompt byte count for the run that actually happens (EVAL.md 8.5); do not quote a constant."
  return 0
}

# ── self-test (D-90) ─────────────────────────────────────────────────────────
#
# The verifier is an instrument, and three instruments failed open in this
# project on one day. Each case below ADDS the forbidden thing to an OTHERWISE
# VALID home — it never removes the subject — because "verify said no after I
# deleted the home" proves only that it notices missing directories.
self_test() {
  local tmp rc pass=0 fail=0
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  # case 0, the POSITIVE: a correct home must PASS, or every negative below is
  # satisfied by a verifier that simply always says no.
  build_home "$tmp/good" || { warn "SELF-TEST FAILED: could not build a good home"; return 1; }
  if verify_home "$tmp/good" >/dev/null 2>&1; then
    say "  ok    a correct home PASSES"
    pass=$((pass + 1))
  else
    warn "  FAIL  a correct home was rejected — every negative below is now meaningless"
    fail=$((fail + 1))
  fi

  # cases 1..5: valid home + one forbidden thing added.
  local case_name
  for case_name in agents_md hooks mcp_servers plugins third_key; do
    rm -rf "$tmp/bad"
    build_home "$tmp/bad" >/dev/null
    case "$case_name" in
      agents_md)    printf 'you are a helpful assistant\n' > "$tmp/bad/AGENTS.md" ;;
      hooks)        printf '\n[hooks]\nUserPromptSubmit = "echo hi"\n'          >> "$tmp/bad/config.toml" ;;
      mcp_servers)  printf '\n[mcp_servers.node_repl]\ncommand = "node"\n'      >> "$tmp/bad/config.toml" ;;
      plugins)      printf '\n[plugins]\nchrome = true\n'                       >> "$tmp/bad/config.toml" ;;
      third_key)    printf 'approvals_reviewer = "never"\n'                     >> "$tmp/bad/config.toml" ;;
    esac
    rc=0
    verify_home "$tmp/bad" >/dev/null 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then
      say "  ok    '$case_name' ADDED to a valid home is still REJECTED"
      pass=$((pass + 1))
    else
      warn "  FAIL  '$case_name' was added to a valid home and verify said OK — the check is failing open"
      fail=$((fail + 1))
    fi
  done

  # case 6: the D-90 case stated directly. An EMPTY home satisfies every
  # absence assertion; it must still be rejected, on the auth.json positive.
  rm -rf "$tmp/empty"; mkdir -p "$tmp/empty"
  rc=0
  verify_home "$tmp/empty" >/dev/null 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    say "  ok    an EMPTY home is REJECTED (it satisfies every absence check and can never run)"
    pass=$((pass + 1))
  else
    warn "  FAIL  an empty home passed — the absence checks are satisfiable by the subject being absent"
    fail=$((fail + 1))
  fi

  say ""
  if [ "$fail" -ne 0 ]; then
    warn "SELF-TEST FAILED: $fail of $((pass + fail)) case(s)"
    return 1
  fi
  say "SELF-TEST OK: $pass/$pass — the verifier distinguishes a good home from six bad ones,"
  say "and it rejects the empty home that would otherwise satisfy every absence assertion."
  return 0
}

# ── entry ────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --verify)
    BH="${2:-$BH_DEFAULT}"
    if [ -z "${2:-}" ] && [ ! -d "$BH" ]; then build_home "$BH"; fi
    verify_home "$BH"
    ;;
  --self-test)
    say "blind-home --self-test (D-90: add the forbidden thing to a VALID home; never delete the subject)"
    self_test
    ;;
  --help|-h)
    sed -n '2,60p' "$0"
    ;;
  "")
    build_home "$BH_DEFAULT"
    say "$BH_DEFAULT"
    ;;
  *)
    warn "unknown argument: $1 (try --help)"
    exit 2
    ;;
esac
