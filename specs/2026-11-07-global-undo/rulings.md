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
  file and its folder. A promotion that moves a note file or takes it into a proposal,
  `noteToProposalFile`, `noteIntoProposal`, and `noteIntoProposalLine`, records
  `RELINKING_PROMOTION`: `PROMOTION` and every Markdown file of `specs/`, as its relink may write
  any of them.
- **Rationale**: `removeNoteImage` also takes images out of proposal files, outside `specs/notes`,
  and a relink may write any Markdown file of `specs/`: a narrower scope would leave part of the
  write out of its undo. A relink writes Markdown only, so the images and other files of `specs/`
  stay out of the snapshot, which keeps its cost to the Markdown's bytes.
- **If wrong**: a large `specs/` makes these writes slower to record; the scope narrows to the lists
  and the file's folder at the cost of links elsewhere left moved.
- **Where**: task 1, `api::undo::{MARKDOWN, RELINKING_PROMOTION, attached}`

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
  undo is refused, as any other. The entry is recorded when the run of uploads ends.
- **Rationale**: the editor saves the links right after the images are written, through `text.save`,
  which records no change: the image's change alone would be refused at once, its file moved into
  its folder and then saved, or would leave the links pointing at images it deleted.
- **If wrong**: `text.save` answering its change, as the other writes do, makes the editor's own
  saves undoable too, and this entry the join of two answered changes.
- **Where**: task 7, `packages/web/src/attach/attachUndo.ts`
