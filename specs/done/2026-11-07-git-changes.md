---
kind: change
finished: 2026-11-07
pull-request: https://github.com/mrtolkien/uraeda/pull/105
---

# Record: The git "changes" counter should only count changes on main

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-07, in [its pull request](https://github.com/mrtolkien/uraeda/pull/105). Its full files
> are in git: `git log -- specs/changes/2026-11-07-git-changes/`.

## What and why

Git, in the sidebar and in the phone's tabs, counted the changed files of every feature's worktree
with the main checkout's, so it showed edits that wait on each feature's own branch as if they were
waiting on main. It now counts the main checkout's changes alone. On the Git page, a worktree's
changes are set apart from the main checkout's, and clearly marked as a worktree's.

## Behaviour

- Git's count is the main checkout's changed and conflicted files, then the commits to pull, read
  the same from any checkout of the repository. A feature worktree's changes never count, though the
  Git page still lists them, one group per worktree.
- On the Git page, a feature worktree's group of changes is a pane with a 1 px dashed border in the
  theme's blue, its title in blue, the branch's icon before the feature's name, and "· worktree"
  after its count. Active, it keeps its dashes, in the accent. The main checkout's Changes keeps its
  plain border.
- The Inbox's and the Priorities' own count of changes still adds up every branch's edits of those
  lists: only Git's count changed.

## Design

**Root cause**: [`git_summary`](/crates/core/src/api/git_page.rs) added each feature worktree's
changed count to the main checkout's. It now reads the main checkout alone, through
`Git::discover(repo)?.main_root()`, without reading the workspace. Its test is
`the_count_is_the_main_checkouts_changes_alone` in [`git_page.rs`](/crates/core/tests/git_page.rs),
which reads the count from the main checkout and from the worktree, the main checkout holding more
changes than the worktree.

**Approach for the mark**: a new pane tone, `worktree`, in
[`Pane.tsx`](/packages/web/src/layout/Pane.tsx), beside the double border of a live window: the
[UI look](/specs/decisions/ui-look.md) keeps every border 1 px, so the border's style and colour
carry the difference, and the word and the icon name it for a reader who does not see colours.
[`ChangesTree.tsx`](/packages/web/src/git/ChangesTree.tsx) gives it to every group but the main
checkout's. The guides say it in [look and feel](/specs/ui/look-and-feel.md) and
[flows](/specs/ui/flows.md), and the [web UI's page](/docs/web-ui.md) for users.

## Replaced behaviour

- **The count of every feature worktree's changes**: the assertion that the count was 2, the main
  checkout's file and the worktree's, in `the_page_groups_changes_and_lists_worktrees`, and the one
  that an unreadable worktree left the count at 1, in
  `an_unreadable_worktree_or_an_unknown_commit_fails_no_read`, both removed: the count no longer
  reads worktrees. Both in [`git_page.rs`](/crates/core/tests/git_page.rs).

## Follow-ups

- No test of the web UI checks the worktree's mark: the Git page's tests run on a fixture without a
  feature worktree holding changes. It was checked in the running app, wide and on the phone.
