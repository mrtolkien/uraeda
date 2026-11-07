# Rulings: Global undo

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: One recorded change replaces the per-kind reverses

- **Decision**: the core records each undoable write as a change, the bytes of each file under the
  write's scope before and after it, and one function replays it backwards for an undo and forwards
  for a redo, refusing once a file no longer holds what it expects. The spec's architecture names
  "one reverse per kind of edit that lacks one", and the deletes "through their existing reverses":
  every kind uses the change instead, and the existing reverses go in task 11.
- **Rationale**: every entry needs a redo too, which none of the existing reverses has, and about
  fifteen new reverses plus fifteen redos would each be hand-written and tested. The change already
  exists for deferred commits ([`deferred/undo.rs`](/crates/core/src/actions/deferred/undo.rs)). It
  keeps every promise of the spec: in the core, no git command, refused with the file's name once it
  changed since, and an image or note file brought back with its bytes.
- **Alternatives considered**: the per-kind reverses of the spec's architecture, with a redo that
  re-runs the forward write; two mechanisms side by side for the kinds that have a reverse and those
  that lack one.
- **If wrong**: an existing reverse was more forgiving, finding its lines again after another edit
  of the same file; the change refuses any edit since, as the spec's edge cases ask. Going back
  means restoring the removed reverses from git.
- **Where**: tasks 1, 4, and 11

## R2: Every undoable action but a move keeps a toast

- **Decision**: a row's add and edit, a comment's add and edit, and every other undoable action show
  their toast for 5 seconds; only moves show none.
- **Rationale**: the clarifications settled that "each undoable action still shows what it did for 5
  seconds, with its Undo", and the spec's review took the toast away from moves alone.
- **If wrong**: a toast on every saved row may feel noisy while writing a list; dropping it for adds
  and edits is one `toast: false` per call.
- **Where**: tasks 6 to 8

## R3: `d` alone deletes, and `dd` deletes two rows

- **Decision**: with no question, `d` deletes the row at once; a second `d` deletes the next row,
  undone by a second `u`.
- **Rationale**: the human answered "Dd disappears and becomes d"; the second `d` answered the
  question before.
- **Where**: task 9

## R4: The binding records a change under a token

- **Decision**: each undoable binding function takes a last optional token, and `takeChange` hands
  over the change recorded under it.
- **Rationale**: the recording must happen inside the write's own core call, under its lock, and a
  token adds an optional parameter rather than changing the answer of about 25 functions and their
  callers.
- **Where**: tasks 1 and 4

## R5: Two binding functions fold two arguments to take the token

- **Decision**: `addComment` takes its lines as one `lines?: { start, end? }` instead of `startLine`
  and `endLine`, and `addNoteWithImages` its category and `about` as one
  `note?: { category?, about? }`, so that each takes the `undo` token within 7 arguments.
- **Rationale**: clippy's limit of 7 arguments, from the code quality decision, refuses an eighth,
  and a lint exemption is a new marker, which needs the human's approval. Each function has one
  caller in the server, changed with it.
- **If wrong**: an exemption marker, approved, would give back the separate arguments.
- **Where**: task 1, and the server's `attach.ts` and `fate/file-mutations.ts`

## R6: The scope of an image's removal, an image's attachment, and a relinking promotion

- **Decision**: an image's removal records the inbox and the folder of the file it leaves, a note
  file's or a proposal file's, rather than `NOTES`; an image attached to a single proposal file or
  note file records the file, the folders named after it, and every Markdown file of `specs/`, the
  file becoming a folder and its links followed in every file; one attached to any other file, the
  file and its folder. A note's images attached from the inbox, `attachNoteImages`, record
  `NOTE_IMAGES`: `NOTES` and every Markdown file of `specs/`, as a single note file becomes a folder
  and its links are followed. A promotion that moves a note file or takes it into a proposal,
  `noteToProposal`, `noteToProposalFile`, `noteIntoProposal`, and `noteIntoProposalLine`, records
  `RELINKING_PROMOTION`: `PROMOTION` and every Markdown file of `specs/`, as its relink may write
  any of them.
- **Rationale**: `removeNoteImage` also takes images out of proposal files, outside `specs/notes`,
  and a relink may write any Markdown file of `specs/`: a narrower scope would leave part of the
  write out of its undo. A relink writes Markdown only, so the images and other files of `specs/`
  stay out of the snapshot, which keeps its cost to the Markdown's bytes.
- **If wrong**: a large `specs/` makes these writes slower to record; the scope narrows to the lists
  and the file's folder at the cost of links elsewhere left moved.
- **Where**: task 1, `api::undo::{MARKDOWN, NOTE_IMAGES, RELINKING_PROMOTION, attached}`

## R7: The stack's method is `record`, not `push`

- **Decision**: entries go on the stack with `undoStack.record(entry)`.
- **Rationale**: the linter's fix, run by the commit hook, merges two calls to a method named `push`
  into one `push(a, b)`, taking it for an array's: the stack takes one entry, so the second would be
  lost silently.
