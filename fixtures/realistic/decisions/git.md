---
icon: git-branch
---

# Git

> "Tools never lose my work."

Uraeda's tools read git fast, in process, and write it exactly as the user would.

## Rules

- Tools never lose the user's work, and remove or delete anything only when a human asks. _So:_ no
  force-push, and no deleted branch with commits the default branch lacks.
- Tools never bypass the user's hooks, signing, or credentials. _So:_ no `--no-verify`.
- Tools never switch the user's checkout unless the human asks. _So:_ the web UI writes on every
  branch from worktrees.
- Rust tools read git with the gix library, and write through the system `git`. _So:_ listing
  branches spawns no process, and a commit runs the user's hooks.
- Proposals, notes, and the human's inbox and priorities are written on the default branch. _So:_ an
  agent's own notes stay in its worktree.

## Why

Reads are most of what the tools do, across every branch, and gix does them in process. gix runs no
hooks and cannot push, so writes go through `git`. Cleanup waits for the human, since a lost commit
cannot come back. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- The system `git` for everything: a process, and text to parse, for every read.
- Switching the user's checkout to write: abandoned when the web UI had to write on every branch.

## Applies to

- [`crates/`](/crates/), and every feature that reads or writes git: the CLI, the git listener, the
  runner
