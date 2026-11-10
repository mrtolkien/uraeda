---
reviewed: wave 5
commits: e36bfe84669a91a4dfe0da0fd6b364417b2fd36f..012586f3e15ddda8dc3cabdfbb4a808e43e419f5
---

# Findings: Scheduled jobs, wave 5

## Claude Code · Fable 5.2

8 findings, most severe first:

1. `packages/server/src/jobs/scheduler.ts:365`: A clock jump during the minute's wait drops only the
   one queued time that was waiting; every time still queued behind it starts afterwards, hours
   late, which R17 says must not happen.

   Failure scenario: Five jobs are due at 03:00. Job 1 starts, and the machine sleeps during job 2's
   wait until 09:00. `#waited()` returns true for job 2, which is dropped. The `#drain` loop carries
   on with `started` still true: jobs 3, 4, and 5 each wait an ordinary minute (no jump), `#fresh`
   reads no age by design, and they start at 09:01, 09:02, and 09:03 for the 03:00 time. The
   scheduler test only covers the item that was waiting.

2. `packages/web/src/jobs/JobsPage.tsx:80`: The Jobs place identifies a card by `job.name`
   everywhere, but the record lists both jobs of a duplicate name, a state the spec gives a card
   text for.

   Failure scenario: config.toml holds two jobs named "Dependencies" for this repository, and
   `jobsRecord` returns both rows. React gets two children with the same key. `jobs.find(name)`
   always picks the first, so tapping the second card selects the first and the second can never
   show its bar. `useListKeys` gets duplicate `keys`, so `keys.indexOf` maps the second card's link
   to row 0: j/k cannot reach it, and r/p/d pressed on it act on the first. A refusal shows under
   both cards.

3. `packages/web/src/jobs/facts.ts:44`: `nextFact` returns the time whenever `next.at` is set, so a
   job's server-side problem is never shown on a card that has a next time, and the card shows
   `problem` nowhere else.

   Failure scenario: A job names repositories A and B, and B was removed from Uraeda's list. In A,
   `nextRun` gives a time (the core reports no problem) and `localProblem` gives "“B” is not in
   Uraeda's list.". The card in A reads "Tomorrow at 3:00" and the exact-text problem never appears.
   Conversely, a paused job whose agent is off reads the agent problem instead of "Paused" (US4
   scenario 2), because `job.problem !== null` is tested before `why === "paused"`.

4. `packages/web/src/jobs/JobsPage.tsx:33`: `jobPath(name)` collides with the reserved route
   `/jobs/new`, and neither the core's `check` nor the route table reserves that name.

   Failure scenario: A job named "new" is written in config.toml (the core accepts any non-empty
   name). Its card's link and Enter go to `/jobs/new`, which `parseRoute` reads as `job-new`: the
   human gets the add form and can never open that job's page. A job named ".." yields `/jobs/..`,
   which the browser normalises away from Jobs.

5. `packages/web/src/jobs/words.ts:63`: `whenWords` renders times in the browser's time zone, while
   `scheduleWords` prints the schedule's hour as the server reads it, so the two disagree on one
   card when the zones differ.

   Failure scenario: The server runs in UTC and the phone is in Europe/Paris. The card reads "Every
   day at 3:00" with Next run "Today at 4:00". Near midnight the Today/Tomorrow/Yesterday word is
   also computed on the browser's calendar, so a 23:30 server-time run reads "Tomorrow at 0:30". The
   file's header assumes the server's local time is the human's, which fails for any remote or
   travelling client.

6. `packages/web/src/jobs/facts.ts:63`: The `agent-off` fallback prints the agent's id (`job.agent`)
   rather than its title, and says "no agent is on" for an agent that is on but unavailable.

   Failure scenario: A job with `agent = "claude-code"` whose runtime is on but not available (not
   installed or signed out): `nextRun` gives `agent-off`, `localProblem` gives null because `isOn`
   is true, and the card reads "Not running here: claude-code is not available." where the server's
   own text uses `runtimes.title()`. A job with no agent whose default runtime is on but unavailable
   reads "Not running here: no agent is on in this repository.", which is false.

