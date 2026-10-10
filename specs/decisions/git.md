---
status: proposed
approved-by:
---

# Git

Uraeda's Rust tools read git with gix, the pure Rust implementation, inside the binary, and run the
system `git` binary for every write. Reads across many branches stay fast and need no process, while
commits go through the same hooks, signing, and configuration as the user's own.

## Rules

- Rust tools MUST read git through gix: references and branches, files at a ref, worktrees, the
  working tree's status, and ancestry.
- Tools MUST run the system `git` binary for every write: commits, branch switches, and pushes, and
  for any read gix does not support.
- Tools MUST NOT bypass the user's hooks: no `--no-verify`, and no commit written by gix or with
  plumbing to skip them.
- Tools MUST NOT link another git library, such as git2 (libgit2) or jj-lib.
- Output of the `git` binary MUST be parsed only in its plumbing, `--porcelain`, or `--format`
  forms, never as text meant for humans.
- In Rust, every git access MUST go through one module of the core, so no other code uses gix or
  builds `git` command lines.
- gix MUST be built without its default features, with only those the reads need.

## Why

Reads are most of what the tools do with git, across every feature branch at once, and gix does them
in process, in pure Rust. gix runs no hooks and cannot switch branches or push, so writes go through
`git`, where hooks, signing, and credentials follow the user's configuration: this repository's
pre-commit hook formats files
([Q6](../2026-10-10-cli-core/clarifications-01.md#q6-how-does-ura-run-git),
[git backend](../2026-10-10-cli-core/discovery-01.md#git-backend),
[git from Rust](../2026-10-10-cli-core/discovery-01.md#git-from-rust)).

## Alternatives considered

- The system `git` for everything: no dependency, but a process per read, and output to parse for
  every read.
- jujutsu's library: it runs no git hooks, needs a `.jj` folder in every user's repository, and
  calls `git` for fetch and push anyway
  ([jj's git compatibility](https://docs.jj-vcs.dev/latest/git-compatibility/)).
- A crate wrapping the git command line: `git_cmd` covers release-plz's needs, without listing
  branches, reading files at a ref, or listing worktrees; `git-spawn` is async and young (0.4,
  2026); `gitwrap` has had no release since 2024
  ([git_cmd](https://docs.rs/git_cmd/latest/git_cmd/struct.Repo.html),
  [git-spawn](https://crates.io/api/v1/crates/git-spawn),
  [gitwrap](https://crates.io/api/v1/crates/gitwrap)).

## Consequences

- Reads need no `git` process; `git` must still be on PATH for writes.
- Hooks, signing, and credentials behave as when the user commits by hand.
- The binary grows: a CLI with clap, serde, a markdown parser, and gix measured 1.9 MB
  ([Rust binaries](../2026-10-10-stack-decision/discovery-01.md#rust-binaries)), against a 3 MB
  limit that the TUIs will also draw on.
- gix is 0.x and may break its API at each minor release: upgrades are deliberate.
- Two ways to reach git, kept behind one module.

## Applies to

- [`crates/`](/crates/), and every Rust feature that reads or writes git: the CLI, the git listener,
  the runner
