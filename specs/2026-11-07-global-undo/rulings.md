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

## R6: The scope of an image's removal and an image's attachment

- **Decision**: an image's removal records the inbox and the folder of the file it leaves, a note
  file's or a proposal file's, rather than `NOTES`; an image attached to a single proposal file or
  note file records all of `specs/`, the file becoming a folder and its links followed in every
  file, and one attached to any other file, its folder.
- **Rationale**: `removeNoteImage` also takes images out of proposal files, outside `specs/notes`,
  and the relink of a single file that becomes a folder may write any file of `specs/`: a narrower
  scope would leave part of the write out of its undo.
- **If wrong**: a large `specs/` makes the first image of a single file slower to record; the scope
  narrows to the lists and the file's folder at the cost of links elsewhere left moved.
- **Where**: task 1
