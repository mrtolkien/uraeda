---
status: proposed
approved-by:
icon: package
---

# Distribution

The web UI and its server ship as one small npm package that users run on their own Node. The native
binding ships in one package per platform. `ura` keeps its own installers, and both are released
together, from one tag, with one version.

## Rules

- The web UI MUST ship as an npm package that runs on the user's own Node, not as a bundled runtime
  or a single executable. Checked by the package's smoke test.
- The package MUST be self-contained, with the native binding in one package per supported platform,
  and MUST NOT run install scripts or download anything when it runs. Checked by the package's smoke
  test.
- `ura` MUST stay separate from the web UI, installed on its own, and both MUST be released together
  from one tag with one version. Checked by the release workflow.
- Releases MUST be published from CI without a long-lived npm token, and a partial release MUST be
  completable at the same version. Checked by the release workflow and review.
- The packaged server MUST NOT read a `.env` file, taking settings only from the
  [settings](settings.md) decision's sources. Checked by the package's smoke test.

## Why

An npm package weighs 3.5 MB on stable tooling, where single executables weighed 90 MB and more
([how Uraeda ships](../done/2026-10-14-run-ui.md#q1-how-does-uraeda-ship)). `ura` stays separate so
the CLI needs no runtime
([whether `ura` starts the UI](../done/2026-10-14-run-ui.md#q2-does-ura-start-the-web-ui)). npm
releases are neither replaceable nor atomic, hence the gate and the order
([publishing to npm](../done/2026-10-14-run-ui.md#q6-how-are-releases-published-to-npm)). Run by
`npx` in a cloned project, a `.env` could widen the host names the server accepts.

## Alternatives considered

- A single executable built with Node or Bun: 159 MB on experimental tooling, or users on Bun while
  tests run on Node.
- An Electron desktop app: signing, an updater, and the phone still needing the server.
- The unscoped name `uraeda`: npm refused it as too close to `ramda`.

## Consequences

- Users need a recent Node, and `claude` for sessions.
- A release that fails half way leaves some platforms broken until it is completed.
- Every file the server later reads at run time joins the package.

## Applies to

- `packages/uraeda/`, [`packages/binding/`](/packages/binding/),
  [`packages/server/src/`](/packages/server/src/), [`.github/workflows/`](/.github/workflows/), and
  every feature that adds a file the server reads at run time, or changes how Uraeda is released

## Revisit when

Node's single executable applications leave active development, or users ask to run Uraeda without
installing Node.
