---
reviewed: wave 4
commits: 6082e53cdc410aa4f9f20601c1d89c988f7e8e32..cdc296770dfdde04cceeda688bb982fd51fd65d5
---

# Findings: Scheduled jobs, wave 4

## Claude Code · Fable 5.2

10 findings, most severe first:

1. `packages/server/src/jobs/accept.ts:33`: `proposalOf` never checks that the change offer ends the
   text: it takes the last closed block anywhere in the last text, so prose or a plain code block
   after the offer still starts the change with no human.

   Failure scenario: A run's last text is "`uraeda-offer change\n# Upgrade deps\n`\n\nOn reflection
   this is too risky, do not start it before checking X." `lastOffer` returns the change block and
   no `uraeda-offer` block opens after it, so `toChange` runs and a branch, worktree and pull
   request run start. The plan and the review focus require the offer to be the run's last word.

2. `packages/server/src/runner/migrations.ts:188`: Wave 3 finding 6 is not closed: no commit in
   a0cb3a9e..cdc29677 touches the migration, so the `job_runs` step is still edited in place with no
   new step to recreate the index.

   Failure scenario: A `runner.sqlite` that applied the wave 2 step (the owner's data folder or
   `.sandbox/`) keeps `job_runs_due ... WHERE due IS NOT NULL`. `JobRuns.add`'s
   `ON CONFLICT (job, repository, due)` then throws on every insert, so no scheduled run starts, no
   skip is recorded, and `jobs.runNow` fails.

3. `packages/server/src/jobs/scheduler.ts:319`: The new 5-minute recheck in `#fresh`, combined with
   the minute between starts, silently drops the sixth and later runs due together, every time, with
   no history row.

   Failure scenario: One job runs `daily 03:00` in 7 repositories, or 7 jobs share 03:00. The drain
   starts them at about 03:00:15, 03:01:15 and so on. The sixth reaches `#fresh` at about 03:05:15
   or later, `now - due > MISSED_AFTER_MS` holds, and it is dropped; later ticks also see it as
   missed. Those repositories never get the run, although the spec says a time is missed only when
   more than 5 minutes past "when the server sees it".

