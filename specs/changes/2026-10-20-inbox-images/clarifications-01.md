---
status: answered
---

# Clarifications, round 01: Inbox screenshots

> [!NOTE]
>
> Answered on 2026-10-20.
>
> - Verdict: worth building, with changes: a note can carry one image today, but only as a new note.
>   Notes that exist need a home for theirs.
> - Where an inbox image is stored decides whether this stays a change: the layout under `specs/` is
>   what every project has.
> - Today a note's image is only reachable through its draft: nothing shows it in the inbox.
> - Pasting or dropping an image on the inbox is added as the other pages do, without asking.

## Context

### Goal

The [proposal](proposal.md) wants the inbox to take screenshots, as proposals, reviews, and answers
do. You attach, paste, or drop an image, see it, and it is committed with the file.

### Today

Other pages attach images to a file in a feature's folder. The core encodes the image to WebP. It is
committed in the folder's `images/` and linked from the file with a relative markdown image, as the
[attachments](../../decisions/attachments.md) decision requires. The editor page, the review forms,
and the answer fields all offer an attach button, and take a paste or a drop
([`useImageDrop`](/packages/web/src/attach/useImageDrop.ts)).

The inbox differs, because `INBOX.md` is one file with no folder of its own:

- The ＋ form ([`AddNote`](/packages/web/src/AddNote.tsx)) has "Attach an image" for one image. The
  core ([`add_with_image`](/crates/core/src/actions/inbox/image.rs)) then writes the note as a draft
  folder holding the image, and the note links the draft, as
  [Inbox](/skills/uraeda/references/inbox.md) says.
- An existing note, in [`NotePane`](/packages/web/src/pane/NotePane.tsx), cannot take an image. No
  page of the inbox draws one: you reach it only by opening the draft.
- The form takes no paste and no drop.

### Scope

The inbox page, a note's pane, and the ＋ form. Images on other pages, and how the core encodes
images, stay as they are.

### Sources

- The [attachments](../../decisions/attachments.md) decision: images sit beside their file, leave
  with their feature, and a record never links one.
- The code linked above, and [`EditorPage`](/packages/web/src/EditorPage.tsx) for how other pages
  attach.

## Q1: Where should an image of a note live?

The attachments decision puts an image beside the file that links it, and removes it with its
feature. `INBOX.md` has no feature, and a note leaves the file once it becomes a priority, a draft,
or a change. The image has to follow the note, or it stays behind in git for good.

Why it matters: the first option needs no new rule. The second changes the layout of `specs/` in
every project, which makes this change a feature.

- **A (recommended). Keep the draft as the image's home: attaching to a note turns it into a draft
  folder holding the image, as the form does today. The inbox then shows that image.**
  - [pro] no new folder, no new rule: the image leaves with the draft, whatever the note becomes.
  - [con] a note with an image is a draft, so the inbox list links out for what it shows.
  - Why recommended: it is the design the attachments decision and the inbox reference already
    describe, and it leaves no orphan image.
- **B. Add `specs/inbox/images/`, and link the image from the note's line in `INBOX.md`.**
  - [pro] the note stays a line, with its image inline, like a proposal.
  - [con] a new folder in every project, and the code that moves a note must move its image. It is
    an upgrade to a feature.

**Answer:** A: We should also add a "ura inbox clean" or similar command that cleans up orphan
images if there are any

## Q2: How should the inbox show a note's image?

Whatever Q1 decides, the image must be visible without opening the draft.

Why it matters: it decides how much the list grows. A thumbnail on every row makes the list taller.

- **A (recommended). Show the image in the note's pane, under its text, and a small thumbnail on its
  row.**
  - [pro] the list shows at a glance which notes carry an image.
  - [con] rows with an image are taller.
  - Why recommended: it reads like the other lists, and the pane is where a note is read.
- **B. Show it in the note's pane only.**
  - [pro] the list stays as it is.
  - [con] you must open a note to learn it has an image.

**Answer:** A

## Settled without the human

### Check these

- **Existing notes** can take an image from their pane with an attach button, as the other pages do.
  This goes beyond the form the proposal might have meant, and follows "like other pages".

### Behaviour

- **Paste and drop** work on the ＋ form and the note's pane, as on the other pages. The same limits
  apply to the image's type and size.
- **Several images** on one note are allowed, as on other pages, where the form takes one today.

### Under the hood

- **Encoding and writes** stay in the core: the web code passes bytes, as the attachments decision
  says.

**Notes:**

- **Several images**: I disgaree, there could be two inline images in a note, or in bullet points.
  There's no reason to limit it to one?
