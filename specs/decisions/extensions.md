---
status: active
approved-by: mrtolkien
icon: plug
---

# Extensions

Extensions are the owner's own code, which adds to or replaces any part of Uraeda's server and web
UI, Uraeda's own places and agent runtimes included. They load only from the owner's config folder,
for every repository or some, Uraeda builds and reloads them, and they run with the owner's rights.
Where they come from is the guard, not a sandbox.

## Rules

- Extensions MUST load only from the config folder, never from a repository. Checked by the loader's
  tests.
- Uraeda's own places and agent runtimes MUST be built on the same extension API as the owner's,
  each one able to be turned off.
- An extension MUST run from its source and reload on change, with no build step, package install,
  or server restart. Checked by the loader's tests.
- A broken extension MUST NOT stop Uraeda or another extension from running. Checked by the loader's
  tests.
- Extensions MUST NOT depend on each other: they use only the contracts Uraeda owns, like a
  runtime's, its events, and its data records.
- Extensions MUST NOT add instructions to the agent's runs.
- Extension code MUST reach the server only through `ura`, pinned to a commit, never fetched by the
  server.
- Extension pages SHOULD draw with the app's design system and theme, so they look like the rest of
  the app.
- A session SHOULD know where the extension API's documentation is, so an agent can write and change
  extensions.
- An extension MAY be on for every repository or only for some, with settings for each.

## Why

An agent writes an extension in minutes, so any part of Uraeda can be changed or turned off without
forking it. The agent already runs commands as the owner, so a sandbox would protect little: what
protects them is that code never comes from a cloned repository. Instructions added to runs would
split the workflow between the skill and the web UI. A build or a restart would slow extensions
written on the spot. History: [Extensions system](../2026-11-08-extensions-system/spec.md).

## Alternatives considered

- Extension pages in sandboxed frames: safer, but they never look like the app, and keys and focus
  cross a frame.
- Extensions committed in a repository, after a trust prompt: shared by a team, but one yes lets the
  repository's authors run code as the owner.
- Workflows as WASM extensions, run by `ura` too: postponed; the workflow stays Uraeda's own.

## Consequences

- An extension can do anything the owner can in Uraeda: commit, run agents, and read every
  registered repository. So can any session, by writing one.
- The web UI's package and the binding grow by the compilers that build extensions.
- A new place, runtime, or event of Uraeda is written as a built-in extension.
- A change to the extension API turns the owner's extensions off until they are updated.

## Applies to

- [`packages/server/`](/packages/server/) and [`packages/web/`](/packages/web/), and every feature
  that adds a place, an agent runtime, an event, or a setting
- [`crates/binding/`](/crates/binding/), which compiles extensions, and
  [`crates/cli/`](/crates/cli/), which installs them
