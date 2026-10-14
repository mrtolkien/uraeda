# Rulings: Image attachments

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Screenshots stay near-lossless 60

- **Decision**: screenshots and other non-photo inputs are encoded as near-lossless WebP, level 60,
  quality 75, method 4, as the [attachments](../decisions/attachments.md) decision says.
- **Rationale**: the spec review's C2 allowed lossy settings if they halved the size without losing
  text. Measured with libwebp 1.6.0 (through sharp 0.35.5, which gives the same bytes) on the same
  corpus: 94 app screenshots (7678 KiB as PNG) and 3 web pages at 1x and 2x (1254 KiB).

  | Encoding              | 94 screenshots | 3 web pages | PSNR, 94 / 3 |
  | --------------------- | -------------- | ----------- | ------------ |
  | Lossless              | 27.7 %         | 34.5 %      | exact        |
  | Near-lossless 60      | 25.4 %         | 32.3 %      | 64.4 / 58.5  |
  | Near-lossless 40      | 23.6 %         | 30.5 %      | 60.2 / 52.5  |
  | Near-lossless 20      | 22.3 %         | 29.0 %      | 55.2 / 46.4  |
  | 256-colour palette    | 25.1 %         | 27.5 %      | 74.1 / 63.4  |
  | Lossy q95, sharp YUV  | 49.3 %         | 62.4 %      | 49.7 / 46.1  |
  | Lossy q80 (discovery) | 33 %           | 39 %        | blurred text |

  The most lossy setting saves 12 %, far from half; lossy WebP doubles the size.

- **Alternatives considered**: near-lossless 20 (12 % smaller, visible on gradients); a 256-colour
  palette (needs a quantizer crate, and saves 1 to 15 %); lossy WebP (larger, blurs coloured text).
- **If wrong**: one constant in `crates/core/src/images.rs`; images already committed stay as they
  are.
- **Where**: task 1.

## R2: The screenshot corpus stays in git history

- **Decision**: the 94 screenshots of SC-001 are not copied into `fixtures/`. Their test reads them
  from this repository's history with `git show`, and is `#[ignore]`d, run by hand with
  `cargo test -p uraeda-core --test images -- --ignored`. The regular suite uses a handful of small
  fixtures, under 600 KiB.
- **Rationale**: copying them would add 7.5 MB to every clone, forever, for one measurement; they
  are already in history, from the finished features' `screenshots/` folders.
- **Alternatives considered**: committing them as fixtures, as the spec's Testing table reads;
  committing a sample of 10 and scaling the threshold.
- **If wrong**: a shallow clone cannot run the measurement; copying the files into `fixtures/` later
  fixes it.
- **Where**: task 1.

## R3: Pasted names take the local time from `date`

- **Decision**: `today::stamp()` returns `YYYYMMDD-HHmmss` in local time from `URA_NOW` when set,
  else from `date +%Y%m%d-%H%M%S`, as `today()` reads `URA_TODAY`, then `date +%F`.
- **Rationale**: the core has no time zone database, and `today()` already relies on `date` for the
  local day.
- **Alternatives considered**: the `jiff` or `chrono` crate (a time zone database in the binary);
  passing the time from every caller (the binding, `ura lsp`).
- **If wrong**: on a machine without `date`, names fall back to UTC, as days already do.
- **Where**: task 2.

## R4: Uploads name their target in the query string

- **Decision**: `POST /attach?name=<file name>&path=<markdown path>` (or `&chat=1`), with the file
  as the multipart body's `file` field. Answers are JSON: `200` with the result, `400` with
  `{ error: "<code>: <message>" }`, the message parsed by the UI's existing `refusal()`.
- **Rationale**: the body limit answers before reading the body, so the over-20 MB text can name the
  file only from the query string; the error format matches what fate's mutations already give.
- **Alternatives considered**: everything in the multipart body (no name in the over-limit text);
  plain text errors, as `/raw` answers (the UI would parse two formats).
- **If wrong**: a route change in `attach.ts` and `useAttach`.
- **Where**: tasks 6 and 8.

## R5: Chat image cleanup waits a day

- **Decision**: at startup, chat images no message of any repository references, and older than 24
  hours, are deleted. Image ids are `<uuid>.<extension>`.
