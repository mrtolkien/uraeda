---
status: answered
---

# Clarifications, round 01: Inbox and priorities in the terminal look

> [!NOTE]
>
> Answered on 2026-10-25.
>
> - Verdict: worth building, with changes: the pages and keys are worth it. The detail pane cannot
>   stay beside four columns, and the work is likely too large for one spec.
> - Size of the work: the split into this feature and a keyboard feature.
> - The inbox's look and the detail pane's place, which decide how the pages differ and how wide the
>   columns stay.
> - A format for a column's context in `PRIORITIES.md`, which every project's file will follow.
> - Categories: creating and deleting them needs new work in the core.
> - Settled points to check: Enter opening the detail, and the context being read-only in the app.

## Context

### Goal

You want the inbox and the priorities redrawn in the terminal look, as two views that differ on
purpose. The inbox is freeform, and the priorities are opinionated, in columns. You want a context
line for each column written in `PRIORITIES.md`. You also want vim-like keys with a shortcut map,
because you still open nvim for these pages.

### Today

- Both pages are one shared vertical list of sections, with drag handles, a detail pane that follows
  the selection, and the keys `j k ⏎ esc`. See [`WorkList`](/packages/web/src/lists/WorkList.tsx)
  and [`useListKeys`](/packages/web/src/lists/useListKeys.ts).
- The app ignores any text under a priorities heading. Your file already has `> [!NOTE]` callouts
  there. See [`priorities.rs`](/crates/core/src/files/priorities.rs).
- The inbox shows only categories that hold notes. Nothing creates, renames, or deletes a category.
- A row's actions live in the pane: Category, Organize, Delete with Undo.

| Product         | Move a card                                              | Add                        | Menu to move          |
| --------------- | -------------------------------------------------------- | -------------------------- | --------------------- |
| GitHub Projects | A move mode: Enter, arrows, Enter                        | Not read                   | Item menu (changelog) |
| Trello          | `<` `>` to the top of the next list, `, .` to the bottom | Not read                   | Not read              |
| Todoist         | Not by keys alone                                        | `a` below, `Shift+A` above | `v` opens it          |

None has vim's `o O i a dd`, and none uses columns for a capture list.

### Scope

In: the two pages' new look, columns on wide and semi-wide screens, and a list on the phone. Also
in: the context lines, categories you can create and delete, the row actions, the keys, and a key
map. Out: the questions and spec pages, the home, the triage agent's flow, and any global leader key
unless you pick it below.

### Sources

- The code: [`InboxPage.tsx`](/packages/web/src/InboxPage.tsx),
  [`PrioritiesList.tsx`](/packages/web/src/lists/PrioritiesList.tsx),
  [`Panes.tsx`](/packages/web/src/layout/Panes.tsx),
  [`inbox_edits.rs`](/crates/core/src/api/inbox_edits.rs).
