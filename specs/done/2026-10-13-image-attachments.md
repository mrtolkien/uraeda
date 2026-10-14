---
kind: feature
finished: 2026-10-14
pull-request: https://github.com/mrtolkien/uraeda/pull/14
---

# Record: Image attachments

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-13, finished on
> 2026-10-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/14). Its full files are
> in git: `git log -- specs/2026-10-13-image-attachments/`.

## What and why

Chats, proposals, and reviews accept images, dropped anywhere on the page or picked with a dedicated
button, because "screenshots are often useful!". The answers widened it to every text a human
writes, added paste, and a Neovim command to paste from the clipboard. Since committed images live
in git history forever, the human asked for "an efficient, highly compressed format, that still
works well for screenshots": every image is re-encoded as WebP by the Rust core.

## Behaviour

- **Attaching to a workflow file** (drafts, proposals, bug reports): drop anywhere on the page,
  paste, or "Add image". The image lands in the focused field, or the page's main field, outlined
  while a file is dragged over the page; a drop on a page with no text field does nothing, and never
  makes the browser leave the app.
  - It is saved in `images/` next to the file and its link, `![alt](images/name.webp)`, is inserted
    in a paragraph of its own where the cursor was, moved by every edit typed during the upload, or
    at the end of a field never focused; the alt text is selected. A drop on the editor's preview
    switches to the text.
  - Names: the original file name without its last extension, lowercased, runs of other characters
    than `a-z0-9` as one `-`, at most 60 characters, or `image`; a pasted file is
    `pasted-YYYYMMDD-HHmmss` in local time, with the alt text "pasted image". A taken name gets
    `-2`, `-3`; no file is overwritten, and no write goes through a symbolic link.
  - A single-file draft that gets an image becomes `specs/drafts/<slug>/proposal.md` (or `<slug>-2/`
    when taken), with `PRIORITIES.md`'s links to it rewritten, and starting the feature moves its
    images with it.
  - Batches added during an upload wait their turn in one run, which saves the text once at its end.
- **Encoding**, in the core, for every image: type detected by its first bytes, PNG, JPEG, GIF, or
  WebP only, checked before the size; at most 20 MB (counted in MiB) and 40 million pixels, read
  from the header before decoding, with bounded decoder memory. JPEG and lossy WebP become lossy
  WebP q80; others near-lossless 60; rotated by EXIF orientation and downscaled to 2576 pixels on
  the long edge. No metadata is kept, colour profiles included (dropped, not converted). An animated
  GIF is rewritten frame by frame, still compressed, without its comments and extensions; animated
  WebP and APNG keep their first frame.
- **Commits**: a commit of a human's file (text, review verdict, round of answers) holds the images
  a markdown file of its folder links, and deletes the folder's unlinked ones, nested folders
  included; links of any markdown kind count, wikilinks and Obsidian embeds too, HTML does not.
- **Reading**: the proposal, review, and editor's preview draw the image at most the column's width
  and 80 % of the window's height, opening in a lightbox that Back closes. A link outside `specs/`,
  or a URL, stays a link. A failed load shows "Image missing: <alt>". `ura check` reports an image
  link into `specs/` that does not resolve, with targets percent-decoded and queries ignored.
- **Chats**: images show as thumbnails above the text, each with its remove button under it, and are
  sent with the message, at most 10, or alone with no text (a new chat is then titled "Image"). The
  agent gets one `[Image: <absolute path>]` line per image after the text, and reads the data
  folder's `images/` through `--add-dir`. The transcript shows them as 120 px previews opening full
  screen. Taking a message back returns its images to the composer. The attach button shows only
  when the agent declares images. The workflow's message takes no images: "Start the agent" sends
  its text alone, and the draft's images stay for the next message.
- **Reviews, answers, and notes**: a review comment takes images like the editor; with no comment
  open, a drop opens a new general comment. A verdict is refused while the open comment holds or
  uploads an image: "Add or cancel your comment first: its images are not in the review yet.". An
  image added to an answer saves the answer at once; with no field focused on a round, a drop goes
  to the notes, and Submit waits for every upload.
- **Neovim**: `:Uraeda image [file]`, `<leader>ai`, reads the clipboard through PowerShell on WSL,
  else `wl-paste`, `xclip`, `pngpaste`, or PowerShell, or reads the file given. It inserts the link
  after the cursor's character in one undo step, and reopens a draft moved into a folder, keeping
  edits made meanwhile. From another branch's checkout, it writes the default branch's draft.
- **Refusals**, under the field, announced, the text unchanged: the type, over 20 MB, over 40
  million pixels, unreadable, the feature's agent working, an agent without images, an eleventh
  image, a disk error, and an upload with no answer after 2 minutes.
- **Agents** open the images linked in the human's files they read, as the skill says.

## Design

The Rust core owns every rule about an image: detecting, limiting, decoding, re-encoding, naming,
placing, moving a draft into a folder, and which images a commit holds. The server reaches it
through the binding, and `ura lsp` directly, so the web UI and Neovim store the same files. The
server owns transport and the chat image store; the web UI owns where a file lands and inserting the
returned link. Encoding uses libwebp through `libwebp-sys`, and the `image` crate to decode.

