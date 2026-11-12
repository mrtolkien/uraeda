---
status: active
approved-by: mrtolkien
icon: history
---

# Compatibility

Uraeda's formats change without keeping the old ones working. A change to a workflow file's format,
a template, or a rule of `ura check` applies to every file at once: the code reads only the new
format, and old files are updated, or fail `ura check` until they are. The extension API has one
version at a time, and an extension built for another is turned off.

## Rules

- A format change MUST NOT keep the old format working: no fallback reading, no migration code.
- A feature that changes a format MUST update the templates, examples, fixtures, and default-branch
  files it affects, in the same branch. Checked by `ura check`.
- An agent that finds a file failing `ura check` because its format changed MUST rewrite it in the
  new format, keeping its content and the human's words, before its step goes on. Checked by
  `ura check`.
- A release that changes a format MUST name the change in its changelog.
- An extension built for another version of the extension API MUST be turned off, with a message
  saying why. Checked by the loader's tests.
- Files on other branches in flight MAY fail `ura check` after a merge, until their branch catches
  up.

## Why

Code reading old formats would grow with each change, while an agent rewrites an old file in
seconds. An agent meeting an old file fixes it, rather than working around it. A changelog entry
tells other people's repositories what their agent will rewrite. The owner's extensions are few, and
an agent updates them faster than Uraeda could keep old APIs. History:
[Extensions system](../done/2026-11-08-extensions-system.md).

## Alternatives considered

- Format changes only in a major release, each with a migration: no repository breaks on a minor
  release, but migration code for every change.
- Keeping old extension API versions working, as Zed does: no extension turns off, but old API code
  grows with every version.

## Consequences

- Format changes stay small: one reader, one template, no versions.
- A branch in flight when a format changes fails `ura check` until it catches up with the default
  branch, and the agent running its next step rewrites its files.
- A repository is unreadable to the app after an upgrade, until an agent rewrites its files.
- Records in `specs/done/` are not converted: they are history, read by humans.

## Applies to

- The skill's [templates](/skills/uraeda/assets/templates/) and
  [examples](/skills/uraeda/assets/example/), the core's parsers and checks in
  [`crates/core/`](/crates/core/), and every feature that changes a workflow file's format
- The extension API, in [`crates/server/src/extensions/`](/crates/server/src/extensions/) and
  [`app/extensions/`](/app/extensions/)
