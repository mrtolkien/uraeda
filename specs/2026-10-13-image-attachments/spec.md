---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: high
plan-review: true
---

# Spec: Image attachments

> [!IMPORTANT]
>
> Spec to review, about 40 minutes.
>
> - One new decision, [attachments](../decisions/attachments.md): images committed as WebP in an
>   `images/` folder next to the file that links them, deleted when the feature finishes; chat
>   images in the data folder; every image re-encoded once, by the Rust core.
> - Your image processing answer named sharp, on the server. This spec encodes in the Rust core with
>   libwebp instead: your Neovim note needs encoding in `ura lsp`, which runs without Node, and
>   libwebp gives the same bytes as sharp. It costs `ura` and the binding about 0.8 MB and a C
>   compiler.
> - You suggested WebP or JPEG XL: WebP it is. Claude and Obsidian cannot read JPEG XL, and on 97
>   screenshots near-lossless WebP took 25 % of the PNG size, while lossy WebP took more and blurred
>   coloured text. Photos stay lossy.
> - A settled point changes with your answer: the 5 MB limit applied to images stored as they were.
>   Since every image is now downscaled and re-encoded, inputs go up to 20 MB.
> - The Neovim command is in: `:Uraeda image` reads the clipboard through wl-paste, xclip, or
>   pngpaste, as other Neovim plugins do, with no new dependency besides the encoder.
> - Risk tier `high`, for a new upload route, unsafe C bindings in the core, and drafts moved into
>   folders: the plan waits for your review.

Humans can attach images, mostly screenshots, wherever they write: chats, drafts, proposals, bug
reports, review comments, answers, and notes. They drop them anywhere on the page, paste them, or
pick them with a button; in Neovim, `:Uraeda image` pastes them. Images of workflow files are
committed next to them, as WebP, and agents open them; chat images reach the agent by path. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Add a screenshot to a proposal or draft (P1)

In the editor of a draft, proposal, or bug report, the human drops an image anywhere on the page,
pastes it, or picks it with "Add image". Once saved, its link is inserted at the cursor, with its
alt text selected, and the preview shows the image. Committing the file commits its images.

Why this priority: it is the proposal's main path, and every other text builds on the same parts.

Acceptance scenarios:

1. **Given** the proposal of feature `2026-10-14-login-banner` open in the editor, with the cursor
   after "covers the login button:", **When** the human drops
   `Screenshot 2026-10-14 at 10.35.12.png` (1440×900) anywhere on the page, **Then**
   `specs/2026-10-14-login-banner/images/screenshot-2026-10-14-at-10-35-12.webp` exists, 1440×900,
   and `![Screenshot 2026-10-14 at 10.35.12](images/screenshot-2026-10-14-at-10-35-12.webp)` is
   inserted at the cursor, its alt text selected.
2. **Given** the same editor, **When** the human pastes an image from the clipboard at 10:35:12 on
   2026-10-14, **Then** it is saved as `images/pasted-20261014-103512.webp`, linked as
   `![pasted image](images/pasted-20261014-103512.webp)`.
3. **Given** the same editor, **When** the human presses "Add image" and picks `login.png`, **Then**
   it is saved as `images/login.webp`, and linked at the cursor.
4. **Given** a proposal linking `images/login.webp`, **When** the human opens the preview, or the
   proposal's page, **Then** the image shows in place of the link, with its alt text, and a click
   opens it full screen.
5. **Given** a proposal linking `images/login.webp`, and an unlinked `images/old.webp` never
   committed, **When** the human commits the proposal, **Then** the commit holds `proposal.md` and
   `images/login.webp`, and `images/old.webp` is deleted.
6. **Given** the single-file draft `specs/drafts/login-banner.md`, listed in `PRIORITIES.md`,
   **When** the human adds an image to it, **Then** it becomes
   `specs/drafts/login-banner/proposal.md` with `images/`, `PRIORITIES.md` links to the new path,
   and the editor shows the new path.
