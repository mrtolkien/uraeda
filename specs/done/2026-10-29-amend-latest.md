---
kind: change
finished: 2026-10-29
pull-request: https://github.com/mrtolkien/uraeda/pull/66
---

# Record: Amend the latest commit

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-29, finished on
> 2026-10-29, in [its pull request](https://github.com/mrtolkien/uraeda/pull/66). Its full files are
> in git: `git log -- specs/changes/2026-10-29-amend-latest/`.

## What and why

Small edits to the workflow's own files, the inbox, the priorities, proposal files, and note files,
each made one commit on the default branch: a day of notes and reorderings filled `git log` with
noise. The tools now amend the latest commit when it is one such commit nobody else has yet.

## Behaviour

- A tool's commit, from `ura`, the web UI, or the language server, amends the latest commit instead
  of adding one when both are `chore:` commits without a scope, of `specs/INBOX.md`,
  `specs/PRIORITIES.md`, and files under `specs/proposals/` and `specs/notes/` alone, on the default
  branch. The latest commit has one parent, and its body is empty or a list of changes.
- A commit another local branch, a remote branch as last fetched or pushed, or a tag holds is never
  amended: a pushed commit, or one a feature or a change started from, stays as it is. A push git
  did not record, to a URL or from another clone, cannot be seen.
- The amended subject names the latest commit's first change and ends with `, and <count> more`; the
  body lists every change of both commits, one per line, a commit's single change given by its
  subject: `- Add "An idea" to the inbox`.
- A commit that would take the latest commit back to its parent, like the Undo of its only change,
  is a commit of its own. An amend git or a hook refuses is tried once more as a commit of its own,
  so a commit never stays stuck; a hook refusing both is reported as before.
- Every other commit is unchanged: starts, promotes, drops, triages, answers, verdicts, a human's
  `docs:` commit or a body they wrote, and every commit off the default branch.
- A proposal started from a card of the New page links its source file from the repository's root,
  `From [PRIORITIES.md](/specs/PRIORITIES.md)`: the relative link pointed inside the started
  proposal's folder, and failed `ura check`.

## Design

Every action's commit goes through [`actions::commit`](/crates/core/src/actions/commit.rs), which
asks [`actions::amend::message`](/crates/core/src/actions/amend.rs) whether to amend and with which
message: the rule has one home. [`git/amend.rs`](/crates/core/src/git/amend.rs) reads the latest
commit, its parents, message, and files (`git diff-tree`), and whether a branch or a tag holds it
(`git for-each-ref --contains`); gix gives neither. `Git::commit` and `Git::commit_only` in
[`git/commit.rs`](/crates/core/src/git/commit.rs) take an `amend` flag, passing `--amend`, and
`--amend --only` for a commit of some files alone; the start and promote commits pass `false`. The
check against an empty amend compares the files on disk with the parent's, a folder of images
covering the files under it. The [conventions](/skills/uraeda/references/conventions.md) describe
the amend, optional by hand. Tests that chain tool commits and check what each holds keep each
commit with `TestRepo::keep()`, a branch on the latest commit. The New page's link is built in
[`NewEntries.tsx`](/packages/web/src/NewEntries.tsx).

## Gotchas

- The git decision has no rule on amending: an amend of a commit only this checkout has loses no
  work, runs the hooks, and never needs a force-push, which keeps it within the decision's limits.
- Two hand-made records hold only these files and are amended by the next tool commit, their changes
  kept: the scratchpad's move into the inbox, and a split-out item's `chore: expand <Name>`.
- An Undo amends as any edit does: after adds of A and B, the Undo of B lists the add of A, the add
  of B, and the removal of B.
