---
icon: plug
---

# Extensions

Extensions are the owner's own code, which adds to or replaces any part of Uraeda's server and UI,
Uraeda's own places and agent runtimes included. They load only from the owner's config folder, for
every repository or some, Uraeda builds, signs, and reloads them, and they run with the owner's
rights. Where they come from is the guard: the limits on an extension only keep a broken one from
stopping the app.

## Rules

- Extensions MUST load only from the config folder, never from a repository. Checked by the loader's
  tests.
- Uraeda's own places and agent runtimes MUST follow the same contracts as the owner's extensions,
  each one able to be turned off.
- An extension MUST run from its source and reload on change, built and signed by Uraeda, with no
  build step, package install, or server restart of the owner's. Checked by the loader's tests.
- A broken extension MUST NOT stop Uraeda or another extension: its page runs in a view of its own,
  and its server part in a VM inside the server, each with limits on memory and time. Checked by the
  loader's tests.
- Extensions MUST NOT depend on each other: they use only the contracts Uraeda owns, like a
  runtime's, its events, and its data records.
- Extensions MUST NOT add instructions to the agent's runs.
- Extension code MUST reach the server only through `ura`, pinned to a commit, never fetched by the
  server.
- Extension pages SHOULD draw with the app's component library and theme, so they look like the rest
  of the app.
- A session SHOULD know where the extension API's documentation is, so an agent can write and change
  extensions.
- An extension MAY be on for every repository or only for some, with settings for each.

## Why

An agent writes an extension in minutes, so any part of Uraeda can be changed or turned off without
forking it. The agent already runs commands as the owner, so a sandbox would protect little: what
protects them is that code never comes from a cloned repository. Instructions added to runs would
split the workflow between the skill and the UI. A build step of the owner's would slow extensions
written on the spot. History: [Extensions system](../done/2026-11-08-extensions-system.md).

## Alternatives considered

- Extension pages in web views: any web library, but they never look like the app, and keys and
  focus cross a view.
- Extensions committed in a repository, after a trust prompt: shared by a team, but one yes lets the
  repository's authors run code as the owner.
- Workflows as WASM extensions, run by `ura` too: postponed; the workflow stays Uraeda's own.

## Consequences

- An extension can do anything the owner can in Uraeda: commit, run agents, and read every
  registered repository. So can any session, by writing one.
- The `ura` binary grows by the compiler that builds extensions.
- An extension's server part is TypeScript with only the modules Uraeda gives it: no Node, and no
  npm package.
- A change to the extension API turns the owner's extensions off until they are updated.

## Applies to

- `crates/server/` and `app/`, and every feature that adds a place, an agent runtime, an event, or a
  setting
- [`crates/cli/`](/crates/cli/), which installs extensions
