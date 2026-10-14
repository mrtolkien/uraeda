---
status: auto-approved
spec-revision: 1
---

# Plan: Image attachments

**Goal:** humans attach images, by drop, paste, button, or `:Uraeda image`, to drafts, proposals,
reports, review comments, answers, notes, and chat messages; workflow files' images are committed as
WebP next to them, chat images reach the agent by path.

**Architecture:** the Rust core owns every rule about an image: detecting, limiting, decoding,
re-encoding, naming, placing, moving a draft into a folder, and which images a commit holds. It
exposes three entry points, `api::attach_image`, `api::encode_image`, and `api::read_image`, reached
by the server through the binding and by `ura lsp` directly. The server owns transport and the chat
image store: an upload route, two image routes, and the data folder's `images/`. The sessions own a
message's images, and the Claude Code adapter owns how they are written to the agent. The web UI
owns where a file lands (page drop, paste, button) and inserting the returned link; it never names,
checks, or encodes an image. See the [spec's design](spec.md#design) and the
[attachments](../decisions/attachments.md) decision.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A never-committed image whose link was removed** must not reach `git add`: git fails on a
   pathspec that no longer exists. The commit deletes the file and stages the `images/` folder as
   one pathspec only when it exists or HEAD tracks files under it. Task 4.
2. **A draft committed before it became a folder** commits the old file's deletion with the new
   folder, with the subject "chore: edit the draft <title>", not "chore: draft <title>". Task 4.
3. **A path with `..`, a hidden part, or outside `specs/`** is refused by `attach_image` and
   `read_image`, and `GET /images/..%2F..%2Fetc%2Fpasswd` answers 404. Tasks 2 and 6.
4. **A file named `.png` holding HTML, or an SVG renamed `.png`**, is refused by its first bytes,
   whatever its name or declared type. Task 1.
5. **A decompression bomb**, a small PNG declaring 20000×20000 pixels, is refused from its header,
   before any pixel is decoded. Task 1.
6. **An upload over the body limit** answers the spec's over-20 MB text, without reading the body.
   Task 6.
7. **A cross-site POST to `/attach`** is refused by the existing guard. Task 6.
8. **Typing continues while an image uploads**: the link goes where the cursor was at the drop,
   shifted by nothing typed before it, and the text typed meanwhile is kept. Task 8.
9. **A drop outside every field** never makes the browser leave the app. Task 8.
10. **The startup cleanup of chat images** never deletes an image another server's session uses, nor
    one uploaded in the last 24 hours. Task 7.
11. **An image linked only from an unsaved field**, like an open comment form, is deleted by a
    verdict or a submit: the UI saves or blocks pending fields before a verdict or a submit.
    Task 11.
12. **A slow upload over 20 MB** may end in a network error before the server's JSON refusal
    arrives: `useAttach` refuses a file over 20 MiB before uploading it, with the core's text.
    Task 8.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these.

From the [attachments](../decisions/attachments.md) decision, word for word:

- An image attached to a workflow file MUST be saved in the `images/` folder of the folder holding
  that file: a feature's, a bug's, or a draft's folder. It MUST be linked from the file with a
  relative markdown image, `![alt](images/name.webp)`, and MUST be committed in the same commit as
  the file that links to it.
- A draft that gets an image MUST become a folder, `specs/drafts/<slug>/proposal.md` or
  `specs/backlog/<slug>/proposal.md`, holding its `images/` folder.
- A commit of a human's workflow file MUST delete the images of its folder's `images/` that no
  markdown file of that folder links to.
- Finishing a feature or a bug MUST delete its images with its folder. A record MUST NOT link to an
  image.
- Images attached to a chat MUST be saved in Uraeda's data folder, under `images/`, and MUST NOT be
  committed.
- Every attached image MUST be re-encoded before it is saved, by the Rust core, with libwebp: JPEG
  and lossy WebP inputs as lossy WebP, quality 80; other inputs as near-lossless WebP, level 60,
  quality 75; downscaled so its long edge is at most 2576 pixels, and rotated by its EXIF
  orientation; with no metadata. Animated GIFs MAY be kept as they are.
- Accepted inputs MUST be PNG, JPEG, GIF, and WebP, detected by their first bytes, at most 20 MB and
  40 million pixels. SVG and other types MUST be refused.
- TypeScript code and editor plugins MUST NOT encode or name attached images, nor write them into
  the repository: they pass the bytes to the core, through the binding or `ura lsp`. The server MAY
  write the core's encoded chat images to the data folder.
- The server MUST serve images only with their detected type, `X-Content-Type-Options: nosniff`, and
  a `Content-Security-Policy` of `default-src 'none'`.

From the [stack](../decisions/stack.md) decision:

- TypeScript code MUST reach the core only through the binding,
  [`packages/binding`](/packages/binding/), and MUST NOT reimplement its parsing, validation, or
  states.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand.
- The language server's completions and code actions MUST only edit the open document. Actions that
  write another file or commit MUST be commands the user runs explicitly, never code actions.
- Editor plugins MUST live in `editors/<editor>/`, and MUST reach workflow files only through
  `ura lsp`. They MUST NOT parse workflow files, their frontmatter, or their structure, with a
  library or by hand.

From the [agents](../decisions/agents.md) decision:

- Each adapter MUST declare its capabilities, such as steering a message into a turn, queueing one
  after it, taking one back, asking for approvals, and reporting sub-agents, and the UI MUST offer
  only what the session's agent declares. The tests that `vp run ready` runs MUST use a fake
  adapter, and MUST NOT run a real agent.
- An agent's own formats MUST stay inside its adapter.

From the [UI components](../decisions/ui-components.md) decision:

- A raw element MAY be used where no Astryx component fits, only with a lint suppression on its line
  giving the reason, and the plan MUST list it as an Astryx gap.
- Reordering by drag MUST use `@dnd-kit/react`. No other drag-and-drop library MAY be added.

From the [CLI](../decisions/cli.md) decision:

- A feature that adds a dependency to the CLI MUST measure the size it adds to the release binary,
  in its discovery or its spec, and SHOULD choose the smallest dependency that does the job, unless
  a decision names one.

From the [UI checks](../decisions/ui-checks.md) decision:

- UI tests MUST drive the UI as a user does, through roles, labels, and visible text, and assert
  what the user sees or what is written to the repository.
- Before handing over a UI change, the agent MUST take screenshots of every changed view at both
  sizes and in both themes, review them against the UI decisions and the spec's mockups, fix what it
  finds, and commit them in the feature's folder under `screenshots/`.

From the spec, exact texts and values: the names, links, and alt texts of [Data](spec.md#data), the
refusals of [Error handling](spec.md#error-handling), "Adding <name>…" and "Added <name>", "Add
image" and "Add images", "Image", "Image missing", at most 10 images per chat message, the
`[Image: <absolute path>]` line, and the accepted picker types
`image/png,image/jpeg,image/gif,image/webp`.

Existing guarantees to keep:

- Every write to a feature is refused while its agent works, through `writable`
  ([`fate/sessions.ts`](/packages/server/src/fate/sessions.ts)).
- A commit holds only its action's paths, and refuses other staged files (`ensure_only_staged`,
  [`actions/place.rs`](/crates/core/src/actions/place.rs)).
- The core's write lock serializes writes ([`api.rs`](/crates/core/src/api.rs), `write_lock`).
- Image tool results never reach the transcript or the cache
  ([`claude-events.ts`](/packages/server/src/runner/claude-events.ts), `toolOutput`).
- `uraeda-cli` builds without napi (the `vp run ready` guard).

## Code read

- [`crates/core/src/api.rs`](/crates/core/src/api.rs): `ApiError` codes `refused`, `conflict`,
  `hook`; `text_place` resolves a draft to the default branch's checkout and anything else to the
  feature's place; `save_text`, `commit_text`, `add_comment`, `approve`, `request_changes`,
  `submit_answers`, and `retry_commit` are the entry points whose commits gain images; `read_raw`
  reads a feature's file from its worktree or branch tip, others only when tracked, then fails on
  non-UTF-8.
- [`actions/text.rs`](/crates/core/src/actions/text.rs): `change` builds `paths = [path]`, plus
  `PRIORITIES.md` for drafts, and refuses "no change to commit" when the file equals HEAD and
  `paths.len() == 1`. [`actions/review.rs`](/crates/core/src/actions/review.rs) builds verdict paths
  at `approve` and `request_changes`, and `verdict_paths`;
  [`actions/answer.rs`](/crates/core/src/actions/answer.rs) at `submit`. The CLI prints these paths
  for `--no-commit` ([`crates/cli/src/review.rs`](/crates/cli/src/review.rs),
  [`answer.rs`](/crates/cli/src/answer.rs)).
- [`git.rs`](/crates/core/src/git.rs) `commit`: `git add --all -- <paths>` for paths that exist or
  are staged; a path that neither exists nor is tracked fails. `others_staged` treats a folder path
  as covering its contents.
- [`actions/start.rs`](/crates/core/src/actions/start.rs): a folder draft moves with every file,
  `images/` included, and finds its `PRIORITIES.md` entry for both `drafts/x.md` and
  `drafts/x/proposal.md` links. [`files/priorities.rs`](/crates/core/src/files/priorities.rs):
  `parse` gives entries with their `link` and `line`.
- [`today.rs`](/crates/core/src/today.rs): `today()` reads `URA_TODAY`, else `date +%F`; no time of
  day exists yet.
- [`files/document.rs`](/crates/core/src/files/document.rs): `Span` is a flat struct with an
  optional `link: SpanLink { target, wiki, path }`; `Tag::Image` is unhandled.
  [`files/markdown.rs`](/crates/core/src/files/markdown.rs) collects `Tag::Link` only;
  [`check/links.rs`](/crates/core/src/check/links.rs) checks links that end in `.md` or resolve into
  `specs/`.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs): every export is an `AsyncTask<Job<T>>`
  over an `api` function; errors reject as `"<code>: <message>"`. napi 3.14's `Buffer` converts from
  and to `Vec<u8>`. `packages/binding/index.d.ts` is generated by
  `vp run --filter uraeda-binding build` and committed.
- Core tests: `crates/core/tests/*.rs` with `common/repo.rs` (`TestRepo`) and `common/mod.rs`
  (`fixture`); actions take `today` as a parameter; `fixtures/` is excluded from lint and format,
  and `.gitattributes` marks it `-text`. No image is tracked anywhere today.
- [`packages/server/src/app.ts`](/packages/server/src/app.ts): guard, fate context, fate routes,
  `files()` routes, then static files. [`files.ts`](/packages/server/src/files.ts): `/raw/*` and
  `/mockups/*` through `binding.readRaw`. [`dev.ts`](/packages/server/src/dev.ts): `SERVER_PATHS`.
  [`fate/context.ts`](/packages/server/src/fate/context.ts):
  `Context = { binding, repo, sessions }`, with no data folder.
  [`live.ts`](/packages/server/src/live.ts) `startSessions` opens `<dataDir>/runner.sqlite` and runs
  startup hooks; [`main.ts`](/packages/server/src/main.ts) and `dev.ts` build the `ClaudeAdapter`
  with `{ pluginDir }` only.
- [`runner/adapter.ts`](/packages/server/src/runner/adapter.ts): `Capabilities`, `Outgoing`.
  [`runner/claude.ts`](/packages/server/src/runner/claude.ts): `claudeArgs`, capabilities, `send`.
  [`runner/sessions.ts`](/packages/server/src/runner/sessions.ts): `send` refuses blank text; the
  steered and queued paths build the message item; the title comes from `chatTitle`; `takeBack`
  returns nothing, the UI restoring the text from its own item.
  [`runner/cache.ts`](/packages/server/src/runner/cache.ts): items stored as JSON `data`; one
  `runner.sqlite` for every repository's server; `interrupted` checks live pids.
  [`runner/fake.ts`](/packages/server/src/runner/fake.ts): `sent: Outgoing[]`.
  [`fate/views.ts`](/packages/server/src/fate/views.ts) lists the capabilities field by field.
- Server tests: `src/__tests__/helpers.ts` (`testApp`, `testServer`, `mutate`),
  `runner/__tests__/helpers.ts` (`testSessions`), `files.test.ts` for routes, `claude.test.ts`
  asserting the exact arguments and capabilities.
- [`scripts/validate-claude.ts`](/packages/server/scripts/validate-claude.ts): `run(message, ...)`
  over the real adapter, `report(name, ok, got)`.
- [`Composer.tsx`](/packages/web/src/Composer.tsx): Astryx `ChatComposer` and `ChatComposerInput`;
  Astryx refuses to submit empty text in `ChatComposer`, `ChatSendButton`, and the input's Enter.
  [`SessionPage.tsx`](/packages/web/src/SessionPage.tsx) holds the composer's text, and restores a
  taken-back text. [`Transcript.tsx`](/packages/web/src/Transcript.tsx) `Message` draws the bubble.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx): a TextArea without a ref, saved by
  [`useSave`](/packages/web/src/useSave.ts), remounted on a path change (`key={route.path}` in
  [`App.tsx`](/packages/web/src/App.tsx)). [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx),
  [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx) (`Draft` state, general comments),
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx) (an iframe that swallows drops),
  [`Question.tsx`](/packages/web/src/Question.tsx) (`GrowingTextArea`, forwarding no ref), and
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) (notes).
- [`Spans.tsx`](/packages/web/src/Spans.tsx): one branch per span kind;
  [`routes.tsx`](/packages/web/src/routes.tsx) `inApp` excludes `/raw` and `/mockups`.
