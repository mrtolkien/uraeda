---
status: active
approved-by: mrtolkien
icon: wrench
---

# Toolchain

Every check and build is a recipe of the [`justfile`](/justfile), run in the Nix dev shell, with
pinned tools. A task's recipe gives focused feedback after every task, and `just ready`, the full
check, runs before a push and in CI. A test is run again only when the machine was saturated.

## Rules

- `just ready` MUST run every check of the repository.
- A new language, crate, or tool MUST add its checks to `ready`.
- CI MUST run the same checks as `ready`, in the Nix dev shell.
- After every task, an agent MUST run the task's recipe, `just task <crates>` or `just task-app`:
  formatting, lints, and the tests of what the task touched.
- An agent MUST run `just ready` before pushing a branch, without the checks of replaced code that
  the feature's approved plan leaves out.
- A check or a build MUST NOT need Node, pnpm, or Vite+: a recipe calls Cargo, `nsh`, or a tool of
  the dev shell.
- Every tool MUST be pinned in the dev shell, with Rust tests run by cargo-nextest. Checked by CI.
- Tests MUST be isolated, so runs in several checkouts of one machine do not collide.
- A test that fails without a bug MUST be fixed in the pull request that finds it, never retried,
  except one that failed on a saturated machine: it is run again, at most twice, once the machine is
  quiet, or by its runner when it draws on a real display, and never hunted by loading the machine
  or looping the test.

## Why

Agents check their own work, and one command they cannot forget a part of keeps them honest. Running
it after every task cost minutes, so a task's recipe takes that place and the full one guards the
push. The app is Rust and TSX on Native Shell, not a JavaScript program: `just` over Cargo is
enough, and a new worktree needs no install. Retries hide real races, but a saturated shared machine
fails tests alone. History: [Fix testing](../done/2026-10-19-fix-testing.md).

## Alternatives considered

- `ready` after every task, the earlier rule: minutes per task.
- Vite+ as the task runner, with its cache: a Node toolchain, and an install in every worktree, for
  a Rust app.
- Retries reporting flaky tests: they hide real races.

## Consequences

- A task can break a test that only `ready` finds, before the push and further from its cause.
- No recipe keeps a cache of its own: a new worktree relies on the build cloned from the closest
  checkout, and reruns what Cargo cannot skip.
- Coverage is collected on demand only, outside `ready` and CI, and a drop fails no check: it can
  drop unnoticed.

## Applies to

- [`justfile`](/justfile), [`flake.nix`](/flake.nix), `app/nsh.json`,
  [`rust-toolchain.toml`](/rust-toolchain.toml), [`scripts/`](/scripts/),
  [`.config/nextest.toml`](/.config/nextest.toml), [`.github/workflows/`](/.github/workflows/), and
  every feature that adds a crate, a tool, or a test reading files outside its own crate
