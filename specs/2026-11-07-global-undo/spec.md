---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Global undo

> [!IMPORTANT]
>
> Spec to review, about 15 minutes.
>
> - You approve one undo stack per tab, which takes back every edit to your lists and texts with `u`
>   or `Ctrl+Z`, redone with `U` or `Ctrl+Shift+Z`, and the new Undo decision behind it.
> - The new Undo decision: what every future write must make undoable, and that only what loses work
>   for good asks first.
> - `d` deletes at once, everywhere, as you agreed: no more `d d`. A category holding notes still
>   asks what to do with them.
> - An undo of a change committed since asks first, as your note asked, and writes the reverse as a
>   new change on the Git page.
> - On the phone, the toast's 5 seconds stay the only way to undo, as you chose: there is no status
>   line or key there.
> - Risk tier medium: about 15 writes gain a reverse, some new in the core, and every list's delete
>   changes.

Uraeda's pages each decide today whether an action has an Undo, for 5 seconds, or a question, or
neither. This feature gives the web UI one stack of the human's edits per tab, as the
[proposal](proposal.md) asks: `u` takes back the latest, `U` redoes it, and the line between what
can and cannot be undone becomes one rule. The research is in [discovery](discovery-01.md), and the
answers in [clarifications](clarifications-01.md).

## Decisions

- **New: [Undo](../decisions/undo.md)**. Every edit to your lists and texts can be undone, for the
  tab's life, without asking first; only what loses work for good asks, and an undo never rewrites
  git.

Relied on:

| Decision                                     | What it means for this spec                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [Keyboard](../decisions/keyboard.md)         | `u` and `U` are declared in the registry, and turned off with single keys     |
| [UI behaviour](../decisions/ui-behaviour.md) | A dialog only confirms what is irreversible; an undo takes you where it leads |
| [Git](../decisions/git.md)                   | An undo writes files, never a commit: the human commits on the Git page       |
| [Text editing](../decisions/text-editing.md) | Undo inside a field stays the editor's own history                            |
| [Preview](../decisions/preview.md)           | The mockups below are stories of the real components                          |

## User stories

### US1: Take back the latest edits with `u` (P1)

The human moves, indents, renames, or deletes rows of the inbox or the priorities, then presses `u`,
or `Ctrl+Z`, to take back the latest, one at a time, minutes later if they like.

