# Rulings: Amend the latest commit

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[git](/specs/decisions/git.md) decision. None binds future work: those are decisions.

## R1: Never amend a commit another branch holds

- **Decision**: a tool amends the latest commit only when no other branch, local or remote, holds
  it. A pushed commit is never amended, nor one a feature or a change was started from.
- **Rationale**: the git decision forbids force-pushing. A pushed commit, once amended, could only
  be pushed again by force. A branch started from it would keep the old commit, and its merge would
  bring the same edits twice.
- **If wrong**: edits after a push make one more commit until the next push. The check is
  [`held_elsewhere`](/crates/core/src/git/amend.rs).
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs)

## R2: Only an unscoped `chore:` of the same files, its body a list or empty

- **Decision**: both commits are `chore:` commits without a scope, of `INBOX.md`, `PRIORITIES.md`,
  and files under `specs/proposals/` and `specs/notes/` alone, on the default branch. The latest
  commit's body, if any, is a list of changes, one per `- ` line.
- **Rationale**: these are the commits of small edits the proposal names: the commit bar's, a
  proposal file's or a note file's from its editor, and `ura note`'s. A start, a drop, or a triage
  holds other files, and their commits are a step's record. A human's `docs:` commit, or a body they
  wrote, keeps its words rather than being folded into a list.
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
  parent's, the commit is a new one, not an amend.
- **Rationale**: the amend would leave an empty commit, which git refuses. Dropping the commit
  instead would delete history, which the git decision leaves to the human.
- **Where**: [`amend.rs`](/crates/core/src/actions/amend.rs)

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
