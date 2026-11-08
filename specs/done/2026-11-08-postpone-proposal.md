---
kind: change
finished: 2026-11-08
pull-request: https://github.com/mrtolkien/uraeda/pull/111
---

# Record: Postponing a feature makes a proposal

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-08, finished on
> 2026-11-08, in [its pull request](https://github.com/mrtolkien/uraeda/pull/111). Its full files
> are in git: `git log -- specs/changes/2026-11-08-postpone-proposal/`.

## What and why

Postponing a feature moved its whole folder to `specs/proposals/<slug>/`, merged its branch, and
reverted its decision edits. The web UI shows only the folder's `proposal.md`, so the discovery,
answers, and spec kept beside it were invisible, and the reverted decisions read as lost work. A
postponed feature is now only a proposal: the agent writes the feature's current state as a new
proposal file, and the feature's folder leaves the default branch.

## Behaviour

- Postponing stops when the feature's worktree, or its folder on the default branch, has uncommitted
  changes.
- The feature's branch ends with `chore(<slug>): close for postponing`, which removes its folder, so
  no tool counts the kept branch as a feature, nor pairs it with the new proposal by slug.
- On the default branch, the agent writes `specs/proposals/<slug>.md`: the proposal's `discovery`
  level, its title, a **What** and a **Why** in the human's words where they still hold, with what
  the answers, notes, and reviews settled stated as decided. It ends with what is still open, and
  where the earlier work lives: the branch, the commit before it closed, and the paths to read with
  `git show`. It links no file of the folder.
- The same commit, `chore(<slug>): postpone <feature name>`, removes the dated folder and moves the
  feature's line in `PRIORITIES.md`, linked to the new proposal, only when `PRIORITIES.md` had no
  other changes. Links to the old `proposal.md` then point at the new file; links to other files of
  the folder become their words.
- The branch is never merged: its code and decision edits never reach the default branch. Its
  worktree goes, and the branch stays, as a dropped feature's does.
- Folders postponed the old way still start with `ura start`, which refuses one holding a spec as a
  change, as before.

## Design

- The step is **Postpone or block** in
  [projects.md](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature).
  No code changed: the core's `branch_feature`
  ([branches.rs](/crates/core/src/workspace/branches.rs)) counts a branch as a feature only while
  its tip holds the folder, which the closing commit relies on.
- The descriptions of `specs/proposals/` follow: [SKILL.md](/skills/uraeda/SKILL.md), the template
  README ([README.md](/skills/uraeda/assets/templates/specs/README.md)), and
  [the specs folder's docs](/docs/specs-folder.md).

## Gotchas

- **The closing commit on the branch**: without it, a kept branch still holding its folder counts as
  a feature, and `ura next` resumed its discovery in place of the new proposal, as the review found
  by running the step by hand.

## Follow-ups

- **Drop** keeps a branch that still holds its folder, so the dropped feature still shows under "Not
  in priorities". The same closing commit would fix it; it is outside this change.
