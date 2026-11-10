---
status: active
approved-by: mrtolkien
icon: package
---

# Distribution

Uraeda ships as one binary, `ura`, which holds the CLI and the server and serves the web build, and
as an app for each platform it supports. Users install no runtime. Everything is released together,
from one tag, with one version.

## Rules

- `ura` MUST hold the CLI and the server in one binary that needs no runtime. Checked by the release
  workflow.
- `ura serve` MUST serve the web build it ships with, downloading nothing when it runs. Checked by
  the server's tests.
- An app MUST ship in a form its platform installs without a tool of Uraeda's own. Checked by the
  release workflow.
- The server MUST read a `.env` file only from the config folder, for secrets, never from a project
  or the folder it runs in. Checked by the server's tests.
- The binary and the apps MUST be released together, from one tag, with one version. Checked by the
  release workflow.
- Releases MUST be published from CI, without a long-lived token. Checked by the release workflow.
- A release that fails part way MUST be completable at the same version.

## Why

One binary installs in one step, and its CLI cannot mismatch its server. The app is a client that
starts `ura serve` when none runs, so both share a version. Each platform has its own way to install
an app, so no format is fixed here. A `.env` in a cloned project could widen the host names the
server accepts, so secrets live only in the owner's config folder. History:
[Run UI](../done/2026-10-14-run-ui.md).

## Alternatives considered

- An npm package run on the user's Node, the earlier way: a runtime nothing else in Uraeda needs.
- Flatpak, or one package per distribution: a sandbox to fit, or many packages to keep.
- The app holding a server of its own: two servers once the CLI serves too.

## Consequences

- Users need `claude` or `codex` for sessions.
- A phone or a second machine uses the web build until it has an app.
- The binary grows by the web build and by the compiler that builds extensions.
- Nothing updates itself: the user installs each release.

## Applies to

- [`crates/cli/`](/crates/cli/), `crates/server/`, `app/`,
  [`.github/workflows/`](/.github/workflows/), and every feature that adds a file the server reads
  at run time, or changes how Uraeda is released

## Revisit when

Users ask for a distribution's own package, or for an app that updates itself.
