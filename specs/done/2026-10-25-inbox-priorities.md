---
kind: feature
finished: 2026-10-26
pull-request: https://github.com/mrtolkien/uraeda/pull/60
---

# Record: Inbox and priorities in the terminal look

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-25, finished on
> 2026-10-26, in [its pull request](https://github.com/mrtolkien/uraeda/pull/60). Its full files are
> in git: `git log -- specs/2026-10-25-inbox-priorities/`.

## What and why

The inbox and the priorities, redrawn in the look and shell of
[layout and look](2026-10-20-layout-look.md), as two views that differ on purpose: the priorities
are opinionated, so they are columns of cards; the inbox is freeform, so it is a stack of panes, one
per category. The human still opened Neovim to organize the two files, so each line gets a `…` menu,
the priorities get a written context per section, and categories can be created, renamed, and
deleted. The vim-like editing keys and the key map were split off as the next feature.

## Behaviour

- **Priorities as columns**: Ongoing (derived, shown only while something runs), Now, Next, and
  Later are titled panes in one row of at least 400 px each that scrolls sideways; on the phone they
  stack. The page says "What is worked on, in order: Ongoing runs now, then Now, Next, and Later." A
  running card never moves, and a drop on Ongoing writes nothing.
- **A card** draws its line whole, wrapping, with its sub-lines; its marks (the running step,
  "draft", "backlog", a note's tags) sit in its top border. It drags from anywhere, with no handle:
  a mouse press moves it after 5 px and a shorter press is a click that opens it; a touch press
  drags after half a second.
- **A section's context** is the first callout of any type under its heading in `PRIORITIES.md`,
  before the first entry; its text is the first paragraph after the marker, in the same callout as
  the marker. The page shows it under the pane's title and the app writes Ongoing's own: "Running
  now: an agent works or waits on you." It is edited in the file only. A callout whose text stands
  in a separate quote has no text, and `ura check` warns.
- **Blocked is retired**: the template, the skill, the example, and `ura check` no longer have it. A
  file that still has lines under `## Blocked` keeps them readable; the page shows a "Blocked" pane
  under the columns, only while it has lines, and `ura check` warns "Blocked is retired: move its
  lines". An empty `## Blocked` is ignored, and a blocked line goes after what it needs.
- **The inbox as panes**: one titled pane per category in file order, the notes without a category
  first, an empty category shown as an empty pane. The page says "Things noticed, not decided: turn
  each into a priority, a draft, or nothing." Notes drag within and between categories.
- **The detail is an overlay** on the line's URL, `/priorities/<key>` or `/inbox/<key>`, over the
  page, which stays mounted: a dialog 108 characters wide and 60% of the window tall, a bottom sheet
  on the phone. Enter or a click opens it; Escape and Back close it in one press and leave the card
  selected; Previous and Next stay in view and replace the history entry; a reload keeps it; a line
  that is gone shows the page and says "That line is gone."
- **A `…` menu on every card**: a priority offers Move to Now, Next, or Later, Move up and down, To
  the top and bottom (through the same index as a drag, skipping running entries), Make a draft,
  Start, and Delete; a note offers Move to a priority, Add to a draft, Make a draft, a Category, and
  Delete; a running card offers only Open. The button shows on hover, on the selected card, on
  keyboard focus within the card, and always when the pointer cannot hover. A move offers an Undo
  toast, refused if the file changed meanwhile.
- **Categories**: "New category" adds `## <name>` at the end of `INBOX.md`; a pane's title renames
  in place; its menu deletes. Deleting a category with notes asks "Delete the N notes too?" with
  three bordered lines, Yes (Y), No (N), and Cancel (C); No moves its notes after the notes without
  a category, in order; an empty category deletes at once. An Undo toast restores the file byte for
  byte, or is refused with the conflict message when the file changed. Names are unique, trimmed,
  and must read back as a heading.
- **Keys**: `j k`, the arrows, Home, and End move inside a column; `h l` and the left and right
  arrows go to the same row of the neighbouring column, or its last card; Enter opens the overlay;
  selecting opens nothing. The status line names `h l` only on the columns.
- **Rules kept for the next feature**: the keys are declared once through the status line's
  registry; `o` inserts after the line, `O` before it, `H L` put a line at the same row of the next
  column, `dd` deletes, and a `?` map reads the same declarations.

## Design

The core owns every rule of the two files and the pages only draw. The section context is one rule
in [`files/priorities/context.rs`](/crates/core/src/files/priorities/context.rs), read by the page's
data and by `ura check` ([`check/priorities.rs`](/crates/core/src/check/priorities.rs)). The
category edits are text edits in
[`files/inbox/categories.rs`](/crates/core/src/files/inbox/categories.rs), checked and written in
[`actions/inbox/categories.rs`](/crates/core/src/actions/inbox/categories.rs); a delete returns the
file as it was, and its Undo writes it back only while the file still hashes to what the delete
wrote. The binding and the server pass them on as `inbox.addCategory`, `renameCategory`,
`removeCategory`, and `restoreCategory`, and `removed` on the inbox record
([`inbox-mutations.ts`](/packages/server/src/fate/inbox-mutations.ts)).

On the web, [`Card`](/packages/web/src/lists/Card.tsx) is the one card of both pages (frame, marks
in its border, selection, a stretched link, the `…` slot, a drag source from anywhere).
[`WorkList`](/packages/web/src/lists/WorkList.tsx) draws titled panes as columns or a stack and owns
the selection. [`cardMoves.ts`](/packages/web/src/lists/cardMoves.ts) owns the index of every menu
move and of a drop (`fileIndex`). [`CardMenu`](/packages/web/src/lists/CardMenu.tsx) reuses the
actions of the old pane. [`CategoryPane`](/packages/web/src/lists/CategoryPane.tsx) and
[`useCategoryActions`](/packages/web/src/lists/useCategoryActions.ts) draw and run the category
controls. [`DetailOverlay`](/packages/web/src/pane/DetailOverlay.tsx) and
[`DetailRoutes`](/packages/web/src/pane/DetailRoutes.tsx) draw the detail on the line's URL, using
`openOverlayAt` so Back goes over one entry; the page's key is the same for the list and its detail,
so opening the overlay never remounts the list.
[`useListKeys`](/packages/web/src/lists/useListKeys.ts) adds the column keys. Stories of the views
are in [`WorkList.stories.tsx`](/packages/web/src/lists/WorkList.stories.tsx) and
[`EntryPane.stories.tsx`](/packages/web/src/pane/EntryPane.stories.tsx).

## Questions

### Round 01

#### Q1: Should the keyboard and the key map be a second feature?

**Answer:** "A and B", which exclude each other; settled in round 02.

#### Q2: How should the inbox look, next to the columns of the priorities?

**Answer:** A, a pane per category.

#### Q3: Where does the detail open, now that the priorities have four columns?

**Answer:** A, "Could we use a modal/overlay to see a single line?" with a few mockups, and the four
columns may scroll sideways, so "Later" may be cut.

#### Q4: How is a column's context written in `PRIORITIES.md`?

**Answer:** A, a callout under the heading; widened in the spec to a callout of any type.

#### Q5: Where does Blocked go?

**Answer:** "Let's dropped the 'Blocked' category actually: a blocked feature should just be moved
after the feature it needs, in the right category."

#### Q6: Where do a row's actions appear?

**Answer:** A, a `…` menu on every row.

#### Q7: What does deleting a category do to its notes?

**Answer:** "Ask the user? It's the simplest by a lot": a question "do you also want to delete
notes: Y/N".

#### Q8: Should categories also be renamed and reordered?

**Answer:** A, create, delete, and rename.

#### Q9: How do the vim keys and the key map relate to the other lists and to the leader key?

**Answer:** A, a layer on the shared list keys, `dd` and not `Dd`; "make sure the way you implement
this makes it easy to interface with the leader key/global shortcut map later".

#### Q10: Where does a line land when it moves to another column?

**Answer:** A, at the same row, or last when the target is shorter.

#### Q11: Which way do `o` and `O` insert?

**Answer:** A, vim's: `o` after, `O` before.

#### Notes

- **Columns by width**: it is ok to overflow horizontally a bit; use the current priorities as the
  mockups' text so readability is judged on real lines.
- **Dragging**: no handles, as Todoist has none; small, simple cards, always draggable, with `…`
  appearing on hover.

### Round 02

#### Q1: Is the keyboard a second feature, or part of this one?

**Answer:** A, the views, context, categories, overlay, and row actions here; the keys and the map
become the next feature.

#### Q2: How big is the overlay that shows a single line?

**Answer:** A, a dialog, "but a bit bigger, ~70 characters wide"; the review raised it to 108
characters wide and 60% of the window tall.

## Decisions

No decision was created, changed, or removed.

## Changes after approval

- The spec's review raised the columns to 400 px, set a card's marks in its border, made the context
  a callout of any type, enlarged the overlay by half, and made the delete question three separate
  bordered choices with keys.
- At 1150 px two columns show whole, not three, since the columns are 400 px wide.
- A running card's menu offers Open; a priority's menu has Undo for moves; an empty category deletes
  with no question.
- Previous and Next stay in view at the foot of the overlay.
- `j k`, Home, and End stay inside a column on the columns, and the status line shows `esc close`
  only while the overlay is open.
- A write the server fails shows its message instead of an unhandled error, for the priorities' and
  the categories' actions.

## Follow-ups

- The editing keys, `?` key map, and a leader key are the next feature (`i a I A`, `o O`, `dd`, `u`,
  `H J K L`).
- The notes' actions (`useNoteActions`) and the quick-add forms still let a failed request reject
  without a message.
- The project's own `PRIORITIES.md` has a malformed callout under `## Later`, which `ura check`
  warns about; the human fixes it on the default branch.
- Three browser checks already failed before this branch: two story-embed widths, and the sidebar
  layout check "searched for” in both themes; one story-variants test is flaky.
