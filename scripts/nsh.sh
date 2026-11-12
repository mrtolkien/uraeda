#!/usr/bin/env bash
# `scripts/nsh.sh <command> [args…]`: runs Native Shell's CLI, `nsh`, on the app in `app/`, as the
# `app-*` recipes of the `justfile` do.
#
# `nsh` builds the app's runners in a Cargo workspace it generates, `app/.nsh/rust`, with a lockfile
# of its own, which Cargo would fill with the newest version of every crate: a build would then
# depend on the day it first ran. So that lockfile starts as the repository's `Cargo.lock`, and the
# runners build in the repository's `target/`: Cargo keeps the versions the repository pins, and
# builds each crate once for both.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)

# A version pinned since the generated lockfile was written reaches the runners.
generated="$root/app/.nsh/rust/Cargo.lock"
if [ ! -e "$generated" ] || [ "$root/Cargo.lock" -nt "$generated" ]; then
  mkdir -p "$(dirname "$generated")"
  cp "$root/Cargo.lock" "$generated"
fi

# A development session takes a free port unless one is asked for: several runs of the app then
# go on at once. NSH 0.5.0 takes a free port itself for another app, but gives an app the port it
# had last, and stops the session that holds it: a second run of the same checkout, an agent's on
# the hidden display beside a person's, would end the first.
args=("$@")
case "${1:-}" in
  run | dev)
    asked=false
    for arg in "$@"; do
      case "$arg" in --port | --port=*) asked=true ;; esac
    done
    $asked || args+=(--port 0)
    ;;
esac

cd "$root/app"
# The target folder is absolute: `nsh` runs Cargo from the crates' folders too. Its locks and
# downloads stay out of the machine's cache folder. `URAEDA_TARGET` names another, as the
# benchmarks' optimised build has one of its own.
target=${URAEDA_TARGET:-$root/target}
CARGO_TARGET_DIR="$target" NSH_CACHE="$target/nsh" exec nsh "${args[@]}"
