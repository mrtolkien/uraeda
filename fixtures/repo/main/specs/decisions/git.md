---
status: active
approved-by: mrtolkien
icon: git-branch
---

# Git

Uraeda's Rust tools read git with gix, the pure Rust implementation, inside the binary, and run the
system `git` binary for every write. Reads across many branches stay fast and need no process, while
commits go through the same hooks, signing, and configuration as the user's own.

## Rules

- Rust tools MUST read git through gix. Checked by review.
- Tools MUST run the system `git` binary for every write. Checked by review.
- Tools MUST NOT bypass the user's hooks: no `--no-verify`. Checked by review.

## Why

The user's hooks and signing apply to every commit a tool makes.

## Consequences

- Each write spawns a process.

## Applies to

- Every tool that reads or writes git
