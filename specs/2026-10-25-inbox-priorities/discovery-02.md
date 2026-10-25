# Discovery, round 02: Inbox and priorities in the terminal look

## Why this round

Two answers of [round 01](clarifications-01.md) need the human again.

- The split question was answered "A and B", options that exclude each other: see
  [the split](#the-split).
- The detail pane was answered with an overlay, and a request to see a few mockups: see
  [the overlay](#the-overlay).

Everything else was answered, and the notes changed three settled points: see
[what the answers changed](#what-the-answers-changed).

## Summary

The earlier round found that four columns leave no room for a pane beside them. The human asked for
an overlay on a single line, as nvim shows content in a floating window, and for columns that scroll
sideways, so a column may be partly cut at the page's edge. The code already has a shared overlay, a
dialog on wide screens and a bottom sheet on narrow ones, so the open choice is its size and place.
The other answers are applied in the spec without a new question.

## How other products do it

### GitHub Projects

- A click on a card's title opens the item in a panel on the right of the board, which keeps the
  board in view. A link in the panel opens the item in a new tab.
  [Project board issue and pull request details view](https://blog.github.com/2018-06-14-project-board-side-panel-view)
  (a 2018 post, seen in a search summary only). A 2023 changelog says an item can be deep-linked to
  open in the side panel
  ([changelog](https://github.blog/changelog/2023-01-05-github-issues-january-5th-update/), search
  summary only).

### Linear

- "Peek" previews a focused issue from any list or board, toggled with Space, held to keep it open;
  it is keyboard-only. Seen in a search summary of
  [Linear's Peek page](https://linear.app/docs/peek.md), which returned 404 when fetched.

### What they have in common

- A quick look at a card that does not take the page: a side panel or a preview over the page.
  Neither shows the card in a dialog sized to its text; that is the human's nvim habit.

## Standards and libraries

### Astryx and the shared overlay

- [`layout/Overlay.tsx`](/packages/web/src/layout/Overlay.tsx): a dialog on wide screens, a bottom
  sheet on narrow ones, each with a visible Close, and Back closes it. It takes a `width` for the
  dialog, and the sheet's height. Astryx 0.7.3 also has `Drawer` and `AlertDialog`.
- [UI layout](/specs/decisions/ui-layout.md): on wide screens popovers and dialogs, on narrow ones
  sheets; an open detail MUST be in the URL. A dialog on the priorities' route keeps both.
- [UI behaviour](/specs/decisions/ui-behaviour.md): every action works by tap and by keyboard, never
  by hover alone.

## The code

### Important reads

- [`pane/EntryPane.tsx`](/packages/web/src/pane/EntryPane.tsx), `NotePane.tsx`, `PriorityPane.tsx`:
  the detail, today drawn in a column. It would be drawn in the overlay instead, with its bar
  (location, Edit, Open draft, Close) and its Previous and Next steps.
- [`App.tsx`](/packages/web/src/App.tsx) `TaskRoute` and `NoteRoute`: the routes `/priorities/<key>`
  and `/inbox/<key>` draw the list beside the detail with `Panes`. They would draw the page and the
  overlay over it, keeping the URLs.
- [`lists/WorkList.tsx`](/packages/web/src/lists/WorkList.tsx): its handle is a `Button` in the
  row's `startContent`, with the drag sensor's activator set to the handle on a mouse. dnd-kit's
  `useSortable` can take the whole row as its activator, as it already does for a touch press of
  half a second.
- [`PRIORITIES.md`'s `Section`](/crates/core/src/files/priorities.rs): four values, Blocked
  included. Blocked is named in the skill's [conventions](/skills/uraeda/references/conventions.md),
  the [template](/skills/uraeda/assets/templates/specs/PRIORITIES.md), the example's file, and
  `ura check`.

### The proposal's path and existing actions

- **Open a line**: Enter, or a click, opens the overlay on the line's URL; Back closes it.
- **A hover-only `…`**: the decision forbids hover alone. A button shown on the selected card, on
  hover, on keyboard focus within the card, and always when the pointer cannot hover
  (`(hover: none)`) passes it.
- **Drag without a handle**: a mouse press on a card that moves less than a few pixels is a click
  and opens the overlay; more is a drag. Touch keeps its half-second press.
- **Dropping Blocked**: a line under `## Blocked` in an existing file must not vanish.
- **Deleting a category with notes**: the human wants a question with Yes and No.

### Likely changes

- `packages/web/src/App.tsx`, `pane/`, `layout/`: the overlay, with the options of
  [the overlay](#the-overlay).
- `packages/web/src/lists/`: cards without handles, the `…` menu, the columns that scroll.
- `crates/core/src/files/priorities.rs`, `check/`, the skill, template, and example: Blocked
  retired.
- Prototypes: [the overlay's three looks](mockups/) and
  [the columns](mockups/priorities-columns-scroll.html), throwaway.

## The proposal

### The split

Round 01's answer was "A and B". A builds the views, the context, the categories, and the row
actions here and the keys next. B builds all of them here. They cannot both hold. A reading of
"both" is one feature whose keys come in a second spec, which is A. The size of the work has not
changed: seven stories, with the keys' scenarios more than ten.

### What the answers changed

- **Blocked is retired.** The human wants a blocked line moved after what it needs. The template,
  the skill, the checks, and the app no longer have the section.
- **Dragging has no handle.** Cards are small, simple, and always draggable, with `…` on hover. The
  earlier settled point kept the handles.
- **Columns scroll sideways.** A column may be cut at the page's edge. The earlier settled point
  gave four columns that fit.
- **Deleting a category asks.** The earlier recommendation moved the notes to "No category" and
  offered Undo.
- **A key map that a leader key can reuse.** The keys are declared once, as data a later map reads.

## Worth it and feasibility

The overlay and the cards are small, built on what exists. Nothing relies on unverified outside
behaviour except one: a mouse press on a whole card must stay a click for a short move, and a drag
past it. dnd-kit's activation constraints support a distance; the plan's first task checks it with
the real card in a browser test.

No guard is relaxed.

## Approaches

Criteria come from [the proposal](proposal.md), [UI layout](/specs/decisions/ui-layout.md),
[UI behaviour](/specs/decisions/ui-behaviour.md), and
[UI coherence](/specs/decisions/ui-coherence.md).

### The overlay

How a single line is shown over the page. All three keep the URL, Back to close, Previous and Next,
and a sheet on narrow screens. Prototypes: [a dialog](mockups/overlay-a-dialog.html),
[a large float](mockups/overlay-b-large-float.html), [a drawer](mockups/overlay-c-drawer.html).

| Option                                        | Page behind it  | Room for a long note, draft, images | Reuses the shared overlay |
| --------------------------------------------- | --------------- | ----------------------------------- | ------------------------- |
| A. A dialog about 34 characters wide, centred | Visible, dimmed | Limited, it scrolls                 | Yes                       |
| B. A large float, most of the window          | Barely visible  | Most                                | Yes, with a width         |
| C. A drawer on the right edge                 | Visible, dimmed | Medium                              | Needs Astryx's `Drawer`   |

### The split question again

| Option                                                         | Stories here | Keys |
| -------------------------------------------------------------- | ------------ | ---- |
| A. Views, context, categories, actions here; keys and map next | 5            | Next |
| B. Everything here                                             | 7            | Here |

### Needs no choice

- **Cards, handles, and `…`**: the human decided: cards without handles, `…` on hover, and the
  decision's rule kept by showing it on selection, focus, and touch.
- **Columns**: they scroll sideways, as the human decided.
- **Deleting a category**: a confirmation asks "Delete the notes too?", decided by the human.
- **Blocked**: retired, as decided, with a plan for existing files in the questions' settled points.
- **A key map for a later leader key**: a design constraint, in the architecture.

## Not checked

- Linear's Peek page: 404; its behaviour is from a search summary.
- GitHub's current docs on opening an item: not found; the 2018 post and the 2023 changelog are
  search summaries.
