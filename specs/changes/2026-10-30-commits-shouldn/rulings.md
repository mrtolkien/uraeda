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