**Core** ([`crates/core`](/crates/core/)):

- The encoder, [`images.rs`](/crates/core/src/images.rs), with the only `unsafe` code in
  [`images/webp.rs`](/crates/core/src/images/webp.rs) and the GIF rewrite in
  [`images/animated.rs`](/crates/core/src/images/animated.rs).
- Attaching, [`actions/attach.rs`](/crates/core/src/actions/attach.rs): places and names the image,
  and turns a draft into a folder, with [`files/retarget.rs`](/crates/core/src/files/retarget.rs)
  rewriting `PRIORITIES.md`. Reached by `attach_image`, `encode_image`, and `read_image` in
  [`api/files.rs`](/crates/core/src/api/files.rs); `attach_image` encodes before taking the write
  lock.
- Commits: [`actions/images.rs`](/crates/core/src/actions/images.rs), the one rule the text, review,
  and answer actions use, with [`git/status.rs`](/crates/core/src/git/status.rs).
- The document tree's image span,
  [`files/document/inline.rs`](/crates/core/src/files/document/inline.rs), and link resolution,
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs), checked by
  [`check/links.rs`](/crates/core/src/check/links.rs). Pasted names use `today::stamp()`, set by
  `URA_NOW` in tests.

**Server** ([`packages/server/src`](/packages/server/src/)):

- [`attach.ts`](/packages/server/src/attach.ts): `POST /r/<name>/attach`, multipart, refusing a body
  over 21 MiB unread, then a feature whose agent works, then passing the bytes to the core.
  [`limits.ts`](/packages/server/src/limits.ts) holds the limits and refusals TypeScript shares.
- [`files.ts`](/packages/server/src/files.ts): `/r/<name>/images/<path>` and
  `/r/<name>/chat-images/<id>`, with the detected type, `nosniff`, `default-src 'none'`, and
  `Cross-Origin-Resource-Policy: same-origin`. The [guard](/packages/server/src/guard.ts) also
  refuses a write without an `Origin` that `Sec-Fetch-Site` says came from another site.
- The chat image store, [`runner/images.ts`](/packages/server/src/runner/images.ts), in the data
  folder, `0700`, cleaned at startup of images no message holds and older than a day
  ([`runner/image-uses.ts`](/packages/server/src/runner/image-uses.ts)).
- Messages carry `images` through [`fate/mutations.ts`](/packages/server/src/fate/mutations.ts) and
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts), checked before any session work.
  The [Claude Code adapter](/packages/server/src/runner/claude.ts) declares `images`, writes the
  `[Image: …]` lines, and passes `--add-dir`. Checks 7 and 8 of the validation script,
  [`validate-claude-images.ts`](/packages/server/scripts/validate-claude-images.ts), check the reads
  on the real agent.

**Web UI** ([`packages/web/src`](/packages/web/src/)):

- [`attach/`](/packages/web/src/attach/): the page drop
  ([`useImageDrop.ts`](/packages/web/src/attach/useImageDrop.ts)), uploads and their announced
  statuses ([`useAttach.ts`](/packages/web/src/attach/useAttach.ts)), a text field taking images
  with its cursor tracking ([`useImageText.ts`](/packages/web/src/attach/useImageText.ts)), link
  insertion ([`insertLink.ts`](/packages/web/src/attach/insertLink.ts)), the paperclip
  [`AttachButton.tsx`](/packages/web/src/attach/AttachButton.tsx), and
  [`DropHint.tsx`](/packages/web/src/attach/DropHint.tsx).
- The fields: [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx),
  [`useReviewImages.ts`](/packages/web/src/useReviewImages.ts) for
  [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx),
  [`QuestionComment.tsx`](/packages/web/src/QuestionComment.tsx), and
  [`RoundNotes.tsx`](/packages/web/src/RoundNotes.tsx).
- Chat: [`Composer.tsx`](/packages/web/src/Composer.tsx) with
  [`ComposerImages.tsx`](/packages/web/src/ComposerImages.tsx), and
  [`MessageBody.tsx`](/packages/web/src/MessageBody.tsx) in the transcript.
- Drawing: [`ImageView.tsx`](/packages/web/src/ImageView.tsx) from
  [`Spans.tsx`](/packages/web/src/Spans.tsx), with Back closing overlays through
  [`layout/useBackCloses.ts`](/packages/web/src/layout/useBackCloses.ts).

**Neovim**: `uraeda.attachImage` in
[`crates/lsp/src/commands/attach.rs`](/crates/lsp/src/commands/attach.rs), refusing a file over 20
MB by its size; the clipboard tools in [`clipboard.lua`](/editors/nvim/lua/uraeda/clipboard.lua),
and the action in [`actions.lua`](/editors/nvim/lua/uraeda/actions.lua).

**Skill**: [`SKILL.md`](/skills/uraeda/SKILL.md) lists `images/` in the layout and tells agents to
open a human's linked images; [`conventions.md`](/skills/uraeda/references/conventions.md) gives the
manual rule; [`finish.md`](/skills/uraeda/references/finish.md) says a record links no image.

