---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign sidebars and global interface

> [!NOTE]
>
> Approved on 2026-10-16.
>
> - One new decision, [notifications](../decisions/notifications.md), and five changed:
>   [agents](../decisions/agents.md) (background commands hold a run), [git](../decisions/git.md)
>   (the workflow's state comes from commits), [UI layout](../decisions/ui-layout.md) (cards by
>   their name, the rail), [UI behaviour](../decisions/ui-behaviour.md) (git writes, actions shown
>   at once), and [repositories](../decisions/repositories.md) (names and colours in
>   `repositories.json`).
> - Your answers read one way among several: "order the agents at work by active step" sorts the
>   Changes and Features sections in the workflow's order, earliest step first; the "+1050 −250" of
>   your note shows on every card in flight, counting the lines outside the feature's own folder, as
>   the session's column already does; the rail is the left sidebar's folded state only, while the
>   right column still hides completely.
> - Your theme answer, the system's until the settings page, contradicts a point the settings page's
>   round settled, which keeps a switch in the sidebar: comment there too.
> - The mockups are the new sidebar's real components, committed with this spec, drawn from props
>   the server does not send yet.
> - Risk tier `medium`: a new field in `repositories.json`, and changes to how the core reads
>   branches and how a run ends. The plan does not wait for your review.
> - Cost: the server runs `gh` once per repository a minute, about 0.4 s each, while a branch is
>   past its last task, and `git diff` once per branch move for each card's line counts.