7. **Given** that draft folder, **When** the human starts the feature, **Then** the feature's folder
   holds `proposal.md` and its `images/`, and the link still resolves.
8. **Given** a file `diagram.svg`, **When** the human drops it, **Then** nothing is saved, and the
   field shows "Only PNG, JPEG, GIF, and WebP images can be added: diagram.svg is not one."

### US2: Send images in a chat (P1)

In a session's composer, the human drops, pastes, or picks images. They show as thumbnails above the
text, each removable, and are sent with the message. The agent receives their paths, and opens them.
The transcript shows them in the human's message.

Why this priority: screenshots of a bug are most often asked about in a chat.

Acceptance scenarios:

1. **Given** a session's composer, **When** the human pastes two images, **Then** two thumbnails
   show above the text, each with a remove button, and the attach button reads "Add images".
2. **Given** two thumbnails and the text "What is wrong here?", **When** the human sends, **Then**
   the agent receives "What is wrong here?" followed by one line per image,
   `[Image: <data folder>/images/<id>.webp]`, and the transcript shows the message with its two
   images above its text.
3. **Given** a thumbnail, **When** the human removes it before sending, **Then** the message is sent
   without it.
4. **Given** one image and no text, **When** the human sends, **Then** the message is sent, and a
   new chat is titled "Image".
5. **Given** a steered message with an image, not yet read, **When** the human takes it back,
   **Then** its text and its image return to the composer.
6. **Given** a sent message with an image, **When** the human clicks the image in the transcript,
   **Then** it opens full screen.
7. **Given** a session whose agent does not declare images, **When** the composer shows, **Then** it
   has no attach button, and a dropped image shows "This agent cannot read images."

### US3: Add images to review comments (P2)

On a review page, a comment takes images like the editor does. With no comment open, a dropped or
pasted image opens a new general comment holding its link.

Why this priority: the proposal names reviews, and a screenshot of a mockup explains a comment best.

Acceptance scenarios:

1. **Given** the spec review page with no comment form open, **When** the human drops `shot.png`,
   **Then** a new general comment opens, holding `![shot](images/shot.webp)`.
2. **Given** an open line comment, **When** the human pastes an image, **Then** its link is inserted
   at the comment's cursor.
3. **Given** a comment linking `images/shot.webp`, **When** the human approves the spec, **Then**
   the verdict commit holds `spec.md`, `spec-review.md`, and `images/shot.webp`.

### US4: Add images to answers and notes (P3)

On a round of questions, an answer's comment and the round's notes take images. With no field
focused, a drop goes to the notes.

Why this priority: a screenshot can settle a choice, and it is the same component.

Acceptance scenarios:

1. **Given** Q3's comment focused, **When** the human pastes an image, **Then** its link is inserted
   into Q3's answer.
2. **Given** a round page with no field focused, **When** the human drops an image, **Then** its
   link is added at the end of the notes.
3. **Given** answers linking two images, **When** the human submits the round, **Then** the commit
   holds `clarifications-01.md` and both images.

### US5: Paste an image from Neovim (P3)

In a draft, proposal, bug report, review, or round file, `:Uraeda image` saves the image on the
clipboard, or the file named after the command, and inserts its link at the cursor.

Why this priority: the human asked for it, "if it's not too complex and does not bloat the CLI too
much"; it reuses the core's encoder, and adds no other dependency.

Acceptance scenarios:

1. **Given** a proposal open in Neovim, and a PNG on the clipboard at 10:47:33 on 2026-10-14,
   **When** the human runs `:Uraeda image`, **Then** `images/pasted-20261014-104733.webp` is saved,
   and `![pasted image](images/pasted-20261014-104733.webp)` is inserted at the cursor, in one undo
   step.
2. **Given** a proposal open in Neovim, **When** the human runs `:Uraeda image ~/shots/login.png`,
   **Then** `images/login.webp` is saved and linked at the cursor.
3. **Given** the single-file draft `specs/drafts/login-banner.md` open, **When** the human runs
   `:Uraeda image`, **Then** the draft becomes `specs/drafts/login-banner/proposal.md`, the buffer
   reopens at that path, and the link is inserted at the same line.
