#!/usr/bin/env bash
# `scripts/gpu-display.sh <weston> <command> [args…]`: what `hidden-display --gpu` runs, inside its
# isolated run and session bus. It starts a headless Weston that draws with its GL renderer on the
# machine's GPU, 1400 by 800 at 120 Hz, in a kiosk shell that gives the window the whole output,
# then runs the command with `WAYLAND_DISPLAY` set to that compositor's socket, by its full path,
# and stops the compositor, by its process id, when the command ends. No screen shows it.
set -euo pipefail
weston=$1
shift

runtime=$(mktemp -d "${TMPDIR:-/tmp}/uraeda-gpu-XXXXXX")
chmod 700 "$runtime"
XDG_RUNTIME_DIR="$runtime" "$weston" --backend=headless --renderer=gl --width=1400 --height=800 \
  --refresh-rate=120000 --shell=kiosk --fake-seat --no-config --socket=display \
  --log="$runtime/weston.log" 2>>"$runtime/weston.err" &
compositor=$!
stop() {
  if kill -0 "$compositor" 2>/dev/null; then
    kill -TERM "$compositor"
    wait "$compositor" 2>/dev/null || true
  fi
  rm -rf "$runtime"
}
trap stop EXIT

for _ in $(seq 100); do
  [ -S "$runtime/display" ] && break
  if ! kill -0 "$compositor" 2>/dev/null; then break; fi
  sleep 0.1
done
if [ ! -S "$runtime/display" ] || ! grep -q "Using GL renderer" "$runtime/weston.log"; then
  cat "$runtime/weston.log" >&2
  echo "[uraeda] the GPU's hidden display did not start: Weston's log is above" >&2
  exit 1
fi
echo "[uraeda] the hidden display draws on $(sed -n 's/.*GL renderer: //p' "$runtime/weston.log" | head -n 1)" >&2

status=0
WAYLAND_DISPLAY="$runtime/display" "$@" || status=$?
exit "$status"
