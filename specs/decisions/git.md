---
icon: git-branch
---

# Git

> "… super destructive action without validation (discard) … forms and all just edit and save file,
> and committing is its own dedicated view/flow."

Said of a commit bar that sat on every page, with a Discard that asked nothing. Uraeda's tools leave
the human's repository as the human would: nothing lost, nothing removed, nothing committed that
they did not ask for. A tool here is Uraeda's own code: the `ura` CLI, the server, and the app. What
an agent may run in its session is the human's to allow, and no part of this decision.

## Rules

- Tools never lose the user's work: no force-removed worktree, no force-push, and no deleted branch
  with commits the default branch lacks. _So:_ a pushed commit is never amended, since only a forced
  push could send it again. A removed note keeps its file while the file holds text never committed.
- Tools remove or delete only when a human asks. _So:_ a merged feature's worktree and branch stay
  until the human runs `ura clean`, and a worktree with uncommitted work is reported and left alone.
- Tools write git as the user would, through the system `git`, never around their hooks, signing, or
  credentials. _So:_ a commit made from the app runs the user's pre-commit hook, and fails when the
  hook refuses it. No `--no-verify`, and no commit written by a library.
- Tools never switch the user's checkout unless the human asks. _So:_ a new feature starts in a
  worktree of its own. An answer for a branch that is not checked out is written in that branch's
  worktree.
- Tools never commit the human's edits unless they ask for that commit, on the Git page or by an
  action that says it commits. _So:_ saving the priorities only saves the file, and "Commit answers"
  commits a round. Starting a feature commits by itself, which the human allowed: "that much is ok".

## Why

Uraeda works in the human's own repository, beside their editor, their hooks, and their habits. A
lost commit, or a note typed and never committed, cannot come back, so removal waits for the human.
Writes go through `git` itself, so hooks, signing, and credentials behave as they do by hand. The
app writes on every branch from one checkout, often from a phone. So it works through worktrees, and
never moves the branch the human is on. A commit made behind an edit hides what it holds: the human
commits what they have seen. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- The system `git` for reads too: proposed first, and refused by the human for speed across many
  branches. Reads are in process, with the gix library, wherever it can do them.
- Switching the user's checkout to write: the first choice, abandoned when the app had to write on
  every branch.
- Committing an edit as it is saved: every page grew a commit bar, and the human could not see what
  a commit held.

## Applies to

- [`crates/`](/crates/) and [`app/`](/app/), and every feature that reads or writes git: the CLI,
  the server, the app's Git page

## Revisit when

Uraeda removes merged worktrees and branches by itself. The human expects to automate that cleanup
later: until then, the second rule holds as written.
