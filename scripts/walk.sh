#!/usr/bin/env bash
# `scripts/walk.sh <command> [args…]`: runs `just walk`'s test beside `scripts/sandboxed.sh`'s
# sandbox, and plays the server's part of its step "the server stops": the test cannot stop a
# process, so it says when, by the pictures it takes, and this script does it, by the process's id.
#
# - When the picture `*-server-stops*.png` appears in `target/shots/walk/`, it stops the sandbox's
#   server (`URAEDA_SANDBOX_PID`).
# - When `*-server-gone*.png` appears, it starts the server again, on the same port and folder,
#   and stops that one when the command ends.
set -euo pipefail
shots=$(cd "$(dirname "$0")/.." && pwd)/target/shots/walk
ura=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')/debug/ura
port=${URAEDA_SANDBOX##*:}
again=""

stop() {
  [ -n "${watcher:-}" ] && kill "$watcher" 2>/dev/null || true
  if [ -f "$TMPDIR/walk-server" ]; then
    again=$(cat "$TMPDIR/walk-server")
    kill -TERM "$again" 2>/dev/null || true
  fi
}
trap stop EXIT

rm -f "$shots"/*-server-stops*.png "$shots"/*-server-gone*.png
(
  until ls $shots/*-server-stops*.png >/dev/null 2>&1; do sleep 0.2; done
  echo "[walk] stopping the sandbox's server, process $URAEDA_SANDBOX_PID" >&2
  kill -TERM "$URAEDA_SANDBOX_PID"
  until ls $shots/*-server-gone*.png >/dev/null 2>&1; do sleep 0.2; done
  "$ura" sandbox --port "$port" --folder "$URAEDA_SANDBOX_FOLDER" --long-chat >/dev/null 2>&1 &
  echo $! >"$TMPDIR/walk-server"
  echo "[walk] started the server again, process $!" >&2
  wait
) &
watcher=$!

status=0
"$@" || status=$?
exit "$status"
