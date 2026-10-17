---
status: proposed
approved-by:
icon: git-branch
---

# Git

Uraeda's tools read git fast, in process, and write it exactly as the user would, through their own
hooks, signing, and credentials. The workflow's state is what is committed, on every branch at once.
Tools never lose the user's work: they never force-remove a worktree or force-push, never switch the
user's checkout, and clean up only when asked.

## Rules

- Rust tools MUST read git with gix, built with only the features they need, and run the system
  `git` for writes and reads gix lacks, linking no other git library. Checked by review.
- In Rust, every git access MUST go through one core module, which parses only `git`'s
  machine-readable output. Checked by review.
- Tools MUST NOT bypass the user's hooks, and commits in a linked worktree MUST run the main
  checkout's hooks. Checked by the core's tests and review.
- Tools MUST NOT switch the user's checkout unless the human asks: they write where the branch is
  checked out, or in a new worktree under `.worktrees/`. Checked by review and the CLI's tests.
- Drafts, the backlog, `PRIORITIES.md`, `INBOX.md`, and `INBOX-TRIAGE.md` MUST be written on the
  default branch; a tool MAY use another checkout's copy only while it matches, and MUST otherwise
  refuse, naming the default branch's checkout. Checked by the core's tests.
- A branch MUST count as a feature or a change, and its step be read, only from its latest commit;
  uncommitted files only mark uncommitted changes. Checked by the core's workspace tests.
- Tools MUST remove a worktree or delete a local branch only when a human asks, for a feature merged
  into the default branch, and MUST NOT delete remote branches; pruning records of gone folders
  stays allowed. Checked by review.
- Tools MUST remove only worktrees under `.worktrees/`, never forced, and leave one that is locked
  or holds uncommitted or untracked files, read from git's state, not its messages. Checked by the
  core's tests.
- Tools MUST delete a local branch with `git branch -D` only once no worktree has it, and only when
  `git log --cherry-pick` finds every commit, or a patch-equivalent, on the local or remote-tracking
  default branch. Checked by the core's tests.
- Tools MUST keep `.worktrees/` out of the user's `git status` without editing a tracked file.
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
