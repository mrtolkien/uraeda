# Every check and build of the repository, as recipes: `just` lists them. Run them in the dev
# shell, `nix develop -c just <recipe>`, which pins every tool they call.
#
# Cargo and `nsh` skip what did not change, so no recipe keeps a cache of its own.

set shell := ["bash", "-euo", "pipefail", "-c"]
# A recipe's arguments reach its command as they were typed, quotes and parentheses included.
set positional-arguments := true

# A run that is not a person's use of the app, as every test, picture, gallery, frame, and sandbox
# recipe is: a temporary folder of its own, with its own data, configuration, cache, and state
# folders, a check that it wrote nothing in the person's folders of the app, and no host's git
# configuration. Only `just app` and `just app-dev`, run by a person, use the person's folders.
isolated := "scripts/isolated.sh"
# The same, in one of the machine's two slots for heavy runs, shared by every checkout.
heavy := "scripts/isolated.sh --slots 2"
# The benchmarks' build: every crate optimised, Native Shell's engine and its JavaScript's
# interpreter with them, as a release's, where a development build's run several times slower.
# It keeps a target folder of its own, so the checks' builds stay as they are.
optimised := "URAEDA_TARGET=\"$PWD/target/optimised\" CARGO_TARGET_DIR=\"$PWD/target/optimised\" CARGO_PROFILE_DEV_OPT_LEVEL=3 CARGO_PROFILE_DEV_DEBUG_ASSERTIONS=false CARGO_PROFILE_DEV_OVERFLOW_CHECKS=false"
nsh := "scripts/nsh.sh"

# List the recipes.
default:
    @just --list --unsorted

# --- After every task ---------------------------------------------------------------------------

# A Rust task's validation: formatting, lints, and the tests of its crates, `just task uraeda-server`.
task +crates: fmt-check
    cargo clippy {{ prepend('-p ', crates) }} --all-targets -- -D warnings
    {{ heavy }} cargo nextest run {{ prepend('-p ', crates) }}

# An app task's validation: formatting, lints, the app's types, and its tests.
task-app: fmt-check lint-app app-check app-test

# --- After a wave is merged ---------------------------------------------------------------------

# The merged code builds as a whole: every crate with its tests, and the app's types.
check: app-check
    cargo check --workspace --all-targets

# --- Once, at the end of a feature --------------------------------------------------------------

# The full pass: every check of the repository.
ready: fmt-check lint specs test app-check app-test

# --- The parts ----------------------------------------------------------------------------------

# Format everything: Rust, then TSX, Markdown, JSON, and TOML.
fmt:
    cargo fmt
    oxfmt

# Fail when a file is not formatted.
fmt-check:
    cargo fmt --check
    oxfmt --check

# Every lint: Clippy on the workspace, the app's TSX, and the GitHub workflows.
lint: lint-app lint-workflows
    {{ heavy }} cargo clippy --workspace --all-targets -- -D warnings

# The lints of the app's TSX.
lint-app:
    oxlint -c .oxlintrc.json --deny-warnings app

# The GitHub workflows' lint, with ShellCheck on their scripts.
lint-workflows:
    actionlint

# The Rust tests: all of them, or cargo-nextest's arguments, `just test -p uraeda-core`.
test *args:
    {{ heavy }} cargo nextest run "$@"

# `ura check` on the specs and on the skill's example, following their links.
specs:
    cargo run -q -p uraeda-cli -- check specs
    cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs

# The app's types: `cargo check` of its crate, then NSH's type check of its TSX.
app-check:
    {{ nsh }} check

# The app's tests, `*.test.tsx`, on NSH's headless runner: no display. A fresh sandbox runs beside
# them, its address in `URAEDA_SANDBOX`, for the client store's tests against the real server.
app-test:
    {{ heavy }} scripts/sandboxed.sh {{ nsh }} test

# The app on GTK, with hot reload. An agent, and any check, runs `hidden-display just app-dev`.
app-dev *args:
    {{ nsh }} run "$@"

# The app on Linux, `uraeda`, built with `ura` beside it: it finds this machine's server, or starts
# it, and stops the one it started when its window closes. Its flags: `--server <address>` for
# another machine's, `--data-dir <folder>` for another data folder. An agent runs it on the hidden
# display only, `hidden-display just app --data-dir <a temporary folder>`.
app *args:
    {{ nsh }} build -o ../target/app/nsh
    cargo build -q -p uraeda-cli -p uraeda-app --bin ura --bin uraeda
    target/debug/uraeda --app target/app/nsh "$@"

# The Linux app as a release ships it, in `target/package/`: the folder `uraeda/`, the same as
# `uraeda-app-x86_64-linux.tar.gz` and as `uraeda-app-x86_64.AppImage`, each with its `.sha256`.
# It holds the app, `ura` beside it, the desktop entry, and the icons: see `scripts/package.sh`.
package:
    {{ heavy }} scripts/package.sh

