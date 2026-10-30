# Rulings: Commits shouldn't all fail on "changes to INBOX.md"

The low-impact choices made while building [the proposal](proposal.md), inside its limits and the
decisions. None binds future work: those are decisions.

## R1: A start commits its own files alone, over staged files too

- **Decision**: a start no longer refuses staged files elsewhere either. It commits its files with
  `git commit --only`, as `ura note` commits `INBOX.md`, so files staged before it stay staged, out
  of its commit. This replaces ruling R10 of [merge-chats](/specs/done/2026-10-20-merge-chats.md),
  where a proposal file's start still refused uncommitted changes, and every start refused staged
  files.
- **Rationale**: the proposal asks that a start "commit just what's relevant and leave what's
  uncommitted as-is". The refusal of staged files only existed because the commit would have carried
  them: committing its files alone removes the reason. New core tests
  `a_proposal_file_starts_over_uncommitted_changes_elsewhere` and
  `a_typed_text_starts_over_files_staged_elsewhere`.
- **Alternatives considered**: keep refusing staged files: an `INBOX.md` staged by hand would still
  block every start, which the proposal names.
- **If wrong**: `self.at.stage(&paths, true)` in `crates/core/src/actions/start/commits.rs` back to
  `false`, with the checks of `Start::plan`.
- **Where**: `crates/core/src/actions/start/plan.rs`, `crates/core/src/actions/start/commits.rs`

## R2: A proposal file staged but never committed leaves the index with its move

- **Decision**: before its commit, a start resets the proposal file's index entries to `HEAD`. A
  proposal file only staged, never committed, then leaves the index, and the dated folder holds it.
- **Rationale**: the old refusal of staged files kept this case out. Committing alone takes only the
  committed files' deletion, so a staged new proposal file would have stayed staged at its old path,
  with no file on disk. The CLI test `a_staged_proposal_file_does_not_start_twice` now starts it
  once and checks the working tree is clean.
- **Where**: `Start::commit_start` in `crates/core/src/actions/start/commits.rs`

## R3: A commit of its files alone takes what the hooks reformatted into the index

- **Decision**: after a commit of its paths alone, `Git::commit_stage` resets those paths in the
  index to the new commit, as a best effort: a failed reset never fails the commit, which landed,
  since its callers undo their files on an error.
- **Rationale**: `git commit --only` runs the hooks over a temporary index. A hook that reformats
  and stages files, like this repository's `vp staged`, commits the formatted text, but the real
  index keeps the text from before the hooks, so every start left `specs/PRIORITIES.md` as `MM`,
  found by the review. The fix is in the commit shared by every commit of files alone, so `ura note`
  and the web UI's inbox commits, which had the same flaw for `INBOX.md`, leave a clean tree too.
  New core test `commit_only_keeps_what_the_hook_reformats`.
- **Where**: `crates/core/src/git/commit.rs`

## R4: A change made a feature commits its files alone too

- **Decision**: `ura start <change> --feature` commits its move on the default branch alone, so
  files staged there stay staged, as a start leaves them. It already left unstaged edits.
- **Rationale**: the proposal asks the same of "starting features and all". The review found the
  move still refused an `INBOX.md` staged on the default branch. New core test
  `files_staged_in_the_main_checkout_stay`.
- **Where**: `Promote::relink` in `crates/core/src/actions/promote.rs`

## R5: A start during a merge on the default branch is refused before any write

- **Decision**: a start is refused, before writing anything, while a merge or a cherry-pick is in
  progress on the default branch's checkout. A rebase or a revert is not refused: git commits some
  files alone during them, checked by hand. A rebase detaches the default branch, so a start already
  fails earlier, reaching it, as before this change.
- **Rationale**: git refuses a commit of some files alone during a merge or a cherry-pick. Before
  this change, the check of uncommitted changes refused such a start up front. Without it, the start
  moved the proposal and then failed at its commit, leaving steps to do by hand, as the review
  found. New core test `a_start_during_a_merge_is_refused_before_any_write`.
- **Where**: `Start::plan` in `crates/core/src/actions/start/plan.rs`, `Git::operation_in_progress`
  in `crates/core/src/git/status.rs`
