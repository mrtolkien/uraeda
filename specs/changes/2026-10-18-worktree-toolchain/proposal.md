---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Worktree toolchain fixes

## What

- In the main checkout, ts:check and specs:check read .worktrees/ as inputs (their ** globs do not
  exclude it), so any worktree edit misses their cache there (vite.tasks.ts)
- Toolchain: scripts/test-run.ts's sweep of temporary folders races with other worktrees' runs
  (ENOTEMPTY), and browser and type-check runs get killed (137) when several worktrees validate at
  once.

## Why

## Notes