- The products:
  [GitHub's shortcuts](https://docs.github.com/en/enterprise-server@3.19/get-started/accessibility/keyboard-shortcuts),
  [Todoist's keyboard guide](https://todoist.com/help/articles/4407513458834), and Trello's, from
  search summaries only.
- The decisions: [UI behaviour](/specs/decisions/ui-behaviour.md) and
  [UI layout](/specs/decisions/ui-layout.md).
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **Enter opens the detail** on a selected line, and `i a I A` edit it in place. Today Enter edits
  the open pane's item. Enter now opens the pane because the pane no longer follows the selection.
  See [the detail pane](discovery-01.md#the-detail-pane).
- **A column's context is written in the file only.** The app shows it and does not edit it: you
  write it in `PRIORITIES.md`, in nvim or the editor page. Editing it in the app is a later feature.
  See [context of a column](discovery-01.md#context-of-a-column).
- **`dd` deletes at once, and `u` undoes the last delete or move**, as the notes' toast Undo does
  today. A running priority refuses `dd` and moving, with a message. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **Each page says what it is for, in one line under its title**, written by the app and not in the
  file, so a new reader sees what goes in the inbox and what is a priority. The copy is mine:
  "Things noticed, not decided: turn each into a priority, a draft, or nothing." for the inbox, and
  "What is worked on, in order: Ongoing runs now, then Now, Next, and Later." for the priorities.
  See [two views](discovery-01.md#two-views-extremely-different).

## Q1: Should the keyboard and the key map be a second feature?

The spec this round leads to would hold seven stories. They are the inbox look, the priorities
columns, the column context, categories, row actions, the vim keys, and the key map. The keys alone
have more than ten scenarios. The workflow proposes a split past 6 stories or 30 scenarios. A larger
spec cannot be approved in one sitting. More in
[size of the work](discovery-01.md#size-of-the-work).

Why it matters: it decides whether you get the new pages first and the vim keys right after. The
other way is everything at once, in a spec that may take a long sitting to approve.

The questions about the keys below are asked now either way, so you answer only once.

- **A (recommended). Build the views, the context, the categories, and the row actions here. The vim
  keys and the key map become the next feature.**
  - [pro] each spec is approved in one sitting, and the pages are usable sooner.
  - [con] the two features change the same lists, so the second rebases on the first.
  - Why recommended: it keeps both specs inside the rule.
- **B. Build everything in this feature.**
  - [pro] the keys arrive with the pages, as the proposal reads.
  - [con] a spec past the split rule, and a later review of a larger pull request.

**Answer:** A and B

## Q2: How should the inbox look, next to the columns of the priorities?

The priorities are opinionated, so they take four columns. The inbox is freeform, so it should read
as something else at a glance. All three looks keep notes whole, their sub-lines and tags shown, and
keep drag.

Example: your inbox today has a note with a link and a sub-line, and three notes under "UI". Each
option shows them differently.

- **A (recommended). A pane per category, stacked in one column, each with its title in the border
  and its notes whole.**

  Panes by category (`mockups/inbox-a-panes.html`, deleted)

  - [pro] it matches the file's own structure, works as one column on the phone, and looks nothing
    like the priorities' columns.
  - [con] a long inbox is a long page.
  - Why recommended: it differs from the columns by shape, and categories are the only structure the
    inbox has.

- **B. The file drawn as a buffer: line numbers, `## UI` headings as lines, notes as bullets.**

  The file as a buffer (`mockups/inbox-b-buffer.html`, deleted)

  - [pro] the closest to nvim, where you manage the inbox now.
  - [con] reads as raw markdown, less readable for long notes, and tags and images fit badly.

- **C. An index of categories on the left and one category's notes on the right.**

  Index and one category (`mockups/inbox-c-index.html`, deleted)

  - [pro] short pages, and `h l` moves between categories.
  - [con] one category at a time hides the rest, and the phone needs two pages.

**Answer:** A

## Q3: Where does the detail open, now that the priorities have four columns?

Today a pane opens beside the list at up to 40% of the width and follows the selection. On a half
screen (1205 px) that leaves four columns of about 170 px each. See
[the pane against four columns](discovery-01.md#the-pane-against-four-columns). The layout decision
says a glanced-at detail SHOULD open beside its list.

Why it matters: it decides how wide the columns stay and what Enter does, for both pages.

- **A (recommended). Open the detail only on Enter or a click, and never follow the selection. It
  opens beside the page on wide screens, and as a page of its own on semi-wide and narrow ones.**
  - [pro] columns keep their full width while you move, and it follows the layout decision where
    there is room.
  - [con] on a half screen the detail replaces the page, and Back returns.
  - Why recommended: movement in two dimensions cannot drive a pane, and the half screen has no
    room.
- **B. Keep the pane beside the page at every size, following the selection.**
  - [pro] nothing changes for what you know.
  - [con] columns of 170 to 225 px, and the pane reopens on every `h j k l`.
- **C. Drop the pane: everything is inline.**
  - [pro] full width always.
  - [con] images, Start, and the draft editor have no place, so this costs features.

**Answer:** A: Could we use a modal/overlay to see a single line?

That's how I show a lot of content in nvim, might be easier. I want a few mockups.

Also the 4 content columns could be scrollable: it's ok if "Later" is not fully visible when we open
the page for example.

## Q4: How is a column's context written in `PRIORITIES.md`?

Example: under `## Now`, the line "Features for v1.0.0" says what Now means for this project right
now. Your file already does this with a callout, and the app ignores it today. One callout is
malformed: `## Later` has a marker line and its text apart. See
[context has no format](discovery-01.md#context-in-the-file-has-no-format).

Why it matters: every project's file follows this, and the skill, its template, and the example must
say it, so it lasts beyond this feature.

- **A (recommended). The first `> [!NOTE]` callout under a section's heading, shown above the
  column.**
  - Example: `## Now`, a blank line, `> [!NOTE]`, `>`, `> Features for v1.0.0`.
  - [pro] it is what you already write, it renders on GitHub, and it cannot be mistaken for an
    entry.
  - [con] a malformed callout, like Later's today, shows nothing until fixed.
  - Why recommended: no file you have changes, and the rule is one sentence.
- **B. Any paragraph under the heading, before the first entry.**
  - [pro] the lightest to write.
  - [con] every stray sentence becomes context, and your callouts would change meaning.
- **C. A `context:` line in front matter, per section.**
  - [pro] easy to parse.
  - [con] a new structure, harder to read and edit in the file.

**Answer:** A

## Q5: Where does Blocked go?

The file has four sections: Now, Next, Later, and Blocked. You named Ongoing, Now, Next, and Later.
Ongoing is not in the file: it lists the running entries.

Why it matters: it decides whether a blocked priority stays visible.

- **A (recommended). A pane under the columns, shown only when Blocked has a line, and reachable by
  `j` from the last row.**
  - [pro] columns keep their width, and a blocked line cannot go unseen.
  - [con] a line cannot be moved into an empty Blocked from the keys until it exists, so the row
    menu offers "Move to Blocked".
  - Why recommended: Blocked is rare, and a fifth column would cost every other one a fifth.
- **B. A fifth column.**
  - [pro] every section is always there and a target for `L`.
  - [con] each column loses a fifth of its width.
- **C. Not shown in the app, kept in the file.**
  - [pro] the simplest.
  - [con] blocked work disappears from the page that exists to order it.

**Answer:** Let's dropped the "Blocked" category actually: a blocked feature should just be moved
after the feature it needs, in the right category.

## Q6: Where do a row's actions appear?

Example: a note "Prompts: add a model selector" can become a priority in Now. It can also go into a
draft, become its own draft, change category, or be deleted. A priority can move to another section,
to the top or bottom, become a draft, start, or be deleted.

Why it matters: actions behind a pane cost a tap and a page load for each note you organize. The
[UI behaviour decision](/specs/decisions/ui-behaviour.md) does not allow hover alone.

- **A (recommended). A "…" menu button at the end of every row, always visible, holding the actions,
  plus a key that opens it on the selected row.**
  - [pro] works by tap and by keyboard, and the same menu serves both pages.
  - [con] one more control per row.
  - Why recommended: it is the touch path to everything the keys do.
- **B. The menu only on the selected row.**
  - [pro] a quieter list.
  - [con] a phone needs a tap to select, then a tap on the menu.
- **C. Actions only in the pane.**
  - [pro] nothing new to build.
  - [con] the slowest way to organize notes.

**Answer:** A

## Q7: What does deleting a category do to its notes?

Example: "UI" holds three notes. You delete the category.

Today a category with no notes is hidden, so you cannot create one in the app. The new view shows
empty categories, with a "New category" row, so a category can exist before its first note. More in
[categories](discovery-01.md#categories).

Why it matters: a delete that loses notes is the one irreversible-looking action on these pages.

- **A (recommended). The three notes move to "No category", in the same order, and an Undo toast
  puts the category back.**
  - [pro] nothing is lost, and Undo is exact.
  - [con] a category with 40 notes lands 40 notes in "No category".
  - Why recommended: it matches how the inbox already treats a note without a category.
- **B. Delete refuses while the category has notes.**
  - [pro] cannot lose anything.
  - [con] you move notes out one by one first.
- **C. The category's notes are deleted with it, and Undo restores all.**
  - [pro] one action for a category you no longer want.
  - [con] the most destructive default, one key from losing notes.

**Answer:** Ask the user? It's the simplest by a lot.

"Delete category -> do you also want to delete notes: Y/N"

## Q8: Should categories also be renamed and reordered?

Creating and deleting need new core operations. Renaming changes one heading line. Reordering moves
a whole block of lines, which no operation does today.

- **A (recommended). Create, delete, and rename.**
  - [pro] covers fixing a typo or a better name, for little extra work.
  - [con] categories keep the file's order, which you change in nvim.
  - Why recommended: renaming is cheap, and reordering is the costly part.
- **B. Create, delete, rename, and reorder with `J K` on a category's title.**
  - [pro] full control from the page.
  - [con] a new core operation for a rare action.
- **C. Only create and delete.**
  - [pro] the least work.
  - [con] a wrong name means delete and move every note.

**Answer:** A

## Q9: How do the vim keys and the key map relate to the other lists and to the leader key?

Your Now list has a "Leader key/shortcut map" item. The decisions page and these two pages share
`useListKeys`, and the UI behaviour decision says lists whose rows open a pane SHOULD share one
keyboard behaviour. See [the keys' scope](discovery-01.md#the-keys-scope-and-the-key-map).

Example: `dd` deletes a line on the inbox. On the decisions page, whose rows cannot be edited, `dd`
does nothing.

Why it matters: it decides whether the keys are one behaviour with editing keys on top, or a second
keyboard to maintain.

- **A (recommended). The editing keys are a layer on the shared list keys, on for these two pages
  only. `?` opens a key map of the page, drawn from the same declarations as the status line.**
  - [pro] the shared behaviour stays one place, and a later leader key reuses the declarations.
  - [con] the shared hook grows, and gets split.
  - Why recommended: it keeps the decision and gives the map you asked for.
- **B. A separate keyboard for these two pages.**
  - [pro] free to follow vim exactly.
  - [con] breaks the shared-keys decision and copies the movement keys.
- **C. Build the global leader-key map here.**
  - [pro] one feature for all keys.
  - [con] it takes the Now item over, with a scope far beyond two pages.

**Answer:** A: It's `dd` and not `Dd` to delete a line btw

Make sure the way you implement this makes it easy to interface with the leader key/global shortcut
map later

## Q10: Where does a line land when it moves to another column?

Only with the keys in this feature, see Q1. Example: "Empty inbox" is the 4th line of Now. You press
`L` to move it to Next, which has 9 lines.

Why it matters: it decides whether `L` keeps your eye in place or reorders the target.

- **A (recommended). At the same row, or last when the target is shorter: the 4th line of Next.**
  - [pro] the line stays where your eyes are, and `J K` adjust it.
  - [con] it lands in the middle of Next's order.
  - Why recommended: it is vim's own `h l` and two keys finish any move.
- **B. At the top of the target column.**
  - [pro] predictable, like Trello's `<`.
  - [con] a line moved to Later lands at its top, which says "most important of Later".
- **C. At the bottom of the target column.**
  - [pro] predictable, like Trello's `.`.
  - [con] a line moved to Now lands at the end of the most urgent list.

**Answer:** A

## Q11: Which way do `o` and `O` insert?

You wrote "o/O should insert a new line before/after". In vim, `o` opens a line below and `O` above,
the reverse order. See [`o/O`](discovery-01.md#oo-insert-a-new-line-beforeafter).

Why it matters: your fingers know vim's order, and the wrong one would be wrong every time.

- **A (recommended). Vim's: `o` inserts after the selected line, `O` before it.**
  - [pro] what your muscle memory expects, and what the keys do in nvim.
  - [con] differs from your sentence, read literally.
  - Why recommended: you asked for vim-like behaviour.
- **B. As you wrote: `o` before, `O` after.**
  - [pro] follows the sentence.
  - [con] the reverse of vim, and of nvim where you use them now.

**Answer:** A

## Settled without the human

### Behaviour

- **Columns by width**: Ongoing, Now, Next, and Later on wide and semi-wide screens. The phone gets
  a vertical list, as you chose in the layout feature. See
  [how the priorities look](discovery-01.md#how-the-priorities-look).
- **Ongoing** is built from the running entries and has no handles. Its lines cannot be moved or
  deleted. The app writes its context: "Running now: an agent works or waits on you."
- **An empty column** shows its context and its Add row, so a line can always be added.
- **Moving by keys inside columns**: `j k` and arrows move within a column, and `h l` go to the same
  row of the next column. `H J K L` move the line, as you asked.
- **Inline edit keys**: `i` and `I` put the cursor at the start of the line, `a` and `A` at the end.
  The field is the existing in-place edit, so Enter saves and Escape cancels.
- **`o` and `O`** open an empty line, and Enter saves it and opens the next, like an Add row. Escape
  closes it and leaves no empty line in the file.
- **Dragging** stays, with its handles, and the inbox's "Organize with an agent" and its banner
  stay.
- **Keys never act** in a text field, a menu, or a dialog, as today, and the status line names only
  keys that work.

### Under the hood

- **Writes from held keys** queue in order, each over the hash of the last write's result, so `J`
  held down never meets a conflict with itself. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **The stacked list** is extracted from `WorkList.tsx`, over the size limit, instead of grown, and
  the home keeps using it. See [the code](discovery-01.md#important-reads).
- **The core owns the context** as a new field of each section. The binding and the server only pass
  it on, so every front end follows one rule.
- **No new dependency**: dnd-kit's keyboard sensor and Astryx's `Kbd` and `MoreMenu` cover the
  moves, the map, and the menu. See
  [libraries](discovery-01.md#astryx-and-the-projects-own-components).
- **The prototypes** in `mockups/` are throwaway: the approval of the spec deletes them.

**Notes:**

- **Columns by width**: As I said earlier: it's ok to overflow horizontally a bit

  It's important that text is easily readable, so use the current priorities as example in the
  mockups.

- **Dragging**: I don't like the handles: todoist doesn't have any

  Coupled with the `...` that would become very busy

  I'd rather have small, simple to read cards, always draggable, and with `...` appearing on hover