The shell every page sits in gets a functional pass, for the human following several features at
once: statuses that tell the truth, a sidebar that shows Uraeda's hierarchy and each item's step,
both sidebars folded and resized easily, a way home on the phone, notifications when the human is
needed, and clear feedback on every git write. See the [proposal](proposal.md),
[discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Statuses tell the truth (P1)

A feature or a change is in the sidebar only when it follows the workflow, its step comes from its
commits, its pull request is read from GitHub with its number, and its run is "Working" until every
background task of it has ended.

Why this priority: every other story shows these statuses; wrong ones make the sidebar and the
notifications lie.

Acceptance scenarios:

1. **Given** the branch `2026-10-20-sidebar-resize` with every plan step checked and no pull request
   on GitHub, **When** the sidebar shows it, **Then** its step reads "Final review", waiting on the
   agent, and it is under Features, not Needs you.
2. **Given** that branch with a draft pull request #31, **When** the sidebar shows it, **Then** its
   step reads "Finishing, draft pull request", waiting on the agent, and its card shows "#31".
3. **Given** that branch with pull request #31 open, out of draft, at
   `https://github.com/mrtolkien/uraeda/pull/31`, **When** the sidebar shows it, **Then** its card
   is under Needs you, its step reads "Pull request ready", and "#31" links to that address.
4. **Given** pull request #31 with changes requested, **When** the sidebar shows it, **Then** its
   step reads "Changes requested", waiting on the agent.
5. **Given** a machine without `gh`, **When** the sidebar shows a branch past its last task,
   **Then** its step reads "Pull request state unknown", it is under Features, and its session is
   not "Needs attention".
6. **Given** a branch `2026-10-16-not-a-flow`, checked out in `.worktrees/2026-10-16-not-a-flow`,
   without `specs/2026-10-16-not-a-flow/` in its latest commit, **When** the sidebar shows the
   repository, **Then** no card is named `not-a-flow`.
7. **Given** a folder `specs/2026-10-20-orphan/` on the main checkout's disk and no branch of that
   name, **When** the sidebar shows the repository, **Then** no card is named `orphan`.
8. **Given** a feature's worktree where the agent saved `clarifications-02.md` with
   `status: awaiting-human` without committing it, **When** the sidebar shows the feature, **Then**
   it stays under Features at its step, waiting on the agent; **When** the agent commits it,
   **Then** it moves to Needs you.
9. **Given** a run whose reply ended at 10:00 while a background command it started still runs,
   **When** the sidebar shows its feature at 10:05, **Then** the card reads "Working" with the
   terminal icon, and is not under Needs you; **When** the command ends at 10:20 and the agent's
   last reply ends at a gate, **Then** the card moves to Needs you.
10. **Given** a session whose turn ended at 10:00 with a background command still running, **When**
    it is 10:16, **Then** its process is still open.

### US2: The sidebar shows the hierarchy (P1)

The sidebar lists, from top to bottom: Home; Needs you; Inbox and Priorities with their counts;
Changes; Features; Chats; and the latest done items at the bottom. Each feature and change is one
card: its step's icon, its name, a background command's icon, and its status; under it, its task's
progress, its pull request, and the lines its branch changed; then its running sub-agents.

[The sidebar, unfolded](/packages/web/src/sidebar/Sidebar.stories.tsx#Unfolded)

Why this priority: the human asked for the hierarchy to be obvious, and for each feature's step
before its implementation
([Q2](clarifications-01.md#q2-how-does-the-sidebar-show-uraedas-hierarchy),
[Q4](clarifications-01.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).

Acceptance scenarios:

1. **Given** a repository with 4 notes in its inbox and 12 entries under Now in its priorities,
   **When** the sidebar shows it, **Then** it reads, in order: Home, Inbox with "4", Priorities with
   "12", Changes, Features, and Chats, and no Drafts row.
2. **Given** the feature `settings-page` waiting on the human's answers, **When** the sidebar shows
   it, **Then** its card is under Needs you only, with the questions icon at its start, and its
   accessible name reads "settings-page, Settings page, Questions to answer, Needs you".
3. **Given** the features `look-and-feel` at its discovery, `redesign-priorities` at its plan, and
   `redesign-interface` at its implementation, all waiting on the agent, **When** the sidebar shows
   them, **Then** the Features section lists them in that order.
4. **Given** `redesign-interface` at task 7 of 11, "Session column", with one running sub-agent,
   "Write the card's tests", and a branch that added 1050 lines and removed 250 outside its folder,
   **When** the sidebar shows it, **Then** its card reads "7/11 · Session column" and "+1050 −250"
   on its second line, and the sub-agent on its third.
5. **Given** the change `flaky-tests` under Needs you, **When** the sidebar shows it, **Then** its
   card carries a "Change" tag on its second line, and its accessible name says "change".
6. **Given** the search field holding "sidebar", **When** a feature is named "Sidebar" in its
   settings, **Then** its card matches, as it does by its slug or title.

### US3: Fold and resize both sidebars (P2)

On wide screens, the left sidebar folds to a rail of icons from a button at its top, shown under the
pointer, and resizes from its edge. The session's right column, "Progress", resizes from its edge
and hides from a button at its top. Both remember their width and state.

[The sidebar, under the pointer](/packages/web/src/sidebar/Sidebar.stories.tsx#UnderThePointer)

[The sidebar, folded](/packages/web/src/sidebar/Sidebar.stories.tsx#Folded)

[The right column, shown](/packages/web/src/layout/SideColumn.stories.tsx#Shown)

[The right column, hidden](/packages/web/src/layout/SideColumn.stories.tsx#Hidden)

Why this priority: the human asked for both sidebars to resize, and to fold without the chevron at
the bottom ([Q5](clarifications-01.md#q5-what-does-hiding-a-sidebar-do)).

Acceptance scenarios:

1. **Given** the unfolded sidebar on a 1440 × 900 window, **When** the pointer is over it, **Then**
   "Collapse sidebar" shows at its top; **When** the pointer leaves, **Then** it hides, and stays
   reachable with Tab.
2. **Given** the unfolded sidebar, **When** the human clicks "Collapse sidebar", **Then** it narrows
   to the rail over 200 ms, each card shown as its step's icon with its status, and "Expand sidebar"
   at its top.
3. **Given** the unfolded sidebar and no text field focused, **When** the human presses `[`,
   **Then** it folds; **When** they press `[` again, **Then** it unfolds.
4. **Given** the focus in the search field, **When** the human types `[`, **Then** the sidebar stays
   as it is, and the field holds "[".
5. **Given** the sidebar 240 px wide, **When** the human drags its edge to 400 px and reloads,
   **Then** it is 400 px wide; it never goes under 200 px or over 480 px, and dragging under 160 px
   folds it.
6. **Given** a feature's session on a wide screen, **When** the human drags the column's edge to 400
   px, **Then** it is 400 px wide, between 280 and 560 px, after a reload too.
7. **Given** the column shown, **When** the human clicks "Hide progress" at its top, **Then** it
   hides, and "Show progress" shows at the page's top right; **When** they press `]`, **Then** it
   shows again.
8. **Given** a system set to reduce motion, **When** the sidebar folds, **Then** it changes width at
   once, without the 200 ms ease.

### US4: Home in one tap on the phone (P2)

On narrow screens, the top bar starts with a home button, before the repository menu.

[The sidebar, unfolded](/packages/web/src/sidebar/Sidebar.stories.tsx#Unfolded) at a phone's width.

Why this priority: the phone has no other one-tap way home.

Acceptance scenarios:

1. **Given** a 402 × 874 window on a feature's page, **When** the human taps "Home" at the top bar's
   start, **Then** the repository's home opens.
2. **Given** that window on home, **When** the top bar shows, **Then** "Home" is marked as the
   current page.

### US5: Clear feedback on git writes (P2)

A button that writes to git says what it does at once, with a spinner; every other button that
writes is blocked until it ends, a thin bar runs at the top of the page, and the item's card says
the same.

[A commit in flight](/packages/web/src/writes/WriteFeedback.stories.tsx#Committing)

[A card while its answers commit](/packages/web/src/sidebar/Sidebar.stories.tsx#Committing)

Why this priority: commits take seconds, and the human asked for "EXTREMELY CLEAR" feedback and for
the sidebar to change at once
([Q9](clarifications-01.md#q9-what-does-a-button-that-writes-to-git-show-while-it-runs),
[Q10](clarifications-01.md#q10-how-do-optimistic-statuses-work)).

Acceptance scenarios:

1. **Given** an edited proposal with "Commit only" and "Commit and start the agent", **When** the
   human clicks "Commit and start the agent", **Then** before the server answers it reads
   "Committing…" with a spinner, "Commit only" is blocked and keeps the focus it may have, and a bar
   runs at the top of the page.
2. **Given** that commit running, **When** the human clicks a card in the sidebar, **Then** its page
   opens.
3. **Given** that commit running, **When** the human tabs to "Commit only" and presses Enter,
   **Then** nothing is sent, and its tooltip reads "Another change is being saved to git".
4. **Given** that commit done, **When** the page shows, **Then** every button is free again, and the
   bar is gone.
5. **Given** `settings-page` under Needs you, **When** the human clicks "Submit answers", **Then**
   its card reads "Committing…" at once, until the server's status for it changes or 10 seconds
   pass.
6. **Given** a commit the hook refuses, **When** the server answers, **Then** the button reads its
   label again, the error shows next to it, and the card shows the server's status.
7. **Given** a session's composer, **When** the human clicks "Start the agent", **Then** the
   feature's card reads "Starting the agent…" at once, until the server's status changes or 10
   seconds pass.

### US6: Notifications when the human is needed (P2)

On the first visit, a banner offers to notify the browser; "Turn on" asks the browser. Then, while
no Uraeda tab is in front, each item that comes to need the human notifies, and the tab's title
counts what waits.

[The banner, first visit](/packages/web/src/notify/NotificationBanner.stories.tsx#Ask)

[The banner, blocked](/packages/web/src/notify/NotificationBanner.stories.tsx#Blocked)

[The banner, unsupported](/packages/web/src/notify/NotificationBanner.stories.tsx#Unsupported)

Why this priority: the human asked to be pinged when input is needed
([Q11](clarifications-01.md#q11-what-sends-a-notification),
[Q12](clarifications-01.md#q12-how-does-uraeda-ask-for-permission-to-notify),
[Q13](clarifications-01.md#q13-where-do-notifications-reach-you)).

Acceptance scenarios:

1. **Given** a browser that never answered, **When** any page opens, **Then** the banner "Get
   notified when an agent needs you" shows above it, and the browser asks nothing.
2. **Given** the banner, **When** the human clicks "Turn on" and the browser's question is answered
   "Allow", **Then** a notification "Notifications are on" shows, and the banner goes.
3. **Given** the banner, **When** the human clicks "Not now", **Then** it goes, and does not come
   back after a reload.
4. **Given** "Turn on" answered "Block", **When** the browser answers, **Then** the banner reads
   "Notifications are blocked for Uraeda." with Dismiss.
5. **Given** notifications allowed and the Uraeda tab in the background, **When** `settings-page` of
   the repository `uraeda` comes to wait on the human's answers, **Then** a notification
   "settings-page needs you" reads "Questions to answer"; **When** the human clicks it, **Then** the
   tab comes to the front on `/r/uraeda/f/2026-10-16-settings-page/clarifications-01.md`.
6. **Given** the Uraeda tab in front, **When** an item comes to need the human, **Then** no
   notification shows.
7. **Given** two Uraeda tabs in the background, **When** an item comes to need the human, **Then**
   one notification shows.
8. **Given** two items needing the human across two repositories, **When** any page is open,
   **Then** its tab's title starts with "(2) ".
9. **Given** an item that needed the human when the page loaded, **When** the page opens, **Then**
   it does not notify.

### US7: The latest done items at the bottom (P3)

Up to the five latest done features and changes sit at the sidebar's bottom, after a divider, as
many as fit under the rows above; "…" opens Home's Done group.

[The sidebar, with few items](/packages/web/src/sidebar/Sidebar.stories.tsx#FewItems)

Why this priority: the history is one tap away on Home already
([Q6](clarifications-01.md#q6-how-do-the-last-five-done-features-show)).

Acceptance scenarios:

1. **Given** 7 done items and room for 4 rows under the sidebar's other rows, **When** the sidebar
   shows, **Then** the Done area lists the 4 latest, then "…".
2. **Given** the window grows until 6 rows would fit, **When** the sidebar shows, **Then** it lists
   the 5 latest, then "…".
3. **Given** the rows above leave no room for one row, **When** the sidebar shows, **Then** there is
   no Done area, heading included, and nothing above scrolls for it.
4. **Given** the Done area, **When** the human clicks "…", **Then** Home opens at its Done group.

### US8: Rename and colour a feature (P3)

A "…" on a card, shown under the pointer, opens "Feature settings": its name in the sidebar and its
colour, kept by the server for the repository.

[The sidebar, under the pointer](/packages/web/src/sidebar/Sidebar.stories.tsx#UnderThePointer)

[Feature settings, by its slug](/packages/web/src/sidebar/FeatureSettings.stories.tsx#BySlug)

[Feature settings, named](/packages/web/src/sidebar/FeatureSettings.stories.tsx#Named)

Why this priority: the human asked for it in the chat that started round 01
([Q14](clarifications-01.md#q14-what-do-renaming-and-colouring-a-feature-change)).

Acceptance scenarios:

1. **Given** the card `redesign-interface`, **When** the human saves the name "Sidebar" and the
   colour Purple, **Then** the card reads "Sidebar" with a purple stripe at its start, on every
   device, and its accessible name starts "Sidebar, Redesign sidebars and global interface".
2. **Given** the card named "Sidebar", **When** the human empties the name and saves, **Then** it
   reads `redesign-interface` again.
3. **Given** the settings open with nothing changed, **When** they show, **Then** Save is disabled;
   **When** the human types, **Then** "Unsaved changes" shows next to Save.
4. **Given** a 41st character typed in the name, **When** the field shows, **Then** it holds the
   first 40.
5. **Given** the feature `redesign-interface` renamed, **When** its pages, branch, and commits show,
   **Then** they keep its slug.
6. **Given** a phone, **When** the sidebar's drawer shows a card, **Then** its "…" shows without a
   pointer.

### US9: Smaller fixes of the shell (P3)

The theme follows the system until the settings page, and Enter picks the only suggestion when
adding a repository.

Why this priority: the proposal's small items.

Acceptance scenarios:

1. **Given** a browser that chose "Dark" in the old switch, **When** the app opens on a system set
   to light, **Then** it is light, and the sidebar has no theme switch.
2. **Given** the Add a repository dialog with "~/Dev/ura" typed and one suggestion,
   `~/Development/uraeda`, **When** the human presses Enter, **Then** the field holds
   `~/Development/uraeda`; **When** they press Enter again, **Then** it is added.
3. **Given** several suggestions, **When** the human presses Down then Enter, **Then** the field
   holds the first one.
4. **Given** the repository menu's filter leaving one repository, **When** the human presses Enter,
   **Then** that repository opens.

## Edge cases

- **A branch on `origin` only**, with its folder: a card, read from its latest commit, as today.
- **A worktree on a detached commit**: its branch is read from the branch's latest commit.
- **A feature merged with newer commits on its branch**: done, as today.
- **`gh` failing for a moment** (network, rate limit): the last known pull requests stay; with none
  known, "Pull request state unknown".
- **`gh` not signed in**: the same as without `gh`.
- **A pull request merged**: `gh` no longer lists it as open, and the card reads its step from its
  commits until the default branch, local or on `origin`, has its record; it is then done.
- **A background command that never ends**, like a server: "Working" until Claude Code stops it, 2
  hours at most; the run's 30-minute watchdog does not count time while a background task runs.
- **An ambient task**, which Claude Code marks as not part of the run: it holds nothing.
- **Two pending actions on one card**: the latest one shows.
- **A server status that arrives before the click's pending action**: the pending action is not
  shown, since the status already changed.
- **A git write started from another browser**: nothing is blocked here; the server still runs one
  write at a time.
- **A notification click when the item no longer needs the human**: the item's page opens as it is.
- **Several reasons at once on one item**: one notification, for the first of: refused action,
  failed or stopped run, step waiting, pull request ready.
- **The browser without Web Locks**: each tab notifies, and the notifications' `tag` folds them into
  one where the browser supports it.
- **A name of spaces only**: saved as empty, the slug shows.
- **A colour on a done item**: kept, but its Done row shows its name only.
- **A renamed item removed from the repository list**: its names and colours go with its entry.
- **The sidebar folded on a narrow window**: the phone always shows the unfolded drawer.
- **Search while folded**: the search is hidden in the rail, as today.
- **A done item opened from the Done area**: it is selected there, as today's rows.
- **A short window with a long Needs you group**: the sidebar's list scrolls, and the Done area is
  gone.

## Success criteria

- **SC-001**: `ura status` on this repository takes under 50 ms, as today's 25 ms; the server runs
  `gh` at most once per repository per minute, plus once after each branch move, for a branch past
  its last task.
- **SC-002**: A card shows the action in flight in the same render as the click that started it.
- **SC-003**: No session reads "Needs you" or "Needs attention" while a background task of its run
  is live.
- **SC-004**: With the tab hidden, an item coming to need the human shows its notification within 1
  second of the server's update reaching the page.
- **SC-005**: Every new state passes the UI checks at 402 × 874 and 1440 × 900, in light and dark:
  no text cut, no sideways scroll, axe's WCAG 2.1 A and AA rules.

## Architecture

The core decides, the server publishes, and the web UI draws. Which items exist, their step, the
order of the steps, and their pull request's state are the core's, read from each branch's commits,
as the changed [git](../decisions/git.md) decision says. When a run is over is the server's runner,
under the changed [agents](../decisions/agents.md) decision. The web UI only maps steps to icons and
labels, as it does today, and never guesses a status, as the changed
[UI behaviour](../decisions/ui-behaviour.md) decision says. See the
[discovery](discovery-01.md#approaches).

- **Main units**:
  - In the core: the workspace read, which counts a branch only with its folder or record and reads
    its step from its latest commit; a pull requests snapshot, read from `gh` once per repository;
    the step's position in the workflow; and the names and colours in `repositories.json`.
  - In the server: the pull requests' refresh; the runner's background tasks, which hold a turn and
    the process; a "needs you" view on the global endpoint; and a mutation saving a feature's name
    and colour.
  - In the web UI: the sidebar's sections and cards (`sidebar/`), the right column
    (`layout/SideColumn.tsx`), the record of git writes in flight and the actions shown on cards
    (`writes/`), and the notifier with its banner (`notify/`).
- **Where the rules live**: what is an item, its step, the step's order, and the pull request's
  state in the core; what holds a turn in the runner; what needs the human in the server's statuses,
  `status.ts`, which both the sidebar and the notifier read; which writes are in flight in one store
  of the web UI; how much of the Done area fits in the sidebar's component.
- **Targeted improvements**: `SessionNav.tsx` (355 lines) splits into the sidebar's sections;
  `SessionAside.tsx` (405 lines) moves its column into `SideColumn`; `data.ts` (474 lines) gets no
  new hook: the new reads live next to their components.
- **Tradeoffs**: reading steps from commits means a file saved but not committed does not move the
  sidebar; `gh` costs about 0.4 s per call, so its answer is remembered for a minute; names and
  colours live outside git, so another clone shows slugs; notifications reach desktop browsers only.

## Mockups

The mockups are the new components themselves, drawn from props: the server does not send their
fields yet. Their stories move to the fixture repository once it does.

- [The sidebar, unfolded](/packages/web/src/sidebar/Sidebar.stories.tsx#Unfolded): Needs you with a
  feature at its questions and a change with its pull request ready, Inbox and Priorities with their
  counts, a change working with a background command, four features in the workflow's order, one
  named "Sidebar" in purple at task 7 of 11 with "+1050 −250", and Chats; no room is left for the
  Done area. At a phone's width, the top bar with Home first.
- [The sidebar, under the pointer](/packages/web/src/sidebar/Sidebar.stories.tsx#UnderThePointer):
  "Collapse sidebar" at its top, and the "…" of the card under the pointer.
- [The sidebar, folded](/packages/web/src/sidebar/Sidebar.stories.tsx#Folded): the rail, each card
  as its step's icon with its status, "Expand sidebar" at its top.
- [The sidebar, with few items](/packages/web/src/sidebar/Sidebar.stories.tsx#FewItems): the Done
  area with as many of the latest done items as fit, and "…".
- [A card while its answers commit](/packages/web/src/sidebar/Sidebar.stories.tsx#Committing):
  `settings-page` reading "Committing…" with a spinner.
- [Feature settings, by its slug](/packages/web/src/sidebar/FeatureSettings.stories.tsx#BySlug) and
  [named](/packages/web/src/sidebar/FeatureSettings.stories.tsx#Named): the dialog, a bottom sheet
  on the phone, with its name field and its colours.
- [The banner, first visit](/packages/web/src/notify/NotificationBanner.stories.tsx#Ask),
  [blocked](/packages/web/src/notify/NotificationBanner.stories.tsx#Blocked), and
  [unsupported](/packages/web/src/notify/NotificationBanner.stories.tsx#Unsupported).
- [Before a commit](/packages/web/src/writes/WriteFeedback.stories.tsx#Ready) and
  [a commit in flight](/packages/web/src/writes/WriteFeedback.stories.tsx#Committing): "Committing…"
  with a spinner, "Commit only" blocked, and the bar at the top.
- [The right column, shown](/packages/web/src/layout/SideColumn.stories.tsx#Shown) and
  [hidden](/packages/web/src/layout/SideColumn.stories.tsx#Hidden): its hide button and resize
  handle, then "Show progress" at the page's top right.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- A branch counts as a feature or a change only with its folder or record in its latest commit,
  worktree or not, and a dated folder on disk without a branch counts as nothing.
- Each item's step is read from its commits; uncommitted files only mark it "uncommitted changes".
- The core asks `gh` for the pull requests of branches past their last task, on each branch move and
  every minute, and the card reads "Final review", "Finishing, draft pull request", "Pull request
  ready" with its number, "Changes requested", or "Pull request state unknown".
- A process with background work is never closed by the 15-minute idle timer.
- The right column resizes, 280 to 560 px, its width and state kept in the browser. With the left
  sidebar folding to a rail (Q5's B), the right column still hides completely: a rail of the session
  column's sections would carry nothing to read.
- `[` folds or unfolds the left sidebar and `]` hides or shows the right column, never while a text
  field has the focus.
- The fold takes 200 ms, off under reduced motion. With the rail kept, the sidebar's width eases,
  where the hidden sidebar would have slid.
- The phone's top bar starts with Home, before the repository menu, marked current on home.
- Adding a repository: the suggestions become a list the keyboard drives, Enter fills the single
  suggestion, the next Enter adds; the menu's filter opens a single repository on Enter.
- Notifications show only while no Uraeda tab is in front, one per item, from one tab, for every
  repository; a click opens the item.
- The "…" and the fold button show under the pointer, and always with the keyboard's focus and on
  touch.
- Step icons are Lucide outlines registered through the theme; the look and feel pass refines them.
- The proposal's link to the look and feel pass stays as written.

Settled while writing this spec:

- The plan builds the feature in the order of the answers: statuses first, then the sidebar, then
  notifications and the feedback on writes
  ([Q1](clarifications-01.md#q1-is-this-one-feature-or-several)).
- The sidebar shows the hierarchy only: moving an item to its next state stays on its page, until
  the flow review
  ([Q3](clarifications-01.md#q3-can-an-item-move-to-its-next-state-from-the-sidebar)).
- Addresses stay as they are; Home's Done group gets the anchor `#done`, which the Done area's "…"
  opens ([Q15](clarifications-01.md#q15-do-the-addresses-change)).
- Drafts get no row: "a draft is a state of a priority"
  ([Q2.A](clarifications-01.md#q2a-how-do-drafts-show)).
- "Order the agents at work by active step" sorts the Changes and Features sections by the step's
  position in the workflow, earliest first, then by newest folder; Needs you sorts by status first,
  as today
  ([Q4](clarifications-01.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).
- The "+1050 −250" of the notes shows on every card in flight whose branch changed lines outside its
  own folder, from the same count as the session's "Changed on the branch"; a done card shows none.
- A change under Needs you carries a "Change" tag on its card's second line; in the Changes section,
  the section says it.
- The progress line is no longer a link of its own: the card's first line opens the item, and is
  selected on its page and its session.
- The Inbox count is its notes; the Priorities count is the entries under Now.
- "New change" is the first row of the Changes section; Chats stay as today, with New chat and
  Archived.
- The Claude allowance bar moves to the end of the Features section.
- Search hides Home, Inbox, Priorities, and New change, and matches cards by name, slug, or title.
- The "…" opens Feature settings directly, with no menu; changes get it too, and done rows show
  their name.
- The Done area shows done items' names; it measures the room under the rows above as the window and
  the rows change, and never makes them scroll.
- The theme switch goes, and the theme follows the system; a choice the old switch stored stays in
  the browser, unread, for the settings page to read back. The settings page's round settled the
  opposite, and needs your note there.
- "Turn on" shows a first notification, "Notifications are on", which also tells a browser that
  cannot show them, like Chrome on Android, apart: "This browser cannot show Uraeda's
  notifications."
- The tab's title counts every repository's items that need the human, as the notifications do.
- The actions shown on a card are: "Committing…" for every commit concerning the item (answers,
  verdicts, edits, a retried commit), "Starting the agent…" for "Start the agent", and "Stopping…"
  for Stop.
- A git write is any write that commits, starts a feature or a change, or changes a branch. Saving a
  field without committing, adding a note or a priority, and sending a chat message are not: they
  keep their own feedback.
- `repositories.json` keeps `"version": 1`; the names and colours are an optional field of each
  entry.
- The runner's 30-minute watchdog pauses while a background task is live.
- The mockups feed the new components with props, since the server sends none of their new fields
  yet; the [preview](../decisions/preview.md) decision's "no faked responses" holds, since no server
  response is faked.

## Decisions

New, applied when this spec is approved:

- [Notifications](../decisions/notifications.md): only what needs the human notifies, from an open
  tab in the background, after a banner's "Turn on", with the tab's title counting what waits; no
  Web Push yet.

Changed, applied when this spec is approved:

- [Agents](../decisions/agents.md): every background task of a run, background commands included,
  holds its turn, and the process stays open while one runs
  ([proposed change](../decisions/agents.md)).
- [Git](../decisions/git.md): a feature's or a change's existence and step are read from its
  branch's latest commit, with its folder or record required
  ([proposed change](../decisions/git.md)).
- [UI layout](../decisions/ui-layout.md): each item is a card by its name or slug, its step at the
  start, its status at the end; the sidebar folds to a rail from its top; a column resizes
  ([proposed change](../decisions/ui-layout.md)).
- [UI behaviour](../decisions/ui-behaviour.md): a git write shows at once and blocks the other
  writing buttons; a card shows the action in flight and never a guessed status; hover controls show
  with the focus and on touch ([proposed change](../decisions/ui-behaviour.md)).
- [Repositories](../decisions/repositories.md): each entry holds its items' names and colours, and
  the global endpoint may span repositories ([proposed change](../decisions/repositories.md)).

Relied on:

- [Stack](../decisions/stack.md): steps, their order, and pull request states stay in the core; the
  web UI maps them to icons and labels only.
- [UI components](../decisions/ui-components.md): `SideNav`, `ResizeHandle`, `LayoutPanel`,
  `RadioList`, `Banner`, `ProgressBar`, and `Spinner` from Astryx; no raw elements.
- [UI checks](../decisions/ui-checks.md): browser checks at both sizes, and screenshots before hand
  over.
- [Preview](../decisions/preview.md): the mockups are stories of the real components.
- [Code quality](../decisions/code-quality.md): `SessionNav.tsx` and `SessionAside.tsx` are split
  rather than grown; `routes.tsx` is untouched.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                                                                  |
| ------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Humans stay in control                  | yes      | Five decision changes and one new decision, applied only on approval                                                                                   |
| II. Git and plain text first               | yes      | Workflow state is read from commits; names and colours are the UI's data, in the plain-text `repositories.json`, and no workflow rule reads them       |
| III. Asynchronous by default               | yes      | Every status comes from the repository and the runner's cache; notifications only point to it                                                          |
| IV. Review effort matches impact           | yes      | Notifications and the sidebar's queue show what needs the human, and nothing else                                                                      |
| V. Tools are optional                      | yes      | No workflow file changes; `ura status` reads steps the same way the UI does; a name is never needed to follow the workflow                             |
| VI. Code is checked and stays maintainable | yes      | Every story's scenarios are tested; the step's order and the "needs you" rule each live in one place; two files over budget are split before they grow |

## Risk tier

**Medium**: a new optional field in `repositories.json`, and changes to how the core reads branches
and how the runner ends a turn, with no change to workflow files.

## Details

### Data

**Core**:

- `PullRequest` gains its number and address:
  `PullRequestView { number: u32, url: String, state: "draft" | "open" | "changes-requested" }`. A
  snapshot, `PullRequests`, maps each branch name to its open pull request, from one
  `gh pr list --state open --json headRefName,number,url,isDraft,reviewDecision --limit 200` in the
  repository; `Unavailable` when `gh` is missing, signed out, or fails.
- `Workspace::read(repo, &PullRequests)` computes each step with its branch's pull request;
  `ura status` and `ura next` fetch the snapshot once. With `Unavailable`, a branch past its last
  task gets the new step `pull-request-unknown`, waiting on the agent.
- `FeatureView.pullRequest` becomes `PullRequestView | null`: the snapshot's while open, the
  record's once finished (`state: "open"`, its number read from its address).
- `StepView.order: u32`: the step's position in the workflow's table, from `discovery` to
  `pull-request`, for a feature or a change.
- An item exists when its branch's latest commit holds `specs/<folder>/`, `specs/changes/<folder>/`,
  or its record; its files, step, and `uncommitted` flag are read as today, its step from the
  commit.
- `repositories.json` entries gain an optional
  `"items": { "<folder>": { "label": "Sidebar", "color": "purple" } }`; a name of at most 40
  characters, trimmed, empty removing it; `color` one of `red`, `orange`, `yellow`, `green`, `teal`,
  `blue`, `purple`, `pink`, or absent. `FeatureView` gains `label: string | null` and
  `color: Color | null`, read with the list.

**Server**:

- The pull requests' snapshot is kept per repository, refreshed after each branch move the watcher
  reports and every 60 seconds while a branch is past its last task, and passed to every workspace
  read.
- `background_tasks_changed` keeps every task that is not `ambient`; each is a sub-agent (its
  `local_agent` and `local_workflow` tasks) or a background command (every other type). The session
  record gains `backgroundCommands: number`, the live commands of its running turn.
- The turn stays running while any kept task is live; the idle timer and the 30-minute watchdog do
  not run while one is.
- A global view, `NeedsYou`, on `/fate`:
  `rows: Array<{ key: string; repository: string; folder: string; label: string; reason: "blocked" | "attention" | "step" | "pull-request"; message: string; href: string }>`,
  from each session's status and each step waiting on the human, the pull request ready as its own
  reason. `key` joins the repository, the folder, the reason, and the step or turn, so a new reason
  or a new gate notifies again. It is live, as the repositories' list is.
- A mutation `item.settings(folder, label, color)` writes the entry through the core, and publishes
  the workspace and the feature.

**Web UI**:

- The record of writes: a store of the writes in flight, by ID, with the button's label, the item's
  folder when it has one, and when it started; every writing button reads and joins it.
- The actions shown on cards: by folder, `{ label: "Committing…", since, status }`, `status` being
  the server's status when the action started; cleared when the server's status for the folder
  differs from it, after 10 seconds, or when the write fails.
- Browser storage: `astryx-resizable:uraeda.nav` (the sidebar, as today),
  `astryx-resizable:uraeda.column` (the right column's width), `uraeda.sessionAside` (shown or
  hidden, as today), `uraeda.notifications` (`"dismissed"` after "Not now" or Dismiss). The old
  `uraeda.theme` is left as it is, unread.

### Components

- **Workspace read** (`crates/core/src/workspace.rs`): every branch from its latest commit, with its
  folder or record required; `ReadFrom::Disk` stays for the files a page shows and the uncommitted
  flag.
- **Pull requests** (`crates/core/src/pulls.rs`, new): runs `gh` through the core's git module's
  process helper, parses its JSON, and returns the snapshot; used by the server and the CLI.
- **Steps** ([`steps.rs`](/crates/core/src/steps.rs)): `pull-request-unknown`, and the order.
- **Repository list** ([`repositories.rs`](/crates/core/src/repositories.rs)): reads and writes each
  entry's `items`.
- **Pull requests' refresh** (`packages/server/src/pulls.ts`, new): the snapshot per repository, its
  timer, and the watcher's branch moves.
- **Runner** ([`claude-events.ts`](/packages/server/src/runner/claude-events.ts),
  [`transcript.ts`](/packages/server/src/runner/transcript.ts),
  [`turns.ts`](/packages/server/src/runner/turns.ts)): the kept tasks, `backgroundCommands`, and the
  timers' pause. [`status.ts`](/packages/server/src/runner/status.ts): `pull-request-unknown` is not
  "halted".
- **Needs you** (`packages/server/src/fate/needs-you.ts`, new): the global view, built from the
  statuses each repository already computes. Its messages: "Questions to answer", "The spec to
  review", "The plan to review", "The proposal to write", "The agent was refused an action", "The
  run failed", "The run stopped before a gate", and "Pull request #31 is ready for review".
- **Sidebar** (`packages/web/src/sidebar/`): `Sidebar.tsx`, the sections and their order, replacing
  `SessionNav.tsx` and `AgentsAtWork.tsx`; `ItemCard.tsx`, a card, its accessible name, its "…";
  `StepIcon.tsx`, a step's icon from the step's name and the file its gate waits on; `DoneArea.tsx`,
  the measured Done area; `SidebarHeading.tsx`, the repository menu, the fold button, and the
  phone's Home; `FeatureSettings.tsx`, the dialog's form, in the app's `Overlay`. Its texts: "Needs
  you", "Inbox", "Priorities", "Changes", "New change", "Features", "Chats", "Done", "…", "Collapse
  sidebar", "Expand sidebar", "Home", "Settings of <name>", "Feature settings", "Name in the
  sidebar", "Leave it empty to show its slug, <slug>.", "Colour", "None", "Unsaved changes", "Save",
  "Cancel".
- **Step labels** ([`labels.ts`](/packages/web/src/labels.ts)): "Finishing, draft pull request" for
  `finish`, "Pull request ready" for `pull-request`, "Changes requested" for `pull-request-changes`,
  "Pull request state unknown" for `pull-request-unknown`.
- **Shell** ([`Shell.tsx`](/packages/web/src/Shell.tsx)): the new sidebar, no footer switch,
  `collapsible={{ hasButton: false }}`, `resizable` from 200 to 480 px, the `[` shortcut, the write
  bar, and the notification banner above the page.
- **Right column** (`packages/web/src/layout/SideColumn.tsx`): the resizable column, its hide and
  show buttons, and the `]` shortcut; `SessionAside.tsx` draws its sections inside it, and "Hide
  progress" leaves the session's header.
- **Writes** (`packages/web/src/writes/`): the store, `WriteButton` (every button that writes to
  git, replacing their `clickAction` buttons, `CommitActions.tsx` included), `WriteProgress`, and
  `usePendingAction(folder)` for the cards. Its texts: "Committing…", "Starting the agent…",
  "Stopping…", "Saving to git", "Another change is being saved to git".
- **Notifier** (`packages/web/src/notify/`): `NotificationBanner.tsx`; `useNotifier`, which reads
  `NeedsYou` on the global client, keeps the keys seen since the page loaded, holds a Web Lock,
  `uraeda.notify`, to be the one tab that notifies, shows a `Notification` with `tag: key` while
  `document.visibilityState` is `hidden` in every tab, and prefixes the title. Its texts: "Get
  notified when an agent needs you", "Uraeda tells this browser when questions, a review, a pull
  request, or a blocked agent wait on you, while its tab is in the background.", "Turn on", "Not
  now", "Notifications are on", "Notifications are blocked for Uraeda.", "Allow notifications for
  this site in the browser's site settings to turn them on.", "This browser cannot show Uraeda's
  notifications.", "The tab's title still counts what waits on you.", "Dismiss", and "<name> needs
  you".
- **Add a repository** ([`AddRepository.tsx`](/packages/web/src/AddRepository.tsx),
  [`RepositoryMenu.tsx`](/packages/web/src/RepositoryMenu.tsx)): the suggestions as a list the
  arrows move through, Enter filling the active or single one; the filter's Enter on a single row.
- **Theme** ([`theme.tsx`](/packages/web/src/theme.tsx)): the system's mode only.

### Error handling

- `gh` missing, signed out, failing, or rate limited: the snapshot is `Unavailable`, or the last
  good one is kept for up to 10 minutes; the server logs the first failure of a run of failures
  only.
- A name or colour that fails to save: the dialog stays open, its error under the field, "Could not
  save the settings: <reason>".
- `repositories.json` written meanwhile by the CLI: the last write wins, as the repositories
  decision accepts.
- A git write that fails: its button reads its label again, the error shows next to it as today, the
  other buttons are free, and the card's action is cleared.
- The browser's question answered "Block", or the permission already denied: the banner's blocked
  state.
- `new Notification` throwing: the banner's unsupported state, after "Turn on"; later, silently
  skipped.
- The `NeedsYou` view failing to load: no notification and no title count, without an error on the
  page; it is read again with the page.
- A Done area measurement before the rows draw: no Done area until the next measure.

### Testing

The core's tests build repositories with `uraeda-binding/test-utils` and a fake `gh` on the `PATH`,
as `next.rs` does; the server's tests drive the fake adapter with recorded Claude Code events,
`background_tasks_changed` and `local_bash` lines added to `fixtures/claude/`; the web UI's tests
render the app over the fixture repository's server, in happy-dom with a fake clock for the 10
seconds, and in WebKit for the sidebar's widths, the fold, the resize, and the UI checks, with a
fake `Notification`, `navigator.locks`, and `visibilityState`.

| What                                               | Test                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| US1.1 to US1.5, pull request edge cases            | Core table-driven test of steps by pull request state, and a workspace test with a fake `gh` |
| US1.6, US1.7, US1.8, branch edge cases             | Core workspace tests                                                                         |
| US1.9, US1.10, the watchdog, ambient tasks, SC-003 | Server runner tests on recorded events                                                       |
| US2.1 to US2.6                                     | Web integration tests of the sidebar over the fixture                                        |
| US3.1 to US3.8                                     | Browser tests at 1440 × 900                                                                  |
| US4.1, US4.2                                       | Browser tests at 402 × 874                                                                   |
| US5.1 to US5.7, write edge cases, SC-002           | Web integration tests with a server held mid-write                                           |
| US6.1 to US6.9, notification edge cases, SC-004    | Web integration tests with a fake `Notification`, locks, and visibility                      |
| US7.1 to US7.4                                     | Browser tests at three window heights                                                        |
| US8.1 to US8.6, name and colour edge cases         | Web integration tests, and a core test of `repositories.json`'s `items`                      |
| US9.1 to US9.4                                     | Web integration tests                                                                        |
| SC-001                                             | The `ura status` timing in the CLI's tests' benchmark, and a server test counting `gh` calls |
| SC-005                                             | The UI checks of `vp run ready`, with the new states added to their pages                    |
