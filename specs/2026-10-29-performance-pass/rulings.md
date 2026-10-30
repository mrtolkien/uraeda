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
  run again. The refresh holds the repository's write lock, and runs only for a repository a server
  watches: a refresh beside direct core calls, as the core's tests make, failed their git commands
  on `index.lock`, and a process that exits, as `ura`'s, never lives to run it.
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
  `writes.dismiss` lives in `fate/writes-mutations.ts`, apart from the queue's record.
- **Rationale**: when this was ruled, the core's `land` held the repository's write lock while the
  hook ran, so a second write through the server waited in the core until the first commit landed:
  two landings at once, or a write run before its key's commit landed, were serialized by the core's
  lock by chance, and the breaks passed. Since R45, `land` lets the lock go while the hook runs, so
  the real core no longer hides them: a second landing would now fail on `index.lock`, or a write
  would commit another's file. The rows stay over the settled core all the same: they check the
  exact order of the queue's calls and landings, which with a real hook only shows as a failure
  whose timing the test does not control, and they run in milliseconds. The row through the server
  keeps the real core and hook, for the record, the refusal, and the commits' order.
  `fate/write-queue.ts` is imported by the sources the mutation masks its answer with: the mutation
  there would import them back.
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

## R49: The start's message is built in the server, for the first step of a committed proposal

- **Decision**: `feature.start` answers with the workflow's message of the planned folder, built by
  the server's `runMessage` as `readWorkflowMessage` builds it once the start landed: the step
  `discovery` and its reference for a feature, `change` for a change, on the planned branch, at
  `specs/<folder>/` or `specs/changes/<folder>/`. The start's test checks the plan's message against
  the `WorkflowMessage` record read once the feature exists.
- **Rationale**: the core's `PlannedView` holds the folder, branch, slug, and title, and no step: a
  committed proposal with no other file is always the core's `discovery` or `change` step, and the
  core's crates were not this task's to change.
- **If wrong**: `PlannedView` carries the first step and its reference, and `startMessage` in
  `fate/starts.ts` reads them.
- **Where**: `packages/server/src/fate/starts.ts`, task 13.

## R50: A change's start goes through the queue and answers once it landed

- **Decision**: `change.start`, `change.fromNote`, `change.startProposal`, and a session's move to a
  change run their start as a write of the queue, "Starting a change", with its steps, after the
  writes queued before it, and answer once it landed, with the change and its first run as before.
  Their first run is the start's last step. A refusal is the call's answer, and leaves the record.
  Only `feature.start`, of a proposal file as a feature or as a change, answers once planned.
- **Rationale**: the core plans only a proposal file's start: a typed change, from the composer or a
  note, has no `planStart`, and its pages open on the change's session with its first run, which
  needs the change made. Through the queue, its commit lands in order with the others; the page that
  waits for it shows its refusal, so the toast need not keep it.
- **If wrong**: a `planChange` in the core, and `change.start` answering like `feature.start`.
- **Where**: `packages/server/src/fate/starts.ts` (`landedStart`), `change-starts.ts`,
  `session-moves.ts`, task 13.

## R51: A message sent during a start goes to a session made for it, removed if nothing starts

- **Decision**: `session.send` to the folder of a start still in the queue, or to a session of that
  folder, checks the message as a send would, makes the feature's session, answers with it, and
  keeps the message in the runner's memory (`StartMessages`). Once the start lands, the kept
  messages go to that session in order; on a refusal, or as the server stops, they are dropped, and
  the session goes while it has no turn. The start's write holds the kept text in `queued`, which a
  refusal leaves for the composer.
- **Rationale**: `session.send` answers a `Session`, which the session page shows; the session made
  at once is the one the start's first run goes to. A message is taken out of memory before it is
  sent, so it is never sent twice.
- **If wrong**: a server that stops abruptly, without `closeAll`, leaves an empty session of the
  folder, which the next start of that slug reuses.
- **Where**: `packages/server/src/runner/start-messages.ts`, `fate/starts.ts`,
  `fate/send-mutations.ts` (`session.send`, not in `fate/sessions.ts`), task 13.

## R52: A start is planned one at a time, run in the calls' turn, and its steps take the mockups' words

