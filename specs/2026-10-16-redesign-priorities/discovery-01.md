# Discovery, round 01: Redesign home, inbox, and priorities

## Summary

Products that help people organize work share a shape: one place to capture (an inbox reviewed every
few days, its count neutral and optional), one ordered list of what comes next (Now, Next, Later,
each a labelled group with a count), and a home that puts what needs the user first, then what is in
progress, then a way into everything else. Lists with a detail beside them move a highlighted row
with the arrow keys or j/k, open it with Enter, and leave with Escape. Decision logs list titles
with a status badge beside the document.

The [proposal](proposal.md) asks for a functional pass on the three pages that start every piece of
work: fewer clicks to edit a priority, drafted and running priorities set apart, child bullets
carried into a draft, "Add and commit" for a new priority, an inbox count that stays quiet, inbox
and priorities that look alike, arrow-key navigation, a home that reads like a dashboard, and a new
view of the constitution and decisions. It says the changes "should not have any impact on the
backend".

The code has the data for most of it: the workspace already matches each priority to its draft and
feature, and the inbox and priorities share one commit bar. Four items need the core: child bullets
into a draft, an inbox note's children and its order, a priority committed alone, and any reading of
the constitution and decisions, which nothing parses today. The sidebar the proposal adds to is
being redesigned by another feature, still in its first round.

## How other products do it

### Linear

