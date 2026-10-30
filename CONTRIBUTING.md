# Contributing to Uraeda

Uraeda's tools are a Rust core, the `ura` CLI, and a web UI served with its server. The
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

## Settings under `vp dev`

`vp dev` and `vp run dev` read `.env` at the root, from [`.env.example`](.env.example):

- `URAEDA_REPO` names the repository opened first, and adds it to the list.
- `URAEDA_PORT` changes the port.
- `URAEDA_ALLOWED_HOSTS` lists the host names it accepts besides 127.0.0.1, like your machine's full
  name on your tailnet, `mac.tail1234.ts.net`.

Vite checks host names and takes its port before the settings file is read. So under `vp dev`, they
come from these variables only. The server listens on 127.0.0.1 only: `tailscale serve --bg 4310`
reaches it from your phone, at `https://mac.tail1234.ts.net/`.

The npm package reads no `.env`: its settings come from its flags, its environment, and your
settings file, as [the web UI's page](docs/web-ui.md#settings) says.

## Claude Code's integration

When Claude Code changes and sessions break, `vp run validate:claude` checks the integration against
the installed `claude`, with a few short sessions.

## The README's screenshots

The README shows Home, a round of questions, and a spec of the sandbox's realistic project, at a
desktop's and a phone's width, in both themes. After a change to how these pages look, take them
again:

```sh
vp run readme:screenshots
```

It builds the realistic project afresh, and writes the 12 WebP files of `docs/images/screenshots/`.

## Releasing

On an up-to-date `main`, `vp run release` writes the notes in `CHANGELOG.md`, sets the version,
tags, and pushes:

```sh
vp run release 0.5.0
```

## Licenses

The code is under the [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE) licenses, at your option.

The web UI bundles the [Monaspace](https://github.com/githubnext/monaspace),
[Atkinson Hyperlegible Next](https://github.com/googlefonts/atkinson-hyperlegible-next),
[Literata](https://github.com/googlefonts/literata),
[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono), and
[Inter](https://github.com/rsms/inter) fonts, under the SIL Open Font License 1.1. It takes its
colours from [Catppuccin](https://github.com/catppuccin/catppuccin), under the MIT license.

The harnesses' marks are [Codicons](https://github.com/microsoft/vscode-codicons)' drawings, by
Microsoft, under the Creative Commons Attribution 4.0 license (CC BY 4.0). The app's other icons are
[Lucide](https://lucide.dev)'s, under the ISC license.
