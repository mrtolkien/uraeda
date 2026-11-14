# Every check and build of the repository, as recipes: `just` lists them. Run them in the dev
# shell, `nix develop -c just <recipe>`, which pins every tool they call.
#
# Cargo skips what did not change, so no recipe keeps a cache of its own.

set shell := ["bash", "-euo", "pipefail", "-c"]
# A recipe's arguments reach its command as they were typed, quotes and parentheses included.
set positional-arguments := true

# A run that is not a person's use of `ura`, as every test and sandbox recipe is: a temporary folder
# of its own, with its own data, configuration, cache, and state folders, a check that it wrote
# nothing in the person's folders of Uraeda, and no host's git configuration.
isolated := "scripts/isolated.sh"
# The same, in one of the machine's two slots for heavy runs, shared by every checkout.
heavy := "scripts/isolated.sh --slots 2"

# List the recipes.
default:
    @just --list --unsorted

# --- After every task ---------------------------------------------------------------------------

# A Rust task's validation: formatting, lints, and the tests of its crates, `just task uraeda-serve`.
task +crates: fmt-check
    cargo clippy {{ prepend('-p ', crates) }} --all-targets -- -D warnings
    {{ heavy }} cargo nextest run --no-tests=warn {{ prepend('-p ', crates) }}

# --- After a wave is merged ---------------------------------------------------------------------

# The merged code builds as a whole: every crate with its tests.
check:
    cargo check --workspace --all-targets

# --- Once, at the end of a feature --------------------------------------------------------------

# The full pass: every check of the repository.
ready: fmt-check lint specs test

# --- The parts ----------------------------------------------------------------------------------

# Format everything: Rust, then Markdown, JSON, and TOML.
fmt:
    cargo fmt
    oxfmt

# Fail when a file is not formatted.
fmt-check:
    cargo fmt --check
    oxfmt --check

# Every lint: Clippy on the workspace, and the GitHub workflows.
lint: lint-workflows
    {{ heavy }} cargo clippy --workspace --all-targets -- -D warnings

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

# `ura serve` over sample projects, to try the pages: `ura sandbox`, at http://127.0.0.1:4420, its
# state in `.sandbox/` until `just sandbox --reset`; Ctrl+C stops it. `ura sandbox`'s flags,
# `--port 0`, `--folder DIR`.
sandbox *args:
    {{ isolated }} scripts/sandbox.sh "$@"

# cargo-dist, which builds and releases `ura`: `just dist plan`, or `just dist generate` after a
# change of `dist-workspace.toml`, which writes `.github/workflows/release.yml` again.
dist *args:
    dist "$@"

# The release's plan, which fails when `release.yml` is not what `dist-workspace.toml` generates.
release-plan:
    dist plan

# Start a release, from an up-to-date `main`: `just release 1.4.0`, which asks for the release's
# name, or `just release 1.4.0 --name "Vim mode + git page"`. It writes the version's notes in
# `CHANGELOG.md` from the records added to `specs/done/` since the last tag, sets the workspace's
# version, and, once confirmed, commits, tags, and pushes: the tag runs the release. `--dry-run`
# prints the notes and changes nothing (`crates/xtask/`).
release *args:
    cargo run -q -p uraeda-xtask -- release "$@"

# The benchmarks of the specs' success criteria, the ignored tests named `bench_`: they measure
# time, so no check runs them. Run them once, on a quiet machine.
bench:
    {{ isolated }} cargo nextest run --run-ignored only -E 'test(/^bench_/)'

# The lines the Rust tests run, as `coverage/rust/html/index.html`: a report, never a check.
coverage:
    mkdir -p coverage
    {{ isolated }} cargo llvm-cov nextest --profile coverage --lcov --output-path coverage/rust.lcov
    cargo llvm-cov report --html --output-dir coverage/rust
