# Rulings: Performance pass

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Commits are deferred only for the server

- **Decision**: the core defers a commit only for a repository the server turned deferral on for.
  `ura` and every other caller commit within the call, as before.
- **Rationale**: the queue is the server's ([spec](spec.md#architecture)); the CLI has no queue to
  land a deferred commit, and its tests guard today's behaviour.
- **Alternatives considered**: deferral everywhere, which would leave `ura`'s commits unmade.
- **Where**: task 7.

## R2: Through the server, a commit a hook refuses is undone, not left written

- **Decision**: a refused commit landed by the queue puts back what its write left, Markdown file by
  file, from what each held before the write. Through `ura`, the files stay written, as before.
- **Rationale**: the approved spec says "A hook's refusal undoes it", and its scenario US3 3 reads
  the spec as awaiting review again. Its replaced-behaviour list does not name today's rule, that a
  refusal keeps the files written for a retry: the pull request names it, and no test of it goes,
  since `ura` keeps it.
- **If wrong**: the undo is one function, `undo` in `actions/deferred.rs`; dropping it brings back
  the files left written, which the commit page and its retry already handle.
- **Where**: task 7.

## R3: The write's "before" is every Markdown file of its place's `specs/`

- **Decision**: deferral records, as its place is reached, the list of files under `specs/` and the
  bytes of each Markdown file; undo restores a path only while it still holds what the write left.
- **Rationale**: the paths a write touches are known only when it commits, and the writes go through
  about 100 file calls across the actions. Uraeda's own `specs/` has 134 Markdown files, 0.9 MB,
  read in a few milliseconds; its 24 MB are images, which writes add under new names.
- **Alternatives considered**: routing every action's file write through a recorder, a change to 100
  call sites; restoring the committed version, which loses answers saved before a submit.
- **Where**: task 7.

## R4: A new subscription gets a record's update only if it changed in the last 2 seconds

- **Decision**: the live bus keeps when it last sent each record, and replays it to a new
  subscription only within 2 seconds.
- **Rationale**: the update covered a change made between a page's read and its subscription, a few
  milliseconds apart; fate's bus has no version to compare.
- **Where**: task 4.

## R5: The hook's output streams for the start and every landing, the toast shows it on refusal

- **Decision**: `land` and the start stream git's output; the start's steps show it as it comes, and
  the toast shows a write's output only once refused, as its mockup does.
