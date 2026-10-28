---
kind: change
finished: 2026-10-29
pull-request: https://github.com/mrtolkien/uraeda/pull/64
supersedes:
  [
    2026-10-10-cli-core,
    2026-10-15-add-scratchpad,
    2026-10-18-start-draft-folder,
    2026-10-20-inbox-images,
  ]
---

# Record: Proposal naming

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-28, finished on
> 2026-10-29, in [its pull request](https://github.com/mrtolkien/uraeda/pull/64). Its full files are
> in git: `git log -- specs/changes/2026-10-28-proposal-naming/`.

## What and why

One name for each unit of work, from its first line to its done record, in the skill, `ura`, the
editor, the server, and the web UI. The same row of `PRIORITIES.md` was a priority, an entry, a
line, and an item, and "create a priority" made no sense: a priority is a rank, not a thing. "Draft"
named a stage of the same thing, a note with images secretly became one, and `backlog/` duplicated
**Later**. Now a row is a proposal, a line or a file, and a note is a line or a file.
`PRIORITIES.md` keeps its name: it holds information about priorities.

## Behaviour

- A row of `PRIORITIES.md` is a proposal everywhere: "New proposal", "＋ Proposal", "Add a
  proposal", "Add as a file" for a note with images, and the refusals say proposal. Priorities names
  only the file, its page, and its view.
- A proposal file lives in `specs/proposals/<slug>.md`, or `<slug>/proposal.md` with its `images/`
  and, for a postponed feature, its other files. `specs/drafts/` and `specs/backlog/` are no longer
  read.
- Expand turns a proposal line into a file, as Draft did: `ura expand <text>`, the editor's
  `uraeda.expand`, and the priorities' `p`. `ura start <proposal>` reads only `specs/proposals/`.
- A note with images has a note file, `specs/notes/<slug>/note.md` with its `images/`, the content a
  note's draft had. Only a link into `specs/notes/` is a note's file.
- A note moved to the proposals, as a line, a new proposal file, or a line of an existing proposal
  file, takes its note file along to `specs/proposals/`, `note.md` becoming `proposal.md`, and links
  its new path. Undo and Discard move it back; the commit carries the move. A note file two notes
  link stays for the other one, and the moved note goes as text.
- Removing a note removes its note file only when nothing is lost: the file holds what the note
  wrote, or matches its committed version. Otherwise only the line goes, and `ura check` warns about
  the note file no note links. Undo writes a removed file back byte for byte.
- `ura check` reports `specs/drafts/` or `specs/backlog/` holding files as `layout.old-folder`, and
  points to "Moving drafts and the backlog to the proposals" in the skill: one commit on the default
  branch, the backlog linked under **Later**.
- Setup creates `proposals/`, `decisions/`, `changes/`, and `done/`. A note file commits as
  `chore: add the note <title>`, then `chore: edit the note <title>`; a proposal file as
  `chore: expand <title>`.
- A change started from a note file takes the file's title and body, then its images.

## Design

A rename through every layer, with one vocabulary and a few behaviour changes for note files. The
core holds every rule: the rows and proposal files in
[`files/priorities.rs`](/crates/core/src/files/priorities.rs),
[`actions/expand.rs`](/crates/core/src/actions/expand.rs), and
[`api/proposal_files.rs`](/crates/core/src/api/proposal_files.rs); the note file's moves and removal
guard in [`actions/inbox/moves.rs`](/crates/core/src/actions/inbox/moves.rs) and
[`actions/inbox/note_file.rs`](/crates/core/src/actions/inbox/note_file.rs), whose Undo holds the 16
latest removed files in memory; the old-folder and unlinked-note checks in
[`check/names.rs`](/crates/core/src/check/names.rs) and
[`check/notes.rs`](/crates/core/src/check/notes.rs). The binding's exports, the fate mutations
(`proposals.*` for a row, `priorities.commit` and `priorities.discard` for the file), and the web
UI's components follow the core's names. This repository's own drafts moved to `specs/proposals/`.

## Gotchas

- The workspace's rows stay `WorkspaceView.priorities`, as `proposals` names its proposal files:
  [`view.rs`](/crates/core/src/view.rs).
- "Line" and "entry" stay where they are precise, a proposal line or a row that is a note or a
  proposal, and the session composer's `useDraft` is a message's draft:
  [`packages/web/src/`](/packages/web/src/).
- After a server restart, a removed note's Undo puts its line back without its file; a committed one
  comes back with Discard.
- A change started from a note file keeps "Image N" alts, as a typed change does: keeping the file's
  own names would need the core's start to take them.

## Decisions

- [Git](/specs/decisions/git.md): proposal files, note files, and the human's inbox and priorities
  are written on the default branch.
- [Attachments](/specs/decisions/attachments.md) and [TUI](/specs/decisions/tui.md) say proposal
  files.

## Changes after approval

- Removing a note keeps a note file holding the human's uncommitted edits, unlinked, where the
  proposal said a removed note's file goes with it.
- A note going into an existing proposal file takes its note file along, and a note file two notes
  share stays with the other one.
- The links of `specs/done/` into the moved drafts point to `specs/proposals/`.
