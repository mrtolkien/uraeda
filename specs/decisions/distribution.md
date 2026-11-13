---
icon: package
---

# Distribution

> "I want the CLI to be simple to install even without a package manager. Ideally it should compile
> to a small native binary."

Uraeda ships as that binary, `ura`: it holds the CLI and the server, and serves the app to browsers.
It also ships as an app for each platform it supports. A runtime is a program the user must install
first, like Node.

## Rules

- Installing Uraeda needs no runtime and no package manager. _So:_ `ura serve` serves the web build
  it was compiled with and downloads nothing when it runs. The Linux app is a tarball and an
  AppImage, and Homebrew is one more way to install, never the only one.
- The binary stays as small as possible while bringing in necessary features, and no size limit
  fails a build. _So:_ a feature that adds a dependency measures what it adds: a fix that cost 78 KB
  lost to one that cost nothing.
- The binary and the apps are released together, from one tag, with one version. _So:_ the app is
  built by the release's own workflow: a failed app build releases nothing, never `ura` without its
  app.
- A release is published by CI, from its version tag. _So:_ nobody publishes from their own machine,
  and a branch that edits the release workflow cannot publish.

## Why

One binary installs in one step, and its CLI cannot mismatch its server. The app is a client that
starts `ura serve` when none runs, so a release holding only one of the two breaks the other. A size
limit turns every dependency into an argument with a number, and stops a build for a few kilobytes:
judgement keeps the binary small. Publishing from CI, on a tag, means users install what the
repository holds. History: [Run UI](../done/2026-10-14-run-ui.md).

## Alternatives considered

- A fixed size limit in CI, the earlier way: raised once, then asked about again by the next feature
  that added a dependency.
- The human's approval of every measured growth: it stopped a build for 36 KB.
- An npm package run on the user's Node, the earlier way: a runtime nothing else in Uraeda needs.

## Applies to

- [`crates/cli/`](/crates/cli/), [`crates/server/`](/crates/server/), [`app/`](/app/),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds a dependency or changes
  how Uraeda is installed or released
