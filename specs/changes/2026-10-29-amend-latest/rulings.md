# Rulings: Amend the latest commit

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[git](/specs/decisions/git.md) decision. None binds future work: those are decisions.

## R1: Never amend a commit another branch holds

- **Decision**: a tool amends the latest commit only when it has one parent, and no other branch,
  local or remote, nor a tag holds it. A pushed commit is never amended, nor one a feature or a
  change was started from, nor a merge. A push that leaves no remote branch behind, to a URL or from
  another clone, cannot be seen: the next push of such an amend needs the human's force.
- **Rationale**: the git decision has no rule on amending: its limits are that tools never lose the
  user's work, never force-push, and run the user's hooks. An amend of a commit only this checkout
  has loses nothing, since the amended commit holds every change of the old one, and runs the hooks
  as any commit does: it is a write "as the user would", by `git commit --amend`. A rule of its own
  in the decision would need the human's approval. The decision forbids force-pushing, and a pushed
  commit, once amended, could only be pushed again by force. A branch started from it would keep the
  old commit, and its merge would bring the same edits twice. A tag would stay on a commit the
  branch no longer has.
- **If wrong**: edits after a push make one more commit until the next push. The check is
  [`held_elsewhere`](/crates/core/src/git/amend.rs).
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs)

## R2: Only an unscoped `chore:` of the same files, its body a list or empty

- **Decision**: both commits are `chore:` commits without a scope, of `INBOX.md`, `PRIORITIES.md`,
  and files under `specs/proposals/` and `specs/notes/` alone, on the default branch. The latest
  commit's body, if any, is a list of changes, one per `- ` line.
- **Rationale**: these are the commits of small edits the proposal names: the commit bar's, a
  proposal file's or a note file's from its editor, `ura note`'s, and their Undos. A start, a drop,
  or a postpone is scoped, `chore(<slug>): ...`, and a triage's commit holds `INBOX-TRIAGE.md`: each
  stays a step's record. A human's `docs:` commit, or a body they wrote, keeps its words rather than
  being folded into a list. Two hand-made records hold only these files and are amended by the next
  tool commit, their changes kept: the scratchpad's move into the inbox, and a split-out item's
  `chore: expand <Name>`.
- **Alternatives considered**: any commit of those files, which would rewrite a message the human
  wrote by hand.
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs)

## R3: The amended message lists every change

- **Decision**: the amended commit's subject names the latest commit's first change and the count of
  the others, `chore: add "An idea" to the inbox, and 2 more`, and its body lists every change, one
  per line. A commit with one change and no body gives its subject as its line,
  `- Add "An idea" to the inbox`.
- **Rationale**: the commit bar already writes this shape for several changes, so `git log` reads
  the same whether the changes were committed at once or one by one.
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs)

## R4: An edit that undoes the whole latest commit is a commit of its own

- **Decision**: when the files committed would take every file of the latest commit back to its
  parent's, the commit is a new one, not an amend. An amend that git or a hook refuses anyway is
  tried again as a plain commit, with the action's own message.
- **Rationale**: the amend would leave an empty commit, which git refuses. Dropping the commit
  instead would delete history, which the git decision leaves to the human. A hook that rewrites a
  file, or a line-ending filter, can still make the amend empty, or a hook refuse it: an amend git
  or a hook refuses is tried again as a commit of its own, so a tool's commit never stays stuck.
- **If wrong**: a hook that refuses the amend runs twice, the second time for the plain commit.
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs), and
  [`commit.rs`](/crates/core/src/actions/commit.rs) for the second try

## R5: Tests that chain commits keep each one

- **Decision**: ten existing tests, which commit workflow files and then assert what a later commit
  holds or says, call a new `TestRepo::keep()`, which points a `kept` branch at the latest commit.
- **Rationale**: they check the commit bar's files and messages, not the amend: the branch makes
  each commit one of its own, as before this change, without changing what they assert.
- **Where**: [`repo.rs`](/crates/core/tests/common/repo.rs), and the tests in
  [`actions.rs`](/crates/core/tests/actions.rs),
  [`inbox_images.rs`](/crates/core/tests/inbox_images.rs),
  [`inbox_merge.rs`](/crates/core/tests/inbox_merge.rs),
  [`inbox_moves.rs`](/crates/core/tests/inbox_moves.rs),
  [`priorities.rs`](/crates/core/tests/priorities.rs), and
  [`commands.rs`](/crates/lsp/tests/commands.rs)

## R6: Two reads go through `git`

- **Decision**: the files the latest commit changed come from `git diff-tree`, and the branches and
  tags that hold it from `git for-each-ref --contains`, both parsed in their `-z` and `--format`
  forms.
- **Rationale**: the git decision asks for reads with gix, and
  [`log.rs`](/crates/core/src/git/log.rs) already reads through `git` what gix does not give. gix
  has no `--contains`, and its tree diff needs a feature the workspace does not build: one process
  each, once per tool commit, costs little.
- **If wrong**: both move to gix inside [`git/amend.rs`](/crates/core/src/git/amend.rs), behind the
  same two methods.
- **Where**: [`git/amend.rs`](/crates/core/src/git/amend.rs)

## R7: An Undo amends as any edit does

- **Decision**: the Undo of a committed add or removal amends the latest commit like any other edit:
  after adds of A and B, the Undo of B lists `- Add "A" ...`, `- Add "B" ...`, and
  `- Remove "B" ...`. An Undo of the latest commit's only change is a commit of its own, as R4 says.
- **Rationale**: the list says what was done, in order, and the tree is right. An Undo that never
  amends would need a flag on every commit, for a message that is not wrong.
- **If wrong**: the body names an add its own commit no longer holds; a flag on `Change` would
  exclude the Undos.
- **Where**: [`undo.rs`](/crates/core/src/actions/inbox/undo.rs),
  [`priorities.rs`](/crates/core/src/actions/priorities.rs)
