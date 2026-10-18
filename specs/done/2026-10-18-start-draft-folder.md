---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/34
---

# Record: Start a draft folder from its proposal

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/34). Its full files are
> in git: `git log -- specs/changes/2026-10-18-start-draft-folder/`.

## What and why

Starting a draft folder from its `proposal.md` (`specs/drafts/<slug>/proposal.md`), as the web UI
does, started it as a file draft: only `proposal.md` moved, and the folder's `images/` stayed
behind, breaking the proposal's image links.

## Behaviour

- Starting a draft or backlog folder by the path of any file inside it starts the whole folder: its
  images and other files move with the proposal.
- Starting a file draft, or a folder by its own path, is unchanged.

## Design

Root cause: `start::run` took the path it was given as the draft, so a folder's `proposal.md` was a
file draft. It now resolves the path with `target::draft_to_start`, which maps any path inside
`specs/drafts/` or `specs/backlog/` to its folder: see
[`start::run`](/crates/core/src/actions/start/mod.rs). The regression test is
`start_from_a_draft_folders_proposal_moves_the_whole_folder` in
[`actions.rs`](/crates/core/tests/actions.rs).