- **Rationale**: every repository's server shares the data folder and its cache; an image uploaded
  by another live server, not yet sent, must survive this server's start.
- **Alternatives considered**: checking every server's pid, as `interrupted` does, which needs a
  record of who uploaded each image.
- **If wrong**: images removed from a composer while their server crashed stay a day longer.
- **Where**: task 7.

## R6: The paperclip is an icon registered with Astryx

- **Decision**: a `uraeda:attach` paperclip SVG, registered in the theme's icons, for the attach
  buttons.
- **Rationale**: Astryx has no paperclip; one SVG costs less than a dependency.
- **Alternatives considered**: `lucide-react` (a new dependency for one icon); Astryx's `upload`
  icon (not what the mockup shows).
- **If wrong**: one icon to replace.
- **Where**: task 8.

## R7: Uploads use a fetch the tests can replace

- **Decision**: a `ServerFetch` React context gives `useAttach` its `fetch`: the browser's in the
  app, the in-process server's in happy-dom tests, as the fate client already gets it.
- **Rationale**: `/attach` is the app's first plain request, and happy-dom tests run the server in
  process.
- **Alternatives considered**: stubbing the global `fetch` in each test.
- **If wrong**: one provider to remove.
- **Where**: task 8.

## R8: A draft's priorities links keep their text when it becomes a folder

- **Decision**: every link destination of `PRIORITIES.md` that resolves to the draft has its path
  changed from `<prefix><slug>.md` to `<prefix><slug>/proposal.md`: inline links, with or without
  `<…>`, a title, or an anchor, in any entry, sub-item, or position, and the destinations of
  reference definitions (`[r]: drafts/<slug>.md`). Each destination is found with pulldown-cmark's
  offsets, and only its path changes: its `<…>`, anchor, title, and the rest of the text stay as
  written.
- **Rationale**: `priorities::link` rewrites the whole entry from its plain text, which would drop
  the human's inline markdown. Replacing `](drafts/<slug>.md)` in the entry's first link missed
  `<…>`, titles, sub-items, later links, and reference links.
- **Alternatives considered**: reusing `priorities::link`; a text replacement in the entry linking
  the draft (the first version, found incomplete in review).
- **If wrong**: one function, `priorities::retarget`. A destination written with escapes, like
  `login\-banner.md`, is left as written.
- **Where**: task 2, review.

## R9: Sizes are counted in MiB

- **Decision**: "20 MB" is 20 × 1,048,576 bytes, and sizes in messages are bytes / 1,048,576,
  rounded up to one decimal, without a trailing `.0`: a file one byte over the limit is "20.1 MB".
- **Rationale**: the same unit for the limit and the message, and rounding up, so a refused file is
  never said to be "20 MB", and a file said to be "20 MB" is never refused as over 20 MB.
- **If wrong**: one constant.
- **Where**: task 1.

## R10: A WebP input is a photo when it holds lossy data

- **Decision**: a WebP input holding a `VP8 ` chunk is re-encoded lossy; one holding only `VP8L` is
  near-lossless.
- **Rationale**: the decision splits "lossy WebP" from the rest; the chunk names it without
  decoding.
- **If wrong**: one test row and one condition.
- **Where**: task 1.

## R11: The type is checked before the size

- **Decision**: `images::encode` refuses an unknown type before an input over 20 MB, so a 30 MB SVG
  gets the type's refusal.
- **Rationale**: the spec's [error handling](spec.md#error-handling) lists its refusals "in order of
  the checks", the type first; the plan's step 3 checked the size first. Detecting the type reads 12
  bytes, so the order costs nothing.
- **Alternatives considered**: the size first, as the plan read.
- **If wrong**: two checks to swap in `crates/core/src/images.rs`.
- **Where**: task 1.

## R12: The libwebp wrapper returns libwebp's error

- **Decision**: `webp::encode_rgba` returns `Result<Vec<u8>, WebPEncodingError>`, and `encode` turns
  a failure into "This image could not be read: <name>."
- **Rationale**: the wrapper does not know the file's name, which every refusal holds; the plan gave
  it `ImageError`. libwebp fails only on memory or dimensions, both bounded before it runs.
- **Alternatives considered**: passing the name to the wrapper; a new refusal text the spec does not
  list.
- **If wrong**: one `map_err` in `crates/core/src/images.rs`.
- **Where**: task 1.

