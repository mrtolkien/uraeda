---
reviewed: branch
commits: 03578b75cfe9e5382e60d9882639167e017dc095..871ebaba035c6d64b6e20748129fb46fd532fcc3
---

# Findings: Scheduled jobs, the branch

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `crates/core/src/jobs/write.rs:177`: Every write is by name and lands on the first job of that
   name, so acting on the card or page of a duplicate-named job (the second, flagged "Two jobs are
   named") deletes, pauses, or overwrites the other, healthy job. R30 accepts "applied to the first"
   but its "If wrong" does not cover this data loss, nor the case where the first job is not listed
   in the repository at all.

   Failure scenario: config.toml holds job "Deps" for uraeda (first) and a second "Deps" for notes.
   The notes Jobs place lists only the second card (the first does not name notes). Pressing `d`
   there and confirming "Delete the job “Deps”?" removes uraeda's working job and leaves the broken
   duplicate. Opening its page (JobPage.tsx:278 finds the second by name among the jobs listed here)
   and renaming it to fix the duplicate sends update("Deps", the second's values): the first table
   gets the second's prompt, schedule, and repositories plus the new name, and the first job's
   prompt is lost.

2. `packages/server/src/jobs/accept.ts:63`: The acceptance refuses any job that has a core problem,
   but "Run now" (R23, `impossible`) deliberately runs a job whose only problem is a schedule that
   is not understood, so that run's offer is silently never accepted.

   Failure scenario: A job with `schedule = "dayly 06:00"` and report_only unset is run with "Run
   now". Its message tells the agent "Uraeda starts the change from your offer, and the next message
   continues in its worktree", and docs/web-ui.md says Run now "starts the change its run offers"
   and ignores "a schedule that is not understood". The run ends on a change offer, accept() returns
   at `job.problem !== undefined`, and no change starts and no "could not start" banner shows: the
   agent stopped waiting for a message that never comes.

3. `packages/server/src/jobs/scheduler.ts:462`: `runNow` never checks that the Jobs extension is on
   in the repository (only the scheduled path does, through `#placeOf`/`isOn`), and the
   `jobs.runNow` mutation has no gate either, so a run and the change it offers can start where the
   extension is off.

   Failure scenario: Jobs is turned off for the repository notes (spec edge case and docs: "its
   place is gone there, and no job starts there"). A tab still open on /jobs there, or any client
   calling `jobs.runNow` on that repository's endpoint, starts a session in notes' main checkout,
   and when it ends on an offer the acceptance starts a change, branch, and worktree there.

4. `packages/server/src/jobs/scheduler.ts:407`: A scheduled start that throws leaves no trace:
   `startRun` removes its row, the scheduler prints once to stderr, the time is retried at every
   tick for 5 minutes and then dropped as if it had never been due, so the record of runs and the
   card say nothing.

   Failure scenario: A job has `model = "opus-9"` written by hand, or a model or effort the runtime
   stopped listing. At 3:00 `sessions.newChat` is refused by `newSessionPick` (no such model); the
   row is added and removed about ten times (each announcing the Jobs record), then the time
   expires. The history shows nothing, "Last run" keeps its old value, "Next run" reads "Tomorrow at
   3:00", and this repeats every night: the job silently never runs unless the human reads the
   server's stderr or presses "Run now".

5. `packages/server/src/jobs/scheduler.ts:252`: The "first seen" moment is the tick's clock, not
   when the job was written or turned on, and ticks come only from the 30-second timer, so a job
   added, edited, resumed, or switched on up to 30 seconds before its time is treated as added after
   it and loses that run.

   Failure scenario: At 02:59:45 the human saves a job `daily 03:00` (or presses `p` to resume it,
   or turns "Run scheduled jobs" on); its card reads "Today at 3:00". The last tick was 02:59:40,
   and the next, at 03:00:10, sees the job for the first time: `first` = 03:00:10, `due` = 03:00:00,
   `due > first` is false, nothing starts and nothing is recorded, and the card then reads "Tomorrow
   at 3:00". R2 only meant to exclude jobs added after their time; ticking on `settings.onRead`,
   which announce.ts already listens to, would close the window.

6. `packages/server/src/jobs/accept.ts:76`: The acceptance checks only `sessionWorking` (a turn
   running or queued), while the scheduler's `works()` also counts a session whose process waits on
   a wakeup the agent set, so a session the scheduler calls "working" can still be moved into a
   change, and `attach` closes its process.

   Failure scenario: A run's turn ends done with a `uraeda-offer change` block as its last text
   while a wakeup or background command the agent set is still pending (R19 names this case). The
   scheduler skips the next time as "its last run still works", yet accept() passes
   `!sessionWorking`, `toChange` attaches the session, and `processes.close(live.proc)` kills the
   pending wakeup or background task: the continuation the agent scheduled never happens, and the
   change starts from an offer that was not the run's last act.

7. `packages/server/src/runner/migrations.ts:178`: Migrations apply by position (`user_version`
   against the array's length), and the rebase put the default branch's `account` column before the
   branch's three `job_runs` steps, so a cache this branch migrated before the rebase gets the wrong
   step. The branch's own index-fix step shows such caches are meant to keep working.

   Failure scenario: A cache opened by the pre-rebase branch (a worktree's .sandbox, or the data
   folder a dev server of the branch used) has user_version = N+3 with job_runs, the index, and
   blocked_by applied, but no `account`. After the rebase the list has N+4 entries, and
   `migrations.slice(N+3)` runs only `ALTER TABLE job_runs ADD COLUMN blocked_by`, which fails with
   "duplicate column name": the transaction rolls back and the server cannot open the cache.
   `sessions.account` is never added either way. I found no such cache in this worktree, so this is
   by reading the code only.

8. `packages/server/src/runner/message.ts:317`: The rule "change no file" is in two places that
   disagree: skills/uraeda/references/change.md says the run's message tells the agent to "offer the
   change as above, change no file", but `jobMessage` says "Change no file." only for report-only
   jobs.

   Failure scenario: A job that is not report only runs in the main checkout, where the human's
   uncommitted edits are; the spec's tradeoff says only the skill's rule and the run's note keep the
   agent from editing there. The note omits the rule, and an agent that does not load the skill's
   change reference (a plain chat in a repository, or a prompt such as "upgrade the dependencies")
   edits files in the main checkout before offering. The start then carries or strands those edits.
   scheduler.test.ts checks the line and the prompt, not that the note forbids edits for a job that
   is not report only.

9. `packages/server/src/jobs/scheduler.ts:238`: One repository's failure inside `#dueNow` aborts the
   whole tick: the `await` of `#placeOf` (`mainRoot`, `agentOf`) and `dueAt` sit in the loop over
   every job and repository with no per-item catch, so a single throw stops every job in every
   repository, at every tick.

   Failure scenario: A listed repository's folder stops being a git checkout (moved, or .git
   removed) before the hosts list marks it missing, so `binding.mainRoot(path)` rejects for it.
   `#once` throws, tick() prints "the scheduled jobs stopped: …" once, and the due times of healthy
   repositories are never queued, each one silently missed after 5 minutes. `#run` isolates errors
   per time, but the look for due times does not.

10. `packages/server/src/jobs/scheduler.ts:79`: Change cost: scheduler.ts is 499 lines against the
    500-line limit that forced R40's split of sessions.ts, with one class holding the tick, the
    queue and drain, the freshness and skip guards, `nextRun` for the UI, and `runNow`. The record's
    read path also repeats the same queries per job.

    Failure scenario: Any fix above that touches the scheduler (an extension check in `runNow`, a
    tick on settings read, a per-repository catch) pushes the file past the limit and forces a split
    in the same change. `nextRun` and `#runNow` do not use the queue and could move out now. In
    fate/jobs.ts, `jobsRecord` calls `history()` twice per job (in `started` and in `rowOf`) and
    `latestStarted`/`changeFolders` two or three times per job (`rowOf`, `lastOf`, `nextRun` through
    `#skipOf`) on every read and every announcement.

## Codex · GPT-6.1-Sol

Manual starts bypass extension disabling, eligibility can be revoked during the final guard without
preventing a start, and pruning allows previously executed times to run again. Manual runs with
invalid schedules also lose automatic offer acceptance. The prescribed test suite was blocked by the
read-only Nix cache; targeted reproductions confirmed the first three defects.

Full review comments:

- [P2] Enforce the extension switch for manual starts —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:462-465
  When Jobs is disabled in a repository, `jobs.runNow` still starts a session because this path
  never checks `isOn(repository)`. The UI hides the page, but the fate mutation remains callable.
  This contradicts the approved edge case that disabling the extension prevents jobs from starting
  there; Run now bypasses pauses and the global scheduling switch, not the extension switch. Reject
  the manual start when Jobs is off.

- [P2] Recheck eligibility after the final asynchronous guard —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:400-406
  For a job with a previous change folder, `#skipOf` awaits `readWorkspace` after `#fresh` has
  validated eligibility. Turning scheduled jobs off during that read still launches the session; I
  reproduced this with a gated workspace read. Pausing the job or disabling its extension in the
  same interval likewise leaves the captured job eligible. The R14 revalidation fix is incomplete:
  ensure eligibility is checked after the workspace wait, before committing to the start.

- [P2] Preserve deduplication independently of history pruning —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/runner/cache-jobs.ts:127-132
  After 51 hourly runs that finish without a change, pruning deletes the first scheduled time's only
  deduplication record. Setting the clock back to that time while the server remains running starts
  it again; a scheduler reproduction produced a 52nd start for the already-run time. R8/R15 preserve
  operational references, but their bounded history cannot also guarantee the approved
  clock-rollback invariant. Retain a separate deduplication boundary or ledger when pruning history.

- [P2] Allow manual runs to accept offers despite a bad schedule —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/accept.ts:62-64
  For a non-report-only job whose only problem is an invalid schedule, R23 deliberately allows Run
  now, but this unconditional problem check silently prevents its terminal change offer from
  starting. The session's injected note promises automatic acceptance, yet neither a change nor a
  refusal banner appears. R12's blanket problem guard is too restrictive for this supported manual
  path: disregard schedule-only problems for manual runs while retaining the report-only and other
  safety checks.
