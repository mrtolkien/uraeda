# Rulings: "Master" PR

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The inbox reader places agents' notes as lines of a joined text

- **Decision**: the reader joins `INBOX.md` with one line per agent's note file, the line a linked
  note file has, `- [agent] [<about>] [<title>](notes/<file>)`, at the end of its category, and
  parses the joined text with the existing parser. Each note keeps the id it has in `INBOX.md`; an
  agent's note's id is its file's path from the top level, `specs/notes/<file>`.
- **Rationale**: the parser, the diff of the commit bar, and the note's images already handle a
  linked note file, so an agent's note needs no second model. A path is a stable id, which a merge
  bringing another agent's note cannot shift, and no `note-<n>` of `INBOX.md` can take.
- **Alternatives considered**: ids counted after `INBOX.md`'s notes, `note-<n>`: they shift when a
  merge adds a file sorted before, and the inbox's hash covers `INBOX.md` alone, so a stale id would
  not be refused.
- **Where**: task 1, `crates/core/src/files/inbox/agent.rs`

## R2: An action on an agent's note writes its line first

- **Decision**: every action that takes a note's id first turns an agent's note into its line, at
  the end of its category in `INBOX.md`, then runs as for a linked note file. A move also drops the
  file's `category`. A removal leaves `INBOX.md` as it was, and deletes the file when it is as
  committed; its Undo restores the file alone when the note goes back where the inbox showed it, and
  writes the line back, linking the file it restores, anywhere else. A move that drops the note
  where the inbox showed it writes nothing, its file keeping its `category`: the checkout stays as
  `HEAD` has it, with nothing for the commit bar.
- **Rationale**: the spec's architecture gives the actions one owner of the turn into a line, and
  the actions on a linked note file already remove, move, and promote its file.
- **If wrong**: an action that forgets the turn refuses with "no note", losing nothing.
- **Where**: task 2, `crates/core/src/actions/inbox/agent.rs`

## R3: `ura note --agent` is refused on the default branch

- **Decision**: in a feature's or a change's worktree, `--agent` writes a note file and commits it
  on its branch. On the default branch's checkout, it refuses before writing anything, with
  `--agent writes in a feature's or a change's worktree, never on the default branch`. On any other
  branch, it writes the note file in this checkout, as in a feature's worktree.
- **Rationale**: the git decision says an agent's inbox note is a note file of its own, written in
  its own worktree, never on the default branch. Writing a line there instead, as planned first,
  broke that rule.
- **Where**: task 3, `crates/cli/src/note.rs`

## R4: An agent's note file is named from four words

- **Decision**: `<slug>-<words>.md`, `<words>` the slug of the note's first four words, apostrophes
  dropped first: "The workspace record's running is read by no view" gives
  `the-workspace-records-running`. Without a slug to write, the name is the words alone.
- **Rationale**: the spec's scenario names the file
  `feature-state-the-workspace-records-running.md`.
- **Where**: task 3, `crates/core/src/actions/inbox/agent_file.rs`

## R5: The actions on an agent's note run through one wrapper, which takes its line back

- **Decision**: `actions::inbox::agent::acting` writes an agent's note's line, runs the action on
  the line's `note-<n>` id over the new hash, and puts `INBOX.md` back as it was when the action
  refuses, deleting it when it did not exist, and saying so in the error when it cannot; a category
  the line made, one `INBOX.md` lacked, goes once the line left it, as a move to another category or
  out of the inbox does. `moving` adds the drop of the file's `category` for `category`, `place`,
  and a drop among the notes. The commit bar counts a note file whose only change is that dropped
  `category`, linked from `INBOX.md`, as part of the move, and its Discard restores the file from
  `HEAD`. A removal does not write the line: it deletes the file, held for Undo, only when the file
  is as `HEAD` has it; a file edited since, or never committed, refuses the removal with
  `<path> has uncommitted changes: the note was not removed`, since the git decision forbids losing
  the user's work. The plan's `linked` function is folded into `acting`, which nothing else needed.
- **Rationale**: R2's "losing nothing" holds only when a refused action leaves no line behind, and a
  move of a note under "Deferred fixes", a category `INBOX.md` lacks, would otherwise leave an empty
  `## Deferred fixes`.
