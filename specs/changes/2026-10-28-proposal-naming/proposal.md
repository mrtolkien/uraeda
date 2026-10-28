---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Proposal naming

## What

One name for each unit of work, from its first line to its done record, everywhere: the skill, its
templates and example, `ura`, the editor plugin, the server, and the web UI.

- **A row of `PRIORITIES.md` is a proposal.** Not a priority, an entry, a line, or an item. "New
  proposal", "Add a proposal to Next", "turn each note into a proposal, or nothing". A proposal
  becomes a feature or a change when it starts, and its file becomes that folder's `proposal.md`.
- **A proposal is either a line or a file.** "Draft" goes away as a concept: `specs/drafts/` becomes
  a folder of proposal files, and turning a line into a file is no longer "drafting".
- **A note is either a line or a file**, the same way. A note with images is a note file, not a
  draft.
- **`backlog/` is removed.** A proposal not scheduled is one under **Later**, its file with the
  others.
- **`PRIORITIES.md` keeps its name**: it holds information about priorities, its rows are not
  priorities.

## Why

The same row is called a priority ("New priority", "no priority {id}"), an entry ("move the entry to
the top of Now"), a line ("no line of PRIORITIES.md matches"), and an item ("a dropped item").
"Create a priority" makes no sense: a priority is a rank, not a thing, and it already means a
story's `(P1)` and the constitution's ordering. "Draft" names a stage of the same thing, and a note
with images "becomes a draft", so a note's file is secretly a proposal. `backlog/` duplicates
**Later**, and this repository no longer uses it.

## Notes

- Proposal files live in `specs/proposals/<slug>.md`, note files in `specs/notes/<slug>.md`, each a
  folder once it has images. Moving a note to the proposals moves its file between the two.
- "Expand" turns a line into a file: `ura draft` becomes `ura expand`, and `ura start <draft>`
  becomes `ura start <proposal>`.
- The rename goes through the code too: identifiers, files, and API and mutation names. Priorities
  stays only where it names the file.
- Deleting a note deletes its file: today, a note linking a draft loses its line only.
- A postponed feature goes back to the proposals' folder, with its discovery files.
- The draft pull request keeps its name: it is GitHub's.
- Existing projects need a migration, like the scratchpad's move to the inbox: `drafts/` and
  `backlog/` moved, backlog files linked under **Later**, and note-linked drafts moved to the notes.
- Decisions to amend: [git](/specs/decisions/git.md) ("Drafts, the backlog, and the human's inbox
  and priorities MUST be written on the default branch") and
  [attachments](/specs/decisions/attachments.md) ("draft folder"). [tui](/specs/decisions/tui.md)
  only links a draft and names a "draft TUI".
- Built on the ui-fixes branch, whose UI no longer has the "draft" meaning "not committed". Its pull
  request is stacked on ui-fixes.
