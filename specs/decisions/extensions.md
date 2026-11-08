---
status: proposed
approved-by:
icon: plug
---

# Extensions

Extensions are the owner's own code, which adds to or replaces any part of Uraeda's server and web
UI, Uraeda's own places and agent runtimes included. They load only from the owner's config folder,
Uraeda builds and reloads them, and they run with the owner's rights. Where they come from is the
guard, not a sandbox.

## Rules

- Extensions MUST load only from the config folder, never from a repository. Checked by the loader's
  tests.
- Uraeda's own places and agent runtimes MUST be built on the same extension API as the owner's,
  each one able to be turned off.
- An extension MUST NOT need a build step or a package install from its author. Checked by the
  loader's tests.
- A changed extension MUST reload without a server restart, undoing everything it registered first.
  Checked by the loader's tests.
- A broken extension MUST NOT stop Uraeda or another extension from running. Checked by the loader's
  tests.
- Extension code MUST reach the server only through `ura`, pinned to a commit, never fetched by the
  server.
- Extension pages SHOULD draw with the app's design system and theme, so they look like the rest of
  the app.
- Extensions MAY run code on Uraeda's events, and add instructions to the agent's runs.

## Why

An agent writes an extension in minutes, so any part of Uraeda can be changed or turned off without
forking it. The agent already runs commands as the owner, so a sandbox around extensions would
protect little. What protects the owner is that code arrives only by their hand, pinned, and never
from a cloned repository. A build or a restart would slow the extensions written on the spot.
History: [Extensions system](../2026-11-08-extensions-system/spec.md).

## Alternatives considered

- Extension pages in sandboxed frames: safer, but they never look like the app, and keys and focus
  cross a frame.
- Extensions committed in a repository, after a trust prompt: shared by a team, but one yes lets the
  repository's authors run code as the owner.
- Workflows as WASM extensions, run by `ura` too: postponed; the workflow stays Uraeda's own.

## Consequences

- An extension can do anything the owner can in Uraeda: commit, run agents, and read every
  registered repository.
- The web UI's package and the binding grow by the compilers that build extensions.
- A new place, runtime, or event of Uraeda is written as a built-in extension.
- A change to the extension API turns the owner's extensions off until they are updated.

## Applies to

- [`packages/server/`](/packages/server/) and [`packages/web/`](/packages/web/), and every feature
  that adds a place, an agent runtime, an event, or a setting
- [`crates/binding/`](/crates/binding/), which compiles extensions, and
  [`crates/cli/`](/crates/cli/), which installs them