- Astryx 0.6.8: `ChatComposer` `drawer` and `headerActions`; `ChatComposerInput.onFiles` for paste
  and drop on the input; `ChatComposerDrawer`; `Thumbnail` (`onRemove`, `isLoading`); `Lightbox`;
  `TextArea` forwarding its ref and HTML props; `useAnnounce` for live regions; no paperclip icon,
  no page-wide drop, and `FileInput` is a visible field.
- UI tests: `__tests__/helpers.tsx` `renderPage` with `serverFetch`, which forces JSON bodies;
  `__browser__/helpers.tsx` (`show`, `checkLayout`); `vite.browser.config.ts` commands;
  `layout.test.tsx` `PAGES`; `scripts/screenshots.ts`.
- [`crates/lsp/src/commands.rs`](/crates/lsp/src/commands.rs): `COMMANDS`, `run`, `Outcome`,
  `start`'s `opened`; tests in `crates/lsp/tests/commands.rs`.
  [`editors/nvim/lua/uraeda/actions.lua`](/editors/nvim/lua/uraeda/actions.lua) `M.start` and the
  actions list; [`command.lua`](/editors/nvim/lua/uraeda/command.lua) takes one argument;
  [`client.lua`](/editors/nvim/lua/uraeda/client.lua) `command`; `tests/test_doc.lua` requires help
  tags for every action and option.
- Validation: `vp run ready` runs `cargo fmt --check`, clippy with `-D warnings`, the Rust tests,
  `ura check`, the binding build, `vp check`, `vp test`, the CLI build, the Neovim tests, and the
  web build. CI prints the release binary's size. `flake.nix`'s shell and the dist runners have a C
  compiler.

## Constitution check

| Principle                            | Complies | Notes                                                   |
| ------------------------------------ | -------- | ------------------------------------------------------- |
| I. Humans stay in control            | yes      | Within the approved spec and decision                   |
| II. Git and plain text first         | yes      | Images in git, as the attachments decision justifies    |
| III. Asynchronous by default         | yes      | Workflow files' images are committed with them          |
| IV. Review effort matches impact     | yes      | Agents open the images; the skill says so               |
| V. Tools are optional                | yes      | Task 3 writes the manual rules in the skill             |
| VI. Code is checked against the spec | yes      | Every scenario has its test; new abstractions are below |

## Decisions

The decisions this plan relies on, and where it follows them:

- [Attachments](../decisions/attachments.md): every rule (tasks 1 to 4, 6, 7).
- [Stack](../decisions/stack.md): encoding, names, and commits in the core (tasks 1, 2, 4); images
  drawn from the document tree (tasks 3, 9); the explicit Neovim command (task 12).
- [Agents](../decisions/agents.md): the `images` capability and the image lines inside the adapter
  (task 7).
