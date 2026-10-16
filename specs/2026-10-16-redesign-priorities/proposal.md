---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Redesign home, inbox, and priorities

## What

A functional pass on the home, inbox, and priorities pages.

- Going from a Priorities line to editing the text is too many clicks (one opens the sidebar, then
  edit, then edit again...), it's bad UI for the most standard path. Clicking a priority on desktop
  should open the edit view in the sidebar, with the editor open.
- Priorities that have a draft file associated should be highlighted in the UI
- Priorities -> Draft should bring its children bullet points in the draft text, in "What
- In the priorities page we need a clear separation between Running (has a feature and worktree),
  Now, Next, and Later. Use colors and separators.
- When adding a priority from home screen on mobile we need to go to the priorities page manually to
  commit, this is super bad UX. Adding a priority should have an "Add and commit" option

- Inbox count should _not_ be front and center in the Home: it should be a small, neutral badge in
  the sidebar (grey count or something similar). The goal of Inbox is to CAPTURE notes easily and
  treat them later, it is NORMAL that it fills up a bit and gets reviewed ~ once every few days.
  - We can still have an Inbox card in the home with a small view in the notes and categories for
    example

- Inbox and Priorities should look much more similar: same ordering handles, same look and feel for
  categories, ...
- We need some basic keyboard navigation: when a priority/inbox line is selected and there's a panel
  on the right, the selected item should be highlighted, and up/down should move the focus (if the
  cursors is not in a text box).

- The home should look like a useful dashboard. It should look great in fullscreen on desktop, like
  a control hub. It can use the full width, maybe with a cards-based layout that would also work
  well on mobile. Or a more cyberpunk-styled "cockpit". You have a lot of freedom, but right now
  it's a list of grey bullet points and it mostly sucks.
- Add a constitution + decisions view: it should look good, be easy to browse and read, and have
  clear hierarchy. Could be decision in the center with constitution in the right sidebar by
  default? Find a good view yourself. In the sidebar it will be above the "Done" features.

## Why

Inbox and priorities are the entry point of every piece of work: the most standard paths should be
the fastest and looking at them should _help_ the user organize the remaining work.

## Notes

- I realize those are big changes, but:
  - They should not have any impact on the backend
  - They are all about making the flow smooth and coherent, so they are better done together imo
- I am not dead set on any specific UI decision: the goal here is to make a COHERENT UI that feels
  fast and smooth, and that's obvious to use for newcomers
