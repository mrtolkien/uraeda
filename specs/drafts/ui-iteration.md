---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# UI iteration flow

## What

A dedicated UI flow that focuses on iterating the UI _only_: a flow that's more visual instead of
textual, with small mockups in the page and A/B/C selection from visual elements.

## Why

I often have issues with agent-created code where it's mostly good but the UI needs a lot of small,
targeted fixes, and visual feedback.

## Notes

- Split out of
  [Add a bugfixing/low impact change flow](/specs/2026-10-15-add-bugfixing/proposal.md), Q1 of its
  first round: that feature builds the light flow for bugs and small changes, and this one builds on
  it.
- Its research on visual tools (v0, Lovable, Figma Make, Stitch, Claude Design, Cursor's design
  mode, preview comments, mapping an element to its code) is in the section "Visual iteration on UI"
  of that feature's first discovery:
  `git show 8c021f2:specs/2026-10-15-add-bugfixing/discovery-01.md`.
