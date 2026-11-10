---
reviewed: wave 3
commits: fd358d2888dee64e109dd8d44ac2408a2d52eab4..13b4c55fc37b4073c7e1b73b793576d4236ae56a
---

# Findings: Scheduled jobs, wave 3

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `packages/server/src/jobs/scheduler.ts:287`: `#run` checks `#starting` inside `#skipOf`, then
   awaits `changeOpen` (a workspace read) before adding the key without checking again, so a
   `runNow` landing in that await starts a second run of the same job in the same repository.

   Failure scenario: The job has run before, so `last.session` is set. At 03:00 the tick's `#skipOf`
   sees `#starting` empty and awaits `readWorkspace`. A "Run now" request then passes its own check,
   adds the key and starts its run. The tick resumes, adds the key again and calls `startRun`; its
   row has a `due` and the manual row has null, so the unique index does not stop it. Two agents
   work in the same main checkout at once (SC-003). The first `finally` also deletes the shared key
   while the other start is still in flight.

2. `packages/server/src/jobs/scheduler.ts:256`: The change-open guard reads only `latestStarted`,
   and `runNow` does not check for an open change, so any later run that opens no change hides an
   earlier run's change that is still open.

   Failure scenario: Tuesday's 03:00 run starts the change "Upgrade three dependencies", which stays
   open. On Wednesday the human clicks "Run now"; it is allowed because the last run is not working,
   and it ends without a change. On Thursday at 03:00 `latestStarted` is the manual run, whose
   session has no folder, so `changeOpen` is false and a new run starts, with a second pull request
   on the same files (SC-003). Pruning (R8) keeps only the latest started row, so the older run's
   row can also be deleted, and `ofSession` loses it.

3. `packages/server/src/jobs/scheduler.ts:202`: The minute waits between starts run inside the
   serialised tick, so no other tick looks for due times until every start of this one is done, and
   times that fall due meanwhile are missed.

   Failure scenario: An hourly job is in 7 repositories, so its starts run from 03:00 to 03:06
   inside one tick. Another job is `daily 03:01`. The next tick runs after 03:06, finds 03:01 more
   than 5 minutes past, and never starts it. A job added at 02:58 during such a tick is first seen
   after 03:00 and loses that day's run under R2. The wait also happens before an item that is then
   only skipped or already recorded, so A-start, B-skip, C-start puts C two minutes after A.

4. `packages/server/src/jobs/scheduler.ts:205`: After each minute's wait, only the global switch is
   checked again; the due list and its `Job` objects are from the start of the tick, so a job
   paused, deleted, edited or with its extension turned off during the waits still starts, and so
   does a time now more than 5 minutes past.

   Failure scenario: A job runs in 3 repositories and is due at 03:00. The human pauses or deletes
   it at 03:00:20, after the first start. The tick still starts it in the second repository at 03:01
   and the third at 03:02, with the old prompt. With 7 or more starts in a tick, the seventh starts
   6 minutes after its time, although a time more than 5 minutes past is missed (US2).

5. `packages/server/src/jobs/scheduler.ts:233`: The first-seen moment is keyed by job name and
   repository only, so a schedule edited to a time just past runs at once, which R2 forbids for a
   job added just after its time.

   Failure scenario: The job "Dependencies", `daily 09:00`, has been seen since server start. At
   03:02 the human changes its schedule to `daily 03:00`. On the next tick `due` is 03:00, later
   than `first` and 2 minutes past, so the run starts immediately. The same job added new at 03:02
   correctly waits for tomorrow. The first-seen moment is not reset when the schedule changes.

6. `packages/server/src/runner/migrations.ts:188`: The fix for the partial unique index edits the
   existing `job_runs` migration in place, so a cache that already applied it keeps the partial
   index, and the new `ON CONFLICT (job, repository, due)` in `JobRuns.add` then fails on every
   insert.

   Failure scenario: A `runner.sqlite` was created by the wave 2 code, such as the owner's own data
   folder or `.sandbox/`, so `user_version` already counts this step and it does not run again.
   Every `add` now throws "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint"
   (reproduced with node:sqlite). No scheduled run starts, no skip is recorded, and "Run now" fails,
   with one stderr line. A new migration step that drops and recreates the index would fix it.

