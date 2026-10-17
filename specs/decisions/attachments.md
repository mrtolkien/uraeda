---
status: active
approved-by: mrtolkien
icon: paperclip
---

# Attachments

Screenshots a human attaches to a workflow file are committed next to it. They read the same
wherever the workflow is read, and leave with their feature. Chat images stay out of git. The Rust
core turns every image into one small, safe WebP, whatever tool received it.

## Rules

- An image attached to a workflow file MUST be saved in the `images/` folder beside it, linked with
  a relative markdown image, and committed with the file; a draft that gets one becomes a folder
  holding `proposal.md`. Checked by the core's tests.
- Committing a human's workflow file MUST delete its folder's images that no markdown file there
  links to, finishing MUST delete them with the folder, and a record MUST NOT link to an image.
  Checked by the core's tests.
- Images attached to a chat MUST be saved in Uraeda's data folder, under `images/`, and MUST NOT be
  committed. Checked by the server's tests.
- The core MUST re-encode every attached image to WebP with libwebp, upright, bounded in size, and
  without metadata, near-lossless unless the input is already lossy; animated GIFs MAY stay as they
  are. Checked by the core's tests.
- The core MUST accept only PNG, JPEG, GIF, and WebP, detected by their first bytes, at most 20 MB
  and 40 million pixels, and refuse SVG and every other type. Checked by the core's tests.
- TypeScript code and editor plugins MUST NOT encode, name, or write attached images into the
  repository: they pass the bytes to the core, and the server MAY write the core's chat images.
  Checked by review.
- The server MUST serve images only with their detected type, `X-Content-Type-Options: nosniff`, and
  a `Content-Security-Policy` of `default-src 'none'`. Checked by the server's tests.

## Why

The human wanted screenshots in proposals, reviews, and answers, readable everywhere and recoverable
from git
([where images are stored](../done/2026-10-13-image-attachments.md#q1-where-are-images-attached-to-proposals-reviews-and-answers-stored)).
Binary files are an exception to plain text that this decision justifies. Since images stay in
history forever, the format must be small for screenshots
([how images are changed](../done/2026-10-13-image-attachments.md#q6-are-images-changed-before-they-are-saved-or-sent)).
WebP is the only modern format that browsers, GitHub, Obsidian, and Claude all read. Near-lossless
WebP took a quarter of PNG's size on real screenshots. One encoder in the core serves the server,
the CLI, and `ura lsp` alike.

## Alternatives considered

- sharp, in the server: the same libwebp, but out of reach of `ura lsp`, which runs without Node.
- `image-webp`, pure Rust: no C compiler, but files about twice as large, and lossless only.
- Images outside git, or in Git LFS: links break elsewhere, or every clone needs LFS.

## Consequences

- Screenshots read the same in Uraeda, Obsidian, GitHub, and any agent.
- Every attached image stays in git history: a screenshot of a secret needs a history rewrite.
- Building `ura` and the binding needs a C compiler, and the core holds a small unsafe libwebp
  wrapper.
- Chat images are lost with Uraeda's data folder, like chat transcripts.

## Applies to

- The core's image and attachment code, [`crates/core`](/crates/core/), and its callers: the
  [server](/packages/server/), the [binding](/packages/binding/), and [`ura lsp`](/crates/lsp/)
- Every feature, change, and draft folder under `specs/`, and the [skill](/skills/uraeda/SKILL.md)'s
  layout
