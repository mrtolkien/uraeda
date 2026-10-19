---
status: proposed
approved-by:
icon: triangle-alert
---

# Problems

A problem is something that stops the workflow: the step of a feature cannot be found, or a human's
answer is missing. Everything else `ura check` finds is a note, shown only on the item's own page.
"Needs you" then means the human, and drift between versions or a file still being written never
reads as the feature's fault.

## Rules

- A check result MUST count as a feature's problem only when its rule stops the workflow; every
  other result MUST be a note. Checked by the core's tests.
- Whether a rule stops the workflow MUST be decided once, in the core, never by a tool reading its
  results. Checked by the core's tests.
- Home and the sidebar's cards MUST show problems only, and notes MUST show only on their item's
  page. Checked by the UI tests.
- `ura check` and editors MUST keep reporting every result at its own severity: a note is the UI's
  reading of an error. Checked by the CLI's tests.
- A new rule of `ura check` SHOULD be a note, unless the workflow cannot go on without a fix.
  Checked by review.

## Why

Home put a feature building normally under "Needs you", with a red "Fix" badge, for errors its own
branch's build did not report: the server's build checked it with older templates
([what counts as a problem](../done/2026-10-18-redesign-feature.md#q9-what-should-count-as-a-features-problem)).
Over a day of commits, most snapshots of feature folders had such errors, almost all format drift or
files still being written ([problems found](../done/2026-10-18-redesign-feature.md)). Analysis tools
that cry wolf get ignored.

## Alternatives considered

- Problems only in the file waiting for the human: a drifted round still read as a problem on Home.
- Format rules turned into warnings in the core: agents and editors would stop seeing format slips
  as errors.

## Consequences

- "Needs you" and the "Fix" badge appear only when a human must act for the workflow to go on.
- A real format slip in a finished file shows only as a note on its page, until the next agent fixes
  it.

## Applies to

- [`crates/core/src/check/`](/crates/core/src/check/) and the core's feature view, and every feature
  that adds a rule to `ura check`
- [`packages/web/`](/packages/web/): Home, the sidebar, and the item pages
