---
reviewed: branch
commits: 573fd42811dfd36c1263938f479a7cbf10804ced..b4473d22efdcffa08d751944be01227688503bc7
---

# Findings: Scheduled jobs, the branch

## Claude Code · Fable 5.2

9 findings, most severe first:

1. `packages/server/src/jobs/accept.ts:67`: R43's `impossible()` lets every problem the core hides
   behind an unread schedule through, so a change can start for a job written as report only, or for
   one with no repository.

   Failure scenario: In `crates/core/src/jobs.rs`, `job()` keeps a type problem
   (`report_only is true or false.`) only when `check` succeeds; when the schedule fails, the
   schedule's problem replaces it, `schedule` is None and `report_only` falls back to false.
   `impossible` only refuses a problem when `job.schedule !== undefined`. So a job with
   `report_only = "true"` (text) and `schedule = "dayly 06:00"` is run with Run now, ends on a
   change offer, passes `impossible` and `job.reportOnly`, and `toChange` starts a branch and
   worktree for a job the human wrote as report only. Likewise a job whose `repositories` was
   emptied or made a non-list while its run worked: `check` fails before the schedule is read, and
   the offer is accepted. The old `job.problem !== undefined` refused all of these. The new accept
   test covers only a mistyped schedule, no prompt, and a problem with a schedule set.

2. `packages/server/src/jobs/accept.ts:62`: R42 gates only `runNow`: the acceptance never checks
   that the Jobs extension is still on in the repository, or that the job still names it, so a
   change still starts where "no job starts".

   Failure scenario: A run starts in notes by schedule or Run now; before it ends the human turns
   the Jobs extension off for notes, or removes notes from the job's `repositories`. The turn ends
   on a change offer, `accept()` reads only `impossible`, `reportOnly`, and the session's state, and
   `toChange` creates the change, branch, and worktree in notes. `accept` has no `isOn` or
   `job.repositories.includes` check.

3. `packages/server/src/jobs/starts.ts:88`: With R49's order the open folders are read before
   `#fresh`'s awaits, and `skipNow` treats a stale set as current: a change the job's run opened
   after the read is not in `open`, so the time is not skipped as `change-open`.

   Failure scenario: The job has an older, merged change, so `changeFolders` is non-empty and
   `openFor` reads the workspace, which does not list X yet. While `#fresh` awaits `jobs()`, the
   acceptance of the last run's offer finishes: the session is attached to new folder X and `busy`
   is released. `skipNow` then finds X in `folders` but not in the stale `open`, and returns
   undefined unless the session happens to read as working (for example its first turn in the
   worktree failed or was halted). A second run starts beside the open change. Only the
   `open === undefined` case is guarded; a folder that appeared in `changeFolders` since the read
   should count as open too.

4. `packages/server/src/jobs/scheduler.ts:409`: `#fail` records every throw of `startRun` as a
   permanent `failed` row, including throws that are not a failed start: a server stopping
   mid-start, or `startRun`'s own `mainRoot` before its row.

   Failure scenario: `stop()` aborts while a scheduled `startRun` is inside `newChat` or `send`, and
   the session layer rejects because the server is stopping. The catch writes a `failed` row with
   that text. After the restart the card's "Last run" reads "Could not start: <server stopped>" in
   the problem tone until another run starts, and the time is marked recorded, although R45 says a
   refusal of the reads before the start is not a failed start. No test covers a throw during a
   stop.

5. `packages/server/src/jobs/start.ts:36`: The tick on `settings.onRead` runs before the extensions'
   host has refreshed from the same read, so a job in a repository whose Jobs extension was just
   turned on is still first seen by the timer's tick.

   Failure scenario: `extensions/server.ts` registers `onRead(() => void host.refresh())`, which is
   async, and the new listener ticks in the same `#tell`. At 02:59:45 Jobs is turned on for notes:
   the tick's `isOn("notes")` still reads the old state, `#placeOf` returns undefined, and the job
   is not marked seen. The timer's tick at 03:00:10 sees it first, `due > first` is false, and the
   03:00 run is lost. This is the case R47 meant to close, for the extension's switch, which the
   test does not cover.

