# Rulings: Inbox screenshots

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions and of [the answers](clarifications-01.md). None binds future work: those are decisions.

## R1: A note's sub-items move into its draft when it takes its first images

- **Decision**: a note that links no draft becomes a draft folder holding its text, then its
  sub-items under What, then the images. Its line in the inbox keeps its place and marks, becomes a
  link to the draft, and loses its sub-items.
- **Rationale**: the draft is the note's home, as [Organize](/skills/uraeda/references/inbox.md)
  already makes it for "A new draft", where the sub-items follow the text. Leaving them in the inbox
  would show the same lines twice.
- **Alternatives considered**: keeping the sub-items in the inbox too, which doubles them; refusing
  a note with sub-items, which blocks the common case.
- **If wrong**: the lines are in the draft's What, one edit away from where they were.
- **Where**: [`attach_to_note`](/crates/core/src/actions/inbox/image.rs), and
  [`relink`](/crates/core/src/files/inbox.rs).

## R2: An orphan image is one no markdown file of its folder links

- **Decision**: `ura inbox clean` deletes the files of `images/` in each draft and backlog folder
  that no markdown file of that folder links. It leaves the deletion uncommitted, and prints each
  path on stdout.
- **Rationale**: the answer asks for a command that cleans orphan images. The same rule already
  deletes them when a folder is committed, so it stays in one place,
  [`actions/images.rs`](/crates/core/src/actions/images.rs).
- **Alternatives considered**: also deleting draft folders that nothing links, which risks the
  human's text; committing the deletion, which `ura note` does only for the file it wrote.
- **If wrong**: git restores any tracked image. An untracked one is lost, as a commit of its folder
  would lose it.
- **Where**: [`ura inbox clean`](/crates/cli/src/inbox.rs).

## R3: The command is `ura inbox clean`, with `--dry-run`

- **Decision**: the answer's "or similar" is `ura inbox clean`, since `ura clean` already removes
  merged features' worktrees and branches.
- **Rationale**: the name the human gave is free, and says what it works on.
- **Alternatives considered**: `ura clean --images`, which mixes two unrelated cleanups.
- **If wrong**: a rename in the CLI, its test, and the skill's table.
- **Where**: [`ura inbox`](/crates/cli/src/inbox.rs), and the skill's
  [CLI table](/skills/uraeda/references/cli.md).

## R4: A row's thumbnail is Astryx's `Thumbnail`, at its own size

- **Decision**: a note's row shows its first image with Astryx's `Thumbnail`, among its marks.
- **Rationale**: `Thumbnail` is the component for image previews and has no size prop, so a row with
  an image is taller than the others, about 74 px against 44 px.
- **Alternatives considered**: a bare `img` at a smaller size, which the lint rules refuse.
- **If wrong**: the theme owns the size: change it there, in one place.
- **Where**: [`RowMarks`](/packages/web/src/InboxPage.tsx).

## R5: Drop and paste work where the note is typed or read

- **Decision**: a file dropped on the page goes to the focused field, else to the registered one of
  the highest priority: the add form's note field or the open note's pane. A paste of an image works
  in the form's note field only, since the pane has no text field. Pasted text that carries a
  picture of itself stays text.
- **Rationale**: this is the drop target rule and the paste rule of the other pages, reused.
- **Alternatives considered**: a paste anywhere on the pane, which no other page offers.
- **If wrong**: the pane can register a paste handler of its own.
- **Where**: [`AddNote`](/packages/web/src/AddNote.tsx) and
  [`NoteImages`](/packages/web/src/pane/NoteImages.tsx).
