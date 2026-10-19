---
status: active
approved-by: mrtolkien
icon: wrench
---

# Toolchain

One command checks the whole repository and reruns only what a change can affect, so an agent runs
it after every task without losing time. CI runs the same checks, so a green local run means a green
CI. Tools are pinned, tests are never retried, and the web UI is optimized by its compiler, not by
hand.

## Rules

- `vp run ready` MUST run every check of the repository, rerunning only what a change can affect,
  and a new language, package, crate, or tool MUST add its checks to it. Checked by the toolchain
  configuration's test.
- CI MUST run the same checks as `ready`, uncached, in the Nix dev shell. Checked by the toolchain
  configuration's test.
- Every tool and runtime MUST be pinned, and Rust tests MUST run under cargo-nextest. Checked by
  review and CI.
- Tests MUST be isolated, so runs in several checkouts of one machine do not collide. Checked by the
  toolchain configuration's test.
- Test runners MUST NOT retry a failed test, and a test failing without a bug MUST be fixed in the
  pull request that finds it. Checked by the toolchain configuration's test and review.
- The web UI MUST be compiled by React Compiler, and new code SHOULD NOT memoize by hand for speed.
  Checked by review.
- Coverage MAY be collected on demand, outside `ready` and CI, and a drop MUST NOT fail a check.
  Checked by review.

## Why

Agents check their own work, and one command they cannot forget a part of keeps them honest
([the single command](../done/2026-10-10-stack-decision.md#q9-which-single-command-runs-every-check)).
Caching, parallel CI jobs, nextest, and no retries fix slow and failing CI runs at their cause
([what fails on CI](../done/2026-10-14-testing-review.md#q2-what-happens-when-a-test-fails-without-a-bug)).
Worktrees share a machine, so runs must not collide. The
[October 17 CI review](/docs/testing-review-2026-10-17.md) found that an instrumented second run
could fail `main` after every check passed, so coverage became optional. React Compiler fixed typing
lag on every page at once
([the comment lag](../done/2026-10-14-text-inputs.md#q7-should-the-comment-lag-be-fixed-in-the-review-page-or-for-the-whole-ui)).

## Alternatives considered

- A `justfile` with a `ready` recipe: a second entry point next to `vp`.
- `cargo test`: tests share a process, so they race, and a hung test hangs the run.
- Retries reporting flaky tests: they hide real races.
- Memoizing slow pages by hand: one page at a time.

## Consequences

- A task's inputs are a second list to keep with the code: a missing one reuses a stale result
  locally, caught only by CI.
- Coverage, on demand only, can drop unnoticed.
- A component that breaks the Rules of React is silently left uncompiled.

## Applies to

- [`package.json`](/package.json), [`vite.config.ts`](/vite.config.ts), [`flake.nix`](/flake.nix),
  [`rust-toolchain.toml`](/rust-toolchain.toml), [`scripts/test-run.ts`](/scripts/test-run.ts),
  [`packages/web/vite.config.ts`](/packages/web/vite.config.ts),
  [`.github/workflows/`](/.github/workflows/), and every feature that adds a package, a crate, a
  tool, or a test reading files outside its own package
