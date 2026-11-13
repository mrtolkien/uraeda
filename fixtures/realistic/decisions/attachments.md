---
icon: paperclip
---

# Attachments

> "A screenshot I attach reads the same wherever the spec is read."

## Rules

- An image attached to a workflow file is committed beside it, linked by a relative path, and a
  record never links one. _So:_ the images leave with the feature's folder.
- Images attached to a chat stay out of git, in Uraeda's data folder. _So:_ a chat's screenshot
  never shows in a commit.
- The core turns every attached image into one small WebP, and refuses types that can carry code.
  _So:_ an SVG is refused, whatever tool received it.
- The server serves attached images so that a browser cannot run them as a page. _So:_ an image's
  address never opens as HTML.

## Why

Screenshots must read everywhere the workflow is read, and be recoverable from git. What is
committed stays in history forever, so the format must be small. One encoder in the core serves the
server, the CLI, and the editors alike. History:
[Image attachments](../done/2026-10-13-image-attachments.md).

## Alternatives considered

- Images outside git, or in Git LFS: links break elsewhere, or every clone needs LFS.

## Applies to

- [`crates/core/`](/crates/core/) and its callers: the [server](/packages/server/), the
  [binding](/packages/binding/), and [`ura lsp`](/crates/lsp/)
- Every folder under `specs/` that holds images, and the [skill](/skills/uraeda/SKILL.md)'s layout
