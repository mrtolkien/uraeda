---
discovery: medium
---

# Scheduled jobs

## What

Agent runs on a schedule, per repository: for example a daily dependencies upgrade and performance
pass.

## Why

Recurring upkeep should not wait for someone to start it.

## Notes

- Split from [Worker lifecycle](/specs/done/2026-11-03-worker-lifecycle.md).
- If you think it's better to add that after one of the running branches, which also touch agents
  options/triggering, tell me now and don't write down a clarifications step.
