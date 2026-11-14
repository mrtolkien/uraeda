# Contributing to Uraeda

Uraeda's tool is `ura`, one Rust binary over a Rust workspace. The
[repository's layout](AGENTS.md#repository-layout) says what lives where, and the
[stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions why.
Uraeda builds itself with its own workflow: its files are in [`specs/`](specs/).

## Building

Everything runs in the dev shell, `nix develop`, which pins every tool: Rust, `just`, cargo-nextest,
the formatters, cargo-dist, and the hidden display. Nothing is installed in a checkout, and no check
needs Node. Every check and build is a recipe of the [`justfile`](justfile), and `just` lists them:

```sh
nix develop                              # the dev shell; or `nix develop -c just <recipe>`
just task uraeda-serve uraeda-core       # after a change: formatting, Clippy, the crates' tests
just check                               # everything builds: every crate with its tests
just ready                               # before a push: every check and test, as CI runs them
just fmt                                 # format Rust, Markdown, JSON, and TOML
just test -p uraeda-core                 # the Rust tests, with cargo-nextest's arguments
just specs                               # ura check on specs/ and on the skill's example
just lint                                # Clippy on the workspace, and the GitHub workflows
just bench                               # the benchmarks of the specs' success criteria, on demand
just coverage                            # the lines the tests run, as a report in coverage/
cargo run -p uraeda-cli -- status        # ura, from source
```

Turn the commit hook on once in a clone: it formats the files a commit stages, as `just fmt` does,
and never touches what the commit leaves out. Every worktree of the clone shares the setting.

```sh
git config core.hooksPath .githooks
```

A new worktree's first `nix develop` clones the `target/` of the closest checkout, so its first
build compiles only the workspace's crates ([`scripts/worktree-seed.sh`](scripts/worktree-seed.sh)).

## The crates

- [`crates/core/`](crates/core/): the workflow's logic, shared by every command: parsing,
  validation, the next step, answers and reviews, the settings, and a read of git with gix.
- [`crates/text/`](crates/text/): what is read in a Markdown text alone: its document tree, its
  links, and the patch between two texts.
- [`crates/serve/`](crates/serve/): `ura serve`, its pages drawn as HTML in Rust, with plain
  JavaScript and CSS embedded, and the sync's side of the desktop.
- [`crates/vault/`](crates/vault/): the human's notes: the vault's layout, its links to the specs,
  the sync's plan, and the Obsidian plugin the sync carries to the phone, plain JavaScript with no
  build step.
- [`crates/cli/`](crates/cli/): the `ura` binary.
- [`crates/xtask/`](crates/xtask/): the repository's own tools: `just release`, and the tests of the
  toolchain's configuration.

## The sandbox

`just sandbox` runs `ura sandbox`: `ura serve` over sample projects, built from
[`fixtures/`](fixtures/), each feature's branch in a worktree, with a `gh` that lists their pull
requests. It never reads your projects or your settings.

```sh
just sandbox                 # the pages on http://127.0.0.1:4420, until Ctrl+C
just sandbox --reset         # the sample projects built again
just sandbox --port 0        # on a free port
just sandbox --folder DIR    # its state in DIR rather than .sandbox/
```

Review every change to a page there, at a desk's width and a phone's. Every test and sandbox recipe
runs through [`scripts/isolated.sh`](scripts/isolated.sh): its data, configuration, cache, and state
folders are temporary, and the run fails when it wrote in your own folders of Uraeda. A run of your
own does the same: `cargo run -p uraeda-cli -- serve --port 0 --data-dir <a temporary folder>`.

## Obsidian, on a hidden display

To check the vault's sync against the real Obsidian, installed on the machine, run it where no
window reaches your screen. On Linux, the dev shell's `hidden-display <command>` runs a command on
an X display of its own, 1400 by 800, that no screen shows, with a session bus of its own, through
`scripts/isolated.sh`. The command loses the session's Wayland display, so an Electron app such as
Obsidian takes `--ozone-platform=x11`:

```sh
hidden-display obsidian --ozone-platform=x11
```

Give it a vault of its own, in a temporary folder, never yours.

## Releasing

A release ships `ura` alone, built by [cargo-dist](https://opensource.axo.dev/cargo-dist/) for Linux
and macOS, on x64 and arm64, with its shell installer and its Homebrew formula.

On an up-to-date `main`, `just release` asks for the release's name, writes the notes in
`CHANGELOG.md` under `<version> - <name>`, from the records added to `specs/done/` since the last
tag, sets the workspace's version, and, once confirmed, commits, tags, and pushes:

```sh
just release 3.1.0
just release 3.1.0 --name "Pages on the phone"
just release 3.1.0 --dry-run     # the notes alone: nothing changes
```

A pushed tag runs [`release.yml`](.github/workflows/release.yml), which cargo-dist writes from
[`dist-workspace.toml`](dist-workspace.toml): `just dist generate` writes it again after a change
there, and `just release-plan` fails while it is out of date, as CI checks on every pull request.
Its jobs build `ura` for each platform from the tag's commit, then create the GitHub release with
every file at once. [`publish-homebrew.yml`](.github/workflows/publish-homebrew.yml) then pushes the
formula to `mrtolkien/homebrew-tap`, with Tab completion added, using the repository's secret
`HOMEBREW_TAP_TOKEN`.

A release that stopped part way is completed at the same version: on the tag's run, "Re-run failed
jobs". A failed build released nothing, so its re-run builds what failed, reuses what passed, and
releases it all. A run that created the release never replaces a file of it: run again, it stops at
the release that exists, and only the jobs after it, such as Homebrew's, are re-run. GitHub re-runs
a run's jobs for 30 days.

## Licenses

The code is under the [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE) licenses, at your option.

The agents' marks on `ura serve`'s pages are
[Codicons](https://github.com/microsoft/vscode-codicons)' drawings, by Microsoft, under the Creative
Commons Attribution 4.0 license (CC BY 4.0). Its other icons are [Lucide](https://lucide.dev)'s,
under the ISC license.
