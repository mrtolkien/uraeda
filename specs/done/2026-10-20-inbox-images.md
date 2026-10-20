---
kind: change
finished: 2026-10-20
---

# Record: Inbox screenshots

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, merged locally without a pull request. Its full files are in git:
> `git log -- specs/changes/2026-10-20-inbox-images/`.

## What and why

The inbox needed to take screenshots like the other pages: attach, paste, or drop them, see them,
and have them committed. A note could carry one image, only when added, and nothing in the inbox
showed it.

## Behaviour

- The ＋ form takes several images, picked, dropped on the page, or pasted in the note's field, each
  with Remove. Pasted text that carries a picture of itself stays text.
- A note's page has "Add images" and takes drops. A note with no draft becomes a draft folder
  holding its text, its sub-items, and the images; its line keeps its place and marks, and links the
  draft. A note that links a draft gets the images in that draft.
- A note's page draws every image of its draft in order under its text, and its row shows a
  thumbnail of the first.
- `ura inbox clean` deletes the images of drafts and the backlog that no markdown file of their
  folder links, one path a line on stdout, and `--dry-run` only lists them. The deletion is left
  uncommitted.

## Design

The draft folder stays the home of a note's images, as the
[attachments](../decisions/attachments.md) decision has it. The core writes everything:
[`add_with_image` and `attach_to_note`](/crates/core/src/actions/inbox/image.rs) take a list of
images, link each at the end of What after a blank line, and fill each note's `images` where the
inbox is read. The server's `POST /inbox/note-image` takes one `file` per image and either a `text`
or a note `id` ([`attach.ts`](/packages/server/src/attach.ts)). The page draws them in
[`NoteImages`](/packages/web/src/pane/NoteImages.tsx) and the rows of
[`InboxPage`](/packages/web/src/InboxPage.tsx). The orphan rule stays in one place,
[`actions/images.rs`](/crates/core/src/actions/images.rs), where a commit of a folder already
applied it; [`ura inbox clean`](/crates/cli/src/inbox.rs) reuses it.

## Questions

### Round 01

#### Q1: Where should an image of a note live?

**Answer:** A: the draft stays the image's home. The human added: "We should also add a 'ura inbox
clean' or similar command that cleans up orphan images if there are any".

#### Q2: How should the inbox show a note's image?

**Answer:** A: in the note's pane, and a thumbnail on its row.

#### Notes

- **Several images**: the human disagreed with limiting a note to one image: there could be two
  inline images in a note, or in bullet points.

## Changes after approval

- The new `ura inbox clean` command is a change to a public interface, which the change flow lists
  as a reason to upgrade to a feature. The human asked for it in their answer, so it was built here.
- A row with an image is taller than the others, since Astryx's thumbnail has a fixed size.

## Follow-ups

- Images in a note's sub-items stay in the draft: a note's own line cannot hold one inline.
- `packages/web/src/Prose.tsx`, on the default branch, imports Astryx's Markdown, which the stack
  test `no package depends on a markdown parser` refuses: it fails on the default branch too.
