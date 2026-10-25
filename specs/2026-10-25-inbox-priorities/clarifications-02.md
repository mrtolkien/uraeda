---
status: awaiting-human
---

# Clarifications, round 02: Inbox and priorities in the terminal look

> [!IMPORTANT]
>
> 2 questions, about 10 minutes.
>
> - Verdict: worth building, with changes: your answers settled the design, and two points need you
>   once more.
> - The split: you answered "A and B", which exclude each other.
> - The overlay's shape: three prototypes, as you asked for mockups.
> - Settled points to check: Blocked retired, a hover `…`, and the category delete's question.

## Context

### Since the last round

In [round 01](clarifications-01.md) you answered "A and B" to whether the keys are a second feature.
You answered the detail's place with an overlay, and asked for a few mockups. Your notes also asked
for cards with no handle, columns that may overflow sideways, and a question before deleting a
category. You dropped Blocked. This round asks the two points those left open.

### Goal

The inbox and the priorities in the terminal look, with an overlay to read a single line, and vim
keys. See [round 01's goal](clarifications-01.md#goal).

### Today

- A detail opens in a pane beside the list, and follows the selection.
- The app has a shared overlay: a dialog on wide screens, and a bottom sheet on narrow ones. See
  [`Overlay.tsx`](/packages/web/src/layout/Overlay.tsx).
- GitHub Projects opens a card in a side panel on the right of the board. Linear's Peek previews a
  card over its list, on Space. Both from search summaries.

### Scope

The same as round 01, with Blocked retired and the detail an overlay.

### Sources

- The code: [`Overlay.tsx`](/packages/web/src/layout/Overlay.tsx),
  [`App.tsx`](/packages/web/src/App.tsx), [`WorkList.tsx`](/packages/web/src/lists/WorkList.tsx).
- The decisions: [UI layout](/specs/decisions/ui-layout.md) and
  [UI behaviour](/specs/decisions/ui-behaviour.md).
- The full investigation is in [discovery](discovery-02.md).

## Check these

- **Blocked is retired.** The template, the skill, `ura check`, and the app drop the section. A file
  that still has `## Blocked` with lines keeps them. The app shows them in a pane under the columns,
  and `ura check` warns "Blocked is retired: move its lines". An empty `## Blocked` is ignored. See
  [what the answers changed](discovery-02.md#what-the-answers-changed).
- **The `…` menu shows on hover, on the selected card, on keyboard focus, and always on a touch
  screen.** Your note asked for hover. The UI behaviour decision forbids hover alone, so the other
  three keep every action reachable. See
  [the proposal's path](discovery-02.md#the-proposals-path-and-existing-actions).
- **Deleting a category asks "Delete the notes too?"** with Yes, No, and Cancel. No moves the notes
  to "No category", in order. An Undo toast follows either. This is the Y/N you asked for.
- **A card is the whole line, wrapping, and it drags from anywhere.** A move of a few pixels is a
  click that opens the overlay. A touch drags after a press of half a second, as today.
- **The key map is one list of declared keys.** The status line, the `?` map, and later a leader key
  read it. Nothing reads keys from the page's code twice.

## Q1: Is the keyboard a second feature, or part of this one?

You answered "A and B", which exclude each other. A reading of "both" is one feature whose keys come
in a second spec, which is A. Pick one letter, or say what you meant. See
[the split](discovery-02.md#the-split).

Why it matters: it sets what this spec covers. A has five stories. B has seven, past the workflow's
limit of six, so one sitting may not be enough to approve it.

- **A (recommended). Build the views, the context, the categories, the overlay, and the row actions
  here. The vim keys and the key map become the next feature.**
  - [pro] each spec is approved in one sitting, and you get the pages sooner.
  - [con] the second feature changes the same lists and rebases on the first.
  - Why recommended: it keeps both specs inside the limit. The design leaves a place for the keys,
    so nothing is rebuilt.
- **B. Build everything in this feature.**
  - [pro] the keys arrive with the pages.
  - [con] a spec past the limit, and a larger pull request to review.

**Answer:**

## Q2: How big is the overlay that shows a single line?

Example: the line "Neovim plugin: an "open priorities/inbox" shortcut, and review its shortcuts..."
has two sub-lines. Enter on it opens the overlay, with its actions, Previous and Next, and Close.
The URL keeps what is open, and Back closes it. On the phone it is a bottom sheet, whichever you
pick.

Why it matters: it sets how much of a long note, a draft, or images you read in the overlay. It also
sets how much of the board you still see.

- **A (recommended). A dialog about 34 characters wide, centred, over the dimmed page.**

  [A dialog](mockups/overlay-a-dialog.html)

  - [pro] it reuses the shared overlay, shows the board behind, and a short line needs no more.
  - [con] a long note and its images scroll in a narrow box.
  - Why recommended: most lines are short, and it is the least new code.

- **B. A large float, over most of the window, like an nvim floating window.**

  [A large float](mockups/overlay-b-large-float.html)

  - [pro] room for a long note, its draft, and images.
  - [con] it hides the board, and a short line floats in a large empty box.

- **C. A drawer on the right edge, over the dimmed page.**

  [A drawer](mockups/overlay-c-drawer.html)

  - [pro] it keeps most of the board in view, like GitHub's side panel.
  - [con] it needs Astryx's `Drawer`, which the shared overlay does not use, and it covers the
    right-most column.

**Answer:**

## Settled without the human

### Behaviour

- **The columns** scroll sideways when the window is narrower than four columns of at least 300 px.
  A column may then be cut at the edge. See the
  [prototype of the columns](mockups/priorities-columns-scroll.html), which uses your current
  priorities' text.
- **Previous and Next** stay in the overlay, as the old pane's did, stepping through the column, or
  the category, the line is in.
- **The inbox** is a pane per category, as you picked, and each category shows its notes whole.

### Under the hood

- **The overlay** is the shared `Overlay`, with a width, on the routes `/priorities/<key>` and
  `/inbox/<key>`. The page behind it stays drawn.
- **The mockups of the spec** are stories with the real components. The prototypes in `mockups/` are
  throwaway, and the approval of the spec deletes them.

**Notes:**
