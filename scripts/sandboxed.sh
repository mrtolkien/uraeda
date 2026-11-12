#!/usr/bin/env bash
# `scripts/sandboxed.sh <command> [args…]`: runs a command beside a sandbox of its own, as the app's
# tests need one (`just sandboxed scripts/nsh.sh test`).
#
# - It builds `ura`, then starts `ura sandbox` on a free port, in a new folder of the system's
#   temporary folder: a fresh sandbox, never the checkout's `.sandbox-next/`. Beside it, a second
#   one keeps sign-in on (`--sign-in`), for the pairing and revoking tests.
# - Once the servers answer, it runs the command with `URAEDA_SANDBOX` set to the first one's
#   address, `http://127.0.0.1:<port>`, `URAEDA_SANDBOX_FOLDER` to its folder, and
#   `URAEDA_SANDBOX_SIGN_IN` and `URAEDA_SANDBOX_KEY` to the second one's address and access key.
# - When the command ends, passed or failed, it stops the servers by their process ids, and removes
#   the folder. It exits with the command's status.
set -euo pipefail

cargo build -q -p uraeda-cli
ura=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')/debug/ura

folder=$(mktemp -d "${TMPDIR:-/tmp}/uraeda-sandbox-XXXXXX")
servers=()
stop() {
  for server in "${servers[@]}"; do
    if kill -0 "$server" 2>/dev/null; then
      kill -TERM "$server"
      wait "$server" 2>/dev/null || true
    fi
  done
  rm -rf "$folder"
}
trap stop EXIT

# Starts the sandbox `name`, with `ura sandbox`'s other flags, in `$folder/<name>`.
start() {
  local name=$1
  shift
  mkdir -p "$folder/$name.run"
  "$ura" sandbox --port 0 --folder "$folder/$name" "$@" >"$folder/$name.run/out" 2>"$folder/$name.run/err" &
  servers+=($!)
}

# The address the sandbox `name` prints first, once it listens.
address_of() {
  local name=$1 server=$2 address=""
  for _ in $(seq 600); do
    address=$(sed -n 's/^Uraeda server on \(http[^ ]*\).*/\1/p' "$folder/$name.run/out" | head -n 1)
    [ -n "$address" ] && break
    if ! kill -0 "$server" 2>/dev/null; then
      cat "$folder/$name.run/err" >&2
      echo "[uraeda] the sandbox $name did not start" >&2
      exit 1
    fi
    sleep 0.1
  done
  if [ -z "$address" ]; then
    cat "$folder/$name.run/err" >&2
    echo "[uraeda] the sandbox $name did not answer within a minute" >&2
    exit 1
  fi
  echo "$address"
}

# `URAEDA_SANDBOX_ARGS`: more flags of the first one's, `--long-chat` for the navigation benchmark.
# shellcheck disable=SC2086
start sandbox ${URAEDA_SANDBOX_ARGS:-}
start signed --sign-in
address=$(address_of sandbox "${servers[0]}")
signed=$(address_of signed "${servers[1]}")
# The key it printed with its address, the only time it shows it.
key=$(grep -o 'ura_[A-Za-z0-9_-]*' "$folder/signed.run/out" | head -n 1)
echo "[uraeda] sandbox at $address, in $folder/sandbox; with sign-in at $signed" >&2

status=0
URAEDA_SANDBOX="$address" URAEDA_SANDBOX_FOLDER="$folder/sandbox" \
  URAEDA_SANDBOX_SIGN_IN="$signed" URAEDA_SANDBOX_KEY="$key" "$@" || status=$?
exit "$status"
