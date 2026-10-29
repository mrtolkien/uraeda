---
status: proposed
approved-by:
icon: triangle-alert
---

# Problems

A problem is something that stops the workflow: a feature's step cannot be found, or a human's
answer is missing. Everything else `ura check` finds is a note, shown only on the item's own page.
"Needs you" then means the human, and a file still being written never reads as the feature's fault.

## Rules

- A check result MUST count as a feature's problem only when its rule stops the workflow, and as a
  note otherwise. Checked by the core's tests.
- Whether a rule stops the workflow MUST be decided once, in the core, never by a tool reading its
  results. Checked by the core's tests.
- Home and the sidebar's cards MUST show problems only. Checked by review.
- Notes MUST show only on their item's page. Checked by review.
- `ura check` and editors MUST keep reporting every result at its own severity: a note is the web
  UI's reading of an error. Checked by the CLI's tests.
- A new rule of `ura check` SHOULD report a note, unless the workflow cannot go on without a fix.
  Checked by review.

## Why

Home showed a feature building normally as needing the human, for errors that were format drift or
files still being written. A tool that cries wolf gets ignored, so "Needs you" is kept for what
truly blocks the workflow. The core decides once, so every tool reads results the same way. History:
[Redesign feature](../done/2026-10-18-redesign-feature.md).

## Alternatives considered

- Problems only in the file waiting for the human: a drifted round still read as a problem on Home.
- Format rules turned into warnings in the core: agents and editors would stop seeing format slips
  as errors.

## Consequences

- "Needs you" and the "Fix" badge appear only when a human must act for the workflow to go on.
- A real format slip in a finished file shows only as a note on its page, until the next agent fixes
  it.

## Applies to

- [`crates/core/src/check/`](/crates/core/src/check/), and every feature that adds a rule to
  `ura check`
- [`packages/web/`](/packages/web/): Home, the sidebar, and the item pages
