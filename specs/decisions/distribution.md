---
status: active
approved-by: mrtolkien
icon: package
---

# Distribution

The web UI and its server ship as one small npm package that users run on their own Node. The native
binding ships in one package per platform, as napi-rs projects ship. `ura` keeps its own installers,
and both are released together, from one tag, with one version.

## Rules

- Every npm package MUST be published under the `@uraeda` organization, and `@uraeda/ui` MUST
  require Node 24 or later and MUST NOT bundle a Node runtime. Checked by the package's smoke test.
- The binding MUST ship as one package per release platform, Linux x64 and arm64 (glibc) and macOS
  x64 and arm64, named as napi-rs generates them, each in `@uraeda/ui`'s `optionalDependencies` at
  its exact version. Checked by the release gate.
- The packages MUST NOT run install scripts or download anything when they run. Checked by review.
- `@uraeda/ui` MUST be self-contained: the bundled server, the built web UI, the skill as the
  agents' plugin, and napi-rs's loader, unchanged. Checked by the package's smoke test.
- One module MUST find the server's plugin, web UI, and checkout, in both the checkout's and the
  package's layout, and other modules MUST NOT build these paths. Checked by review and the module's
  tests.
- The packaged server MUST NOT read a `.env` file, taking settings only from the
  [settings](settings.md) decision's sources. Checked by the package's smoke test.
- CI MUST publish the packages from the tag that releases `ura`, at the Cargo workspace's version,
  through npm's trusted publishing, and the repository MUST NOT hold an npm token. Checked by the
  release workflow and review.
- A release MUST publish the platform packages first, only once every binary is built and the smoke
  tests pass, and complete a partial release at the same version. Checked by the release workflow.

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

- Users need Node 24 or later, and `claude` for sessions.
- A release that fails half way leaves some platforms broken until it is completed.
- Every file the server later reads at run time joins the paths module and the package.

## Applies to

- `packages/uraeda/`, [`packages/binding/`](/packages/binding/),
  [`packages/server/src/`](/packages/server/src/), [`.github/workflows/`](/.github/workflows/), and
  every feature that adds a file the server reads at run time, or changes how Uraeda is released

## Revisit when

Node's single executable applications leave active development, or users ask to run Uraeda without
installing Node.
