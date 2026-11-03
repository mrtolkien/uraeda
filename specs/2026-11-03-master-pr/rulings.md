# Rulings: "Master" PR

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The inbox reader places agents' notes as lines of a joined text

- **Decision**: the reader joins `INBOX.md` with one line per agent's note file, the line a linked
  note file has, `- [agent] [<about>] [<title>](notes/<file>)`, at the end of its category, and
  parses the joined text with the existing parser. Each note keeps the id it has in `INBOX.md`; an
  agent's note's id is its file's path from the top level, `specs/notes/<file>`.
- **Rationale**: the parser, the diff of the commit bar, and the note's images already handle a
  linked note file, so an agent's note needs no second model. A path is a stable id, which a merge
  bringing another agent's note cannot shift, and no `note-<n>` of `INBOX.md` can take.
- **Alternatives considered**: ids counted after `INBOX.md`'s notes, `note-<n>`: they shift when a
  merge adds a file sorted before, and the inbox's hash covers `INBOX.md` alone, so a stale id would
  not be refused.
- **Where**: task 1, `crates/core/src/files/inbox/agent.rs`

## R2: An action on an agent's note writes its line first

- **Decision**: every action that takes a note's id first turns an agent's note into its line, at
  the end of its category in `INBOX.md`, then runs as for a linked note file. A move also drops the
  file's `category`. A removal leaves `INBOX.md` as it was, and deletes the file; its Undo writes
  the line back, linking the file it restores.
- **Rationale**: the spec's architecture gives the actions one owner of the turn into a line, and
  the actions on a linked note file already remove, move, and promote its file.
- **If wrong**: an action that forgets the turn refuses with "no note", losing nothing.
- **Where**: task 2, `crates/core/src/actions/inbox/agent.rs`

## R3: `ura note --agent` on the default branch writes a line, as before

- **Decision**: in a feature's or a change's worktree, `--agent` writes a note file. On the default
  branch's checkout, it writes a line of `INBOX.md`, as today.
- **Rationale**: the spec's conflicts come from branches; a line written on the default branch
  conflicts with nothing, and the git decision forbids only a branch's write of `INBOX.md`.
- **Where**: task 3, `crates/cli/src/note.rs`

## R4: An agent's note file is named from four words

- **Decision**: `<slug>-<words>.md`, `<words>` the slug of the note's first four words, apostrophes
  dropped first: "The workspace record's running is read by no view" gives
  `the-workspace-records-running`. Without a slug to write, the name is the words alone.
- **Rationale**: the spec's scenario names the file
  `feature-state-the-workspace-records-running.md`.
- **Where**: task 3, `crates/core/src/actions/inbox/agent_file.rs`