- **Decision**: `feature.start` plans one start at a time per repository, so a slug a start still in
  the queue planned is refused, without waiting for the committing calls or the queued commits. The
  queue runs the start in the committing calls' turn, `WriteQueue.inTurn`, waiting for no queued
  write, after the writes queued before it; it holds the lists' keys and its feature's. Its steps
  read as `StartSteps.stories.tsx` words them: "Commit the proposal on <default branch>, running
  your hooks", "Make the branch <branch> and its worktree", "Start the agent with your message",
  with their seconds counted each second while they run.
- **Rationale**: the start refuses uncommitted files outside its own (R47): run while a call is
  between its write and the take of its commit, it would see that call's file uncommitted. Planned
  outside the turn, Start never waits for a call held on the core's lock. The mockups are the spec's
  copy; the plan's labels paraphrased them.
- **If wrong**: a call that wrote a file of the default branch's checkout under a feature's key,
  after the start was queued and before it ran, has the start refused as uncommitted changes.
- **Where**: `packages/server/src/fate/starts.ts`, `packages/server/src/writes/queue.ts`,
  `packages/server/src/writes/start-steps.ts`, task 13.

## R53: Open hides a refusal from the tab's toast; the record keeps it until dismissed

- **Decision**: the toast's Open goes to where the refused write happened, `#write:refused`, and
  hides it from this tab's toast only. The queue's record keeps it, so that place still shows the
  hook's output, until Dismiss, in the toast or at the place, or a new write made there.
- **Rationale**: the spec says a refusal stays in the toast "until opened or dismissed", and that
  Open shows the hook's output at the verdict: both read the one record, so dismissing it on Open
  would take the output off the page it opens.
- **If wrong**: another tab's toast, or a reload, still lists an opened refusal until it is
  dismissed.
- **Where**: `packages/web/src/writes/CommitToast.tsx`, task 14.

## R54: A refusal's place is its feature and file, or the page it was made on

- **Decision**: `useRefusal` takes `{ folder?, file?, href? }`, every field given matching. A
  feature's file (a verdict, a round) matches by folder and file; a proposal's commit by its path; a
  default-branch round and the commit page, which the server names by no file, by their page; a drop
  by the feature's page, `/f/<folder>`, wherever it was dropped from.
- **Rationale**: the server names the lists' commits with no folder nor file (R41), so their only
  place is the page the write was made on, which R6's `href` carries.
- **Where**: `packages/web/src/writes/useWriteQueue.ts`, task 14.

## R55: Writes outside the queue lost their running state with the blocking store