- [CLI](../decisions/cli.md): the binary's growth measured (task 1); the skill updated with
  `ura check` (task 3).
- [Git](../decisions/git.md): images committed through the existing `git` commit (task 4).
- [UI components](../decisions/ui-components.md), [UI layout](../decisions/ui-layout.md),
  [UI behaviour](../decisions/ui-behaviour.md), [UI checks](../decisions/ui-checks.md): tasks 8 to
  11, and 13.
- [Toolchain](../decisions/toolchain.md): every task ends on `vp run ready`.

## Complexity tracking

| Abstraction or exception                                           | Why it is needed                                                              | Simpler alternative rejected because                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| `images` module and its libwebp wrapper (core)                     | One encoder for the server and `ura lsp`, as the decision requires            | sharp in the server: out of reach of `ura lsp`            |
| `attach` action (core)                                             | Places, names, and moves drafts for both callers                              | Doing it in each caller would duplicate the rules         |
| `linked_images` helper (core)                                      | One rule for which images the text, review, and answer commits hold           | Three copies of the rule would drift                      |
| `URA_NOW` and `today::stamp()` (core)                              | Pasted names need local time, tests need a fixed one                          | Passing a time through every caller and the binding       |
| `/attach`, `/images/*`, `/chat-images/*` routes (server)           | Uploads as multipart, and serving bytes; fate is JSON only                    | Base64 through fate: a third larger, through fate's cache |
| Chat image store (server)                                          | Writes, resolves, and cleans the data folder's images for sessions and routes | Inlining it in each route and in the sessions             |
| `ServerFetch` context (web)                                        | `useAttach` must reach the in-process server in happy-dom tests, as fate does | Stubbing global `fetch` per test                          |
| `useImageDrop`, `useAttach`, `AttachButton`, `insertLink` (web)    | Shared by the editor, comments, answers, notes, and the composer              | One copy per page                                         |
| `useImageText` (web)                                               | One text field taking images, shared by the editor, comments, answers, notes  | The same cursor tracking copied into four fields          |
| Astryx gap: page-wide drop on `window`                             | No Astryx component makes a page a drop target                                | A dropzone per field misses the proposal's "in the page"  |
| Astryx gap: hidden `<input type="file">`                           | `FileInput` is a visible field, not a picker behind an icon button            | A visible field in the composer and toolbars              |
| Astryx gap: a custom send button and Enter for image-only messages | Astryx refuses to submit empty text                                           | Requiring text with every image, against US2.4            |
| `uraeda:attach` icon, registered with Astryx                       | Astryx has no paperclip                                                       | `lucide-react` as a new dependency for one icon           |

## Review comments

