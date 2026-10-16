---
kind: feature
finished: 2026-10-16
pull-request: https://github.com/mrtolkien/uraeda/pull/25
---

# Record: Redesign sidebars and global interface

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-16, finished on
> 2026-10-16, in [its pull request](https://github.com/mrtolkien/uraeda/pull/25). Its full files are
> in git: `git log -- specs/2026-10-16-redesign-interface/`.

## What and why

A functional pass over what every page shares: the sidebars, the navigation, and the agents'
statuses, before the look and feel pass. The sidebar had to make the flow's hierarchy obvious,
Inbox, Priorities, Changes, Features, and to tell the human when they are needed; the statuses were
iffy, "waiting on you" before a run had fully ended, "pull request ready" before one was opened, and
items that never followed the workflow showed. Git writes took seconds with no feedback.

## Behaviour

- **Statuses tell the truth**: a branch is a feature or a change only with its folder or record at
  its latest commit; an uncommitted folder in the main checkout is nothing. Each item's step is read
  from its branch's commits, uncommitted files only a flag. Past its last task, the core asks `gh`
  for the branch's pull request every minute and on each branch move: "Final review", "Finishing,
  draft pull request" (the agent's), "Pull request ready" with "#N" linking to it (the human's), or
  "Changes requested"; without `gh`, "Pull request state unknown", the last known state kept for 10
  minutes after `gh` fails. A run stays "Working" until every background task of it, background
  commands included, has ended, and its process is not closed by the idle timer meanwhile.
- **The sidebar shows the hierarchy**: a search, Home, "Needs you" with what waits on the human,
  Inbox and Priorities with their counts and ＋, Changes, Features in flight in the workflow's
  order, Chats, the five-hour allowance, the latest done items, then Settings. Each feature or
  change is a card: its step's icon at the start, its name, its status at the end, a terminal icon
  while a background command runs, a muted "…" always drawn so the card never changes size; on its
  second line, a "Change" tag under Needs you, its task "7/11 · Session column", its pull request
  "#31", and the lines its branch changed, "+1050 −250"; then its running sub-agents. Its accessible
  name reads all of it in words. No drafts row: drafts are reached from the priorities.
- **Fold and resize**: one button at the sidebar's top, shown under the pointer and always to the
  keyboard and on touch, folds it to a rail of icons and unfolds it, at the same spot in both
  states; `[` does the same outside text fields. The sidebar resizes from 200 to 480 px, 280 by
  default, folds when dragged under 160, its width and state kept in the browser; its width eases
  over 200 ms, at once under reduced motion. A session's column, "Progress", resizes from 280 to 560
  px, 320 by default, and one button at the page's top right, at the same spot in both states, hides
  and shows it, as `]` does; the page beside it stays mounted.
- **Home on the phone**: the top bar starts with a Home button, marked as the current page on home.
- **Git writes**: a button that writes to git reads what it does at once, "Committing…", with a
  spinner; every other writing button is blocked, still focusable, with the tooltip "Another change
  is being saved to git", and a thin bar runs at the top of the page; field saves and "Discard them"
  stay free. The item's card shows the action in flight, "Committing…", "Starting the agent…",
  "Stopping…", until the server's status for it changes, 10 seconds after the write ended, or the
  write fails; it never guesses a status.
- **Notifications**: a banner above the page offers them, and asks the browser only from "Turn on";
  "Not now" is kept. Each item that comes to need the human while a page is open notifies once per
  ask, "settings-page needs you", from the one tab holding the Web Lock `uraeda.notify`, only while
  no Uraeda tab is in front; a click opens the item. The tab's title counts what waits across every
  repository, "(2) Uraeda". Items that needed the human when the page loaded do not notify.
- **The latest done items**: at the sidebar's bottom, after a separator, up to five, as many as fit
  below the rows above without making them scroll, with "…" opening Home at its Done group.
- **Rename and colour**: a card's "…" opens "Feature settings": a name of up to 40 characters,
  trimmed, empty for the slug, and a colour, drawn as a stripe at the card's start. The server keeps
  them in the repository's entry of `repositories.json`; the slug, branch, and pages keep the slug.
- **Smaller fixes**: the theme left the sidebar; it is picked on the settings page, which merged
  meanwhile. In the add form, Down and Up move through the folder suggestions and Enter fills the
  field with the active or only one, then adds it; Enter in the repository menu's filter opens the
  one repository it leaves.

## Design

The core decides, the server publishes, and the web UI draws. Which items exist, their step, the
steps' order, and their pull request's state are the core's, read from each branch's commits and
from `gh`; the server joins the human's names and colours, holds runs open while background tasks
live, and publishes what needs the human across every repository on the global endpoint; the web UI
maps steps to icons and labels, and keeps what is in flight on the client only until the server's
status arrives.

- Items and steps from commits, in [`crates/core/src/workspace/`](/crates/core/src/workspace/), and
  the pull requests' snapshot, fetched with `gh` and settled for 10 minutes, in
  [`crates/core/src/pulls.rs`](/crates/core/src/pulls.rs); names and colours in
  [`crates/core/src/repositories.rs`](/crates/core/src/repositories.rs).
- The server's refresh of pull requests,
  [`packages/server/src/pulls.ts`](/packages/server/src/pulls.ts); what needs the human,
  [`packages/server/src/fate/needs-you.ts`](/packages/server/src/fate/needs-you.ts); background
  tasks holding the turn, in [`packages/server/src/runner/`](/packages/server/src/runner/).
- The sidebar of cards, [`packages/web/src/sidebar/`](/packages/web/src/sidebar/): `Sidebar.tsx`,
  `ItemCard.tsx`, `cards.ts`, `SidebarHeading.tsx`, `DoneArea.tsx`, and the feature settings; the
  session's column,
  [`packages/web/src/layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx).
- Writes in flight, [`packages/web/src/writes/`](/packages/web/src/writes/): the store,
  `WriteButton`, and the progress bar; the notifier,
  [`packages/web/src/notify/`](/packages/web/src/notify/).

## Questions

### Round 01

#### Q1: Is this one feature, or several?

**Answer:** A: one feature, built in order: statuses first, then the sidebar, then the rest.

#### Q2: How does the sidebar show Uraeda's hierarchy?

**Answer:** A: "Needs you" at the top, then sections in the flow's order; drafts are part of the
priorities and get no section of their own.

#### Q2.A: How do drafts show?

**Answer:** B, and less: "don't even add that line, we go there from priorities".

#### Q3: Can an item move to its next state from the sidebar?

**Answer:** B: the sidebar shows the hierarchy only; moves stay on their pages.

#### Q4: How does a feature's step show on its row before implementation?

**Answer:** A: an icon per step, at the row's start, the running indicator at its end, each
feature's lines grouped in a card, and the agents at work ordered by step.

#### Q5: What does hiding a sidebar do?

**Answer:** B: the rail stays as the folded state, with the button moved to the top and a slide.

#### Q6: How do the last five done features show?

**Answer:** A: pinned at the sidebar's bottom after a separator, up to five as fit, with "…".

#### Q7: Where does the theme go until the settings page exists?

**Answer:** C: the theme follows the system until the settings page exists, with no switch.

#### Q8: Does a background command keep a run "Working"?

**Answer:** A: every background task holds the run, shown with a terminal icon: "a background
command is part of an agent run".

#### Q9: What does a button that writes to git show while it runs?

**Answer:** A: the clicked button spins at once with what it does; every other writing button is
blocked, with a thin bar at the top.

#### Q10: How do optimistic statuses work?

**Answer:** A: the card shows the action at once until the server's status arrives, never a guessed
status.

#### Q11: What sends a notification?

**Answer:** A: only what needs the human.

#### Q12: How does Uraeda ask for permission to notify?

**Answer:** A: a banner on the first visit says what will notify, and "Turn on" asks the browser.

#### Q13: Where do notifications reach you?

**Answer:** A: from an open tab, on desktop browsers, the tab's title counting what waits.

#### Q14: What do renaming and colouring a feature change?

**Answer:** A: a name and a colour kept by the server, by repository and item.

#### Q15: Do the addresses change?

**Answer:** A: today's addresses stay.

#### Notes

The human asked, in the chat that started the round, for a "…" on a card opening a small "feature
settings" dialog to rename it and pick its colour, and for optimistic statuses in the sidebar,
synced after a few seconds; and for the changed lines' count, "+1050 −250", on each card.

## Decisions

- [Notifications](../decisions/notifications.md): new; only what needs the human notifies, from an
  open tab, after "Turn on".
- [Agents](../decisions/agents.md): every background task holds its turn and its process.
- [Git](../decisions/git.md): an item's existence and step come from its branch's latest commit.
- [UI layout](../decisions/ui-layout.md): cards, the rail, and resizable columns.
- [UI behaviour](../decisions/ui-behaviour.md): git writes show at once and block the others; cards
  show the action in flight.
- [Repositories](../decisions/repositories.md): entries hold their items' names and colours; the
  global endpoint may span repositories.

## Changes after approval

- The spec's review: the Priorities count is Now's; the right column resizes; the fold and the
  column's buttons keep their spot in both states; the "…" is always drawn, muted, so a card keeps
  its size.
- R3, R8: a folder never committed is no item; tests of such folders moved to committed setups.
- R10: without `gh`, the step past the last task reads "Pull request state unknown".
- R12: the last pull requests are kept 10 minutes after `gh` fails.
- R16: the sidebar opens at 280 px, its fold button placed at one spot.
- R18: a write that fails resolves to `false`, which shows the card's status again.
- R19: a notification's tag is the item; a tab in front holds a shared lock.
- R21: the settings page, merged meanwhile, owns the theme again, and Settings is the sidebar's last
  row.
- The final review: "Start the change" waits for another page's write, and a write's end keeps a
  later write's bar.

## Follow-ups

- A card's action in flight is kept by folder alone: two repositories with a feature of the same
  folder share it, until the server's status or 10 seconds clear it.
- The notifier runs in a repository's pages: a page without one, like a missing folder, does not
  notify, and an item that comes to need the human while the tab switches repositories is not
  notified.
- A write in flight has no UI check in the browser nor screenshot, only its behaviour tests and its
  stories, `Writes/Feedback#Committing` and `Sidebar#Committing`.
- `packages/web/src/data.ts` is at its 500 lines: the next read extracts one first.
- The theme's `--size-session-aside` size is no longer used, the column's width being its own.
- Failing before this feature: the Storybook comments' "the Mockups button scrolls to an embed below
  another one in the fold" browser test, on `main` too, and the server's sessions tests' cleanup
  timing out after 10 seconds on a busy disk.
