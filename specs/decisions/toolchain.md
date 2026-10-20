---
status: active
approved-by: mrtolkien
icon: wrench
---

# Toolchain

A fast check gives focused feedback after every task and names the broader checks deferred to ready.
Ready checks the whole repository before a push, rerunning only what a change can affect. CI runs
the same checks uncached. Tools are pinned, tests are never retried, and React Compiler optimizes
the web UI.

## Rules

- `vp run ready` MUST run every check of the repository, rerunning only what a change can affect,
  and a new language, package, crate, or tool MUST add its checks to it. Checked by the toolchain
  configuration's test.
- CI MUST run the same checks as `ready`, uncached, in the Nix dev shell. Checked by the toolchain
  configuration's test.
- After every task, fast MUST check formatting, lint, types, affected focused tests and boundary
  checks, and name broader checks deferred to ready. Checked by review.
- An agent MUST run `vp run ready` before pushing a branch. Checked by review.
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
Running it after every task cost minutes each time, so a fast check takes that place and the single
command guards the push
([the two loops](../2026-10-19-fix-testing/clarifications-01.md#q3-should-an-agent-run-a-fast-command-after-each-task-and-the-full-check-only-before-pushing)).
Relating every test through the whole app kept shared edits slow even after the suite shrank. The
human chose focused and boundary checks locally, with broad application journeys and browser checks
explicitly deferred to ready
([the fast check's scope](../2026-10-19-fix-testing/clarifications-02.md#q2-may-the-fast-check-defer-broad-application-journeys-while-running-affected-focused-tests-and-boundary-checks)).
Caching, parallel CI jobs, nextest, and no retries fix slow and failing CI runs at their cause
([what fails on CI](../done/2026-10-14-testing-review.md#q2-what-happens-when-a-test-fails-without-a-bug)).
Worktrees share a machine, so runs must not collide. The
[October 17 CI review](/docs/testing-review-2026-10-17.md) found that an instrumented second run
could fail `main` after every check passed, so coverage became optional. React Compiler fixed typing
lag on every page at once
([the comment lag](../done/2026-10-14-text-inputs.md#q7-should-the-comment-lag-be-fixed-in-the-review-page-or-for-the-whole-ui)).

## Alternatives considered

- `ready` after every task, the earlier rule: minutes per task while the suite was large.
- Test selection inside `ready` (`--changed`): a green run could skip a test a change broke.
- Every transitively affected application journey after every task: shared components still selected
  nearly the whole app; focused test boundaries and explicit deferral replace that promise.
- A `justfile` with a `ready` recipe: a second entry point next to `vp`.
- `cargo test`: tests share a process, so they race, and a hung test hangs the run.
- Retries reporting flaky tests: they hide real races.
- Memoizing slow pages by hand: one page at a time.

## Consequences

- A task can break a test that only `ready` finds, before the push and further from its cause.
- A green fast check is deliberately partial; its output identifies the broader validation still
  required before pushing.
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
