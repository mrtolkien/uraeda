---
kind: feature
finished: 2026-10-15
---

# Record: Claude five-hour allowance

> [!NOTE]
>
> Implemented directly on main at the human's request.

## What and why

Implemented directly on main at the human's request. The sidebar's **Agents at work** section shows
the account's remaining Claude five-hour allowance below its feature and sub-agent rows.

## Behaviour

- An open runner reporting five-hour usage adds a remaining-allowance bar and a clock beside one
  line such as "57% left · reset 18:40". Reset time uses the local timezone and a 24-hour clock. At
  20% remaining or below, the bar turns red.
- The freshest report across all open runners and repositories wins; percentages are never added. A
  reporting chat can show the indicator even with no working features in the current repository.
- Missing, malformed, weekly-only and expired reports show no allowance. Closing or exiting a runner
  removes its report, falling back to another open runner's report when available.
- Usage and expiry update live without a reload. The collapsed sidebar hides the indicator; the
  phone's navigation drawer shows the same content as the expanded desktop sidebar.

## Design

Claude's existing stream-json output provides utilization and reset time. Its adapter normalizes
these into a usage event; the process manager keeps reports only in memory and publishes them
through the existing live Agent record. Nothing is added to the session transcript or SQLite. Astryx
supplies the bar, clock and layout, using the existing theme's tokens.

The change stays within the requested scope, adds no dependencies or workflow rules, accesses no
credentials, and introduces no constitution exceptions or new abstractions. Tests cover report
parsing, selection, exit, idle closure, expiry, placement, collapse and live updates. Browser checks
cover both sizes and themes, including accessibility and layout.

Screenshots of the sidebar at both sizes and in both themes were taken for the review and removed
once merged: `git log -- specs/done/2026-10-15-claude-usage/` finds them.
