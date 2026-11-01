# Rulings: Moving a file never breaks a link to it

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The history is read through the system git

- **Decision**: the move finder reads history with one `git log -M --name-status -z` through the
  system `git`, from the core's git module.
- **Rationale**: the [git decision](../decisions/git.md) says Rust tools read git with gix, but the
  workspace's gix is built without rename detection, and the core already reads `git diff -M`
  through the system `git` in `numstat_in` ([`git/history.rs`](/crates/core/src/git/history.rs)).
  The clarifications settled it, unobjected: "through the system `git`, as `numstat` already is".
- **Alternatives considered**: gix's tree diffs with exact renames only, plus the plan's pairing
  rules: misses a file edited during its move, such as an attach's link added before its commit.
- **If wrong**: the reading moves to gix with its `blob-diff` feature, behind the same
  `Git::path_events`.
- **Where**: task 2, `crates/core/src/git/history.rs`.

## R2: An Undo without memory relinks back only the files whose change is links alone

- **Decision**: the Undo of a single file made a folder, and of a note file moved to the proposals,
  reverses its moves over the files of `specs/` whose change since `HEAD` is link destinations
  alone. A merged note's Undo, which already keeps a record in memory, puts back the texts its
  relink wrote while unchanged.
- **Rationale**: those Undos hold no state today, and read what the move left. A file the human
  edited since differs from `HEAD` by more than links, so it keeps its text, as the spec's edge case
  asks.
- **If wrong**: a file the human had edited before the move keeps the moved link after the Undo, and
  `ura check` reports it; `--fix` cannot repair it, since the file is back. Keeping the texts in
  memory, as the merge does, would fix it.
- **Where**: task 3, `relink_back`; task 6.

## R3: A reference definition to a deleted file stays

- **Decision**: `--fix` rewrites a reference definition to a moved file, but leaves one to a deleted
  file, still reported.
- **Rationale**: turning it into words would mean deleting the definition line and unlinking every
  `[text][label]` that uses it, for a form no file of `specs/` uses today.
- **Where**: task 1, `relink`.

## R4: A done feature's notes are read on its page only

- **Decision**: a done feature's record is checked when its page is read, not when Home or the
  sidebar read the workspace, and the Fix button shows for features read from the default branch.
- **Rationale**: the [problems decision](../decisions/problems.md) shows notes only on their item's
  page, and Home would check every record on each read. The default branch's files are the ones the
  commit page commits.
- **Where**: task 8, `crates/core/src/api.rs`.

## R5: The finder keeps the last history it read

- **Decision**: `History::read` keeps the last history read, by repository root and tip, and returns
  it again for the same pair.
- **Rationale**: the feature page of each done feature would otherwise run `git log`, about 0.5
  seconds here, on every read with a broken link; a new tip reads it again.
- **Where**: task 2, `crates/core/src/moves/history.rs`.

## R6: A note merged into a proposal file reads as deleted in the history

- **Decision**: the finder does not pair a note file merged into a proposal file's `## Notes`: the
  commit deletes it and only modifies the proposal file, so a link the core's move did not reach
  reads as deleted, and `--fix` keeps its words.
- **Rationale**: the core's merge relinks every file of `specs/` at the move, with the subsection's
  anchor; history alone cannot tell which modified file took the note.
- **Where**: task 2.

## R7: A move matched on its anchor drops the link's anchor

- **Decision**: a `Move` whose `from` ends in `#anchor` takes only the links with that anchor, and
  writes them with the `Moved` anchor it gives, or none: the link's own anchor named the merged
  note's subsection, which the moved-back file no longer holds. A link to a moved folder keeps its
  trailing `/`; a link to a record never has one.
- **Rationale**: the plan says an anchor is kept unless `Moved::anchor` replaces it, and is silent
  on the Undo of a merged note, where keeping `#<note-title>` on the note file would point at a
  heading it may not have.
- **If wrong**: the Undo's links keep the subsection's anchor; `relink` keeps `anchor` when the move
  gives none.
- **Where**: task 1, `relink`; task 6, the merged note's Undo.
