---
icon: history
---

# Compatibility

> "Until 1.0, break the formats freely."

## Rules

- A format change keeps no old format working. _So:_ no fallback reading, no migration code.
- A feature that changes a format updates the templates, examples, fixtures, and default-branch
  files in the same branch. _So:_ `ura check` passes on the default branch after the merge.
- An agent that finds a file in an old format rewrites it, keeping the human's words. _So:_ it never
  works around the old file.

## Why

Uraeda is a proof of concept whose formats change feature after feature. Code reading old formats
would grow with each change, for files that live a few days on a branch. History:
[Redesign clarifications](../done/2026-10-17-redesign-clarifications.md).

## Applies to

- The skill's [templates](/skills/uraeda/assets/templates/) and
  [examples](/skills/uraeda/assets/example/), the core's parsers and checks in
  [`crates/core/`](/crates/core/), and every feature that changes a workflow file's format

## Revisit when

Uraeda's version 1.0 is released.
