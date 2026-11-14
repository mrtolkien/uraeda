#!/usr/bin/env bash
# `scripts/sandbox.sh [ura sandbox's flags…]`: `ura serve` over the sample projects, as
# `just sandbox` starts it to try the pages, until Ctrl+C. It keeps its state in `.sandbox/` (or
# `--folder`), on 4420 (or `--port`; `--port 0` takes a free one), and builds it again with
# `--reset`.
set -euo pipefail

cargo build -q -p uraeda-cli
ura=$(cargo metadata --format-version 1 --no-deps | sed -n 's/.*"target_directory":"\([^"]*\)".*/\1/p')/debug/ura
exec "$ura" sandbox "$@"
