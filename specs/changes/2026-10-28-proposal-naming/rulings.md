# Rulings: Proposal naming

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
active decisions. None binds future work: those are decisions.

## R1: A removed note's file goes only when nothing is lost

- **Decision**: removing a note deletes its note file only when the file holds only what the note
  wrote, or matches its committed version byte for byte. Otherwise the line goes and the file stays,
  unlinked. Removing and committing also deletes a file that was committed, since history keeps it.
- **Rationale**: the [git decision](/specs/decisions/git.md) says tools never lose the user's work,
  and a note file typed into and never committed exists nowhere else.
- **Alternatives considered**: deleting it whatever it holds, with the removal's Undo as the only
  way back: a server restart would lose it for good.
- **Where**: `crates/core/src/actions/inbox/note_file.rs`

## R2: The removal's Undo holds the file's bytes in memory

- **Decision**: the core keeps the 16 latest removed note files, per repository and path, and the
  Undo writes them back byte for byte, images included. After a restart, the Undo puts the line back
  without its file; a committed one still comes back with Discard.
- **Rationale**: `removeNote` and `insertNote` keep their signatures, and an Undo follows its
  removal.
- **Where**: `crates/core/src/actions/inbox/note_file.rs`

## R3: Only links into `specs/notes/` are a note's file

- **Decision**: a note linking a proposal file, or anything outside `specs/notes/`, has no note
  file: it moves as text, nests under a proposal, and takes images into a new note file. A note file
  two notes link is not deleted with one of them.
- **Rationale**: the proposal's "a note is a line or a file" holds only if the file is the note's
  own.
- **Where**: `crates/core/src/files/inbox.rs`

## R4: A note file keeps its name when it becomes a proposal

- **Decision**: `specs/notes/x/note.md` becomes `specs/proposals/x/proposal.md`, or `x-2/` when the
  name is taken; a single `specs/notes/x.md` becomes `specs/proposals/x.md`. The undo finds the line
  by its rewritten link, so it takes no new argument.
- **Rationale**: the move is a pure move, the file's content already being proposal-shaped.
- **Where**: `crates/core/src/actions/inbox/moves.rs`

## R5: A note file uses the proposal file's editor, without Research effort

- **Decision**: the editor tells files apart by `ProposalFileView.kind`, `proposal-file`,
  `note-file`, or `proposal`. A note file has Commit, and no Start or Research effort. Its commits
  are `chore: add the note <title>`, then `chore: edit the note <title>`.
- **Rationale**: research effort only matters to a proposal that starts.
- **Where**: `packages/web/src/EditorPage.tsx`, `crates/core/src/api/proposal_files.rs`

## R6: The rows keep `priorities` where `proposals` was taken

- **Decision**: the workspace's `drafts` became `proposals` (the files), so its rows stay
  `WorkspaceView.priorities`, the file's rows. The Find picker's "Priorities" kind stays too.
- **Rationale**: one field per meaning, with the brief's names for the files.
- **Where**: `crates/core/src/view.rs`

## R7: Mutations on a proposal are `proposals.*`

- **Decision**: fate's row mutations moved to `proposals.*`, with Expand as `proposals.expand`,
  since it takes a proposal's id. `priorities.commit` and `priorities.discard` act on the file and
  stay.
- **Where**: `packages/server/src/fate/mutations.ts`

## R8: "Line" and "entry" stay where they are the precise word

- **Decision**: "line" stays for a proposal line (`StartLine`, the New page's `line` kind), and
  "entry" for a row that is a note or a proposal (`EntryPane`, `NewEntries`, the sidebar's entries).
  The session composer's `useDraft` keeps its name: it is a message's draft.
- **Where**: `packages/web/src/`

## R9: `ura check` reports an old folder, and setup keeps `done/`

- **Decision**: `layout.old-folder` is an error on `specs/drafts/` or `specs/backlog/` holding a
  file other than `.gitkeep`, pointing to the migration in the skill. Setup creates `proposals/`,
  `decisions/`, `changes/`, and `done/`.
- **Rationale**: tools read only `proposals/`, so an old folder would silently vanish from the UI.
- **Where**: `crates/core/src/check/names.rs`, `crates/core/src/actions/init.rs`

## R10: A proposal file with no line behind it is `chore: expand <title>`

- **Decision**: every proposal file written on the default branch is committed as
  `chore: expand <title>`, including a change's in a harness without Uraeda and a split-out item.
  Postponing moves the proposal to the section the human names, **Later** when not scheduled.
- **Rationale**: `chore: draft` covered all of them before; one message keeps `git log` searchable.
- **Where**: `skills/uraeda/references/conventions.md`, `skills/uraeda/references/projects.md`

## R11: Links into the moved drafts are rewritten in records

- **Decision**: three links of `specs/done/` to `../drafts/` point to `../proposals/`, as finishing
  rewrites links into a moved folder. Nothing else in a record changed.
- **Where**: `specs/done/2026-10-10-cli-core.md`, `specs/done/2026-10-19-redesign-session.md`
