# Contributing to Uraeda

Uraeda's tools are a Rust core, the `ura` CLI, and a web UI served with its server, with
[an app on Native Shell](#the-app-on-native-shell) being built to replace that UI. The
[repository's layout](AGENTS.md#repository-layout) says what lives where, and the
[stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions why.
Uraeda builds itself with its own workflow: its files are in [`specs/`](specs/), and what is being
built now is in [specs/PRIORITIES.md](specs/PRIORITIES.md).

## Building the tools

You need Rust, Node 24, and pnpm, or `nix develop`. In `nix develop`, `pnpm install` stands for
`vp install`, and the screenshot scripts find their WebKit browser.

```sh
vp install         # dependencies
vp run --filter uraeda-binding build  # the Rust core for Node, which vp dev and the tests rebuild when older
vp run fast        # after each task: the checks a change can affect, and the ones left to ready
vp run ready       # before a push: every check and test
vp dev             # the web UI on http://127.0.0.1:4310, opening this repository first
vp run dev         # the same, rebuilding the Rust core and restarting as it or the server changes
vp run sandbox     # the web UI over sample projects and a fake agent, without sign-in
vp run --filter @uraeda/ui build  # the npm package, in packages/uraeda, after the web UI's build
cargo run -p uraeda-cli -- status
```

## The app, on Native Shell

The UI is moving to one TSX app on [Native Shell](https://nsh.dev) (NSH), in [`app/`](app/), with
its Rust crate in [`crates/app/`](crates/app/). It will talk to a Rust server,
[`crates/server/`](crates/server/), over [`crates/protocol/`](crates/protocol/), and edit text
through [`crates/vim/`](crates/vim/). `nix develop` on x86_64 Linux brings what they build with:
NSH's CLI, `nsh`, GTK 4 and WebKitGTK 6.0, clang, and a display no screen shows. Without Nix,
install NSH 0.4.0, the version of the `nsh-*` crates in [`Cargo.toml`](Cargo.toml), with what its
[installation page](https://nsh.dev/docs/installation) lists for Linux.

```sh
vp run app:check   # cargo check of the app's crate, then the types of its TSX
vp run app:test    # the app's tests, app/**/*.test.tsx, with no display
vp run app:dev     # the app in a GTK window, reloading as its TSX changes
hidden-display vp run app:dev          # the same, on a display no screen shows
cargo nextest run -p uraeda-server     # one crate's tests: also uraeda-protocol, uraeda-vim, uraeda-app
cargo clippy -p uraeda-server --all-targets -- -D warnings
```

`vp run ready` runs the first two, and the crates' tests with the others'. The three tasks run `nsh`
through [`scripts/nsh.ts`](scripts/nsh.ts), which builds in the repository's `target/` and keeps the
versions of [`Cargo.lock`](Cargo.lock): run any other `nsh` command the same way, as
`node scripts/nsh.ts package --target linux`. `app:check` also writes NSH's types in `app/.nsh/`,
which `vp check` reads: in a new checkout, run it first.

To upgrade NSH, change its version and hash in [`flake.nix`](flake.nix), the `nsh-*` crates in
`Cargo.toml`, `minRuntime` in [`app/nsh.json`](app/nsh.json), and the version and commit in
[`AGENTS.md`](AGENTS.md#native-shell-nsh), in one commit.

## Settings under `vp dev`

`vp dev` and `vp run dev` read `.env` at the root, from [`.env.example`](.env.example):

- `URAEDA_REPO` names the repository opened first, and adds it to the list.
- `URAEDA_PORT` changes the port.
- `URAEDA_ALLOWED_HOSTS` lists the host names it accepts besides 127.0.0.1, like your machine's full
  name on your tailnet, `mac.tail1234.ts.net`.
- `URAEDA_CONTINUE_AFTER_RESTART` and `URAEDA_CONTINUE_AFTER_LIMIT`, `true` or `false`, turn each
  automatic continue on or off, and `URAEDA_AUTOMATIC_CONTINUES` caps the continues in a row, 1
  to 10.
- `URAEDA_CATCH_UP_PULL_REQUESTS`, `true` or `false`, turns on or off the catch-up of open pull
  requests behind the default branch.

Vite checks host names and takes its port before the settings file is read. So under `vp dev`, they
come from these variables only. The server listens on 127.0.0.1 only: `tailscale serve --bg 4310`
reaches it from your phone, at `https://mac.tail1234.ts.net/`.

The npm package reads no `.env`: its settings come from its flags, its environment, and your
settings file, as [the web UI's page](docs/web-ui.md#settings) says.

## The agents' integrations

When Claude Code changes and sessions break, `vp run validate:claude` checks the integration against
the installed `claude`, with a few short sessions. When Codex does, `vp run validate:codex` checks
its own against the installed `codex`, on its cheapest model at its lowest effort, in throwaway
repositories: the model list, a commit its reviewer approves, a steered message, an interrupt, an
image, and that `~/.codex/config.toml` is left unchanged. Both spend a little of the account's plan,
and neither runs in `vp test` or `vp run ready`.

`ura serve` has its own runtime for Claude Code, in Rust. Its check against the installed `claude`
is a test that only runs when asked for, with two short messages:
`cargo nextest run -p uraeda-server --test claude --run-ignored only real`. The streams its tests
replay are recorded with `node fixtures/runtimes/claude/record.ts`, then
`node fixtures/runtimes/claude/node-events.ts`.

## The README's screenshots

The README shows Home, a round of questions, and a spec of the sandbox's realistic project, at a
desktop's and a phone's width, in both themes. After a change to how these pages look, take them
again:

```sh
vp run readme:screenshots
```

It builds the realistic project afresh, and writes the 12 WebP files of `docs/images/screenshots/`.

## Releasing

On an up-to-date `main`, `vp run release` asks for the release's name, writes the notes in
`CHANGELOG.md` under `<version> - <name>`, the GitHub release's title, sets the version, tags, and
pushes:

```sh
vp run release 0.5.0
vp run release 0.5.0 --name "Vim mode + git page"
```

## Licenses

The code is under the [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE) licenses, at your option.

The web UI bundles the [Monaspace](https://github.com/githubnext/monaspace),
[Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next),
[Literata](https://github.com/googlefonts/literata),
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), and
[Inter](https://github.com/rsms/inter) fonts, under the SIL Open Font License 1.1.

The shipped colour themes, in `crates/core/themes/`, take their colours from their projects, each
file's header naming its source, its version, and its license: Catppuccin, Dracula and Alucard,
GitHub's Primer, Gruvbox, Kanagawa, Nord, Atom's One Dark and One Light, Rosé Pine, Solarized, and
the Tokyo Night VS Code theme (Tokyo Night Light), under the MIT license; and folke's
tokyonight.nvim (Tokyo Night, Storm, and Moon), under the Apache-2.0 license.

The harnesses' marks are [Codicons](https://github.com/microsoft/vscode-codicons)' drawings, by
Microsoft, under the Creative Commons Attribution 4.0 license (CC BY 4.0). The app's other icons are
[Lucide](https://lucide.dev)'s, under the ISC license.
