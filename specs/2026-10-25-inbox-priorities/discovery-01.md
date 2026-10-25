# Discovery, round 01: Inbox and priorities in the terminal look

## Summary

The feature redraws two pages that already work: the inbox, a freeform list of notes under
categories, and the priorities, an ordered list in four sections. Both share one list component
(`WorkList`), drag handles, a detail pane that follows the selection, and `j k` keys. The proposal
asks for three things on top of a redraw: two views that look different on purpose, a one-line
context for each priorities column written in `PRIORITIES.md`, and vim-like keys with a shortcut
map.

Established products agree on the interaction: arrow keys or `j k` move between cards, and moving a
card is a distinct mode or distinct keys (GitHub Projects and Trello). None of them offers vim's
`o O i a dd`. Todoist has `a` and `Shift+A` to add below and above. The inbox's own format is
already the hard part of the work: the core has no operation to create, delete, or rename a
category, and no way to read the text under a priorities heading. The detail pane beside the list
cannot stay as it is once the priorities are four columns, because 40% of a half screen leaves each
column about 170 px.

## How other products do it

### GitHub Projects (board layout)

- Moving is a mode: Enter or Shift+Space starts it, arrows move the card, Enter completes and Esc
  cancels; Ctrl+arrows go to the column's top, bottom, or the first or last column. Outside the
  mode, arrows move focus.
  [Docs, "Moving cards on the board layout"](https://docs.github.com/en/enterprise-server@3.19/get-started/accessibility/keyboard-shortcuts)
  (Enterprise Server 3.19 docs, read in full).
- The page says nothing of a card menu; a search result says a June 2023 update added an item menu
  to move to the top, the bottom, or another column.
  [Changelog](https://github.blog/changelog/2023-06-15-github-issues-projects-june-15th-update/)
  (seen only in a search summary, not opened).

### Trello

- `<` and `>` move the selected card to the top of the adjacent list, `,` and `.` to the bottom;
  arrows or `j k` select adjacent cards; there is no key to move a card up or down within a list.
  Seen only in search summaries of [Trello's shortcuts](https://trello.com/shortcuts) and a
  [feature request](https://jira.atlassian.com/browse/TRELLO-1566): the pages themselves did not
  load.

### Todoist

- `j k` or arrows move between tasks, `←` `→` between board sections, `a` adds at the bottom,
  `Shift+A` at the top, `Enter` saves and starts a task below, `v` opens a move menu,
  `Cmd+Backspace` (macOS) or `Shift+Delete` deletes.
  [Navigate faster with the command menu and your keyboard](https://todoist.com/help/articles/4407513458834)
  (read in full).

### What they have in common

- Arrows or `j k` move the focus; a distinct key or mode moves the card, so a stray key never moves
  work. Uraeda would use Shift, as the proposal asks.
- A menu is the touch and discovery path to the same moves (Todoist's `v`, GitHub's item menu).
- A column or board is for work with a lifecycle; none of these products uses it for a capture list.
  The inbox as categories is closer to Todoist's Inbox or a notes app.
- Deleting is immediate with an Undo, not a confirmation, in Todoist. Uraeda's notes already do it:
  a toast with Undo.
- Every product has a key map (`?` in Todoist, GitHub, and Trello). None was read for how it is laid
  out.

## Standards and libraries

### Astryx and the project's own components

- Astryx 0.7.3 has `Kbd`, `MoreMenu`, `ContextMenu`, `DropdownMenu`, `Drawer`, `BottomSheet`, and no
  kanban or board component (listed from the installed package's `dist/`). Columns are a grid of the
  shared `Pane` ([layout/Pane.tsx](/packages/web/src/layout/Pane.tsx)).
- Dragging is `@dnd-kit/react` 0.5.0, required by the
  [UI components](/specs/decisions/ui-components.md) decision. It already has a keyboard sensor
  ([lists/useDragOrder.ts](/packages/web/src/lists/useDragOrder.ts)).

### Active decisions that bear on the feature

- [UI behaviour](/specs/decisions/ui-behaviour.md): small edits happen in place; text saves only on
  an explicit action; every action works by tap and by keyboard, never by hover alone; lists whose
  rows open a pane SHOULD share one keyboard behaviour.
- [UI layout](/specs/decisions/ui-layout.md): three width classes through the theme; a spec shows
  mockups at each class; an open detail is in the URL; a glanced-at detail SHOULD open in a pane
  beside the list.
- [UI coherence](/specs/decisions/ui-coherence.md): one shared component per kind of information.
- [UI look](/specs/decisions/ui-look.md), [UI checks](/specs/decisions/ui-checks.md): the terminal
  look, and screenshots of every changed view at both sizes and in both themes.

## The code

### Important reads

- [InboxPage.tsx](/packages/web/src/InboxPage.tsx) (167 lines): builds `WorkSection`s from the
  categories that have notes, hides empty ones, and writes a drop through `inbox.place`.
- [PrioritiesPage.tsx](/packages/web/src/PrioritiesPage.tsx) and
  [lists/PrioritiesList.tsx](/packages/web/src/lists/PrioritiesList.tsx): "Ongoing" is derived, not
  in the file: it lists the running entries of every section apart, and `fileIndex` maps a drop back
  to the file's order. Each section ends with an `EditableLine` Add row.
- [lists/WorkList.tsx](/packages/web/src/lists/WorkList.tsx) (358 lines, over the project's size
  limit): vertical sections stacked, coloured left edges, a handle, rows as links. Both pages and
  the home use it. A kanban layout changes its section arrangement, so it is extracted rather than
  grown ([extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow)).
- [lists/useListKeys.ts](/packages/web/src/lists/useListKeys.ts): `j k`, arrows, Home, End, Enter,
  Escape; ignores Shift, text fields, layers, and menus. `h l` and `dd` do not exist; Enter edits
  the open pane's item.
- [lists/listPane.ts](/packages/web/src/lists/listPane.ts) and
  [layout/Panes.tsx](/packages/web/src/layout/Panes.tsx): the pane follows the selection with `j k`
  and takes `minmax(var(--size-pane-min), 40%)` beside the list.
- [pane/NotePane.tsx](/packages/web/src/pane/NotePane.tsx),
  [pane/NoteParts.tsx](/packages/web/src/pane/NoteParts.tsx),
  [pane/PriorityPane.tsx](/packages/web/src/pane/PriorityPane.tsx): the detail holds the actions
  today: Category, Organize (to a priority, to a draft, as a new draft), Delete with a toast and
  Undo, images, and Start for a priority.
- [statusHints.tsx](/packages/web/src/statusHints.tsx): the registry the status line reads; `j k`,
  `⏎`, and `esc` are declared by `useListKeys`.
- [EditableLine.tsx](/packages/web/src/EditableLine.tsx) and
  [useLineSave.ts](/packages/web/src/useLineSave.ts): inline edit with Enter to save, Escape to
  cancel, unsaved text kept. The base of `i a o O`.
- [crates/core/src/files/priorities.rs](/crates/core/src/files/priorities.rs): `parse` takes only
  list items under `## Now|Next|Later|Blocked`; text under a heading is never read or exposed.
  `SectionItems` has no field for it.
- [crates/core/src/api/inbox_edits.rs](/crates/core/src/api/inbox_edits.rs): `add_note` creates a
  category when a note names a missing one; there is no create-empty, rename, or delete of a
  category, and the inbox view lists only categories with notes.
- Git history of [the lists](/packages/web/src/lists/): the last commit split the pages into
  features; [the earlier priorities redesign](/specs/done/2026-10-16-redesign-priorities.md) chose
  the keys and the pane that follows.

### The proposal's path and existing actions

- **Open the page**: today a vertical list. Both pages restore scroll and the open pane from the
  history entry.
- **Move with the keys**: `j k` change the selection and the pane follows. With columns, `j k` stay
  inside a column and `h l` change column, so "following" would reopen a detail on every key.
- **Move a line**: dragging, or the Move button of the handle; priorities map the drop to the file's
  index with `fileIndex`, which skips the running entries. Shift+`jk` and Shift+`hl` need a second
  path to the same two mutations (`priorities.move`, `inbox.place`).
- **Insert**: Add rows at each section's end only. `o O` insert after or before the selected line,
  which needs `priorities.insert` and `inbox.insert` (both exist) with an empty line that must
  accept being cancelled without leaving a blank entry.
- **Edit**: `EditableLine`, opened from the pane. `i a I A` open it on the row.
- **Delete**: from the pane, with a toast and Undo. `dd` needs the same path from a row.
- **A running entry** has no handle and cannot move; `dd` or `J` on one must refuse or skip it.
- **Writes**: each change writes `PRIORITIES.md` or `INBOX.md` at once over the hash it read, and
  the commit bar commits them later; a second write over a stale hash is refused as a conflict. A
  held `J` sends several moves in a row, so they must queue over each result's hash.
- **Undo, delete, empty field**: an empty text is refused ("A note needs text."); an Undo restores
  lines at their place.
- **Agents' triage**: the inbox heading has "Organize with an agent" and its banner; the redraw
  keeps them.

### Rules and their owners

- **A priorities entry's section and order**: the core owns it (`priorities.rs`, `move_priority`);
  the page's `fileIndex` owns the mapping of "Ongoing" to the file, one copy.
- **The inbox's note and category format**: the core owns it
  ([the inbox reference](/skills/uraeda/references/inbox.md#the-format)); the UI only hides empty
  categories.
- **What `PRIORITIES.md` allows under a heading**: owned by nobody. The skill's
  [conventions](/skills/uraeda/references/conventions.md) only check the four `##` headings. The
  project's own file already holds `> [!NOTE]` callouts under Now, Next, and Later, written by hand.
- **Keys**: `useListKeys` owns the list keys for every list that opens a pane (the decisions page
  too), and the status line names only keys that work.

### Likely changes

- `crates/core/src/files/priorities.rs`, its `SectionItems`, the binding, and the server's view: a
  section's context text, with every option of the context question.
- `crates/core/src/api/inbox_edits.rs` and its napi, fate mutations, and web hooks: create, rename,
  and delete a category, with the categories question.
- `packages/web/src/lists/`: a column arrangement beside the stacked one; `WorkList.tsx` split; the
  keyboard layer; a key map. Under every option.
- `packages/web/src/InboxPage.tsx`, `PrioritiesPage.tsx`, `pane/`, `App.tsx` routes: the new views
  and the pane's place.
- `skills/uraeda/references/` (inbox, projects, conventions), the templates and the example's
  `PRIORITIES.md`: the context format, if it becomes part of the workflow.
- `editors/nvim`: only if the context format needs the plugin; the plugin reaches files through
  `ura lsp`.
- Prototypes: [the four mockups](mockups/) of this round, throwaway.

## The proposal

### Two views "extremely different"

The proposal asks for several proposals of how the inbox and the priorities differ, since the
priorities are opinionated and hierarchical and the inbox is freeform. The round compares three
inbox looks against one priorities look: [panes by category](mockups/inbox-a-panes.html),
[the file as a buffer](mockups/inbox-b-buffer.html), and
[a category index with one category open](mockups/inbox-c-index.html), against
[four columns](mockups/priorities-kanban.html).

### "Ongoing, Now, Next, and Later" leaves Blocked out

The file has four sections: Now, Next, Later, and Blocked. The proposal names Ongoing, which is
derived, and omits Blocked. The project's file has its Blocked section empty; the example project's
file holds one.

### Context in the file has no format

The proposal wants "some context to the 3 columns in the file", for Now, Next, and Later. The file
already carries `> [!NOTE]` callouts there, which the app ignores. One of them is malformed in the
project's file (`## Later` has a callout marker with an empty line before its text). Ongoing is not
in the file, and Blocked is not named.

### "Shifted should move the note/priority with it"

For `J K` the move is within a column. For `H L` the proposal does not say where the line lands in
the target column. Trello offers top or bottom; GitHub moves column by column and keeps the row.

### "o/O insert a new line before/after"

In vim, `o` opens a line below the cursor and `O` above it. Read in order, the proposal says `o`
inserts before and `O` after, the reverse. It is likely loose wording, and the questions settle it.

### "Categories that can be created and deleted"

The core and the view have no empty categories, so "create" has nothing to show today. Deleting a
category that holds notes has three possible meanings.

### Keyboard scope against the shared-keys decision

[UI behaviour](/specs/decisions/ui-behaviour.md) SHOULD share one keyboard behaviour across lists
that open a pane. Vim keys that edit would apply to editable lists only, so the decisions page,
whose rows cannot be edited, would keep the base keys. The proposal's "dedicated shortcut map for
this page" also overlaps the Now item "Leader key/shortcut map" in
[PRIORITIES.md](/specs/PRIORITIES.md).

### The pane against four columns

At the semi-wide class (the human's half screen is 1205 px,
[round 01 of the layout feature](/specs/done/2026-10-20-layout-look.md#q5-should-the-ui-get-a-third-width-class-for-half-screens))
the rail takes 52 px, leaving about 1150 px. A pane at 40% leaves about 690 px: four columns of
about 170 px. From 1280 px the shell's column takes 14% of the window, so on a 1920 px window about
1500 px remain, and a 40% pane leaves 900 px: four columns of 225 px, tight. The pane also follows
the selection today, which does not fit movement in two dimensions.

### Size of the work

The stories the spec would hold: the inbox view, the priorities columns, the section context,
categories' create and delete, a row's actions, the vim keys, and the key map: seven. Scenarios for
the keys alone would pass ten. The split rule's limits (6 stories, 30 scenarios) are likely passed.

## Worth it and feasibility

The feature is worth building with changes: the views and the keys are what the human uses daily and
still opens nvim for. The costs are the core work for categories and section context, a keyboard
layer on a shared hook, and a kanban arrangement that Astryx does not provide. Nothing relies on
outside behaviour that is unverified: `@dnd-kit/react`'s keyboard sensor is already in use, and the
page's keys are ordinary keydown listeners. One thing is not verified: typing `dd` as a two-key
sequence on layouts where the focused element is a row link; the plan's first task checks it in the
browser tests.

No guard is relaxed.

## Approaches

Criteria come from [the proposal](proposal.md), the
[UI behaviour](/specs/decisions/ui-behaviour.md), [UI layout](/specs/decisions/ui-layout.md), and
[UI coherence](/specs/decisions/ui-coherence.md) decisions, and the human's phone and half-screen
use.

### Splitting the work

Whether the keyboard and the key map belong to this feature or follow it. See
[size of the work](#size-of-the-work).

| Option                                                         | Stories here | Delivers vim keys | Risk                              |
| -------------------------------------------------------------- | ------------ | ----------------- | --------------------------------- |
| A. Views, context, categories, actions here; keys and map next | 5            | Right after       | Two features touch the same lists |
| B. Everything here                                             | 7            | With the views    | A spec past the split rule        |

### How the inbox looks

Three looks, in [the prototypes](mockups/). All keep notes whole and the terminal look.

| Option                    | Fits "freeform" | Phone                      | Categories                    | Keys                      |
| ------------------------- | --------------- | -------------------------- | ----------------------------- | ------------------------- |
| A. A pane per category    | Yes: stacked    | One column, as today       | Each is a pane with its title | `j k`, `J K`, `H L` moves |
| B. The file as a buffer   | Closest to nvim | One column, no real change | Headings are lines            | Line keys, as in nvim     |
| C. Index and one category | Partly          | Index becomes a page       | Index, with counts            | `h l` between categories  |

### How the priorities look

Columns are asked by the human and chosen in
[round 01 of the layout feature](/specs/done/2026-10-20-layout-look.md#q8-how-should-priorities-be-laid-out).
What remains: Blocked's place.

| Option                                              | Blocked visible | Width cost       |
| --------------------------------------------------- | --------------- | ---------------- |
| A. A pane under the columns, only when it has lines | When used       | None             |
| B. A fifth column                                   | Always          | A fifth of width |
| C. Hidden in the app, kept in the file              | Never           | None             |

### Context of a column

| Option                                                                       | Readable without tools | Rule it adds                         |
| ---------------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| A. The `> [!NOTE]` callout under the heading, which the project already uses | Yes                    | One callout per section              |
| B. The paragraph under the heading                                           | Yes                    | Any prose under a heading is context |
| C. A key in a front matter                                                   | Less                   | A new structure                      |

### Where a line lands in another column

Only with the keys in this feature, see [splitting the work](#splitting-the-work).

| Option                                       | Predictable | Matches          |
| -------------------------------------------- | ----------- | ---------------- |
| A. At the same row, or the last when shorter | Yes         | Vim's `h l` rows |
| B. At the top of the column                  | Yes         | Trello's `<`     |
| C. At the bottom of the column               | Yes         | Trello's `.`     |

### The detail pane

| Option                                                                   | Columns' width   | Layout decision             |
| ------------------------------------------------------------------------ | ---------------- | --------------------------- |
| A. Opens on Enter, beside the columns when wide, a page of its own below | Full when closed | Follows the SHOULD          |
| B. Always beside, following the selection                                | 170 to 225 px    | Follows, but narrow         |
| C. No pane: everything inline                                            | Full             | Loses images, Start, drafts |

### Where a row's actions are

| Option                                     | By touch          | By keyboard      |
| ------------------------------------------ | ----------------- | ---------------- |
| A. A "…" menu on every row, always visible | Yes               | Opens with a key |
| B. Actions on the selected row only        | Needs a tap first | Yes              |
| C. Only in the pane                        | Yes               | Yes              |

### Categories

| Option                                                                   | Notes' fate on delete | Core work              |
| ------------------------------------------------------------------------ | --------------------- | ---------------------- |
| A. Empty categories show; delete moves notes to "No category", with Undo | Kept                  | Create, rename, delete |
| B. Delete refuses unless empty                                           | Kept                  | Same, no move          |
| C. Delete removes its notes, with Undo                                   | Removed               | Same                   |

### Renaming and reordering categories

Part of the same core work. Reordering categories is a block move of lines, which no operation does
today.

### The keys' scope and the key map

| Option                                                                                                                    | Shared-keys decision | Cost                        |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------- |
| A. A layer on the shared list keys, on for these two pages; a `?` map built from the same declarations as the status line | Kept                 | One hook grows, one new map |
| B. A separate keyboard for these two pages                                                                                | Breaks the SHOULD    | Two copies                  |
| C. The global leader-key map built here                                                                                   | Kept                 | Takes the Now item          |

### Needs no choice

- **Deleting with Undo**: already how notes and priorities delete.
- **Dragging**: stays, with handles, as today.
- **Phone**: a vertical list, as the proposal says.
- **Inbox triage**: the heading's "Organize with an agent" and its banner stay.
- **Accessibility**: keys never act inside a text field or a layer; every action also has a button
  or a menu, per UI behaviour.

## Not checked

- [Linear's keyboard shortcuts](https://linear.app/docs/keyboard-shortcuts): the page returned 404.
- Trello's shortcut page: it did not load; its keys come from search summaries.
- GitHub's June 2023 changelog entry: seen in a search summary only.
- The layout of each product's key map (`?`): not opened.
- Whether a browser's own keys (`/`, Firefox quick find, `'`) steal `dd` or `o` on a focused row:
  not tested; the plan checks it.
