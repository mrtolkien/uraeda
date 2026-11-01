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

## R8: A missing folder follows the files its last removal took

- **Decision**: a folder missing at the tip went where the files removed by the newest commit
  removing any of its files went, when they all went to one folder, one record, or one deletion. A
  file the folder lost earlier, as a draft deleted during the work, does not count.
- **Rationale**: the plan asks that all its files go one way, but a finished folder often lost a
  file before its finish, which would read as deleted and leave the link to the folder unfixed.
- **If wrong**: a folder emptied over several commits, file by file, follows only the last of them;
  counting every file's end would leave most folder links unfixed instead.
- **Where**: task 2, `History::went` in `crates/core/src/moves/history.rs`.

## R9: The relinker is public until its callers land

- **Decision**: `actions::relink` is a `pub` module with `pub` items, not `pub(crate)`.
- **Rationale**: task 3 lands before the moves that call it, and `vp run fast` runs clippy with
  `-D warnings`: a `pub(crate)` item no code calls yet fails it as dead code, and an `allow` marker
  is refused. A public item of a public module is never dead code.
- **If wrong**: once tasks 4 to 6 call it, the module and its items can go back to `pub(crate)`.
- **Where**: task 3, `actions/relink.rs` and `actions/mod.rs`.

## R10: A link unlinked at a line's start may change the block it starts

- **Decision**: a link or image turned into its words at the start of a line is left as its words,
  even when those words then read as markdown syntax: `[1. item](../gone/x.md) text` becomes
  `1. item text`, an ordered list. The rewrite does not escape them.
- **Rationale**: a link whose words start like a list item, a heading, or a quote is rare in
  `specs/`, and the check of the rewritten file shows any structure it breaks. Escaping would add
  backslashes to the far more common words that need none.
- **If wrong**: escape the words' first characters when they would start a block, at the start of a
  line only.
- **Where**: task 1, `relink` in `crates/core/src/files/retarget.rs`.

## R11: A start leaves its moved files to the rebase

- **Decision**: a start's relink of `specs/` skips the files it moved, as well as `PRIORITIES.md`;
  their own relative links are pointed at the dated folder by the rebase before it, as today. A
  change made a feature relinks every file of `specs/` but `PRIORITIES.md`, its moved folder's
  included.
- **Rationale**: the start's put back on a hook's refusal moves each file back only while it holds
  the bytes the start left, and restores its text from before the rebase: a second rewrite of the
  same file, put back by the relinker, would leave it named as changed. The rebase already points
  the moved files at each other. A change's folder holds no relative link the move breaks, and a
  rooted link inside it to `/specs/changes/<d>/` is one the move must rewrite.
- **If wrong**: a link in a postponed proposal's folder to the folder itself, `../<proposal>/`,
  stays broken until `ura check --fix`.
- **Where**: task 5, `Start::relink` in `crates/core/src/actions/start/commits.rs`, and
  `relink_folder` in `crates/core/src/actions/promote.rs`.

## R12: A merge's relink skips the proposal file the note went into

- **Decision**: the relink of a note merged into a proposal file skips that proposal file, and the
  note file itself, besides the two lists. The subsection's anchor is the first `###` heading the
  merge added, numbered as GitHub numbers it, past a `## Notes` the merge wrote.
- **Rationale**: the merge's Undo finds the text it inserted in the proposal file, and takes back
  the one run between the text before and after: a link rewritten elsewhere in that file would widen
  the run, and the Undo would take the human's text between them. The note file is taken away right
  after, held as it was for the Undo.
- **If wrong**: a link from the proposal file to the note merged into it stays, reported by the
  check; `ura check --fix` reads it as deleted
  ([R6](#r6-a-note-merged-into-a-proposal-file-reads-as-deleted-in-the-history)) and keeps its
  words.
- **Where**: task 6, `relink_and_remove` in `crates/core/src/actions/inbox/merge.rs`.

## R13: A proposal file's commit leaves the repairs

- **Decision**: `changes::linked_files`, the files a proposal file's or a note file's commit from
  its editor takes along with the lists, reads the change list without the link repairs: the repairs
  stay on the commit page, committed by its Commit.
- **Rationale**: that commit's subject names the proposal file alone, so a repair carried in it
  would be committed under a message that does not name it. The spec puts a repair on the commit
  page, as `- Repair links: <file name>`.
- **If wrong**: `linked_files` reads `gather` instead of `gather_lists`, one line.
- **Where**: task 7, `crates/core/src/actions/changes.rs`.

## R14: The finder pairs a main file only with a start or its own name

- **Decision**: the finder's main-file pairing, after git's renames, pairs the one deleted proposal
  or note main file of a commit only with the one path the same commit added (a rename's target or a
  record is not one) that is a dated folder's `proposal.md`, a start, or a main file whose name is
  the deleted one's, or it with `-<n>` after: a file made a folder, `x.md` to `x/proposal.md`, or a
  note moved to the proposals, which keeps its stem or takes the next free number. Any other
  deletion reads as deleted.
- **Rationale**: the plan paired it with any one added main file, so a commit deleting
  `notes/old.md` and adding an unrelated `notes/new.md` read as a move, and a fix would have sent
  links to the wrong file.
- **If wrong**: a main file renamed to a new name with most of its text rewritten, in one commit,
  reads as deleted: `--fix` keeps the link's words, and a rename git sees still follows.
- **Where**: task 2, `start` in `crates/core/src/moves/history.rs`.

## R15: The relinker writes by renaming, and leaves two gaps open

- **Decision**: the relinker writes each file into a new file beside it, given its permissions, and
  renames it over the file, so a failed write leaves it whole; the files written before it are put
  back, and the error names any that could not be. Two gaps stay open: a save landing between the
  relinker's read of a file and its write is overwritten, and `relink_back` leaves the moved link in
  an untracked file, which no commit holds to compare against (extends R2's **If wrong**).
- **Rationale**: the window is milliseconds, and the moves hold the repository's write lock for the
  server's own writes, so only an editor saving at that instant loses its save. An untracked file
  has no `HEAD` text to prove its change is links alone.
- **If wrong**: the relinker compares each file to its `before` just ahead of the rename and skips
  one changed since; the Undo keeps the texts in memory, as the merge does. A file the rename
  replaces loses its other hard links and takes the writer as its owner.
- **Where**: task 3, `write_all`, `replace`, and `relink_back` in
  `crates/core/src/actions/relink.rs`.
