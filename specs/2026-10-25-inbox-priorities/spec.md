---
status: approved
revision: 2
clarifications: 2
risk-tier: medium
plan-review: false
---

# Spec: Inbox and priorities in the terminal look

> [!NOTE]
>
> Approved on 2026-10-25.
>
> - You approve the priorities as scrolling columns of draggable cards, the inbox as a pane per
>   category, a detail that opens in an overlay, a `…` menu on every line, and categories you
>   create, rename, and delete.
> - Since your review: columns are 400 px wide, and a card's marks sit in its border.
> - Since your review: the overlay is 50% bigger, about 108 characters wide and 60% of the window
>   tall.
> - Since your review: a section's context is the first callout of any type, all drawn the same way.
> - Since your review: Yes, No, and Cancel are three bordered lines, with the keys Y, N, and C.
> - Still open from before: the mockups are HTML pages, and the plan writes their stories first.

The priorities and the inbox, redrawn in the look and shell of
[layout and look](../done/2026-10-20-layout-look.md), as two views that differ on purpose. The
priorities are opinionated, so they are columns. The inbox is freeform, so it is stacked panes. See
the [proposal](proposal.md), the [discovery](discovery-01.md) and its
[second round](discovery-02.md), and the clarifications of [round 01](clarifications-01.md) and
[round 02](clarifications-02.md).

## Your review

- **C1** (any callout type): done. The first callout of any type is the context, whether `NOTE`,
  `TIP`, `IMPORTANT`, `WARNING`, or `QUESTION`, and the page draws all of them the same way.
- **C2** (400 px, marks in the border): done. Columns are at least 400 px wide. A card's marks, such
  as "Spec", "Questions", "draft", and a note's tags, are set in the card's border like a pane's
  title, never as words at the start or end of its line.
- **C3** (a bigger overlay): done. The dialog is 50% wider and taller: about 108 characters wide and
  60% of the window tall.
- **C4** (separate, clickable choices): done. Yes, No, and Cancel are three bordered lines, each
  showing its key: Y, N, and C.

## Decisions

No decision is created, changed, or removed. The overlay and the hover menu follow the decisions
below, as the stories explain.

Relied on:

| Decision                                       | What it means for this spec                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------------------- |
| [UI layout](../decisions/ui-layout.md)         | three width classes; an open detail is in the URL; a sheet on narrow screens      |
| [UI behaviour](../decisions/ui-behaviour.md)   | `…` never shows by hover alone; every action works by tap and by keyboard         |
| [UI coherence](../decisions/ui-coherence.md)   | the overlay is the shared one, and a card is drawn by one component on both pages |
| [UI components](../decisions/ui-components.md) | dragging stays `@dnd-kit/react`; the menu is Astryx's                             |
| [UI look](../decisions/ui-look.md)             | panes with their title in the border, square corners, Catppuccin                  |
| [UI checks](../decisions/ui-checks.md)         | tests follow the scenarios; screenshots at both sizes and in both themes          |

## User stories

### US1: Priorities as columns (P1)

The priorities page shows Ongoing, Now, Next, and Later as titled panes side by side, each with its
context under its title. Every line is a small card with its whole text wrapping. Columns are at
least 400 px wide, so on a half screen the row scrolls sideways and Later may be cut at the edge. On
the phone the same panes are stacked, one column. A card is a small frame whose marks sit in its
border: a running step, "draft", or a note's tags. A line is dragged from anywhere on its card, with
no handle. Under the title, one line says what the page is for.

