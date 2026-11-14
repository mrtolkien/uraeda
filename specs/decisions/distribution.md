---
icon: package
---

# Distribution

> "I want the CLI to be simple to install even without a package manager. Ideally it should compile
> to a small native binary."

Uraeda ships as that binary, `ura`: the CLI, the pages of `ura serve`, and the Obsidian plugin the
vault's sync carries to the phone, all inside it. A runtime is a program the user must install
first, like Node.

## Rules

- Installing Uraeda needs no runtime and no package manager. _So:_ `ura serve` embeds its JavaScript
  and CSS, and fetches nothing when it runs. A release has a shell installer, and Homebrew is one
  more way to install, never the only one.
- The binary stays as small as possible while bringing in necessary features, and no size limit
  fails a build. _So:_ a feature that adds a dependency measures what it adds: a fix that cost 78 KB
  lost to one that cost nothing.
- Everything a release ships is inside `ura`, released from one tag, with one version. _So:_ the
  phone's Obsidian plugin is written into the vault by the `ura` that serves it, and reaches the
  phone through the sync, never through a store of its own.
- A release is published by CI, from its version tag. _So:_ nobody publishes from their own machine,
  and a branch that edits the release workflow cannot publish.

## Why

One binary installs in one step, and its pages and plugin cannot mismatch the commands that write
the same files. A size limit turns every dependency into an argument with a number, and stops a
build for a few kilobytes: judgement keeps the binary small. Publishing from CI, on a tag, means
users install what the repository holds. History: [Run UI](../done/2026-10-14-run-ui.md).

## Alternatives considered

- A fixed size limit in CI, the earlier way: raised once, then asked about again by the next feature
  that added a dependency.
- The human's approval of every measured growth: it stopped a build for 36 KB.
- An npm package run on the user's Node, the earlier way: a runtime nothing else in Uraeda needs.

## Applies to

- [`crates/cli/`](/crates/cli/), [`crates/serve/`](/crates/serve/),
  [`crates/vault/`](/crates/vault/), [`.github/workflows/`](/.github/workflows/),
  [`dist-workspace.toml`](/dist-workspace.toml), and every feature that adds a dependency or changes
  how Uraeda is installed or released
