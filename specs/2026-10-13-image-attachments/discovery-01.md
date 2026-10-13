# Discovery, round 01: Image attachments

## Summary

Attaching an image to written text has three entry points in almost every product: paste from the
clipboard, drag and drop, and a button. Products then split in two families. Markdown tools (GitHub,
GitLab, Obsidian, VS Code) insert an image link at the cursor, and chat tools (Claude.ai, Copilot,
Claude Code, Slack) keep the image as an attachment shown as a thumbnail or chip next to the text.
They also differ on storage: GitHub and GitLab host the file outside the repository behind an
unguessable URL, while Obsidian, VS Code, Hugo, and Docusaurus store it as a file next to the text.

The [proposal](proposal.md) asks for images in chats, proposals, and reviews, by drag and drop "in
the page" and by a dedicated button, because screenshots help. It does not mention paste, where the
files go, what the agent sees, or what happens to them when the feature finishes.

The code handles no image today, and several layers block them. The core writes text only, into
`specs/`, and commits only each action's named files. The server can serve no binary file. The
core's document tree has no image node, so an image in a proposal shows as its alt text. The Claude
Code adapter sends a message's content as a plain string. Astryx, the UI library, already ships most
of the UI parts: a file button with a drop zone, a composer that takes pasted and dropped files,
thumbnails, and a lightbox.

## How other products do it

### GitHub

- Comments on issues, pull requests, and discussions take images by dropping them on the comment
  box, pasting them, or the "Attach files" paperclip. The file "is uploaded immediately to GitHub
  and the text field is updated to show the anonymized URL for the file", so the link sits inline in
  the markdown
  ([GitHub docs, attaching files](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)).
