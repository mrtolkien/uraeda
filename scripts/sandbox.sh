#!/usr/bin/env bash
# `scripts/sandbox.sh [ura sandbox's flags…]`: the app on the sandbox, as `just sandbox` opens it to
# review the whole app: `ura sandbox` (the sample projects, the fake agent, no sign-in), then the
# app over it, with hot reload. Ctrl+C in its terminal stops both, the server by its process id.
#
# - The server keeps its state in `.sandbox-next/` (or `--folder`), on 4420 (or `--port`; `--port
#   0` takes a free one), and takes `ura sandbox`'s other flags: `--reset`, `--long-chat`,
#   `--sign-in`.
# - `--no-app` starts the server alone, until Ctrl+C, for a browser or `just app-dev`.
# - An agent runs it on the hidden display, `hidden-display just sandbox`.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)

app=true
args=()
for arg in "$@"; do
  case "$arg" in
    --no-app) app=false ;;
    *) args+=("$arg") ;;
  esac
done

cargo build -q -p uraeda-cli
ura=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')/debug/ura
if ! $app; then
  exec "$ura" sandbox "${args[@]}"
fi

out=$(mktemp "${TMPDIR:-/tmp}/uraeda-sandbox-out-XXXXXX")
"$ura" sandbox "${args[@]}" >"$out" &
server=$!
stop() {
  if kill -0 "$server" 2>/dev/null; then
    kill -TERM "$server"
    wait "$server" 2>/dev/null || true
  fi
  rm -f "$out"
}
trap stop EXIT

# The address it prints first, once it listens: the long chat takes about half a minute.
address=""
for _ in $(seq 1200); do
  address=$(sed -n 's/^Uraeda server on \(http[^ ]*\).*/\1/p' "$out" | head -n 1)
  [ -n "$address" ] && break
  if ! kill -0 "$server" 2>/dev/null; then
    cat "$out"
    echo "[uraeda] the sandbox did not start: see above" >&2
    exit 1
  fi
  sleep 0.1
done
if [ -z "$address" ]; then
  echo "[uraeda] the sandbox did not answer within two minutes" >&2
  exit 1
fi
echo "[uraeda] the sandbox's server is at $address, process $server; the app opens on it" >&2

status=0
URAEDA_SANDBOX="$address" "$root/scripts/nsh.sh" run || status=$?
exit "$status"
