---
status: proposed
approved-by:
icon: wrench
---

# Toolchain

A fast check gives focused feedback after every task, and names the broader checks it leaves to
`vp run ready`, the full check run before a push. Ready reruns only what a change can affect, and CI
runs the same checks uncached. Tools are pinned, tests are never retried, and React Compiler
optimizes the web UI.

## Rules

- `vp run ready` MUST run every check of the repository, rerunning only what a change can affect.
  Checked by the toolchain configuration's test.
- A new language, package, crate, or tool MUST add its checks to `ready`. Checked by the toolchain
  configuration's test.
- CI MUST run the same checks as `ready`, uncached, in the Nix dev shell. Checked by the toolchain
  configuration's test.
- After every task, the fast check MUST cover formatting, lint, types, and the affected focused
  tests and boundary checks, naming the broader checks it leaves to `ready`. Checked by review.
- An agent MUST run `vp run ready` before pushing a branch. Checked by review.
- Every tool and runtime MUST be pinned, with Rust tests run by cargo-nextest. Checked by review and
  CI.
- Tests MUST be isolated, so runs in several checkouts of one machine do not collide. Checked by the
  toolchain configuration's test.
- A test that fails without a bug MUST be fixed in the pull request that finds it, never retried.
  Checked by the toolchain configuration's test and review.
- The web UI MUST be compiled by React Compiler. Checked by review.
- New code SHOULD NOT memoize by hand for speed. Checked by review.

## Why

Agents check their own work, and one command they cannot forget a part of keeps them honest. Running
it after every task cost minutes, so a focused check takes that place and the full one guards the
push. Retries hide real races, and worktrees share one machine. An instrumented second run once
failed `main` after every check passed, so coverage is optional. React Compiler fixed typing lag on
every page at once. History: [Fix testing](../done/2026-10-19-fix-testing.md).

## Alternatives considered

- `ready` after every task, the earlier rule: minutes per task.
- Test selection inside `ready`: a green run could skip a test a change broke.
- Retries reporting flaky tests: they hide real races.

## Consequences

- A task can break a test that only `ready` finds, before the push and further from its cause.
- A task's inputs are a second list to keep with the code: a missing one reuses a stale result
  locally, caught only by CI.
- Coverage is collected on demand only, outside `ready` and CI, and a drop fails no check: it can
  drop unnoticed.
- A component that breaks the Rules of React is silently left uncompiled.

## Applies to

- [`package.json`](/package.json), [`vite.config.ts`](/vite.config.ts), [`flake.nix`](/flake.nix),
  [`rust-toolchain.toml`](/rust-toolchain.toml), [`scripts/`](/scripts/),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds a package, a crate, a
  tool, or a test reading files outside its own package