4. **Given** a clipboard holding text, **When** the human runs `:Uraeda image`, **Then** nothing is
   saved, and Neovim shows "uraeda: the clipboard holds no image".

### US6: Agents see the images (P2)

Agents open the images linked in the human's files they read: the proposal, answers, notes, and
review comments.

Why this priority: a screenshot the agent never opens was attached for nothing
([Q7](clarifications-01.md#q7-do-agents-open-the-images-linked-in-the-files-they-read)).

Acceptance scenarios:

1. **Given** a proposal linking `images/login.webp`, **When** an agent runs discovery on it,
   **Then** it reads the image before writing the discovery, as the skill says.
2. **Given** a chat message with an image, **When** Claude Code receives it, **Then** it reads the
   image's path, with no permission prompt.

## Edge cases

- **Several images at once**: each is saved in the order given, and their links are inserted at the
  cursor, one per line.
- **The same name twice**: the second is saved as `login-2.webp`, then `login-3.webp`; no file is
  ever overwritten.
- **A name with no usable character**, like `😀.png`: saved as `image.webp`.
- **An animated GIF**: kept as a GIF, unchanged, when within the limits; Claude reads its first
  frame.
- **A phone photo**: rotated by its EXIF orientation, downscaled to 2576 pixels on its long edge,
  saved as lossy WebP, without its location or any other metadata.
- **An iPhone HEIC photo**: Safari converts it to JPEG, since the picker accepts only PNG, JPEG,
  GIF, and WebP.
- **A link removed before the commit**: the image is deleted by the commit.
- **A link removed after the commit**: the next commit of a file in that folder deletes the image;
  history keeps it.
- **A replaced review file**: its images stay while another file of the folder links to them, and
  are deleted by the next commit otherwise.
- **An image dropped while the field's agent works on the feature**: refused with "An agent is
  working on this feature. Stop it first, or wait for it.", like every write.
- **A drop on a page with no text field**, like the feature page: nothing happens, and the browser
  does not open the file.
- **A draft folder name already taken**, `specs/drafts/login-banner/`: the draft becomes
  `specs/drafts/login-banner-2/proposal.md`.
- **A draft committed before getting an image**: its next commit holds the old file's deletion, the
  new folder, and the image.
- **An image link outside `specs/`, or a URL**: shown as a link, not loaded.
- **Obsidian's `![[shot.png]]` embed**, written by hand: shown as text, as wikilinks are today, and
  not checked.
- **A chat image deleted from the data folder**: the transcript shows "Image missing" in its place.
- **More than 10 images in one chat message**: the eleventh is refused with "A message takes at most
  10 images."
- **The clipboard tool missing in Neovim**: "uraeda: no clipboard tool found: install wl-clipboard,
  xclip, or pngpaste".
- **A buffer edited while `:Uraeda image` runs**: the link goes where the cursor was when the
  command ran, tracked with a mark.

## Success criteria

- **SC-001**: The repository's 94 screenshot fixtures, 7678 KiB as PNG, take at most 2400 KiB once
  attached (measured: 2356 KiB).
- **SC-002**: A 1440×900 screenshot is saved and linked in under 1 second from its drop, on the
  development machine.
- **SC-003**: `ura`'s release binary grows by at most 1 MB (measured: about 0.83 MB).
- **SC-004**: No attached image holds EXIF, XMP, or GPS data, whatever its input held.
- **SC-005**: The UI decisions' checks pass on every changed page, at both sizes and in both themes.

## Design

### Approach

Every image goes through one function of the Rust core, which checks it, re-encodes it, and names
it, as the new [attachments](../decisions/attachments.md) decision requires. The web UI sends the
bytes to the server, which passes them to the core through the binding; Neovim sends a file path to
`ura lsp`, which calls the same function. Images of workflow files are written next to the file and
committed with it; chat images are written to the data folder, and the Claude Code adapter writes
their paths in the message, as answered in
[Q2](clarifications-01.md#q2-how-does-a-chat-image-reach-the-agent-and-where-is-it-kept).

Encoding uses libwebp 1.6.0, through the `libwebp-sys` crate, with a small safe wrapper, and the
`image` crate to decode PNG, JPEG, GIF, and WebP. Measured on the repository's 94 Playwright
screenshots (7678 KiB as PNG) and 3 web pages at 2x:

| Encoding                                | 94 screenshots | 3 web pages | Notes                         |
| --------------------------------------- | -------------- | ----------- | ----------------------------- |
| Optimized PNG (oxipng)                  | 61 %           | 76 %        |                               |
| JPEG XL lossless                        | 41 %           | 55 %        | Not read by Claude, Obsidian  |
| WebP lossless, libwebp                  | 27 %           | 33 %        |                               |
| **WebP near-lossless 60, libwebp**      | **25–26 %**    | **31–32 %** | Indistinguishable at 4× zoom  |
| WebP lossy q80, libwebp                 | 33 %           | 39 %        | Coloured text greyed, blurred |
| WebP lossless, `image-webp` (pure Rust) | 51 %           | 80 %        | No C compiler                 |
| AVIF q60                                | 22 %           | 24 %        | Not read by Claude            |

A 3840×1725 phone photo (1977 KiB JPEG) takes 1009 KiB as WebP q80, and 480 KiB once downscaled to
2576 pixels; near-lossless would take 4301 KiB, so photos stay lossy. sharp produced byte-identical
totals with the same settings, so encoding in the core costs nothing in quality, and is the only
place Neovim can reach. See the [attachments](../decisions/attachments.md) decision for the rules,
and [processing images](discovery-01.md#processing-images).

### Data

**Image files of workflow files** live in `<folder>/images/`, where `<folder>` holds the markdown
file: `specs/<feature>/`, `specs/bugs/<bug>/`, `specs/drafts/<slug>/`, or `specs/backlog/<slug>/`.

- Names: the original file name without its extension, lowercased, with every run of characters
  other than `a-z` and `0-9` replaced by one `-`, trimmed of `-`, cut at 60 characters, or `image`
  when nothing is left. A pasted image without a name is `pasted-YYYYMMDD-HHmmss`, in local time.
  The extension is `.webp`, or `.gif` for a kept animated GIF. A taken name gets `-2`, `-3`, and so
  on.
- Links: `![<alt>](images/<name>)`, relative to the file, since every linking file sits directly in
  the folder. The alt text is the original name without its extension, or `pasted image`, with `[`,
  `]`, and `\` escaped.

**Encoding rules**, in the core:

| Input                             | Output                                                                    |
| --------------------------------- | ------------------------------------------------------------------------- |
| JPEG, lossy WebP                  | WebP lossy, quality 80, method 4                                          |
| PNG, lossless WebP, still GIF     | WebP near-lossless 60: lossless, `near_lossless` 60, quality 75, method 4 |
| Animated GIF within the limits    | Unchanged                                                                 |
| Over 2576 pixels on its long edge | Downscaled to 2576 first, Lanczos 3                                       |
| With an EXIF orientation          | Rotated first                                                             |

Inputs are detected by their first bytes, never by their name or declared type. Limits: 20 MB, and
40 million pixels, checked from the header before decoding. Outputs hold no metadata.

**Core types**, exported through the binding:

- `Attached { path: string, link: string, moved: string | null }`: `path` is the image's path from
  the top level, `link` the markdown to insert, and `moved` the markdown file's new path when a
  draft became a folder.
- `EncodedImage { bytes: Buffer, extension: "webp" | "gif", width: number, height: number }`, for
  chat images.

**Chat images** live in `<data folder>/images/<uuid>.<extension>`, next to `runner.sqlite`. A
message item gets `images: { id: string, width: number, height: number }[]`, stored in its JSON
`data` like its other fields: older items have none. `Outgoing` gets `images: { path: string }[]`.
`Capabilities` gets `images: boolean`. An image never sent is deleted when the composer removes it,
and every image no item references is deleted when the server starts.

**The flow of a workflow file's image**: the UI posts the file and the markdown file's path to
`POST /attach`; the server checks the feature is writable, then calls the binding's
`attachImage(repo, path, bytes, name)`; the core encodes, writes, and returns `Attached`; the UI
inserts `link` at the remembered cursor, and navigates to `moved` when set. Text saves follow as
today. The commit actions add the linked images and delete the unlinked ones.

**The flow of a chat image**: the UI posts the file to `POST /attach` with `chat: true`; the server
calls `encodeImage`, writes the result to the data folder, and returns its `id`; `session.send`
takes `images: string[]`, the ids; the session stores them on the message, and passes their paths to
the adapter.

### Components

Core ([`crates/core`](/crates/core/)):

- **Image encoder** (`src/images.rs`, new): `encode(bytes, now) -> EncodedImage`. Detects the type,
  checks the limits, decodes, orients, downscales, and encodes per the rules above. Depends on
  `image` and the libwebp wrapper only. Used by attachments and the binding.
- **libwebp wrapper** (`src/images/webp.rs`, new): the only `unsafe` code, calling `WebPEncode` with
  a `WebPConfig`, behind a safe function taking RGBA pixels and settings.
- **Attach action** (`src/actions/attach.rs`, new): `attach(repo, path, bytes, name, now)`. Resolves
  the folder as `save_text` does, turns a single-file draft into a folder and rewrites its
  `PRIORITIES.md` link, names the image, and writes it. Reached by `api::attach_image`.
- **Commits of human files** ([`actions/text.rs`](/crates/core/src/actions/text.rs),
  [`actions/review.rs`](/crates/core/src/actions/review.rs),
  [`actions/answer.rs`](/crates/core/src/actions/answer.rs)): each adds the images its folder's
  markdown files link, and deletes the unlinked ones, through one shared helper.
- **Document tree** ([`files/document.rs`](/crates/core/src/files/document.rs)): a new image span,
  `{ alt, target, path }`, with `path` resolved like a link's.
- **Links and `ura check`** ([`files/markdown.rs`](/crates/core/src/files/markdown.rs),
  [`check/links.rs`](/crates/core/src/check/links.rs)): image links are collected, and checked like
  file links: an image into `specs/` that does not exist is a `links.file` problem.
- **Reading bytes** ([`api.rs`](/crates/core/src/api.rs)): `read_image`, like `read_raw`, returning
  the bytes and the detected type of a PNG, JPEG, GIF, or WebP file under `specs/`, and refusing
  anything else.

Binding ([`packages/binding`](/packages/binding/)): `attachImage`, `encodeImage`, and `readImage`,
taking and returning `Buffer`s.

Server ([`packages/server`](/packages/server/)):

- **Attach route** (`src/attach.ts`, new): `POST /attach`, multipart, behind the existing guard and
  a 21 MB body limit. Takes `file` and either `path` or `chat`. Refuses through `writable` while the
  feature's agent works.
- **Image routes** ([`files.ts`](/packages/server/src/files.ts)): `GET /images/<path>` serves a
  workflow file's image through `readImage`, and `GET /chat-images/<id>` a chat image, both with the
  headers of the decision. Both paths join `/fate`, `/raw`, and `/mockups` in the dev proxy.
- **Chat image store** (`src/runner/images.ts`, new): writes, resolves, and cleans the data folder's
  images.
- **Sessions** ([`runner/sessions.ts`](/packages/server/src/runner/sessions.ts),
  [`events.ts`](/packages/server/src/runner/events.ts),
  [`adapter.ts`](/packages/server/src/runner/adapter.ts)): a message may have images and no text;
  take-back returns its images; the title of an image-only chat is "Image".
- **Claude Code adapter** ([`claude.ts`](/packages/server/src/runner/claude.ts)): declares `images`,
  appends `[Image: <absolute path>]` lines to the text it sends, and passes
  `--add-dir <data folder>/images`, creating it first, so reads work even when the user blocks reads
  outside the working directory. Image tool results stay out of the transcript, as today. The
  [validation script](/packages/server/scripts/validate-claude.ts) sends an image and checks the
  agent reads it.

Web UI ([`packages/web`](/packages/web/)):

- **Page drop** (`src/useImageDrop.ts`, new): listens on `window` for file drags, cancels the
  browser's default on any file drop, outlines the target field while a file is over the page, and
  hands dropped files to the target: the field with focus, else the page's main field. Fields
  register as targets with their page's priority. Native events: no Astryx component covers a
  page-wide drop, an Astryx gap the plan lists.
- **Attaching** (`src/useAttach.ts`, new): uploads files one by one to `/attach`, announces "Adding
  <name>…", then "Added <name>", or the refusal, in a live region, and returns the results in order.
- **Attach button** (`src/AttachButton.tsx`, new): an Astryx `IconButton` with a paperclip, "Add
  image" or "Add images", opening a hidden file input accepting
  `image/png,image/jpeg,image/gif,image/webp`, with `multiple`. The hidden input is an Astryx gap.
- **Image text areas**: [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx), and the comment and notes fields of
  [`Question.tsx`](/packages/web/src/Question.tsx) and
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) take paste and drop, insert the link at the
  cursor remembered at the drop, and select its alt text. The review page opens a general comment
  for a drop when none is open; the round page uses the notes.
- **Composer** ([`Composer.tsx`](/packages/web/src/Composer.tsx)): `ChatComposerInput`'s `onFiles`
  for paste and drop, the attach button in `headerActions`, and the thumbnails in a
  `ChatComposerDrawer`, as Astryx `Thumbnail`s with `onRemove`.
- **Transcript** ([`Transcript.tsx`](/packages/web/src/Transcript.tsx)): the human's message shows
  its images above its text, opening in an Astryx `Lightbox`.
- **Document images** ([`Spans.tsx`](/packages/web/src/Spans.tsx)): the image span draws an `<img>`
  from `/images/<path>`, at most the column's width, with its alt text, opening in the `Lightbox`.
  An image span without a `path` under `specs/` draws as a link.

Language server and Neovim:

- **`uraeda.attachImage`** ([`crates/lsp`](/crates/lsp/)): a new command taking `{ uri, path }`,
  calling `api::attach_image` with the file's bytes, and returning the `Outcome` plus `link`, with
  `opened` set when the draft moved.
- **`:Uraeda image [file]`** ([`editors/nvim`](/editors/nvim/)): a new action. Without a file, it
  reads the clipboard into a temporary file with the first tool found: `wl-paste` on Wayland,
  `xclip` on X11, `pngpaste` on macOS, PowerShell on Windows; it accepts PNG, JPEG, GIF, and WebP.
  It saves the buffer, runs the command, reopens a moved draft as `:Uraeda start` does, and inserts
  the link at a mark set on the cursor, in one undo step. The clipboard command is configurable in
  `vim.g.uraeda`, which the tests use. `:checkhealth uraeda` names the clipboard tool found.

Skill ([`skills/uraeda`](/skills/uraeda/)):

- [`SKILL.md`](/skills/uraeda/SKILL.md): `images/` in the folder layout, for features, bugs, and
  folder drafts; a Markdown rule for images, `![alt](images/name.webp)`, with the decision's
  encoding stated so a human or agent without `ura` can follow it; and one short rule for agents:
  open the images linked in a human's file you read.
- [`finish.md`](/skills/uraeda/references/finish.md): images go with the folder, and the record
  links none.
- The specs README template, and this repository's [specs README](../README.md): the `images/`
  folder.

### Mockups

- [Attachments](mockups/attachments.html): the composer with thumbnails and a file dragged over it,
  images in the transcript, the editor with a link inserted and its preview, the outline while
  dragging, the refusals, a review comment opened by a drop, the phone composer, and Neovim's
  command with its messages.

### Error handling

Refusals show under the field that would have received the image, in its live region, and leave the
text unchanged. In order of the checks:

- A type other than PNG, JPEG, GIF, or WebP: "Only PNG, JPEG, GIF, and WebP images can be added:
  <name> is not one."
- Over 20 MB: "This image is over 20 MB: <name> is <size> MB."
- Over 40 million pixels: "This image is too large: <name> is <width>×<height> pixels."
- An image the decoder cannot read: "This image could not be read: <name>."
- The feature's agent working: "An agent is working on this feature. Stop it first, or wait for it."
- A chat agent without images: "This agent cannot read images."
- An eleventh image in a chat message: "A message takes at most 10 images."
- A write that fails on disk: "The image could not be saved: <the system's error>."
- Neovim: "uraeda: the clipboard holds no image", "uraeda: no clipboard tool found: install
  wl-clipboard, xclip, or pngpaste", and the core's refusals above, prefixed with "uraeda: ".

### Testing

Core tests call `api::attach_image` and the commit actions on temporary repositories built from
`fixtures/`, with the clock set by the test, and read the files written and the commits made. Server
tests post multipart bodies to the real app with the fake adapter. UI tests render the app on the
real server in-process, as the existing helpers do, and drive it by role and label; drop and paste
tests run in WebKit through Playwright, with files from `fixtures/images/`. Neovim tests run the
plugin against `ura lsp` with the clipboard command set to a fixture.

| What                                                          | Test                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| US1.1–US1.3, US1.8                                            | Browser tests: drop, paste, and the button in the editor                                  |
| US1.4                                                         | UI test: the preview and the proposal page show the image, the lightbox opens             |
| US1.5, US3.3, US4.3, removed links                            | Core tests of the commit actions                                                          |
| US1.6, US1.7, draft folder name taken, committed draft        | Core tests of `attach` and `start`, and a UI test of the editor's new path                |
| US2.1–US2.7, more than 10 images, image missing               | UI tests with the fake adapter, and session tests of what the adapter receives            |
| US2.2 (the text sent), US6.2                                  | Claude adapter test of the stdin line and arguments; the validation script, by hand       |
| US3.1, US3.2                                                  | Browser tests on the review page                                                          |
| US4.1, US4.2                                                  | Browser tests on the round page                                                           |
| US5.1–US5.4, missing tool, edits during the command           | mini.test tests of `:Uraeda image`                                                        |
| US6.1                                                         | The validation script, by hand: an agent asked about a proposal linking an image reads it |
| Encoding rules, names, limits, animated GIF, photo, SC-004    | Table-driven core test, one row per fixture                                               |
| Edge cases of drops: no text field, several images, same name | Browser and core tests                                                                    |
| Image and URL links, Obsidian embeds, `ura check`             | Core tests of the document tree and of `check`                                            |
| Upload route: guard, body limit, writable refusal, headers    | Server tests                                                                              |
| SC-001                                                        | Core test over the screenshot fixtures                                                    |
| SC-002                                                        | Browser test timing a 1440×900 drop                                                       |
| SC-003                                                        | CI's binary size line, compared in the pull request                                       |
| SC-005                                                        | The UI checks `vp run ready` runs                                                         |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- The chat composer shows images as removable thumbnails above the text, opening full screen.
- In files, the image is a link inserted at the cursor.
- The alt text is the image's name, selected after insertion; no dialog asks for it.
- Accepted inputs are PNG, JPEG, GIF, and WebP; SVG and HEIC are refused, and iPhones convert their
  photos to JPEG for the picker.
- Upload status and errors are announced to screen readers, and the button is reachable by keyboard.
- Uploads go through their own route, as multipart, and the core writes the files.
- The UI shows images in proposals, reviews, and the editor's preview.
- `ura check` checks image links into `specs/`.
- An image commits with the text that links to it, and unlinked images are deleted at the commit.
- A draft that gets an image becomes a folder.
- A replaced review file's images stay while linked: see the edge cases.
- A chat message can be an image alone, and take-back returns its images.
- The attach button appears in a chat only when its agent declares images.
- Image mockups written by agents, attaching from the CLI, and scanning screenshots for secrets are
  left out.
- Changed by the answer to
  [Q6](clarifications-01.md#q6-are-images-changed-before-they-are-saved-or-sent): the limit is 20 MB
  per input, instead of 5 MB, since outputs are downscaled and re-encoded.

Settled while writing this spec:

- Encoding runs in the Rust core with libwebp, not with sharp in the server, so Neovim and the web
  UI share it: see [Approach](#approach).
- WebP, not JPEG XL: Claude and Obsidian cannot read JPEG XL, and GitHub serves it as a download.
- Screenshots are near-lossless, photos lossy, chosen by the input's type, as measured in
  [Approach](#approach).
- Images are downscaled to 2576 pixels on their long edge, the size of Claude's high-resolution
  tier.
- Animated GIFs are kept as they are, so an animation still plays; libwebp's animation encoder is
  not wrapped.
- Chat images reach Claude Code as `[Image: <path>]` lines after the text, with `--add-dir` on the
  images folder only, never the whole data folder, since added folders are writable in `auto` mode.
  Tested on Claude Code 2.1.296: the agent opened each image without being asked, with no prompt.
- At most 10 images per chat message, below Claude's stricter limits above 20 images per request.
- A drop on a page without a text field does nothing.
- No `ura` CLI command attaches images: humans attach through the web UI or their editor, and the
  skill says how to do it by hand.
- Neovim reads the clipboard with the system's tools, like img-clip.nvim, rather than the `arboard`
  crate, which would add about 430 KB to `ura` and miss some Wayland compositors.
- Moving a draft into a folder reopens its buffer in Neovim, which loses the buffer's undo history
  unless `undofile` is set.

## Decisions

New, applied when this spec is approved:

- [Attachments](../decisions/attachments.md): images of workflow files are committed as WebP in an
  `images/` folder next to the file that links them, and go with the folder at finish; chat images
  stay in the data folder; the Rust core encodes every image, with libwebp.

Relied on:

- [Stack](../decisions/stack.md): the core encodes and writes; the UI draws images from the core's
  document tree; Neovim reaches them through `ura lsp`, with an explicit command.
- [Agents](../decisions/agents.md): the image capability is declared by the adapter, and the image
  lines are written inside it.
- [CLI](../decisions/cli.md): the binary's growth is measured, about 0.83 MB, and libwebp is the
  smallest dependency that compresses screenshots well.
- [Git](../decisions/git.md): images are committed through the `git` binary, with the actions' other
  files.
- [UI components](../decisions/ui-components.md): Astryx's composer, thumbnails, lightbox, and
  buttons; the page drop and the hidden file input are listed as Astryx gaps.
- [UI layout](../decisions/ui-layout.md), [UI behaviour](../decisions/ui-behaviour.md), and
  [UI checks](../decisions/ui-checks.md): status shows next to the field, and the changed pages are
  checked and screenshotted.
- [Toolchain](../decisions/toolchain.md): `vp run ready` runs the new tests; the Nix shell provides
  the C compiler libwebp needs.

## Constitution check

| Principle                            | Complies | Notes                                                                                                       |
| ------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The decision waits for this approval                                                                        |
| II. Git and plain text first         | yes      | Images are binary files in git, an exception the attachments decision justifies                             |
| III. Asynchronous by default         | yes      | Images of workflow files are in git; chat images, like chats, are not workflow state                        |
| IV. Review effort matches impact     | yes      | Agents open the screenshots, so the human explains less                                                     |
| V. Tools are optional                | yes      | Images are plain files and links, readable on GitHub and in Obsidian; the skill says how to add one by hand |
| VI. Code is checked against the spec | yes      | Every scenario has its test; the libwebp wrapper is the one new abstraction, justified in the plan          |

## Risk tier

**High**: a new route that writes files from uploads, `unsafe` C bindings in the core, and drafts
moved into folders.
