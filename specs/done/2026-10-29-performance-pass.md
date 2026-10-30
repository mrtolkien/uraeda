---
kind: feature
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/74
superseded-by: [2026-10-30-feature-state, 2026-10-30-proposal-start]
supersedes:
  [
    2026-10-11-web-ui,
    2026-10-16-redesign-interface,
    2026-10-16-redesign-priorities,
    2026-10-30-phone-bottom,
  ]
---

# Record: Performance pass

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-29, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/74). Its full files are
> in git: `git log -- specs/2026-10-29-performance-pass/`.
>
> Superseded in part by [2026-10-30-feature-state](2026-10-30-feature-state.md).
>
> Superseded in part by [2026-10-30-proposal-start](2026-10-30-proposal-start.md).

## What and why

The web UI felt sluggish: pages took 0.2 to 2.6 s, every commit stopped the human for its hooks, and
moving a proposal to a feature took over 10 s across page changes, with no clear feedback. The human
asked for optimistic UI "everywhere", values cached ahead of time, and no page over 100 ms locally.
Most of the slowness was a debug build of the core, shipped apart first as
[release binding](2026-10-30-release-binding.md), and reads that rebuilt the whole workspace each
time. The human wanted the UI to "feel instant, but we don't have to 'lie' to the user", and to
start a feature, its session included, and go on working without waiting at any point.

## Behaviour

- **Every page draws at once (US1).** The server answers reads from what it already read, and the
  browser keeps every page it read in the session, so a click or a key draws its page from memory.
  No page shows a loading state, and no bar runs at the top: the old page stays until the new one
  draws. A change made outside Uraeda, by an agent or by git, shows on its page within a second,
  through the watcher, with no reload. A reload draws within a second, the sidebar's cards with
  their changed lines' counts, read in one request for every card.
- **Writes show their result at once (US2).** A note moved, added, or deleted, a priority edited, a
  session renamed or archived, a setting switched, and an approval show at the press, and a refusal
  puts them back and says why where it happened. `p` on an inbox note to Now, Next, or Later opens
  the priorities at once, its line at the end of the level, selected once the move answers. A
  message sent to a session shows at the transcript's end at once, as not read yet, until the
  transcript draws the server's. Answers, notes, comments, and text fields show what was typed
  already, so they keep it until the server answers. A write over a version the browser held stale
  reads the file again and writes once more, but the editor's save does so only when the file still
  holds the text it was typed over: another writer's change still shows the conflict, with "Copy my
  text" and "Load the new version". The spec's scenario retried in every case: the human settles
  this on the pull request.
