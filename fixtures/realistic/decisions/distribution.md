---
icon: package
---

# Distribution

> "One small package, on my own Node."

## Rules

- The web UI ships as a self-contained npm package that runs on the user's own Node, the native
  binding in one package per platform. _So:_ no bundled runtime, and no single executable.
- The package runs no install script, downloads nothing when it runs, and reads no `.env` file.
  _So:_ its settings come only from the sources the [settings](settings.md) decision names.
- The CLI and the web UI are released together, from one tag, with one version, from CI. _So:_ no
  long-lived npm token.
- A release that fails part way is completable at the same version. _So:_ no version is skipped.

## Why

An npm package weighs about 3.5 MB on stable tooling, where single executables weighed 90 MB and
more. An npm release can be neither replaced nor published at once, so a failed one must be
finishable. History: [Run UI](../done/2026-10-14-run-ui.md).

## Alternatives considered

- A single executable built with Node or Bun: 159 MB on experimental tooling.
- An Electron desktop app: signing, an updater, and the phone still needing the server.

## Applies to

- `packages/uraeda/`, [`packages/binding/`](/packages/binding/),
  [`packages/server/src/`](/packages/server/src/), [`.github/workflows/`](/.github/workflows/), and
  every feature that adds a file the server reads at run time, or changes how Uraeda is released

## Revisit when

Node's single executable applications leave active development, or users ask to run Uraeda without
installing Node.
