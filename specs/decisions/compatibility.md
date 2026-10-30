---
status: active
approved-by: mrtolkien
icon: history
---

# Compatibility

Until Uraeda reaches version 1.0, its formats change without keeping the old ones working. A change
to a workflow file's format, a template, or a rule of `ura check` applies to every file at once: the
code reads only the new format, and old files are updated, or fail `ura check` until they are.

## Rules

- Before version 1.0, a format change MUST NOT keep the old format working: no fallback reading, no
  migration code. Checked by review.
- A feature that changes a format MUST update the templates, examples, fixtures, and default-branch
  files it affects, in the same branch. Checked by `ura check`.
- An agent that finds a file failing `ura check` because its format changed MUST rewrite it in the
  new format, keeping its content and the human's words, before its step goes on. Checked by
  `ura check`.
- Files on other branches in flight MAY fail `ura check` after a merge, until their branch catches
  up. Checked by review.

## Why

Uraeda is a proof of concept whose formats change feature after feature. Code reading old formats
would grow with each change, for files that live a few days on a branch. An agent meeting an old
file fixes it, rather than working around it. History:
[Redesign clarifications](../done/2026-10-17-redesign-clarifications.md).

## Consequences

- Format changes stay small: one reader, one template, no versions.
- A branch in flight when a format changes fails `ura check` until it catches up with the default
  branch, and the agent running its next step rewrites its files.
- Records in `specs/done/` are not converted: they are history, read by humans.

## Applies to

- The skill's [templates](/skills/uraeda/assets/templates/) and
  [examples](/skills/uraeda/assets/example/), the core's parsers and checks in
  [`crates/core/`](/crates/core/), and every feature that changes a workflow file's format

## Revisit when

Uraeda's version 1.0 is released.