## R13: The photo fixture becomes 1717×2576

- **Decision**: the test expects `photo.jpg`, 3000×2000 with orientation 6, to come out 1717×2576.
- **Rationale**: turned upright it is 2000×3000; scaled to 2576 on its long edge, its short edge is
  2000 × 2576 / 3000 = 1717.3, rounded to 1717. The plan's 1728 could not hold.
- **If wrong**: one test row.
- **Where**: task 1.

## R14: A draft's image is read from the default branch's checkout

- **Decision**: `api::read_image` reads a path under `specs/drafts/` or `specs/backlog/` from the
  working tree that has the default branch, else from its tip, as `read_draft` reads the draft;
  every other path is read as `read_raw` reads it.
- **Rationale**: `read_raw` serves a file outside every feature only when it is tracked, so an image
  just attached to a draft, not yet committed, would not show in the editor's preview (US1.4).
- **Alternatives considered**: reading drafts' files this way in `read_raw` too (changes what `/raw`
  serves, outside this task).
- **If wrong**: one branch in `read_image`.
- **Where**: task 2.

## R15: Decoders may allocate 16 MiB besides the pixels

- **Decision**: reading an image's header may allocate at most 16 MiB, and decoding it its pixels at
  16 bits per channel with alpha (8 bytes per pixel) plus the same 16 MiB. A PNG whose colour
  profile inflates past the limit is read without it, as every profile is dropped anyway
  (`iccp_bomb.png`).
- **Rationale**: the header pass had no limit, and a PNG's `iCCP` chunk is inflated while reading
  the header: 1 MiB of compressed zeros inflated to 1 GiB. A limit sized from the checked dimensions
  also bounds the decode pass of a small image, which the fixed 320 MB limit did not. An ICC profile
  is rarely over 1 MiB.
- **Alternatives considered**: one fixed limit of 320 MB for both passes (lets a 64 KiB PNG allocate
  320 MB); refusing an image whose profile is too large (the profile is dropped anyway, and `png`
  reports the failure to no one).
- **If wrong**: one constant, `HEADER_ALLOC`, in `crates/core/src/images.rs`.
- **Where**: task 1, review.

## R16: Animated GIFs are rewritten, not kept byte for byte

- **Decision**: an animated GIF is rewritten by the `gif` crate: its logical screen, global palette,
  loop count, and frames, each with its delay, disposal, transparency, interlacing, and local
  palette, are copied; its frames' pixels are copied still compressed, never decoded nor
  re-quantized. Comments, XMP, every other application extension, the background colour index, and
  the pixel aspect ratio are dropped. A frame reaching past the logical screen makes the GIF
  unreadable. `gif` 0.14, already built for `image`, becomes a direct dependency of the core.
- **Rationale**: the spec's encoding table reads "Unchanged", but SC-004 says no attached image
  holds EXIF, XMP, or GPS data, whatever its input held, and a GIF carries XMP and free text in its
  extensions: SC-004 wins. Copying the compressed frames keeps the animation exactly as it was, as
  "unchanged" meant. Frames inside the screen bound the copy by the checked pixel count.
