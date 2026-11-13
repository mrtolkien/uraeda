---
icon: triangle-alert
---

# Problems

> "'Needs you' should mean I'm needed."

A problem stops the workflow: a feature's step cannot be found, or a human's answer is missing.
Everything else `ura check` finds is a note.

## Rules

- A check result is a feature's problem only when its rule stops the workflow, and a note otherwise,
  decided once, in the core. _So:_ a file still being written never reads as the feature's fault.
- Home and the sidebar's cards show problems only, and notes show only on their item's page. _So:_
  a format slip in a finished file shows on its page.
- `ura check` and editors keep reporting every result at its own severity. _So:_ an agent still sees
  a format slip as an error.

## Why

Home showed a feature building normally as needing the human, for format drift or files still being
written. A tool that cries wolf gets ignored. History:
[Redesign feature](../done/2026-10-18-redesign-feature.md).

## Alternatives considered

- Format rules turned into warnings in the core: agents and editors would stop seeing format slips
  as errors.

## Applies to

- [`crates/core/src/check/`](/crates/core/src/check/), and every feature that adds a rule to
  `ura check`
- [`packages/web/`](/packages/web/): Home, the sidebar, and the item pages
