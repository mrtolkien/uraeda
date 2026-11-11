#!/usr/bin/env bash
# `scripts/worktree-seed.sh <worktree>`: seeds a linked worktree's Rust build, `target/`, from
# another checkout's, run by the dev shell of `flake.nix` while a worktree has none.
#
# A new worktree started with none compiles every dependency again, minutes of it. The build is
# copied as a clone, whose files share the other checkout's blocks until one side rewrites them.
#
# - It is cloned from the checkout whose commit is the closest to this one's: for a task's worktree,
#   the feature's worktree it was branched from, which has built what this one needs. Seeded from
#   the main checkout, each task's worktree compiled every dependency its feature added.
# - Cargo cannot share one `target/` between checkouts: it judges a crate fresh by its files' times.
#   So the clone forgets the workspace's own crates, which the worktree builds again, and keeps the
#   dependencies, which do not depend on the checkout.
# - Without clones, as on ext4, it copies nothing: a full copy would cost the storage it saves.
set -euo pipefail
root=$(cd "$1" && pwd)
[ -e "$root/target" ] && exit 0

# Where to clone from: the checkout with a build whose commit is the fewest commits away.
head=$(git -C "$root" rev-parse HEAD)
from=
best=
while read -r commit path; do
  [ "$path" != "$root" ] && [ -d "$path/target" ] || continue
  away=$(git -C "$root" rev-list --count "$commit...$head" 2>/dev/null) || continue
  if [ -z "$best" ] || [ "$away" -lt "$best" ]; then
    best=$away
    from=$path
  fi
done < <(git -C "$root" worktree list --porcelain | awk '/^worktree /{p=substr($0,10)} /^HEAD /{print $2, p}')
[ -n "$from" ] || exit 0

# Cloned beside its place, then moved there whole: a seed killed midway leaves no half `target/`,
# and a folder named `target` is ignored by git at any depth.
seeding="$root/.target-seeding-$$"
trap 'rm -rf "$seeding"' EXIT
mkdir -p "$seeding"
if ! cp -a --reflink=always "$from/target" "$seeding/target" 2>/dev/null; then
  echo "[uraeda] target/ not seeded: this filesystem cannot clone files" >&2
  exit 0
fi

# The workspace's own crates: Cargo builds a unit without a fingerprint again, and every unit
# depending on it. The files next to each `.fingerprint`, the binaries Cargo copies there, go too,
# so the other checkout's `ura` does not stand for this one's before it builds.
names=$(sed -n 's/^name = "\(.*\)"/\1/p' "$root"/crates/*/Cargo.toml | sort -u | paste -sd'|')
find "$seeding/target" -type d -name .fingerprint -not -path '*/incremental/*' | while read -r prints; do
  find "$(dirname "$prints")" -maxdepth 1 -type f -delete
  find "$prints" -maxdepth 1 -type d | grep -E "/(${names})-[0-9a-f]{16}\$" | xargs -r rm -rf
done

if [ ! -e "$root/target" ]; then
  mv "$seeding/target" "$root/target"
  echo "[uraeda] target/ seeded from $from" >&2
fi