- **Decision**: the starts that do not go through the queue yet (`feature.start`, `change.start`,
  `session.toChange`, `feature.promote`, the New page's draft) now run without "Starting…" on their
  button or card, and block nothing. A button ignores its own second press until its call answers.
- **Rationale**: the spec removes the store, its bar, and the card's action for git writes; tasks 13
  and 15 make the start answer at once, its steps shown on the session.
- **If wrong**: until task 15, Start shows nothing for the seconds its commit takes.
- **Where**: task 14.

## R61: A start holds the write lock to write, stage, put back, and branch, never while its hooks run

- **Decision**: `start_feature` and `start_change` take the repository's write lock to reach the
  default branch, move and write the start's files, and stage them; release it while `git commit`
  and its hooks run; and take it again to unstage and put back the files on a refusal (R46's guarded
  put back), and to create the branch and its worktree. Any other core write, a save included, runs
  while a start's hook runs.
- **Rationale**: as R45 for landings: a call waiting on the lock holds a libuv thread, and four of
  them stall every binding call. A save made during the hook changes the working tree, not the
  snapshot staged; the put back leaves any path that no longer holds what the start left, and names
  it.
- **If wrong**: a save made while a start's hook runs is not in the start commit, and stays
  uncommitted.
- **Where**: `crates/core/src/actions/start/commits.rs`, `crates/core/src/api/start.rs`, review of
  the core.

## R62: Undo brings back a file the write deleted from `HEAD`, whatever its kind

- **Decision**: a refused deferred commit's undo brings back each file of its change that the write
  deleted and that is still absent: a Markdown file with the bytes it held before the write, any
  other file, an image included, with its blob at `HEAD`, when `HEAD` tracks it. A file the write
  changed but did not delete, other than Markdown, is still left as the write left it.
- **Rationale**: the before-record keeps only Markdown bytes; a drop of a folder with images,
  refused by a hook, brought back its Markdown and lost its images, which only `HEAD` holds.
- **If wrong**: an image changed uncommitted then deleted by a refused write comes back as `HEAD`
  has it, not with its uncommitted bytes; one never committed stays deleted.
- **Where**: `crates/core/src/actions/deferred.rs`, review of the core.

## R63: The composer's message reads the expected step, a prediction; the branch's step stays the tip's

- **Decision**: `api::expected_step(repo, folder)`, `expectedStep` in the binding, gives the step a
  feature or a change will have once its uncommitted workflow files are committed: its step computed
  from its files as they are on disk, the pull request's state applied as `next_step` applies it. It
  is for the composer's message only, while the folder's commits wait in the queue. `next_step`, and
  every other read of a branch's step, still reads the branch's latest commit alone.
- **Rationale**: the Git decision says a branch's step MUST be read only from its latest commit; a
  spec approved and its commit queued would otherwise have the composer prompt for the approval gate
  the human just passed.
- **If wrong**: a write whose commit a hook refuses leaves the composer's message ahead of the
  branch until the refusal puts the files back.
- **Where**: `crates/core/src/api/expected.rs`, `crates/binding/src/expected.rs`, review of the
  core.

## R57: The session of a starting feature draws from the queue's write and the plan the tab made

- **Decision**: the session page of a folder draws the start's steps, in place of the feature's
  session, while the queue holds a start's write for that folder, landing, waiting, or refused, or
  while this document planned its start and has not yet seen its write leave the queue. The plan
  (`useStart.ts`) is kept in the document's memory: the page draws at once, before the queue's live
  update reaches it. Once the write left, or the feature reads as existing, the feature is read
  again from the server and its session draws. After a reload, the steps come from the write alone,
  with an empty composer.
- **Rationale**: the feature cannot be read before its start lands, and the queue's update may come
  after the plan's answer: waiting for it would make the page wait.
- **If wrong**: a start that landed before the queue's record was read here shows its steps until
  the next change of the queue.
- **Where**: `packages/web/src/useStart.ts`, `packages/web/src/session/StartingSession.tsx`,
  task 15.

## R58: The editor names the start's write after its proposal, and the toast opens its session

- **Decision**: the editor's start names its write "Starting the <kind> <title>", its `href` the
  proposal's editor, which the steps' "Open the proposal" opens. The toast's Open of a feature's
  start goes to its session page, where its steps show the refusal. Every refusal of the plan, a
  taken slug or another, shows under the slug while it holds the slug refused; a text not saved
  stays in the editor's banner.
- **Rationale**: once refused, the proposal is back in its file, so the record must name it for a
  page reloaded; the steps, not the editor, are where the start happened.
- **Where**: `packages/web/src/useStart.ts`, `packages/web/src/writes/CommitToast.tsx`,
  `packages/web/src/ProposalStart.tsx`, task 15.

## R59: A refused start's composer holds its message, and sends nothing

- **Decision**: once a start is refused, the message the server kept for it goes back in the
  composer, once, and the composer is disabled with "Nothing started: start the proposal again from
  its file."; its `sendWaits` prop, unused since task 14, is removed.
- **Rationale**: no feature exists to send to, and the server would refuse the message.
- **Where**: `packages/web/src/session/StartingSession.tsx`, `packages/web/src/Composer.tsx`,
  task 15.

## R65: A message sent while a feature's commits are queued waits for them, and goes once they land

- **Decision**: `session.send` to a feature, or to one of its sessions, whose commits are still in
  the write queue checks the message as a send would, answers with the session it goes to, and keeps
  it in memory (`fate/commit-messages.ts`). Once every commit of the feature queued before it, and
  meanwhile, landed, the kept messages go in order, each taken before it is sent; if one is refused,
  they are dropped, their text in the refused write's `queued`, as a refused start's, and a session
  made for them goes while it has no turn. A start's own messages still go as R51 says. While the
  commits are queued, the composer's message reads the step they will give (R63), and each landing
  or refusal sends the feature's records and its workflow messages again.
- **Rationale**: the agent must never start on an approval or answers written but not committed: its
  run would read a step the branch does not have, and a hook's refusal would undo the file it
  started from.
- **If wrong**: a server that stops before the commits land drops the messages kept, which the human
  sends again from the composer.
- **Where**: `packages/server/src/fate/commit-messages.ts`, `fate/send-mutations.ts`,
  `fate/workflow-step.ts`, review of the server.

## R66: A refused write says whether a hook refused it or its landing failed

- **Decision**: a refused write of the queue carries `failure`: `hook` when the core rejected its
  landing with the code `hook:`, its files undone (R62); `failed` for any other error, a staging
  failure on `index.lock`, a commit the core no longer holds after a restart, other files staged:
  its files are left written and uncommitted, and the commit page lists them. The type is exported
  as `WriteFailure`, for the web's copy, which a later change words.
- **Rationale**: only a hook's refusal is undone by the core; the record showed every failure as
  one, whose copy says the write was undone, while the files of the others stay written.
- **Where**: `packages/server/src/writes/queue.ts`, review of the server.

## R67: A change made a feature commits through the queue, and answers once it landed

- **Decision**: `feature.promote` runs `promoteChange` as a write of the queue, "Making the change
  <folder> a feature" unless the call names it, after the writes queued before it, in the committing
  calls' turn, holding the lists' key and the change's: it answers once landed, as a change's start
  (R50), and a refusal is the call's, which leaves the record. A message sent to the change
  meanwhile is refused, as during any move.
- **Rationale**: the core commits the move within the call, on the default branch and the change's
  branch: run beside a landing, its `git commit` raced the landing's `index.lock`, and its commit of
  `PRIORITIES.md` could take a queued lists' write along.
- **Where**: `packages/server/src/fate/session-moves.ts`, `fate/write-queue.ts` (`landed`), review
  of the server.

## R68: A drop archives its sessions once its commit landed, and holds its folder until then

- **Decision**: `feature.drop` answers once its files are written, as before, and holds the change
  or the feature until its commit landed or was refused: its sessions are archived once it landed,
  and a refused drop's change or feature, which the core puts back, images included (R62), comes
  back with its sessions. While it is held, a message to it is refused as during any move; once
  landed, as a dropped one's. The tests of a dropped change wait for the landing, as R43's do.
- **Rationale**: archived at once, a refused drop's feature came back with no session in the
  sidebar; its sessions' turns hold its worktree, so none may start while the drop lands.
- **If wrong**: a new session made while the drop lands is archived with the others once it lands.
- **Where**: `packages/server/src/fate/session-moves.ts`, `writes/queue.ts` (`commit`'s `onQueued`),
  `__tests__/session-moves.test.ts`, review of the server.

## R69: A start holds the lists' key until its commit landed, its hook included

- **Decision**: a start lets the lists' key go once the core reports its branch's step, its commit
  landed: the lists' calls then wait only for the committing calls' turn, which the start holds
  until the core made its branch and worktree, and no longer for its agent's step, the messages kept
  or the first run sent. Its feature's key stays until it settles. The queue's `free` lets a write's
  keys go before it settles. This narrows R52.
- **Rationale**: the key cannot go before the hook ends. The start's commit stages `PRIORITIES.md`
  and the moved proposal, and a hook's refusal puts them back only where they still hold what the
  start left (R46): a lists' write made during the hook would change `PRIORITIES.md`, which the put
  back would then leave, its proposal back in its file but gone from the priorities, and the lists'
  commit would land that. The committing calls' turn is held through the whole core call, which the
  core runs as one; the worktree's step takes the repository's write lock (R61), on which a call in
  the turn would wait holding a libuv thread.
- **If wrong**: a lists' call made during a start's hook still waits for the hook, a commit's time.
- **Where**: `packages/server/src/writes/queue.ts` (`free`), `fate/starts.ts` (`queueStart`), review
  of the server.

## R75: A message a refused commit returns goes back in its feature's session composer, once

- **Decision**: a refused write of a feature, not a start, whose `queued` holds the messages kept
  for it (R65), puts their text back in the composer of that feature's session, before what it
  holds, once per refusal in the document, as R59 does for a start. Under it, "Not sent: the commit
  it waited for was refused. Your message is back.", until the composer sends again or the refusal
  is dismissed. A message sent to a session shows at the transcript's end only until the send
  answers (R29): a kept one, which goes into no turn yet, shows nothing until it lands, so a
  returned one never shows as sent.
- **Rationale**: the server drops a kept message once a commit before it is refused; its text is
  costly to lose, and the human sent it from that composer.
- **If wrong**: a message kept while its commit lands shows nowhere for the hook's seconds.
- **Where**: `packages/web/src/session/ReturnedMessages.tsx`, `packages/web/src/SessionView.tsx`,
  review of the web UI.

## R76: A commit that failed says its change is still written, and links the commit page

- **Decision**: a refused write whose `failure` is `failed` (R66) reads, in the toast, "The commit
  failed: the change is still written, not committed. The commit page lists it.", and, where it
  happened, a banner titled "The commit failed: the change is still written, not committed.", with
  the same link, but on the commit page itself, and its output. A `hook` refusal, or one with no
  `failure`, keeps the hook's copy.
- **Rationale**: only a hook's refusal is undone by the core; the others leave their files written,
  which only the commit page commits.
- **Where**: `packages/web/src/writes/CommitToast.tsx`, `packages/web/src/writes/RefusedHere.tsx`,
  review of the web UI.

## R77: The hand-over's message read again replaces the one the composer holds, unless changed

- **Decision**: the workflow message is read live, so the server's message sent again once the
  feature's queued commits land or are refused reaches the composer (R63, R65). The draft takes the
  same address's message read again, of the same trigger and file, with another text or step, in
  place of the one its text starts with; when the human changed that one, the draft keeps it. A
  message read again as refused leaves the text, without its run, as any refused hand-over.
- **Rationale**: `useView` reads a record without subscribing to it, so the composer kept the
  message predicted before the commits landed; the human's own words are never overwritten.
- **Where**: `packages/web/src/data.ts` (`useWorkflowMessage`), `packages/web/src/useDraft.ts`,
  review of the web UI.

## R71: The benchmark's first run misses on the Ledger, History, the round, and two writes

- **Decision**: the first runs of `vp run performance`, on 2026-10-30, on an AMD Ryzen 9 5950X (16
  cores), 31 GB, Linux 7.3 (CachyOS), headless Chromium 1243 at 1440 × 900, a release binding, other
  worktrees' builds running beside it, are recorded as the pass's findings. Four runs agree within
  about 20 ms but where noted. Within target: SC-002 (20 reloads, 345 to 440 ms, one of 1,343 ms in
  one run of four), SC-004 (Start to its session with its message 50 to 78 ms; another page while
  the steps run 38 to 42 ms), SC-005 (270 to 465 ms). Missed, each with what took the time:
  - SC-001 and SC-006, the clone's decisions page: 189 to 320 ms, the `Ledger` read alone 118 to 246
    ms on the server (20 ms on the realistic project); the slowest right after a start made its
    worktree.
  - SC-001, the clone's feature pages of `2026-10-29-decisions-needs` and
    `2026-10-28-proposal-naming`: 136 to 204 ms, their `History` read 96 to 166 ms on the server;
    the other features' `History` takes 30 to 45 ms.
  - SC-001, the realistic project's round page, `clarifications-01.md`: 184 to 242 ms, its one read
    4 ms on the server and 110 to 151 ms of long tasks in the browser, its drawing.
  - SC-001, the realistic project's `spec.md` from its feature: 122 to 132 ms in three runs of four,
    5 to 7 reads of 15 to 19 ms in all on the server and no long task: reads one after another.
  - SC-003, an approval's "Approved": 134 ms in every run, with or without a hook, its toast at 66
    to 68 ms and `review.approve` 50 to 55 ms on the server: the verdict draws from the server's
    answer, not at once.
  - SC-003, the New page's proposal to its editor (US4 1): 243 to 260 ms, three requests,
    `proposals.draft` 143 to 148 ms on the server.
- **Rationale**: the plan's step 2 fixes a miss in the task that owns it, as a finding before the
  review; this records what was measured, so the fix starts from it.
- **If wrong**: a run on a quieter machine may pass the rows within 30 ms of the target; the rows of
  the server's reads above 100 ms miss on any machine.
- **Where**: `vp run performance`, task 16; the reads named above, in the core and the server.

## R72: The benchmark replaces no other feature's bound: `live.bench.ts` and `smoke.ts --timed` stay

- **Decision**: `live.bench.ts` keeps US6.5's 2 seconds for a commit's live update and its run-ui
  SC-002 second for a status change, and `smoke.ts --timed` keeps `START_MS`, run-ui's SC-002, 2
  seconds from a start to the repository's first page. SC-005's second is checked end to end by
  `vp run performance`, from the file's write to the page drawing it.
- **Rationale**: each bound is another feature's criterion, measuring something this spec does not:
  the live stream without a browser, and a cold start of the installed package, which no reload of
  SC-002 includes. This spec's targets are stricter only end to end, in a browser, where the
  benchmark measures them, and the spec's replaced behaviour names none of them.
- **If wrong**: a live update between 1 and 2 seconds passes `vp run bench` and fails only the
  benchmark, which the review runs.
- **Where**: task 16.

## R73: The benchmark times from the press to the frame, on `main.ts`, offline

- **Decision**: `vp run performance` serves the release build with `main.ts`, signed in with the
  access key it prints, a `gh` that lists nothing and a `claude` that fails first on its PATH, and
  git's global config isolated, as the tests run. A page's time runs from the `pointerdown` or
  `keydown` the browser stamps to the end of the app's `navigate <path>` timing, after the frame
  that draws it; a write's, to the first frame its result shows in; a reload's, from the
  navigation's start to the first frame drawing the page without "Loading…" anywhere; SC-005's, from
  the file's write by the clock to the frame. Each row names the `/fate` requests answered
  meanwhile, their `Server-Timing` total and slowest, and the page's long tasks. The approval runs
  with a pre-commit hook of a second, so its toast shows while the commit lands. The lists' `j` `k`
  `Enter` open only the rows that open a page: an Add row, or one edited in place, is skipped.
- **Rationale**: the human's wait starts at the press, and the spec measures it on a release build;
  a fake agent would need the sandbox's Vite server, not `main.ts`, and a real `claude` would spend
  the human's tokens. A commit without hooks may land before its toast draws.
- **If wrong**: Send is never pressed, so SC-004's "send it and open another page" is timed only as
  the other page, opened while the steps run; Claude Code shows as not available on the session.
- **Where**: `packages/web/scripts/performance*.ts`, task 16.

## R79: The ledger is kept like the workspace, and its dates read only the commits since

- **Decision**: `read_ledger` answers from the core's read cache, kept per working tree by the name
  `ledger` until the watcher's next event or a write's end, as the workspace is (`cache::kept`).
  Each decision's date, the slowest part, about 100 ms of `git log --name-only` over the default
  branch's 3,229 commits, is kept for the process by the default branch's tip it was read at: a tip
  that moved on from it reads `git log <old>..<new>` alone, and any other tip, like a reset, reads
  the whole history again. The dates are read with `--full-history`, each the latest of its commits'
  dates, so the dates of a range merged over those of its start are the dates read whole. On the
  clone of this repository, a release binding, measured with the core directly: 117 to 139 ms
  before; 25 ms on the first read once watched, 3 to 4 ms from memory, 28 ms on the first read after
  a commit on the default branch.
- **Rationale**: the Performance decision: "The server MUST answer reads from what it already read,
  reading git again only for what changed since." The ledger read missed SC-001 and SC-006 (R71).
- **If wrong**: a decision whose link points outside `specs/` keeps its link's problem until the
  next event, as a feature's checked problems do: the watcher sees only `specs/` and git's
  references. A decision changed only by a side branch a merge discarded now shows that branch's
  date, as `--full-history` counts it.
- **Where**: `crates/core/src/cache.rs` (`kept`), `crates/core/src/api/ledger.rs`,
  `crates/core/src/api/ledger/dates.rs`, `crates/core/src/git/log.rs` (`last_changes`),
  `crates/core/tests/cache.rs`.

## R80: A feature's history is kept, its diffs' figures by their commits, and no tip without its record is walked

- **Decision**: `read_history` answers from the core's read cache, by the name `history <folder>`,
  as the ledger is (R79). What a history's diffs produced, its lines and its decisions, is kept for
  the process by the feature's folder, path, kind, finish, and the commits of its diffs, which never
  change: a done item's, whose merge diff of 636 files took 60 ms and its seven decisions'
  comparison 33 ms in `2026-10-28-proposal-naming`, is read once; a live one's again when its branch
  or the default branch moves. A done item's walk for the commit that added its record skips a
  default branch's tip that has no record: `2026-10-29-decisions-needs`, finished on `origin/main`
  but not on the clone's default branch, walked the whole first-parent line twice, 140 ms, to find
  nothing. On the clone of this repository, a release binding, measured with the core directly
  (`decisions-needs`, `proposal-naming`, `performance-pass`): 157 to 167, 93 to 102, and 28 ms
  before; 19 to 20, 27 to 31 (214 on the process's first read), and 24 to 27 ms on a first read,
  under 1.2 ms from memory.
- **Rationale**: the Performance decision's reads from memory; the `History` read missed SC-001 on
  these two features (R71).
- **If wrong**: the 20 to 30 ms left on a first read is the walk of the commits since the folder's
  date, read again after any change; keeping it by the tip walked from would remove it.
- **Where**: `crates/core/src/api/history.rs`, `crates/core/src/history.rs` (`recorded_tip`),
  `crates/core/src/history/figures.rs` (`produced`), `crates/core/tests/cache.rs`.

## R81: A draft reads the workspace once from memory and once after it wrote, and counts once

- **Decision**: `draft_proposal` keeps its one call, its lock, and its rollback, and reads less: its
  first read of the workspace, before it writes anything, takes the read kept since the last change
  when there is one (`cache::kept_read`), as a read just before the lock would; neither its read of
  the priorities nor its line's insert runs `git status` to count the commit bar's changes; and its
  file's view, `read_proposal_file`, counts them from the workspace it read instead of reading the
  priorities, and the workspace, again. The priorities' other edits, which read the workspace first
  the same way (`reach_default_from`), take the kept read too. On the clone of this repository, a
  release binding, measured with the core directly while a watch ran: 136 to 147 ms before; 80 to 91
  ms without the counts and the second read; 52 to 58 ms with the kept first read.
- **Rationale**: the Performance decision's reads from memory; `proposals.draft` took 143 to 148 ms
  on the server (R71), three full reads of the workspace and three `git status` under the lock.
- **If wrong**: a change made outside in the milliseconds before the watcher's event reaches the
  core joins the line as it was, as any read from memory shows it; the file's text and the
  priorities' hash are read from disk, so no edit is lost.
- **Where**: `crates/core/src/api/drafts.rs`, `crates/core/src/api/default_branch.rs`,
  `crates/core/src/api/proposal_files.rs`, `crates/core/src/actions/priorities.rs`,
  `crates/core/src/cache.rs` (`kept_read`), `crates/core/tests/cache.rs`.

## R82: A watch reads ahead what is kept by commit, and the server's binding calls do not queue

- **Decision**: once a watch starts, its own thread reads the ledger's dates and every feature's
  history (`api::warm`), which fills only what is kept for the process by the commits it was read
  from (R79, R80), so nothing it reads goes stale and the read cache's generations and counts are
  left alone. The first click on the clone's `/decisions` and on `2026-10-28-proposal-naming`, right
  after the server started, took 157 and 132 ms on the server in the benchmark before it; 30 ms each
  after. And the server's entry, `main.ts`, sizes libuv's thread pool before anything uses it: one
  thread per core, at least 8 and at most 64, unless `UV_THREADPOOL_SIZE` is set. Each call of the
  binding holds one of the pool's threads, 4 by default, so during a start, whose call holds one for
  its whole run, the live updates' reads and a page's read waited for a free one: the ledger read
  amid a start and six other reads took 108 to 112 ms with 4 threads and 35 to 41 ms with 16,
  measured with the core directly. In the benchmark the clone's `/decisions` right after a start
  took 148 ms on the server with 4 threads, 75 to 90 with 16, on a machine loaded by other builds
  (load average 7 to 14).
- **Rationale**: a server's first read of a page is a read like any other for the human; the
  Performance decision's cache is on the server, and its reads from memory are lost when they wait
  for a thread.
- **If wrong**: a watch's start costs one thread a second or two of reading, beside the first pages.
  `vp dev` serves the routes in Vite's process, whose pool is sized before the server loads.
- **Where**: `crates/core/src/api/warm.rs`, `crates/core/src/watch.rs`,
  `packages/server/src/threadpool.ts`, `packages/server/src/main.ts`.
## R83: An approval reads Approved at its press, the review's refusals kept by its page

- **Decision**: `review.approve` passes fate's `optimistic` result, `approvedFile` in
  `review/approved.ts`: the file's status, approved, and its block as the core's `record_block`
  writes it, the first top-level `[!IMPORTANT]` callout turned a note, its first paragraph "Approved
  on <today>.", by the browser's clock, and a spec's time gone with it. The page then draws the file
  read, not reviewed; a refusal takes it back. The review's refusals and its choices, a spec's risk
  tier and plan review, are kept by the spec's and the plan's page (`useVerdictState`), not by the
  review, so the review drawn again after a refusal shows why, its choices as set. Request changes
  still draws from the server's answer: no criterion times it.
- **Rationale**: R71 measured "Approved" at 133 to 140 ms, `review.approve` 50 to 55 ms on the
  server and the page's drawing after it. Measured with the benchmark's approval, a hook of a second
  running, on the realistic project, release build: "Approved" at 92 to 96 ms. The review is drawn
  by a component the read page replaces, so its state went with it, and a refusal's message with it
  (`approve-at-once.test.tsx` fails so).
- **If wrong**: the toast now draws at 114 to 117 ms, from 67 to 69: the page drawn read at the
  press, then again with the server's answer, 52 to 57 ms of long tasks, keeps the main thread as
  the queue's live update comes. Drawing the read page in a transition (`useDeferredValue` of the
  status) did not move it (96 and 117 ms). What would: a review and a read spec drawn by the same
  components, so the answer redraws only what changed, or a spec page lighter to draw.
- **Where**: `packages/web/src/review/approved.ts`, `packages/web/src/ReviewVerdict.tsx`,
  `packages/web/src/review/useReview.tsx`, `packages/web/src/spec/SpecPage.tsx`,
  `packages/web/src/PlanPage.tsx`, the benchmark's findings (R71).

## R84: A round's questions mount one at a time after its first frame

- **Decision**: the round's page mounts its opening on its first frame, then its questions one at a
  time, each in a transition of its own after the commit before it, then its end, the settled points
  and Submit, once they are all in (`useMountedSteps` in `layout/useMountedSteps.ts`). A round that
  opens at a question, the one saved or the first blank one, mounts every question up to it at once,
  and one that opens at a place of its own, by Back, a reload, or an address with a hash, mounts
  them all at once, so it opens where it did.
- **Rationale**: R71 measured the realistic project's round, `clarifications-01.md` of
  `2026-10-21-leader-key`, at 184 to 242 ms, its read 4 ms and 110 to 151 ms of long tasks. A CPU
  profile through Playwright found no single cost: React's render and commit, and the page's first
  layout, forced by the layout effects that measure widths, grew with what was mounted. With no
  question mounted, the page drew in 83 to 86 ms; with the first two, 152 to 158. Measured after,
  release build, three runs: 76 to 92 ms, no long task. The questions draw within the frames after,
  as the human reads the opening; nothing shows a loading state. A fold's content was not the cost:
  `Foldable` mounts it only while open.
- **If wrong**: a jump from the outline or a key to a question not yet mounted, in the first tenth
  of a second, does nothing. A test that reads a later question right after the page draws waits for
  it (`leave.test.tsx`).
- **Where**: `packages/web/src/layout/useMountedSteps.ts`, `packages/web/src/RoundPage.tsx`,
  `packages/web/src/QuestionCards.tsx`, `packages/web/src/useRoundPosition.ts`.