- **Where**: task 3, `packages/web/src/undo/stack.ts`

## R8: `undo.apply` and `undo.committed` answer one record type

- **Decision**: both mutations answer an `Undo` record, `{ id, commit, committed }`, each setting
  its own field and the other null, and `undoable` takes the context, whose binding hands over the
  change.
- **Rationale**: a fate mutation answers a record type with a data view, a source, and an export for
  the generated client: one type for two answers read once is half of that. The binding is the
  context's in the server, as the tests replace it.
- **If wrong**: splitting it into two types is a second data view and its registrations.
- **Where**: task 4, `packages/server/src/fate/views-undo.ts`

## R9: The promotions record their change in task 5

- **Decision**: the four promotions of a note (to a level, under a proposal, into a proposal file,
  into a proposal line) record `changeEntry` with the change they answer in task 5, rather than
  their own undo with a redo, ahead of task 6. Every other existing caller keeps its own undo until
  tasks 6 to 8.
- **Rationale**: task 5's test of a committed action undoes a promotion, and only an entry made from
  a change has the committed check; the change also gives the promotions their redo.
- **If wrong**: the promotions' own reverses (`inbox.undoToProposal` and the others) were more
  forgiving of an edit of either file since; going back is their former toast's undo, from git.
- **Where**: task 5, `packages/web/src/useNoteActions.ts`

## R10: Every action's toast says it waits on the Git page

- **Decision**: `useUndo` adds ` · waits on the Git page` to every entry's label, those whose toast
  did not say it before too ("Removed … from the note's file", "Deleted the note"), but for the New
  page's "Draft replaced", which the browser holds.
- **Rationale**: the spec's toast of an action is its label and ` · waits on the Git page`; each of
  these writes does wait on it.
- **Where**: task 5, `packages/web/src/undo/useUndo.ts`; `inbox-images.test.tsx` reads the new text

## R11: The UI coverage test is split in three files, by task

- **Decision**: SC-002's UI test is three files, one per task that records writes:
  `undo-coverage-inbox.test.tsx` (task 6), `undo-coverage-priorities.test.tsx` (task 7), and
  `undo-coverage-reviews.test.tsx` (task 8), rather than one `undo-coverage.test.tsx`.
- **Rationale**: tasks 6 to 8 run in parallel, each on its own branch: one file written by the three
  would conflict at each merge. Each file holds its own helpers, which keeps `__tests__/helpers.tsx`
  out of the conflict too.
- **If wrong**: merging the three files into one is a move of their tests, with their helpers.
- **Where**: tasks 6 to 8, `packages/web/src/__tests__/undo-coverage-*.test.tsx`

## R12: A drop that nests a note is recorded, but no UI row drags

- **Decision**: a drop through `inbox.drop`, nesting a note or moving a nested row, records a move
  as the keys' moves do, but the coverage test has no row of its own for it: its rows move by keys
  (`Tab`, `Shift+Tab`, `K`, `L`, `m`, `c`), which write through `inbox.outline` and `inbox.place`.
- **Rationale**: the UI tests have no way to drag a row in happy-dom; the drop's recording is the
  same `run` with `movedWrite` as `inbox.place`'s, which the rows check.
- **If wrong**: a drop that records nothing would go unnoticed until a drag test exists.
- **Where**: task 6, `packages/web/src/InboxList.tsx`

## R13: An image attached from an editor is undone with the save that links it

- **Decision**: the entry of images attached to a proposal or note file from its editor joins the
  changes `POST /attach` answered with the save of the text that links them: its first undo reads
  the file, and when its text is still the one the run saved, takes the file's bytes then as the
  `after` side of that file, then writes the whole change back. Once the text changed since, the
  undo is refused, as any other. The entry is recorded once the save of the links landed (R18).
- **Rationale**: the editor saves the links right after the images are written, through `text.save`,
  which records no change: the image's change alone would be refused at once, its file moved into
  its folder and then saved, or would leave the links pointing at images it deleted.
- **If wrong**: `text.save` answering its change, as the other writes do, makes the editor's own
  saves undoable too, and this entry the join of two answered changes.
- **Where**: task 7, `packages/web/src/attach/attachUndo.ts`

## R14: A review's refusal names the comment, or the review

- **Decision**: the undo or redo of a comment's add, edit, or removal, refused, names the comment by
  its first line: "Could not undo: “Say it stays.” changed since in spec-review.md."; Start over's
  names the whole review: "Could not undo: “Your review” changed since in spec-review.md.". The
  entry's place is the reviewed file's page alone, as the review page selects no block on arrival.
- **Rationale**: a comment's number moves as others are removed, and its text is what the human
  wrote; Start over drops every comment at once, the page's "Your review".
- **If wrong**: the subject is one argument of `useRecord` in `useReviewActions.ts`.
- **Where**: task 8, `packages/web/src/useReviewActions.ts`