- Inbox: J/K or the arrow keys move through notifications "whether you're on the list or viewing a
  single notification"; the sidebar shows unread notifications as a count or a dot, the user's
  choice ([Inbox](https://linear.app/docs/inbox),
  [changelog, 2024-12-18](https://linear.app/changelog/page/6)).
- Peek: Space opens a preview of the issue under the selection; with it open, ↑ and ↓ move to the
  next issues and the preview follows; Escape closes it. Seen only in a search snippet: the page
  returned 404 ([Peek](https://linear.app/docs/peek)).
- Triage, the inbox of a team, is processed one item at a time with single keys: 1 accepts, 2
  declines, H snoozes ([Triage](https://linear.app/docs/triage)).
- Project statuses have names and colours set by the team, and show as an icon next to the project
  ([Project status](https://linear.app/docs/project-status)). "My issues" opens on what is assigned
  to the user ([My issues](https://linear.app/docs/my-issues)).

### Todoist

- J or ↓ and K or ↑ move the focus, Enter opens the task view, Escape closes it; Q opens Quick Add
  ([keyboard shortcuts](https://todoist.com/help/articles/use-keyboard-shortcuts-in-todoist-Wyovn2)).
- Task counts in the sidebar are a setting, "Show the task count", on or off
  ([customize the sidebar](https://todoist.com/help/articles/customize-the-sidebar-in-todoist-S9JLTYqZV)).

### Things 3

- Everything to do "needs to end up in one place, and that place is the Inbox", reviewed daily as a
  habit ([Things guide](https://culturedcode.com/things/guide/)).
- Return opens the selected item, Cmd+Return saves and closes it
  ([keyboard shortcuts](https://culturedcode.com/things/support/articles/2785159/)). The app icon's
  badge counts what the user picks, or nothing
  ([badge count](https://culturedcode.com/things/support/articles/3340494/)).

### OmniFocus

- The Inbox's badge counts the items still available; badges are coloured only for urgency, yellow
  for due soon and red for overdue
  ([settings](https://support.omnigroup.com/documentation/omnifocus/universal/4.3.3/en/settings/)).

### Gmail and GitHub

- Gmail: j and k move to the next and previous conversation, o or Enter opens it, u goes back to the
  list; shortcuts are off until the user turns them on
  ([Gmail shortcuts](https://support.google.com/mail/answer/6594)).
- GitHub Projects: the arrow keys move between cells, Space opens the item, Enter edits a cell and
  Escape cancels; single-key shortcuts can be turned off while keeping the ones with modifiers
  ([GitHub shortcuts](https://docs.github.com/en/get-started/accessibility/keyboard-shortcuts)).

### Now, Next, Later roadmaps

- ProductPlan: Now is in progress with a firm time frame, Next is "90% confident you will do but
  haven't started yet", Later is parked; three titled columns of cards, which get more detailed as
  they move toward Now
  ([Feature-Less Roadmaps, p. 15](https://assets.productplan.com/content/Feature-Less-Roadmaps-by-ProductPlan.pdf)).
- Aha!: three renameable columns, and the roadmap "automatically updates when the work gets
  underway" ([Aha!](https://www.aha.io/blog/introducing-the-now-next-later-roadmap)).
- GitHub Projects: one column per status, a count in each header, and a colour per status option
  ([board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout),
  [single-select fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-single-select-fields)).

### Home dashboards

- GitHub's dashboard: recent activity that involves the user, capped at four updates, top
  repositories, then a feed; its new home adds agent sessions and recent pull requests
  ([personal dashboard](https://docs.github.com/en/account-and-profile/reference/personal-dashboard)).
- Jira's "For you": recommended spaces at the top, then tabs, the first being work due soon
  ([For you](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-for-you-page/)).
- Vercel's overview: one card per project, and the activity stream removed "to help you get to what
  matters faster"
  ([changelog](https://vercel.com/changelog/a-new-dashboard-overview-is-now-available)).
- Carbon: "place the most important at the top", in an F-shaped reading order, with few metrics
  ([dashboards](https://carbondesignsystem.com/data-visualization/dashboards/)).

### Decision logs and constitutions

- log4brains: a menu of decisions, newest first, each with a status label (ACCEPTED, SUPERSEDED),
  and a search bar, beside the document ([live site](https://thomvaill.github.io/log4brains/adr/),
  [README](https://github.com/thomvaill/log4brains)).
- Backstage's ADR plugin: a list with a status chip per decision, search across projects, and the
  markdown rendered as written
  ([plugin](https://github.com/backstage/community-plugins/tree/main/workspaces/adr/plugins/adr)).
- adr-tools: numbered files, one superseding another
  ([adr-tools](https://github.com/npryce/adr-tools), [adr.github.io](https://adr.github.io/)).
- Spec Kit's constitution: principles with MUST and SHOULD and their rationale, a semantic version,
  a ratification and a last-amended date, read by every later command
  ([constitution command](https://github.com/github/spec-kit/blob/main/templates/commands/constitution.md)).

### Committing at once or in a batch

- GitHub's web editor ends every edit with "Commit changes": one file, one commit, at once
  ([editing files](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)).
- github.dev and VS Code batch: a count of changed files on the source control icon, then one commit
  ([github.dev](https://docs.github.com/en/codespaces/the-githubdev-web-based-editor),
  [VS Code](https://code.visualstudio.com/docs/sourcecontrol/staging-commits)).
- Obsidian Git commits everything on a timer, trading the message for no friction
  ([Obsidian Git](https://github.com/Vinzent03/obsidian-git)).

### What they have in common

Capabilities users may expect, whether or not the proposal mentions them:

- **Keyboard**: arrows and j/k move a highlighted row, Enter opens or edits, Escape goes back, the
  detail follows the selection; single-key shortcuts can be turned off.
- **Capture**: one inbox, reviewed every day or few days; its count neutral, optional, or a dot;
  colour kept for urgency.
- **Ordered work**: labelled groups with counts; "in progress" shown as a property of the item, by
  an icon or a status, more than as a style of the group; colour per status.
- **Home**: what needs the user first, then what is in progress, capped, then the way into
  everything else; few metrics.
- **Decisions**: a list of titles with a status each, search, the document beside it, and the
  constitution's version and dates.
- **Committing**: one step for a single small edit; a pending count and one Commit for a batch.

## Standards and libraries

### WAI-ARIA Authoring Practices

- Keyboard interface: focus moves with roving `tabindex` or `aria-activedescendant`; focus and
  selection are separate states, and the focus indicator must look different from the selected
  state; selection following focus "can be devastating" when each move loads something slow;
  shortcuts "enhance, not replace, standard keyboard access"
  ([keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)).
- A listbox is not for rows that are links or buttons; a layout grid groups them as one tab stop,
  arrows moving between rows, Enter entering a row's own controls and Escape leaving them
  ([listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/),
  [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)).
- A judgement from the two: Uraeda's rows are links, so they stay links in a list, each reachable,
  and the arrows move the focus between them.

### Astryx 0.6.8

Read in the installed package, `packages/web/node_modules/@astryxdesign/core/src`.

- `List` and `ListItem`: `isSelected`, `href` covering the row, `startContent` and `endContent`; no
  arrow keys of their own (`List/List.doc.mjs`).
- `useListFocus`: arrow keys, Home and End, roving `tabindex`, `onEscape`, an `itemSelector`, and a
  caret guard that leaves arrows to text fields (`hooks/useListFocus.ts`). `useHotkeys` skips text
  fields unless told otherwise (`hooks/useHotkeys.ts`, lines 78–88). `useKeyboardHint` shows a
  one-time "↑↓ to navigate" hint.
- `Card`: for discrete items in a grid, "NOT the default layout tool", no nesting, and no colour for
  status: Badge or Banner say status (`Card/Card.doc.mjs`). `ClickableCard` is a card that leads
  somewhere. `Grid` takes responsive columns, `{minWidth, repeat}`.
- `Badge`: neutral, info, success, warning, error, and colours; its docs advise description text
  over badges for counts (`Badge/Badge.doc.mjs`). `SideNavItem`'s `endContent` is "passive
  right-side content only (badges, counts)".
- `StatusDot` (always with text), `Divider` with an optional label, `Section` for page regions,
  `ProgressBar`, `EmptyState`, `MetadataList`, `Kbd`, `Token`.
- Templates `incident-console` and `table-inbox` show a queue beside a resizable detail pane, and
  `dashboard` a grid of cards; none handles the keyboard.

### dnd-kit 0.5.0

- The priorities page already drags with `@dnd-kit/react`: a handle with a mouse, a 500 ms press on
  touch, and its keyboard sensor on the handle
  ([`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx), lines 220–325). The
  [UI components](/specs/decisions/ui-components.md) decision makes it the only drag library.

## The code

### Important reads

- [`Home.tsx`](/packages/web/src/Home.tsx), 244 lines: one column of `List` groups, in order:
  Waiting on you (a Banner "Nothing waits on you." when empty), Files to fix, Agents at work, Inbox
  ("N notes to organize"), the Now and Next lines not started, and every Done feature. No layout of
  its own beyond [`Page`](/packages/web/src/layout/Page.tsx); no stories. Tests in
  [`home.test.tsx`](/packages/web/src/__tests__/home.test.tsx) and
  [`inbox.test.tsx`](/packages/web/src/__tests__/inbox.test.tsx), lines 344–361.
- [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx), 419 lines, close to the 500-line
  limit: sections as headings "Now · 4", Now in a larger type, no colours; rows are `ListItem`s
  linking to `/priorities/<key>`, child bullets as grey description lines; a ⠿ drag handle; an "Add
  to <Section>" row per section; the shared [`CommitBar`](/packages/web/src/CommitBar.tsx) at the
  bottom. Its data, the `priorities` record, has no draft or feature field: links are flattened to
  text, so a drafted line looks like any other, and running features are not shown.
- [`TaskView.tsx`](/packages/web/src/TaskView.tsx), 303 lines, a `max-lines-per-function` marker at
  line 123: the pane of a priority. "Now · 2 of 4", the line as an
  [`EditableLine`](/packages/web/src/EditableLine.tsx) whose text is a button opening the field, a
  section picker, the draft drawn with its Edit and Start, or a Draft button, Delete with Undo, and
  ‹ Previous / Next ›. A task split is due before it grows.
- [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx), 110 lines, and
  [`NoteView.tsx`](/packages/web/src/NoteView.tsx), 231 lines: categories as `List`s under a
  heading, "No category" first; notes with their marks; no handles and no order; the same commit
  bar. A note's pane has an explicit Edit button, a category picker, and Organize: Move to
  priorities, Make a draft, Add to a draft, Delete. Only a note's first line shows: the core sends
  no children for notes.
- [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx) and
  [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx): the ＋ next to Priorities and Inbox in the
  sidebar opens a dialog, or a bottom sheet on the phone, with the text, a section picker set to
  Next, and Add. Adding writes the line uncommitted and shows "Added to Next, not committed" with
  Undo.
- [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx), 355 lines, and
  [`SessionNavRows.tsx`](/packages/web/src/SessionNavRows.tsx): Home, Priorities ＋, Inbox ＋, New
  change, Waiting on you, Agents at work, Chats, Done. No counts. `Item` already takes `actions`, a
  `tag`, and a `status`.
- [`layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx): the list and its detail side by side
  from 768 px, the detail a sticky column with its own scroll and a Close button. The detail is in
  the address, `/priorities/<key>` and `/inbox/<key>`.
- Keyboard: no list navigation anywhere. Astryx's `useHotkeys` is used once, for n and p in a round
  ([`RoundNav.tsx`](/packages/web/src/RoundNav.tsx), lines 244–271). The selected row is
  `ListItem`'s `isSelected`, set from the address.
- Constitution and decisions: no route, view, or data. A link to them opens `/raw/<path>`, the file
  as plain text ([`routes.tsx`](/packages/web/src/routes.tsx), lines 465–482). Workflow files are
  drawn by [`Blocks.tsx`](/packages/web/src/Blocks.tsx) from the core's document tree, through
  [`FilePage`](/packages/web/src/FilePage.tsx), for feature folders only.
- [`routes.tsx`](/packages/web/src/routes.tsx), 482 lines, and
  [`data.ts`](/packages/web/src/data.ts), 474 lines: both near the limit; a new route or data hook
  splits them first ([extract, don't grow](/skills/uraeda/references/code-quality.md)).
- Core: [`files/priorities.rs`](/crates/core/src/files/priorities.rs) parses Now, Next, Later, and
  Blocked, ignores other headings, and sends each entry's `nested` lines; `edit` replaces the
  entry's first line only. [`workspace.rs`](/crates/core/src/workspace.rs), lines 611–635, matches
  each priority to its `feature` and `draft` through
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs): `draft` is set from the link alone,
  under `specs/drafts/` only, without checking that the file exists, and never for `specs/backlog/`.
- Core: [`actions/draft.rs`](/crates/core/src/actions/draft.rs), line 98, builds a priority's draft
  with `proposal(&entry.text, &[])`: no children. A note's draft passes its lines (lines 131–179),
  and rebases its links.
- Core: [`actions/changes.rs`](/crates/core/src/actions/changes.rs): one change list for `INBOX.md`,
  `PRIORITIES.md`, and the drafts notes went into; `priorities.commit` and `changes.commit` both
  commit all of it. [`actions/inbox.rs`](/crates/core/src/actions/inbox.rs), lines 197–232, commits
  a note alone when `INBOX.md` was clean, for `ura note`; the binding does not expose it.
- Core: [`watch.rs`](/crates/core/src/watch.rs) hashes features, files, priorities, inbox, and the
  workspace, not decisions; the priorities' hash covers entry text, not children.

### The proposal's path and existing actions

- **Editing a priority's text, desktop**: a click on the row opens the pane, a click on the line's
  text opens the field, Enter saves, then Commit in the list's bar: four clicks. On the phone, the
  task is a page: about five taps, with Back to reach Commit.
- **Editing a note**: row, Edit, Enter, Commit: four as well.
- **Adding a priority from home**: Home has no add of its own. On the phone: open the
  navigation, ＋, type, Add, open the navigation again, Priorities, Commit: six taps, because the
  only Commit is the bar of the priorities and inbox pages, and the toast carries Undo only.
- **Drafting a priority**: Draft in the pane writes `specs/drafts/<slug>.md` with the line as title
  and What, links the line, and opens the editor. The line's children stay under it in
  `PRIORITIES.md`; the draft has none.
- **Starting a feature**: `ura start` moves the entry to the end of Now as a link to the future
  proposal, which is how entries match branches
  ([projects](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature)). A
  running entry is a Now entry whose feature has a branch and is not done. Today it shows on neither
  page; Home hides it.
- **Moving a running entry by dragging**: it moves the line only. The feature's branch and folder do
  not follow: postponing is its own action.
- **Discard on the commit bar**: restores the files from the last commit, and deletes a draft never
  committed only when its text is exactly what Draft wrote
  ([`changes/drafts.rs`](/crates/core/src/actions/changes/drafts.rs), lines 183–213). A draft that
  carries children must be recognized too.
- **Undo after Delete**: writes the entry's lines back, children included.
- **Live updates**: a change to `PRIORITIES.md` or `INBOX.md` pushes both records, and drags hold
  them until the drop ends.

### Overlaps with work in flight

- **Redesign sidebars and global interface**, on the branch `2026-10-16-redesign-interface`, round
  01 waiting on the human. It reorganises the sidebar in the flow's order with counts for Inbox and
  Priorities and a Drafts section (its Q2 and Q2.A), moves from the sidebar (Q3), the last five done
  features pinned at the bottom with "…" opening Home's Done group (Q6), a shared record of git
  writes in flight (Q9), and settles `[` and `]` as shortcuts for the two sidebars. Its discovery
  read the earlier draft of this proposal, which kept the constitution out of the sidebar. Both
  features change `SessionNav.tsx`, `Home.tsx`, and `data.ts`.
- **Settings page**, on the branch `2026-10-16-settings-page`, round 01 answered: the theme moves to
  the settings page, which opens from the sidebar's footer, at `/r/<name>/settings/<category>`. It
  touches `routes.tsx` too.
- **Drafts**: [redesign specs](/specs/drafts/redesign-specs.md) asks for decisions shown with
  "EXTREMELY HIGH priority" and their diff in a branch; [flow review](/specs/drafts/flow-review.md)
  owns the transitions between pages; [look and feel](/specs/drafts/look-and-feel.md) owns icons,
  the logo, and the visual style, and comes last.
- **Basic security** is merged on GitHub (pull request #22), and `origin/main` holds it with a start
  commit of this feature, `d3a6a6f`, different from this branch's `b8b226d`: the local `main` and
  `origin/main` have diverged since `3041e66`. Basic security changes `App.tsx` and `routes.tsx`.

### Rules and their owners

- **Which priority is running**: the core owns feature matching (`match_feature`,
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs)) and each feature's step. Grouping
  Running in the UI from `entry.feature` and the feature's `branch` and step would put a workflow
  rule in TypeScript, which the [stack](/specs/decisions/stack.md) decision forbids: the core should
  say it.
- **Which priority has a draft**: owned by the core (`linked_draft`), which misses backlog links and
  missing files.
- **The sections**: Now, Next, Later, Blocked, required by `ura check`
  ([`check/sections.rs`](/crates/core/src/check/sections.rs), lines 235–249). A "Running" section in
  the file would fail it: Running can only be a grouping on screen.
- **Commit messages**: the core's `describe()` and `message_of`
  ([`actions/priorities.rs`](/crates/core/src/actions/priorities.rs),
  [`actions/changes.rs`](/crates/core/src/actions/changes.rs)); the skill's
  [conventions](/skills/uraeda/references/conventions.md#commits) state them.
- **What a draft from a priority holds**: the core, and the skill's
  [projects](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature) ("the
  line as its title and as the first paragraph of What"). A change here changes the skill.
- **When the web UI commits a note**: the skill's
  [inbox](/skills/uraeda/references/inbox.md#capture) says a note added in the web UI "stays
  uncommitted until the commit bar's Commit".

### Likely changes

- [`Home.tsx`](/packages/web/src/Home.tsx): rewritten as the dashboard, split into one file per
  part; its Inbox group replaced by a small card. Under every option.
- [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx) and
  [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx): one shared list of rows with handles, section
  headings with counts and colours, the keyboard; split first, as the priorities page is near its
  limit.
- [`TaskView.tsx`](/packages/web/src/TaskView.tsx),
  [`NoteView.tsx`](/packages/web/src/NoteView.tsx),
  [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx): the field open on arrival; with option A
  of [editing children](#editing-an-entrys-children), a multi-line field.
- [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx) and
  [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx): "Add and commit".
- [`SessionNav.tsx`](/packages/web/src/SessionNav.tsx): the inbox's count and the decisions row,
  depending on [the sidebar's owner](#who-changes-the-sidebar).
- New: a decisions page, its route, and its data hook, after splitting `routes.tsx` and `data.ts`.
- Core: `EntryItem` gains its draft, backlog, and running state; `draft_entry` passes children;
  `InboxNote` gains `nested` and `nestedSpans`; a note can move to a place in its category; a
  priority can be added and committed alone; a reader of the constitution and decisions; watch flags
  for decisions and for children. Binding, fate views, and sources follow.
- Skill: [projects](/skills/uraeda/references/projects.md) and
  [inbox](/skills/uraeda/references/inbox.md), with the template and the example where they show
  drafting or capture.
- Stories: a `*.stories.tsx` per changed view, as the [preview](/specs/decisions/preview.md)
  decision asks.

## The proposal

### The backend is touched

The proposal's notes say the changes "should not have any impact on the backend". Four items need
the core: children carried into a draft ([`draft.rs`](/crates/core/src/actions/draft.rs), line 98),
inbox notes with children and an order like the priorities', a priority committed alone, and the
constitution and decisions view, which nothing reads today. A fifth is better there: the Running
grouping and the draft highlight, since the core owns feature matching. None changes a stored
format.

### Clicking opens the editor, and arrows move the selection

"Clicking a priority on desktop should open the edit view in the sidebar, with the editor open" puts
the focus in a text field. "Up/down should move the focus (if the cursor is not in a text box)" then
does nothing until the field is left. The [UI behaviour](/specs/decisions/ui-behaviour.md) decision
also forbids saving when the field loses the focus, so moving to another row with unsaved text must
keep it.

### Editing the text and an entry's children

An entry's text is its first line; its children are separate lines the API cannot edit
(`files/priorities.rs`, `edit`). The proposal does not say whether the editor covers them.

### The sidebar means two things

"Open the edit view in the sidebar" means the detail pane on the right; "a small, neutral badge in
the sidebar" and "In the sidebar it will be above the Done features" mean the left navigation. The
left one is being redesigned by another feature.

### Running is not a section of the file

"A clear separation between Running (has a feature and worktree), Now, Next, and Later" leaves out
Blocked, and Running cannot be a heading of `PRIORITIES.md`. A started feature with no worktree,
only a branch, is running too, by the workflow's definition.

### Children into What

The proposal's sentence ends at `in "What`: read as the draft's `## What` section, as the inbox's
drafts already do. It does not say whether the children leave the priority line.

### Same ordering handles in the inbox

The inbox has no order today beyond its categories, and the core cannot move a note to a place.

### Home's Done group

The redesign of the interface plans its sidebar's "…" to open Home's Done group: a home that drops
it breaks that plan.

## Approaches

Criteria come from the proposal ("the most standard paths should be the fastest", "coherent",
"obvious to use for newcomers"), the constitution (principle VI, one home per rule), and the
[UI behaviour](/specs/decisions/ui-behaviour.md), [UI layout](/specs/decisions/ui-layout.md),
[UI components](/specs/decisions/ui-components.md), and [stack](/specs/decisions/stack.md)
decisions.

### Backend changes

Whether the feature may change the core. See [the backend is touched](#the-backend-is-touched).

| Option                              | Proposal's items                         | Size                                |
| ----------------------------------- | ---------------------------------------- | ----------------------------------- |
| A. Small core changes, no format    | all                                      | core, binding, views, tests, skill  |
| B. UI only                          | children, inbox order, decisions dropped | smallest                            |
| C. UI only, decisions read as files | children and order dropped               | a second markdown reader, forbidden |

### Who changes the sidebar

Which feature adds the inbox count and the decisions row. See
[overlaps](#overlaps-with-work-in-flight).

| Option                                        | Conflicts                       | Waits                  |
| --------------------------------------------- | ------------------------------- | ---------------------- |
| A. This feature, two small additions          | a rebase on whichever is second | none                   |
| B. The interface feature                      | none                            | this view has no entry |
| C. This feature reorganises the whole sidebar | both features rewrite it        | the interface's round  |

### Home's layout

What the home shows and how it uses the width. See [home dashboards](#home-dashboards),
[Astryx](#astryx-068). Shown as live variants in the questions.

| Option     | Desktop                                    | Phone      | Reads as            |
| ---------- | ------------------------------------------ | ---------- | ------------------- |
| A. Hub     | counts, then two columns of cards          | one column | a control hub       |
| B. Flow    | columns in the flow's order                | stacked    | the workflow itself |
| C. Cockpit | dense panels, status lights, progress bars | one column | an instrument panel |
| D. Today's | one column of lists                        | the same   | a list              |

### Opening an entry

What a click on a row does, and where the focus goes. See
[clicking opens the editor](#clicking-opens-the-editor-and-arrows-move-the-selection).

| Option                                          | Edit path            | Arrows after a click |
| ----------------------------------------------- | -------------------- | -------------------- |
| A. Pane with the field open and focused         | one click, then type | after Escape         |
| B. Pane with the field open, focus on the row   | two clicks, or Enter | at once              |
| C. Pane as today, Enter or a double click edits | two                  | at once              |

### Editing an entry's children

See [editing the text](#editing-the-text-and-an-entrys-children).

| Option                                     | Children editable | Field                        |
| ------------------------------------------ | ----------------- | ---------------------------- |
| A. One multi-line field, line and children | yes               | multi-line, Ctrl+Enter saves |
| B. The first line only, as today           | no                | one line, Enter saves        |

### Keyboard navigation

Which keys move through a list with its pane. See [Linear](#linear), [Todoist](#todoist),
[WAI-ARIA](#wai-aria-authoring-practices).

| Option                                                | Detail follows | Conflicts                 |
| ----------------------------------------------------- | -------------- | ------------------------- |
| A. ↑/↓ and j/k move the row and the pane; Enter edits | yes            | none with `[` `]` `n` `p` |
| B. ↑/↓ move the focus only; Enter opens               | no             | none                      |
| C. A and Space to peek                                | on Space       | Space scrolls the page    |

### Running work in the priorities

How started entries stand apart. See
[running is not a section](#running-is-not-a-section-of-the-file),
[Now, Next, Later roadmaps](#now-next-later-roadmaps).

| Option                                                 | File       | Reads as             |
| ------------------------------------------------------ | ---------- | -------------------- |
| A. A Running group on top, read from the core, no drag | unchanged  | a separate group     |
| B. Kept in Now, marked and sorted first                | unchanged  | a status of the item |
| C. A `## Running` section in the file                  | new format | fails `ura check`    |

### Add and commit

How a new priority reaches a commit. See [committing](#committing-at-once-or-in-a-batch).

| Option                                             | Taps on the phone | Batching kept |
| -------------------------------------------------- | ----------------- | ------------- |
| A. "Add and commit" beside "Add", in both ＋ forms | four              | yes           |
| B. Every add commits                               | four              | no            |
| C. A Commit action in the toast                    | five              | yes           |

Option C breaks the UI behaviour decision: a toast carries Undo only.

### Ordering notes

See [same ordering handles](#same-ordering-handles-in-the-inbox).

| Option                               | Core            | Coherence with priorities |
| ------------------------------------ | --------------- | ------------------------- |
| A. Drag within and across categories | a move to place | full                      |
| B. Same rows and headings, no drag   | none            | the look only             |

### Children into a draft

See [children into What](#children-into-what).

| Option                                    | One home for the text | Undo by Discard |
| ----------------------------------------- | --------------------- | --------------- |
| A. Moved into What, removed from the line | yes                   | updated         |
| B. Copied, kept under the line too        | no                    | updated         |

### The decisions view

Where the constitution and decisions show, and what of them. See
[decision logs](#decision-logs-and-constitutions).

| Option                                                   | Desktop              | Scope          |
| -------------------------------------------------------- | -------------------- | -------------- |
| A. List, decision, and constitution in a foldable column | three regions        | default branch |
| B. Constitution on top, decision cards below             | one page, then pages | default branch |
| C. A or B, plus proposed decisions of every branch       | as chosen            | every branch   |

### Needs no choice

- **Inbox count's look**: neutral, a number of notes, as OmniFocus and Linear do; colour stays for
  urgency. Settled.
- **Search in decisions**: fifteen decisions fit a list; the browser's find works. Settled.
- **Single-key shortcuts turned off**: Gmail and GitHub allow it; Uraeda's keys act only when no
  text field has the focus, and a settings page will exist: deferred to it.
- **Detail following the selection is slow**: every row's data is already loaded; nothing loads per
  move.
- **Supersession between decisions**: Uraeda edits a decision in place and keeps its history in git;
  nothing to show.

## Not checked

- Linear's Peek page and workflow page returned 404: Peek's behaviour is from a search snippet.
- The GTD workflow map returned 404; how often GTD processes an inbox is from forum posts, unused.
- Material 3's card guidelines rendered empty; Polaris's card page was not followed.
- The colours of Things' and Todoist's sidebar counts are not documented on the pages read.
- How GitHub's, Linear's, and Jira's home pages adapt to a phone is not documented.
