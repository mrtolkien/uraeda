---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Priorities and decisions pages fixes

## What

- Decisions page: when the default branch is checked out nowhere, a decision's links are checked
  against the current checkout, not the default branch's tree, so a valid link can read as broken
- Discard keeps a priority's draft on disk when the line's children changed since the last commit
- The decisions page runs one git log per decision, and the watch reads every decision on each pass

## Why

## Notes