6. `docs/web-ui.md:875`: The "Scheduled jobs" section states the acceptance rule ambiguously, and
   the record's paragraph still describes rows as only "started or skipped".

   Failure scenario: "So does the offer of a job that has a problem other than its schedule when its
   run ends" follows "the turn the wakeup starts is read as any turn's end is", so "So does" reads
   as "is read / accepted", the opposite of the code, where it waits on its card. Around line 899
   the `job_runs` paragraph says "one row for each time a job was due ... started or skipped", with
   no `failed` row or `error`. "A key on either is refused" also overstates: `j`, `k`, Enter, and
   `a` are not refused, only the writes and `r`. `data-model.md`'s `at` still reads "when it
   started, or was skipped".

7. `packages/server/src/jobs/scheduler.ts:405`: The comment and R49 say nothing is awaited between
   the last guard and the start's row, but `startRun` awaits `sessions.mainRoot(repo)` before
   `cache.jobs.add`; it holds only because `#roots` is already cached.

   Failure scenario: Today the await is a few microtasks, since `#run` called `mainRoot` with the
   same path. If that cache is ever invalidated or keyed differently, the await becomes real git I/O
   between `skipNow`/`#on()` and the row, and reopens the window R49 closed (a pause, the switch, an
   acceptance entering `busy`). No test would notice. Passing the `root` that `#run` already holds
   into `startRun` removes the dependency.

8. `packages/server/src/jobs/scheduler.ts:388`: A start that is not spaced reads the workspace twice
   in a row: `skipOf` at line 365 awaits `openFor`, and line 388 awaits it again with nothing but
   synchronous code between.

   Failure scenario: Every first start of a drain, for a job that has a change folder, runs
   `binding.readWorkspace` twice back to back. The folders from the first read could be kept and
   passed to `skipNow` when `spaced` is false, and re-read only after the minute's wait.

9. `packages/server/src/jobs/guards.ts:37`: After R44's early return on `sessions.wakeup(session)`,
   the `wakeup: sessions.wakeup(session)` passed to `statusOf` is always false, and the "Change no
   file." sentence is repeated in both branches of `jobMessage`.

   Failure scenario: Dead state in `works`: the second `wakeup` read can never be true, and suggests
   the status still decides on it. In `runner/message.ts` the rule R48 made common to every run is
   written twice, so an edit to one branch can drop it again, which is the bug R48 fixed. Hoist it
   before the conditional.

## Codex · GPT-6.1-Sol

The fixes leave an acceptance eligibility hole, an asynchronous gap before the start row, and
failure visibility that does not survive pruning. Targeted reproductions confirmed these gaps; the
prescribed test run was blocked by the read-only Nix cache.

Full review comments:

- [P2] Reject non-schedule problems when accepting an offer —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/accept.ts:67-67
  If the human removes every repository from a job while its run works, the core returns
  `problem: "A job runs in one repository at least."` and no parsed schedule. `impossible()` treats
  that missing schedule as a schedule-only problem and returns undefined, so this replacement now
  accepts the offer and starts a change despite the invalid job. R43 permits only schedule problems.
  Explicitly distinguish schedule errors from other problems, and add an acceptance test using this
  actual core result; the new non-schedule test retains a parsed schedule and misses this case.

- [P2] Remove the remaining await before recording the start —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:403-405
  The R49 ordering still leaves an asynchronous gap: `startRun()` immediately awaits
  `sessions.mainRoot(repo)` before inserting its row, even though this caller already resolved
  `root`. Eligibility or busy state can change after the final guards but before that insertion. A
  targeted reproduction disabling scheduling during this last root read still created a session.
  Pass the resolved root into the start path so the final guards and reservation row are
  synchronous, and test that boundary rather than only the workspace-read boundary.

- [P2] Preserve the latest failure beyond history pruning —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/fate/jobs.ts:169-171
  After 50 skipped times follow a failed start—for example, because an older run's change was
  reopened—`JobRuns.#prune()` deletes the failed row: it protects only started runs.
  `latestFailed()` then returns undefined and this card reverts to an older successful run, contrary
  to R45's requirement that the failure remain until a newer run starts. Preserve the latest failed
  row when it is the newest non-skipped run. Extend the new test beyond 50 skips; its single skip
  cannot expose this loss.
