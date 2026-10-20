---
status: active
approved-by: mrtolkien
icon: git-branch
---

# Git

Uraeda's tools read git fast, in process, and write it exactly as the user would, through their own
hooks, signing, and credentials. The workflow's state is what is committed, on every branch at once.
Tools never lose the user's work.

## Rules

- Tools MUST NOT lose the user's work: they never force-remove a worktree, force-push, or delete a
  branch the default branch lacks, and remove or delete anything only when a human asks. Checked by
  the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials, and MUST NOT switch the user's
  checkout unless the human asks. Checked by the core's tests and review.
- Rust tools MUST read git with gix and run the system `git` for writes, through one core module.
  Checked by review.
- A branch MUST count as a feature or a change, and its step be read, only from its latest commit.
  Checked by the core's workspace tests.
- Drafts, the backlog, and the human's inbox and priorities MUST be written on the default branch.
  Checked by the core's tests.
- An agent's inbox notes MUST be written in its own worktree, never on the default branch. Checked
  by the CLI's tests.
- Tools SHOULD keep their worktrees out of the user's `git status` without editing a tracked file.
  Checked by the core's tests.

## Why

Reads are most of what the tools do, across every branch, and gix does them without a process. gix
runs no hooks and cannot push, so writes go through `git`
([how `ura` runs git](../done/2026-10-10-cli-core.md#q6-how-does-ura-run-git)). The web UI writes on
every feature's branch from one running checkout, so switching branches is not an option
([writing to a branch that is not checked out](../done/2026-10-11-web-ui.md#q3-where-does-the-ui-write-when-a-features-branch-is-not-checked-out)).
Cleanup waits for the human and keeps any work the default branch lacks
([who removes a merged feature's branch](../done/2026-10-12-finish-feature.md#q5-who-removes-a-merged-features-branch-and-worktree)).

## Alternatives considered

- The system `git` for everything: a process and text to parse for every read.
- jujutsu's library, or a crate wrapping the git command line: no hooks, or missing reads.
- Switching the user's checkout to write: abandoned when the web UI had to write on every branch.
- Reading a checked-out branch from its disk: abandoned, it showed branches outside the workflow and
  uncommitted gates.

## Consequences

- Hooks, signing, and credentials behave as by hand, and `git` must be on PATH.
- gix breaks its API at minor releases, so upgrades are deliberate.
- The UI moves when a commit lands, not when a file is saved.

## Applies to

- [`crates/`](/crates/), and every Rust feature that reads or writes git: the CLI, the git listener,
  the runner