- **Where**: task 2, `crates/core/src/actions/inbox/agent.rs`

## R6: The removal's subject shortens the note as every inbox subject does

- **Decision**: `chore: remove "<note>" from the inbox` shortens the note with the commit subjects'
  rule, 40 characters cut at a word: "The workspace record's running is read…", not the spec's "The
  workspace record's running…".
- **Rationale**: the spec's scenario illustrates the shortening; changing the rule would change
  every inbox and priorities subject.
- **Where**: task 2, `crates/core/tests/inbox_actions.rs`

## R7: `ura clean` names the priorities' line among what is left

- **Decision**: a merged feature whose line is still in the default branch's priorities is something
  to clean, with no worktree or branch left. The messages say so:
  `Nothing to clean: no merged feature has a worktree, a branch, or a line of the priorities left.`,
  and
  `<n> merged features have a worktree, a branch, or a line of the priorities left: name one, or pass --all`.
  The line is one linking the feature's folder or its `proposal.md`, the same test the priorities'
  join reads a merged line with (`workspace::links_folder`). Whether the line is there comes from
  the workspace's priorities, read once from the default branch, uncommitted edits included;
  `ura clean` reaches the default branch only when it is.
- **Rationale**: the old messages would be wrong for a feature with only its line left, and the spec
  makes the line a leftover of the merge like the worktree and the branch.
- **Where**: task 5, `crates/cli/src/clean.rs`, `crates/core/src/actions/clean.rs` `merged_line`

## R8: An agent's note made a proposal leaves its frontmatter

- **Decision**: a note file made a proposal takes the template's shape without its frontmatter:
  `agent`, `about`, and `category` are the note's marks, which a proposal has no use for, and the
  title read is the `#` line after it. The move's Undo writes back the note file as `HEAD` has it,
  frontmatter included, when the move made the proposal of that file.
- **Rationale**: the frontmatter copied into `## What` duplicated the title and left YAML in the
  proposal; dropped without the Undo writing it back, the Undo would lose the file's marks.
- **Where**: `crates/core/src/actions/expand.rs` `note_as_proposal`,
  `crates/core/src/actions/inbox/note_file.rs` `back_to_notes`

## R9: Any link of `INBOX.md` makes a note file no agent's note

- **Decision**: a note file of `specs/notes/` is an agent's note only when no link of `INBOX.md`
  reaches it: a note's own link, or any other markdown link of the file, like one in a nested item,
  resolved from `specs/`.
- **Rationale**: a file linked from a nested item showed twice, as that item and as an agent's note
  at the end of its category; the spec's edge case has the line win.
- **Where**: `crates/core/src/files/inbox/agent.rs` `agent_notes`

## R10: An agent's note file's fields are quoted when YAML would misread them

- **Decision**: `ura note --agent` writes `about` and `category` plain when they are words of
  letters and digits (with `-`, `_`, `.`, `(`, `)`, `/`), starting with a letter and no YAML keyword
  like `true` or `null`: `category: Deferred fixes`, as the spec shows. Any other value is
  double-quoted, `"` and `\` escaped: `category: "Mobile: phones"`.
- **Rationale**: written plain, `Mobile: phones` broke the frontmatter's parse and `#Later` read as
  a comment, so the note lost its category. Quoting only when needed keeps the spec's plain form.
- **Where**: task 3, `crates/core/src/actions/inbox/agent_file.rs` `scalar`

## R11: `ura clean` tells a hook's refusal, and where it wrote

- **Decision**: a hook refusing the commit of the line's removal prints
  `a hook refused the commit: the line is removed but not committed.`, apart from
  `PRIORITIES.md had uncommitted changes: the line is removed but not committed.`, which only other
  changes print. When `ura clean` removes the line in another working tree of the default branch,
  one it made among them, it says so on stderr as `ura note` does: `wrote in .worktrees/main`.
- **Rationale**: the hook's case printed the other changes' message, which was false; and a line
  removed in a worktree the human did not see made would otherwise go unmentioned.
- **Where**: task 5, `crates/core/src/actions/clean.rs` `LineCommit`, `crates/cli/src/clean.rs`
