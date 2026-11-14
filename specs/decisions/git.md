---
icon: git-branch
---

# Git

> "… super destructive action without validation (discard) … forms and all just edit and save file,
> and committing is its own dedicated view/flow."

Said of a commit bar that sat on every page, with a Discard that asked nothing. The owner's proposal
for Uraeda light took it further: "Agents make every commit." and "`ura` never commits, branches, or
makes a worktree." A tool here is Uraeda's own code: `ura`, its pages, and the vault's sync. What an
agent may run in its session is the human's to allow, and no part of this decision.

## Rules

- Tools never write git: no commit, branch, worktree, checkout switch, fetch, or push. They write
  files, and the next agent step commits them. _So:_ "Send answers" on a round's page writes the
  round's file and sets it `answered`, and the agent's next step commits it first, unchanged.
- Tools read git without running it or its hooks. _So:_ `ura` reads branches, commits, and what
  changed since a review in process, with gix, and a repository's hooks never run because a page was
  opened.
- Tools never lose the user's work. _So:_ `ura vault rm`, and a deletion the sync carries, move the
  file to the vault's `.trash/`. An answer or a review written on a version of the file that has
  changed since is refused, never written over.

## Why

Uraeda works in the human's own repository, beside their editor, their hooks, and their habits. A
commit made behind an edit hides what it holds, and a tool that commits needs its own answers to
hooks, signing, and conflicts. Agents commit at the end of every step anyway, so the human's work
waits for the next one. Reading in process is fast across many branches, and runs nothing the
repository holds. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- The system `git` for reads too: proposed first, and refused by the human for speed across many
  branches.
- Switching the user's checkout to write: the first choice, abandoned when the app had to write on
  every branch.
- Tools that commit, as the 2.x app did: first each edit as it was saved, where every page grew a
  commit bar and the human could not see what a commit held, then answers and new features, a second
  committer beside the agents.

## Applies to

- [`crates/`](/crates/), and every feature that reads git or writes a file in a repository or the
  vault