7. `packages/server/src/jobs/scheduler.ts:350`: The scheduler holds a job's `#starting` reservation
   through the whole minute's wait between starts, so "Run now" is refused with "still runs here"
   for a job that has no run.

   Failure scenario: Jobs A and B are both due at 03:00. A starts, and B's `#run` adds its key to
   `#starting` then waits 60 seconds in `#waited()`. The human presses `r` on B during that minute:
   `#runNow` finds `#starting.has(key)` and refuses with "“B” still runs here." although no session
   of B exists or works. US4 says `r` starts a run at once unless a run is at work.

8. `packages/server/src/jobs/announce.ts:32`: The Jobs record is announced on every host's bus for
   every feature-file change in any repository, so each open Jobs page re-reads the whole record on
   each watcher event.

   Failure scenario: An agent at work in any repository's `specs/<feature>/` makes `publish` fire
   with `changes.features.length > 0` on each write. `onWorkspaceChange` then calls `announceJobs`
   on the global bus and every host. Each client on a Jobs page re-runs `jobsRecord`: `readJobs` on
   config.toml, the history queries per job, and possibly `readWorkspace`, many times a minute.
   Announcing only on the changed host's bus, or only when a folder in some job's `changeFolders`
   changed, would avoid it.

## Codex · GPT-6.1-Sol

Automatic acceptance still admits a nested-code example, and clock-jump handling leaves later stale
queue entries runnable. The Jobs UI also has history and state-display defects. Targeted tests were
blocked by the read-only Nix cache.

Full review comments:

- [P1] Track outer fences inside Markdown containers —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/runner/offers.ts:40-45
  An outer fence opened on a list item, such as `- ````md`, is not recognized here. If it contains a
  two-space-indented change offer and remains unclosed, this parser recognizes the inner offer and
  `endingOffer` accepts it. Markdown instead renders everything inside the outer fence as a code
  sample, with no offer card. Supporting indented offers therefore introduces automatic acceptance
  of examples that previously did not match. Parse container context as well as fence lengths before
  treating a block as an offer.

- [P2] Invalidate the remaining stale queue after a clock jump —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/server/src/jobs/scheduler.ts:365-366
  With three or more runs queued, sleeping during the second run's wait drops only that item. The
  drain then waits another ordinary minute for the third item, sees no further clock jump, and
  starts its hours-old scheduled time because `#fresh` no longer checks age. Propagate the detected
  jump to invalidate the remaining pre-jump queued times, rather than returning an ordinary
  unsuccessful-start result for just one item.

- [P2] Read the latest started run outside the bounded history —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/facts.ts:129-131
  After 50 skipped times follow a started run, `JobRuns.history` returns only skipped rows, even
  though the cache deliberately retains the latest started row separately. This lookup then returns
  undefined, so the card says “Never ran” and stops reading the existing run's session. This occurs
  naturally with an hourly job whose change remains open for several days. Expose and consume the
  latest started run independently of the 50-row history window.

- [P2] Preserve the scheduler's paused-reason precedence —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/facts.ts:47-54
  For a paused job whose named agent is off, the server returns `next.why = "paused"` alongside the
  local agent problem. This branch displays the agent problem before reaching the paused branch, so
  turning the switch off does not produce the required “Paused” text. Honor the scheduler's reason
  precedence rather than letting every local problem override paused or globally disabled states.

- [P2] Update the job switch optimistically —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-scheduled-jobs/packages/web/src/jobs/useJobs.ts:61-62
  Pausing or resuming leaves the controlled switch and card unchanged until the mutation or live
  update returns. On a slow connection, pressing `p` twice sends the same value twice because both
  actions read the old `job.on`, instead of pausing and resuming. Apply the local value immediately
  and roll it back on refusal, as required by the
  [optimistic-write guidance](specs/ui/space-and-motion.md#L59-L61).
