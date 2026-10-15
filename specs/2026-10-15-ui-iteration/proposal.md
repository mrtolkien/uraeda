---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# UI iteration flow

## What

A dedicated UI flow that focuses on iterating the UI: a flow that's more visual instead of textual,
with small mockups in the page and A/B/C selection from visual elements.

There should be a focus on showing interactions and true interfaces: HTML-only mockups end up pretty
far from the actual results. With Astryx in the current project for example, it should be easy to
create fast mockups. To do that, we should also push the app to have a stable, fixed mock
environment for UI tests.

Can be coupled with the clarifications step, or with specs to show what's planned.

## Why

I often have issues with agent-created code where it's mostly good but the UI needs a lot of small,
targeted fixes, and visual feedback.

## Notes

- Split out of [Add a bugfixing/low impact change flow](/specs/done/2026-10-15-add-bugfixing.md), Q1
  of its first round: that feature builds the light flow for bugs and small changes, and this one
  builds on it.
- Its research on visual tools (v0, Lovable, Figma Make, Stitch, Claude Design, Cursor's design
  mode, preview comments, mapping an element to its code) is in the section "Visual iteration on UI"
  of that feature's first discovery:
  `git show 8c021f2:specs/2026-10-15-add-bugfixing/discovery-01.md`.
- Make sure we don't overfit to ureadea itself, there are two different things at play here
  - We want a UI iteration flow for ALL REPOSITORIES USING URAEDA, whatever their stack. This means
    dedicated components and views and a clear flow and organization for it. We could for example
    push for a stable mock "dev env" for this step, whatever the project.
  - We _also_ want it to be good locally, for developing uraeda itself: there we could directly use
    Astryx if it makes sense.