7. `crates/core/src/jobs.rs:143`: Wave 1 finding 6 is closed only for writes: the reader still
   returns `agent`, `model` or `effort` written by hand as an empty or blank string as `Some("")`,
   with no problem on the job.

   Failure scenario: The human writes `agent = ""` in config.toml (the job is theirs to edit by
   hand). `job.agent ?? runtimes.defaultFor(root)` keeps `""`, `runtimes.get("")` is undefined, and
   `agentOf` returns undefined. The job never runs in any repository, with no problem shown, and
   `nextRun` reports `agent-off`. With `model = ""`, `startRun` passes `model: ""` to `newChat`,
   which fails; the row is removed and the start is retried every tick for 5 minutes.

8. `packages/server/src/jobs/run.ts:55`: When the send fails, the chat made for the run is removed
   from the cache without publishing the removal, and the start is retried on every tick for the
   time's 5 minutes.

   Failure scenario: `newChat` and `rename` succeed and are published to clients (the created
   listeners and `onChange`). Then `sessions.send` throws, for example because the agent's process
   cannot open. `removeEmptySession` deletes the row silently, so the sidebar keeps a ghost
   "Dependencies" chat until a reload. The row is dropped under R9, so the next tick 30 seconds
   later repeats this, up to about 10 times per time and repository, while the problem is printed
   once.

9. `crates/core/src/jobs/inline.rs:75`: `Lines::apply` clears every entry's suffix and rebuilds a
   prefix from `head` or the previous tail only when the entry starts a line, so comments in an
   inline list whose entries share a line, or that sit between a value and its comma, are lost on
   add or remove.

   Failure scenario: With `jobs = [ # note\n  { name = "A" }, { name = "B" },\n]`, `remove("A")`
   gives B its lead alone, because `breaks` is false: the file becomes `jobs = [ { name = "B" },\n]`
   and `# note` is gone. A comment written after a value and before its comma on the next line lives
   in the value's suffix, which `set_suffix("")` deletes for every entry on any add or remove. Both
   break "a write MUST keep a human's comments" (wave 1 finding 3).

10. `packages/server/src/jobs/scheduler.ts:138`: `#sleep` adds an abort listener to the scheduler's
    signal for every minute's wait and never removes it when the timer fires, and each tick does
    repeated lookups and reads for every job and repository.

    Failure scenario: Each wait that ends normally leaves a `{ once: true }` listener and its
    closure (the timer and `done`) on the signal until the server stops; an hourly job in several
    repositories adds some every hour. Removing the listener when the timer fires fixes it.
    Separately, `#dueNow` calls `this.#options.repos()` (`hosts.all()` and a `find`) inside the
    job-by-repository loop, and `#run` loads 50 history rows to test one `due`; a lookup by
    `(job, repository, due)` on the unique index would do.

## Codex · GPT-6.1-Sol

The scheduler permits overlapping manual and scheduled starts and launches queued work after its
eligibility changes. Failed replacement starts can also erase the operational reference needed to
prevent another run against an open change.

Full review comments:

- [P1] Reserve the job before awaiting the open-change check —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:272-272
  When the previous session belongs to a merged change, `#skipOf` awaits `readWorkspace` after
  checking `#starting`. A concurrent `runNow` can start during that await; when the workspace read
  returns, the tick also starts without rechecking. Both inserts succeed because the manual row has
  `due: null`, producing overlapping runs. Reserve the job before the asynchronous check, with
  exclusion shared by scheduled and manual starts.

- [P1] Revalidate queued jobs after the spacing wait —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:204-208
  When several runs are due together, their jobs and eligibility are captured before the minute-long
  waits. Pausing or deleting a queued job, removing its repository, or disabling the Jobs extension
  during a wait does not prevent its session from starting: only the global switch is checked again.
  Reload and validate the queued job before starting it so revoked settings cannot launch unattended
  work.

- [P2] Recheck the missed-time cutoff after waiting —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:200-208
  The five-minute cutoff is checked only when the entire due list is collected. If the machine
  sleeps during the spacing wait, the remaining sessions start on waking even hours after their
  scheduled time; a sufficiently long queue also starts entries beyond the cutoff. Compare the
  current injected clock with each item's `due` after waiting and discard expired times rather than
  starting stale runs.

- [P2] Preserve the previous operational row through failed starts —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/runner/cache-jobs.ts:105-106
  After an open change has accumulated 50 skips, its started row survives only through this
  exception. A manual start inserts a new `started` row with no session, making pruning delete the
  old operational row immediately. If that start fails, `startRun` removes the new row too, leaving
  `latestStarted` and `ofSession` undefined despite the original change remaining open. Preserve the
  prior operational reference until the replacement successfully starts; otherwise the next
  scheduled run bypasses the open-change guard.
