---
reviewed: wave 2
commits: 2ab9ce3abeda94fc1b0a6ead64a46ef0890679c1..344032c39cab231bd773cd1c26b6f5cf297ff36c
---

# Findings: Scheduled jobs, wave 2

## Claude Code · Fable 5.2

9 findings, most severe first:

1. `packages/server/src/runner/cache-jobs.ts:90`: Pruning keeps the 50 newest rows by id whatever
   their outcome, so skip rows push out the job's latest `started` row, which `latestStarted` and
   `ofSession` need.

   Failure scenario: An hourly job starts a change that stays open. Each hour adds a
   `skipped`/`change-open` row, so after about 50 hours the started row is deleted.
   `latestStarted()` then returns undefined, the scheduler sees no open change, and it starts a
   second run and a second pull request on the same files. `ofSession()` for that session also
   returns undefined, so the R1 refusal state is lost.

2. `packages/server/src/jobs/times.ts:73`: `topOfHour` uses `setMinutes(0,0,0)`, which resolves a
   repeated local hour to its first occurrence, so hourly `nextAfter` returns a time in the past
   during the second pass of that hour.

   Failure scenario: Confirmed with node under TZ=Europe/Paris: at 2026-10-25 02:20 CET (01:20Z),
   `topOfHour` gives 00:00Z and `nextAfter` returns 01:00Z, 20 minutes before `now`, breaking the
   'first time after now' contract and the UI's next run. `dueAt` also returns 00:00Z, 80 minutes
   old, for the whole second hour. No test covers hourly across a clock change.

3. `packages/server/src/runner/cache-jobs.ts:136`: `rename(from, to)` with `from === to` deletes the
   job's whole history.

   Failure scenario: `jobs.update` saves a job without changing its name and calls
   `rename("Dependencies", "Dependencies")`. The UPDATE is a no-op, then
   `DELETE FROM job_runs WHERE job = from` removes every row. The dedupe rows and the latest started
   row are gone, so a due time can start twice and the open-change guard is lost. Nothing in
   `rename` guards against equal names.

4. `packages/server/src/runner/cache-jobs.ts:135`: On a rename collision the stale row under `to`
   wins, and the live `from` row with its session is deleted.

   Failure scenario: A job was once renamed by hand or deleted, leaving rows under "Upgrades". Later
   "Dependencies" is renamed to "Upgrades" on its page. For any shared `due`, the live row holding
   `session`, `refusal` and `started` is dropped in favour of the stale one. `ofSession` and
   `latestStarted` then miss the running session or open change. The merged history is also not
   pruned to 50 until the next `add`.

5. `packages/server/src/jobs/times.ts:27`: `at()` treats any hour or minute mismatch as a clock skip
   and walks back minute by minute until the zone offset changes, which never happens in a zone
   without clock changes.

   Failure scenario: A `Schedule` with hour 24 or minute 60 (the binding's type is a plain `number`)
   reaches `dueAt` on a server in UTC or Asia/Tokyo. `Date` normalises it, the check fails, and the
   loop runs about 1e11 iterations, hanging the scheduler tick and the server's event loop. In a
   zone with clock changes it silently returns the last transition, months back.

6. `packages/server/src/runner/cache-jobs.ts:71`: `INSERT OR IGNORE` swallows every constraint
   failure, not only the `(job, repository, due)` conflict, and `add` reports all of them as
   'recorded already'.

   Failure scenario: A caller passes a null `job`, `at`, `trigger` or `outcome` (NOT NULL columns).
   The insert is ignored, `add` returns undefined, and the scheduler treats the time as already run
   and never starts it, with no error.
   `ON CONFLICT (job, repository, due) WHERE due IS NOT NULL DO NOTHING` would limit it to the
   intended conflict.

7. `packages/server/src/runner/cache-jobs.ts:67`: `JobRuns` has no way to set a row's session after
   `add`, and a row is written as `started` before any session exists.

   Failure scenario: Task 4's `startRun` must add the row first (for the unique-index race) and then
   'set the row's session', but only `setRefusal` updates a row. If `newChat` fails after `add`, the
   row stays `started` with a null session: the time is never retried, and `latestStarted` returns a
   run with no session to check for 'working' or 'change-open'.

8. `packages/server/src/runner/migrations.ts:173`: `job_runs`, described as 'the authority on what
   ran', lives in `runner.sqlite`, which `SessionCache.open` deletes when it is corrupt, and rows of
   deleted or hand-renamed jobs are never removed.

   Failure scenario: The cache is corrupt at a restart and is recreated empty: a time within its 5
   minutes runs again, and a job with an open change starts a second one. Commit 2d73b33f moved the
   features' options to their own file for this reason. Separately, a new job that reuses a deleted
   job's name inherits its old history and its `latestStarted` row, and can be skipped as
   `change-open` for a change it never started.

9. `packages/server/src/runner/migrations.ts:186`: The unique index is partial
   (`WHERE due IS NOT NULL`), so `history`, `latestStarted` and the prune in `add`, which filter on
   `job` and `repository` only, cannot use it and scan the table.

   Failure scenario: Every `add` runs a DELETE with a NOT IN subquery, and every history or
   scheduler read filters by `(job, repository)` without a usable index, on each 30-second tick per
   job and repository. SQLite unique indexes already treat NULLs as distinct, so a plain unique
   index on `(job, repository, due)` gives the same dedupe and serves these queries.

## Codex · GPT-6.1-Sol

Direct reproductions confirmed lost operational run references, incorrect hourly DST calculations,
and excess retained rows after a colliding rename. The prescribed test run was blocked by the
sandbox denying Nix cache writes.

Full review comments:

- [P1] Preserve the last started run when pruning skipped rows —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/runner/cache-jobs.ts:90-94
  After one started run and 50 subsequent skips, pruning deletes the started row, so both
  `latestStarted()` and `ofSession()` return undefined even if that session still works or its
  change remains open. This loses the information required by US2 to keep skipping subsequent runs.
  Preserve the operational reference independently of the 50-row history limit.

- [P2] Calculate the next hourly run using local schedule boundaries —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/times.ts:72-73
  During the autumn clock change in Europe/Paris, `nextAfter(hourly, 2026-10-25T02:20:00+01:00)`
  returns `02:00+01:00`, which is already past. `topOfHour()` resolves the repeated hour to its
  first occurrence, and adding one elapsed hour does not advance beyond `now`. During the first
  occurrence it also advertises the second 02:00 despite the first-occurrence rule. Select the next
  valid local scheduled hour strictly after `now`, with regression tests for both occurrences.

- [P2] Prune the merged history after renaming a job —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/runner/cache-jobs.ts:134-137
  When the destination name already has historical rows, the rename merges both histories without
  applying the retention limit. For example, two 50-row histories with 25 overlapping due times
  leave 75 stored rows after renaming. `history()` hides the excess with `LIMIT 50`, but the rows
  remain indefinitely unless another run is added. Prune each affected destination repository inside
  the rename transaction.