- **Alternatives considered**: keeping the bytes (fails SC-004); decoding and re-encoding every
  frame (re-quantizes colours, slow); re-encoding as animated WebP (libwebp's animation encoder is a
  second wrapper, as the spec's assumptions say).
- **If wrong**: `crates/core/src/images/animated.rs`; a GIF with frames past its screen could be
  cropped instead of refused.
- **Where**: task 1, review.

## R17: Animated WebP and APNG keep their first frame

- **Decision**: an animated WebP or an APNG is re-encoded as a still WebP of its first frame, at the
  size of its canvas. Whether a WebP is a photo is read from its top-level chunks, so a lossy
  animated WebP, whose `VP8 ` chunks sit inside `ANMF` frames, is encoded near-lossless.
- **Rationale**: the decision keeps only animated GIFs; `image` decodes the first frame of both
  formats. Animated WebP and APNG attachments are rare, and a still frame shows what they hold.
- **Alternatives considered**: refusing them (a human who drops one gets nothing); reading `ANMF`
  frames to classify lossy animations (more parsing for a rare input).
- **If wrong**: a test, `animated_webp_and_apng_keep_their_first_frame`, and one condition in
  `lossy_webp`.
- **Where**: task 1, review.

## R18: Colour profiles are dropped, not converted

- **Decision**: an input's ICC colour profile, Display P3 for example, is dropped with the rest of
  its metadata, and its pixel values are kept: viewers read them as sRGB.
- **Rationale**: `image` 0.25.10 converts only between CICP colour spaces, not from an arbitrary ICC
  profile, so a conversion is not a few lines: it needs `moxcms`, which `image` builds already,
  called directly to parse the profile and transform the pixels, and a parser of untrusted profiles.
  Screenshots, the main input, are sRGB on most screens; on a wide-gamut Mac, colours turn a little
  duller.
- **Alternatives considered**: converting to sRGB with `moxcms` after downscaling (about 15 lines
  and a direct dependency); keeping the profile in the WebP (metadata the decision forbids).
- **If wrong**: the conversion goes after the downscale in `images::encode`; images already
  committed keep their colours.
- **Where**: task 1, review.

## R19: The image tests measure memory in a child process

- **Decision**: `an_iccp_bomb_is_read_in_bounded_memory` runs itself again as a child process, on
  Linux, and reads the child's peak resident memory from `/proc/self/status`: under 40 MiB, where
  inflating the profile whole takes over 64 MiB. The new small inputs are generated by the tests,
  and only those `image` cannot write are fixtures.
- **Rationale**: tests run in parallel threads of one process, so its own peak mixes every test's; a
  counting allocator would need `unsafe` outside the libwebp wrapper.
- **Alternatives considered**: a global counting allocator in the test binary; a fixture inflating
  to 1 GiB, about 1 MiB on disk, since deflate shrinks zeros at most about 1000 times.
- **If wrong**: the test is skipped on other systems; its threshold is one number.
- **Where**: task 1, review.

## R20: A draft becomes a folder in an order that can be undone

- **Decision**: attaching to a single-file draft claims the new folder with `create_dir`, the next
  free number on `AlreadyExists`, saves the image in its `images/`, moves the draft into it, then
  edits `PRIORITIES.md`. A failure after the claim moves the draft back, writes the priorities' text
  back, and removes the folder, which happens only once the draft is back in its place. Every disk
  error of these steps is "The image could not be saved: <the system's error>."
- **Rationale**: the image is the step most likely to fail, so it goes first, while undoing it costs
  one folder; `create_dir` claims a name even when another process claims one at the same time,
  where checking `exists` first did not.
- **Alternatives considered**: moving the draft first, as the first version did (a failed image left
  a moved draft and edited priorities); a lock file.
- **If wrong**: `into_folder` in `crates/core/src/actions/attach.rs`.
- **Where**: task 2, review.

## R21: Images are never written or read through a symbolic link

- **Decision**: `attach_image` refuses when the folder's `images/` resolves elsewhere than
  `<root>/<folder>/images`, with "The image could not be saved: <folder>/images goes through a
  symbolic link."; an image name taken by a link gets the next number, since `create_new` never
  follows one. `read_image` serves a file only when no link leads to it from the working tree's
  root. `read_raw` reads as before.
- **Rationale**: a link committed by anyone could make the app write or serve a file outside the
  repository. Comparing canonical paths covers a linked `images/`, a linked file, and a linked
  parent in one check.
- **Alternatives considered**: refusing only a linked `images/` (misses a linked image or parent);
  the same check in `read_raw` (changes what `/raw` serves for linked files like `CLAUDE.md`,
  outside this feature).
- **If wrong**: `save` in `crates/core/src/actions/attach.rs`, and `read_unlinked` in
  `crates/core/src/api.rs`.
- **Where**: task 2, review.

## R22: A file name loses its last extension, whatever it is

- **Decision**: an image's name and alt text come from its original file name without its last
  `.<extension>`, whatever the extension: `login.png` is `login`, `v1.2` is `v1`, and `.png` is
  empty, so it is named `image.webp` with the alt text `image`, never `pasted-…`. Every run of
  spaces and line breaks in the alt text becomes one space.
- **Rationale**: the spec's "the original file name without its extension", read literally; a
  dropped or picked file nearly always has an image extension, so a list of accepted extensions adds
  a rule for a rare case. A name is given, so the image is not pasted. A line break in the alt text
  ends the link's paragraph.
- **Alternatives considered**: stripping only `.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp` (keeps
  `v1-2`, but one more list to keep in sync with the accepted types).
- **If wrong**: `stem` and `alt` in `crates/core/src/actions/attach.rs`, and their test rows.
- **Where**: task 2, review.

## R23: Attaching needs an existing file, and a plain path

- **Decision**: `attach_image` refuses a markdown file that does not exist, with "<path>: no such
  file", as `read_raw` words it ("no draft <path>" for a single-file draft, as before). A plain
  path's parts never hold `\` or `:`, which Windows reads as separators, so `read_image`, the
  drafts' actions, and `attach_image` refuse them.
- **Rationale**: an image saved next to a file that does not exist is linked from nothing, and the
  next commit deletes it.
- **If wrong**: the existence check in `attach`, and `plain` in `crates/core/src/api.rs`.
- **Where**: task 2, review.

## R24: A missing image is named as its link writes it

- **Decision**: `ura check` reports a missing image as "no file images/gone.webp", the target as the
  link writes it, not the path from the repository's top level the plan named.
- **Rationale**: every `links.file` problem names the target as written, "no file missing.md", and
  the problem already carries the linking file and its line; one wording for links and images keeps
  one rule.
- **Alternatives considered**: the path from the top level for images only (two wordings for one
  rule).
- **If wrong**: the `links.file` message in `crates/core/src/check/links.rs`, and
  `a_missing_image_into_specs_is_a_problem`.
- **Where**: task 3.

## R25: A retried commit skips a folder already deleted

- **Decision**: `Git::commit` leaves out of `git add` a path that no longer exists, has files staged
  at or under it, and has none left in the index: an `images/` folder whose deletion a hook-refused
  commit already staged. A path with nothing staged under it is passed to `git add` as before.
- **Rationale**: `retry_commit` passes `<folder>/images` while `HEAD` tracks files under it, as
  Review focus 1 says; once the refused commit staged their deletion, `git add` fails on the
  pathspec, which matches nothing. The previous rule covered files only, comparing the path itself
  with the staged ones.
- **Alternatives considered**: leaving the folder out of `retry_commit`'s paths when its files'
  deletions are staged (the same rule, in one caller only); `git add --ignore-missing` (only with
  `--dry-run`).
- **If wrong**: the `addable` loop and `in_index` in `crates/core/src/git.rs`, and
  `try_again_commits_a_deleted_image`.
- **Where**: task 4.

## R26: A target with a URI scheme is not a repository path

- **Decision**: `workspace::resolve` returns no path for a target starting with a URI scheme,
  `[A-Za-z][A-Za-z0-9+.-]*:` (`https:`, `data:`, `file:`, `mailto:`), or with `//`, a
  protocol-relative URL. Such links and images are not checked, not kept by a commit's image pass,
  and have no `path` in the document tree.
- **Rationale**: `data:image/png;base64,…` was read as a file next to the linking one, and
  `ura check` reported it missing. The repository has no Windows target, so `C:` is never a drive; a
  relative path whose first part holds a `:` before any `/` is the only case lost, and the
  attachment code never writes one.
- **Alternatives considered**: listing the schemes (`https`, `data`, `mailto`, …): one more list to
  keep, and any other scheme is still read as a path.
- **If wrong**: `has_scheme` in `crates/core/src/workspace.rs`, and
  `a_uri_scheme_is_not_a_repository_path`.
- **Where**: task 3, review.

## R27: A percent-encoded target is decoded

- **Decision**: `workspace::resolve` decodes the `%XX` sequences of a target's path, after its
  `#anchor` is split off, as UTF-8: `images/my%20shot.webp` is `images/my shot.webp`. A `%` not
  followed by two hexadecimal digits stays as it is, and the whole path stays as written when the
  decoded bytes are not UTF-8. Problems still name the target as written (R24).
- **Rationale**: Obsidian and GitHub write a space in a link as `%20`, and both read it decoded;
  undecoded, `ura check` reported the image missing and a commit deleted it as unlinked. Every
  caller of `resolve` gets the same rule, so links, images, and `PRIORITIES.md` entries agree.
- **Alternatives considered**: the `percent-encoding` crate (already built, as a transitive
  dependency, but a direct one for ten lines); decoding invalid UTF-8 lossily (a path that exists
  under no name).
- **If wrong**: `percent_decode` in `crates/core/src/workspace.rs`, and
  `a_percent_encoded_target_is_decoded`.
- **Where**: task 3, review.

## R28: A nested image is text of the outer image

- **Decision**: in the document tree, an image inside another image's alt text,
  `![a ![b](b.png) c](o.png)`, adds its alt text to the outer image's span, `a b c`, as CommonMark's
  alt text reads it; an Obsidian embed inside alt text does the same. The link list `ura check` and
  the commit's image pass read holds only the outer image. An image's alt text never makes its list
  item a typed bullet or a list callout: `- ![! warn](w.png)` is a plain item.
- **Rationale**: the inner image is never shown, since an alt text is plain text, so it neither
  needs to exist nor keeps its file.
- **Alternatives considered**: a span per inner image (cut the outer alt text short, and showed an
  image no other renderer shows).
- **If wrong**: `Marks::image` and the `Tag::Image` arms in `crates/core/src/files/document.rs`,
  `image_depth` in `crates/core/src/files/markdown.rs`, and their tests.
- **Where**: task 3, review.

## R29: A file staged under `images/` keeps the folder in the commit

- **Decision**: `linked_images` returns `<folder>/images` also when the index holds files under it,
  besides when the folder exists or `HEAD` tracks files under it. A new image a hook-refused commit
  staged, then unlinked and deleted, is unstaged by the next commit's `git add --all` instead of
  refusing it as another staged file; R25's rule still skips a folder whose files the index no
  longer holds. `retry_commit` checks the staged files against the file, its review, and
  `<folder>/images` before deleting any image, as the first try does.
- **Rationale**: the refused commit ran `git add --all`, so the image stayed in the index; once its
  link was removed, the commit deleted the file and left the folder out, and every later commit,
  `retry_commit` included, refused "other files are staged: …/images/login.webp".
- **Alternatives considered**: unstaging `images/` with `git reset` after a refused commit (a second
  write after a failure, which can fail too).
- **If wrong**: `linked_images` in `crates/core/src/actions/images.rs`, `Git::in_index`, and
  `an_image_staged_by_a_refused_commit_then_unlinked_is_dropped`,
  `try_again_drops_an_image_staged_then_unlinked`.
- **Where**: task 4, review.

## R30: A moved draft is found by its priorities line or its title

- **Decision**: a commit of `specs/<drafts|backlog>/<dir>/proposal.md` holds the deletion of
  `<dir>.md`, or of `<base>.md` when `<dir>` is `<base>-<N>` with `N` at least 2, the folder
  `attach` numbers when `<base>/` is taken, when that file is tracked at `HEAD`, gone from disk, and
  its move shows: either the `PRIORITIES.md` line linking it at `HEAD`, retargeted to the proposal
  as `attach` does, is a line of `PRIORITIES.md` now, or its level-1 heading at `HEAD` is the
  proposal's now. The subject is then "chore: edit the draft <title>".
- **Rationale**: the name alone mapped `<slug>-2/` back to `<slug>-2.md`, which never existed, and
  took an unrelated `foo/proposal.md` for the move of a `foo.md` deleted on purpose. The line covers
  a draft whose title changed since; the title covers a backlog file, which `PRIORITIES.md` does not
  link. A draft deleted on purpose, next to an unrelated folder draft, shows neither.
- **Alternatives considered**: comparing the old and new texts as git's rename detection does (more
  code, and a threshold to choose); the `PRIORITIES.md` line only (misses backlog files).
