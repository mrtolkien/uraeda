---
icon: wrench
---

# Toolchain

> "One command I can trust before a push."

## Rules

- `vp run ready` runs every check of the repository, rerunning only what a change can affect, and
  CI runs the same checks uncached. _So:_ a new crate adds its checks to `ready`.
- After every task, a fast check covers formatting, lint, types, and the affected tests, and names
  what it leaves to `ready`. _So:_ an agent runs `ready` once, before its push.
- Every tool and runtime is pinned. _So:_ a check gives the same answer on every machine.
- A test is never retried. _So:_ a test that fails without a bug is fixed in the pull request that
  finds it.

## Why

Agents check their own work, and one command they cannot forget a part of keeps them honest.
Running it after every task cost minutes, so a focused check takes that place. Retries hide real
races. History: [Fix testing](../done/2026-10-19-fix-testing.md).

## Alternatives considered

- `ready` after every task, the earlier rule: minutes per task.
- Retries reporting flaky tests: they hide real races.

## Applies to

- [`package.json`](/package.json), [`vite.config.ts`](/vite.config.ts), [`flake.nix`](/flake.nix),
  [`rust-toolchain.toml`](/rust-toolchain.toml), [`scripts/`](/scripts/),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds a package, a crate, a
  tool, or a test reading files outside its own package
