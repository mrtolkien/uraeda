---
status: active
approved-by: mrtolkien
icon: paperclip
---

# Attachments

Screenshots a human attaches to a workflow file are committed next to it. They read the same
wherever the workflow is read, and leave with their feature. Chat images stay out of git. The Rust
core turns every image into one small, safe WebP.

## Rules

- An image attached to a workflow file MUST be committed beside that file, linked with a relative
  markdown image, and leave with its feature; a record MUST NOT link to an image. Checked by the
  core's tests.
- Images attached to a chat MUST stay out of git, in Uraeda's data folder. Checked by the server's
  tests.
- The core MUST turn every attached image into one small, safe WebP, whatever tool received it, and
  MUST refuse types that can carry code, such as SVG. Checked by the core's tests.
- TypeScript code and editor plugins MUST NOT encode, name, or write attached images into the
  repository: they pass the bytes to the core. Checked by review.
- The server MUST serve attached images so a browser cannot run them as a page. Checked by the
  server's tests.

## Why

The human wanted screenshots in proposals, reviews, and answers, readable everywhere and recoverable
from git
([where images are stored](../done/2026-10-13-image-attachments.md#q1-where-are-images-attached-to-proposals-reviews-and-answers-stored)).
Since images stay in history forever, the format must be small for screenshots
([how images are changed](../done/2026-10-13-image-attachments.md#q6-are-images-changed-before-they-are-saved-or-sent)).
One encoder in the core serves the server, the CLI, and `ura lsp` alike.

## Alternatives considered

- sharp, in the server: out of reach of `ura lsp`, which runs without Node.
- Images outside git, or in Git LFS: links break elsewhere, or every clone needs LFS.

## Consequences

- Every attached image stays in git history: a screenshot of a secret needs a history rewrite.
- Building `ura` and the binding needs a C compiler.
- Chat images are lost with Uraeda's data folder, like chat transcripts.

## Applies to

- The core's image and attachment code, [`crates/core`](/crates/core/), and its callers: the
  [server](/packages/server/), the [binding](/packages/binding/), and [`ura lsp`](/crates/lsp/)
- Every feature, change, and draft folder under `specs/`, and the [skill](/skills/uraeda/SKILL.md)'s
  layout
