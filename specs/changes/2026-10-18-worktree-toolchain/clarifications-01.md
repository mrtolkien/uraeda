---
status: awaiting-human
---

# Clarifications, round 01: Worktree toolchain fixes

> [!IMPORTANT]
>
> 2 questions, about 8 minutes.
>
> - Verdict: worth building as proposed, with the first item already fixed and committed. The two
>   others do not reproduce here, so each needs your say on how far to go without a reproduction.
> - The second question, the kills with code 137, has no cause found: the kernel log shows no
>   out-of-memory kill. A limit on concurrent runs would be a guess.
> - The baseline `vp run ready` of this branch failed 3 browser tests while other worktrees were
>   running, which may be the same overload.

## Context

### Goal

The [proposal](proposal.md) lists three problems of validating in several worktrees at once: the
main checkout's checks miss their cache after a worktree edit, a sweep of temporary folders fails
with `ENOTEMPTY`, and runs get killed with code 137.

### Today

**The cache misses are fixed.** `ts:check` and `specs:check` list `**` globs in
[`vite.tasks.ts`](/vite.tasks.ts), and Vite Task's globs match dot folders, so in the main checkout
every file under `.worktrees/` was an input. Both now exclude `.worktrees/**`, with a toolchain test
that failed before and passes now, in commit `1508d424`.

**The `ENOTEMPTY` does not reproduce.** [`sweep`](/scripts/test-run.ts) removes the folders of runs
whose script ended, and each run's guard removes its own folder when the run ends. Two processes
removing the same folder at once do not fail on their own: Node's recursive removal ignores a
missing entry. I ran 8 concurrent sweeps over 300 such folders, 2 times, and none failed. What can
fail is a removal while a process still writes into the folder, since a directory refilled after its
listing is not empty when removed. That is a hypothesis: no stack trace of the failure is in the
repository.

**The kills do not reproduce either.** Code 137 is `SIGKILL`. Two things in the toolchain send it:
the kernel's out-of-memory killer, and [`test-run.ts`](/scripts/test-run.ts)'s guard, which kills
the run's process group when Vite Task cancels the task, as it does to the others when one task
fails. The kernel log of the last three days shows no out-of-memory kill, and the machine has 31 GB
for 32 cores, with at most 4 Vitest workers per run.

### Scope

The two open items, and what the questions decide. The fixed item and the other tasks' inputs stay
as they are.

### Sources

- [`vite.tasks.ts`](/vite.tasks.ts) and [`scripts/test-run.ts`](/scripts/test-run.ts), with their
  [tests](/packages/server/src/__tests__/test-run.test.ts).
- The [toolchain](../../decisions/toolchain.md) decision, which asks for temporary folders tests
  remove and a shared limit on browser runs.
- Node's [`fs.rm`](https://nodejs.org/api/fs.html#fsrmpath-options), for what a recursive removal
  retries.

## Q1: How should the `ENOTEMPTY` of the sweep be fixed, with no reproduction?

Why it matters: a fix without a failing test breaks the usual rule of a change, so it needs your
agreement. It would cost little, and it would be checked only by the tests that exist now.

- **A (recommended). Harden the removal without a new test: a run claims a dead run's folder by
  renaming it first, which only one process can do, and removes it with retries.**
  - [pro] two sweeps never touch the same folder, and a folder still being refilled is retried.
  - [con] no failing test shows it fixes your case: a test can check the rename and the retries, not
    the race.
  - Why recommended: the change is small, inside `test-run.ts`, and it covers the likely causes.
- **B. Leave it, and send me the error's stack trace or its task output.**
  - [pro] the fix then targets the real cause, with a test that fails first.
  - [con] the problem stays until it happens again and you have kept the output.

**Answer:**

## Q2: What should be done about the runs killed with code 137?

The cause is unknown, so the options differ in what they assume.

Why it matters: a limit on runs makes validations wait for each other, which costs you time on every
run, for a cause not shown yet.

- **A (recommended). Do nothing yet: say which task was killed and when, and whether `dmesg` or
  `journalctl -k` showed the out-of-memory killer, and I fix it from that.**
  - [pro] no waiting added for a guess.
  - [con] the kills continue until then.
  - Why recommended: both causes above need a different fix, and a wrong one adds waiting for
    nothing.
- **B. Add a machine-wide limit of 2 concurrent `ts:check` and Rust runs, like the browser's lock.**
  - [pro] fewer heavy runs at once, whatever the cause.
  - [con] a change to the toolchain decision's rules for shared limits, and slower validations when
    worktrees overlap.
  - [con] it does not help if the kills come from Vite Task's cancellation.
- **C. Write what the guard does on cancellation to the run's output, so the next kill says who sent
  it.**
  - [pro] small, and gives the evidence A waits for.
  - [con] only helps the guard's case, not the kernel's.

**Answer:**

## Settled without the human

### Check these

- **The failing browser tests of the baseline** are not part of this change: the 3 tests of
  `story-embed.test.tsx` timed out in the `vp run ready` of this branch, while other worktrees were
  running. They are noted for the inbox with this change's slug if you want them tracked.

### Behaviour

- **A worktree edit** still reruns every check in that worktree, as before: only the main checkout's
  cache stops seeing it.

### Under the hood

- **The toolchain test's matcher** treats a leading dot like any name, as Vite Task does:
  `matchesGlob` skips dot folders under `**`, which hid this bug from the existing test.

**Notes:**
