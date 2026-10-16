---
status: active
approved-by: mrtolkien
icon: paperclip
---

# Attachments

Images a human attaches to a workflow file are committed to the repository, as WebP files in an
`images/` folder next to the file that links to them, and leave the default branch with their folder
when the feature finishes. Images attached to a chat stay outside git, in Uraeda's data folder.
Every image is re-encoded once, by the Rust core, so the web UI, the CLI, and editors store the same
files.

## Rules

- An image attached to a workflow file MUST be saved in the `images/` folder of the folder holding
  that file: a feature's, a change's, or a draft's folder. It MUST be linked from the file with a
  relative markdown image, `![alt](images/name.webp)`, and MUST be committed in the same commit as
  the file that links to it.
- A draft that gets an image MUST become a folder, `specs/drafts/<slug>/proposal.md` or
  `specs/backlog/<slug>/proposal.md`, holding its `images/` folder.
- A commit of a human's workflow file MUST delete the images of its folder's `images/` that no
  markdown file of that folder links to.
- Finishing a feature or a change MUST delete its images with its folder. A record MUST NOT link to
  an image.
- Images attached to a chat MUST be saved in Uraeda's data folder, under `images/`, and MUST NOT be
  committed.
- Every attached image MUST be re-encoded before it is saved, by the Rust core, with libwebp:
  - JPEG and lossy WebP inputs as lossy WebP, quality 80;
  - other inputs as near-lossless WebP, level 60, quality 75;
  - downscaled so its long edge is at most 2576 pixels, and rotated by its EXIF orientation;
  - with no metadata. Animated GIFs MAY be kept as they are.
- Accepted inputs MUST be PNG, JPEG, GIF, and WebP, detected by their first bytes, at most 20 MB and
  40 million pixels. SVG and other types MUST be refused.
- TypeScript code and editor plugins MUST NOT encode or name attached images, nor write them into
  the repository: they pass the bytes to the core, through the binding or `ura lsp`. The server MAY
  write the core's encoded chat images to the data folder.
- The server MUST serve images only with their detected type, `X-Content-Type-Options: nosniff`, and
  a `Content-Security-Policy` of `default-src 'none'`.

## Why

The human wanted screenshots in proposals, reviews, and answers, readable wherever the workflow is
read, and recoverable from git, as the constitution asks
([Q1](../done/2026-10-13-image-attachments.md#q1-where-are-images-attached-to-proposals-reviews-and-answers-stored),
[storing images](../done/2026-10-13-image-attachments.md#q1-where-are-images-attached-to-proposals-reviews-and-answers-stored)).
Binary files in git are an exception to the plain-text principle, which this decision justifies.
Images stay next to the files they explain, and go with the folder when the feature finishes
([Q1.A](../done/2026-10-13-image-attachments.md#q1a-where-in-the-repository-do-images-go-and-what-happens-to-them-when-the-feature-finishes)).
Chats are not workflow state, so their images stay out of git, and the agent opens them by path
([Q2](../done/2026-10-13-image-attachments.md#q2-how-does-a-chat-image-reach-the-agent-and-where-is-it-kept)).

Since images live in git history forever, the human asked for an efficient format that works for
screenshots
([Q6](../done/2026-10-13-image-attachments.md#q6-are-images-changed-before-they-are-saved-or-sent)).
WebP is the only modern format that browsers, GitHub, Obsidian, and Claude all read: Claude and
Obsidian do not read JPEG XL, and Claude does not read AVIF. On 97 screenshots, near-lossless WebP
took 25 % of the PNG size, while lossy WebP took more, and blurred coloured text. Encoding in the
core gives one implementation for the server, the CLI, and `ura lsp`; libwebp gives the same bytes
as sharp, while the pure Rust encoder makes files twice as large
([spec](../done/2026-10-13-image-attachments.md)).

## Alternatives considered

- sharp, in the server: the same libwebp, but out of reach of `ura lsp`, which runs without Node, so
  the Neovim command would need a second encoder.
- `image-webp`, pure Rust: no C compiler, but files about twice as large, and lossless only.
- Images outside git, or in Git LFS: links break on other machines and on GitHub, or every clone
  needs LFS.

## Consequences

- Proposals, reviews, and answers read the same with their screenshots in Uraeda, Obsidian, GitHub,
  and any agent.
- Every attached image stays in git history: a screenshot of a secret needs a history rewrite.
- `ura` and the binding grow by about 0.8 MB, and building them needs a C compiler, for libwebp.
- The core holds a small unsafe wrapper around libwebp's C functions.
- A finished feature's screenshots are only in git history.
- Chat images are lost with Uraeda's data folder, like chat transcripts.

## Applies to

- The core's image and attachment code, [`crates/core`](/crates/core/), and its callers: the
  [server](/packages/server/), the [binding](/packages/binding/), and [`ura lsp`](/crates/lsp/)
- Every feature, change, and draft folder under `specs/`, and the [skill](/skills/uraeda/SKILL.md)'s
  layout
