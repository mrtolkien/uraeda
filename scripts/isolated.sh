#!/usr/bin/env bash
# `scripts/isolated.sh [--slots <n>] <command> [args…]`: runs a test command, as the test recipes of
# the `justfile` do.
#
# - The command gets a temporary folder of its own, `TMPDIR`, removed when it ends, passed or
#   failed: a test that forgets its folders leaves nothing in the machine's.
# - It ignores the host's git: its configuration, so the tests' repositories get git's defaults,
#   and the repository variables a git hook exports.
# - With `--slots`, at most that many such runs execute at once on the machine, across every
#   checkout: the others wait. Several worktrees running heavy tests at once slowed them all past
#   their timeouts.
set -euo pipefail
slots=0
if [ "${1:-}" = "--slots" ]; then
  slots=$2
  shift 2
fi

parent=${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}
run=$(mktemp -d "$parent/uraeda-run-XXXXXX")
trap 'rm -rf "$run"' EXIT

if [ "$slots" -gt 0 ]; then
  locks=${XDG_RUNTIME_DIR:-/tmp}/uraeda-heavy
  mkdir -p "$locks"
  said=false
  while :; do
    for slot in $(seq "$slots"); do
      exec {held}>"$locks/$slot"
      if flock -n "$held"; then break 2; fi
      exec {held}>&-
    done
    $said || echo "[uraeda] waiting for one of the machine's $slots heavy slots" >&2
    said=true
    sleep 1
  done
fi

env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR \
  GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
  TMPDIR="$run" TMP="$run" TEMP="$run" "$@"
