---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/38
---

# Record: Worktree toolchain fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/38). Its full files are
> in git: `git log -- specs/changes/2026-10-18-worktree-toolchain/`.

## What and why

Validating in several worktrees at once went wrong in three ways: the main checkout's `ts:check` and
`specs:check` missed their cache after any worktree edit, the sweep of temporary folders failed with
`ENOTEMPTY`, and runs were killed with code 137.

## Behaviour

- In the main checkout, an edit under `.worktrees/` no longer invalidates `ts:check` or
  `specs:check`.
- The sweep of dead runs' temporary folders retries a removal, and leaves a folder it cannot remove
  for the next run, instead of failing the run.
- `ts:check`, `rust:clippy`, and `rust:test` wait for a free one of two machine-wide slots, across
  every checkout, like the browser tests.

## Design

Root causes: both checks had `**` globs, and Vite Task's globs match dot folders, so every
worktree's files were inputs: both now exclude `.worktrees/**` in [`vite.tasks.ts`](/vite.tasks.ts).
The toolchain test's matcher, `matchesGlob`, skipped dot folders, which hid it: it now treats a
leading dot as a name, in [`toolchain.test.ts`](/packages/server/src/__tests__/toolchain.test.ts).

The `ENOTEMPTY` and the kills did not reproduce, and no out-of-memory kill showed in the kernel log.
The sweep's removal in [`test-run.ts`](/scripts/test-run.ts) now retries and tolerates failure, with
no new test. The heavy lock reuses `test-run.ts`'s `--lock`, as the `heavyRun` constant of
`vite.tasks.ts`.

## Questions

### Round 01

#### Q1: How should the `ENOTEMPTY` of the sweep be fixed, with no reproduction?

**Answer:** Low impact: "Do what make code simplest", with no new test, and no inbox note.

#### Q2: What should be done about the runs killed with code 137?

**Answer:** B. A machine-wide limit of 2 concurrent type-check, lint, and Rust-test runs.

## Decisions

- [Toolchain](../decisions/toolchain.md): its shared-limit rule now covers type checks, lints, and
  Rust tests, besides the browser runs.

## Follow-ups

- The cause of the kills is unproven: if they continue, the guard's cancellation and the kernel's
  out-of-memory killer are the two suspects.