4. `packages/server/src/jobs/scheduler.ts:358`: `#skipOf` cannot see an acceptance in flight, and is
   not checked again after the minute's wait, so a scheduled time can start while the previous run's
   change is being opened.

   Failure scenario: The 02:00 run ends on an offer at 02:59:55 and `accept` is inside `toChange`
   (worktree creation; the session's folder is set only at `attach`). The 03:00 tick finds the
   session not working (`sessionWorking` is false during a hold) and `changeFolders` empty, so it
   starts a new run in the main checkout while the change opens. The same happens when the offer
   lands during the 60-second `#wait` at line 374. This overlaps runs against SC-003.

5. `packages/server/src/jobs/accept.ts:80`: A refused start blocks only the same turn
   (`run.refusedTurn === turn`), so a later turn with no human message is accepted again, even after
   the human dismissed the refusal.

   Failure scenario: Turn 5 ends on an offer, the start is refused (slug taken), and the human
   presses Dismiss. A wakeup the agent set, or a background task ending, starts turn 6 with no human
   message, and it ends on the same offer. `accept` passes every check and calls `toChange` again:
   either the change starts by itself after the dismissal, or `setRefusal` moves to turn 6 and the
   banner asks again.

6. `packages/server/src/jobs/accept.ts:16`: The server reads offers with line regexes (`BLOCK`,
   `OPENING`), not as markdown, so an offer block quoted inside an outer fence counts as a real
   offer although the UI draws no card for it.

   Failure scenario: A run's last text shows an example inside a four-backtick or `~~~` fence:
   "`md\n```uraeda-offer change\n# Example\n```\n`". `lastOffer` matches the inner lines and the
   server starts the change "Example". The web UI renders it as a code sample, since its fence
   plugin never fires for the nested block, so the server accepts an offer the human could not have
   accepted from a card.

7. `packages/server/src/jobs/announce.ts:27`: The `Jobs` record is announced only on a settings
   read, a run-row change, or a run session's turn, although it also depends on the repository list,
   runtime on/off, and the workspace's open changes.

   Failure scenario: A card reads "“notes” is not in Uraeda's list." and the human adds `notes` to
   the list; or reads "Not running here: Claude Code is off in this repository." and they turn the
   agent on; or `next.why` is `change-open` and the pull request merges. None of these sends an
   update, so the card keeps the stale problem or next run until an unrelated job event or a reload.

8. `packages/server/src/fate/jobs.ts:122`: `rowOf` calls `nextRun` per job, and each call runs
   `#skipOf` then `anyOpen`, which reads the whole workspace (`readWorkspace`), so one record read
   does one workspace read per job with a change folder.

   Failure scenario: With N jobs that ever started a change, a single `Jobs` read does N concurrent
   `readWorkspace` calls plus 50 `cache.session` lookups per job. `announceJobs` fires on every
   repository's bus for each row add, `setSession`, and turn start or end of any run session, so
   every connected client repeats this several times per run start. Reading the workspace once per
   `jobsRecord` and passing the open folders to `nextRun` would remove the repeat.

9. `packages/server/src/jobs/scheduler.ts:426`: `#runNow` refuses any job that has a core problem,
   and throws the raw fragment, although the spec says "Run now" is refused only while the job's run
   works there.

   Failure scenario: The job has `schedule = "dayly 06:00"`, which is irrelevant to a manual run.
   Pressing `r` gives `refused: the schedule “dayly 06:00” is not understood`, a lowercase fragment
   without the "Not running: " prefix R13 gives the card. The run does not start, so the human
   cannot test the prompt until the schedule is fixed.

10. `packages/server/src/runner/status.ts:148`: The refusal is never cleared (`setRefusal(id, null)`
    has no caller), so it stays on the session after the human starts the change from the card if no
    new turn follows.

    Failure scenario: The start is refused and the human starts the change from the card while the
    agent is unavailable, or with no workflow message to send, so `sendRun` adds no turn. The
    session now belongs to the change, but its latest turn is still the refused one: it keeps
    reading "Needs attention: The change could not start by itself." After Dismiss, line 148 returns
    Idle before the change's own statuses (halted, waiting on the agent) are considered.

## Codex · GPT-6.1-Sol

Automatic acceptance does not enforce the terminal-offer boundary, and queued starts can bypass the
no-overlap guard after waiting. Shutdown and live-update gaps also remain; the targeted test suite
was blocked by the read-only Nix cache.

Full review comments:

- [P1] Require the change offer to end the final text —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/accept.ts:38-41
  When the final text contains a closed change offer followed by ordinary prose, this still returns
  the proposal. For example, an offer followed by “Do not start this; the migration is unsafe.”
  starts the change automatically. Checking for another opening fence does not enforce the required
  last-word boundary; reject non-whitespace content after the closing fence.

- [P1] Recheck working sessions and open changes after the wait —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:373-381
  If a previous run resumes or its offer becomes a change during the minute-long wait, the queued
  run still starts: `#skipOf` ran before the wait, and `#fresh` checks settings and availability but
  not working sessions or open changes. For example, sending a message to yesterday's idle run
  during this wait produces two working runs in the same repository, violating SC-003. Recheck these
  guards immediately before starting, while retaining the reservation.

- [P2] Await active offer acceptance during shutdown —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/start.ts:30-33
  If an acceptance is already awaiting `readJobs` or `toChange`, `stopAccepting()` only unsubscribes
  and prevents queued acceptances; it does not finish the active one. Consequently, `jobs.stop()`
  can resolve and `server.ts` can stop sessions and unload extensions while that acceptance still
  creates a change or sends its workflow run. Await `stopAccepting.settled()` before allowing
  shutdown to proceed.

- [P2] Announce jobs when their open changes change status —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/announce.ts:25-28
  When a job's change is merged while its session is idle, `nextRun` changes from `change-open` to a
  scheduled time, but none of these listeners announces the Jobs record. Repository watcher updates
  go through `live.publish`, which updates Workspace, Feature, and Session records without invoking
  `onSessionChange` or publishing Jobs. An already-open Jobs page therefore retains the obsolete
  blocked state until another job event or reload. Publish a Jobs update for relevant workspace
  changes too.