- **Rationale**: the [mockups](spec.md#us3-commits-land-behind-a-toast-p1) show the output on a
  refusal in the toast, and while the commit runs in the start's steps.
- **Where**: tasks 7, 11, and 14.

## R6: A write's label and where it opens come from the web UI

- **Decision**: committing mutations take `write: { label, href }` from the button that started
  them, its running text and its page.
- **Rationale**: the buttons already hold those texts; the server would need each feature's title
  and the UI's paths to build them.
- **Where**: tasks 12 and 14.

## R7: The benchmark is a script of the web package

- **Decision**: `packages/web/scripts/performance.ts`, run by `vp run performance`, outside `ready`.
- **Rationale**: it drives the sandbox with Playwright, as the screenshot scripts there do;
  `benchmarks/` holds the workflow's agent benchmarks, a different thing.
- **Where**: task 16.

## R8: A new worktree's index is refreshed only once its files are a second old

- **Decision**: after `git worktree add`, the core refreshes the new worktree's index in a thread of
  its own, once the next whole second has begun, and the start answers without waiting for it.
- **Rationale**: measured on a clone of Uraeda (2,751 files) with the release binding, medians of 5
  reads of `readWorkspace`, over three runs: 34 to 36 ms before; 230 to 236 ms right after
  `git worktree add` of a feature branch; 228 to 236 ms after `git update-index -q --refresh` run
  right after the add; 46 to 50 ms after the same refresh in a later second; 45 to 49 ms once
  `git status` had run. Git compares the files' times with the index's in whole seconds, so a file
  written in the index's second stays racily clean through a refresh in that second, and gix
  rehashes it on every read. The 12 ms left over the first read is the status every read runs of a
  checked-out feature, which the read cache (task 3) removes. With the change, a start through the
  binding took 344 ms, against 290 ms before, and the reads 2 seconds later 54 ms, against 256 to
  796 ms before.
- **Alternatives considered**: refreshing right after the add, which the measures show does nothing;
  waiting for the next second inside the start, up to 1.2 s more for every start.
- **If wrong**: the refresh takes the index's lock for about 185 ms, a second after the start; a
  `git add` or `git commit` in the new worktree at that moment fails on `index.lock`, and works when
  run again.
- **Where**: task 1.

## R9: fate's check is of an optimistic field through a live update, and it passes on 1.12.1 too

- **Decision**: fate goes to 1.13.0, pinned in the server's and the web's `package.json`, where it
  was, not in the catalog. The test holds `inbox.add` at the browser with an optimistic
  `categories`, lets the server's watcher send the inbox's live update and a refresh on show, then
  releases the add, which the server refuses for its stale hash. It passes on 1.12.1 and 1.13.0: it
  fails when fate writes a live update over the optimistic layer, and when its rollback keeps the
  layer (both checked by breaking fate's installed code).
- **Rationale**: 1.12.2's fix is for fate's list connections (`insert.into`), and every list of
  Uraeda's records, the inbox's notes included, is a JSON field: the bug cannot reach the app, and
  the optimistic results tasks 9 and 10 give are field values, the case checked. While the add
  waits, its whole `categories` stays shown, so a note from elsewhere shows once it settles.
- **Alternatives considered**: a fate list to reproduce the 1.12.2 bug, which no page reads.
- **Where**: task 2.

## R10: The Performance decision's check names its times

- **Decision**: the rule "Every navigation and every action SHOULD draw its result within 100 ms,
  and a reload within 1 second" is now "Checked by the benchmark, against 100 ms and 1 second."
- **Rationale**: the ledger's test, `no_decision_names_a_mechanism_its_checks_do_not`, requires a
  rule's check to name the times its rule names, and failed on the approved text. Wording only: the
  rule is unchanged. The edit needs the human's approval again, with the pull request.
- **Where**: `specs/decisions/performance.md`, before task 1.

## R11: The cache's counts are 32-bit, and opening a file is not a change

- **Decision**: `CacheStats` counts in `u32`, saturating, not `u64`. The watcher ignores the events
  of a file opened, read, or closed without a write, for the cache and for its 200 ms burst alike.
  The cache keeps one read per working tree the repository is read from, and the settings' and the
  repository list's writes take the lock of their own folder.
- **Rationale**: napi-rs gives a `u64` to TypeScript as a `bigint`; a `u32` is a number, and 4
  billion reads is more than a server's run. notify 8.2 reports every file opened, and every read
  opens files: each read would drop the cache it just filled, and start a new burst of the watcher.
  A workspace read from a worktree differs from the main checkout's, its current branch and the
  files of `.`, so one read cannot answer for both.
- **Alternatives considered**: a `bigint` in the server's timing header; keeping the open events and
  invalidating only on the others, two filters for one question.
- **Where**: task 3, `crates/core/src/cache.rs` and `crates/core/src/watch.rs`.

## R12: Three tests stop waiting for the update every subscription was sent

- **Decision**: `commitArrival` in `live-stream.ts`, the new session's test in
  `session-moves.test.ts`, and the sign-out's test in `frames.test.ts` no longer wait for an update
  sent at a subscription's start; the sign-out's counts the updates after it.
- **Rationale**: they used that update to know the subscription had started, and R4 sends it only
  for a record changed in the last 2 seconds. What each test checks, the update after a change, is
  unchanged. The plan named only `live.test.ts`.
- **Where**: task 4.

## R13: The browser keeps 1,000 requests a client, retained by the pages' hooks

- **Decision**: every page's request is retained with fate's `retain` from `useRefreshOnShow`, which
  each page's hook calls, and from the read ahead of a selected row's page: 1,000 requests a
  repository's client, the one used longest ago let go first (`keep` in `readAhead.ts`).
- **Rationale**: the client fate 1.13.0 generates from the server's types takes `fetch`, `headers`,
  `liveRetryMs`, `liveUrl`, `onLiveError`, `persistence`, and `url`, and passes no
  `gcReleaseBufferSize` to fate's `createClient`, whose default keeps 10 requests no page shows.
  `retain` is fate's public way to keep a request's data. Uraeda's own `specs/` is 134 Markdown
  files, 0.9 MB (R3): 1,000 requests cover every page of a session over a repository that size, a
  few megabytes at most.
- **Alternatives considered**: setting the field fate keeps the number in after creating the client,
  which its types hide and a release may rename; making the client with `createClient`, which needs
  the generated module's roots and mutations, not exported.
- **If wrong**: the number is `KEPT_REQUESTS`. A page kept but not shown has no live subscription:
  shown again, it draws what it held, and its new subscription brings what changed since only within
  R4's 2 seconds, or at the next change or show of the tab.
- **Where**: task 5.

## R14: The reads after a write stay, and so do the reads that find what a write wrote

- **Decision**: `rereadChanges` still reads the inbox and the priorities after a write, and the
  reads that look for what a write left, the moved note's row (`movedInto`), a note's file
  (`noteOfFile`, `addedAfterAll`), and the proposal a sidebar add's Undo takes out, still read the
  server. Only the reads of a hash a write is made over read the browser's copy, through
  `withFreshBase`.
- **Rationale**: the live update sends both records only when one's text changed (`publish` in
  `live.ts`), and a commit or a discard on the commit page changes the count of changes both carry
  without that. `rereadChanges` runs after the write's answer and nothing waits for it, so it costs
  the human no time. A read that finds a row by its text cannot tell a stale copy from a row gone:
  no conflict says so.
- **Where**: task 5.

## R15: The fresh base is whatever a write is made over, not only a hash

- **Decision**: `withFreshBase<B, T>(read: (mode) => Promise<B>, write: (base: B) => Promise<T>)`.
- **Rationale**: a note made a proposal file is written over both files' hashes, and a title is
  inserted at an index computed from the priorities its hash is of: a retry reads both again.
- **Where**: task 5.

## R16: The interactions' timings start at 16 ms, and the warning at 100 ms

- **Decision**: `slow.ts` observes event timing with `durationThreshold` 16, not 100. Every click
  and key the browser times gets its `interaction <name>` user timing, in every build; the console
  warns only in development, and only past 100 ms.
- **Rationale**: the plan's interface gives task 16's benchmark an `interaction <name>` timing for
  each click or key, which a threshold of 100 would drop for every interaction under it. 16 ms is
  the smallest threshold the browser takes: an interaction quicker than it gets no timing, and is
  well within the target.
- **Alternatives considered**: two observers, one at 100 for the warning: the same entries twice.
- **If wrong**: the benchmark reads only the slow interactions, by filtering the timings over 100
  ms.
- **Where**: task 6.

## R17: A kept page shown again is drawn from memory, and read again behind after 2 seconds away

- **Decision**: the page hooks of `data.ts` keep reading `cache-first`. `useRefreshOnShow` calls
  `show` (`readAhead.ts`): a kept page's data is drawn at once, and, when it was last known current
  more than 2 seconds before, read again from the server with `network-only`, behind, which the
  page's live view then draws. A page's data is current while the page is on screen, and when it is
  first read or read ahead.
- **Rationale**: a page off screen has no live subscription (R13), and a new one is sent only what
  changed in the last 2 seconds (R4): a page shown again after an older change would draw old data
  until the next change. fate 1.13.0's `stale-while-revalidate` does the same refresh, but its
  request is released when the page leaves, so each show starts a new one whose promise is pending
  until a microtask: `use` suspends there, and a page mounted outside the deferred route's render
  could draw its Suspense fallback for a frame (read in fate's source, not measured). It would also
  read the server again for a page just read ahead.
- **Alternatives considered**: `stale-while-revalidate` on every page hook, for the reasons above.
- **If wrong**: the window is `REPLAYED_MS`, which must not exceed the server's `LIVE_REPLAY_MS`.
- **Where**: review of tasks 4 and 5.

## R18: The cache's counts serve the core's tests, not the server's timing

- **Decision**: Task 3's interface says `cache_stats` serves the core's tests, and the binding's
  `cacheStats` lets the benchmark read it; the server's `Server-Timing` sends only `app;dur=<ms>`.
- **Rationale**: task 4 built `Server-Timing` as the time of each response, which is what the spec
  asks of it, and no code reads `cacheStats` there. The plan's text said otherwise.
- **Where**: review of task 3.

## R22: The draft writes the composer's text too

- **Decision**: `api::draft_proposal(repo, section, title, body)` takes the composer's text and
  writes it under the file's heading, after a blank line, in the same call. A blank `body` writes
  nothing more. The web UI's `proposals.draft` sends it, so the New page's `Ctrl+Enter` is one
  request whatever the composer holds.
- **Rationale**: the New page's feature composer always holds text, its title asked apart: without
  the text, the draft would still need the browser's read of the file and its save, two more calls,
  and US4 1 asks for one request. The core reads the file it just wrote, so no hash can be stale.
- **Alternatives considered**: the plan's `draft_proposal(repo, section, title)`, followed by the
  browser's `text.save`, two requests in sequence.
- **Where**: task 8.

## R23: Every feature's changes are listed by folder, and the cards' record carries only counts

- **Decision**: `changes::all_branch_changes(repo) -> Result<Vec<FeatureChanges>>`, each
  `FeatureChanges { folder, changes: BranchChanges }`, leaves out a feature without a branch,
  merged, or whose diff failed. The server's `AllBranchChanges` record sends each feature's folder,
  count, and lines added and removed, without the files, and `failed` when the read as a whole
  failed.
- **Rationale**: a `Vec<BranchChanges>`, as the plan named it, says not whose changes each is. A
  card shows only the lines added and removed: up to 50 files per feature would be sent for nothing.
  A card without its counts loses nothing it needs, and the feature's own page reads its changes and
  says when they failed.
- **Where**: task 8.

## R24: The cards' record is read again once when the tab comes back

- **Decision**: `useCardChanges` (`branchChanges.ts`) keeps the one request as `useRefreshOnShow`
  does, through `show`, but its read on the tab's return is shared by every card, not one per card.
- **Rationale**: every card calls the hook; `useRefreshOnShow`'s listener per card would send the
  same request once per card, which the one record exists to avoid.
- **Where**: task 8.

## R25: The editor's save retries a conflict only over the text it was typed over

- **Decision**: on a `conflict:` refusal, the editor's `text.save` reads the file again and writes
  once more over its new hash only when the file still holds the text the save was typed over, its
  frontmatter and the field's base: a stale hash the browser held, not another writer. When the text
  differs, the conflict shows as before, with "Copy my text" and "Load the new version".
  `withFreshBase` takes the check as its third argument, `retries`.
- **Rationale**: the spec's US2 more 1 says the browser "retries once". A retry over another tab's
  or an agent's change would overwrite their uncommitted text, which the
  [Git decision](../decisions/git.md) forbids: "Tools MUST NOT lose the user's work".
- **If wrong**: a retry over any change is `withFreshBase` without its third argument, in
  `useProposalEditor.ts`. The human settles it on the pull request.
- **Where**: task 9, from a review finding.

## R26: A write whose call site draws its own result passes no optimistic result

- **Decision**: the answers (`answer.save`, `defaultRound.answer`), the round's notes (`notes.save`,
  `defaultRound.notes`), the review's and the settled comments' adds, edits and removals,
  `text.save`, and the settings page's port and host name edits pass no `optimistic`. Each already
  shows its result at once: the letters picked in `useAnswer`'s state, the text in its field, the
  comment being added in `useReviewActions`'s `adding`.
- **Rationale**: a field of the unsaved store drops its unsaved text once the record holds that text
  (`useTextField`); an optimistic text would drop it while the write is sent, and a refusal's
  rollback would then lose what the human typed, which the Git decision forbids. `useAnswer` takes a
  record change as the file's answer (`useSave`'s `settle`), so a rollback would count a refused
  answer as saved. A removal renumbers the comments after it, which only the core does: shown before
  the server answers, the comments keep their old numbers, and a Commit sent then wrote a kept edit
  to no comment (`round.test.tsx`'s "Commit writes the edit of a comment renumbered by a removal
  into that comment" failed, and `review.test.tsx`'s "an edit of a review comment follows it" too).
- **If wrong**: each such call needs its field to keep its unsaved text until the write's answer,
  and a removal its renumbering, before it takes an optimistic result.
- **Where**: task 9.

## R27: Adding a repository and opening one pass no optimistic result

- **Decision**: `repositories.add` and `repositories.open` pass no `optimistic`, and neither does
  removing the current repository or a missing one's page.
- **Rationale**: an added row's name and path are the core's, read from the folder. Opening is sent
  on each switch, and moves the row first in a menu that is closed by then. Removing the current
  repository, or the missing one shown, would draw the unknown repository's page until the removal
  is done and the page moves on.
- **Where**: task 9.

## R28: Optimistic results cover the write's own record, from what the browser holds

- **Decision**: a list's or a session's write passes fate's `optimistic` with the fields of the
  record it answers that the input decides: the inbox's `categories`, `count`, and `names`, the
  priorities' `sections`, a session's `title`, `archived`, `unseen`, and `allowable` after "Allow
  all". A row added, or put back by an Undo, gets a temporary id, `optimistic:<n>`, and a key,
  `pending:optimistic-<n>`, which the outliners take for a row not written yet, until the answer's.
  Its spans are its text, plain, as the outliners draw a row not written yet. The calls left to the
  server's answer: those whose result only the core or the runner computes, a new file's path
  (`proposals.expand`, `inbox.intoProposal`, `inbox.intoProposalLine`), a new session
  (`session.newChat`), a change started (`session.toChange`, a commit), a category deleted with its
  notes kept, whose notes the core places, `inbox.restoreCategory` and `inbox.restoreImage`, which
  write a file's text back, `session.allow`, `session.stop`, and `session.takeBack`, whose effects
  the runner decides or the transcript's pages hold, not the session's record. A move from the inbox
  under a proposal shows the note gone at once; the priorities show it once the move answers, and
  the page opens there then. A move to a level of the priorities answers with them instead (R37).
- **Rationale**: fate's `optimistic` changes only the record the mutation answers, and the inbox's
  moves answer the inbox: the priorities are another record, which no public fate call writes to.
  The Stack decision keeps what the core computes, ids, keys, a note's lines, a hash, out of
  TypeScript. A temporary key the outliners take as pending keeps a key or a click from writing to a
  row the file does not have yet.
- **Alternatives considered**: writing the priorities' record in fate's store by its internal
  `write`, which its types expose but its docs do not; a move answering both records, a server
  change outside this task's files.
- **If wrong**: a move's optimistic priorities need the server to answer it with both records.
- **Where**: task 10.

## R29: A sent message shows from the browser until the transcript draws the server's

- **Decision**: a message the composer sends to a session, not the workflow's, shows at once at the
  end of the transcript as the human's message not read yet (`sentMessages.ts`, `SentMessage`), and
  goes once the send answers: refused, at once, its text back in the composer as before; sent, once
  the browser holds the new turn it started and that turn's last page, or at once when it went into
  a turn the transcript already draws.
- **Rationale**: the transcript's messages are items of `TurnLog` pages, which `session.send` does
  not answer: its optimistic result could only change the session's record. The turn, the message's
  ID, and its place are the server's. Reading the new turn before the message goes leaves no gap
  where neither shows. The workflow's message may start a new session the page then opens.
- **Alternatives considered**: a temporary turn in the session's `turns`, which the transcript would
  read from the server, and fail to find.
- **If wrong**: a message steered into the running turn can show twice for the moment between its
  live update and the send's answer.
- **Where**: task 10.

## R30: The outliners wait for the version the browser holds, not up to 2 seconds

- **Decision**: the outliners keep drawing their own results ahead of the file, and each write still
  goes over the version the one before it left. `useWritesInTurn` no longer waits up to 2 seconds
  for the list to show another version: once a write resolves, fate holds its answer, and the next
  write waits only until that version is drawn, or not at all when it is the version drawn, as after
  a write that left the file as it was. A list no longer drawn lets its writes go on.
- **Rationale**: the outliners' rows not written yet are their own pending rows, dropped once the
  drawn version is past theirs: a write over a version not drawn yet would drop the next row's
  pending text before the file has it. Their edits, indents, and drops are the core's outline edits,
  which an optimistic `categories` or `sections` would compute in TypeScript.
- **Where**: task 10.

## R34: A deferred commit whose files are committed already lands as `HEAD`

- **Decision**: before it commits, `land` checks each of the change's paths against `HEAD`, on disk
  and in the index. When none differs, someone committed the files since the write: it lands with no
  commit, its hooks not run, nothing put back, and returns the change with `HEAD`'s short hash as
  its commit.
- **Rationale**: git refuses a commit with nothing in it, and every failed `git commit` is a hook's
  refusal to `land`, which undoes the write: it would have put back the text before the committed
  one, in the working tree only, and reported a refusal no hook made. The files are committed, as
  the action wanted; an amend over them would rewrite a commit not the action's.
- **Alternatives considered**: an "already committed" error, which the server would show as a
  failure though nothing failed; telling git's "nothing to commit" apart by its text, which depends
  on git's language and runs the hooks first.
- **If wrong**: a deferred commit whose files someone committed reports `HEAD` as its own commit.
- **Where**: `crates/core/src/actions/deferred.rs`, review fix.

## R35: A streamed commit reads stdout and stderr apart, and names a failure by stderr first

- **Decision**: `run_streaming` reads the process's stdout and stderr from a pipe each, on a thread
  each, and gives `on_line` each line as it comes, merged in that order. A failure's message is
  stderr's first line that is not blank, then stdout's, as `run` names it; its output is all the
  lines, merged. A read error stops the process and fails the command.
- **Rationale**: one pipe for both kept the order as printed, but lost which stream a line came
  from, so a failure streamed was named by another line than the same failure within the call. A
  hook's lines keep their order: git gives a hook's stdout to its stderr.
- **Alternatives considered**: one merged pipe with the message from its first line, which named a
  failure by git's stdout when it printed first.
- **If wrong**: a line git prints to stdout can show before or after a line of stderr printed just
  before or after it.
- **Where**: `crates/core/src/git/process.rs`, review fix.

## R31: A start puts back its proposal on a hook's refusal only where commits are deferred

- **Decision**: `api::start_feature` and `api::start_change` restore the moved proposal file, the
  typed change's folder, and `PRIORITIES.md` on a hook's refusal of the start commit, as a `hook`
  error with its output, only in a repository the server turned deferral on for. `ura start`, the
  language server's `uraeda.start`, and every other caller keep today's `Partial` refusal, the files
  left written for the start to be finished by hand. The steps go to `on_step` everywhere.
- **Rationale**: the global constraint keeps "`ura` and every core call made without the server's
  deferral" committing as today, which R2 applies to the other commits. The language server calls
  the same API, and its `a_failing_hook_lists_the_files_written` guards the files left written.
- **Alternatives considered**: restoring on every API start, which breaks the language server's
  behaviour and that test; restoring only when an `onStep` is given, which ties the rule to a
  listener.
- **If wrong**: `restore` in `steps_run` of `api/start.rs` is the one switch.
- **Where**: task 11.

## R32: Only a feature's taken slug is refused in the spec's words

- **Decision**: a start refused because a record, a branch, or a folder holds its dated folder is
  `StartError::Taken`, whose text stays `<folder> exists: choose another slug with --slug`. The API
  refuses a feature's as "A feature named <slug> exists already", the spec's words. A change's keeps
  the core's text, as `ura` does, since the server's `session-moves.ts` reads its folder from it and
  rewords it, and `sessions.test.ts` checks it.
- **Rationale**: the spec's edge case is the feature's editor; the change's card already has its own
  words.
- **Where**: task 11.

## R33: The start's plan reads the default branch's checkout, without the write lock

- **Decision**: `api::plan_start` makes every check of the start from the checkout that has the
  default branch, read from the cache, and takes no write lock, so a queued commit never delays it.
  Only when no checkout has the default branch does it reach one, as the start would, creating its
  worktree.
- **Rationale**: the start's checks read that checkout's proposal file and priorities; without one,
  there is no file to plan from, and the start itself would create it next.
- **Where**: task 11.

## R37: A note moved to a level answers with the priorities, which open on it at once

- **Decision**: `inbox.toProposal` answers with the `Priorities` record, not the `Inbox`. `p` to
  Now, Next, or Later passes the priorities the browser holds with a line of the note's text, plain,
  at the end of the level, under a temporary id and `pending:` key (R28), and opens the priorities
  at once, before the answer. Once the move answers, its toast shows, and the page selects the line,
  the last of its level in the answer: `selectOnArrival` names it in the history entry the page
  opened on, which the list follows while it is still that entry. The inbox follows by its live
  update and the read of both files for the commit tab. A refusal shows in the page, under the top
  bar, as the inbox is left.
- **Rationale**: the spec's US2 key scenario 2 has the priorities open with the note within 100 ms,
  and fate's `optimistic` changes only the record the mutation answers. The core always writes the
  moved note at the end of the level the input names, so the line's place is the input's, not
  ordering logic copied from the core. The note's nested items, its lines, and its key are the
  core's, so they come with the answer.
- **Alternatives considered**: a move answering both records, which fate's mutations do not; writing
  the priorities in fate's store by its internal `write`.
- **If wrong**: a refused move shows its line in the priorities until the refusal, then takes it
  back, the page already open there.
- **Where**: review of the web UI's writes.

## R38: A setting's optimistic result is its saved value, never the value in force

- **Decision**: a switch of the settings page, and a host name's removal, pass fate's `optimistic`
  with the setting's `saved` value only, the value the input writes to the file; its `inForce` and
  `source` stay as they were until the answer. The switches show `saved`, else `inForce`, as the
  browser and the port already did. An added host name has no optimistic result: the core trims it
  and puts it in lower case.
- **Rationale**: which of a flag, a variable, the file, or the default gives a value is the server's
  order, kept in one place, `settings.ts`'s `inForce`. The page computed it again to show a value in
  force at once: a copied rule, which drifts once a setting gets a flag.
- **If wrong**: a setting a flag or a variable gives for the run shows its saved value in its
  switch, as the browser's already did, with the run's value in its note.
- **Where**: review of the web UI's writes.

## R39: An optimistic row goes only where its input names, among the rows shown

- **Decision**: an optimistic result of the inbox or the priorities removes rows, or puts a row at
  the place its input names among the rows shown: the end of a category, or the index an Undo writes
  it back to. A note added to, or put back in, a category that shows no notes, or the notes without
  one when none show, has no optimistic result: the answer draws it.
- **Rationale**: where a category not shown goes among the others, the notes without one first, then
  the order of `names`, is the core's layout of the file, which the Stack decision keeps out of
  TypeScript.
- **If wrong**: a note added to an empty category shows once the add answers.
- **Where**: review of the web UI's writes.

## R41: A committing call waits for the queued commits of its keys, named before it runs

- **Decision**: each committing mutation names keys before its core call: `feature:<folder>` for a
  feature's file (answers, verdicts, retries), `lists` for the default branch's lists, their rounds,
  their commit bar, Undo of a committed add, and a proposal file's commit, and both for a drop. A
  call waits until no commit of the same keys is still queued, then runs in the queue's turn, one
  call at a time, and takes its deferred commits before the next call runs. A refused commit no
  longer holds its keys. The removal of a note `change.fromNote` commits goes through the queue too,
  under `lists`.
- **Rationale**: a commit's paths are known only once its call ran, and the core counts a file whose
  commit has not landed as changed: a second write to it would not defer its commit, or would commit
  the first one's file with its own. The lists amend each other's commits and take each other's
  files along, so they share one key. Every call that defers must take its commits, or the next
  call's take would hand them out as its own.
- **Alternatives considered**: waiting for every queued commit, which serializes writes of different
  features behind a slow hook; matching paths, which a call knows only after it wrote.
- **If wrong**: a write to a list waits for the lists' commits queued before it, a hook's time each.
- **Where**: `packages/server/src/writes/queue.ts`, `packages/server/src/fate/write-queue.ts`,
  task 12.

## R42: The queue's order is checked over a core the test settles, and its record through the server

- **Decision**: "writes land in order" checks the refusal, the record a second read gets, and the
  commits' order through the server with a real hook; its rows of landings held at once and of a
  write waiting for its key's commit run the queue over a core whose landings the test resolves.
  `writes.dismiss` lives in `fate/mutations.ts`, next to the other repository mutations.
- **Rationale**: the core's `land` holds the repository's write lock while the hook runs, so a
  second write through the server waits in the core until the first commit lands: two landings at
  once, or a write run before its key's commit landed, would be serialized by the core's lock by
  chance, and the breaks would pass. `fate/write-queue.ts` is imported by the sources the mutation
  masks its answer with: the mutation there would import them back.
- **Where**: `packages/server/src/__tests__/write-queue.test.ts`, task 12.

## R43: A commit's answer may still count its changes as waiting

- **Decision**: through the server, a commit answers with what its files hold before the commit
  lands: the commit bar's answer can still count the changes it commits, until the queue lands them
  and the watcher sends the lists again. "US2 7: the commit bar commits the inbox's changes" now
  waits for the queue before it reads the count and the log.
- **Rationale**: the count is git's, of files not committed yet; the spec has the toast say what is
  still landing, and the optimistic results of the web UI draw the commit bar's state.
- **Where**: `packages/server/src/__tests__/inbox.test.ts`, task 12.

## R45: A landing holds the write lock to stage and to put back, never while its hooks run

- **Decision**: `land` takes the repository's write lock for the "already committed" check and the
  staging of the change's paths, releases it while `git commit` and its hooks run, and takes it
  again to unstage on a refusal, to stage again when an amend is refused, and to put back the
  write's files; dropping it last moves the cache's generation. Any other core write, a save
  included, runs while a hook runs.
- **Rationale**: the spec has no write block the human, and a call waiting on the lock holds a libuv
  thread. Staging and committing apart is safe: the server's queue lands one commit at a time, and
  starts in the same turns; a deferring write never touches the index, only the working tree; a save
  made during the hook changes the working tree, not the snapshot staged, which `--only` takes when
  `git commit` starts; and undo puts back only a file still holding what the write left, so a file
  saved meanwhile is left and named.
- **If wrong**: a save made while a hook runs is not in the commit, and stays uncommitted, as a save
  made after it.
- **Where**: `crates/core/src/actions/deferred.rs`, `crates/core/src/actions/commit.rs`, review of
  task 12.

## R46: A refused start puts back only what still holds what the start left

- **Decision**: a hook's refusal of the start commit, in a repository the server defers commits for,
  puts each path back only while it holds what the start left there: a moved file, its bytes
  compared, returns to its old path only when no file is there; the proposal's text before its
  nested lines is written only over the carried text; a file the start wrote in the dated folder is
  removed only unchanged, and the folder only once empty; `PRIORITIES.md` gets its text back only
  while it holds the start's. Any path left so is named in a `Partial` refusal, "check <path>:
  changed during the commit, left as it is", the rest put back.
- **Rationale**: the hook runs while other writes, saves included, go on: a put back without a check
  would write over them, as deferred commits' undo never does.
- **If wrong**: a start refused by a hook leaves a file someone changed meanwhile, and the human
  sorts it out from the refusal's list.
- **Where**: `crates/core/src/actions/start/restore.rs`, review of task 11.

## R47: A start's plan leaves the uncommitted and staged files to the start

- **Decision**: `plan_start` makes every check of the start, the slug's, its folder's, and the
  proposal file's, but not those of uncommitted or staged files outside the proposal file and
  `PRIORITIES.md`: the start makes them in its turn, in the server's queue.
- **Rationale**: a write queued before the start leaves its files written and not committed until it
  lands; the plan, answered at once, would refuse a start that succeeds once the queue reaches it.
- **If wrong**: a start planned over someone's uncommitted work is refused in its turn, after the
  plan's answer, with the same message.
- **Where**: `crates/core/src/actions/start/plan.rs`, `crates/core/src/api/start.rs`, review of
  task 11.

## R48: A folder where the worktree goes is a taken slug, and the editor's start says so

- **Decision**: a start whose `.worktrees/<folder>` exists is refused as a taken slug, like a
  folder, a branch, or a record holding the name: through the API, a feature's reads "A feature
  named <slug> exists already"; `ura` and a change's keep the core's "cannot create the worktree:
  .worktrees/<folder> exists". The language server's start, which calls `api::start_feature`, now
  reads "A feature named <slug> exists already" for any taken slug, where it read the core's
  "<folder> exists: choose another slug with --slug".
- **Rationale**: the worktree's folder takes the name as the others do, and is no git failure. The
  editor has no `--slug` to choose another with: the feature's name fits it better than a hint at a
  flag it cannot pass.
- **If wrong**: the editor names the feature, not the folder that takes its name.
- **Where**: `crates/core/src/actions/start/plan.rs`, `crates/lsp/src/commands.rs`, review of
  task 11.