[Deleted at once](/packages/web/src/layout/UndoMockups.stories.tsx#DeletedAtOnce)

Key scenarios:

1. **Given** "Color themes" in Next on the priorities, **When** the human presses `d` on it,
   **Then** the line goes without a question, and a toast reads "Deleted “Color themes” · waits on
   the Git page", with Undo and its key `u`.
2. **Given** the human moved "Spec comments" from Next to Now, then indented it under "Global undo",
   **When** they press `u` twice, ten minutes later, **Then** the first `u` outdents it, and the
   second puts it back in Next.
3. **Given** a note promoted to Now from the inbox, then a spec opened, **When** the human presses
   `u`, **Then** the inbox opens with the note back in its place and selected, and Back returns to
   the spec.

More scenarios:

1. **Given** the human removed a comment on a spec's review, **When** they press `u`, **Then** the
   comment is back under its block, with its text.
2. **Given** a review's Start over, **When** the human presses `u`, **Then** every comment it
   dropped is back.
3. **Given** a note with a note file deleted with `d`, **When** the human presses `u`, **Then** the
   note and its note file are back, as today.
4. **Given** 51 actions in the tab, **When** the human presses `u` 51 times, **Then** the first 50
   are taken back, and the last `u` does nothing.
5. **Given** a reload of the page, **When** the human presses `u`, **Then** nothing happens: the
   stack is empty.
6. **Given** the focus in a text field, **When** the human presses `Ctrl+Z`, **Then** the field's
   own typing is undone, and the stack does not move.

### US2: Redo with `U` (P1)

After an undo, the toast names what came back and offers Redo, and the status line shows `U redo`
for as long as there is something to redo.

[Undone, with Redo](/packages/web/src/layout/UndoMockups.stories.tsx#UndoneWithRedo)

Key scenarios:

1. **Given** the human undid the delete of "Color themes", **When** the undo lands, **Then** the
   toast reads "Undone: deleted “Color themes”", with Redo and its key `U`, and the status line
   shows `U redo`.
2. **Given** that state, **When** the human presses `U`, or `Ctrl+Shift+Z`, **Then** the line is
   deleted again, and `U redo` leaves the status line.
3. **Given** an undo, **When** the human then moves another row, **Then** there is nothing left to
   redo, and `U redo` leaves the status line.

More scenarios:

1. **Given** a redo, **When** it lands, **Then** the toast reads "Redone: deleted “Color themes”",
   with Undo and its key `u`.

### US3: An undo of a committed change asks first (P2)

Edits wait on the Git page until the human commits them. Undoing one that was committed since writes
a new change, so it asks first.

[Undo of a committed change](/packages/web/src/layout/UndoMockups.stories.tsx#UndoCommitted)

Key scenarios:

1. **Given** "Color themes" moved to Now, then committed on the Git page, **When** the human presses
   `u`, **Then** "Undo a committed change?" asks, naming the move, with Keep it (`n`) and Undo
   (`y`).
2. **Given** that question, **When** the human answers Undo, **Then** "Color themes" is back in
   Next, as a change waiting on the Git page, and nothing is committed.
3. **Given** that question, **When** the human answers Keep it, **Then** nothing changes, and the
   move stays at the stack's top.

### US4: An undo that cannot apply says why (P2)

Another tab, an agent, or a hand edit may change a file after the action. The undo then changes
nothing, and says so.

[Undo refused](/packages/web/src/layout/UndoMockups.stories.tsx#UndoRefused)

Key scenarios:

1. **Given** "Color themes" deleted, then a line of that name added again in another tab, **When**
   the human presses `u`, **Then** nothing is written, and "Could not undo: “Color themes” changed
   since in PRIORITIES.md." shows under the top bar until dismissed.
2. **Given** that refusal, **When** the human presses `u` again, **Then** the action before it is
   taken back: the refused one left the stack.

## Replaced behaviour

- **`d` asks "Delete this line?" or "Delete this note and its note file?" before deleting.** Guarded
  by `inbox-note-delete.test.tsx`: "d on a note with a note file asks, naming the file, and yes
  deletes both, which Undo brings back", "d on a note with a note file, answered no, keeps the note
  and its note file", and "d on a note without a note file asks as on any line". Also by
  `keys-row-editing.test.tsx`: "d deletes the line the focus is on, not the one edited before it",
  and "d on a note deletes it, not the note edited before it".
- **`u` works only while its toast is on screen.** Guarded by `undo-toast.test.tsx`: "an Undo that
  rejects shows its failure in the page", whose toast-scraping `u` goes.
- **A priorities row deleted with `d` has no Undo, and moves, indents, renames, comment removals,
  and Start over have none either.** No test guards their absence.

## Architecture

One undo stack per tab, in the web UI's memory, holds what the tab did. Each action pushes an entry
with its label, its place, and two functions, its undo and its redo. The reverses reuse the core's
hash-checked writes, which refuse once the file changed, never git's revert. See
[the code](discovery-01.md#important-reads).

- **The undo stack** keeps the tab's last 50 entries, and the redo side, which a new action clears.
  It owns the keys `u`, `Ctrl+Z`, `U`, and `Ctrl+Shift+Z`, and declares `U` only while a redo
  exists. It owns the toasts of undo and redo, and replaces `useUndoToast`'s toast-scraping `u`.
- **An entry** holds the action's label ("Deleted “Color themes”"), its place (the page and the key
  of what to select), its files, and the commit the default branch was at. It owns how to undo and
  redo its one action.
- **The committed check**, in the core, says whether a commit since the entry's commit touched the
  entry's files. The stack asks "Undo a committed change?" when it did.
- **The reverses**, in the core, one per kind of edit that lacks one: an outline row's edit, indent,
  drag, and move; a category's add and rename; a proposal's expand, rename, and section; and a
  comment's add, edit, remove, and Start over. Each refuses with the file's name once its file
  changed since.
- **The docs' undo section**, in [`docs/web-ui.md`](/docs/web-ui.md), lists what can and cannot be
  undone, and what asks first, as the Undo decision sets it.
- **The deletes** of the inbox's and the priorities' rows go at once, through their existing
  reverses, which already put lines and note files back.

Tradeoffs:

- A reload, or another tab, cannot undo what this tab did.
- Committing, starting, git, and settings actions keep no undo: a slip there is fixed by its own
  next step.

## Edge cases

| Importance | Situation                                                    | What happens                                                                        |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| High       | The file changed since the action                            | Nothing is written; "Could not undo: …" shows with the file's name                  |
| High       | The action was committed since                               | "Undo a committed change?" asks first; the undo is a change waiting on the Git page |
| High       | The focus is in a text field                                 | `u`, `U`, and `Ctrl+Z` stay the field's; the stack does not move                    |
| Normal     | The action's page is not the one open                        | The page opens with what came back selected; Back returns                           |
| Normal     | A category holding notes is deleted                          | It still asks whether to keep the notes, then its delete is undoable as today       |
| Normal     | Single-key shortcuts are off                                 | `u` and `U` do nothing; `Ctrl+Z` and `Ctrl+Shift+Z` still undo and redo             |
| Normal     | The stack is empty, or nothing is left to redo               | The key does nothing, and nothing shows                                             |
| Normal     | An undo's write is still on its way and `u` is pressed again | The second `u` waits for the first to land, in order                                |
| Niche      | The phone                                                    | The toast's Undo and Redo, by tap, for 5 seconds; no status line hint               |
| Niche      | The thing the action concerned was deleted on another page   | The undo refuses, as any changed file                                               |

## Success criteria

- **SC-001** (one key): Deleting a row of the inbox or the priorities takes one key, `d`, with no
  question.
- **SC-002** (coverage): Every write listed in the Undo decision's first rule has an undo and a
  redo, checked by a UI test per kind of write.
- **SC-003** (reach): The 50th action back in a tab is undone after any time, with no toast on
  screen.
- **SC-004** (no history rewritten): No undo or redo ever runs a git command that commits, resets,
  or reverts.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Your
note changed one: an undo after a Git-page commit now asks first. Settled while writing this spec:

- **`Ctrl+Z` is `Cmd+Z` on a Mac**, and `Ctrl+Shift+Z` is `Cmd+Shift+Z`, as `Ctrl+Enter` is already.
- **A redo of a committed undo asks too**, with the same question, for the same reason.
- **A row's text edit is one entry**, saved as the row is left, not one entry per keystroke.
- **The draft a line's Start replaced** joins the stack, as the one action held by the browser.
- **The take-out of a note or a line after a start** stays out of the stack: it is part of the
  start's commit.
- **`u` gets no hint in the status line**, as today: only `U redo` shows, as you asked.
- **A category holding notes keeps its question**: it asks what to do with the notes, not whether to
  delete, so the new rule against confirmations leaves it.
- **The unused `closeUndoToasts`, and the toast's unused committing mode**, are removed.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

The stack lives in the tab's memory, which the third principle allows for temporary state: every
undo writes plain files, and nothing durable depends on it.

## Risk tier

**Medium**: no stored format changes, but about 15 writes gain a reverse, and every list's delete
changes its behaviour.