- **If wrong**: `single_files` and `moved_from` in `crates/core/src/actions/text.rs`, and
  `a_committed_draft_moved_into_a_numbered_folder_commits_the_move`,
  `an_unrelated_folder_draft_does_not_take_a_deleted_draft`.
- **Where**: task 4, review.

## R31: Markdown links of any kind keep an image; HTML does not

- **Decision**: an image under `<folder>/images/` is kept when a markdown file of `<folder>` or of
  any of its subfolders (`contracts/api.md`) links it: a markdown image or link, resolved from the
  linking file's folder; or a wikilink or an Obsidian embed, `![[images/x.webp]]`,
  `![[x.webp|300]]`, `[[images/x.webp]]`, whose target, without its `#` and `|` parts, is the
  image's path or the end of it after a `/`, as Obsidian matches the shortest path. HTML is not
  parsed: an image only a mockup's `<img src>`, or an inline `<img>` in markdown, uses is deleted.
  Paths compare as written, so on a case-insensitive file system `images/Shot.webp` does not keep
  `shot.webp`.
- **Rationale**: the skill prescribes `![alt](images/name.webp)`, which every tool writes; a
  wikilink or embed is what a human writes in Obsidian, and keeping its image costs one rule.
  Matching by the end of the path keeps every candidate Obsidian could pick, never fewer. Parsing
  HTML for `src` adds a parser for a form nothing writes; folding case would keep a file another
  checkout, on a case-sensitive system, does not find.
