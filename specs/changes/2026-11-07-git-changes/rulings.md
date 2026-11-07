# Rulings: The git "changes" counter should only count changes on main

The low-impact choices made while making [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: A worktree's pane has a dashed blue border, a branch's icon, and "· worktree"

- **Decision**: On the Git page, a feature worktree's group of changes is a pane of a new tone,
  `worktree`: a 1 px dashed border in the theme's blue, its title in blue, the branch's icon before
  the feature's name, and "· worktree" after its count. The main checkout's "Changes" keeps the
  plain border.
- **Rationale**: The proposal asks for "another border" and to be "_clearly_ marked as worktrees".
  The [UI look](../../decisions/ui-look.md) keeps every border 1 px, and a double border already
  marks a live window, so the border's style and colour carry the difference; the word and the icon
  name it, as the colour alone would not to a reader who does not see colours. The branch's icon is
  the one Git already wears in the navigation.
- **Alternatives considered**: A title "Worktree: Dark mode", which pushes the feature's name to the
  second word; a colour alone, which the existing tones already use for other meanings.
- **If wrong**: The tone is one style in `packages/web/src/layout/Pane.tsx`, and its use one
  constant in `packages/web/src/git/ChangesTree.tsx`.
- **Where**: `packages/web/src/layout/Pane.tsx`, `packages/web/src/git/ChangesTree.tsx`

## R2: The inbox's and the priorities' count of changes stays every branch's

- **Decision**: Only the Git count changes. The count of changes on the Inbox and Priorities pages,
  which adds up the edits of those lists waiting on each branch, keeps counting every branch's.
- **Rationale**: The proposal names the git "changes" counter, the one on Git in the navigation. The
  lists' count tells where an edit to that list waits, which a branch's own edit is.
- **Where**: `crates/core/src/api/git_page.rs`
