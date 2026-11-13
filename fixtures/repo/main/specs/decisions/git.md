---
icon: git-branch
---

# Git

> "A tool's commit goes through my hooks, like mine do."

Rust tools read git with gix, inside the binary, and run the system `git` binary for every write.

## Rules

- Rust tools read git through gix. _So:_ listing branches spawns no process.
- Tools run the system `git` binary for every write, and never bypass the user's hooks. _So:_ no
  `--no-verify`.

## Why

The user's hooks and signing apply to every commit a tool makes, and reads across many branches
stay fast.

## Applies to

- Every tool that reads or writes git