## Questions

### Round 01

#### Q1: Where are images attached to proposals, reviews, and answers stored?

**Answer:** A: committed to the repository, next to the markdown file that links them, in the same
commit, as a new "attachments" decision.

#### Q1.A: Where in the repository do images go, and what happens to them when the feature finishes?

**Answer:** A: in an `images/` folder inside the feature's or the draft's folder, deleted with it at
finish; git history keeps them.

#### Q2: How does a chat image reach the agent, and where is it kept?

**Answer:** B: saved in Uraeda's data folder, its path written in the message for the agent to open.

#### Q3: Which texts take images?

**Answer:** A: chats, drafts, proposals, bug reports, review comments, answers' comments, and round
notes.

#### Q4: Do images also come from the clipboard?

**Answer:** A: the button, drag and drop, and paste.

#### Q5: Where on the page can an image be dropped?

**Answer:** A: anywhere on the page, landing in the focused field or the page's main field, outlined
while dragging.

#### Q6: Are images changed before they are saved or sent?

**Answer:** B, re-encoded with metadata dropped and downscaled, and "use a better format, like webp
or jpeg-xl", since "the files will live forever in the git history". The spec chose WebP, encoded in
the Rust core with libwebp rather than sharp.

#### Q7: Do agents open the images linked in the files they read?

**Answer:** A: the skill says to open them, but "the text should be short", since most proposals
have no image.

#### Notes

The human asked for a Neovim command to insert an image from the clipboard in a draft or proposal,
"if it's not too complex and does not bloat the CLI too much": it became `:Uraeda image`.

## Decisions

- [Attachments](../decisions/attachments.md), new: images of workflow files committed as WebP in an
  `images/` folder next to the file that links them, deleted with the folder at finish; chat images
  in the data folder; every image re-encoded once by the Rust core, with libwebp.

## Changes after approval

The spec, approved with two comments, already raised the input limit from the settled 5 MB to 20 MB,
since every image is downscaled and re-encoded.

- **C1:** encoding in the core instead of sharp, "use what's best": carried out as specified.
- **C2:** lossy settings allowed if they halved the size without losing text. Measured while
  planning: near-lossless 20 saves 12 %, a 256-colour palette 1 to 15 %, and lossy WebP doubles the
  size, so near-lossless 60 was kept (R1).

Rulings that change behaviour:

- **Animated GIFs** are rewritten without their metadata and extensions, frames copied still
  compressed, instead of kept byte for byte, so SC-004 holds (R16).
- **`session.send`** takes the images as the upload returned them, IDs with their sizes, bounded by
  the core's limits (R35).
- **The workflow's message takes no images:** refused by the server, no paperclip in its composer,
  and "Start the agent" leaves the draft's images for the next message (R42, R60, R67).
- **A verdict waits** while the open comment holds or uploads an image, and an answer's image saves
  the answer at once (R64).
- **`:Uraeda image`** inserts the link after the cursor's character, without blank lines, under
  `<leader>ai` (R76).
- **A clipboard command's output** counts as an image only by its first bytes, so text gives "the
  clipboard holds no image" (R77).
- **A thumbnail's remove button** sits under it, 44 px on touch screens, not in its corner (R81).
- **The image routes** are a repository's, under `/r/<name>/`; chat images stay in the one shared
  data folder, readable under any repository's prefix (R84).
- **`:Uraeda image` from another branch's checkout** writes the default branch's draft (R88).
- **Refusal order:** an attached image is encoded, and refused for its type, size, pixels, or
  decoding, before the core's write lock and before a missing target file (R92); `ura lsp` refuses a
  file over 20 MB by its size, unread, whatever its bytes (R93); the upload route refuses a working
  agent before reading the image (R94). The size refusal also comes before the type for uploads over
  the body limit (R34).

From the final review, each fixed with tests: encoding moved out of the core's global write lock
(R92); removing a chat image checks that image alone, not every image the cache's messages hold;
`ura lsp` no longer reads an oversized file whole (R93); and the overlay tests wait for the Back to
land, not a fixed time.

## Follow-ups

- **The validation script's checks 7 and 8**, in
  [`validate-claude-images.ts`](/packages/server/scripts/validate-claude-images.ts), were never run
  against the real agent: `vp run validate:claude`, by hand, costs money.
- **Neovim's macOS and Windows or WSL clipboard paths** (`pngpaste`, PowerShell) are untested: only
  Linux's `wl-paste` and `xclip` were tried.
- **Chat images are not tied to a repository** (R84): any repository's prefix reads or deletes any
  chat image by its UUID. Acceptable for one human; record each image's repository if several users
  ever share a server.
- **Two browser tests wait a fixed time** to prove nothing happens, in
  [`attach.test.tsx`](/packages/web/src/__browser__/attach.test.tsx) (R95).
- **Colour profiles are dropped**, not converted to sRGB: a wide-gamut screenshot turns a little
  duller (R18).
- **Left out by the spec:** listing and serving image mockups written by agents, attaching from the
  CLI, and scanning screenshots for secrets.