[Columns, with the current priorities](/packages/web/src/lists/WorkList.stories.tsx#Columns)

[The phone](/packages/web/src/lists/WorkList.stories.tsx#Phone)

Key scenarios:

1. **Given** the project's priorities and a window of 1150 px, **When** the page opens, **Then**
   Ongoing, Now, and Next show whole, Later is cut at the right edge, and the row scrolls sideways.
2. **Given** a card in Now, **When** the user presses on its text, moves 40 px, and releases over
   Next, **Then** the line is written in Next at the drop place, and a press that moves under 5 px
   opens the card's overlay instead.
3. **Given** Ongoing holds a running feature, **When** the user presses on its card and moves,
   **Then** it does not move, and its context reads "Running now: an agent works or waits on you."

More scenarios:

1. **Given** a window of 390 px, **When** the page opens, **Then** the panes are stacked in the
   order Ongoing, Now, Next, Later, and a touch press of half a second starts a drag.
2. **Given** Next holds no line, **When** the page opens, **Then** its pane shows its context and
   its "Add to Next" row.
3. **Given** a card selected in Now, **When** the user presses `l`, **Then** the card at the same
   row of Next is selected, or the last card when Next is shorter.

### US2: A section's context, and no Blocked (P1)

A human writes what a section means now as a callout of any type under its heading in
`PRIORITIES.md`, and the page shows it above the column, all types the same way. Blocked is no
longer a section.

Key scenarios:

1. **Given** `## Now` followed by `> [!TIP]`, a `>` line, and `> Features for v1.0.0`, **When** the
   page opens, **Then** the Now pane shows "Features for v1.0.0" under its title.
2. **Given** `## Later` whose callout marker stands alone and whose text is in a separate quote,
   **When** `ura check` runs, **Then** it warns that the section's context has no text, and the
   Later pane shows no context.
3. **Given** a file with `## Blocked` and one line under it, **When** the page opens, **Then** a
   "Blocked" pane under the columns shows the line, and `ura check` warns that Blocked is retired.

More scenarios:

1. **Given** a new project, **When** it is set up, **Then** its `PRIORITIES.md` has Now, Next, and
   Later, and no Blocked.
2. **Given** a file with an empty `## Blocked`, **When** the page opens, **Then** no Blocked pane
   shows, and `ura check` reports nothing.
3. **Given** two callouts under `## Next`, **When** the page opens, **Then** only the first is its
   context.

### US3: The inbox as a pane per category (P1)

The inbox page stacks one titled pane per category, each with its notes whole: their sub-lines,
tags, and first image. The notes without a category come first. Under the title, one line says what
the inbox is for. A note is drawn as the same card as a priority and drags the same way, within and
between categories.

[Inbox panes](/packages/web/src/lists/WorkList.stories.tsx#Inbox)

Key scenarios:

1. **Given** the project's inbox, **When** the page opens, **Then** each category with notes is a
   pane, and a note with a sub-line shows the sub-line under its text.
2. **Given** a note in UI, **When** the user drags it onto Prompts, **Then** `INBOX.md` has the note
   at the drop place under `## Prompts`.
3. **Given** the page, **When** it opens, **Then** the line under the title reads "Things noticed,
   not decided: turn each into a priority, a draft, or nothing."

More scenarios:

1. **Given** an inbox with no note, **When** the page opens, **Then** it shows its purpose line and
   "New category", and no empty pane without a heading.
2. **Given** a note tagged `[agent] [spec-page]`, **When** the page opens, **Then** both tags show
   on its card.

### US4: A line in an overlay (P1)

Enter or a click on a card opens that line in an overlay over the page, with its actions, Previous
and Next, and Close. On every width but the phone it is a dialog about 108 characters wide and 60%
of the window tall, over the dimmed page. On the phone it is a bottom sheet. The URL is the line's,
so reload and Back keep it: Back closes it. The list's selection does not open it.

[The dialog](/packages/web/src/pane/EntryPane.stories.tsx#Overlay)

Key scenarios:

1. **Given** a card selected in Next, **When** the user presses Enter, **Then** the overlay opens on
   that line at `/priorities/<key>`, with the columns still drawn behind it.
2. **Given** the overlay is open, **When** the user presses Escape or Back, **Then** it closes, and
   the card is still selected.
3. **Given** the overlay on the 2nd of 14 lines of Next, **When** the user presses Next, **Then**
   the 3rd line shows, and the address changes without adding a history entry.

More scenarios:

1. **Given** an overlay on a line, **When** the page is reloaded, **Then** it opens on the same
   line.
2. **Given** a window of 390 px, **When** a card is tapped, **Then** a bottom sheet opens, with a
   visible Close.

### US5: A menu on every line (P2)

Every card has a `…` button that opens a menu. A priority offers Move to Now, Next, or Later, Move
up and down, To the top and bottom, Make a draft, Start, and Delete. A note offers Move to a
priority, Add to a draft, Make a draft, a Category, and Delete. The button shows on hover, on the
selected card, on keyboard focus within the card, and always when the pointer cannot hover.

Key scenarios:

1. **Given** a card in Next, **When** the user opens its menu and picks "Move to Now", **Then** the
   line is the last of Now, and a toast offers Undo.
2. **Given** a note, **When** the user picks "Move to a priority" and Later, **Then** `INBOX.md`
   loses the note and Later gains it as its last entry.
3. **Given** a touch screen, **When** the page opens, **Then** every card shows its `…` button.

More scenarios:

1. **Given** a keyboard user on a selected card, **When** they press Tab, **Then** the focus reaches
   `…`, and Enter opens the menu.
2. **Given** a running priority, **When** its menu opens, **Then** it offers neither move nor
   delete.

### US6: Categories you create, rename, and delete (P2)

"New category" adds an empty pane. A pane's title is renamed in place, and its menu deletes it.
Deleting asks "Delete the N notes too?" with three bordered lines, each showing its key: Yes (Y), No
(N), and Cancel (C). No keeps the notes, in order, under No category.

[Delete a category](/packages/web/src/lists/WorkList.stories.tsx#CategoryDelete)

Key scenarios:

1. **Given** the inbox, **When** the user adds the category "Prompts", **Then** `INBOX.md` ends with
   `## Prompts`, and an empty pane shows.
2. **Given** UI holds three notes, **When** the user deletes it and answers No, **Then** the three
   notes come first under no category, in their order, and an Undo toast restores the heading and
   the notes.
3. **Given** UI holds three notes, **When** the user deletes it and answers Yes, **Then** the
   heading and its notes are gone, and Undo restores them.

More scenarios:

1. **Given** the category UI, **When** the user renames it "Interface", **Then** the heading reads
   `## Interface`, and its notes stay.
2. **Given** a category named "Prompts", **When** the user renames another to "Prompts", **Then**
   the page refuses with "A category named Prompts exists."
3. **Given** the dialog is open, **When** the user chooses Cancel, **Then** nothing changes.

## Architecture

The two pages share one card and one stacked pane list, extracted from the oversized `WorkList`, and
differ in how they arrange it: columns, or panes in one column. The core owns every rule of the two
files, so the page only draws. The detail moves from a column to the shared overlay, so the page
never has to share its width. See [the overlay](discovery-02.md#the-overlay) and
[the panes](discovery-01.md#the-detail-pane).

- **The section context** is read by the core from the first callout under a heading, and carried by
  the binding and the server to the page. It owns what counts as a callout and as its text.
- **The category edits** create, rename, and delete a heading in `INBOX.md`, and restore it on Undo.
  They own the unique-name rule and what happens to the notes of a deleted category.
- **The retired Blocked** stays readable in the core, and `ura check` owns its warning.
- **The card** draws a line whole, its marks, its selection, and its `…` button. It owns when the
  button shows, and it is the drag source from anywhere, with a 5 px distance before a drag starts.
- **The columns** arrange the priorities' panes in a scrolling row of at least 400 px each, and in a
  stack on the phone. They own the width rule and Ongoing's derived lines.
- **The category panes** arrange the inbox's panes, with their New, rename, and delete controls.
- **The line menu** lists a line's actions. It reuses the pane's existing actions, so no rule is
  copied.
- **The detail overlay** draws the detail in the shared overlay on the line's URL, with Previous and
  Next. It replaces the pane beside the list.
- **The list keys** keep `j k`, arrows, Home, and End, add `h l` and the arrows between columns, and
  make Enter open the overlay. They declare their hints once, through the status line's registry,
  which the next feature reads for its key map.
- **The skill, the template, and the example** state the context callout and drop Blocked, together
  with `ura check`, as the workflow's rules require.

Tradeoffs:

- Dragging has no keyboard path of its own: the menu's moves are the keyboard's way.
- A section's context cannot be edited in the app, only in the file.
- A column may be cut at the edge of a half screen, so Later is partly hidden at first.
- The overlay hides the board's detail beside the list that the old pane gave, one line at a time.
- Retiring Blocked changes the format of every project's file, with a warning rather than a failure.

## Edge cases

| Importance | Situation                                                    | What happens                                                                 |
| ---------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| High       | A deleted category's Undo meets a file changed meanwhile     | the page refuses with the conflict message and reads the file again, no loss |
| High       | A drag is dropped on Ongoing                                 | nothing is written: Ongoing is derived, and its cards stay                   |
| High       | A running priority is moved or deleted from its menu         | the menu does not offer it, and a drag leaves the card where it is           |
| High       | A line under a retired `## Blocked`                          | it stays in the file and on the page, and `ura check` warns                  |
| Normal     | A category renamed to the name of another                    | refused with "A category named Prompts exists."                              |
| Normal     | A category named with only spaces                            | refused with "A category needs a name."                                      |
| Normal     | The overlay's line is deleted from its menu                  | the overlay closes, and a toast offers Undo                                  |
| Normal     | The address of an overlay names a line that no longer exists | the page shows without an overlay and says "That line is gone."              |
| Normal     | A press that moves 4 px on a card                            | it is a click and opens the overlay                                          |
| Niche      | A context callout holding several paragraphs                 | the first paragraph is the context                                           |
| Niche      | The first image of a note on a narrow card                   | it shows under the text, as the note's row does today                        |

## Success criteria

- **SC-001** (one scroll): On a window of 1150 px, the priorities show as one row of four panes that
  scrolls sideways, each at least 400 px wide.
- **SC-002** (one keypress): A selected card opens in its overlay with one Enter, at its own
  address.
- **SC-003** (every action): Every action of a card's menu is reachable by Tab and Enter, and by tap
  on a screen that cannot hover.
- **SC-004** (no handle): A card drags by a press on its text, and a press under 5 px opens it.
- **SC-005** (context): Every section with a context callout shows its text, and one with none shows
  no text.
- **SC-006** (no loss): Deleting a category, with Yes or No, and its Undo, leaves `INBOX.md` as it
  was before, byte for byte.
- **SC-007** (contrast): Every new text and border reaches the contrast floors of the UI look
  decision, in both themes.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human) of round 01, and of
[round 02](clarifications-02.md#check-these), hold as written there, with these changes. The keys
are the next feature's: `i a I A`, `o O`, `dd`, `u`, `H J K L`, and the key map. Round 02's check of
the page text, and its `…` rule, follow here. Settled while writing this spec:

- **The context's callout** is of any type, as your review asked, not only `NOTE` as the
  [context answer](clarifications-01.md#q4-how-is-a-columns-context-written-in-prioritiesmd) read.
- **The next feature** gets the answers on keys: `o` inserts after the line and `O` before it, `H L`
  put a line at the same row of the next column, and the editing keys are a layer on the shared list
  keys, on for these two pages, with a `?` map. Its keys are declared as data a later leader key
  reads
  ([round 01](clarifications-01.md#q9-how-do-the-vim-keys-and-the-key-map-relate-to-the-other-lists-and-to-the-leader-key)).
- **Enter** opens the overlay, and no longer edits an item. Editing a line is in the overlay, as in
  the old pane, until the next feature adds `i` and `a`.
- **Keyboard dragging** is dropped with the handle. The menu's moves, and later `J K H L`, replace
  it.
- **The overlay's size** is 108 characters of the page's font wide, about 1,060 px, and 60% of the
  window tall, and it is the same overlay for notes and priorities.
- **The mockups** are the stories above, with the real components: the HTML pages that came first
  are deleted.
- **Later's callout**, malformed in the project's own file, is fixed by the human on the default
  branch, since the file lives there. The warning tells them.
- **The two files' edits** stay written at once and committed from the commit bar, as today.
- **A new category** goes at the end of the file, and a heading is never reordered here.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: it changes the format of `PRIORITIES.md` for every project, with a warning and no
conversion, and adds edits to `INBOX.md`.

## History

> [!NOTE]
>
> Changes requested on 2026-10-25: 4 comments in spec-review.md.
>
> - You approve the priorities as scrolling columns of draggable cards, the inbox as a pane per
>   category, a detail that opens in an overlay, a `…` menu on every line, and categories you
>   create, rename, and delete.
> - The vim keys and the key map are not here: you chose to build them as the next feature. This
>   spec keeps the movement keys, and adds `h l` between columns.
> - Blocked is retired from the file's format, the template, the skill, and `ura check`. A file that
>   still has lines under it keeps them visible, with a warning.
> - A section's context is the first `> [!NOTE]` callout under its heading, read-only in the app.
> - The mockups are HTML layout pages, not stories: the plan's first tasks write the stories, and
>   the decision on previews allows an HTML layout mockup only beside its story.
> - The overlay replaces the pane beside the list, which the layout decision prefers. Its own clause
>   lets a spec say why: four columns leave no room for a pane.
> - Risk tier `medium`: the format of `PRIORITIES.md` changes for every project.
