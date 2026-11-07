---
status: auto-approved
spec-revision: 2
---

# Plan: Global undo

**Goal:** one undo stack per tab takes back, and redoes, every edit the web UI makes to the human's
lists and texts, with `u`, `Ctrl+Z`, `U`, and `Ctrl+Shift+Z`, and `d` deletes at once.

**Architecture:** every undoable write is recorded by the core as a **change**: the bytes each file
under the write's scope held before and after it, taken under the repository's write lock, with the
commit its branch was at. Undo writes the `before` side back only while every file still holds the
`after` side, and redo the reverse: one reverse for every kind of write, in the core, refusing with
the file's name once it changed since, as the [spec's architecture](spec.md#architecture) asks. This
replaces about fifteen per-kind reverses with one mechanism (ruling R1). The binding records a
change for each undoable write under a token the server passes, and the server answers each undoable
mutation with its change, plus two mutations of its own: `undo.apply` and `undo.committed`.

In the web UI, `undo/` owns the stack, its keys, its toasts, the committed question, the refusals,
and the trip to the action's page. A page records an entry once its write lands: a label, its place,
and its undo and redo, built from the change by `changeEntry`, or written by hand for the New page's
draft, the one action held by the browser. A move, tagged with its list, joins the entry on top
while it comes less than a second after the last move of the same list.

Owners: the core owns the change's capture, its replay, and the committed check; the stack owns the
order, the limit of 50, the redo side, the run of moves, and the one-at-a-time replay; each page
owns its labels and its place.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A write whose change spans several files, one of them changed since**, like a promotion writing
   `INBOX.md` and `PRIORITIES.md`, writes nothing back: all files are checked before any is written.
   Task 1.
2. **A note deleted with its folder, holding an image never committed**, comes back with the image's
   bytes on undo: the change keeps every file's bytes under its scope, not only Markdown. Task 1.
3. **Another tab's write landing between the write and its recording** cannot slip into the change:
   the write lock is held across the snapshot, the write, and the diff, and is re-entered by the
   write itself on the same thread. Task 1.
4. **A write refused by its own hash check** records no entry: nothing to undo. Task 4 (server) and
   task 6 (one row of the coverage test).
5. **A move in the inbox, then one in the priorities, within the second**, are two steps: a run
   joins moves of one list only. Task 3.
6. **The review file a first comment created** is deleted by its undo, and the file Start over
   deleted comes back on undo. Task 8, rows of the coverage test.
7. **The action's page already open**: the undo selects what came back without a new history entry,
   so Back still leaves the page. Task 5.

## Global constraints

From the [Undo](../decisions/undo.md) decision, word for word:

- Every edit to the human's lists and texts that waits on the Git page MUST be undoable: the inbox,
  the priorities, proposal files, categories, images, and comments. Checked by the UI tests.
- An action that can be undone MUST NOT ask to confirm it first.
- An action that loses work for good, with no undo, MUST ask first through the shared confirmation.
- `u` and `Ctrl+Z` MUST undo, and `U` and `Ctrl+Shift+Z` redo, the tab's latest action, outside text
  fields. Checked by the UI tests.
- The stack MUST keep the tab's last 50 actions, until the tab reloads or closes.
- An undo MUST NOT commit, revert, or rewrite git's history: it writes the reverse as a change.
  Checked by the core's tests.
- An undo of an action committed since MUST ask first.
- An undo MUST be refused, with its reason next to what it concerns, once what it would restore
  changed since. Checked by the core's tests.
- An undo MUST take the human to where the action happened, with what came back selected.
- Committing, starting, git, and settings actions MAY run at once without an undo, their button
  naming what they do.

From the [Keyboard](../decisions/keyboard.md) decision:

- A shortcut MUST be declared in the key registry, and listened for nowhere else. Checked by a
  structural test.
- Single-key shortcuts MUST be switchable off by a setting in the settings file.
- A key MUST NOT mean two things on one page, though two pages may give it different meanings.

From the [Git](../decisions/git.md) decision:

- Tools MUST NOT commit the human's edits unless the human asks for that commit, on the Git page or
  by an action that says it commits. Checked by the core's tests.
- Rust tools MUST read git with the gix library, and write through the system `git`, from one module
  of the core.
- A feature's or a change's branch MUST NOT write `PRIORITIES.md` or `INBOX.md`.

From the [UI behaviour](../decisions/ui-behaviour.md) decision:

- Status MUST show next to what it concerns, with an error staying there until dealt with, never
  only in a toast.
- A refused write MUST put back what it showed and say why next to what it concerns.

From the [Code quality](../decisions/code-quality.md) decision: functions and files stay within the
linters' limits (500 lines a file, 100 a function in TypeScript), a new marker needs the human's
approval, and unit tests MUST NOT depend on elapsed time. `InboxList.tsx` (468 lines) and
`lists/PrioritiesList.tsx` (467) are close to the limit: tasks 6 and 7 put their recording in
helpers next to them.

From the [Testing](../decisions/testing.md) decision: the stage is `early`; a test of the web UI
guards behaviour costly to lose; the agent reviews each changed view in the sandbox, in both themes,
at a phone's and a desktop's width.

Exact texts, from the spec and its mockups
([`UndoMockups.stories.tsx`](/packages/web/src/layout/UndoMockups.stories.tsx)):

- The toast of an action: its label and ` · waits on the Git page`, through `waitsOnGit` in
  [`writes/labels.ts`](/packages/web/src/writes/labels.ts): "Deleted “Color themes” · waits on the
  Git page", with Undo and its key `u`.
- After an undo: "Undone: deleted “Color themes”", with Redo and its key `U`; after a redo: "Redone:
  deleted “Color themes”", with Undo and `u`. The label's first letter goes lowercase after "Undone:
  " and "Redone: ".
- The status line: `U redo`, only while there is something to redo; no hint for `u`.
- The committed question: title "Undo a committed change?", body the entry's label, detail "This
  change was committed since. Undoing it writes the reverse as a new change, which waits on the Git
  page.", cancel "Keep it" (`n`), confirm "Undo" (`y`). A redo asks "Redo a committed change?", with
  "Redoing it" in the detail and "Redo" to confirm.
- A refusal, under the top bar until dismissed: "Could not undo: “Color themes” changed since in
  PRIORITIES.md." A redo's: "Could not redo: …", the same way.
- A run of moves' label: "Moved “Color themes”".
- The toast lasts 5 seconds, paused while hovered or focused, as `useTimedToast` does; on the phone
  its button shows no key.
- A run of moves: each move less than 1,000 ms after the last move of the same list.
- The stack keeps 50 entries.

## Code read

- [`layout/useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts): today's undo. `UndoKey`
  clicks the newest toast's button; `showPageError`, `useUndoErrors`, and `forgetUndoToasts` hold
  the refusals shown by `UndoErrors` in [`Shell.tsx`](/packages/web/src/Shell.tsx) (`:116`, mounted
  at `:272`, `UndoKey` at `:268`). `closeUndoToasts` and the `commits` mode have no caller.
- Callers of `useUndoToast`: `SidebarAdd.tsx:161,233` (a proposal's and a note's add),
  `InboxImages.tsx:141` (an image's removal), `InboxList.tsx:240` (a note's delete),
  `useNoteActions.ts:89,188` (the promotions), `newDraft.ts:112` (the draft a line's Start
  replaced), `pane/useProposalActions.ts:96` (the pane's delete), `lists/useCategoryActions.ts` (a
  category's delete). `showPageError` is also used by `QuickAdd.tsx` and `useNoteActions.ts`.
- [`keys/match.ts`](/packages/web/src/keys/match.ts): `tokenOf` writes Ctrl+Shift+Z as
  `mod+shift+z`, and `mod` is Ctrl or Cmd on every platform; `isCanonical` (`:99`) rejects
  `mod+shift+<letter>`, pinned by `keys-match.test.ts:160`. `useKeys(bindings, "shell")` in
  [`keys/registry.tsx`](/packages/web/src/keys/registry.tsx) ignores keys in text fields and open
  layers; a binding with a `hint` shows in the status line while declared; single keys off drop `u`
  and `U` but keep `mod+z`.
- [`fields/Confirm.tsx`](/packages/web/src/fields/Confirm.tsx): `useConfirm()` resolves `true` or
  `false`; `deleteLine` (`:44`) and `deleteNote` (`:59`) are the questions `d` asks today, from
  `deleteKey` in [`lists/useRowKeys.ts`](/packages/web/src/lists/useRowKeys.ts) (`:174-198`), a
  row's `deleting` field (`lists/Card.tsx:49`, set at `InboxList.tsx:319`).
- The list writes, all hash-checked: [`InboxList.tsx`](/packages/web/src/InboxList.tsx)
  `useInboxOutline` (`inbox.add`, `inbox.drop`, `inbox.outline`, and `inbox.place` for a line's
  move); [`lists/PrioritiesList.tsx`](/packages/web/src/lists/PrioritiesList.tsx)
  `usePrioritiesOutline` (`proposals.add`, `proposals.drop`, `proposals.outline`), `onMove` (`:401`,
  `proposals.move`), and `e` (`:315`, `proposals.expand`); the outline's moves go through
  `useOutline.tsx` (`onOutline` `:89`, `onNest` `:116`) and `lists/useItemMoves.ts`, one write per
  step; [`pane/useProposalActions.ts`](/packages/web/src/pane/useProposalActions.ts) (`remove`,
  `useRename`, `move`) and `pane/useExpand.ts`; `lists/useCategoryActions.ts` (`add`, `rename`,
  `remove`); [`useNoteActions.ts`](/packages/web/src/useNoteActions.ts) (the four promotions);
  `InboxImages.tsx` and `NoteImage.tsx` (an image added by `POST /inbox/note-image`, removed by
  `inbox.removeImage`); [`useReviewActions.ts`](/packages/web/src/useReviewActions.ts)
  (`review.comment`, `review.edit`, `review.remove`, `review.startOver`, no hash).
- Selection on arrival: `navigate(path, { select })` and `selectOnArrival` in
  [`routeHistory.ts`](/packages/web/src/routeHistory.ts); the priorities read it through
  `lists/useArrival.ts`, the inbox does not yet (it selects through `/inbox/<key>`).
- The core: [`actions/deferred/undo.rs`](/crates/core/src/actions/deferred/undo.rs) already
  snapshots `specs/` before a deferred commit and puts each file back while it holds what the write
  left (`held`, `written`, `undo`): the shape a change generalizes. `cache::write_lock`
  ([`cache.rs:362`](/crates/core/src/cache.rs)) is not re-entrant. `api::save_buffer`
  ([`api/buffer.rs:142`](/crates/core/src/api/buffer.rs)) shows how a path finds its checkout: a
  feature's file on its branch, the rest on the default branch through
  `default_branch::reach_default`. Review files are written by `actions/review.rs` on the feature's
  branch (`review_name` `:60`). `Git::entry_id(commit, path)` and `Git::tip` read what a commit
  holds.
- The existing reverses, kept until task 11: `actions/inbox/undo.rs`, `categories.rs`
  (`restore_category`), `unlink.rs` (`restore_image`), `inbox::insert`, `priorities::insert`, and
  their server mutations in `packages/server/src/fate/inbox-mutations.ts` and `list-mutations.ts`;
  `inbox.undoCategory`, `inbox.undoCommitted`, and `proposals.undoCommitted` have no web caller.
- The binding wraps each API call as `job(move || api::...)`
  ([`crates/binding/src/inbox_writes.rs`](/crates/binding/src/inbox_writes.rs)); the server answers
  a mutation with extra fields beside its record, as `inbox.removeCategory` answers `removed`.
- Tests: the core's integration tests in `crates/core/tests/*.rs`, on `common::repo::TestRepo`; the
  server's in `packages/server/src/__tests__/` through `testApp` and `mutate`; the web's in
  `packages/web/src/__tests__/`, over a real server and fixture repository (`renderPage`, `read`,
  `quiet` in `helpers.tsx`, whose `beforeEach` resets module state), each file pressing keys with
  its own `press` (`keys-row-editing.test.tsx:102` adds Shift for capitals).
- Validation, inside `nix develop -c`: `vp run --filter uraeda-binding build` after a binding
  change, `vp run fast` before each commit, `vp run ready` before the push; a single Rust test file
  with `cargo nextest run -p uraeda-core --test <name>`, a single web file with `vp test <path>`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

The stack and the changes it holds live in the tab's memory, the temporary state the third principle
allows; every undo writes plain files, and nothing durable depends on it.

## Complexity tracking

| New abstraction                                                    | Why                                                                                                              | Simpler alternative rejected                                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The change, `actions/change.rs`, out of `deferred/undo.rs`         | One reverse and one redo for every kind of write; deferred commits keep using it                                 | One hand-written reverse per kind, about fifteen, with no redo: ruling R1                                                  |
| A re-entrant write lock, per thread                                | The snapshot, the write, and the diff must be one critical section, and the write takes the lock itself          | Snapshots outside the lock: another tab's write could slip into a change, and its undo would take that write back too      |
| The binding's change tokens, `crates/binding/src/undo.rs`          | Records a change beside a write without changing the return type of about 25 binding functions and their callers | A `{ value, change }` answer from each function: every server caller and binding test changes for a field one helper reads |
| `undo/` in the web: the stack, its keys, its toasts, `changeEntry` | The one owner of the stack, the keys, and the toasts, which the spec asks for                                    | Keeping `useUndoToast`'s toast-scraping `u`: no stack, no redo                                                             |

No function or file grows past a limit: tasks 6 and 7 keep `InboxList.tsx` and `PrioritiesList.tsx`
under 500 lines by putting their entries' building in helpers.

## Review comments

The spec was approved without comments.

## Test map

The core's tests write a real git repository (`TestRepo`); the stack's unit tests are pure, with
their clock passed in; the web's UI tests render the app over a real server and fixture repository,
with real time except where they fake `Date` to pin the second of a run.

| Spec                                                      | Task | Check                                                                                                                                                                          |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| US1.1: `d` deletes at once, with its toast                | 9    | `undo-keys.test.tsx` "d deletes at once; u brings it back and offers Redo; U deletes it again"                                                                                 |
| US1.2: two `u` take back an indent, then a move           | 3    | `stack.test.ts` "undo takes back the latest entry first, minutes later"                                                                                                        |
| US1.3: `u` from another page opens it, selected; Back     | 5    | `undo-keys.test.tsx` "u from another page opens the action's page with what came back selected"                                                                                |
| US1 more 1-2: a comment's removal, Start over             | 8    | `undo-coverage-reviews.test.tsx`, rows "a comment removed", "Start over"                                                                                                       |
| US1 more 3: a note with its note file                     | 1    | `undo_changes.rs` "a note deleted with its folder comes back with its image"                                                                                                   |
| US1 more 4: 51 actions keep 50                            | 3    | `stack.test.ts` "the stack keeps the latest 50 entries"                                                                                                                        |
| US1 more 5: a reload empties the stack                    | —    | none: the stack is module memory, which a reload discards                                                                                                                      |
| US1 more 6, high edge: Ctrl+Z in a field                  | 5    | `undo-keys.test.tsx` "Ctrl+Z in a text field undoes the typing, not the stack"                                                                                                 |
| US2.1-2: the undone toast, `U redo`, `U` and Ctrl+Shift+Z | 9    | `undo-keys.test.tsx` "d deletes at once; u brings it back and offers Redo; U deletes it again"                                                                                 |
| US2.3: a new action clears the redo                       | 3    | `stack.test.ts` "a new entry clears what could be redone"                                                                                                                      |
| US2 more 1: the redone toast                              | 5    | `undo-toast.test.tsx` "an entry's toast says what was undone and redone"                                                                                                       |
| US3.1-3, high edge: a committed change asks               | 1, 5 | `undo_changes.rs` "committed since: false until a commit touches the files"; `undo-keys.test.tsx` "u on a committed change asks; Keep it keeps it, Undo writes it uncommitted" |
| US4.1, high edge: the file changed since                  | 1    | `undo_changes.rs` "undo refuses once a file changed since, writing nothing"                                                                                                    |
| US4.2: a refused entry leaves the stack                   | 3    | `stack.test.ts` "a refused undo leaves the stack, and shows its reason"                                                                                                        |
| US5.1-2: a run of moves, no toast, one step               | 7    | `undo-keys.test.tsx` "m, k three times, Enter: no toast, and u puts the row back in one step"                                                                                  |
| US5.3, more 1-2: the second ends a run; other actions     | 3    | `stack.test.ts` "moves of one list less than a second apart join one entry"                                                                                                    |
| US5 more 3: the run's redo and its label                  | 3    | `stack.test.ts` "moves of one list less than a second apart join one entry"                                                                                                    |
| Edge: the page not open                                   | 5    | as US1.3                                                                                                                                                                       |
| Edge: a category holding notes still asks                 | —    | existing: its question is unchanged; its undo is the row "a category deleted with its notes" of `undo-coverage-inbox.test.tsx`                                                 |
| Edge: single keys off                                     | —    | none: the registry drops single keys and keeps `mod+` chords, tested by `keys-registry.test.tsx`                                                                               |
| Edge: the stack empty, nothing to redo                    | 3    | `stack.test.ts` "undo and redo on an empty side do nothing"                                                                                                                    |
| Edge: a second `u` while the first is on its way          | 3    | `stack.test.ts` "an undo pressed during another waits for it"                                                                                                                  |
| Edge: the phone                                           | 5    | `undo-toast.test.tsx` "on the phone, the toast's button shows no key", moved from `phone-t3.test.tsx`                                                                          |
| Edge: the thing deleted on another page                   | 1    | as US4.1: the file changed since                                                                                                                                               |
| SC-001: `d` takes one key                                 | 9    | as US1.1                                                                                                                                                                       |
| SC-002: every write has an undo and a redo                | 6-8  | `undo-coverage-inbox.test.tsx`, `undo-coverage-priorities.test.tsx`, `undo-coverage-reviews.test.tsx` (R11), one row per kind of write                                         |
| SC-003: the 50th action back, no toast on screen          | 3    | as US1 more 4                                                                                                                                                                  |
| SC-004: no git command commits, resets, or reverts        | 1    | `undo_changes.rs` "undo and redo write files and never commit"                                                                                                                 |
| Review focus: a change across files, one changed          | 1    | `undo_changes.rs` "undo refuses once a file changed since, writing nothing"                                                                                                    |
| Review focus: an uncommitted image                        | 1    | as US1 more 3                                                                                                                                                                  |
| Review focus: another tab's write in between              | 1    | none of its own: the lock is held by the recording; a deadlock fails every row of `undo_changes.rs`                                                                            |
| Review focus: a refused write records nothing             | 4, 6 | `undo-coverage-inbox.test.tsx` row "a write refused by its hash leaves nothing to undo"                                                                                        |
| Review focus: two lists in one second                     | 3    | a row of "moves of one list less than a second apart join one entry"                                                                                                           |
| Review focus: review file created or deleted              | 8    | rows "a first comment", "Start over" of `undo-coverage-reviews.test.tsx`                                                                                                       |
| Review focus: the page already open                       | 5    | an assertion of "u from another page …": a second `u` on the open page keeps Back's target                                                                                     |
| Replaced: `d` asks first                                  | 9    | `inbox-note-delete.test.tsx` and two tests of `keys-row-editing.test.tsx` rewritten, as the spec lists                                                                         |
| Replaced: `u` only while its toast shows                  | 5    | `undo-toast.test.tsx` "an Undo that rejects shows its failure in the page" removed                                                                                             |

## Waves

1. Tasks 1, 2, 3: the core's change, the registry's `mod+shift` chords, and the pure stack touch
   different crates and files.
2. Task 4 alone: the server consumes task 1's binding.
3. Task 5 alone: the web's undo layer consumes tasks 2, 3, and 4.
4. Tasks 6, 7, 8: the inbox, the priorities, and the reviews each record their writes, in different
   files; each adds its rows to `undo-coverage.test.tsx` and its helpers to `__tests__/helpers.tsx`.
5. Tasks 9, 10, 11: `d` at once in the lists, the docs and guides, and the removal of the replaced
   reverses touch different files.

---

## Task 1: The change, in the core

**Risky:** it changes the repository's write lock, shared by every write, and adds a write path that
puts files back.

**Files:**

- Create: `crates/core/src/actions/change.rs` (the change's types, its snapshot, diff, check, and
  replay, with the walk of `specs/` and the cleanup of empty folders moved from
  `actions/deferred/undo.rs`)
- Modify: `crates/core/src/actions/deferred/undo.rs`, to walk and clean through `change.rs`; its
  `held`, `written`, and `undo` keep their Markdown-only behaviour
- Modify: `crates/core/src/cache.rs` (`lock`, `WriteGuard`)
- Create: `crates/core/src/api/undo.rs`, and its line in `api/mod.rs`
- Create: `crates/binding/src/undo.rs`; modify the binding's write functions listed below, and their
  two callers in the server whose arguments ruling R5 folds
- Test: `crates/core/tests/undo_changes.rs`

**Interfaces:**

- Produces, in the core:
  - Declared in `actions::change` and re-exported by `api::undo`:
    `pub struct Change { pub commit: Option<String>, pub files: Vec<ChangedFile> }` and
    `pub struct ChangedFile { pub path: String, pub before: Option<Vec<u8>>, pub after: Option<Vec<u8>> }`,
    paths from the repository's top level, `None` for a file absent on that side; only files whose
    bytes differ are kept; `commit` is the checkout's `HEAD` when the write ran.
  - `pub fn api::undo::recorded<T, S: AsRef<str>>(repo: &Path, scope: &[S], write: impl FnOnce() -> Result<T>) -> Result<(T, Change)>`:
    finds the checkout from `scope[0]` as `save_buffer` does, takes the write lock, reads every
    file's bytes under each scope path (a file or a folder), runs `write`, and diffs. A failing
    `write` returns its error and no change.
  - `pub enum Direction { Undo, Redo }` and
    `pub fn api::undo::apply_change(repo: &Path, change: &Change, direction: Direction, subject: &str) -> Result<Option<String>>`:
    under the write lock, checks every file holds the side it expects (`after` for an undo, `before`
    for a redo, absent for `None`); if one does not, writes nothing and refuses as a conflict:
    "Could not undo: “{subject}” changed since in {file name}." (`redo` for a redo). Otherwise
    writes the other side, deletes a file whose side is `None` with the folders it leaves empty, and
    answers the checkout's `HEAD` now. It runs no git command, so it reaches no checkout: without
    one holding the files' branch it refuses as changed since. A path outside `specs/`, or a change
    whose files lie on two branches, is refused (`refused`): the change comes back from the web UI.
  - `pub fn api::undo::committed_since(repo: &Path, change: &Change) -> Result<bool>`: whether the
    checkout's `HEAD`, or its branch's tip without a checkout, holds any of the change's files
    differently from `change.commit`, by `Git::entry_id`.
  - The scopes of `api::undo`, constants `&[&str]`: `INBOX` (`specs/INBOX.md`), `NOTES`
    (`specs/INBOX.md`, `specs/notes`), `NOTE_IMAGES` (`NOTES` and `MARKDOWN`), `PRIORITIES`
    (`specs/PRIORITIES.md`), `PROMOTION` (`specs/INBOX.md`, `specs/PRIORITIES.md`, `specs/notes`,
    `specs/proposals`), `RELINKING_PROMOTION` (`PROMOTION` and `MARKDOWN`, every Markdown file of
    `specs/`), `EXPAND` (`specs/PRIORITIES.md`, `specs/proposals`); and functions:
    `review(repo, folder, file) -> Result<Vec<String>>`, the review file's path, read from the
    feature's folder; `note_image(file) -> Vec<String>`, the inbox and the folder of the note file
    or proposal file an image leaves; `attached(path) -> Vec<String>`, the file and its folder, or,
    for a single proposal file or note file, which becomes a folder and has its links followed
    everywhere, the file, the folders named after it, and `MARKDOWN` (ruling R6).
- Produces, in the binding (`crates/binding/src/undo.rs`):
  - `ChangeView { commit: string | null, files: Array<ChangedFileView> }`, with
    `ChangedFileView { path: string, before: string | null, after: string | null }`, bytes
    base64-encoded (the `base64` crate, already in `Cargo.lock`).
  - Each undoable write function takes a last optional `undo?: string`, a token: when given, it runs
    through `recorded` with its scope and keeps the change under the token.
    `takeChange(token: string): ChangeView | null` hands it over once; the binding keeps at most the
    latest 64.
  - `applyChange(repo, change: ChangeView, direction: "undo" | "redo", subject: string): Promise<string | null>`
    and `committedSince(repo, change: ChangeView): Promise<boolean>`.
  - The functions given a token, with their scope: `addNote`, `outlineNote`, `dropNote`,
    `placeNote`, `moveNoteToCategory`, `addCategory`, `renameCategory` (`INBOX`); `removeNote` and
    the outline's `remove` kind, `removeCategory`, `addNoteWithImages` (`NOTES`); `attachNoteImages`
    (`NOTE_IMAGES`, ruling R6); `removeNoteImage` (`note_image(file)`); `noteUnderProposal`
    (`PROMOTION`); `noteToProposal`, `noteToProposalFile`, `noteIntoProposal`,
    `noteIntoProposalLine` (`RELINKING_PROMOTION`); `addProposal`, `outlineProposal`,
    `dropProposal`, `moveProposal`, `editProposal`, `removeProposal` (`PRIORITIES`);
    `expandProposal` (`EXPAND`); `addComment`, `editComment`, `removeComment`, `startOver`
    (`review(repo, folder, file)`); `attachImage` (`attached(path)`).
  - Two functions keep within clippy's 7 arguments by folding two of theirs (ruling R5):
    `addComment(repo, folder, file, lines?: CommentLines, text, decision?, undo?)`, with
    `CommentLines { start: number, end?: number }`, and
    `addNoteWithImages(repo, text, previous, images, names, note?: NewNote, undo?)`, with
    `NewNote { category?: string, about?: string }`.

- [x] **Step 1: Write the failing tests**

`crates/core/tests/undo_changes.rs`, on `TestRepo` and the fixture's inbox and priorities:

- "undo and redo of a move put the file back, then forward": record `api::move_proposal` of a line
  from Next to Now under `PRIORITIES`; `apply_change(Undo)` leaves `PRIORITIES.md` byte for byte as
  before; `apply_change(Redo)` as after.
- "undo refuses once a file changed since, writing nothing": record a promotion (`PROMOTION`), then
  edit `PRIORITIES.md`; the undo's error is a conflict reading "Could not undo: “<the note>” changed
  since in PRIORITIES.md.", and `INBOX.md` still holds what the promotion left.
- "a note deleted with its folder comes back with its image": a note whose folder holds an
  uncommitted `shot.png`; record its removal under `NOTES`; the undo puts back the note's line, its
  `note.md`, and `shot.png`'s bytes.
- "undo and redo write files and never commit": after a recorded write, an undo, and a redo, the
  commit count and `HEAD` are unchanged, and `git status` lists the file as modified.
- "committed since: false until a commit touches the files": `committed_since` is `false` after the
  write, still `false` after committing an unrelated file, and `true` after committing
  `PRIORITIES.md`.

The break each test catches: a reverse that rewrites the whole file from git (the first); a check of
only the first file (the second); a snapshot of Markdown only (the third); a reverse through
`git restore` or `revert` (the fourth); a check on `HEAD` moving rather than on the file (the
fifth).

- [x] **Step 2: Run them to check they fail**

- Run: `nix develop -c cargo nextest run -p uraeda-core --test undo_changes`
- Expected: FAIL to compile, `cannot find function recorded in module api::undo`

- [x] **Step 3: Make the write lock re-entrant on its thread**

`cache::lock` remembers, per thread, the keys it holds: a thread taking a key it already holds gets
a guard that releases nothing. Every existing caller is unchanged.

- [x] **Step 4: Move the snapshot into `actions/change.rs`, and implement `api::undo`**

Deferred commits keep their behaviour through the moved functions: their tests in
`crates/core/tests/deferred.rs` pass unchanged. The change keeps every file's bytes under its scope,
whatever its kind, unlike the deferred commit's `Held::Other`.

- [x] **Step 5: The binding: tokens, `takeChange`, `applyChange`, `committedSince`**

Then build the binding: `nix develop -c vp run --filter uraeda-binding build`; its generated
`packages/binding/index.d.ts` shows the new optional `undo` parameters.

- [x] **Step 6: Make the risky breaks**

Make the lock not re-entrant again, and see every test of `undo_changes.rs` hang until nextest's
timeout: `recorded` holds the lock its write takes. Then make `apply_change` check only the first
file, and see "undo refuses once a file changed since …" fail. Revert both, and report the failures
in the commit body.

- [x] **Step 7: Run the task's validation**

- Run: `nix develop -c vp run fast`
- Expected: PASS

- [x] **Step 8: Commit**

```bash
git add crates/core crates/binding packages/binding
git commit -m "feat(global-undo): record each write as a change the core can undo and redo"
```

## Task 2: `mod+shift` chords in the key registry

**Files:**

- Modify: `packages/web/src/keys/match.ts` (`isCanonical`), `packages/web/src/keys/store.ts` (the
  error naming the canonical forms)
- Test: `packages/web/src/__tests__/keys-match.test.ts` (`:160`)

**Interfaces:**

- Produces: `isCanonical("mod+shift+z") === true`: `mod+shift+` followed by a lowercase character,
  as `tokenOf` writes Ctrl+Shift+Z. `mod+shift+<capital>` stays rejected.

- [x] **Step 1: Rewrite the test at `:160`**: `mod+shift+k` is canonical, `mod+shift+K` is not. The
      break it catches: a chord `tokenOf` produces that no binding could declare.
- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/web/src/__tests__/keys-match.test.ts`
  - Expected: FAIL, `expected false to be true`
- [x] **Step 3: Accept the form in `isCanonical`**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web/src/keys/match.ts packages/web/src/__tests__/keys-match.test.ts
git commit -m "feat(global-undo): let a key binding hold mod and shift"
```

## Task 3: The undo stack

**Files:**

- Create: `packages/web/src/undo/stack.ts`
- Test: `packages/web/src/undo/stack.test.ts`

**Interfaces:**

- Produces:

```ts
export type UndoEntry = {
  /** What the action did, as its toast says it: "Deleted “Color themes”". */
  label: string;
  /** Where it happened: the repository, the page's path from it, and the key of what to select. */
  place: { path: string; repo: string; select?: string };
  /** Resolves with nothing once done, or with the refusal to show. */
  undo: () => Promise<string | undefined>;
  redo: () => Promise<string | undefined>;
  /** Whether a commit since touched what it wrote: asks before undoing or redoing. */
  committed?: () => Promise<boolean>;
  /** A move of a list's row, which joins the run on top: `join(earlier)` makes the run's entry. */
  move?: { list: string; join: (earlier: UndoEntry) => UndoEntry };
};
export function createUndoStack(now: () => number = Date.now): UndoStack;
export type UndoStack = {
  record(entry: UndoEntry): void;
  /** Undoes the top entry, in turn after any undo or redo still on its way. */
  undo(ask: (entry: UndoEntry, redo: boolean) => Promise<boolean>): Promise<UndoOutcome>;
  redo(ask: (entry: UndoEntry, redo: boolean) => Promise<boolean>): Promise<UndoOutcome>;
  canRedo(): boolean;
  top(): UndoEntry | undefined;
  subscribe(listener: () => void): () => void;
  clear(): void;
};
export type UndoOutcome =
  | { kind: "empty" }
  | { kind: "kept"; entry: UndoEntry }
  | { kind: "done"; entry: UndoEntry }
  | { kind: "refused"; entry: UndoEntry; reason: string };
export const undoStack: UndoStack; // the tab's one stack
```

- Rules it owns: at most 50 entries, the oldest dropped; a new entry recorded clears the redo side;
  a move joins the top entry when it is a move of the same `list` pushed less than 1,000 ms before,
  the time restarting at each move; `ask` runs only when `committed()` resolves `true`, and a
  `false` answer is `kept`, the entry staying where it was; a refused entry leaves its side; one
  undo or redo at a time, in the order pressed.

- [x] **Step 1: Write the failing tests**, with a clock the test moves:
  - "undo takes back the latest entry first, minutes later": two entries, the clock 10 minutes on;
    two undos call the second's then the first's `undo`.
  - "the stack keeps the latest 50 entries": 51 pushes; 50 undos succeed, the 51st is `empty`.
  - "a new entry clears what could be redone": undo, then record; `canRedo()` is `false`.
  - "moves of one list less than a second apart join one entry", rows: three moves 400 ms apart are
    one entry, whose undo is the run's and whose redo redoes it all; a move 2,000 ms later is a
    second entry; a delete pushed within the second is its own entry, and a move after it starts a
    new run; a move of another list within the second is its own entry.
  - "a refused undo leaves the stack, and shows its reason": the top's `undo` resolves "Could not
    undo: …"; the outcome is `refused` with it, and the next undo takes the entry below.
  - "undo and redo on an empty side do nothing": both answer `empty`, calling nothing.
  - "an undo pressed during another waits for it": the first `undo` held open; the second starts
    only once it resolves.
  - A committed entry: `ask` answering `false` keeps it on top, `true` undoes it; a row of the first
    test.
  - The break each catches: a stack that pops oldest first; one that grows past 50; a redo side kept
    after a new action; a timer measured from the run's first move, or runs across lists; a refused
    entry kept on top; two replays at once.
- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c vp test packages/web/src/undo/stack.test.ts`
  - Expected: FAIL, `Failed to resolve import "./stack.ts"`
- [x] **Step 3: Implement `undo/stack.ts`**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web/src/undo
git commit -m "feat(global-undo): the tab's undo stack"
```

## Task 4: The server answers each undoable write with its change

**Files:**

- Create: `packages/server/src/fate/undo-mutations.ts`, registered beside the other mutations, and
  `fate/views-undo.ts`, the `Undo` record's data view and `ChangeRecord`
- Modify: `packages/server/src/fate/inbox-mutations.ts`, `mutations.ts` (`proposals.*`),
  `file-mutations.ts` (the reviews), `masked.ts`, the records' data views, and
  `packages/server/src/attach.ts` (images); `packages/web/.fate/client.generated.ts`, regenerated by
  the web UI's build
- Test: `packages/server/src/__tests__/undo.test.ts`

**Interfaces:**

- Consumes: task 1's binding: the `undo` token parameter, `takeChange`, `applyChange`,
  `committedSince`, `ChangeView`.
- Produces:
  - A helper
    `undoable<T>(ctx, call: (token: string) => Promise<T>): Promise<{ answer: T; change: ChangeView | null }>`
    in `undo-mutations.ts`, `ctx` giving the binding; and in `masked.ts`, `undoablePriorities` and
    `undoableInbox(ctx, select, call)`, which run it through `refusable` and answer the record.
  - Every mutation and request task 1 lists answers with `change`, beside its record, as
    `inbox.removeCategory` answers `removed`: the inbox's mutations, `proposals.*`, `review.*`, and
    the `POST` answers of `/inbox/note-image` and `/attach`.
  - `undo.apply { change: ChangeView, direction: "undo" | "redo", subject: string }` answering
    `{ commit: string | null }`, a refusal answered as the other refused writes are; and
    `undo.committed { change: ChangeView }` answering `{ committed: boolean }`: both answer one
    record type, `Undo` (`{ id, commit, committed }`), each setting its own field (ruling R8).

- [x] **Step 1: Write the failing test**: "a write's change undoes and redoes through the server":
      `mutate(app, "proposals.move", …)` answers a `change`; `undo.apply` with it puts
      `PRIORITIES.md` back, and `undo.committed` answers `false`. One assertion that a refused
      write, sent a stale hash, answers no change. The break it catches: a mutation that drops the
      change, or one recorded for a refused write.
- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/server/src/__tests__/undo.test.ts`
  - Expected: FAIL, `expected undefined to be defined` on the answer's `change`
- [x] **Step 3: Implement `undoable`, the two mutations, and the `change` of each write**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(global-undo): answer each undoable write with its change"
```

## Task 5: The undo layer of the web UI

**Files:**

- Start from: `packages/web/src/layout/UndoMockups.stories.tsx`: its toasts, its question, and its
  refusal are what this task makes real; the file becomes the stories of the real states.
- Create: `packages/web/src/undo/UndoKeys.tsx`, `undo/useUndo.ts`, `undo/changeEntry.ts`,
  `undo/pageErrors.ts`, `undo/changeViews.ts` (the lists' and the proposal file's views with their
  `change`)
- Delete: `packages/web/src/layout/useUndoToast.ts`
- Modify: `Shell.tsx` (`UndoKey` becomes `UndoKeys`), every caller of `useUndoToast` and
  `showPageError` listed in the code read, `__tests__/helpers.tsx` (`beforeEach` clears the stack),
  `lists/useArrival.ts` (`useNamedRow`, which `pane/DetailRoutes.tsx`'s `InboxRoute` reads, so the
  inbox selects the row its history entry names), `routeHistory.ts` (`namedCount`)
- Test: `packages/web/src/__tests__/undo-keys.test.tsx`, `__tests__/undo-toast.test.tsx`
  (rewritten), `__tests__/phone-t3.test.tsx` (its toast test moves out)

**Interfaces:**

- Consumes: `undoStack` and `UndoEntry` (task 3); the `mod+shift+z` chord (task 2); `undo.apply`,
  `undo.committed`, and `ChangeView` (task 4).
- Produces:
  - `useUndo(): (entry: UndoEntry, options?: { toast?: boolean; waitsOnGit?: boolean }) => void`:
    records the entry on the stack, and shows its toast unless `toast` is `false` or the entry is a
    move: the label through `waitsOnGit`, unless `waitsOnGit` is `false` (the New page's draft),
    with Undo and its key `u` while single keys are on and the screen is not narrow. A toast closes
    once its entry is no longer on top; a Redo's toast, once the stack changes. `useStackToast`
    draws both, and `setReplay` lets a toast's button run what `u` and `U` run.
  - `changeEntry(fate, change: ChangeView, label: string, place: UndoEntry["place"], subject: string): UndoEntry`:
    its undo and redo call `undo.apply`, updating the change's commit with the answer; its
    `committed` calls `undo.committed`; a refusal resolves as the text the server answered. After
    each, the lists are read again (`rereadChanges`). The writes select their change with the views
    of `undo/changeViews.ts`: `PrioritiesChangeView`, `InboxChangeView`, `ProposalFileChangeView`.
  - `joinChanges(earlier: ChangeView, later: ChangeView): ChangeView`: per path, the earlier's
    `before` and the later's `after`, for a run of moves.
  - `UndoKeys`, mounted in the shell: `u` and `mod+z` undo; `U` (hint `U`, label `redo`) and
    `mod+shift+z` redo, declared only while `canRedo()`. After an undo: the toast "Undone: …" with
    Redo and `U`; after a redo: "Redone: …" with Undo and `u`; then, when the entry's repository and
    page are not the ones open, `navigate(repoPath(place.repo, place.path), { select })`, else the
    row selected in place. A committed entry asks the committed question first
    (`committedQuestion(entry, redo)`). A refusal, or an undo that rejects
    (`Could not undo: <message>`), goes to `showPageError`.
  - `showPageError`, `useUndoErrors`, `forgetUndoErrors` in `undo/pageErrors.ts`, as they were.
  - The existing callers become entries: each keeps its label and its current undo, with a redo that
    re-runs its write over the files as they are, until tasks 6 to 8 give them their changes: a
    category's delete, an image's removal, the pane's delete, and the sidebar's add of a proposal.
    The note's delete and the sidebar's adds of a note get `cannotRedo(label)`, a redo refused,
    marked `TEMPORARY:`. The four promotions record `changeEntry` already (ruling R9). The New
    page's "Draft replaced" is an entry whose undo and redo swap the draft, its place the New page.
  - `deleteLine` and `deleteNote` stay until task 9.

- [x] **Step 1: Write the failing tests**
  - `undo-keys.test.tsx`: "u from another page opens the action's page with what came back
    selected": a note promoted to Now from the inbox, then a spec opened; `u` opens the inbox, the
    note back and selected, and Back returns to the spec; a second `u` on the open page selects
    without a history entry. "Ctrl+Z in a text field undoes the typing, not the stack": a promotion,
    then typing in a field and Ctrl+Z there; the note stays promoted. "u on a committed change asks;
    Keep it keeps it, Undo writes it uncommitted": a promotion, committed with `git` in the fixture;
    `u` shows "Undo a committed change?"; `n` keeps the files; `u`, `y` puts the note back, and the
    commit count is unchanged.
  - `undo-toast.test.tsx`: "an entry's toast says what was undone and redone": the toast texts after
    `u` and `U`, exactly as the global constraints say. "on the phone, the toast's button shows no
    key", moved from `phone-t3.test.tsx`. Its test of the hover pause stays, on the new toast. "an
    Undo that rejects shows its failure in the page" goes, as the spec lists.
  - The breaks: an undo in place without the trip; the stack hearing a field's keys; an undo that
    skips its question; a redo toast with the wrong text or key.
- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/web/src/__tests__/undo-keys.test.tsx packages/web/src/__tests__/undo-toast.test.tsx`
  - Expected: FAIL, `Unable to find an element with the text: Undo a committed change?`
- [x] **Step 3: Implement the undo layer, and move every caller onto it**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS; the existing undo
      tests (`keys-promote`, `inbox-images`, `inbox-note-delete`, `new-page`) still pass.
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(global-undo): u, U, and their toasts over the tab's stack"
```

## Task 6: The inbox's writes join the stack

**Files:**

- Create: `packages/web/src/inboxUndo.ts` (the inbox's labels and entries)
- Modify: `InboxList.tsx` (`useInboxOutline` and its `useRun`; `useNoteDelete` and its `putBack`
  removed, the outline's delete recording it), `InboxImages.tsx`, `NoteImage.tsx`, `inboxImages.ts`,
  `lists/useCategoryActions.ts`; `optimisticLists.ts` (`notePutBack`) and `views.ts`
  (`InboxRemovedView`) lose what only the replaced undos used. The promotions (`useNoteActions.ts`)
  recorded their change in task 5 (R9), and the inbox's arrival selection came with task 5's
  `useNamedRow`: both stay as they are.
- Test: `packages/web/src/__tests__/undo-coverage-inbox.test.tsx` (created here, R11), its helpers
  in the file

**Interfaces:**

- Consumes: `useUndo`, `changeEntry`, `joinChanges` (task 5); the `change` answers (task 4).
- Produces: every inbox write records `changeEntry(answer.change, …)` once it lands, and nothing
  when refused: a row's add ("Added “…”"), edit ("Edited “…”"), and delete ("Deleted “…”"); its
  indent, outdent, drag, up and down, and move to a category, as moves of the list `inbox`, labelled
  "Moved “…”", with no toast; a category's add ("Added the category …"), rename ("Renamed the
  category … to …"), and delete (its label today); the four promotions and the image's removal,
  their labels today; an image attached to a note ("Added an image to “…”"). The place is `/inbox`
  with the note's key, or the page the promotion opened. The inbox selects a row named by
  `navigate`'s `select` on arrival, as the priorities do.
- In `inboxUndo.ts`: `inboxEntry(fate, change, write: InboxWrite): UndoEntry`, where
  `InboxWrite = { label, move?, select?, subject }`, a move joining the run of the list `inbox`;
  `outlineWrite(now, id, at, kind, text)`, the `InboxWrite` of an outline edit by its kind;
  `movedWrite(row)`; `rowOfNote(now, id, at?)`; `quoted(text)`; and
  `rereadingFile(fate, entry, file)`, which reads a note file again after the replay.
  `useAttachToNote`'s `attach` resolves with `{ change?, file }` or the refusal, and
  `useAddWithImage`'s answer gains `change`.

- [x] **Step 1: Write the failing test**: `undo-coverage-inbox.test.tsx`, "every kind of write has
      an undo and a redo", one row per kind above, each: do it through the page, `u`, the file as
      before, `U`, the file as after; and the row "a write refused by its hash": nothing to undo.
      The break each row catches: a write that records no entry, or the wrong scope.
- [x] **Step 2: Run it to check it fails**
  - Run: `nix develop -c vp test packages/web/src/__tests__/undo-coverage-inbox.test.tsx`
  - Expected: FAIL on the first row, the file unchanged after `u`
- [x] **Step 3: Record each write**, `InboxList.tsx` staying under 500 lines
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(global-undo): every edit of the inbox can be undone and redone"
```

## Task 7: The priorities' and the proposals' writes join the stack

**Files:**

- Create: `packages/web/src/lists/prioritiesUndo.ts` (the labels, `usePrioritiesUndo`, the move
  entries, `useMoveWrite`), `attach/attachUndo.ts` (the entry of images attached from an editor)
- Modify: `lists/PrioritiesList.tsx` (`usePrioritiesOutline`, `onMove`, `e`),
  `pane/useProposalActions.ts`, `pane/useExpand.ts`, `SidebarAdd.tsx`, `QuickAdd.tsx`,
  `AddNote.tsx`, `NoteImage.tsx` (`POST /inbox/note-image` answers its change), the proposal file's
  image attach (`attach/useImageText.ts`, `attach/useEditorImages.ts`), `undo/stack.ts` (its clock
  reads the global `Date` at each record, for a test to fake it)
- Test: `undo-coverage-priorities.test.tsx`; `undo-keys.test.tsx`; `keys-row-editing.test.tsx` waits
  for the selection a saved line's toast draws in a render of its own

**Interfaces:**

- Consumes: as task 6.
- Produces: a line's add, edit, and delete; its indent, outdent, drag, and move, J, K, and the move
  mode, as moves of the list `priorities`, with no toast; the pane's delete, rename ("Renamed “…”"),
  and section ("Moved “…” to Now", a move); `e` and the pane's Expand ("Expanded “…” into a file"),
  its place the priorities with the proposal selected, as its undo deletes the file (R17); the
  sidebar's adds of a proposal and of a note; an image attached to a proposal file ("Added an image
  to “…”"), its undo taking back the save of the text that links it too, read as the file holds it
  when the undo runs, and refused once that text changed since.

- [x] **Step 1: Write the failing tests**: `undo-coverage-priorities.test.tsx`, one test per group
      of writes above, and in `undo-keys.test.tsx`: "m, k three times, Enter: no toast, and u puts
      the row back in one step", on "Color themes" fourth in Next, `Date` faked so the presses are
      100 ms apart. The break: a run that undoes one move, or a toast on a move.
- [x] **Step 2: Run them to check they fail**
  - Run:
    `nix develop -c vp test packages/web/src/__tests__/undo-coverage-priorities.test.tsx packages/web/src/__tests__/undo-keys.test.tsx`
  - Expected: FAIL, "Color themes" still first after `u`
- [x] **Step 3: Record each write**, `PrioritiesList.tsx` staying under 500 lines
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(global-undo): every edit of the priorities and proposals can be undone"
```

## Task 8: Review comments join the stack

**Files:**

- Modify: `useReviewActions.ts`
- Test: `packages/web/src/__tests__/undo-coverage-reviews.test.tsx`

**Interfaces:**

- Consumes: as task 6.
- Produces: a comment's add ("Added a comment"), edit ("Edited a comment"), and removal ("Removed a
  comment"), and Start over ("Started the review over"), each with its toast; the place is the
  reviewed file's page, `/f/<folder>/<file>`, alone, as the review page selects no block on arrival.
  Each undo and redo reads the reviewed file again, so the page's comments come back from the file
  once it lands; an edit typed but not sent, kept or open, follows its comment's number back and
  forth, and a new comment typed stays. A refusal names the comment's first line, or "Your review"
  for Start over (ruling R14).

- [x] **Step 1: Write the failing test**: the rows "a first comment", "an edited comment", "a
      comment removed", and "Start over", on a spec of the fixture: after `u`, the review file is as
      before, absent after the first comment's undo, back with every comment after Start over's.
- [x] **Step 2: Run it to check it fails**: as task 6, no entry recorded, so no toast
- [x] **Step 3: Record each write**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(global-undo): review comments can be undone and redone"
```

## Task 9: `d` deletes at once

**Files:**

- Modify: `lists/useRowKeys.ts` (`deleteKey`), `lists/Card.tsx` (`deleting`), `InboxList.tsx`
  (`:319`, the `deleting` it sets), `fields/Confirm.tsx` (`deleteLine`, `deleteNote` go)
- Test: `undo-keys.test.tsx`; `inbox-note-delete.test.tsx` and `keys-row-editing.test.tsx` rewritten

**Interfaces:**

- Consumes: the delete entries of tasks 6 and 7.
- Produces: `d` deletes the row the focus is on at once; a second `d` deletes the next row. A
  category holding notes keeps its question.

- [x] **Step 1: Write the failing tests**
  - `undo-keys.test.tsx`: "d deletes at once; u brings it back and offers Redo; U deletes it again":
    `d` on "Color themes" in Next; no dialog; the toast "Deleted “Color themes” · waits on the Git
    page"; `u` puts it back, the toast "Undone: deleted “Color themes”", the status line `U redo`;
    Ctrl+Shift+Z deletes it again, and `U redo` leaves the status line.
  - Rewrite, as the spec's replaced behaviour lists: `inbox-note-delete.test.tsx`'s three tests
    become one, "d on a note with a note file deletes both at once, which u brings back";
    `keys-row-editing.test.tsx`'s "d deletes the line the focus is on, not the one edited before it"
    and "d on a note deletes it, not the note edited before it" drop `confirmDelete()`.
  - The break: a question still asked, or a delete without its entry.
- [x] **Step 2: Run them to check they fail**
  - Run: `nix develop -c vp test packages/web/src/__tests__/undo-keys.test.tsx`
  - Expected: FAIL, the dialog "Delete this line?" shows
- [x] **Step 3: Delete at once**
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(global-undo): d deletes at once"
```

## Task 10: The docs and the UI guides

**Files:**

- Modify: `docs/web-ui.md` (a new undo section), `specs/ui/surfaces.md` (`#undo`, the table, and the
  confirmations' list), `specs/ui/keyboard.md` (`d`, `u`, `U`, `Ctrl+Z`, `Ctrl+Shift+Z`),
  `specs/ui/guidelines.md` (the 5 seconds: a reminder, no longer the only way)

**Interfaces:**

- Produces: the docs' undo section lists what can be undone (the Undo decision's first rule), what
  cannot (committing, starting, git, settings), what asks first, the keys, the 50 entries, a reload,
  and the phone's toast.

