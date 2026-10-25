---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Inbox and priorities in the terminal look

## What

The inbox and the priorities, redrawn in the look and shell of
[layout and look](../done/2026-10-20-layout-look.md).

- **Inbox**: note readability and hierarchy first; notes shown whole, reorderable, in categories
  that can be created and deleted, with a note's actions beside it.
- **Priorities**: Ongoing, Now, Next, and Later as columns on wide and semi-wide screens, kanban
  style, and a vertical list on the phone; menu actions to move a line, beside dragging.

## Why

These pages keep the old look beside the new shell until this lands. Answers and sources:

- The information architecture: [the proposal](../done/2026-10-20-layout-look.md).
- The priorities in columns:
  [round 01's priorities question](../done/2026-10-20-layout-look.md#q8-how-should-priorities-be-laid-out).
- Split from the lists and starts, the third feature of
  [round 01's split](../done/2026-10-20-layout-look.md#q1-how-should-this-work-be-split-into-features).

## Notes

- I'd like to allow giving some context to the 3 columns in the file (now, next, later), so a human
  can say what they represent _right now_ for this project.

- The two views _could_ be extremely different: vertical columns for priorities vs categories for
  inbox? Make multiple proposals
  - The difference is that priorities is opinionated and have a clear hierarchy, whereas inbox is
    more freeform
  - The views should also be kinda self-documenting: it should be clear to the user what goes in the
    inbox vs what's a priority

- I want great keyboard navigation: `hjkl` and arrows for movement, shifted should move the
  note/priority with it, o/O should insert a new line before/after, a/i and capital versions should
  open an inline edit of the highlighted line, dd on a line should delete it... Basic vim-like
  behaviour.
  - Those two pages are the views where I still use nvim because I prefer it for fast management: a
    dedicated shortcut map for this page would help a lot!