- **Commits land behind a toast (US3).** A git write writes its files and answers at once, takes the
  human where it leads, and blocks nothing. Its commit lands behind it, with the user's hooks, in
  the repository's write queue, one after another, in the order made. The commit toast, the leader
  menu's frosted glass at the bottom right, over the bottom bar on the phone, lists the running
  write, then the waiting ones, named as their buttons say them ("Approving the spec of Performance
  pass…"). Every tab shows the same toast, and a reload brings it back. A hook's refusal undoes the
  write's files and shows the hook's output where it happened, the verdict's place, a round's end,
  the editor's Commit, and in the toast, with Open and Dismiss; Open hides it from this tab's toast
  only, Dismiss from every tab, and writing at that place again deals with it. A commit that failed
  for another reason leaves its files written: "The commit failed: the change is still written, not
  committed.", with the commit page linked for the lists, and Try again on a verdict's or a round's
  page. The queue goes on past a refusal. A message sent to a feature whose commits are still queued
  waits for them, and goes once they land; a refusal returns it to that session's composer, "Not
  sent: the commit it waited for was refused. Your message is back.", and a send refused once they
  landed returns it the same way, "Not sent: it could not be sent.".
- **A feature starts without waiting (US4).** The New page's `Ctrl+Enter` writes the title, its
  line, its file, and the composer's text in one request, and opens the editor. Start, `Ctrl+Enter`,
  and `Enter` in the slug save the text typed, plan the start at once, and open the feature's
  session, its composer holding the workflow's message. Its steps show where the transcript will be:
  "Commit the proposal on <default branch>, running your hooks", "Make the branch <branch> and its
  worktree", "Start the agent with your message", each with its seconds, the hook's output as it
  comes. Send queues the message: "Your message is queued: the agent starts with it once the steps
  end.", and the human may leave the page. A refusal of the plan, a taken slug ("A feature named
  performance-pass exists already") or another, shows under the slug. A hook's refusal shows on the
  commit's step: "Nothing was committed: your proposal is in its file, as you left it.", the queued
  message back in a composer disabled with "Nothing started: start the proposal again from its
  file.". A start planned before midnight makes the folder its plan named.
- **The target is kept (US5).** `vp run performance` builds a release, serves the sandbox's
  realistic project and a clone of this repository with `main.ts`, and drives Chromium through each
  success criterion, timing from the press to the frame that draws the result. Each row names its
  requests' server time and the page's long tasks. A development build warns in the console,
  `[uraeda] <name> took <ms> ms`, for a click, a key, or a navigation past 100 ms. The last run, on
  2026-10-30: reloads, Start, and outside commits within target; 47 of 54 page rows within 100 ms,
  worst 189 ms on first visits of pages merged that day; the New page's proposal to its editor at
  142 ms; 6 of 8 reads right after a start, worst 203 ms on the clone's decisions page. These misses
  are accepted under the decision's SHOULD.
- **`ura` and the language server commit as before.** Deferral is the server's alone: through `ura`,
  a commit runs within the call, and a hook's refusal keeps the files written for a retry;
  `ura start` and the language server's start keep their refusal that leaves the moved files
  written.

## Design

The server reads git once and keeps what it read, and the browser keeps what it showed. Waiting
moves off the human's path: a committing call writes its files and defers its commit, and the
server's queue lands the commits in order. The core owns freshness, deferral, undo, and the start's
plan; the server owns the order of git writes and their record; the web UI only draws optimistic
results, the toast, and the start's steps.

- **The read cache and the write lock**, [`cache.rs`](/crates/core/src/cache.rs), one of each per
  repository, keyed by its main checkout. While a watch runs, each workspace read is kept per
  working tree until the next change: every file event the watcher sees and every write's end move a
  generation, and a read that raced a change never stores what it saw. Without a watch nothing is
  kept. The ledger, kept with `kept` and its decisions' dates read only from the commits since the
  tip it knew ([`ledger/dates.rs`](/crates/core/src/api/ledger/dates.rs)), and a feature's history,
  whose diffs' figures are kept by their commits
  ([`history/figures.rs`](/crates/core/src/history/figures.rs)), are kept the same way. A watch's
  start reads them ahead on a thread ([`warm.rs`](/crates/core/src/api/warm.rs)). The watcher,
  [`watch.rs`](/crates/core/src/watch.rs), ignores a file opened or read without a write.
- **A new worktree's index** is refreshed in a thread once the next whole second has begun, holding
  the write lock, only for a repository a server watches
  ([`git/refresh.rs`](/crates/core/src/git/refresh.rs)).
- **Deferred commits**, [`actions/deferred.rs`](/crates/core/src/actions/deferred.rs) and
  [`api/deferred.rs`](/crates/core/src/api/deferred.rs): with deferral on, which only the server
  turns on, a committing action records the files under its place's `specs/`, writes, and returns;
  `take_deferred` hands the commits to the queue, and `land` runs each with the hooks. `land` holds
  the write lock to stage and to put back, never while the hooks run. A refusal puts back each path
  only while it still holds what the write left, a deleted file included, from `HEAD` for an image,
  and names the rest. A commit whose files someone committed meanwhile lands as `HEAD`, its hooks
  not run. `git commit` streams its output line by line
  ([`git/process.rs`](/crates/core/src/git/process.rs) `run_streaming`).
- **The start**, [`api/start.rs`](/crates/core/src/api/start.rs): `plan_start` makes every check
  from the default branch's checkout, read from the cache, without the write lock, leaving
  uncommitted files to the start, and answers the folder, branch, title, and day. `start_planned`
  runs it on that day, with its steps through `on_step`. Where deferral is on, a hook's refusal
  restores the proposal, the typed change, and `PRIORITIES.md`, each only while it holds what the
  start left ([`start/restore.rs`](/crates/core/src/actions/start/restore.rs)).
- **The expected step**, [`api/expected.rs`](/crates/core/src/api/expected.rs): the step a folder
  will have once its uncommitted workflow files are committed, for the composer's message only while
  its commits are queued. The branch's step, `next_step` and every other read, still comes from its
  latest commit alone, as the Git decision asks.
- **One-request reads and writes**: `draft_proposal`
  ([`api/drafts.rs`](/crates/core/src/api/drafts.rs)) writes a proposal's line, file, and text in
  one call, its first read taken from the cache; `all_branch_changes`
  ([`changes.rs`](/crates/core/src/changes.rs)) reads every feature's changes, sent to the cards as
  counts only.
- **The write queue**, [`writes/queue.ts`](/packages/server/src/writes/queue.ts): committing calls
  run one at a time, each named by keys before it runs, `feature:<folder>` for a feature's files and
  `lists` for the default branch's lists, their rounds, and proposal files, and each waits for the
  queued commits of its keys. The commits land in order; the record, `WriteQueue`, is one live
  record of writes running, waiting, or refused, with a refusal's `failure`: `hook` (undone),
  `failed` (left written), or `unsent` (kept messages that could not be sent, their text in
  `queued`). Committing mutations go through
  [`fate/write-queue.ts`](/packages/server/src/fate/write-queue.ts), named by the button's `write`,
  its label and page.
- **The start through the queue**, [`fate/starts.ts`](/packages/server/src/fate/starts.ts):
  `feature.start` plans one start at a time per repository, answers with the plan and its workflow
  message, and queues the start in the committing calls' turn; it lets the lists' key go once its
  commit landed. Typed changes, a note's change, a session's move, and `feature.promote` run through
  the queue and answer once landed; a typed change holds its slug while queued. Steps:
  [`writes/start-steps.ts`](/packages/server/src/writes/start-steps.ts).
- **Kept messages**: a start's in
  [`runner/start-messages.ts`](/packages/server/src/runner/start-messages.ts), queued commits' in
  [`fate/commit-messages.ts`](/packages/server/src/fate/commit-messages.ts), sent in order by
  [`fate/kept-sends.ts`](/packages/server/src/fate/kept-sends.ts), in memory only; the workflow
  message reads the expected step through
  [`fate/workflow-step.ts`](/packages/server/src/fate/workflow-step.ts).
- **Live updates and timing**: the live bus in [`fate.ts`](/packages/server/src/fate.ts) sends a new
  subscription a record's update only when it changed in the last 2 seconds;
  `Server-Timing: app;dur=<ms>` on every response ([`app.ts`](/packages/server/src/app.ts)); libuv's
  thread pool sized one per core, 8 to 64 ([`threadpool.ts`](/packages/server/src/threadpool.ts)).
- **The browser's cache**, [`readAhead.ts`](/packages/web/src/readAhead.ts): every page's request
  retained, 1,000 a client, the oldest let go first; a kept page shown again draws from memory and
  reads again behind when it was away over 2 seconds; the selected row's page read ahead once the
  selection rests 50 ms; a spec read with its data model. Writes over a hash take it from what the
  browser holds ([`freshBase.ts`](/packages/web/src/freshBase.ts)).
- **Optimistic results**: fate's `optimistic`, for the lists in
  [`optimisticLists.ts`](/packages/web/src/optimisticLists.ts), settings in
  [`settings/optimistic.ts`](/packages/web/src/settings/optimistic.ts), an approval in
  [`review/approved.ts`](/packages/web/src/review/approved.ts), a sent message in
  [`sentMessages.ts`](/packages/web/src/sentMessages.ts). Left to the answer: answers, notes,
  comments, `text.save`, and the port and host name edits, whose fields already show the typed text
  and would lose it on a rollback; a new file's path, a new session, a change started, and the
  runner's actions, which only the core or the runner computes; adding or opening a repository; a
  row in a category not shown, whose place is the core's layout.
- **The toast and refusals**: [`writes/CommitToast.tsx`](/packages/web/src/writes/CommitToast.tsx),
  [`writes/RefusedHere.tsx`](/packages/web/src/writes/RefusedHere.tsx), and
  [`review/VerdictLeft.tsx`](/packages/web/src/review/VerdictLeft.tsx), fed by
  [`writes/useWriteQueue.ts`](/packages/web/src/writes/useWriteQueue.ts); returned messages in
  [`session/ReturnedMessages.tsx`](/packages/web/src/session/ReturnedMessages.tsx). `WriteButton` no
  longer blocks; [`writes/store.ts`](/packages/web/src/writes/store.ts) keeps only a card's action
  that is no git write, "Starting the agent…" or "Stopping…".
- **The start's page**: [`useStart.ts`](/packages/web/src/useStart.ts), shared by Start, its
  `Ctrl+Enter`, and the slug's `Enter`, keeps the plan in the document's memory, and
  [`session/StartingSession.tsx`](/packages/web/src/session/StartingSession.tsx) draws
  [`StartSteps`](/packages/web/src/session/StartSteps.tsx) until the start's write leaves the queue.
- **Pages**: each a lazy chunk, all fetched once the first page drew
  ([`pages.ts`](/packages/web/src/pages.ts)); a round's questions and a spec's parts below its first
  screen mount in steps after its first frame
  ([`useMountedSteps.ts`](/packages/web/src/layout/useMountedSteps.ts)), all at once when the page
  opens at a place of its own.
- **Timings**: [`slow.ts`](/packages/web/src/slow.ts) records `navigate <path>` and
  `interaction <name>` user timings in every build, and warns in development past 100 ms. The
  benchmark, [`scripts/performance.ts`](/packages/web/scripts/performance.ts) and its modules beside
  it, is `vp run performance` in [`vite.tasks.ts`](/vite.tasks.ts), outside `ready`. `live.bench.ts`
  and `smoke.ts --timed` keep other features' bounds.
- **Guides**: [surfaces](/specs/ui/surfaces.md#the-commit-toast),
  [space and motion](/specs/ui/space-and-motion.md), and [components](/specs/ui/components.md) say
  the toast and the queue.

## Replaced behaviour

- **A git write blocked the other writing buttons, and a thin bar ran at the page's top while it
  ran.** Guarded by `packages/web/src/__tests__/writes-store.test.tsx`: "a write started during
  another one keeps the bar until it ends", removed.
- **A git write showed its action on its item's card, until the server's status changed or 10
  seconds passed.** Guarded by the same file: "a commit shows on its card while it runs, then 10
  seconds at most", "the server's status for the item ends the action", "a failed write shows the
  server's status again at once", and "a write that fails after the server's status changed never
  shows its action again", removed with the file.
- **Start waited on the editor until the feature was made, then opened its session.** Guarded by
  `packages/web/src/__tests__/editor.test.tsx`: "Start saves the text typed, then starts the feature
  from it (US2 4)", rewritten as "Start saves the text typed, then opens the session at once (US4
  2)".
- **Through the web UI, a hook's refusal kept the files written for a retry.** Now undone by the
  queue; `ura` keeps it, so no test went:
  [`a_refused_commit_keeps_the_answers_and_can_be_tried_again`](/crates/core/tests/actions.rs) still
  guards it.
- **Every live subscription was sent its record's data once it started.** Guarded by
  `packages/server/src/__tests__/live.test.ts`: "a subscription is sent its entity's data once it
  starts", replaced by "a subscription made with nothing changed gets no update" and "a change
  published just before a subscription is sent to it". `commitArrival` in `live-stream.ts`, the new
  session's test in `session-moves.test.ts`, and the sign-out's test in `frames.test.ts` stopped
  waiting for that first update.
- **A commit's answer counted its changes as committed.** Through the server it may still count them
  until the queue lands: `inbox.test.ts`'s "US2 7: the commit bar commits the inbox's changes" waits
  for the queue first.

## Gotchas

- **The new worktree's index refresh waits for the next second**
  ([`refresh.rs`](/crates/core/src/git/refresh.rs)): git compares file times with the index's in
  whole seconds, so a refresh in the second of `git worktree add` leaves every file racily clean,
  and gix rehashes them on each read. Run beside direct core calls, the refresh made their git
  commands fail on `index.lock`: it runs only for a watched repository, under the write lock.
- **The cache's counts are `u32`** ([`cache.rs`](/crates/core/src/cache.rs)): napi-rs hands a `u64`
  to TypeScript as a `bigint`.
- **The watcher drops open and read events** ([`watch.rs`](/crates/core/src/watch.rs)): notify 8.2
  reports every file opened, and every read opens files, so each read would drop the cache it just
  filled.
- **A deferred commit checks its paths against `HEAD` before committing**
  ([`deferred.rs`](/crates/core/src/actions/deferred.rs)): git refuses an empty commit, and every
  failed `git commit` reads as a hook's refusal, which would undo committed files.
- **`run_streaming` reads stdout and stderr on a pipe each**
  ([`process.rs`](/crates/core/src/git/process.rs)): one merged pipe named a failure by another line
  than `run` does. A hook's lines keep their order: git gives a hook's stdout to its stderr.
- **A save made while a hook runs is not in that commit**: `git commit --only` takes the snapshot
  staged when it starts, which is why `land` can release the lock during the hooks.
- **Each binding call holds one of libuv's threads, 4 by default**
  ([`threadpool.ts`](/packages/server/src/threadpool.ts)): during a start, reads waited for a free
  one. `vp dev` sizes its pool before the server loads.
- **fate's `optimistic` changes only the record the mutation answers**: a move from the inbox to a
  level answers with the priorities, not the inbox, so they can open with the note
  ([`optimisticLists.ts`](/packages/web/src/optimisticLists.ts)). fate 1.12.2's fix of optimistic
  inserts is for list connections, which no page reads; fate went to 1.13.0 anyway, checked by
  `optimistic.test.tsx`.
- **fate's generated client passes no `gcReleaseBufferSize`**, so it kept 10 released requests:
  pages are kept with `retain` instead ([`readAhead.ts`](/packages/web/src/readAhead.ts)). Its
  `stale-while-revalidate` releases the request when a page leaves, so a page shown again would
  suspend: `show` reads behind instead.
- **fate counts a field an answer leaves out as missing**, and reads the record again: the server
  sends a proposal file's absent `folder` and `feature` as null
  ([`masked.ts`](/packages/server/src/fate/masked.ts)), so the editor draws from the draft's answer.
- **The navigation timing's end runs in a plain function** ([`slow.ts`](/packages/web/src/slow.ts)
  `drew`): inside the hook, React Compiler's output read the module-level variable already cleared,
  and the measure threw. Event timing starts at 16 ms, the browser's smallest threshold, so every
  interaction gets its timing; only the warning waits for 100 ms.
- **A round or a spec drew slowly from what it mounted**, not from its reads: layout effects that
  measure widths forced the first layout, growing with each question mounted
  ([`useMountedSteps.ts`](/packages/web/src/layout/useMountedSteps.ts)).

## Questions

### Round 01

#### Q1: Should the release build ship now, apart from this feature?

**Answer:** A: ship the release build for `vp run start` now, as its own change, "before the spec, I
guess it's mostly trivial"; debug stays for `vp run dev` and tests.

#### Q2: What should "no page over 100 ms" measure?

**Answer:** A: every click and key shows its first feedback, and every navigation draws, within 100
ms, a reload within 1 second. "Prefetch doesn't work well with keyboard navigation. Need a cache."

#### Q3: Where should values be cached ahead of time?

**Answer:** A: the server keeps its reading of the repository in memory, and the browser reads the
likely next pages ahead.

#### Q4: How should a commit show while it runs?

**Answer:** C: a commit shows its result at once, and a hook's refusal undoes it, "I want the UI to
feel instant, but we don't have to 'lie' to the user": navigate to where the commit leads, the
running commits in a glassy toast at the bottom right; the decision may change, and "commits
shouldn't really fail coming from us".

#### Q5: How should a draft become a feature?

**Answer:** A: Start lands at once on the feature's session, its steps listed there, with the
message queued in the composer until they end: "I want to be able to fully start a feature, session
included, and go continue working, without waiting at any point".

#### Q6: Should the target become a lasting rule?

**Answer:** A: a new Performance decision, checked by a benchmark on demand and a development
warning: "It's not a _hard_ target, but it's a SHOULD, for sure".

#### Notes

- **A page not drawn after 100 ms shows the thin top bar**: refused, "pages should simply ALL DRAW
  in 100ms": no page shows a loading state.

## Decisions

- [Performance](../decisions/performance.md), new: the server answers reads from what it already
  read, the browser keeps what it showed and reads the selected row's page ahead, a benchmark
  measures pages and actions on demand, and every page and action should draw within 100 ms.
- [UI behaviour](../decisions/ui-behaviour.md), changed: a write shows its result at once and leads
  on, a refused write puts back what it showed, a git write shows its progress in a toast, and git
  writes land in order without blocking the human, in place of a git write's action blocking the
  others.

## Changes after approval

- Both decisions were edited after the spec's approval, to fit main's decision format merged
  meanwhile: UI behaviour's four write rules, one claim each, bring it to 12 rules, which
  `the_ledger_reads_alone` in [`check.rs`](/crates/core/tests/check.rs) lists as approved over the
  10-rule warning, and the ledger's word limit there rose from 11,100 to 11,800. Performance's
  benchmark rule split from the development warning, and its 100 ms rule is now "Checked by the
  benchmark, against 100 ms and 1 second", as the ledger's test asks a check to name its times.
- The editor's save retries a conflict only when no other writer changed the text it was typed over,
  where the spec retried once in every case: a retry over another writer's text would lose it.
- Answers, notes, comments, text saves, port and host name edits, a new file's path, a new session,
  a change started, the runner's actions, and repositories added or opened show no optimistic
  result: their fields already show what was typed, or only the core or the runner knows the result.
- An approval reads Approved at its press, from the browser's copy of the core's block; Request
  changes still waits for the server.
- A message sent while a feature's commits are queued waits for them, not only during a start, and
  the composer's message reads the step those commits will give, a prediction the branch's step
  never uses. A refusal, or a send refused once they landed, returns the messages to the composer.
- A refused write says whether a hook refused it, undone, or its landing failed, left written, with
  Try again on a verdict's or a round's page.
- A deferred commit whose files were committed meanwhile lands as `HEAD`, and a refused one brings
  back the files it deleted, images included from `HEAD`.
- A landing and a start release the write lock while their hooks run, so saves go on meanwhile.
- A start's hook refusal is put back only where the server defers commits, and only for paths still
  holding what the start left; `ura` and the language server keep the files written.
- Changes' starts, a session's move to a change, and a change made a feature commit through the
  queue and answer once landed; a drop archives its sessions only once its commit landed.
- One start is planned at a time per repository, a typed change's slug is held while queued, and a
  start runs on its plan's day. A worktree folder already there is a taken slug, and the language
  server's start now reads "A feature named <slug> exists already".
- The New page's draft writes the composer's text too, and the cards' record carries counts only.
- A live subscription is sent a record only when it changed in the last 2 seconds; a kept page shown
  again after 2 seconds reads behind.
- The ledger and features' histories are kept like the workspace and read ahead when a watch starts,
  and the server's thread pool grows past 4: the first benchmark run missed on them.
- A round's questions and a spec's lower parts mount in steps after the first frame, and a spec
  reads its data model with it.
- The selected row's page is read ahead only once the selection rests 50 ms.
- The plan expected every criterion within target; the last benchmark run's misses are accepted
  under the decision's SHOULD.

## Follow-ups

- The benchmark's last misses, each a page's own drawing or a read during a start: first visits of
  newly merged pages up to 189 ms, the New page to its editor at 142 ms, and the clone's decisions
  page right after a start at 203 ms. An approval would draw faster if a review and a read spec
  shared their components.
- The editor's conflict retry, for the human to settle on the pull request.
- Messages kept for a start or queued commits live in memory: a server that stops drops them, and an
  abrupt stop leaves an empty session.
- Left in the inbox from before: the performance pass's mockups that did not work locally.
