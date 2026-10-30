---
status: active
approved-by: human
icon: package
---

# Distribution

The web UI and its server ship as one small npm package that users run on their own Node, with the
native binding in one package per platform. `ura` keeps its own installers. Both are released
together, from one tag, with one version.

## Rules

- The web UI MUST ship as an npm package that runs on the user's own Node, not as a bundled runtime
  or a single executable. Checked by the package's smoke test.
- The package MUST be self-contained, with the native binding in one package per supported platform.
  Checked by the package's smoke test.
- The package MUST NOT run install scripts, or download anything when it runs. Checked by the
  package's smoke test.
- The packaged server MUST NOT read a `.env` file, taking its settings only from the sources the
  [settings](settings.md) decision names. Checked by the package's smoke test.
- `ura` MUST be installed on its own, apart from the web UI. Checked by the release workflow.
- The CLI and the web UI MUST be released together, from one tag, with one version. Checked by the
  release workflow.
- Releases MUST be published from CI, without a long-lived npm token. Checked by the release
  workflow.
- A release that fails part way MUST be completable at the same version. Checked by review.

## Why

An npm package weighs about 3.5 MB on stable tooling, where single executables weighed 90 MB and
more. `ura` stays apart, so the CLI needs no runtime. An npm release can be neither replaced nor
published at once, so a failed one must be finishable. A `.env` in a cloned project could widen the
host names the server accepts. History: [Run UI](../done/2026-10-14-run-ui.md).

## Alternatives considered

- A single executable built with Node or Bun: 159 MB on experimental tooling, or users on Bun while
  tests run on Node.
- An Electron desktop app: signing, an updater, and the phone still needing the server.
- The unscoped npm name `uraeda`: npm refused it as too close to `ramda`.

## Consequences

- Users need a recent Node, and `claude` for sessions.
- A release that fails part way leaves some platforms broken until it is completed.
- Every file the server reads at run time joins the package.

## Applies to

- `packages/uraeda/`, [`packages/binding/`](/packages/binding/),
  [`packages/server/src/`](/packages/server/src/), [`.github/workflows/`](/.github/workflows/), and
  every feature that adds a file the server reads at run time, or changes how Uraeda is released

## Revisit when

Node's single executable applications leave active development, or users ask to run Uraeda without
installing Node.