- **C1** (sharp): carried out by tasks 1 and 2, which encode in the core, as the spec already says.
- **C2** (lossy where it halves the size without losing text): measured while planning, see
  [R1](rulings.md#r1-screenshots-stay-near-lossless-60). No setting halves the near-lossless size:
  near-lossless 20 saves 12 %, a 256-colour palette 1 to 15 %, and lossy WebP at quality 95 doubles
  it. Near-lossless 60 stays, as the decision says. Task 1.

---

## Task 1: Image encoder in the core

**Files:**

- Modify: `Cargo.toml` (workspace dependencies `image` 0.25, default features off, features `png`,
  `jpeg`, `gif`, `webp`; `libwebp-sys` 0.14, default features), `crates/core/Cargo.toml`
- Create: `crates/core/src/images.rs`, `crates/core/src/images/webp.rs`
- Modify: `crates/core/src/lib.rs`
- Create: `fixtures/images/` (see step 1)
- Test: `crates/core/tests/images.rs`

**Interfaces:**

- Produces:
  - `pub struct Encoded { pub bytes: Vec<u8>, pub extension: &'static str, pub width: u32, pub height: u32 }`,
    `extension` being `"webp"` or `"gif"`.
  - `pub fn images::encode(bytes: &[u8], name: &str) -> Result<Encoded, ImageError>`, `name` used
    only in messages.
  - `pub enum ImageError` whose `Display` is the spec's exact refusal text: `Type { name }`,
    `Size { name, bytes }`, `Pixels { name, width, height }`, `Unreadable { name }`.
  - `pub const MAX_BYTES: usize = 20 * 1024 * 1024`, `pub const MAX_PIXELS: u64 = 40_000_000`,
    `pub const MAX_EDGE: u32 = 2576`.

- [x] **Step 1: Write the failing tests, and the fixtures they use**

Create `fixtures/images/`, small files only (under 600 KiB in all), each named after what it holds:
`desktop.png` and `phone.png` (two 1x screenshots from
`git show f30e3f7^:specs/2026-10-13-chat-in-the-web-ui/screenshots/...`), `photo.jpg` (a 3000×2000
JPEG at quality 85 with EXIF GPS and orientation 6, generated by a script kept as
`fixtures/images/README.md` instructions), `still.gif`, `animated.gif` (3 frames), `lossy.webp`,
`lossless.webp`, `drawing.svg`, `page.png` (an HTML file named `.png`), `truncated.png` (the first
200 bytes of `desktop.png`), and `bomb.png` (a valid PNG header declaring 20000×20000). In
`crates/core/tests/images.rs`, one table-driven test, one row per fixture:

```rust
#[test]
fn attached_images_are_checked_and_reencoded() {
    // fixture, expected extension or refusal text, expected size
    let rows = [
        ("desktop.png", Ok(("webp", 1440, 900))),
        ("photo.jpg", Ok(("webp", 1717, 2576))), // rotated, then downscaled: R13
        ("animated.gif", Ok(("gif", ..))),        // bytes unchanged
        ("still.gif", Ok(("webp", ..))),
        ("lossy.webp", Ok(("webp", ..))),
        ("drawing.svg", Err("Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.")),
        ("page.png", Err("Only PNG, JPEG, GIF, and WebP images can be added: page.png is not one.")),
        ("truncated.png", Err("This image could not be read: truncated.png.")),
        ("bomb.png", Err("This image is too large: bomb.png is 20000×20000 pixels.")),
    ];
    // ...
}
```

Also: `an_image_over_20_mb_is_refused_before_decoding` (21 MiB of zeros after a PNG signature: "This
image is over 20 MB: big.png is 21 MB."); `reencoded_images_hold_no_metadata` (SC-004: the photo's
output holds none of `Exif\0`, `EXIF`, `XMP `, nor the camera model string);
`photos_are_lossy_and_screenshots_near_lossless` (the JPEG's output has a `VP8 ` chunk, the PNG's a
`VP8L` chunk); `an_unknown_type_is_refused_before_its_size` (see
[R11](rulings.md#r11-the-type-is-checked-before-the-size)); `photos_are_turned_upright`; and an
`#[ignore]`d `the_screenshot_corpus_shrinks_to_2400_kib` (SC-001, see
[R2](rulings.md#r2-the-screenshot-corpus-stays-in-git-history)), reading the 94 screenshots with
`git show` from the commits listed in the test, and asserting their total is at most 2400 KiB.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test images`
- Expected: FAIL, `unresolved import uraeda_core::images`.

- [x] **Step 3: Implement `images::encode`**

In the spec's order of refusals: detect the type from the first bytes (PNG signature, JPEG
`FF D8 FF`, `GIF87a`/`GIF89a`, `RIFF....WEBP`), refusing anything else; refuse over `MAX_BYTES`;
read the dimensions from the header with `image::ImageReader` and refuse over `MAX_PIXELS`, before
decoding, then decode with `image::Limits` allowing `MAX_PIXELS` at 8 bytes a pixel; keep a GIF with
more than one frame unchanged; otherwise decode, apply the EXIF orientation
(`ImageDecoder::orientation`, `DynamicImage::apply_orientation`), downscale with Lanczos 3 when the
long edge exceeds 2576, and encode with libwebp: lossy quality 80, method 4, for JPEG and for WebP
holding a `VP8 ` chunk; near-lossless (`lossless = 1`, `near_lossless = 60`, quality 75, method 4)
for everything else. Sizes in messages are in MB of 1,048,576 bytes, rounded to one decimal, with
`.0` dropped. `images/webp.rs` holds the only `unsafe` code: `WebPConfigInit`,
`WebPPictureImportRGBA`, a memory writer, `WebPEncode`, and the frees, behind
`fn encode_rgba(pixels: &[u8], width: u32, height: u32, settings: Settings) -> Result<Vec<u8>, WebPEncodingError>`,
each `unsafe` block with a `// SAFETY:` comment; `encode` turns libwebp's error into `Unreadable`
(see [R12](rulings.md#r12-the-libwebp-wrapper-returns-libwebps-error)).

- [x] **Step 4: Measure the binary, and run all tests**

- Run: `cargo build --release -p uraeda-cli` before and after the change, `ls -l target/release/ura`
- Expected: at most 1 MB larger (SC-003); write both sizes in the commit body.
- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add Cargo.toml Cargo.lock crates/core fixtures/images
git commit -m "feat(image-attachments): re-encode images in the core"
```

## Task 2: Attaching an image to a workflow file

**Files:**

- Create: `crates/core/src/actions/attach.rs`
- Modify: `crates/core/src/actions/mod.rs`, `crates/core/src/api.rs`, `crates/core/src/today.rs`,
  `crates/core/src/view.rs`, `crates/core/src/images.rs` (`mime`),
  `crates/core/src/files/priorities.rs` (`retarget`), `packages/binding/index.d.ts` (generated)
- Test: `crates/core/tests/attach.rs`

**Interfaces:**

- Consumes: `images::encode`, `Encoded` (task 1).
- Produces:
  - `pub fn today::stamp() -> String`: local time as `YYYYMMDD-HHmmss`, from `URA_NOW` when set,
    else `date +%Y%m%d-%H%M%S`.
  - `AttachedView { path: String, link: String, moved: Option<String> }` in `view.rs`, a napi object
    like the other views.
  - `pub fn api::attach_image(repo: &Path, path: &str, bytes: &[u8], name: Option<&str>) -> Result<AttachedView>`:
    `name` is the original file name, `None` for clipboard data.
  - `pub fn api::encode_image(bytes: &[u8], name: &str) -> Result<Encoded>`, errors as `refused`.
  - `pub fn api::read_image(repo: &Path, path: &str) -> Result<(Vec<u8>, &'static str)>`: the bytes
    and the MIME type, for PNG, JPEG, GIF, or WebP files under `specs/` only, read like `read_raw`,
    except a draft's, read from the default branch's checkout, else its tip
    ([R14](rulings.md#r14-a-drafts-image-is-read-from-the-default-branchs-checkout)); anything else
    is `refused` as "<path>: no such file".
  - `pub fn images::mime(bytes: &[u8]) -> Option<&'static str>`: the MIME type of an accepted image,
    from its first bytes.
  - `pub fn priorities::retarget(text, line, from, to) -> Option<String>`: replaces a link target in
    one entry's text, the rest left as written (R8).

- [x] **Step 1: Write the failing tests**

With `URA_NOW=20261014-103512` set in the test, on a `TestRepo` with a feature
`2026-10-14-login-banner` (proposal only) and a draft `specs/drafts/login-banner.md` linked from
`PRIORITIES.md` as `[Login banner](drafts/login-banner.md)`:

- `US1_1_a_dropped_image_is_saved_next_to_the_proposal`: attaching `desktop.png` as
  `Screenshot 2026-10-14 at 10.35.12.png` returns
  `path = "specs/2026-10-14-login-banner/images/screenshot-2026-10-14-at-10-35-12.webp"`,
  `link = "![Screenshot 2026-10-14 at 10.35.12](images/screenshot-2026-10-14-at-10-35-12.webp)"`,
  `moved = None`, and the file exists.
- `US1_2_a_pasted_image_is_named_by_the_time`: `name = None` gives
  `images/pasted-20261014-103512.webp` and alt `pasted image`.
- `names_are_lowercase_dashed_and_never_overwrite`: table: `login.png` → `login.webp`, then
  `login-2.webp`, then `login-3.webp`; `😀.png` → `image.webp`; a 70-character name is cut at 60;
  `a]b.png` gives the alt `a\]b`.
- `US1_6_a_single_file_draft_becomes_a_folder`: attaching to `specs/drafts/login-banner.md` moves it
  to `specs/drafts/login-banner/proposal.md`, returns `moved = Some(that path)`, saves the image in
  `specs/drafts/login-banner/images/`, and `PRIORITIES.md` links `drafts/login-banner/proposal.md`,
  its entry's other text unchanged.
- `a_taken_draft_folder_name_gets_a_number`: with `specs/drafts/login-banner/` existing, the draft
  becomes `specs/drafts/login-banner-2/proposal.md`.
- `paths_outside_a_workflow_folder_are_refused`: `specs/../x.md`, `specs/.hidden/x.md`, `README.md`,
  and `specs/PRIORITIES.md` are refused (Review focus 3).
- `images_are_read_by_their_bytes_only`: `read_image` returns `image/webp` for an attached image,
  and refuses `specs/2026-10-14-login-banner/proposal.md` and `specs/../Cargo.toml`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test attach`
- Expected: FAIL, `cannot find function attach_image in module api`.

- [x] **Step 3: Implement**

`attach::attach(place, path, bytes, name, stamp)` resolves the folder holding `path`, which must be
a markdown file directly in a feature's, a bug's, or a draft's folder, or a single-file draft. A
single-file draft is moved first: into `specs/<drafts|backlog>/<slug>/proposal.md`, `slug` being the
file name without `.md`, numbered when the folder exists; the `PRIORITIES.md` entry linking it gets
its link target replaced, nothing else of its text. The image is encoded with `images::encode`,
named per [Data](spec.md#data), and written. `api::attach_image` takes the write lock, finds the
place as `text_place` does, and maps `ImageError` to `refused` with its text.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core packages/binding/index.d.ts specs/2026-10-13-image-attachments
git commit -m "feat(image-attachments): attach images to workflow files"
```

## Task 3: Images in the document tree, `ura check`, and the skill

**Files:**

- Modify: `crates/core/src/files/document.rs` (`Span`, `Tag::Image`),
  `crates/core/src/files/markdown.rs` (`Link`), `crates/core/src/check/links.rs`
- Modify: `skills/uraeda/SKILL.md`, `skills/uraeda/references/finish.md`,
  `skills/uraeda/assets/templates/specs/README.md`, `specs/README.md`, `README.md` if it lists the
  folder layout
- Test: `crates/core/tests/document.rs`, `crates/core/tests/check.rs`

**Interfaces:**

- Produces:
  - `Span` gains `image: Option<SpanImage>`, `SpanImage { target: String, path: Option<String> }`,
    `path` resolved like a link's; the span's `text` is the alt text. Generated into `index.d.ts` by
    this task's binding build.
  - `Link` gains `image: bool`; image links are in `document.links`.

- [x] **Step 1: Write the failing tests**

- `an_image_is_a_span_with_its_alt_text_and_path`: `![Login](images/login.webp)` in
  `specs/2026-10-14-x/proposal.md` gives one span with `text = "Login"`,
  `image.path = Some("specs/2026-10-14-x/images/login.webp")`; `![x](https://e.com/a.png)` gives
  `path = None`; `![[shot.png]]` stays text.
- In `check.rs`: `a_missing_image_into_specs_is_a_problem`: `links.file`, "no file
  images/gone.webp", the target as written, like every missing file
  ([R24](rulings.md#r24-a-missing-image-is-named-as-its-link-writes-it)), on its line; an existing
  image is not.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test document --test check`
- Expected: FAIL, `no field image on type Span`.

- [x] **Step 3: Implement, then write the skill**

Handle `Tag::Image` like `Tag::Link`, the alt text becoming the span's text. Collect image links in
`markdown.rs`. In the skill:

- `SKILL.md`, the folder layout: `images/` in feature, bug, and folder-draft folders, "images a
  human attached, linked from their files".
- `SKILL.md`, Markdown: "**Images**: `![alt](images/name.webp)`, saved in the `images/` folder next
  to the file", then the decision's encoding in one sentence, and the rule that a draft with images
  is a folder; and that `ura check` checks image links.
- `SKILL.md`, Rules for agents, one short line: "When a human's file links an image, open it."
- `finish.md`: images go with the folder; the record links none.
- The specs README template and this repository's `specs/README.md`, a link to it: `images/`.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS, `ura check` included.

- [x] **Step 5: Commit**

```bash
git add crates/core skills specs/README.md README.md
git commit -m "feat(image-attachments): images in documents, checks, and the skill"
```

## Task 4: Commits hold the images their files link

**Files:**

- Create: `crates/core/src/actions/images.rs` (the `linked_images` helper)
- Modify: `crates/core/src/actions/text.rs` (`change`), `review.rs` (`approve`, `request_changes`,
  `verdict_paths`), `answer.rs` (`submit`), `crates/core/src/api.rs` (`retry_commit`),
  `crates/core/src/git.rs` (`commit`, see
  [R25](rulings.md#r25-a-retried-commit-skips-a-folder-already-deleted)),
  `crates/cli/src/review.rs`, `crates/cli/src/answer.rs`
- Test: `crates/core/tests/actions.rs`, `crates/core/tests/api.rs` (`retry_commit`),
  `crates/cli/tests/` (the `--no-commit` outputs)

**Interfaces:**

- Consumes: `attach_image` (task 2), to set tests up; image links in `document.links` (task 3).
- Produces:
  - `pub fn linked_images(place: &Place, folder: &str) -> Result<Vec<String>, ActionError>`: deletes
    every file under `<folder>/images/` that no markdown file of `<folder>` or its subfolders links,
    by an image, a link, a wikilink, or an embed
    ([R31](rulings.md#r31-markdown-links-of-any-kind-keep-an-image-html-does-not),
    [R33](rulings.md#r33-folders-under-images-follow-the-same-rule-and-git-says-what-changed));
    returns `["<folder>/images"]` when that folder exists, or HEAD or the index holds files under it
    ([R29](rulings.md#r29-a-file-staged-under-images-keeps-the-folder-in-the-commit)), else `[]`.
  - Changed behaviour: the text, review, and answer changes append `linked_images` to their paths; a
    text change counts as a change when only images changed; a folder draft moved from a file
    tracked at HEAD and gone adds that path
    ([R30](rulings.md#r30-a-moved-draft-is-found-by-its-priorities-line-or-its-title)), with the
    subject "chore: edit the draft <title>" or "chore: edit <title> in the backlog".

- [x] **Step 1: Write the failing tests**

In `crates/core/tests/actions.rs`:

- `US1_5_a_proposal_commits_its_images_and_drops_the_unlinked`: a proposal linking
  `images/login.webp`, and an unlinked, never-committed `images/old.webp`; committing holds
  `proposal.md` and `images/login.webp`, and `images/old.webp` no longer exists (Review focus 1).
- `an_image_unlinked_after_its_commit_is_deleted_by_the_next`: commit a proposal with an image,
  remove the link, commit: the commit deletes the image.
- `US1_7_a_draft_folder_starts_with_its_images`: start a folder draft with `images/login.webp`; the
  feature's folder holds both, and the link resolves.
- `a_committed_draft_moved_into_a_folder_commits_the_move` (Review focus 2): the subject is
  `chore: edit the draft Login banner`, and the commit deletes `specs/drafts/login-banner.md`.
- `US3_3_a_verdict_commits_the_review_images`: approving a spec whose review links
  `images/shot.webp` commits `spec.md`, `spec-review.md`, and the image.
- `US4_3_submitted_answers_commit_their_images`: answers linking two images commit both.
- `a_replaced_review_keeps_images_another_file_links`: an image linked by the proposal stays after
  the review linking it is replaced.
- `images_alone_are_a_change_to_commit`: adding only an image to a committed draft's folder is not
  "no change to commit".

Update the CLI tests whose `--no-commit` output lists paths, to the new lists: `ura review` lists
every path, "commit a, b, and c", and `ura answer --submit --no-commit` reads "commit it with
<folder>/images." when the round links images.

In `crates/core/tests/api.rs`, `try_again_commits_a_deleted_image`: an approval refused by a hook
after deleting the folder's last image is committed again by `retry_commit`.

- [x] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-core --test actions`
- Expected: FAIL, `US1_5_...`: the commit holds `proposal.md` only.

- [x] **Step 3: Implement**

Add `linked_images` to every human commit listed above, and to `retry_commit`'s paths. Links come
from `files::markdown`'s `document.links`. `ensure_only_staged` receives the same paths.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/core crates/cli
git commit -m "feat(image-attachments): commit images with the files that link them"
```

## Task 5: The binding

**Files:**

- Modify: `crates/binding/src/lib.rs`, `packages/binding/index.d.ts`, `packages/binding/index.js`
  (generated)
- Test: `packages/binding/index.test.ts`

**Interfaces:**

- Consumes: `api::attach_image`, `api::encode_image`, `api::read_image` (task 2), `SpanImage` (task
  3).
- Produces, in `uraeda-binding`:
  - `attachImage(repo: string, path: string, bytes: Buffer, name?: string): Promise<AttachedView>`
  - `encodeImage(bytes: Buffer, name: string): Promise<EncodedImage>`, with
    `EncodedImage { bytes: Buffer; extension: "webp" | "gif"; width: number; height: number }`
    declared in the binding crate, since `Buffer` is not `Serialize`.
  - `readImage(repo: string, path: string): Promise<ImageFile>`, with
    `ImageFile { bytes: Buffer; type: string }`.
  - `Span.image?: SpanImage`, `SpanImage { target: string; path?: string }`.

- [x] **Step 1: Write the failing tests**

`attaches an image to a proposal and reads it back`: on `fixtureRepo()`, `attachImage` with
`fixtures/images/desktop.png` returns a `link` starting `![desktop](images/desktop`, and `readImage`
of its `path` returns `type: "image/webp"`. `refuses an SVG with the spec's text`: rejects with
`refused: Only PNG, JPEG, GIF, and WebP images can be added: drawing.svg is not one.`

- [x] **Step 2: Run them to check they fail**

- Run: `vp run --filter uraeda-binding build && vp test packages/binding`
- Expected: FAIL, `binding.attachImage is not a function`.

- [x] **Step 3: Implement** the three exports as `AsyncTask<Job<T>>`, like the others.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add crates/binding packages/binding
git commit -m "feat(image-attachments): image functions in the binding"
```

## Task 6: Upload and image routes

**Files:**

- Create: `packages/server/src/attach.ts`, `packages/server/src/runner/images.ts`
- Modify: `packages/server/src/app.ts`, `packages/server/src/files.ts`, `packages/server/src/dev.ts`
  (`SERVER_PATHS`), `packages/server/src/main.ts`, `packages/server/src/fate/context.ts`,
  `packages/server/src/runner/cache.ts` (`imagesInUse`), `packages/server/src/runner/events.ts` (the
  message item's optional `images`), `packages/server/src/__tests__/helpers.ts`,
  `packages/web/src/__tests__/helpers.tsx` (`serverFetch` passes a temporary data folder)
- Test: `packages/server/src/__tests__/attach.test.ts`, `files.test.ts`,
  `packages/server/src/runner/__tests__/images.test.ts`

**Interfaces:**

- Consumes: `attachImage`, `encodeImage`, `readImage` (task 5).
- Produces:
  - `Context` gains `dataDir: string`; `createApp` takes it; test helpers pass a temporary folder
    (`testDataDir()` in the server's helpers; `testServer` returns its `dataDir`).
  - `class ChatImages { readonly dir: string; constructor(dir: string); save(encoded: EncodedImage): Promise<ChatImage>; path(id: string): string | undefined; remove(id: string): Promise<void>; clean(inUse: Set<string>, now: number): Promise<void> }`
    in `runner/images.ts`, with `ChatImage = { id: string; width: number; height: number }`, `id`
    being `<uuid>.<extension>`, `dir` the images folder itself, `<dataDir>/images/`, which
    `chatImages(dataDir)` in `attach.ts` builds. `clean` keeps images written in the last 24 hours
    ([R5](rulings.md#r5-chat-image-cleanup-waits-a-day)); task 7 calls it at startup.
  - `SessionCache.imagesInUse(): Set<string>`, the image ids every repository's message items hold,
    and the message item's `images?: ChatImage[]` type, used by `DELETE` here and filled by task 7.
  - `POST /attach?name=<file name>&path=<markdown path>` or `?name=...&chat=1`, a multipart body
    with one `file` field, limited to 21 MB. Answers `200` with `AttachedView` or `ChatImage` as
    JSON, or `400` with `{ error: "refused: <text>" }`. Over the limit, it answers without reading
    the body: `refused: This image is over 20 MB: <name> is <size> MB.`, the size from
    `content-length` ([R34](rulings.md#r34-the-server-writes-the-over-limit-refusal)).
  - `GET /images/<path>`, `GET /chat-images/<id>`, `DELETE /chat-images/<id>`: `204`, `404` for an
    unknown id, `400` with `{ error: "refused: <id> is in a sent message." }` when a message holds
    it.

- [x] **Step 1: Write the failing tests**

- `US1_1: an uploaded image is saved next to the proposal` (POST with `FormData`, the JSON link).
- `refuses an upload while the feature's agent works` ("refused: An agent is working on this
  feature. Stop it first, or wait for it.").
- `refuses an upload over the body limit without reading it` (Review focus 6).
- `refuses a cross-site upload` (`Origin: https://evil.example`, 403; Review focus 7).
- `serves an image with its type, nosniff, and default-src 'none'`.
- `does not serve a markdown file or a path outside specs as an image`, including
  `..%2F..%2Fetc%2Fpasswd` (Review focus 3).
- `a chat image is saved in the data folder, never in the repository`, then served from
  `/chat-images/<id>`, then deleted by `DELETE`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/__tests__/attach.test.ts`
- Expected: FAIL, `404` for `POST /attach`.

- [x] **Step 3: Implement**

The route lives in `attach.ts` as `attach()`, mounted next to `files()`, before static files, behind
the existing guard. It calls `writable(ctx, { path })` for a path, then the binding, mapping a
rejection's message into `{ error }`. Use `bodyLimit` from `hono/body-limit`. Add `attach`,
`images`, and `chat-images` to `SERVER_PATHS`. `main.ts` and `dev.ts` pass the data folder to the
app.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web/src/__tests__/helpers.tsx specs/2026-10-13-image-attachments
git commit -m "feat(image-attachments): upload and image routes"
```

## Task 7: Images in chat messages

**Files:**

- Modify: `packages/server/src/runner/adapter.ts`, `events.ts`, `sessions.ts`, `message.ts`,
  `claude.ts`, `fake.ts`, `live.ts` (cleanup at startup, with task 6's `cache.imagesInUse()`),
  `main.ts` and `dev.ts` (the adapter's `imagesDir`), `packages/server/src/fate/mutations.ts`
  (`session.send`), `packages/web/src/views.ts` (the agent view's capabilities, listed field by
  field), `packages/server/scripts/validate-claude.ts`
- Test: `packages/server/src/runner/__tests__/sessions.test.ts`, `claude.test.ts`, `cache.test.ts`,
  `packages/server/src/__tests__/sessions.test.ts`, `live.test.ts`

**Interfaces:**

- Consumes: `ChatImages` (task 6).
- Produces:
  - `Capabilities.images: boolean`, `true` for Claude Code and the fake adapter by default.
  - `Outgoing.images: { path: string }[]`.
  - The message item gains `images?: ChatImage[]`.
  - `Sessions.send(repo, session, input: SendInput)`, with
    `SendInput = { text: string; images?: SentImage[]; workflow?: ... }` and
    `SentImage = ChatImage & { path: string }`; `session.send` takes `images?: ChatImage[]`, as
    `POST /attach` returned them, and resolves their paths
    ([R35](rulings.md#r35-sessionsend-takes-the-images-as-the-upload-returned-them)).
  - `ClaudeAdapterOptions.imagesDir: string`; `claudeArgs(options, pluginDir, imagesDir)` adds
    `--add-dir <imagesDir>`; `messageContent(text, images)` writes the `[Image: <path>]` lines.

- [x] **Step 1: Write the failing tests**

- `US2.2: the agent receives the text, then one line per image`: the fake's `sent[0]` is
  `{ text: "What is wrong here?", images: [{ path: <dir>/a.webp }, { path: <dir>/b.webp }], ... }`,
  and the Claude adapter writes
  `"What is wrong here?\n\n[Image: <dir>/a.webp]\n[Image: <dir>/b.webp]"` on its stdin JSON line
  (`claude.test.ts`); the item holds `images` with their ids and sizes. `session.send` resolves the
  ids in the data folder, and refuses one with no file: "refused: This image is gone: add it again."
- `US2.4: a message of an image alone is sent, and its chat is titled "Image"`.
- `US2.5: a taken-back message keeps its images on its item` (the UI restores them; the item's
  `images` stay readable).
- `refuses an eleventh image`: "refused: A message takes at most 10 images."
- `refuses images to an agent without them`: "refused: This agent cannot read images."
- `Claude Code passes --add-dir with the images folder` (update the exact-arguments test) and
  `declares images` (update the capabilities test).
- `cleans chat images no session uses, older than a day` (Review focus 10, in `live.test.ts`,
  through `startSessions`): an image referenced by another repository's item stays, one uploaded an
  hour ago stays.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/server/src/runner`
- Expected: FAIL, `US2.2`:
  `expected { …(3) } to match object { text: 'What is wrong here?', …(2) }`.

- [x] **Step 3: Implement**

`session.send` resolves ids to paths through `ChatImages` and refuses unknown ids; the sessions pass
the paths in `Outgoing.images`. The Claude adapter appends a blank line and one `[Image: <path>]`
line per image to the text it writes, and creates `imagesDir` before spawning. `chatTitle` of an
empty text with images is "Image". The cleanup runs in `startSessions`, with `inUse` from every item
of the cache. The validation script adds two checks: a chat message with an image, and a prompt
asking about a proposal that links an image (US6.1); each passes when a `Read` of the image's path
is seen.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/server packages/web/src/views.ts
git commit -m "feat(image-attachments): images in chat messages"
```

## Task 8: Attaching in the editor

**Files:**

- Create: `packages/web/src/attach/useAttach.ts`, `useImageDrop.ts`, `useImageText.ts`,
  `AttachButton.tsx`, `AttachStatus.tsx`, `DropHint.tsx`, `insertLink.ts`, `ServerFetch.tsx`;
  `packages/web/src/theme/icons.ts` (the paperclip)
- Modify: `packages/web/src/EditorPage.tsx`, `Question.tsx` (`GrowingTextArea` forwards its ref and
  HTML props), `routes.tsx` (`inApp`), `theme/theme.ts` and `theme/built/` (the `uraeda:attach`
  icon, through `package.json`'s `imports`,
  [R47](rulings.md#r47-the-paperclip-is-imported-as-theme-icons)),
  `packages/web/src/__tests__/helpers.tsx` (`serverFetch` passes `FormData` through and resolves the
  UI's relative paths; the `ServerFetch` provider), `packages/web/vite.browser.config.ts`
  (`repoFileSize` and `fixtureImage` commands; `writeRepo` creates folders),
  `packages/server/src/fate.ts` (exports the `ChatImage` type). `main.tsx` is unchanged: the
  context's default is the browser's `fetch`.
- Test: `packages/web/src/__browser__/attach.test.tsx`, `packages/web/src/__tests__/editor.test.tsx`

**Interfaces:**

- Produces:
  - `useAttach(target: { path: string } | { chat: true }): { attach(files: File[]): Promise<AttachResult[]>; busy: boolean; status?: AttachStatus }`,
    `AttachResult = { ok: true; value: AttachedView | ChatImage } | { ok: false; message: string }`,
    `AttachStatus = { text: string; error: boolean }`, announcing "Adding <name>…", "Added <name>",
    or the refusal, with Astryx's `useAnnounce`; `status` is the last of them, a refusal kept over
    the images added after it, which `AttachStatus({ status })` shows under the field. A file
    without a name, as a paste gives, is sent without `name`, and told "pasted image". A draft that
    moved with the first image takes the next ones at its new path.
  - `useImageDrop(field: { ref: RefObject<HTMLElement | null>; priority: number; onFiles(files: File[]): void; label: string }): { isTarget: boolean; hint?: string }`:
    registers a drop target while mounted, drawn or not; while a file is dragged over the window,
    the target is the focused field, else the registered field with the highest priority, outlined
    with `dropStyles.target`, with the hint "Drop to add to <label>" that
    `DropHint({ hint, children })` shows over the field's corner; `dragover` and `drop` of files are
    cancelled on `window` whatever the target, and a drop a field already cancelled is left to it.
  - `AttachButton({ multiple?, onFiles, isIconOnly?, isDisabled? })`: "Add image", or "Add images"
    when `multiple`, with the paperclip; icon only in the composer's bar.
  - `insertLinks(text: string, at: number, links: string[]): { text: string; selection: [number, number] }`,
    links one per line, in a paragraph of their own
    ([R43](rulings.md#r43-links-go-in-a-paragraph-of-their-own)), the first link's alt text
    selected; `followEdits(before: string, after: string, at: number): number` moves a position by
    an edit before it.
  - `useImageText({ path, text, label, priority, initialSelection?, onStart?, onText(text, added), onMoved?(moved, { text, selection }) }): { fieldProps, addFiles(files: File[]): Promise<void>, hint?, busy, status? }`:
    a text field taking images by drop, paste, and `addFiles` (the button's); `fieldProps` (its
    `ref`, `onPaste`, `onFocus`, and the outline's `xstyle`) are spread on the `TextArea` or
    `GrowingTextArea`. The links go where the cursor was when the files came, moved by what is typed
    meanwhile, or at the end of a field never focused
    ([R44](rulings.md#r44-a-drop-goes-to-the-cursor-or-the-end-of-a-field-never-focused)); a paste's
    files are sent as pasted images, without their names
    ([R45](rulings.md#r45-pasted-files-are-pasted-images)).

- [x] **Step 1: Write the failing tests**

Browser tests, files from `fixtures/images/` sent through an in-page `DataTransfer`:

- `US1.1: a screenshot dropped anywhere on the page is linked at the cursor`: the link of the spec
  inserted after "covers the login button:", its alt text selected, and `repoFileSize` of the image
  above 0.
- `US1.1: a drop on the preview opens the text, linked at its end`
  ([R46](rulings.md#r46-a-drop-on-the-editors-preview-opens-its-text)).
- `US1.2: a pasted image is linked as "pasted image"`.
- `US1.3: "Add image" picks a file` (`userEvent.upload` on the hidden input).
- `US1.8: an SVG is refused under the field`.
- `several images dropped on a single-file draft all go to its new folder`.
- `the link goes where the cursor was at the drop` (Review focus 8): text typed during the upload is
  kept before or after the link, as typed.
- `a drop outside every field stays in the app` (Review focus 9) on the feature page.
- `several images are linked one per line`.
- `SC-002: a 1440×900 screenshot is linked within a second of its drop`.

UI tests (happy-dom, `editor.test.tsx`), through the in-process server, which needs `FormData`:

- `a draft that gets an image opens at its folder's proposal` (US1.6, the spec's UI test of the
  editor's new path), picked with "Add image".
- `a file over 20 MB is refused before it is uploaded` (Review focus 12): no request reaches
  `/attach`, and the field shows "This image is over 20 MB: <name> is <size> MB."

- [x] **Step 2: Run them to check they fail**

- Run: `vp test --project uraeda-web-browser packages/web/src/__browser__/attach.test.tsx` and
  `vp test packages/web/src/__tests__/editor.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Add image"`, and links never inserted.

- [x] **Step 3: Implement**

The hidden input carries the Astryx-gap suppression, in the codebase's format; the window listeners
are native events, with no raw element to suppress. The editor remembers the cursor at the drop,
saves and flushes before attaching, holds its saves while the images upload (a draft may move
meanwhile), inserts the links with `insertLinks`, and saves. When `moved` is set, it redirects to
`/edit/<moved>`, replacing the address that no longer exists, and hands its text with the links to
the new page, which saves it at the new path. "Added <name>" names the saved file, as the mockup
shows. `useAttach` refuses a file over 20 MiB before uploading it, with the core's text, "This image
is over 20 MB: <name> is <size> MB.", the size rounded up as
[R9](rulings.md#r9-sizes-are-counted-in-mib) says: a slow upload over the limit may end in a network
error before the server's refusal arrives (Review focus 12).

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web packages/server/src/fate.ts specs/2026-10-13-image-attachments
git commit -m "feat(image-attachments): attach images in the editor"
```

## Task 9: Images drawn in documents

**Files:**

- Create: `packages/web/src/ImageView.tsx` (the image and its lightbox, Back closing it)
- Create: `packages/web/src/layout/useBackCloses.ts` (`Overlay`'s history entry, shared)
- Modify: `packages/web/src/Spans.tsx`, `Blocks.tsx` (a paragraph holding an image is a `div`),
  `Question.tsx` (an option's images are static), `layout/Overlay.tsx`, `theme/theme.ts` and
  `theme/built/` (`--size-image-max-height`)
- Test: `packages/web/src/__tests__/document.test.tsx`, `review.test.tsx`, `round.test.tsx`,
  `overlay.test.tsx`, `packages/web/src/__browser__/overlay.test.tsx`

**Interfaces:**

- Consumes: `Span.image` (task 5), `/images/<path>` (task 6).
- Produces: `ImageView({ src, alt, isStatic? })`, used by spans and by chat messages (task 10): the
  image as a link to its own address, opening the lightbox in place, and "Image missing: <alt>", or
  "Image missing" without alt text, in its place when it fails to load
  ([R48](rulings.md#r48-an-image-is-a-link-to-itself-in-a-box-of-its-own),
  [R57](rulings.md#r57-image-missing-names-its-alt-text-and-an-image-without-one-is-image));
  `StaticImages`, around content drawn inside a control, like a question's option, and an image
  inside a link, draw the image alone
  ([R55](rulings.md#r55-an-image-inside-a-control-or-a-link-is-drawn-alone)).

- [x] **Step 1: Write the failing tests**

- `US1.4: a proposal's image shows with its alt text, and opens full screen`:
  `getByRole("img", { name: "Login" })` with `src` `/images/specs/.../login.webp`; clicking it opens
  a dialog; Back closes it.
- `an image outside specs, or a URL, is a link`.
- `a missing image shows "Image missing"`, with its alt text.
- From the review: Close and Escape take the lightbox's history entry back and focus its link; a
  path with a space, `#`, and `%` is encoded; an image whose address changes after it failed shows
  again; an image without alt text is "Image"; an image inside a link is drawn in it; taps in a
  review's lightbox do not select the block
  ([R56](rulings.md#r56-the-lightbox-keeps-its-clicks-not-its-keys)); an option's image toggles the
  option; an overlay renamed while open, or opened again during its Back, keeps one entry
  ([R58](rulings.md#r58-an-overlays-history-entry-is-pushed-once-per-opening)).

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/document.test.tsx`
- Expected: FAIL, `Unable to find role="img" and name "Login"`.

- [x] **Step 3: Implement** `ImageView` with Astryx's `useLightbox`, the history entry taken out of
      `layout/Overlay.tsx` into `useBackCloses`, and StyleX `maxInlineSize: "100%"` and the theme's
      `--size-image-max-height`
      ([R59](rulings.md#r59-an-image-is-at-most-80--of-the-windows-height)).

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(image-attachments): draw images in documents"
```

## Task 10: Images in the composer and the transcript

**Files:**

- Modify: `packages/web/src/Composer.tsx` (`useChatImages`, the drawer, Send and Enter),
  `SessionPage.tsx` (the draft holds images with the text), `Transcript.tsx`, `ImageView.tsx` (the
  message's preview size), `theme/theme.ts` and `theme/built/` (`--size-message-image`),
  `sessions.ts` (`sendMessage` takes `images`, the `ChatImage`s the upload returned, passed to
  `session.send` as they are; `chatImageSrc`), `packages/web/vite.browser.config.ts` (`agentSent`
  gives the images' paths), `packages/server/src/limits.ts` and `runner/sessions.ts` (the image
  limit and refusals, shared with the UI,
  [R60](rulings.md#r60-the-workflows-message-has-no-paperclip))
- Test: `packages/web/src/__tests__/session.test.tsx`,
  `packages/web/src/__browser__/attach.test.tsx`

**Interfaces:**

- Consumes: `useAttach({ chat: true })`, `AttachButton`, `useImageDrop` (task 8), `ImageView` (task
  9), `Capabilities.images` and the message item's `images` (task 7).
- Produces: `onTakenBack?: (text: string, images: ReadonlyArray<ChatImage>) => void`;
  `DraftImage = { key, name, preview?, image?: ChatImage }` and `draftImage(image)` in
  `Composer.tsx`; `Composer`'s `images` and `onImagesChange`; `chatImageSrc(image)` in
  `sessions.ts`; `IMAGE_REFUSALS` and `MAX_IMAGES` in `uraeda-server/limits`.

- [x] **Step 1: Write the failing tests**

- `US2.1: two pasted images show as removable thumbnails` (two `Remove …` buttons, "Add images").
- `US2.2: a message with images shows them above its text`, and `fake.adapter.sent[0].images` has
  two paths.
- `US2.3: a removed thumbnail is not sent`, and the image is deleted.
- `US2.4: an image alone is sent`, the chat titled "Image".
- `an image alone is sent with Enter on a wide screen`, and
  `an image is not sent while it is being saved`
  ([R61](rulings.md#r61-send-and-enter-are-the-composers-own)).
- `US2.5: a taken-back message returns its images to the composer`
  ([R62](rulings.md#r62-the-page-keeps-the-messages-images-with-its-text)).
- `US2.6: a sent image opens full screen`.
- `US2.7: an agent without images has no attach button`, and a drop shows "This agent cannot read
  images.".
- `an image dropped anywhere on the session page joins the message`.
- `an eleventh image is refused`: "A message takes at most 10 images.".
- `a missing chat image shows "Image missing"`
  ([R63](rulings.md#r63-a-chat-image-is-a-preview-in-its-message)).
- `the workflow's message takes no images` (R60).
- Browser tests: `US2.1: two images pasted in the composer are thumbnails, sent with the message`,
  and `a file dropped anywhere on a session's page joins the message`, in WebKit.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__tests__/session.test.tsx`
- Expected: FAIL, `Unable to find role="button" and name "Add images"`.

- [x] **Step 3: Implement**

`ChatComposerInput.onFiles` takes pasted and dropped files; the page drop registers the composer as
the session page's main field. Thumbnails sit in a `ChatComposerDrawer`, dimmed while saving, the
attach button in the composer's footer beside Send, as the mockup draws it (R61). The send button
and Enter accept a message with images and no text: Astryx's `ChatSendButton` with the composer's
own `onSend` and `isDisabled`, and the Enter handling in `onKeyDown` (Astryx gap).

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web packages/server specs/2026-10-13-image-attachments
git commit -m "feat(image-attachments): images in chats"
```

## Task 11: Images in reviews, answers, and notes

**Files:**

- Modify: `packages/web/src/CommentForm.tsx`, `ReviewPage.tsx`, `MockupPage.tsx`, `Question.tsx`,
  `RoundPage.tsx`
- Test: `packages/web/src/__browser__/attach.test.tsx`

**Interfaces:**

- Consumes: task 8's hooks and button: `useImageText` for each field, with `AttachStatus` under it
  and `DropHint` around it, and `AttachButton`.
- Produces: `useImageText` returns `settled()`, resolving once no image waits or uploads;
  `CommentForm` takes `images`, a `useImageText`'s result, and `notice`; `Question` takes the
  round's `path`.

- [x] **Step 1: Write the failing tests**

- `US3.1: a drop on the review page opens a general comment holding its link`.
- `US3.2: a pasted image goes to the open line comment at its cursor`.
- `US4.1: a pasted image goes into the focused answer's comment`.
- `US4.2: a drop with no field focused goes to the end of the notes`.

- [x] **Step 2: Run them to check they fail**

- Run: `vp test packages/web/src/__browser__/attach.test.tsx`
- Expected: FAIL, `Unable to find role="form" and name "Comment"`.

- [x] **Step 3: Implement**

`CommentForm` takes paste, drop, and an "Add image" button before its submit button. The review page
registers a target that opens a general comment when none is open; the round page registers the
notes as its main field, and each answer's comment while focused. The mockup page's comment form
takes paste and the button; drops on its iframe never reach the window, which is accepted. Review
focus 11 (R64): a verdict is refused while the open comment holds images, or one uploads; an image
added to an answer saves it at once, and Submit waits for the images under way, through
`useImageText`'s `settled`.

- [x] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/web
git commit -m "feat(image-attachments): images in reviews, answers, and notes"
```

## Task 12: `:Uraeda image` in Neovim

**Files:**

- Modify: `crates/lsp/src/commands.rs`, `crates/lsp/src/server.rs` (if registration needs it)
- Create: `editors/nvim/lua/uraeda/clipboard.lua`
- Modify: `editors/nvim/lua/uraeda/actions.lua`, `command.lua` (`nargs = "*"`, file completion for
  `image`), `init.lua` (option `clipboard`), `health.lua`, `doc/uraeda.txt`
- Test: `crates/lsp/tests/commands.rs`, `editors/nvim/tests/test_actions.lua`,
  `tests/test_health.lua`

**Interfaces:**

- Consumes: `api::attach_image` (task 2).
- Produces:
  - LSP command `uraeda.attachImage`, arguments `{ uri, path, name? }`, result
    `{ opened?, written, link }`.
  - `vim.g.uraeda.clipboard`: `nil` to detect the tool, or a list command writing the clipboard's
    image to stdout.

- [ ] **Step 1: Write the failing tests**

- LSP: `an_image_is_attached_to_the_open_proposal` (the `link`, `written` holding the image);
  `a_draft_moved_into_a_folder_is_opened`.
- Neovim, with `clipboard = { "cat", "<fixture>" }` and `URA_NOW=20261014-104733`:
  - `US5.1`: `:Uraeda image` inserts `![pasted image](images/pasted-20261014-104733.webp)` at the
    cursor, and one `u` removes it.
  - `US5.2`: `:Uraeda image <fixture path>` saves `images/desktop.webp`.
  - `US5.3`: in `specs/drafts/login-banner.md`, the buffer reopens at
    `specs/drafts/login-banner/proposal.md`, the link on the same line.
  - `US5.4`: with `clipboard = { "echo", "text" }`, "uraeda: the clipboard holds no image".
  - `a missing clipboard tool is named`, and `:checkhealth uraeda` names the tool found.

- [ ] **Step 2: Run them to check they fail**

- Run: `cargo test -p uraeda-lsp --test commands && vp run test:nvim`
- Expected: FAIL, `unknown command uraeda.attachImage`.

- [ ] **Step 3: Implement**

The command reads the file at `path`, calls `api::attach_image` with the buffer's file, deletes
nothing, and returns the link. `clipboard.lua` picks `wl-paste --type <type>` on Wayland,
`xclip -selection clipboard -t <type> -o` on X11, `pngpaste -` on macOS, or PowerShell on Windows,
after listing the clipboard's types and taking the first of PNG, JPEG, GIF, and WebP; it writes the
bytes to `vim.fn.tempname()`. The action sets a mark at the cursor, saves, runs the command, and
inserts the link at the mark in the buffer `opened` or the current one, as one undo step.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/lsp editors/nvim
git commit -m "feat(image-attachments): paste images from Neovim"
```

## Task 13: Layout checks and screenshots

**Files:**

- Modify: `packages/web/src/__browser__/layout.test.tsx` (`PAGES`),
  `packages/web/scripts/screenshots.ts`
- Create: `specs/2026-10-13-image-attachments/screenshots/`

- [ ] **Step 1: Add the pages** to `PAGES`: the composer with two thumbnails, the editor with an
      image in its preview, a proposal page with an image, and a review comment holding a link.

- [ ] **Step 2: Run them**

- Run: `vp test packages/web/vite.browser.config.ts`
- Expected: PASS at both sizes, in both themes (SC-005); fix what fails.

- [ ] **Step 3: Take and review the screenshots**

- Run:
  `vp run --filter uraeda-web screenshots 2026-10-13-image-attachments composer editor proposal review`
- Expected: the files in `screenshots/`; compare them with the [mockup](mockups/attachments.html),
  and fix what differs.

- [ ] **Step 4: Run all tests**

- Run: `vp run ready`
- Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web specs/2026-10-13-image-attachments/screenshots
git commit -m "test(image-attachments): layout checks and screenshots"
```
