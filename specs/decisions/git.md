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

- Tools MUST NOT lose the user's work: no force-removed worktree, no force-push, and no deleted
  branch with commits the default branch lacks. Checked by the core's tests.
- Tools MUST remove or delete anything only when a human asks. Checked by the core's tests.
- Tools MUST NOT bypass the user's hooks, signing, or credentials. Checked by the core's tests.
- Tools MUST NOT switch the user's checkout unless the human asks. Checked by review.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core. Checked by review.
- Proposal files, note files, and the human's inbox and priorities MUST be written on the default
  branch. Checked by the core's tests.
- An agent's inbox notes MUST be written in its own worktree, never on the default branch. Checked
  by the CLI's tests.
- A branch's step SHOULD be read from its latest commit. Checked by the core's workspace tests.
- Tools SHOULD keep their worktrees out of the user's `git status`, without editing a tracked file.
  Checked by the core's tests.

## Why

Reads are most of what the tools do, across every branch, and gix does them in process. gix runs no
hooks and cannot push, so writes go through `git`, exactly as the user would. The web UI writes on
every branch from one checkout, so it never switches branches. Cleanup waits for the human, since a
lost commit cannot come back. History: [CLI core](../done/2026-10-10-cli-core.md).

## Alternatives considered

- The system `git` for everything: a process, and text to parse, for every read.
- Switching the user's checkout to write: abandoned when the web UI had to write on every branch.
- Reading a checked-out branch from its disk: it showed branches outside the workflow, and gates not
  committed yet.

## Consequences

- Hooks, signing, and credentials behave as by hand, and `git` must be on the PATH.
- gix breaks its API at minor releases, so upgrades are deliberate.
- The web UI moves when a commit lands, not when a file is saved.

## Applies to

- [`crates/`](/crates/), and every feature that reads or writes git: the CLI, the git listener, the
  runner
