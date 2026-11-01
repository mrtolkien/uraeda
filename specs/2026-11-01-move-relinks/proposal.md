---
discovery: low # low, medium, or high: how far the agent researches before asking
---

# Moving a file never breaks a link to it

## What

- Every move of a workflow file rewrites the links to it, in every file of `specs/`, not only in
  `PRIORITIES.md` and `INBOX.md`: a proposal's start, a change started as a feature, a note moved to
  the proposals, a postpone, a drop
- A link broken by a move made on another branch is repaired, not fixed by hand: a record or a link
  written on a branch that merges after the move still links the old path
  - A dated folder that finished becomes its record: `/specs/<dated>/…` is `/specs/done/<dated>.md`,
    a question's anchor kept as the finish step says
  - A proposal file that started is found through git's renames
- `ura check` says where each broken link's file went, and `ura check --fix` rewrites them
- The finish step, and merging the default branch into a branch, run the fix

Starts as a change.

## Why

- Starting a proposal moves its file but leaves the links to it in `specs/done/` records: three
  starts on 2026-10-30 broke three links in the inbox-again record
- Finishing proposal-start broke a fourth, written on another branch beside the finish
- Each time `ura check`, part of `vp run ready`, failed on the default branch until a human or an
  agent fixed the link by hand

## Notes

- `crates/core/src/files/retarget.rs` already rewrites a link's destination in place, rooted or
  relative, anchors and reference definitions kept: today it runs on `PRIORITIES.md`, `INBOX.md`,
  and the proposal's own files alone
- `crates/core/src/check/links.rs` already finds the broken links
- The core's moves call the same rewrite as the fix, with the files it changed in their commit, and
  put back on a hook's refusal as the proposal file is
- The skill's finish and projects references, and the CLI reference, change with it
