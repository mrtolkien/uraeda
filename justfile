# Every check and build of the repository, as recipes: `just` lists them. Run them in the dev
# shell, `nix develop -c just <recipe>`, which pins every tool they call.
#
# Cargo and `nsh` skip what did not change, so no recipe keeps a cache of its own.

set shell := ["bash", "-euo", "pipefail", "-c"]
# A recipe's arguments reach its command as they were typed, quotes and parentheses included.
set positional-arguments := true

# A test run with a temporary folder of its own, and without the host's git configuration.
isolated := "scripts/isolated.sh"
# The same, in one of the machine's two slots for heavy runs, shared by every checkout.
heavy := "scripts/isolated.sh --slots 2"
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

# Every lint: Clippy on the workspace, and the app's TSX.
lint: lint-app
    {{ heavy }} cargo clippy --workspace --all-targets -- -D warnings

# The lints of the app's TSX.
lint-app:
    oxlint -c .oxlintrc.json --deny-warnings app

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

# The app's tests, `*.test.tsx`, on NSH's headless runner: no display.
app-test:
    {{ heavy }} {{ nsh }} test

# The app on GTK, with hot reload. An agent, and any check, runs `hidden-display just app-dev`.
app-dev *args:
    {{ nsh }} run "$@"

# The design language's samples as pictures, in `target/shots/samples/`, on the hidden display:
# all of them, or those whose test's name holds a word, `just samples-shots glass`.
samples-shots filter="":
    mkdir -p target/shots/samples
    hidden-display {{ nsh }} test gallery/samples/samples.test.tsx --target linux --filter "{{ filter }}"

# What a frame costs with the glass bar over a transcript that scrolls by itself, then with no
# bar, on the hidden display: Native Shell's frame timing, one `nsh::perf` line a second, for 30
# seconds each.
samples-frames:
    hidden-display {{ nsh }} test gallery/samples/frames.test.tsx --target linux --fps -v

# The gallery's pages as pictures, in `target/shots/gallery/`, on the hidden display, in both
# themes and at a desktop's and a phone's width: all of them, or those whose test's name holds a
# word, `just gallery-shots dialog`, `just gallery-shots "light, 390"`.
gallery-shots filter="":
    mkdir -p target/shots/gallery
    hidden-display {{ nsh }} test gallery/surfaces/gallery.test.tsx --target linux --filter "{{ filter }}"
    hidden-display {{ nsh }} test gallery/controls/gallery.test.tsx --target linux --filter "{{ filter }}"
    hidden-display {{ nsh }} test gallery/lists/gallery.test.tsx --target linux --filter "{{ filter }}"
    hidden-display {{ nsh }} test gallery/text/gallery.test.tsx --target linux --filter "{{ filter }}"
    hidden-display {{ nsh }} test gallery/layout/gallery.test.tsx --target linux --filter "{{ filter }}"
    hidden-display {{ nsh }} test gallery/document/gallery.test.tsx --target linux --filter "{{ filter }}"

# What a frame costs with a list of 20,000 rows that scrolls fast by itself, on the hidden display:
# Native Shell's frame timing, one `nsh::perf` line a second, for 30 seconds.
lists-frames:
    hidden-display {{ nsh }} test gallery/lists/frames.test.tsx --target linux --fps -v

# What a frame costs while a long reply grows by itself, its last block changing every frame, on the
# hidden display: Native Shell's frame timing, one `nsh::perf` line a second, for 40 seconds.
document-frames:
    hidden-display {{ nsh }} test gallery/document/frames.test.tsx --target linux --fps -v

# The server over sample projects and a fake agent, without sign-in, at http://127.0.0.1:4420, its
# state in `.sandbox-next/` until `just sandbox --reset`: `ura sandbox`'s flags, `--port 0`,
# `--sign-in`, `--long-chat`, `--folder DIR`.
sandbox *args:
    cargo run -q -p uraeda-cli -- sandbox "$@"

# A command beside a fresh sandbox of its own, on a free port, its address in `URAEDA_SANDBOX`:
# `just sandboxed scripts/nsh.sh test`. The sandbox stops, and its folder goes, when the command ends.
sandboxed +command:
    scripts/sandboxed.sh "$@"

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
