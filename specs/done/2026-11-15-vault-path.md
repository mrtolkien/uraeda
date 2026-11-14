---
kind: change
finished: 2026-11-15
pull-request: https://github.com/mrtolkien/uraeda/pull/126
---

# Record: Vault read accepts a path

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-15, finished on
> 2026-11-15, in [its pull request](https://github.com/mrtolkien/uraeda/pull/126). Its full files
> are in git: `git log -- specs/changes/2026-11-15-vault-path/`.

## What and why

The human starts a proposal by pasting the path Obsidian's "Copy path" gives for a note, like
`projects/moyo/Moyo plan up to chat`. Obsidian leaves out the `.md`, and `ura vault read` failed on
it with `no note`. `ura vault` now takes an existing note's path with or without its `.md`.

## Behaviour

- `ura vault read`, `write`, `write --set`, and `rm` take an existing note's path without its `.md`,
  and act on `X.md`. `--set` on a bare path writes into `X.md` and never creates a second file `X`.
- A file that exists at the path as given wins over its `.md`: with both `a` and `a.md`, `a` is
  read.
- A path that names no file and no `.md` is taken as given: a new note's path names its `.md`.
- A path the vault refuses stays refused: `wiki/..` is never read as `wiki/...md`. The read-only
  `projects/<repository>/specs/` and links out of the vault are refused through the bare path too.

## Design

The four functions joined the path to the vault as written. One resolver,
[`notes::named`](/crates/vault/src/notes.rs), now gives the note a path names, and `read`, `write`,
and `rm` call it before anything else; `set` reaches it through `read` and `write`, so both land on
the same file. The CLI ([`vault.rs`](/crates/cli/src/vault.rs)) only passes the path on.

## Gotchas

- `named` checks the path as given before adding `.md`: `clean` accepts `...md` as a name, so adding
  it first turned a refused `..` path into a valid one.
- `named` runs before `writable`, so the link check covers the file actually written, `X.md`, and
  not the bare name.
- The sync calls `writable`, `write_atomic`, and `trash` directly, and `ura status` reads paths from
  `ls`: neither goes through `named`, and neither changed.
