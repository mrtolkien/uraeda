#!/usr/bin/env bash
# `scripts/update-manifest.sh <archive>...`: the release's update manifest, which every installed
# app reads as it looks for a new version (`nsh/updater`, at GitHub's `releases/latest/download/`):
# `latest.json`, the version and each platform's archive with its size and SHA-256, and
# `latest.json.sig`, its signature, in `target/package/`.
#
# The archives are those `just package` made, `uraeda-update-<version>-<os>-<arch>.tar.gz`, one per
# platform: Linux's today, a Mac's beside it once its app is built. The secret key is in
# `URAEDA_UPDATER_KEY` (`nsh keygen`'s `.secret`), the one of `app/nsh.json`'s
# `updater.publicKey`: the release's CI holds it as a secret of the same name.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

[ "$#" -gt 0 ] || { echo "usage: scripts/update-manifest.sh <archive>..." >&2; exit 1; }
entry=$root/target/package/updater
[ -f "$entry/nsh.json" ] || { echo "update-manifest: no $entry/nsh.json: run just package first" >&2; exit 1; }
grep -q '"publicKey"' "$entry/nsh.json" || {
  echo "update-manifest: app/nsh.json's \"updater\" has no \"publicKey\": an unsigned manifest is refused" >&2
  echo "  see CONTRIBUTING.md, The app's updates: nsh keygen, then its .pub in updater.publicKey" >&2
  exit 1
}
[ -n "${URAEDA_UPDATER_KEY:-}" ] || { echo "update-manifest: URAEDA_UPDATER_KEY holds no secret key" >&2; exit 1; }

key=$(mktemp)
trap 'rm -f "$key"' EXIT
printf '%s\n' "$URAEDA_UPDATER_KEY" > "$key"
archives=()
for archive in "$@"; do archives+=("$(realpath "$archive")"); done
# `nsh update-manifest` checks the key is the one of `publicKey` before it writes the signature.
scripts/nsh.sh update-manifest --entry "$entry" --key "$key" --out "$root/target/package" "${archives[@]}"
