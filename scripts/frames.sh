#!/usr/bin/env bash
# `scripts/frames.sh < log`: what a scene's frames cost, from the `nsh::fps` lines Native Shell's
# GTK backend logs once a second with `--fps`, shown with `-v`, between the scene's `frames: from` and `frames: to`.
#
# Each line gives the main thread's time per drawn frame over its last 120 frames, as
# mean/p50/p95/max: no single frame is logged. So every other line is read, which at 60 frames a
# second covers each frame once, and every line once a second drew more than 90 frames, as on the
# GPU's display at 120 Hz, where a window holds about one second; each window counts as half its
# frames at its p50, 45% at its p95, and 5% at its max. Every frame is at most what that counts it at, so the median, the 95th,
# and the 99th percentile printed are each at most what they say; the worst is the worst frame.
set -euo pipefail

sed 's/\x1b\[[0-9;]*m//g' |
  awk '
    /frames: from/ { on = 1; next }
    /frames: to/ { on = 0; next }
    on && /fps [0-9.]+\/[0-9.]+ frame / {
      line += 1
      # The first two windows hold frames from before the scene settled; then one in two.
      if (line < 3) next
      match($0, /fps [0-9.]+\/[0-9.]+ frame [0-9.\/]+/)
      split(substr($0, RSTART, RLENGTH), part, " ")
      split(part[4], f, "/")
      # The worst frame of every window: no frame is left out of it.
      print f[4], 0
      split(part[2], rate, "/")
      every = rate[1] > 90 ? 1 : 2
      if (line % every != 0 && every == 2) next
      n = rate[1] * every
      if (n > 120) n = 120
      print f[2], n * 0.50
      print f[3], n * 0.45
      print f[4], n * 0.05
      seconds += every
    }
    END { if (seconds == 0) { print "no nsh::fps line between the scene'"'"'s marks" > "/dev/stderr"; exit 1 } }
  ' |
  sort -n |
  awk '
    { value[NR] = $1; weight[NR] = $2; total += $2; if ($2 > 0) last = NR }
    END {
      split("0.50 0.95 0.99", qs, " ")
      split("median p95 p99", names, " ")
      for (i = 1; i <= 3; i++) {
        sum = 0
        for (k = 1; k <= last; k++) { sum += weight[k]; if (sum >= qs[i] * total) { at[i] = value[k]; break } }
      }
      printf "frames %d, median <= %.2f ms, p95 <= %.2f ms, p99 <= %.2f ms, worst %.2f ms\n", total, at[1], at[2], at[3], value[NR]
    }
  '

# The engine's side, which the main thread's frames do not show: a commit that takes longer than a
# refresh leaves frames with nothing new to draw. The seconds' means of the frames drawn, of the
# frames over one refresh, and the worst second's 95th percentile of a commit's JavaScript and of
# its core (rendering, layout, diffing), each a commit of the engine's thread.
sed 's/\x1b\[[0-9;]*m//g' < "${FRAMES_LOG:-/dev/null}" |
  awk '
    /frames: from/ { on = 1; next }
    /frames: to/ { on = 0; next }
    on && /fps [0-9.]+\/[0-9.]+ frame / {
      for (i = 1; i < NF; i++) {
        if ($i == "fps") { split($(i + 1), r, "/"); fps += r[1]; rate = r[2] }
        if ($i == "over") { o = $(i + 1); sub("%", "", o); over += o }
        if ($i == "js") { split($(i + 1), j, "/"); if (j[3] > js) js = j[3] }
        if ($i == "core") { split($(i + 1), c, "/"); if (c[3] > core) core = c[3] }
      }
      n += 1
    }
    END {
      if (n > 0) printf "engine: %.0f of %.0f frames a second, %.1f%% over a refresh; a commit p95 at worst js %.2f ms, core %.2f ms\n", fps / n, rate, over / n, js, core
    }
  '
