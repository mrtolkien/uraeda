---
icon: history
---

# Compatibility

> "it's really ok to break compatibility, no one really uses the tool atm … This is really, really
> early stage and I'm the only user. It's better to not make it too complex."

It holds for everything an earlier version of Uraeda wrote or served: the format of a workflow file,
the skill's templates, stored data, and the extension API, which the owner's own extensions are
built against.

## Rules

- A change never keeps the old way working: no fallback reading, no migration code, no second
  version of an API. _So:_ the Rust server did not import the run options the earlier server stored,
  and the extension API stayed version 1. An extension built for another version is turned off, with
  a message saying why.
- An agent that meets a workflow file in an old format rewrites it in the new one before its step
  goes on, keeping its content and the human's words. _So:_ a branch in flight when the format of
  rounds changed has its rounds rewritten by the next agent that works on it, without asking.

## Why

Code that reads old formats grows with every change, and makes the next change harder. An agent
rewrites an old file in seconds, and the owner's extensions are few. A break costs a file that fails
`ura check` until an agent fixes it, which is small while Uraeda has one user. History:
[Redesign clarifications](../done/2026-10-17-redesign-clarifications.md).

## Alternatives considered

- Format changes only in a major release, each with a migration `ura` runs: no repository breaks on
  a minor release, but migration code for every change.
- Old versions of the extension API kept working, as Zed does: no extension turns off, but old API
  code grows with every version.

## Applies to

- The skill's [templates](/skills/uraeda/assets/templates/) and
  [examples](/skills/uraeda/assets/example/), [`crates/`](/crates/), and every feature that changes
  a workflow file's format, stored data, or the extension API

## Revisit when

Someone other than its owner depends on Uraeda.
