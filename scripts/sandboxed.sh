#!/usr/bin/env bash
# `scripts/sandboxed.sh <command> [args…]`: runs a command beside a sandbox of its own, as the app's
# tests need one (`just sandboxed scripts/nsh.sh test`).
#
# - It builds `ura`, then starts `ura sandbox` on a free port, in a new folder of the system's
#   temporary folder: a fresh sandbox, never the checkout's `.sandbox-next/`.
# - Once the server answers, it runs the command with `URAEDA_SANDBOX` set to the server's address,
#   `http://127.0.0.1:<port>`, and `URAEDA_SANDBOX_FOLDER` to the sandbox's folder.
# - When the command ends, passed or failed, it stops the server by its process id, and removes the
#   folder. It exits with the command's status.
set -euo pipefail

cargo build -q -p uraeda-cli
ura=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')/debug/ura

folder=$(mktemp -d "${TMPDIR:-/tmp}/uraeda-sandbox-XXXXXX")
server=""
stop() {
  if [ -n "$server" ] && kill -0 "$server" 2>/dev/null; then
    kill -TERM "$server"
    wait "$server" 2>/dev/null || true
  fi
  rm -rf "$folder"
}
trap stop EXIT

"$ura" sandbox --port 0 --folder "$folder/sandbox" >"$folder/out" 2>"$folder/err" &
server=$!

# The first line it prints is its address, once it listens.
address=""
for _ in $(seq 600); do
  address=$(sed -n 's/^Uraeda server on \(http[^ ]*\).*/\1/p' "$folder/out" | head -n 1)
  [ -n "$address" ] && break
  if ! kill -0 "$server" 2>/dev/null; then
    cat "$folder/err" >&2
    echo "[uraeda] the sandbox did not start" >&2
    exit 1
  fi
  sleep 0.1
done
if [ -z "$address" ]; then
  cat "$folder/err" >&2
  echo "[uraeda] the sandbox did not answer within a minute" >&2
  exit 1
fi
echo "[uraeda] sandbox at $address, in $folder/sandbox" >&2

status=0
URAEDA_SANDBOX="$address" URAEDA_SANDBOX_FOLDER="$folder/sandbox" "$@" || status=$?
exit "$status"
