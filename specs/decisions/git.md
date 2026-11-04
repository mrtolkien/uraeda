---
status: active
approved-by: mrtolkien
icon: git-branch
---

# Git

Uraeda's tools read git fast, in process, and write it exactly as the user would, through their own
hooks, signing, and credentials. The workflow's state is what is committed, on every branch at once,
as [Feature status](feature-status.md) reads it. Tools never lose the user's work, and never commit
it for them: committing is the human's act.

## Rules

- Tools MUST NOT lose the user's work: no force-removed worktree, no force-push, and no deleted
  branch with commits the default branch lacks. Checked by the core's tests.
- Tools MUST remove or delete anything only when a human asks. Checked by the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials. Checked by the core's tests.
- Tools MUST NOT switch the user's checkout unless the human asks.
- Tools MUST NOT commit the human's edits unless the human asks for that commit, on the Git page or
  by an action that says it commits. Checked by the core's tests.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core.
- Proposal files, the human's note files, and the human's inbox and priorities MUST be written on
  the default branch. Checked by the core's tests.
- A feature's or a change's branch MUST NOT write `PRIORITIES.md` or `INBOX.md`. Checked by the
  core's tests.
- An agent's inbox note MUST be a note file of its own, written in its own worktree, never on the
  default branch. Checked by the CLI's tests.
- Tools SHOULD keep their worktrees out of the user's `git status`, without editing a tracked file.
  Checked by the core's tests.
- Starting a feature or a change MAY commit on its own, as its first step.

## Why

Reads are most of what the tools do, and gix does them in process; it runs no hooks, so writes go
through `git`, as the user would. The web UI writes on every branch from one checkout, so it never
switches branches. Cleanup waits for the human, since a lost commit cannot come back. Commits wait
too: the Git page shows what a commit holds before it lands. Branches add files rather than edit
shared ones, so parallel work merges without conflict. History:
[CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- The system `git` for everything: a process, and text to parse, for every read.
- Switching the user's checkout to write: abandoned when the web UI had to write on every branch.
- Committing an edit as it is saved: it skips the Git page, where the human sees what a commit
  holds.

## Consequences

- Hooks, signing, and credentials behave as by hand, and `git` must be on the PATH.
- gix breaks its API at minor releases, so upgrades are deliberate.
- A merged feature's line stays in the priorities until `ura clean` removes it.
- An edit saved by any page waits on the Git page, which lists the edits of every branch.

## Applies to

- [`crates/`](/crates/), and every feature that reads or writes git: the CLI, the git listener, the
  runner
