---
status: active
approved-by: human
icon: paperclip
---

# Attachments

Screenshots a human attaches to a workflow file are committed beside it, so they read the same
wherever the workflow is read and leave with their feature. Images attached to a chat stay out of
git. Uraeda's Rust core turns every attached image into one small, safe format, whatever tool
received it.

## Rules

- An image attached to a workflow file MUST be committed beside that file, linked by a relative
  path. Checked by the core's tests.
- A record of a finished feature MUST NOT link to an image, since the images leave with the
  feature's folder. Checked by the core's tests.
- Images attached to a chat MUST stay out of git, in Uraeda's data folder. Checked by the server's
  tests.
- The core MUST turn every attached image into one small WebP, whatever tool received it. Checked by
  the core's tests.
- The core MUST refuse image types that can carry code, such as SVG. Checked by the core's tests.
- TypeScript code and editor plugins MUST pass an image's bytes to the core, never encode or write
  it themselves. Checked by review.
- The server MUST serve attached images so that a browser cannot run them as a page. Checked by the
  server's tests.

## Why

Screenshots in proposals, reviews, and answers must read everywhere the workflow is read, and be
recoverable from git. What is committed stays in history forever, so the format must be small. One
encoder in the core serves the server, the CLI, and the editors alike, and refuses what a browser
could run. History: [Image attachments](../done/2026-10-13-image-attachments.md).

## Alternatives considered

- An image library in the server: out of reach of `ura lsp`, the editors' language server, which
  runs without Node.
- Images outside git, or in Git LFS: links break elsewhere, or every clone needs LFS.

## Consequences

- Every attached image stays in git history: a screenshot of a secret needs a history rewrite.
- Building `ura` and the Node binding needs a C compiler.
- Chat images are lost with Uraeda's data folder, like chat transcripts.

## Applies to

- [`crates/core/`](/crates/core/) and its callers: the [server](/packages/server/), the
  [binding](/packages/binding/), and [`ura lsp`](/crates/lsp/)
- Every folder under `specs/` that holds images, and the [skill](/skills/uraeda/SKILL.md)'s layout