- Images: PNG, GIF, JPEG, SVG, up to 10 MB (same source).
- Uploads are hosted by GitHub, not in the repository. In public repositories, "uploaded files can
  be accessed without authentication"; since May 2023, new uploads of private repositories need a
  login
  ([GitHub changelog](https://github.blog/changelog/2023-05-08-more-secure-private-attachments)).
- Dropping an image in GitHub's web editor for a repository's markdown file still stores it under
  `user-attachments`, not in the repository, so guides advise committing the image and linking it by
  relative path
  ([Odoo contributor guide](https://odoo-community.org/readme-how-to-contribute-in-github), a third
  party: no official page covers it).
- The inserted tag carries `alt="Image"` and the image's width and height, users reported in 2025
  ([GitHub community discussion](https://github.com/orgs/community/discussions/166983)). The GitHub
  CLI's `--attach` takes alt text after `#` and defaults it to the file name (GitHub changelog
  2026-09-01, seen only in a search result).

### GitLab

- The markdown text area takes dropped files, with a paperclip overlay while dragging
  ([GitLab issue 352663](https://gitlab.com/gitlab-org/gitlab/-/issues/352663)).
- Uploads are stored by GitLab, outside the repository, at `/uploads/<32-character id>/<name>`;
  images are visible to anyone with the URL unless an option is turned on
  ([GitLab docs, user file uploads](https://docs.gitlab.com/security/user_file_uploads/)).
- Attachments are limited to 100 MB by default
  ([GitLab docs, limits](https://docs.gitlab.com/administration/settings/account_and_limit_settings/)).
- A pasted high-density PNG gets a `{width=..}` scaled to 50 % at 144 ppi, so Retina screenshots do
  not show at twice their size ([GitLab markdown docs](https://docs.gitlab.com/user/markdown/)).
- EXIF data is stripped from JPG and TIFF uploads
  ([GitLab docs, sanitize](https://docs.gitlab.com/administration/raketasks/uploads/sanitize/)).

### Obsidian

Obsidian is the reference renderer of workflow files ([skill](/skills/uraeda/SKILL.md#markdown)).

- A pasted or dropped image is copied as a regular file into the default attachment location and
  embedded in the note. There is no upload button
  ([Obsidian help, attachments](https://obsidian.md/help/attachments)).
- The location is a setting: the vault folder (default), a set folder, the same folder as the note,
  or a subfolder under it (same source).
- Links are wikilinks by default, `![[image.png]]`, or markdown `![](path)` when "Use Wikilinks" is
  off, with a shortest, relative, or absolute path
  ([Obsidian help, settings](https://obsidian.md/help/settings)).
- A pasted image is named `Pasted image YYYYMMDDHHmmss.png`; a copied file keeps its name
  ([Obsidian forum](https://forum.obsidian.md/t/how-to-have-pasted-file-automatically-renamed-with-timestamp-like-pasted-image-20240507222746-png/81475)).
- The "Image Converter" plugin, about 546 thousand downloads, converts pasted images to WebP or JPG,
  compresses, resizes, and renames them
  ([community plugins](https://community.obsidian.md/plugins/image-converter)).

### VS Code

- Pasting or dropping (with Shift) an image into a markdown file copies it into the workspace and
  inserts a link. A pasted image is named `image.png`, then `image-1.png`, never overwriting
  ([VS Code 1.79 notes](https://code.visualstudio.com/updates/v1_79),
  [markdown docs](https://code.visualstudio.com/docs/languages/markdown)).
- `markdown.copyFiles.destination` maps globs to folders, such as `images/${documentBaseName}/`
  ([extension settings](https://raw.githubusercontent.com/microsoft/vscode/main/extensions/markdown-language-features/package.nls.json)).

### Claude.ai and Claude Code

- Claude.ai takes images from a "+" button, a drop "into the chat window", and paste: JPEG, PNG,
  GIF, WebP, up to 8000×8000 px and 20 files per chat
  ([Claude help](https://support.claude.com/en/articles/8241126-upload-files-to-claude)).
- Claude Code takes images dragged into the window, pasted with Ctrl+V, or named by path in the
  prompt ([common workflows](https://code.claude.com/docs/en/common-workflows)). A paste inserts an
  `[Image #N]` chip at the cursor
  ([interactive mode](https://code.claude.com/docs/en/interactive-mode)). Pasted images live in a
  per-session temporary folder, deleted after `cleanupPeriodDays`
  ([`.claude` directory](https://code.claude.com/docs/en/claude-directory)).

### Codex, Copilot, and Cursor

- Codex CLI attaches image files by path: `-i/--image` on the first prompt, and on
  `codex exec resume` for a follow-up
  ([Codex developer commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)).
- Copilot Chat in VS Code takes images by drag, paste, and a paperclip with "Screenshot Window", and
  previews them on hover; it warns when the model has no vision
  ([VS Code 1.98 notes](https://code.visualstudio.com/updates/v1_98)). Since 1.128, the agent may
  also read images through a tool
  ([VS Code 1.128 notes](https://code.visualstudio.com/updates/v1_128)).
- Cursor's forum reports paste going to the open markdown file instead of the chat when focus is
  ambiguous
  ([Cursor forum](https://forum.cursor.com/t/bug-pasting-an-image-in-chat-inserts-it-into-the-open-markdown-file-instead-chat-input-appears-focusedbug/155745)),
  and images downscaled before the model sees them
  ([Cursor forum](https://forum.cursor.com/t/cursor-agent-cli-and-cursor-ide-chat-composer-image-attach/166119)).

### Linear, Notion, and Slack

- Linear inserts images inline in its editor, from a shortcut, `/file`, or a drop, and in-progress
  uploads can be cancelled ([Linear docs](https://linear.app/docs/editor),
  [changelog](https://linear.app/changelog/2024-04-24-editor-improvements)).
- Notion takes images by drop or `/image`, as blocks with an "Alt text" menu, under 5 MB on the free
  plan ([Notion help](https://www.notion.com/help/images-files-and-media)).
- Slack takes up to ten files dropped on the message field, or the plus icon, as an attachment list
  ([Slack help](https://slack.com/intl/en-gb/help/articles/201330736-Add-files-to-Slack)).

### Images next to text in git

- Hugo stores a page's images next to its `index.md`, in a "page bundle"
  ([Hugo docs](https://gohugo.io/content-management/page-bundles/)); Docusaurus calls it "convenient
  to co-locate the asset next to the Markdown file", such as `./assets/x.png`
  ([Docusaurus docs](https://docusaurus.io/docs/markdown-features/assets)); Decap CMS stores media
  in a set folder, or next to the entry
  ([Decap docs](https://decapcms.org/docs/collection-folder/)).
- GitHub renders relative image paths in repository markdown, relative to the file and to the branch
  viewed, and recommends them
  ([GitHub docs, READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- Paste from the clipboard: every product above but Notion's and Slack's help pages.
- Drag and drop, most often onto the text field; Claude.ai and Claude Code take it anywhere in the
  window.
- A button, in every web UI; editors (Obsidian, VS Code) rely on paste and drop.
- A preview before sending in chats: thumbnails or chips, removable.
- A size limit and a message when a file is over it, or of a type not accepted.
- An image link inserted at the cursor, in markdown tools.
- Alt text, rarely asked for: products default it to "image" or the file name.
- The image kept in the conversation's history, in chats.

## Standards and libraries

### Claude Code and the Claude API

- In stream-json input, a user message's `content` can be an array of blocks, with images as
  `{type: "image", source: {type: "base64", media_type: "image/png", data}}`; single-message input
  does not take images
  ([Agent SDK, streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)).
  A block without `source` reaches Claude as a text note, not an error (same source).
- Tested on Claude Code 2.1.296, the CLI Uraeda runs: that message shape, with a 32×32 PNG, sent on
  `claude -p --input-format stream-json` stdin, was seen ("Red"), and still seen after `--resume`.
  The transcript stores the image inline, as base64, in the user entry.
- The Read tool returns images as "visual content that Claude can see", and resizes large ones
  ([tools reference](https://code.claude.com/docs/en/tools-reference)).
- The API reads JPEG, PNG, GIF, and WebP, not HEIC or SVG; each image up to 10 MB base64-encoded (5
  MB on Bedrock and Google Cloud), 8000×8000 px, and 32 MB per request; above 20 images in one
  request, each must stay within 2000 px, and earlier turns' images count
  ([vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)).
- An image costs about `⌈w/28⌉×⌈h/28⌉` tokens, larger ones being downscaled: a 1920×1080 screenshot
  costs 1560 tokens on the standard tier (same source).
- Since images are stored in the transcript and resent with the session's later requests, every
  image keeps costing tokens for the rest of the session (judgement, from the two points above).

### Other agents

- Codex takes images as file paths (see [Codex](#codex-copilot-and-cursor)).
- pi's RPC `prompt`, `steer`, and `follow_up` commands take an `images` array of
  `{type: "image", data: <base64>, mimeType}` ([pi RPC](https://pi.dev/docs/latest/rpc-commands)).
- So a file saved on disk covers all three agents: read and encoded as base64 for Claude and pi,
  passed as a path for Codex (judgement).

### Browser file APIs

- A `drop` fires only if `dragover` was cancelled; files dropped outside a target may be opened by
  the browser, leaving the app, so pages cancel `dragover` and `drop` on `window` for file drags
  ([MDN, file drag and drop](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop)).
- Files are readable only synchronously in the `drop` handler, before any `await`
  ([MDN, drag data store](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Drag_data_store)),
  and in `paste` through `clipboardData.files`
  ([MDN, DataTransfer.files](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files)).
- `dragleave` fires on the parent when the pointer moves over a child, which makes drop highlights
  flicker; the common fixes are a counter or a `relatedTarget` check (seen only in search results).
- `<input type="file" accept="image/*">` lets phones take a photo or pick one; `accept` validates
  nothing, so the server must check
  ([MDN, input file](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file)).
- iOS Safari converts HEIC photos to JPEG only when `accept` lists types without HEIC
  ([WebKit bug 267277](https://bugs.webkit.org/show_bug.cgi?id=267277)).
- `URL.createObjectURL` previews a file before upload, and must be revoked
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)).

### Accessibility

- WCAG 2.2 SC 2.5.7, Dragging Movements (AA): what dragging does must be possible with a single
  pointer without dragging
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). The proposal's
  button meets it.
- SC 4.1.3, Status Messages (AA): upload progress and errors must be announced without taking focus
  ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)), through a live region
  present from the start
  ([MDN, live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions)).
- Failure F30: a file name such as "Chart.jpg" is not a valid text alternative
  ([W3C](https://www.w3.org/WAI/WCAG22/Techniques/failures/F30)).

### Astryx

Read from `@astryxdesign/core` 0.6.8, the pinned version, in `node_modules`:

- `FileInput`: label, `accept`, `isMultiple`, `maxSize` and `maxFiles` with error statuses,
  `isLoading`, and `mode: 'dropzone' | 'input'`, the dropzone being its own dashed area
  (`dist/FileInput/FileInput.d.ts`).
- `ChatComposerInput.onFiles(files)`: called on files pasted or dropped onto the composer
  (`dist/Chat/ChatComposerInput.d.ts`). `ChatComposer` has a `drawer` slot for attachments and a
  `headerActions` slot for an attach button (`dist/Chat/ChatComposer.d.ts`).
- `Thumbnail`: an image preview with `alt`, `onRemove`, and `isLoading`; `Lightbox`: a full-screen
  viewer (`dist/Thumbnail`, `dist/Lightbox`).
- `TextArea` passes `onPaste`, `onDrop`, and `onDragOver` to its `<textarea>`.
- No component makes a whole page a drop target.

### Drop libraries

- react-dropzone 20.1.3 handles drop and paste
  ([README](https://github.com/react-dropzone/react-dropzone)); React Aria has `DropZone` and
  `FileTrigger` ([React Aria](https://react-aria.adobe.com/DropZone)). The
  [UI components](../decisions/ui-components.md) decision forbids any drag-and-drop library besides
  `@dnd-kit/react`, and Astryx already covers what they add.

### Server uploads

- fate's mutations are JSON only: an image would travel as base64, a third larger, through fate's
  cache (`@nkzw/fate` 1.7.7, `lib/server.mjs`).
- Hono parses multipart forms with `c.req.parseBody()`, buffering the whole body
  ([Hono request docs](https://hono.dev/docs/api/request)), and limits bodies with the `bodyLimit`
  middleware ([Hono docs](https://hono.dev/docs/middleware/builtin/body-limit)). The server sets no
  limit today ([`app.ts`](/packages/server/src/app.ts)).

### File safety

- OWASP: allow-list extensions, never trust `Content-Type`, check file signatures, generate file
  names, limit sizes, and re-encode images to drop metadata where possible
  ([OWASP file upload cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).
- An SVG runs scripts when opened directly on the app's origin (seen only in advisories found by
  search); Claude cannot read SVG anyway (see [the API](#claude-code-and-the-claude-api)).
- `X-Content-Type-Options: nosniff` stops the browser from reading an upload as HTML
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)).
- sharp, the usual Node image library, re-encodes and strips metadata by default, but is a native
  dependency with prebuilt binaries ([sharp docs](https://sharp.pixelplumbing.com/api-output/),
  [install](https://sharp.pixelplumbing.com/install/)).
- Pasted secrets stay in edit history: TruffleHog found 721 live secrets in public GitHub comments,
  about 10 % only in edits
  ([Truffle Security](https://trufflesecurity.com/blog/thousands-of-github-comments-leak-live-api-keys)).
  A committed screenshot stays in git history the same way.

### Images in git

- Git warns above 50 MiB, GitHub blocks files above 100 MiB, and recommends repositories under 1 GB
  ([GitHub docs, large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)).
- Git LFS stores pointers instead of files, but needs installing, and cannot be uploaded through
  GitHub's web UI
  ([GitHub docs, LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage),
  [Slicer discussion](https://discourse.slicer.org/t/2018-10-30-hangout/4588/5)).
- Git detects PNG and JPEG as binary without attributes
  ([gitattributes](https://git-scm.com/docs/gitattributes)).

### Markdown image syntax

- GFM: `![alt](url)`; a path with spaces must be written `<...>` or with `%20`
  ([GFM spec, examples 498–499](https://github.github.com/gfm/)).
- Obsidian embeds `![[x.png]]` and sizes `|300` are not GFM: GitHub shows them as text
  ([Obsidian embeds](https://obsidian.md/help/embeds)). `![alt](relative/path.png)`, without spaces,
  renders in GitHub and Obsidian alike.

## The code

### Important reads

- [`Composer.tsx`](/packages/web/src/Composer.tsx): the chat composer, Astryx `ChatComposer` and
  `ChatComposerInput`, sending text only through [`sessions.ts`](/packages/web/src/sessions.ts) and
  the `session.send` mutation.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): drafts, proposals, and bug reports, in a
  plain Astryx `TextArea`, autosaved through `text.save` and committed through `text.commit`, with a
  preview drawn by [`Blocks.tsx`](/packages/web/src/Blocks.tsx).
- [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx): review comments, on the
  [review page](/packages/web/src/ReviewPage.tsx) and mockups, written to `<file>-review.md`
  uncommitted, and committed with the verdict. The review's summary goes to the commit body.
- [`Question.tsx`](/packages/web/src/Question.tsx) and
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx): answers' comments and round notes, written
  into `clarifications-NN.md`.
- [`claude.ts`](/packages/server/src/runner/claude.ts): writes
  `{type: "user", message: {role: "user", content: text}, ...}` to stdin; `content` is a string.
  [`adapter.ts`](/packages/server/src/runner/adapter.ts): `Outgoing` is `{id, text, when}`, and
  `Capabilities` has no image flag.
- [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): refuses a blank message;
  take-back returns the text only. [`events.ts`](/packages/server/src/runner/events.ts) and
  [`cache.ts`](/packages/server/src/runner/cache.ts): a message item is `{id, text, origin, ...}`,
  stored as JSON in Uraeda's SQLite cache, outside the repository.
- [`Transcript.tsx`](/packages/web/src/Transcript.tsx): a human message is a plain text bubble.
- [`actions/text.rs`](/crates/core/src/actions/text.rs): writes a `&str`, only under `specs/`;
  [`api.rs`](/crates/core/src/api.rs) `feature_file` refuses subfolders.
- [`git.rs`](/crates/core/src/git.rs) and [`actions/place.rs`](/crates/core/src/actions/place.rs): a
  commit adds only the action's named paths, and refuses other staged files.
- [`files.ts`](/packages/server/src/files.ts): `/raw/*` as text and `/mockups/*` with a type map;
  both read through `api::read_raw`, which ends with `String::from_utf8`, so a PNG is a 404.
- [`files/document.rs`](/crates/core/src/files/document.rs): pulldown-cmark events into the document
  tree; `Tag::Image` falls into `_ => {}`, so `![alt](x.png)` shows as "alt".
- [`files/markdown.rs`](/crates/core/src/files/markdown.rs) and
  [`check/links.rs`](/crates/core/src/check/links.rs): `ura check` collects `Tag::Link` only, so a
  broken image link passes.
- [`actions/start.rs`](/crates/core/src/actions/start.rs): a single-file draft moves as
  `proposal.md` alone; a folder draft moves with all its files.
- [`finish.md`](/skills/uraeda/references/finish.md): the feature folder is deleted when it becomes
  a record; the [UI checks](../decisions/ui-checks.md) decision already lets `screenshots/` go with
  it.

### The proposal's path and existing actions

- **Writing a proposal**: the human types in the editor, which autosaves. With images, a dropped or
  picked image must be written to the repository, its link inserted at the cursor, and the preview
  must show it. Today the core cannot write it, the server cannot serve it, and the tree cannot draw
  it.
- **Committing a proposal or draft**: the commit holds the file alone (plus `PRIORITIES.md` for a
  draft). Its images must join it, and an image whose link was deleted before the commit is left
  over.
- **Starting a feature from a draft**: a single-file draft becomes `proposal.md` alone, so images
  next to it are left behind.
- **Reviewing**: comments are written uncommitted, then committed with the verdict, the review file
  and the reviewed file only. A review replaces the previous review file; its images would be left
  in the folder.
- **Answering questions**: answers and notes are written into the round's file and committed alone.
- **Chatting**: a message goes to stdin as a string and is stored in the cache. With images, they
  must reach the agent, be stored for the transcript, be shown in the bubble, survive `--resume`,
  and come back on take-back. A message of an image alone is refused today.
- **An agent's step**: a discovery or spec revision reads the proposal or review as text; nothing
  tells it to open the images it links.
- **Finishing**: the folder is deleted; images go with it, and a link to them from the record would
  break.
- **`ura check`**: a missing image passes; once image links are checked, so does Obsidian's
  `![[...]]` embed, which the core ignores.
- **Phones**: the UI is reached from a phone through `tailscale serve`
  ([stack](../decisions/stack.md)); there is no drag and drop there, only the button.

### Other features in flight

- `2026-10-13-multi-repo-server` has only a proposal: the server would open any folder. An image
  route has to name its repository, like `/raw` and `/mockups` will have to.

### Likely changes

Under every option:

- [`Composer.tsx`](/packages/web/src/Composer.tsx),
  [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx): an attach button, drop, and paste.
- A small hook for whole-page drop, with native events (an Astryx gap, per the
  [UI components](../decisions/ui-components.md) decision).
- [`files/document.rs`](/crates/core/src/files/document.rs),
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx), [`Spans.tsx`](/packages/web/src/Spans.tsx): an image
  node, drawn by the UI.
- [`api.rs`](/crates/core/src/api.rs) and the binding: reading bytes, and
  [`files.ts`](/packages/server/src/files.ts): serving images with their type and `nosniff`.
- [`check/links.rs`](/crates/core/src/check/links.rs): checking image links.
- [`claude.ts`](/packages/server/src/runner/claude.ts),
  [`adapter.ts`](/packages/server/src/runner/adapter.ts),
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts),
  [`events.ts`](/packages/server/src/runner/events.ts),
  [`Transcript.tsx`](/packages/web/src/Transcript.tsx): images in messages, and the validation
  script.
- The skill: [`SKILL.md`](/skills/uraeda/SKILL.md) (layout, markdown), the references that read
  proposals and reviews, [`finish.md`](/skills/uraeda/references/finish.md), and the example.

With images in the repository (see [storage](#storing-images-of-workflow-files)): new core actions
to write an image under a feature or draft, and the commits of text, reviews, and answers that
include the images they link. With chat images in the cache: a folder beside `runner.sqlite`.

## The proposal

### Paste is not mentioned

The proposal names drop and a button. Every product compared also takes paste, the fastest path for
a screenshot copied by the system's screenshot tool (see
[what they have in common](#what-they-have-in-common)).

### "In the page" with several fields

A drop "in the page" must land in one field. The chat page has one composer, and the editor one text
area, but the review page has a comment form only when one is open, and the question page has a
comment per question.

### Which texts

"Chats, proposals, and reviews" leaves out drafts and bug reports, written in the same editor as
proposals, and answers and notes, which are also human text in workflow files.

### Where the files live, and for how long

The proposal does not say. The [constitution](../CONSTITUTION.md#ii-git-and-plain-text-first)
requires workflow state as plain text in git, with exceptions justified in a decision, and durable
state recoverable from the repository alone ([III](../CONSTITUTION.md#iii-asynchronous-by-default)).
A binary image in a feature folder is such an exception; a chat image in the cache is not workflow
state, as chats are not.

### What the agent does with them

The value of a screenshot is the agent seeing it. The proposal does not say whether agents must open
images linked in proposals and reviews, which the skill does not ask today.

## Approaches

Criteria come from the proposal (screenshots, drop and button), the constitution (plain text in git,
[II](../CONSTITUTION.md#ii-git-and-plain-text-first); recoverable from the repository,
[III](../CONSTITUTION.md#iii-asynchronous-by-default); tools optional,
[V](../CONSTITUTION.md#v-tools-are-optional)), and the active decisions:
[agents](../decisions/agents.md), [stack](../decisions/stack.md),
[UI components](../decisions/ui-components.md), [UI checks](../decisions/ui-checks.md).

### Storing images of workflow files

Where an image attached to a proposal, review, or answer is kept. See [GitHub](#github),
[GitLab](#gitlab), [Obsidian](#obsidian), [images next to text in git](#images-next-to-text-in-git),
and [images in git](#images-in-git).

| Option                                   | Readable without Uraeda (V)          | Recoverable from git (III) | Repository size                 | Effort                               |
| ---------------------------------------- | ------------------------------------ | -------------------------- | ------------------------------- | ------------------------------------ |
| A. Files in the repository, next to it   | Yes: GitHub and Obsidian render them | Yes                        | Grows with every image, forever | Core actions, commits, a decision    |
| B. Files outside git, in the data folder | No: links break outside the machine  | No                         | None                            | Smaller, but a constitution conflict |
| C. Git LFS                               | Only with LFS installed              | Yes, with the LFS server   | Pointers only                   | Setup on every machine and CI        |

With A, the constitution asks for a decision justifying binary files in git
([II](../CONSTITUTION.md#ii-git-and-plain-text-first)).

### Folder and names

Only with option A or C of [storage](#storing-images-of-workflow-files). Where in the repository,
and under which name. See [Obsidian](#obsidian), [VS Code](#vs-code), and
[images next to text in git](#images-next-to-text-in-git).

| Option                                      | Found by an agent without Uraeda   | Survives start and finish                | Obsidian setting                 |
| ------------------------------------------- | ---------------------------------- | ---------------------------------------- | -------------------------------- |
| A. `images/` in the feature or draft folder | Yes, next to the files it explains | Moves with the folder; finish deletes it | "Subfolder under current folder" |
| B. The feature folder itself                | Yes, mixed with workflow files     | Same                                     | "Same folder"                    |
| C. One `specs/images/` folder               | Further from the files             | Stays after finish                       | "In the folder specified"        |

Names: the dropped or picked file's own name, made safe (lowercase, dashes, no spaces), or
`pasted-<date>-<time>.png` for clipboard data, numbered on conflict like VS Code.

### Images at the end of a feature

Only with option A or B of [folder and names](#folder-and-names). Finish deletes the folder (see
[the code](#important-reads)).

| Option                                           | What the default branch keeps | Repository size   | Effort                      |
| ------------------------------------------------ | ----------------------------- | ----------------- | --------------------------- |
| A. Deleted with the folder; history keeps them   | No image; the record is text  | History only      | None, like `screenshots/`   |
| B. Kept next to the record, `specs/done/<name>/` | Images the record embeds      | Grows on main too | A finish rule, a new layout |

### Images in chats

How a chat image reaches the agent and is kept. See
[Claude Code and the Claude API](#claude-code-and-the-claude-api) and [other agents](#other-agents).

| Option                                                    | Agent sees it           | Kept for the transcript | Other agents                | Fits [agents](../decisions/agents.md) |
| --------------------------------------------------------- | ----------------------- | ----------------------- | --------------------------- | ------------------------------------- |
| A. Saved in the data folder, sent as base64 blocks        | At once, in the message | Yes, with the cache     | Path or base64, per adapter | Yes: format inside the adapter        |
| B. Saved in the data folder, its path written in the text | Only if it calls Read   | Yes                     | Same for all                | Yes, but the text carries a path      |
| C. Committed in the repository                            | Either way              | Yes, in git             | Same                        | Chats are not workflow state          |

### Entry points

Which ways of attaching exist. See [what they have in common](#what-they-have-in-common) and
[accessibility](#accessibility).

| Option                          | Matches products | Phones | Effort                   |
| ------------------------------- | ---------------- | ------ | ------------------------ |
| A. Button, drop, and paste      | All of them      | Button | Small: paste is an event |
| B. Button and drop, as proposed | Misses paste     | Button | Same, minus paste        |

### Drop target

Where a drop lands. See [Claude.ai and Claude Code](#claudeai-and-claude-code) and
[browser file APIs](#browser-file-apis).

| Option                                     | Easy to hit    | Ambiguity                             | Effort                       |
| ------------------------------------------ | -------------- | ------------------------------------- | ---------------------------- |
| A. Anywhere on the page, to its text field | Yes            | Pages with several fields need a rule | A page-wide hook             |
| B. Onto the text field only                | Smaller target | None                                  | Astryx and `TextArea` events |

### Which texts take images

See [which texts](#which-texts).

| Option                                                                        | Covers                             | Effort                           |
| ----------------------------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| A. Chats, drafts, proposals, bug reports, review comments, answers, and notes | Every free text written to a file  | One component reused             |
| B. Chats, drafts, proposals, bug reports, and review comments                 | The proposal, plus the same editor | Slightly less                    |
| C. Chats, proposals, and review comments, as written                          | The proposal                       | The editor must tell kinds apart |

### Processing images

Whether images are changed before they are stored or sent. See [file safety](#file-safety) and
[Claude Code and the Claude API](#claude-code-and-the-claude-api).

| Option                                                 | Repository size                         | Metadata (GPS of photos) | New dependency |
| ------------------------------------------------------ | --------------------------------------- | ------------------------ | -------------- |
| A. Kept as they are, checked for type and size         | Original                                | Kept                     | None           |
| B. Re-encoded and downscaled on the server, with sharp | Smaller                                 | Removed                  | A native one   |
| C. Re-encoded in the browser, with a canvas            | Varies: PNG may grow, JPEG loses detail | Removed                  | None           |

### Agents reading images

How agents treat images linked in workflow files. See
[what the agent does](#what-the-agent-does-with-them).

| Option                                                      | Agent sees screenshots | Cost                       |
| ----------------------------------------------------------- | ---------------------- | -------------------------- |
| A. The skill says to open every image a file it reads links | Yes                    | Tokens per image, per step |
| B. Nothing: the agent decides                               | Maybe                  | None                       |

### Needs no choice

- **A preview before sending, and removing it**: Astryx's `Thumbnail` with `onRemove`, in the
  composer's drawer, follows chat products.
- **The link inserted at the cursor** in files: the only form that reads in plain text, GitHub, and
  Obsidian, like every markdown tool.
- **Size limit and errors**: the Claude API sets the upper bound; a message when a file is over it
  or of a type not accepted, as every product does.
- **Alt text**: no product asks for it at insertion; the inserted text is the human's to edit.
- **History in chats**: images stay in the transcript, like every chat product.
- **Upload transport**: a multipart route avoids base64 through fate's cache; the core still writes
  the file, as the [stack](../decisions/stack.md) decision requires.
- **Serving images**: required to show any of them; existing `/raw` and `/mockups` routes are the
  pattern.
- **Image mockups**: the spec reference allows "a generated image" as a mockup, which the UI cannot
  list today; serving images makes it possible, but it is not in the proposal.
- **Editors and the CLI**: Obsidian, VS Code, and Neovim users paste images with their editor's own
  tools; `ura check` then checks the links.

## Not checked

- ChatGPT's help pages, which refused access, and the official Codex image page, which was missing.
- GitHub's exact inserted markup, and whether it strips EXIF or renders WebP in repository markdown.
- Whether Claude Code's 10 MB piped-stdin cap applies to stream-json lines, and how it handles an
  oversized or HEIC image: only a small PNG was tested.
- Whether `paste` fires with focus on a non-editable element, and `dragleave` quirks per browser.
- Typical sizes of Retina screenshots: no source measured them.
- Removing an attachment before sending, in Claude.ai, Copilot, Cursor, and Codex: no page documents
  it.
