---
icon: wrench
---

# Toolchain

> "single comment at root to run all tests and checks"

The human wrote "comment" for "command". That command is `just ready`, the full check. It is too
slow to run after every small change: "Remember that for you, writing code is cheap. Running 15
minutes tests on every small change is not." [The testing guide](../guides/testing.md) says which
recipe runs when.

## Rules

- `just ready` runs every check of the repository, and CI runs the same checks, in the same dev
  shell. _So:_ a feature that adds a tool adds its check to `ready` in the same branch. The linter
  of the GitHub workflows joined `just lint` that way.
- Every check and build is a recipe of the [`justfile`](/justfile), run in the Nix dev shell, where
  every tool is pinned. None needs Node, pnpm, or Vite+. _So:_ the pages' JavaScript and the
  Obsidian plugin are plain files with no build step, and a lint configuration that exists only as
  an npm package is not installed.
- The full check runs once for a feature or a change, at its end, before the push. It leaves out the
  checks of replaced code that the approved plan leaves out. While building, an agent runs only the
  checks of what it touched. _So:_ after a group of tasks merges, a build check runs in the
  background, and the next group starts at once.

## Why

Agents check their own work, and one command they cannot forget a part of keeps them honest. The
full check is slow: after every task, it adds hours to a feature and proves little. A task's own
checks answer in time to be useful, and the full one guards the push. The product is Rust, not a
JavaScript program. So `just` over Cargo is enough, and a new worktree needs no install. History:
[Fix testing](../done/2026-10-19-fix-testing.md).

## Alternatives considered

- The full check after every task, the earlier rule: it added an hour or more to each feature.
- Vite+ as the task runner, the earlier one: a Node toolchain, and an install in every worktree, for
  a Rust program.

## Applies to

- [`justfile`](/justfile), [`flake.nix`](/flake.nix), [`rust-toolchain.toml`](/rust-toolchain.toml),
  [`scripts/`](/scripts/), [`.github/workflows/`](/.github/workflows/), and every feature that adds
  a crate, a tool, or a check