## R15: A change's bytes travel to the tab and stay with the stack's entries

- **Decision**: a write answers its change whole, each file's bytes before and after it in base64,
  and the tab keeps it in the stack's entry, 50 entries at most, sending it back with each undo and
  redo. Both sides are kept: an undo writes the before side and checks the file still holds the
  after side, a redo writes the after side and checks the before.
- **Rationale**: the spec keeps the stack in the tab's memory, which a reload empties; the change is
  what the entry replays, so it lives where the entry does.
- **Rejected**: keeping the bytes on the server under an id, which the entry would send back: a
  server restart loses them while the tab still offers the undo, and the stack's memory moves to the
  server, for every tab it serves.
- **If wrong**: a cap on the bytes an entry keeps, past which the action records no undo, or asks
  before running as one that loses work for good.
- **Where**: tasks 3 and 4, `crates/binding/src/undo.rs` and `packages/web/src/undo/changeEntry.ts`

## R16: A run of moves is named and placed after its first move, in both lists

- **Decision**: a run of moves of the inbox or of the priorities keeps the label, the place, and the
  refusal's subject of its first move, "Moved “Third”" for `K` on Third then `J` on First within the
  second; its change goes from before the first move to after the last. Both lists' labels quote a
  row through one `quoted` in `undo/quoted.ts`, cut to its first words past 40 characters. An edit's
  and a rename's refusal names the row's new text, which the file holds once it landed: the label of
  a rename still names the old one, "Renamed “Second”".
- **Rationale**: the inbox named a run after its first move and the priorities after its last, and
  quoted a row whole where the priorities cut it: one rule reads the same on both pages. The first
  move is where the run started, and what its undo puts back, the row selected where it was.
- **If wrong**: naming a run after its last move is the join keeping the later entry's label and
  place, in `inboxEntry` and `moveEntry`.
- **Where**: `packages/web/src/undo/quoted.ts`, `inboxUndo.ts`, `lists/prioritiesUndo.ts`,
  `pane/useProposalActions.ts`

## R17: An expand's place is the priorities, the proposal selected

- **Decision**: the entry of `e` and of the pane's Expand is placed at `/priorities` with the
  proposal's key selected, not at the file's page the expand opened, and each undo and redo reads
  the file again, for a page open on it.
- **Rationale**: the undo deletes the file: a trip to its page would open a file that is gone, while
  the proposal's line is what comes back. The plan's place, "the proposal's file", is changed with
  it.
- **If wrong**: a redo could open the file again, its place following the last replay, as R18's
  does.
- **Where**: `packages/web/src/lists/prioritiesUndo.ts` (`useRecordExpand`), `pane/useExpand.ts`

## R18: An image attached from an editor is recorded once its links are saved, and placed where the file is

- **Decision**: the entry of a run of images attached from an editor is recorded once the save of
  the text that links them landed, on the page open, or on the folder's page the file moved to, not
  as the run of uploads ends. Its undo compares the whole file, frontmatter included, with what that
  save wrote. Its place follows the last replay: the file's path as the run started after an undo,
  and the path the run left, in its folder, after a redo.
- **Rationale**: recorded before the save, a `u` pressed at once found the file without its links,
  was refused, and lost the entry. One place could not serve both: a single file that became a
  folder is absent at its first path after a redo, and the folder absent after an undo.
- **If wrong**: the toast shows a moment later than the images, once the text is saved; an undo
  awaiting the pending save instead would show it as the run ends.
- **Where**: `packages/web/src/attach/attachUndo.ts`, `attach/useEditorImages.ts`

## R19: A round's settled comments stay out of the stack

- **Decision**: the comments written on a round's settled questions, their add, edit, and removal
  (`settled.comment`, `settled.edit`, `settled.remove` in `settledWrites.ts`), record no entry.
- **Rationale**: they are part of answering a round, which the clarifications' Q1 answer A left out
  of the stack, like the round's answers and notes: Submit sends them with the answers, and until
  then they are text being written, which a form edits and removes in place.
- **If wrong**: each write selecting a change view and recording `changeEntry`, as the review's
  comments do in `useReviewActions.ts`.
- **Where**: `packages/web/src/settledWrites.ts`

## R20: Images attached in a comment's or an answer's form are not entries of their own

- **Decision**: an image attached in a form whose text is not yet sent, a question's comment
  (`QuestionComment.tsx`), a round's notes (`RoundNotes.tsx`), a review's comment
  (`useReviewImages.ts`), or the mockup page's comment (`MockupPage.tsx`), records no entry; the
  comment that sends its link does, where its write is undoable.
- **Rationale**: the image belongs to text not yet sent, like the typed saves of a field, which the
  field's own history takes back: an entry for the image alone would delete a file the form's text
  still links.
- **If wrong**: the form's upload answering its change, joined to the comment's entry once sent.
- **Where**: `packages/web/src/QuestionComment.tsx`, `RoundNotes.tsx`, `useReviewImages.ts`,
  `MockupPage.tsx`
