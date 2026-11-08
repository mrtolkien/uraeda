---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Run options

## What

How each workflow step runs, set globally with per-feature overrides:

- One session for the whole feature, or a new session at each step
- Model and effort per step
- Review options: command, model, prompt, depth, number of reviewers

There should be two layers:

- Defaults, set in settings
- Per-feature/change/session options: at creation, it should be easy to change one of the values. Of
  course, this has to be doable with the keyboard.

## Why

Every step runs the same way today. Some steps need a stronger model or a clean context, others a
cheaper one.

## Notes

- Split from [Worker lifecycle](/specs/2026-11-03-worker-lifecycle/proposal.md).
- The settings page already lists these as planned rows, under Agents, Runs, and Reviews.
