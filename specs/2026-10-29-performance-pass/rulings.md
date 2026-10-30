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
