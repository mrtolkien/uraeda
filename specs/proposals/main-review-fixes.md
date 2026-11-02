# Fixes from the review of recent work on main

Check that the other PRs and recent changes were implemented properly, some of them were straight to
main, and make a new worktree for the fixes found:

- stable-buttons: the start's frame is only kept in the tab that planned the start; a refused start,
  once dismissed, flashes a landed page.
- text-focus and the focus fix after it: no test reproduces either bug, and the "give up if the
  focus moved" guard is missing from the two other places that focus a frame later.
- Sessions at work in In progress: home and the sidebar order In progress differently, and two
  comments in home's core are out of date.
- `gg` and `G`: the key map lists `g g` under Go instead of beside Home.
- review-all: its record's counts are wrong, and nothing stops the web from importing a value from
  `uraeda-server/fate` again.