# A screen's pictures, for its review: `just app-shots /r/<repository>/inbox` opens the app on a
# fresh sandbox at that address; `just app-shots <state>` the shell in one of its own states,
# `pairing`, `refused`, `stopped`, `starting`, or `states` for all four. Each in both themes, 1400
# and 390 points wide, as `target/shots/app/<name>-<theme>-<width>.png`, on the hidden display.
app-shots what="/":
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p target/shots/app
    what="{{ what }}"
    case "$what" in
      /*) filter="route" ;;
      states) filter="state " ;;
      *) filter="state $what" ;;
    esac
    URAEDA_ROUTE="$what" {{ isolated }} hidden-display scripts/sandboxed.sh {{ nsh }} test screens/shots.test.tsx --target linux --filter "$filter"
    if [ "$filter" = "route" ]; then
      name=$(echo "$what" | sed 's|^/||; s|[^A-Za-z0-9._-]|-|g; s|^$|root|')
      for shot in target/shots/app/route-*.png; do mv "$shot" "${shot/route-/$name-}"; done
    fi
    ls target/shots/app

# An agent, and any check, runs `hidden-display just gallery`.
# The gallery, every component of the library in one app, on GTK with hot reload.
gallery *args:
    {{ isolated }} {{ nsh }} run Gallery.tsx "$@"

# Every page in both themes, 1400, 900, and 390 points wide, as `<group>-<page>-<theme>-<width>.png`:
# all of them, or those whose test's name holds a word, a page (`just gallery-shots dialog`) or a
# group (`just gallery-shots surfaces`).
# The gallery's pictures, in `target/shots/gallery/`, on the hidden display.
gallery-shots filter="":
    mkdir -p target/shots/gallery
    {{ isolated }} hidden-display {{ nsh }} test gallery/gallery.test.tsx --target linux --filter "{{ filter }}"

# The scenes: `streaming`, a session of 20,000 messages with a reply growing; `scrolling`, the same
# scrolling by itself; `glass`, the same under a bar of glass. Prints Native Shell's `nsh::perf`
# line of each second, the machine's load before and after, then the median, the 95th and 99th
# percentiles, and the worst frame. It draws on the GPU's hidden display (`hidden-display --gpu`),
# at 120 Hz; `just frames <scene> software` on Xvfb's, which paints in software at 60 Hz. Run it
# once, on a quiet machine: it is a benchmark, never part of a check.
# What a frame of a scene of the gallery costs, on the hidden display: `just frames glass`.
frames scene on="gpu":
    @echo "load before: $(cut -d' ' -f1-3 /proc/loadavg)"
    {{ optimised }} {{ isolated }} hidden-display {{ if on == "gpu" { "--gpu" } else { "" } }} {{ nsh }} test gallery/frames.test.tsx --target linux --fps --filter "scene {{ scene }}," 2>&1 | tee target/frames-{{ scene }}-{{ on }}.log
    @echo "load after: $(cut -d' ' -f1-3 /proc/loadavg)"
    @FRAMES_LOG=target/frames-{{ scene }}-{{ on }}.log scripts/frames.sh < target/frames-{{ scene }}-{{ on }}.log

# The navigation benchmark: the time from a key to the frame that draws its result with its records,
# for every page and action the performance decision names, over a fresh sandbox with its chat of
# 20,000 messages, printed as a table, against 100 ms and a reload's 1 s. On the GPU's hidden
# display, or Xvfb's with `software`. The app times itself in a development build, which warns past
# 100 ms (`app/ui/timing.ts`). Run it once, on a quiet machine: it is never part of a check.
bench-navigation on="gpu":
    URAEDA_SANDBOX_ARGS=--long-chat {{ optimised }} {{ isolated }} hidden-display {{ if on == "gpu" { "--gpu" } else { "" } }} scripts/sandboxed.sh {{ nsh }} test tools/navigation.test.tsx --target linux 2>&1 | tee target/bench-navigation-{{ on }}.log
    @sed -n '/^navigation:/,/^[^|n]/p' target/bench-navigation-{{ on }}.log | sed 's/\x1b\[[0-9;]*m//g'

# The server over sample projects and a fake agent, without sign-in, at http://127.0.0.1:4420, its
# state in `.sandbox-next/` until `just sandbox --reset`: `ura sandbox`'s flags, `--port 0`,
# `--sign-in`, `--long-chat`, `--folder DIR`.
sandbox *args:
    {{ isolated }} cargo run -q -p uraeda-cli -- sandbox "$@"

# A command beside a fresh sandbox of its own, on a free port, its address in `URAEDA_SANDBOX`:
# `just sandboxed scripts/nsh.sh test`. The sandbox stops, and its folder goes, when the command ends.
sandboxed +command:
    {{ isolated }} scripts/sandboxed.sh "$@"

# cargo-dist, which builds and releases `ura`: `just dist plan`, or `just dist generate` after a
# change of `dist-workspace.toml`, which writes `.github/workflows/release.yml` again.
dist *args:
    dist "$@"

# The release's plan, which fails when `release.yml` is not what `dist-workspace.toml` generates.
release-plan:
    dist plan

# Any other command of Native Shell's CLI on the app, `just nsh build`.
nsh *args:
    {{ nsh }} "$@"

# Write the client's types of the protocol, `app/store/protocol.d.ts`, from the protocol's crate.
protocol-types:
    cargo run -q -p uraeda-protocol --example types -- app/store/protocol.d.ts

# The lines the Rust tests run, as `coverage/rust/html/index.html`: a report, never a check.
coverage:
    mkdir -p coverage
    {{ isolated }} cargo llvm-cov nextest --profile coverage --lcov --output-path coverage/rust.lcov
    cargo llvm-cov report --html --output-dir coverage/rust