- **Alternatives considered**: resolving wikilinks to one file as Obsidian does (its vault-wide
  shortest path needs the whole vault); reading `<img src>` with a pattern.
- **If wrong**: `Linked` and `markdown_files` in `crates/core/src/actions/images.rs`, `embeds` in
  `crates/core/src/files/markdown.rs`, and `every_kind_of_link_keeps_its_image`.
- **Where**: task 4, review.

## R32: A query is not part of a link's path

- **Decision**: `workspace::resolve` leaves out a target's `?query`, after its `#anchor`:
  `images/shot.webp?v=2` is `images/shot.webp`, and a target that is only a query has no path. A
  `%3F` stays part of the path, since decoding comes after.
- **Rationale**: a URL's query is never part of the file name; read as one, `ura check` reported the
  image missing and a commit deleted it. Every caller of `resolve` gets the same rule, as for R27.
- **If wrong**: `resolve` in `crates/core/src/workspace.rs`, and `a_query_is_not_part_of_the_path`.
- **Where**: task 4, review.

## R33: Folders under `images/` follow the same rule, and git says what changed

- **Decision**: `linked_images` walks the folders under `images/` too, deleting their unlinked files
  and the folders left empty, never following a symbolic link: an unlinked link is deleted as a
  file. `images_changed` asks `git status` about `<folder>/images`, untracked files included, so it
  compares as `git add --all` stages: ignored files left out, symbolic links compared as links, and
  nested files counted. A new file staged then deleted from disk, `AD`, is no change.
