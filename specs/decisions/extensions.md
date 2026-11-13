---
icon: plug
---

# Extensions

> "With LLMs, it’s trivial to extend software. So software should be expandable."

An extension is the owner's own code, which adds a place, an agent, or a reaction to an event to
Uraeda's server and app. It runs with the owner's rights: where it comes from is the guard.

## Rules

- Extensions load only from the owner's config folder, never from a repository, and the server never
  fetches their code. _So:_ a page is built from its extension's folder alone, and code from
  elsewhere is installed by the owner with `ura`, pinned to a commit.
- An extension runs from its source and reloads on a save, with no build step, package install, or
  restart asked of its author. _So:_ an extension that needs a bundler before it runs is Uraeda's
  bug to fix. Every session is told where the extension API's documentation is, so the owner can ask
  any session for one.
- A broken extension never stops Uraeda or another extension. _So:_ an extension reads a file of 64
  MB at most, since a larger one could use up the server's memory and take every extension and
  session down.
- Extensions never depend on each other: they use only the contracts Uraeda owns, like an agent's,
  its events, and its data records. _So:_ usage is one contract every agent fills, never a second
  extension tied to Claude Code's.
- Extensions never add instructions to the agent's runs. _So:_ the first spec let an extension add
  them, and it was cut: what an agent is told comes from the skill and from Uraeda's own messages.
- Uraeda's own places and agents follow the same contracts as the owner's extensions, each one able
  to be turned off. _So:_ the inbox is declared through the page API and has its off switch, though
  its screen is the app's own code.

## Why

An agent writes an extension in minutes, so any part of Uraeda can be changed or turned off without
forking it. A build step or a restart would slow extensions written on the spot. The agent already
runs commands as the owner, so limits on an extension protect little: what protects the owner is
that code never comes from a cloned repository. Instructions added to runs would reach only the runs
Uraeda starts, and split the workflow between the skill and the app. History:
[Extensions system](../done/2026-11-08-extensions-system.md).

## Alternatives considered

- Extensions committed in a repository, after a trust prompt: shared by a team, but one yes lets the
  repository's authors run code as the owner.
- Workflows as extensions: postponed, and the workflow stays Uraeda's own.

## Applies to

- [`crates/server/`](/crates/server/) and [`app/`](/app/), and every feature that adds a place, an
  agent, an event, or a setting
- [`crates/cli/`](/crates/cli/), which installs extensions

## Revisit when

The human decides whether Uraeda keeps its own server and app, or sits on another orchestrator with
its skill, its CLI, and a small view: they asked on 2026-11-13 how much it needs extensions, and it
is open. Or workflows become extensions, which may let one add instructions.
