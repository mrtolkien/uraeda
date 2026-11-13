---
icon: paperclip
---

# Attachments

> "Since the files will live forever in the git history, we need to use an efficient, highly
> compressed format, that still works well for screenshots."

An attachment is an image a human or an agent adds to a workflow file: a screenshot in a proposal, a
review, an answer, or an inbox note. It is committed beside that file. This is the exception to
plain text in git that the constitution asks a decision to justify.

## Rules

- An image attached to a workflow file is committed beside that file, and linked by a relative path.
  _So:_ a screenshot pasted into an inbox note is saved in the note's own folder, and committed with
  it. It is never uploaded to an image host, and never kept in Uraeda's data folder.
- An image attached to a chat stays out of git, in Uraeda's data folder. _So:_ a session's
  screenshots are lost with that folder, like its transcript, and no repository fills with the
  images of conversations nobody reads again.
- Every attached image is re-encoded into one small format, WebP, before it reaches git, and the
  text in it stays sharp. _So:_ a screenshot an agent adds to a bug report is a WebP, about a
  quarter of the PNG's size. A lossy setting that blurs coloured text is not used.
- Nothing attached, and nothing shown as an image, can run code. _So:_ an SVG pasted into a proposal
  is refused, since an SVG can carry scripts. An SVG committed by hand and linked as an image is
  shown, served so that a browser draws it and never runs it.

## Why

Workflow files are read on GitHub, in an editor, and in the app. An image beside its file shows in
all three, and comes back from git like the text does. What is committed stays in git's history for
good, so each image must be small. A chat is not workflow state: its images stay with it, outside
git. An image is bytes from outside the repository, so one encoder keeps out what a browser could
run. History: [Image attachments](../done/2026-10-13-image-attachments.md).

## Alternatives considered

- Images kept outside git, on a host or in Git LFS: a link breaks when the workflow is read
  elsewhere, or every clone needs LFS.

## Applies to

- [`crates/core/`](/crates/core/), [`crates/server/`](/crates/server/), and
  [`crates/lsp/`](/crates/lsp/), and every feature that lets a human or an agent attach or show an
  image
- Every folder under `specs/` that holds images
