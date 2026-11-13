#!/usr/bin/env bash
# `scripts/isolated.sh [--slots <n>] <command> [args…]`: runs a command that is not a person's use
# of the app, as every test, picture, gallery, frame, and sandbox recipe of the `justfile` does, and
# `hidden-display` does for whatever it runs.
#
# - The command gets a temporary folder of its own, removed when it ends, passed or failed: `TMPDIR`
#   in it, and the data, configuration, cache, and state folders (`XDG_DATA_HOME`,
#   `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_STATE_HOME`), so NSH's storage, WebKit's data, `ura`'s
#   folders, and every other tool's that follows them stay out of the person's home. `HOME` stays:
#   Cargo and `nsh` find their caches there, and every tool these runs start follows the four.
# - Then it checks that the person's folders of the app, `dev.uraeda.app` and `uraeda-next` in each
#   of the four real ones, are as they were, and fails, naming what changed, when the command
#   created or changed a file there: a tool that ignored the variables. The app run by a person
#   at the same time changes them too, and fails the check the same way.
# - It ignores the host's git: its configuration, so the tests' repositories get git's defaults,
#   and the repository variables a git hook exports.
# - With `--slots`, at most that many such runs execute at once on the machine, across every
#   checkout: the others wait. Several worktrees running heavy tests at once slowed them all past
#   their timeouts.
#
# Inside another isolated run (`URAEDA_ISOLATED` set), it only takes a slot, unless the outer run
# holds one: the outer run's folders and check hold.
set -euo pipefail
slots=0
if [ "${1:-}" = "--slots" ]; then
  slots=$2
  shift 2
fi

# A run inside one that holds a slot already takes none: it would wait on itself.
if [ "$slots" -gt 0 ] && [ -z "${URAEDA_SLOT:-}" ]; then
  export URAEDA_SLOT=1
  # Without it, every slot looked taken, and the run waited forever.
  command -v flock >/dev/null || { echo "[uraeda] flock is missing: run it in the dev shell" >&2; exit 1; }
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

# The command runs without the slot's lock: this script holds it until the command ends. A
# process the command left running, a test's child that outlived its test, then never holds a
# slot, which every later heavy run of the machine waited on.
run() {
  if [ -n "${held:-}" ]; then "$@" {held}>&-; else "$@"; fi
}

if [ -n "${URAEDA_ISOLATED:-}" ]; then
  [ -n "${held:-}" ] || exec "$@"
  status=0
  run "$@" || status=$?
  exit "$status"
fi

parent=${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}
run=$(mktemp -d "$parent/uraeda-run-XXXXXX")
trap 'rm -rf "$run"' EXIT
mkdir "$run/tmp" "$run/data" "$run/config" "$run/cache" "$run/state"

# The person's folders of the app, and what each file in them is now.
watched=()
for base in "${XDG_DATA_HOME:-$HOME/.local/share}" "${XDG_CONFIG_HOME:-$HOME/.config}" \
  "${XDG_CACHE_HOME:-$HOME/.cache}" "${XDG_STATE_HOME:-$HOME/.local/state}"; do
  watched+=("$base/dev.uraeda.app" "$base/uraeda-next")
done
state() {
  for folder in "${watched[@]}"; do
    if [ -e "$folder" ]; then find "$folder" -printf '%p %s %T@\n'; fi
  done | sort
}
state >"$run/before"

status=0
run env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_COMMON_DIR \
  GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 URAEDA_ISOLATED=1 \
  TMPDIR="$run/tmp" TMP="$run/tmp" TEMP="$run/tmp" \
  XDG_DATA_HOME="$run/data" XDG_CONFIG_HOME="$run/config" \
  XDG_CACHE_HOME="$run/cache" XDG_STATE_HOME="$run/state" "$@" || status=$?

state >"$run/after"
if ! cmp -s "$run/before" "$run/after"; then
  echo "[uraeda] the run wrote in the person's folders of the app, which only the app run by a person may change:" >&2
  diff "$run/before" "$run/after" | sed -n 's/^[<>] \(.*\) [0-9]* [0-9.]*$/  \1/p' | sort -u >&2
  [ "$status" -ne 0 ] || status=1
fi
exit "$status"