- [x] **Step 1: Write the pages**, following the [documentation](../decisions/documentation.md)
      decision
- [x] **Step 2: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 3: Commit**

```bash
git add docs specs/ui
git commit -m "docs(global-undo): what can be undone, and its keys"
```

## Task 11: Remove the reverses the stack replaced

**Files:**

- Modify: `packages/server/src/fate/inbox-mutations.ts`, `mutations.ts`, `masked.ts`,
  `sent-lists.ts`, `views.ts`, their tests; `crates/binding/src/*.rs`;
  `crates/core/src/actions/inbox/undo.rs` (deleted), `categories.rs`, `unlink.rs`, `merge.rs`,
  `note_file.rs`, `agent.rs`, and the API and file functions only they served; their tests in
  `crates/core/tests/`

**Interfaces:**

- Consumes: no web caller left of `inbox.undo*`, `inbox.restoreCategory`, `inbox.restoreImage`,
  `inbox.insert`, `proposals.insert`, `proposals.undoCommitted`.
- Produces: those mutations, their binding functions, and the core functions no other code calls,
  removed with their tests: the inbox's `removed` and `imageRemoved` fields, which only the restores
  read, go too, `removeCategory` and `removeNoteImage` answering the inbox alone. The forward writes
  `inbox.category`, `inbox.edit`, and `inbox.toProposalFile` stay. Code a forward write still uses
  stays: the note files a removal holds (`HELD`) and the adds of note files to proposal files
  (`MERGED`, now their relinked files alone), both of which Discard reads.

- [x] **Step 1: Find what has no caller left**, by search and by the compiler's dead-code warnings
      once the mutations go
- [x] **Step 2: Remove it, and the tests of it alone**, listing each removed test in the commit body
- [x] **Step 3: Run the task's validation**: `nix develop -c vp run fast`, PASS
- [x] **Step 4: Commit**

```bash
git add crates packages
git commit -m "refactor(global-undo): remove the reverses the undo stack replaced"
```
