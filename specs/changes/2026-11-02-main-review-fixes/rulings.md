# Rulings: Fixes from the review of recent work on main

The low-impact choices made while fixing what the review of recent work on main found, inside the
limits of [the proposal](proposal.md) and the decisions. None binds future work: those are
decisions.

## R1: Only the value imports from the server's fate module are fixed

- **Decision**: of the proposal's findings, only one is fixed: the web's lint now refuses a value
  imported from `uraeda-server/fate`, which once blanked the app in development while every check
  passed. The others are dropped: the start's frame kept only in the tab that planned it and the
  refused start's flash, the focus guards and their tests, the order of In progress, `g g` in the
  key map, the review-all record's counts, and two comments.
- **Rationale**: the human ruled them not worth the work: stable buttons matter for the buttons that
  act, like sending or starting, not for a page drawing in after a navigation. The stable-buttons
  record and the space and motion guide now say so.
- **If wrong**: each is a small change to the file the review named.
