#!/usr/bin/env bash
# `scripts/slots-cc.sh [args…]`: the linker cargo calls, set in `.cargo/config.toml`. It runs `cc`
# with the same arguments, in one of the machine's slots for links, shared by every checkout: the
# other links wait.
#
# - A link of a test binary that takes Native Shell holds about 1 GB, and a crate has one test
#   binary per file of its `tests/` folder. Cargo starts one link per core: 20 at once, in two
#   worktrees, filled 31 GB of memory and as much swap.
# - The machine has one slot per 4 GiB of its memory, and at least one: 7 on a machine of 31 GiB,
#   where 7 links hold about 7 GB. `URAEDA_LINK_SLOTS` sets another number.
# - The name ends in `-cc` because rustc reads the linker's kind from its name, and passes a
#   compiler's arguments only to a name that looks like one.
set -euo pipefail
slots=${URAEDA_LINK_SLOTS:-$(awk '/^MemTotal:/ { n = int($2 / (4 * 1024 * 1024)); print (n < 1 ? 1 : n) }' /proc/meminfo)}
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