- **Rationale**: the commit's pathspec already held nested files, while the deletion and the change
  check looked at the top level only. Comparing file contents by hand followed symbolic links and
  counted ignored files, so a commit with nothing for git to add failed with "nothing to commit",
  reported as a hook's refusal.
- **Alternatives considered**: keeping nested folders as they are (their files committed, but never
  deleted); gix's status (two comparisons, `HEAD` to the index and the index to the files, to
  combine by hand).
- **If wrong**: `prune` and `images_changed` in `crates/core/src/actions/images.rs`,
  `Git::differs_from_head`, and `nested_images_are_kept_while_linked`,
  `files_git_would_not_add_are_no_change`.
- **Where**: task 4, review.

## R34: The server writes the over-limit refusal

- **Decision**: `POST /attach` refuses a body over 21 MiB with the core's text, "This image is over
  20 MB: <name> is <size> MB.", written in `attach.ts`: `<size>` is the body's `content-length` in
  MiB, rounded up to one decimal as the core rounds ([R9](#r9-sizes-are-counted-in-mib)), and
  `<name>` the query's `name`, or "pasted image" as the core names an image without one. A body sent
  without a `content-length`, which browsers do not do, is said to be 21 MB.
- **Rationale**: the body limit answers before reading the body, so the core never sees it; the UI
  shows one text for every image over 20 MB. The size counts the multipart around the file, a few
  hundred bytes. The size check therefore comes before the core's type check, unlike the spec's
  order of the checks: a 30 MB SVG gets "over 20 MB", not "Only PNG, JPEG, GIF, and WebP". Accepted:
  either refusal is true, and checking the type first would mean reading the body.
- **Alternatives considered**: reading the body to pass it to the core (an unbounded upload held in
  memory); a separate text for the route (two texts for one refusal).
- **If wrong**: `megabytes` and the `bodyLimit` handler in `packages/server/src/attach.ts`, kept in
  step with `megabytes` in `crates/core/src/images.rs`.
- **Where**: task 6.

## R35: `session.send` takes the images as the upload returned them

- **Decision**: `session.send` takes `images?: ChatImage[]`, the `{ id, width, height }` that
  `POST /attach` returned, not bare IDs. The mutation resolves each ID to its file through
  `ChatImages`, and refuses one with no file with "This image is gone: add it again."; it passes
  `SentImage`s, `ChatImage & { path }`, to `Sessions.send`, which checks the count and the
  capability, keeps the IDs and sizes on the item, and gives the paths to the adapter. A message of
  images alone is sent with an empty text.
- **Rationale**: the item holds each image's size, which the server cannot learn from an ID: the
  data folder keeps no sizes, and only the core reads an image's header, so a TypeScript header
  reader would reimplement it. The sizes come from the core through the upload; a wrong size only
  misdraws the sender's own transcript. The session manager has no data folder: the request's
  context does.
- **Alternatives considered**: IDs alone, with the sizes read back from the WebP header in
  TypeScript (the core's parsing, reimplemented), re-encoded through `encodeImage` at each send (up
  to a second per image), or kept in a side file or table per image (one more thing to clean).
- **If wrong**: `sentImages` in `packages/server/src/fate/mutations.ts`, `SendInput` and `SentImage`
  in `packages/server/src/runner/sessions.ts`, and task 10's `sendMessage`.
- **Where**: task 7.

## R36: A write without an `Origin` is refused when the browser says another site sent it

- **Decision**: the guard refuses a request other than `GET` or `HEAD` that has no `Origin` header
  and a `Sec-Fetch-Site` other than `same-origin` or `none`, with 403 "Forbidden site". A request
  with neither header passes, as tests, `curl`, and scripts send them; one whose `Origin` is allowed
  passes whatever its `Sec-Fetch-Site`, since an allowed origin on another port, like
  `http://localhost:5173`, is `same-site`.
- **Rationale**: browsers send an `Origin` with every cross-site write today, but the guard let
  through any request without one, and `POST /attach` and `DELETE /chat-images` write to disk. Every
  browser that omits the `Origin` still sends `Sec-Fetch-Site`.
- **Alternatives considered**: refusing every write without an `Origin` (breaks tests and `curl`);
  checking `Sec-Fetch-Site` even with an allowed `Origin` (refuses the allowed origins).
- **If wrong**: `guard` in `packages/server/src/guard.ts`, and its rows in `guard.test.ts`.
- **Where**: task 6, review.

## R37: A chat image's type is the extension the core gave it

- **Decision**: `GET /chat-images/<id>` answers with the type of the ID's extension, `image/webp` or
  `image/gif`, without reading the file's first bytes.
- **Rationale**: the server only serves files it wrote itself, from the core's `encodeImage`, under
  an ID holding the extension the core chose; the ID pattern admits no other. The type is the core's
  detection, recorded in the name. Checking the bytes again in TypeScript would reimplement the
  core's detection, which the stack decision forbids, and a binding call for it would only guard
  against someone with write access to the data folder, who can already change the cache.
- **Alternatives considered**: an `imageType(bytes)` binding call (a new core entry point for a file
  the server wrote); a signature check in TypeScript (the core's parsing, duplicated).
- **If wrong**: `chatImageType` in `packages/server/src/runner/images.ts`; a binding call can
  replace it.
- **Where**: task 6, review.

## R38: Chat images are their owner's, cached for good, and never embedded elsewhere

- **Decision**: the images folder is created with mode `0700` and its files `0600`. Both image
  routes answer with `Cross-Origin-Resource-Policy: same-origin`. `/chat-images/<id>` adds
  `Cache-Control: private, max-age=31536000, immutable`; `/images/<path>` has no `Cache-Control`.
- **Rationale**: chat images hold what the human pasted, often screenshots of private work, in a
  folder other users of the machine could read under the default umask. Another site cannot read the
  bytes, but it could embed them in its page; `same-origin` stops that. A chat image's ID is never
  given to another image, so its bytes never change; a repository image's path gets a new image when
  one is attached again under the same name, and must be read again.
- **Alternatives considered**: an `ETag` on repository images (a hash of every image served).
- **If wrong**: `ChatImages.save` in `packages/server/src/runner/images.ts`, and `imageHeaders` and
  the `/chat-images` route in `packages/server/src/files.ts`.
- **Where**: task 6, review.
