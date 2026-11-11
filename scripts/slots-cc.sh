#!/usr/bin/env bash
# `scripts/slots-cc.sh [args…]`: the linker cargo calls, set in `.cargo/config.toml`. It runs `cc`
# with the same arguments, in one of the machine's slots for links, shared by every checkout: the
# other links wait.
#
# - A link of a test binary that takes Native Shell holds about 1 GB, and a crate has one test
#   binary per file of its `tests/` folder. Cargo starts one link per core: 20 at once, in two
#   worktrees, filled 31 GB of memory and as much swap.
# - `URAEDA_LINK_SLOTS` sets the number of slots, 4 without it.
# - The name ends in `-cc` because rustc reads the linker's kind from its name, and passes a
#   compiler's arguments only to a name that looks like one.
set -euo pipefail
slots=${URAEDA_LINK_SLOTS:-4}
locks=${XDG_RUNTIME_DIR:-/tmp}/uraeda-link
mkdir -p "$locks"
while :; do
  for slot in $(seq "$slots"); do
    exec {held}>"$locks/$slot"
    # The lock stays held by `cc` and the linker it starts, and ends with them.
    if flock -n "$held"; then exec cc "$@"; fi
    exec {held}>&-
  done
  sleep 0.1
done
