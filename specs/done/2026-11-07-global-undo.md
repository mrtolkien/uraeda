---
kind: feature
finished: 2026-11-08
pull-request: https://github.com/mrtolkien/uraeda/pull/108
supersedes: [2026-10-12-ui-improvements]
superseded-by:
  - 2026-11-07-keyboard-nav
---

# Record: Global undo

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-08, in [its pull request](https://github.com/mrtolkien/uraeda/pull/108). Its full files
> are in git: `git log -- specs/2026-11-07-global-undo/`.
>
> Superseded in part by [2026-11-07-keyboard-nav](2026-11-07-keyboard-nav.md).

## What and why

Each page of the web UI decided on its own whether an action had an Undo for 5 seconds, a question,
or neither: the same delete asked on one page and not on another, and some actions lost typed text
without a word. The human asked for one undo stack for the whole UI, `u` to undo as in Neovim and
`U` to redo, and a plain line between what can and cannot be undone. The web UI now keeps one stack
of the human's edits per tab, and the new [Undo](../decisions/undo.md) decision sets the rule every
future write follows.

## Behaviour

- **Undo with `u` or `Ctrl+Z`** (`Cmd+Z` on a Mac), outside text fields: the tab's latest edit comes
  back, one at a time, for as long as the tab stays open, up to the last 50; a reload or another tab
  starts empty. Inside a text field, the keys stay the editor's own history.
- **Redo with `U` or `Ctrl+Shift+Z`**: `U redo` shows in the status line only while there is
  something to redo, and a new action clears it; `u` has no hint. With single keys off, `u` and `U`
  go and the chords stay.
- **What can be undone**: every edit to the inbox and the priorities (adds, edits, deletes, moves,
  indents, drags, a note's category), categories, the promotions of notes, images added to or
  removed from notes and proposal files, the proposal pane's rename, section, delete, and expand,
  the sidebar's adds, review comments (added, edited, removed, Start over, on specs and mockups),
  and the draft a line's Start replaced on the New page. Committing, starting, git, and settings
  actions, saves typed in an editor, a round's answers and settled comments, and images attached in
  a comment's form stay out.
- **Toasts**: each action but a move shows its label for 5 seconds, "Deleted “Color themes” · waits
  on the Git page", with Undo and its key `u`; an undo shows "Undone: deleted “Color themes”" with
  Redo and `U`, a redo "Redone: …" with Undo. On the phone the toast is the only way, by tap, with
  no key shown.
- **`d` deletes at once**, with no question, in the inbox and the priorities; a second `d` deletes
  the next row. A category holding notes still asks what to do with its notes.
- **A run of moves is one step**: moves of one list of one repository, each less than a second after
  the last, join one entry, named and placed after its first move, with no toast.
- **The trip back**: an undo or a redo opens the page, in the repository, where the action happened,
  with what came back selected, as a new history entry so Back returns; on the page already open, it
  only selects.
- **A committed change asks first**: an undo, or a redo, of a change committed since asks "Undo a
  committed change?" (Keep it `n`, Undo `y`); its answer writes the reverse as a change waiting on
  the Git page, never a commit.
- **A changed file refuses**: once any file of the change no longer holds what the action left,
  nothing is written, "Could not undo: “Color themes” changed since in PRIORITIES.md." shows under
  the top bar until dismissed, and the entry leaves the stack. A lost connection keeps the entry. An
  undo or a redo of a feature's file is refused while its agent works.

## Design

Every undoable write is recorded by the core as a **change**: the bytes of each regular file under
the write's scope before and after it, taken under the repository's write lock, with the commit its
checkout was at. Undo writes the `before` side back only while every file still holds the `after`
side, and redo the reverse, all or nothing, without any git command. One mechanism gives every kind
of write its undo and its redo.

- **The change**, [`crates/core/src/actions/change.rs`](/crates/core/src/actions/change.rs), and its
  API, [`crates/core/src/api/undo.rs`](/crates/core/src/api/undo.rs): `recorded` and
  `recorded_keeping`, `apply_change`, `committed_since`, and the scopes (`INBOX`, `NOTES`,
  `PRIORITIES`, `PROMOTION`, `RELINKING_PROMOTION`, `EXPAND`, `NOTE_IMAGES`, `MARKDOWN`, a review
  file, an attached image's folder). A file kept with a change (an image's removal) comes back on
  undo when a commit's cleanup deleted it.
- **The write lock**, [`crates/core/src/cache.rs`](/crates/core/src/cache.rs), is re-entrant on its
  thread, so the snapshot, the write, and the diff are one critical section.
- **The binding**, [`crates/binding/src/undo.rs`](/crates/binding/src/undo.rs): each undoable write
  takes a last optional token, and `takeChange` hands over the change recorded under it, base64.
- **The server**,
  [`packages/server/src/fate/undo-mutations.ts`](/packages/server/src/fate/undo-mutations.ts): each
  undoable mutation answers its `change`; `undo.apply` and `undo.committed` replay and check it,
  refusing a feature's file while its agent works.
- **The stack**, [`packages/web/src/undo/stack.ts`](/packages/web/src/undo/stack.ts): the order, the
  limit of 50, the redo side, the run of moves, one replay at a time, and an epoch that keeps an
  entry recorded during a replay out of it.
- **The undo layer**, [`packages/web/src/undo/`](/packages/web/src/undo/): `useUndo` records and
  toasts, `changeEntry` builds an entry from a change, `UndoKeys` owns the keys, the toasts after a
  replay, the committed question, the refusals, and the trip; `pageErrors.ts` holds the refusals.
- **The pages** build their entries next to their writes:
  [`inboxUndo.ts`](/packages/web/src/inboxUndo.ts),
  [`lists/prioritiesUndo.ts`](/packages/web/src/lists/prioritiesUndo.ts),
  [`attach/attachUndo.ts`](/packages/web/src/attach/attachUndo.ts),
  [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts), and
  [`newDraft.ts`](/packages/web/src/newDraft.ts).
- **The docs**: [`docs/web-ui.md`](/docs/web-ui.md#undo), and the UI guides
  [Surfaces](/specs/ui/surfaces.md#undo) and [Keyboard](/specs/ui/keyboard.md).

## Replaced behaviour

- **`d` asked "Delete this line?" or "Delete this note and its note file?" before deleting.**
  Guarded by `inbox-note-delete.test.tsx`'s three tests, now one, "d on a note with a note file
  deletes both at once, which u brings back", and by `keys-row-editing.test.tsx`'s "d deletes the
  line the focus is on, not the one edited before it" and "d on a note deletes it, not the note
  edited before it", which no longer answer a question.
- **`u` worked only while its toast was on screen.** Guarded by `undo-toast.test.tsx`'s "an Undo
  that rejects shows its failure in the page", removed.
- **A priorities row deleted with `d` had no Undo, nor did moves, indents, renames, a comment's
  removal, or Start over.** No test guarded their absence.
- **The per-kind reverses**, replaced by the recorded change, went with their tests:
  `crates/core/tests/inbox_undo.rs` whole; in `categories.rs`, "delete then restore gives the file
  back byte for byte" and "a restore over a changed file is refused and writes nothing"; in
  `inbox_actions.rs`, "remove then insert restores the bytes", "inserting no line is refused", "undo
  of a committed note commits the removal", "undo of an agent's note removal restores its file", and
  "… elsewhere links its file"; in `inbox_image_removal.rs`, "undo keeps other edits and refuses a
  changed place"; in `inbox_images.rs`, "undo takes back the note and its untouched note file",
  "undo keeps a note file typed in and is refused once the note is gone", and "a promoted note file
  edited since goes back as it is"; in `inbox_merge.rs`, "undo keeps a new proposal file typed in";
  in `priorities.rs`, "insert puts a removed line back with its nested lines", "insert past the end
  appends and a stale hash is refused", "undo of a committed add commits the removal", "undo after
  the file changed is refused", and "undo over a staged change is refused"; and the server's "puts a
  removed proposal back" (`fate.test.ts`) and "an Undo of each move puts both files back in one
  call" (`inbox.test.ts`).

## Gotchas

- **The stack's method is `record`, not `push`**: the linter's fix, run by the commit hook, merges
  two calls of a method named `push` into one, taking it for an array's
  ([`stack.ts`](/packages/web/src/undo/stack.ts)).
- **The stack's default clock is `() => Date.now()`**, not `Date.now` itself, so a test's faked
  `Date` reaches it ([`stack.ts`](/packages/web/src/undo/stack.ts)).
- **The UI tests scope each toast and dialog query to its own element**: happy-dom never ends exit
  transitions, so closed toasts and dialogs stay in the page
  ([`undo-toast.test.tsx`](/packages/web/src/__tests__/undo-toast.test.tsx)).
- **An editor's image is recorded once the save of its links lands**: the editor saves the links
  through `text.save`, which records no change, so the entry joins it by reading the file on its
  first undo ([`attachUndo.ts`](/packages/web/src/attach/attachUndo.ts)).
- **In the sandbox, the dev server's first load can reload the page** while it optimizes its
  dependencies, which empties the tab's stack.

## Questions

### Round 01

#### Q1: Which actions can `u` take back?

**Answer:** A: every edit to the human's lists and texts that waits on the Git page (the inbox, the
priorities, proposals, categories, images, and review comments); committing, starting, git, and
settings stay out.

#### Q2: How far back can `u` reach?

**Answer:** A: as long as the tab stays open, up to the last 50 actions; a reload empties it.

#### Q3: Which keys redo?

**Answer:** A and C: `U`, and `Ctrl+Z` and `Ctrl+Shift+Z` outside text fields too.

#### Q4: Which actions without undo ask before they run?

**Answer:** A: only what loses work for good; actions whose button names what they do run at once.

#### Q5: Does a delete that can be undone still ask first?

**Answer:** A: delete at once, with an undo: "Dd disappears and becomes d, right? I’m down with it".

#### Q6: What does `u` do when the action happened on another page?

**Answer:** A: undo it, then go to that page and select what came back; Back returns.

#### Q7: How do you see what can be undone?

**Answer:** C, only the toast and the docs, "but show U in the status bar when a redo is possible".

#### Q8: Where do these rules live?

**Answer:** A: a new Undo decision.

#### Notes

- **An undo after a Git-page commit**: "The undo should have a validation dialog then, a new write
  is a big change".

## Decisions

- [Undo](../decisions/undo.md), new: every edit to the human's lists and texts can be undone for the
  tab's life without asking first; only what loses work for good asks, and an undo never rewrites
  git.

## Changes after approval

- One recorded change replaces the per-kind reverses the spec's architecture named; an undo now
  refuses once anything in its files changed, where some old reverses found their lines again after
  another edit.
- A second `d` deletes the next row, as `dd` no longer exists.
- Every action's toast ends with " · waits on the Git page", but the New page's draft.
- An image attached from an editor is undone together with the save of its links, recorded once that
  save lands, and placed where the file is after the replay.
- A change's bytes, images included, travel to the tab and stay with the stack's entries.
- A run of moves is named and placed after its first move, and joins only moves of one repository's
  list.
- An expand's undo places the human on the priorities with the proposal selected, as the file it
  made is gone.
- A round's settled comments, images attached in a comment's or an answer's form, and a proposal
  file's discovery effort stay out of the stack.
- An undo writes the working tree and leaves the index as it is: an earlier version staged stays
  staged.
- Another process's writes during a recorded write can land in its change, as the write lock is per
  process.
- An image's removal keeps the image's bytes, and its undo writes the image back when a commit's
  cleanup deleted it.
- An undo or a redo opens the page of the repository the action happened in, and is refused for a
  feature's file while its agent works.

## Follow-ups

- A drag has no UI test of its own: happy-dom cannot drag a row; its recording is the keys' moves'.
- After a redo, the place of an edit, a rename, or a move names the row's key from before the
  action, so the redo may select nothing.
- A list reread after an undo is not awaited: a key pressed at once after it may be refused as
  changed since, putting the row back with its message.
- A change carries its files' bytes to the tab with no cap per entry.
