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
  images alone is sent with an empty text. A size is refused unless it is one the core could have
  given: positive integers, at most 2576 pixels on each edge for a WebP, and for a GIF, which the
  core keeps as it came when animated, at most 65535 on each edge and 40 million pixels in all.
- **Rationale**: the item holds each image's size, which the server cannot learn from an ID: the
  data folder keeps no sizes, and only the core reads an image's header, so a TypeScript header
  reader would reimplement it. The sizes come from the core through the upload; a wrong size only
  misdraws the sender's own transcript, but an unbounded one could make the transcript lay out a
  huge box, and the bounds are the core's own. A flat 2576 cap would refuse a wide animated GIF the
  core accepted. The session manager has no data folder: the request's context does.
- **Alternatives considered**: IDs alone, with the sizes read back from the WebP header in
  TypeScript (the core's parsing, reimplemented), re-encoded through `encodeImage` at each send (up
  to a second per image), or kept in a side file or table per image (one more thing to clean).
- **If wrong**: `sentImages` in `packages/server/src/fate/mutations.ts`, `chatImageSize` in
  `packages/server/src/runner/images.ts`, `SendInput` and `SentImage` in
  `packages/server/src/runner/sessions.ts`, and task 10's `sendMessage`. The bounds copy the core's
  `MAX_EDGE` and `MAX_PIXELS`: a change there changes them here.
- **Where**: task 7, review.

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

## R39: The data folder is absolute

- **Decision**: `loadDataDir` resolves `URAEDA_DATA_DIR`, and the operating system's default, from
  the root the server starts in, the folder of its `.env`. `ChatImages` makes its folder absolute
  too, for any other caller.
- **Rationale**: Claude Code runs in the repository or the feature's worktree, not in the server's
  folder: a relative `--add-dir .uraeda/images` would name another folder there, which Claude Code
  refuses, failing every session, and the `[Image: …]` lines would point at nothing. A `.env` path
  is read relative to its file, as `URAEDA_REPO` already is.
- **Alternatives considered**: refusing a relative `URAEDA_DATA_DIR` at startup (a working `.uraeda`
  setting would stop the server); resolving from the repository opened (the data folder every
  repository's server shares would move with each).
- **If wrong**: `loadDataDir` in `packages/server/src/env.ts`, and the constructor of `ChatImages`.
- **Where**: task 7, review.

## R40: A failed cleanup never stops the server

- **Decision**: the startup cleanup of chat images skips each file it cannot read or delete, and
  `startSessions` logs a cleanup that fails as a whole, then starts.
- **Rationale**: the cleanup only frees disk space. A file another user owns, or a folder named like
  an image, must not keep every repository's server from starting; it is tried again at the next
  start.
- **Alternatives considered**: refusing to start with the system's error (the human must clean the
  data folder by hand before any chat works); deleting a folder named like an image recursively (it
  was not written by the server).
- **If wrong**: `ChatImages.clean` in `packages/server/src/runner/images.ts`, and `startSessions` in
  `packages/server/src/live.ts`.
- **Where**: task 7, review.

## R41: The image read check runs in the `default` permission mode, with a control

- **Decision**: check 7 of `validate-claude.ts` keeps its data folder under `uraeda data`, a name
  with a space, and runs through a wrapper that swaps the runner's `--permission-mode auto` for
  `default`. It passes only when the image in the added folder is read, and the same image copied to
  a folder outside every working folder is refused. Check 8 compares paths through `realpathSync`.
- **Rationale**: the check must fail without `--add-dir`. Check 6's wrapper passes a rule through
  `--settings`, but no rule can block reads outside the project and not in the images folder: the
  images folder is outside the project too, and a deny or ask rule wins over `--add-dir`. The
  `default` mode is what blocks such reads for users who have not allowed them, and print mode,
  which cannot ask, refuses them. The control shows the mode blocks reads on this version, so a pass
  is due to the added folder. A space in the path is what macOS's `Application Support` holds.
- **Alternatives considered**: an ask or deny rule on the temporary folder (it blocks the images
  folder too); no control run (a Claude Code that allows every read would pass without `--add-dir`).
- **If wrong**: check 7 in `packages/server/scripts/validate-claude.ts`. The check was not run with
  this change: it runs the real agent, by hand.
- **Where**: task 7, review.

## R42: A message's images are checked before any session work

- **Decision**: `session.send` refuses, before it creates a feature's session or reads the
  repository: an `images` element that is not an object; a size the core could not have given (R35);
  more than 10 images; images to an agent that does not declare them; and images with the workflow's
  message, "The workflow's message takes no images.". An image given twice in one message is kept
  once, at its first place. `Sessions.send` checks the count, the capability, and the workflow
  again, for its other callers.
- **Rationale**: a refused message must leave nothing behind, such as a feature's empty session in
  the sidebar. The workflow's message is the workflow's own text, which the agent follows as the
  skill says; a picture for it belongs in a workflow file, attached there, or in a chat. A duplicate
  is the same file sent twice: the agent would read it twice for nothing.
- **Alternatives considered**: refusing duplicates (the composer would need to explain a refusal of
  a harmless paste); sending the workflow's images as a chat message after it (two turns for one
  send).
- **If wrong**: `sentImages` in `packages/server/src/fate/mutations.ts`, and `Sessions.checkImages`
  in `packages/server/src/runner/sessions.ts`. Task 10's composer keeps images out of the workflow's
  message, or shows this refusal.
- **Where**: task 7, review.

## R43: Links go in a paragraph of their own

- **Decision**: `insertLinks` puts the links one per line, with a blank line before them unless they
  start the text, and after them unless they end it, counting the line breaks already there. A
  dropped screenshot after "covers the login button:" gives
  `button:\n\n![…](images/….webp)\n\n## Why`.
- **Rationale**: the mockup shows the link on its own line, under the sentence; an image glued to a
  sentence draws inside its paragraph, and an image before a heading on the next line breaks it. The
  spec's "at the cursor" still holds: the cursor picks the place between the paragraphs.
- **Alternatives considered**: inserting exactly at the cursor (a link inside a word or a heading
  line); one line break only (an image in the sentence's paragraph).
- **If wrong**: `insertLinks` in `packages/web/src/attach/insertLink.ts`.
- **Where**: task 8.

## R44: A drop goes to the cursor, or the end of a field never focused

- **Decision**: the links go where the field's cursor was when the files came, moved by every edit
  typed before it during the upload, tracked edit by edit (`followEdits`). A field never focused
  since it was drawn takes them at its end. Text typed at the cursor itself goes after the links.
- **Rationale**: a field never focused has no cursor the human chose: WebKit reports 0, the top of
  the file, before its title. Tracking each edit keeps two edits on both sides of the cursor apart,
  which one diff of the texts before and after the upload cannot.
- **Alternatives considered**: the browser's selection whatever the focus (links above the title);
  one diff at the end (typing before and after the cursor reads as one edit around it).
- **If wrong**: `addFiles` in `packages/web/src/attach/useImageText.ts`.
- **Where**: task 8, Review focus 8.

## R45: Pasted files are pasted images

- **Decision**: every file of a paste is sent without its name, so the core names it
  `pasted-YYYYMMDD-HHmmss` with the alt text "pasted image", and the status says "Adding pasted
  image…".
- **Rationale**: browsers name a pasted screenshot `image.png` whatever it is; US1.2 names pasted
  images by the time. A file copied in a file manager and pasted loses its name, which a drop or the
  button keeps.
- **Alternatives considered**: keeping names other than `image.png` (a guess at each browser's
  default name).
- **If wrong**: `onPaste` in `packages/web/src/attach/useImageText.ts`.
- **Where**: task 8; tasks 10 and 11 paste the same way.

## R46: A drop on the editor's preview opens its text

- **Decision**: the editor's field is a drop target whether its text or its preview shows. A drop on
  the preview switches to the text, links the images at its end, and selects the first alt text.
  "Add image" shows in both.
- **Rationale**: a written proposal opens on its preview, and US1 drops "anywhere on the page"; a
  drop that did nothing there would look broken. The end is the only place the human did not have to
  choose.
- **Alternatives considered**: no target while the preview shows (the drop is lost); a link at the
  cursor of the last edit (none, on a freshly opened page).
- **If wrong**: `onStart` in `packages/web/src/EditorPage.tsx`, and `pick` in
  `packages/web/src/attach/useImageDrop.ts`, which counts fields not drawn.
- **Where**: task 8.

## R47: The paperclip is imported as `#theme-icons`

- **Decision**: the paperclip lives in `packages/web/src/theme/icons.ts`, written without JSX, and
  `theme.ts` imports it through `package.json`'s `imports`, `#theme-icons`, as the theme's `icons`.
- **Rationale**: R6 registers it in the theme. Astryx's theme build (CLI 0.6.8) copies the icons'
  import specifier into `built/uraeda.js` as written, where a relative path no longer resolves, and
  loads `theme.ts` without a JSX runtime. A package import resolves the same from both files.
- **Alternatives considered**: `registerIcons` at module level (outside the theme, against R6); a
  hand-edited `built/uraeda.js` (rebuilt and checked by `theme --check`).
- **If wrong**: the `imports` field of `packages/web/package.json`, and `theme.ts`.
- **Where**: task 8.

## R48: An image is a link to itself, in a box of its own

- **Decision**: `ImageView` draws the `<img>` inside an Astryx `Link` to the image's own address; a
  click opens the lightbox in place, and a click with a modifier key, or a middle click, opens the
  address as a browser does. A paragraph holding an image is drawn as a `div`, not a `p`. The
  history entry that lets Back close an overlay moves from `layout/Overlay.tsx` into
  `layout/useBackCloses.ts`, which both use.
- **Rationale**: a link is reachable by keyboard and named by the image's alt text, without taking
  the image's `img` role away, as `useLightbox`'s trigger props (`role="button"`) would. The
  lightbox is a `<dialog>`, flow content, and HTML lets a `<p>` hold phrasing content only: React's
  DOM nesting check reports a `<dialog>` inside a `<p>` as an error, in development and in the
  tests. One hook keeps Back's behaviour the same for both overlays. happy-dom follows a link
  clicked through its child before React sees the click, which a browser does not, so the UI test
  clicks the link that holds the image; the screenshots click the image itself.
- **Alternatives considered**: the image with `useLightbox`'s trigger props (a button, no longer an
  image); a lightbox portalled to `body` (outside Astryx's theme); the history code copied.
- **If wrong**: `packages/web/src/ImageView.tsx`, the paragraph case of `BlockNode` in
  `packages/web/src/Blocks.tsx`.
- **Where**: task 9; task 10 draws chat images with the same `ImageView`.

## R49: Images added during an upload wait their turn, in one run

- **Decision**: `useImageText` queues every batch, dropped, pasted, or picked, behind the ones
  uploading, in one run. The run saves the text once before its first upload (`onStart`), holds the
  field's saves while it lasts, and ends when its last batch is done: one save of the text with
  every link (`onText`), or, when a single-file draft moved, one move to the new path (`onMoved`),
  whose page shows the last status. A later batch goes to the path an earlier one moved the draft
  to, and its links go after an earlier batch's at the same place. Links inserted while batches
  still wait show at once (`onLinks`), not saved. While a run lasts, the page reads "saving…" and
  asks before it is closed. A version of the file read during the run is not taken as the one the
  next save is made over: the save after the run is refused as a conflict when the file changed,
  with "Load the new version". A run that ends after the human left the page saves its text, at the
  new path when the draft moved, without taking them back. A text that could not be saved before the
  run starts no upload, and says "Your text is not saved: the image was not added." under the field.
- **Rationale**: two uploads at once on a single-file draft sent the second to a path the first had
  moved, and its refusal was lost behind the move; the first one's end also ended the hold while the
  second still ran. An outside edit taken as the base while held was overwritten without a conflict.
  One run keeps the draft's one move and its one save, as for several files in one drop. A human who
  left the page chose where to be: the link is still saved, since the image is.
- **Alternatives considered**: disabling the button and the drop during an upload (a drop that does
  nothing looks broken); a link lost when the page is left (the image stays, unlinked, and is
  deleted at the next commit); saving each batch's links as they come (a draft that moves after its
  text was saved at the old path).
- **If wrong**: `addFiles`, `upload`, and `end` in `packages/web/src/attach/useImageText.ts`;
  `adopt`, `onText`, and `onMoved` in `packages/web/src/EditorPage.tsx`. The plan's `useImageText`
  interface gains `initialStatus`, `onLinks`, and `onMoved`'s status; `useAttach` gains `attach`'s
  path, `show`, and `lastStatus`; `useSave` gains `load`.
- **Where**: task 8, review.

## R50: The editor's text has LF line breaks

- **Decision**: the editor holds a file's text with its CRLF and CR line breaks read as LF, as its
  text field does. Opening a file writes nothing; its first save, typed or with an image's link,
  writes LF line breaks.
- **Rationale**: a text field's value has LF line breaks whatever it was given, and its cursor
  counts them so: a link inserted at the cursor in the CRLF text went one character early per line
  above it. Typing already saved the field's LF value, so the first save changes the line breaks
  either way.
- **Alternatives considered**: keeping CRLF and mapping each cursor position to the file's text
  (every edit typed saves LF anyway); converting the file on open (a write the human did not make).
- **If wrong**: `asTyped` in `packages/web/src/EditorPage.tsx`.
- **Where**: task 8, review.

## R51: A paste with text is a paste of text

- **Decision**: a paste is taken as images only when the clipboard holds files and no text but
  blanks in `text/plain`. Markup holding only an `<img>`, as a browser copies an image with, does
  not count as text.
- **Rationale**: Word, Excel, and LibreOffice copy a picture of the selection with its text: the
  human copied text, and a paste that uploaded a picture of it instead would lose it. A copied image
  carries no plain text.
- **Alternatives considered**: files first (the office suites' text lost); asking which to paste (a
  dialog for a paste).
- **If wrong**: `onPaste` in `packages/web/src/attach/useImageText.ts`.
- **Where**: task 8, review; tasks 10 and 11 paste the same way.

## R52: The over-20 MB refusal is written once for TypeScript

- **Decision**: `packages/server/src/limits.ts`, exported as `uraeda-server/limits`, holds the limit
  and the refusal's text, "This image is over 20 MB: <name> is <size> MB.", which the upload route
  and `useAttach` import. The core writes the same text in Rust, for the files that reach it.
- **Rationale**: the route refuses a body over the limit without reading it, and the UI refuses
  before uploading (Review focus 12): both must say what the core says. A module free of Node's
  modules is one the UI bundles, and the UI already depends on `uraeda-server` for its types.
- **Alternatives considered**: a shared package (one module does not need one); the binding giving
  the text (the UI does not load the binding).
- **If wrong**: `packages/server/src/limits.ts`, and the core's `ImageError::Size` refusal in
  `crates/core/src/images.rs`, which its tests and the UI's pin to the same text.
- **Where**: task 8, review.

## R53: An answer that is not the route's says the status

- **Decision**: an upload whose answer is not JSON shows its text only when it is plain text, like
  the guard's "Forbidden site", and otherwise "The image could not be added (HTTP <status>)."; no
  answer at all shows "Could not reach the Uraeda server.".
- **Rationale**: a proxy's or a tunnel's error page is HTML, unreadable under a field; the status
  says enough to look for the cause. The guard's plain refusals name the cause.
- **Alternatives considered**: always the raw text (markup under the field); always the status (the
  guard's cause hidden).
- **If wrong**: `upload` in `packages/web/src/attach/useAttach.ts`.
- **Where**: task 8, review.

## R54: The window's drop listeners last as long as the app

- **Decision**: `useDropGuard`, mounted by `App`, adds the window's drag and drop listeners with its
  first mount and removes them with its last, instead of adding them when `useImageDrop.ts` loads.
- **Rationale**: a module replaced in development added a second set of listeners, whose state no
  field registers with. The app is mounted on every page, so a drop outside every field still never
  leaves it (Review focus 9). A script's drag carries no drop effect in the browser tests: they
  check that `dragover` and `drop` are cancelled, not the cursor.
- **Alternatives considered**: counting the fields' registrations (a page without a field would open
  a dropped file); `import.meta.hot.dispose` (the package's types do not include Vite's).
- **If wrong**: `useDropGuard` in `packages/web/src/attach/useImageDrop.ts`.
- **Where**: task 8, review.

## R55: An image inside a control or a link is drawn alone

- **Decision**: `ImageView` takes `isStatic`, and `StaticImages` makes every image of its content
  static: the `<img>` alone, with its alt text, no link and no lightbox. A question's option, a
  toggle `<button>`, draws its content inside `StaticImages`, and its paragraphs stay `<p>`. An
  image inside a link, like a CI badge, `[![build](images/build.webp)](https://ci)`, is drawn inside
  that link, which keeps its target: the image when it is under `specs/`, else its alt text.
- **Rationale**: a link inside a `<button>`, or inside another link, is invalid HTML, and a click on
  it would both toggle the option and open the image. In an option, a tap anywhere is the toggle's,
  as on its text. A badge's link is what its author meant to open, not the image.
- **Alternatives considered**: the alt text alone in an option (the image is part of the option's
  argument, and an `<img>` is valid in a button); the lightbox opened from an option with the
  toggle's click stopped (two actions on one tap target).
- **If wrong**: `StaticImages` and `isStatic` in `packages/web/src/ImageView.tsx`, `SpanImage` in
  `packages/web/src/Spans.tsx`, `Option` in `packages/web/src/Question.tsx`.
- **Where**: task 9, review.

## R56: The lightbox keeps its clicks, not its keys

- **Decision**: the lightbox stops the propagation of its clicks, through `useLightbox`'s `onClick`,
  and lets its keys bubble.
- **Rationale**: the lightbox is drawn where its image is, so React passes its clicks up its tree:
  in a review, a click on the backdrop, the image, or Close reached the block's `onClick`, which
  selected the block and opened a comment. Astryx closes the lightbox on an Escape heard by a
  listener on `document`: a stopped `keydown` never reaches it. No ancestor of an image handles
  keys, and Enter or Space on Close arrives as a click.
- **Alternatives considered**: keys stopped too (Escape no longer closes it); the review's `onClick`
  ignoring targets inside a `dialog` (every other ancestor with a click would need the same).
- **If wrong**: `useLightbox`'s options in `packages/web/src/ImageView.tsx`.
- **Where**: task 9, review.

## R57: "Image missing" names its alt text, and an image without one is "Image"

- **Decision**: an image that fails to load shows "Image missing: <alt>", or "Image missing" when
  its alt text is empty, as a chat image's is. A link holding an image without alt text is named
  "Image". The failure is tied to the address that failed: an image whose address changes loads
  again.
- **Rationale**: a document may hold several images; the alt text says which one is gone. The spec's
  "Image missing" stays the whole text for a chat image, which has no alt text. "Image" is the chat
  title of a message of images alone. The editor's preview redraws an image as its link is typed:
  the first, incomplete address fails, and the finished one must show.
- **Alternatives considered**: the file name as the name (a chat image's is a UUID); the failure
  kept by the component (spans are keyed by their index, and a preview reuses them).
- **If wrong**: `ImageView` in `packages/web/src/ImageView.tsx`.
- **Where**: task 9, review; task 10's chat images.

## R58: An overlay's history entry is pushed once per opening

- **Decision**: `useBackCloses` pushes its entry when the overlay opens, under the label it has
  then, and keeps that entry while the label changes. The Backs that overlays closed by their owner
  start are counted for the whole page: an overlay opened while one has not landed, the same overlay
  or another, waits for them, then pushes a new entry, and an open overlay ignores their landing.
- **Rationale**: a label change while open pushed a second entry, which a Back left behind. The
  browser's Back is asynchronous: an overlay closed by its owner and opened again at once read the
  old entry as its own, then closed when the late `popstate` arrived. A form that leads to another,
  its overlay closed and the next one opened at once, met the same race across two overlays: the
  count is the page's, not an overlay's. happy-dom goes back at once, so the race is tested in the
  browser tests.
- **Alternatives considered**: replacing the entry's state on a label change (a Back then lands on a
  state the next page reads); ignoring the race (a form opened just after another one closed
  vanished); a count kept by each overlay (the review's case of two overlays stays broken).
- **If wrong**: `packages/web/src/layout/useBackCloses.ts`.
- **Where**: task 9, review; task 10, review.

## R59: An image is at most 80 % of the window's height

- **Decision**: a drawn image is at most the column's width and the theme's
  `--size-image-max-height`, `80dvh`, kept in proportion with `object-fit: contain`; it loads lazily
  and decodes asynchronously.
- **Rationale**: a phone screenshot, 2576 pixels tall, filled several screens of a proposal or a
  chat. The UI components decision puts sizes in the theme; StyleX's lint accepts no `vh` in a
  component. A long document of images, or a long chat, loads only what is shown.
- **Alternatives considered**: no cap (a tall screenshot pushes the text away); a fixed pixel height
  (too small on a desktop, too large on a phone).
- **If wrong**: `packages/web/src/theme/theme.ts`, the image style in
  `packages/web/src/ImageView.tsx`.
- **Where**: task 9, review.

## R60: The workflow's message has no paperclip

- **Decision**: while the composer holds the workflow's message, it has no attach button, and an
  image pasted or dropped on it is refused under it with the sessions' text, "The workflow's message
  takes no images.". An agent that cannot read images has no attach button either, and a paste or a
  drop says "This agent cannot read images.". The image limits and refusals the composer checks
  first, 10 images and these texts, move to `uraeda-server/limits`, which the sessions import.
- **Rationale**: the server refuses images with the workflow's message (R42); a button the human can
  press only to be refused at Send would lose the images and the text's moment. The texts stay the
  server's, written once, as R52 does for the size refusal.
- **Alternatives considered**: the button disabled (a control that does nothing, with its reason
  nowhere); images accepted and refused at Send (the refusal comes late, after the uploads).
- **If wrong**: `useChatImages` and the `footerActions` of `packages/web/src/Composer.tsx`;
  `packages/server/src/limits.ts`.
- **Where**: task 10.

## R61: Send and Enter are the composer's own

- **Decision**: the composer draws Astryx's `ChatSendButton` with its own `onSend` and `isDisabled`,
  and handles Enter in its `onKeyDown` on wide screens, sending the text, the images, or both. Send
  and Enter wait until every image is saved. The attach button sits in the composer's footer, left
  of Send, as the mockup draws it.
- **Rationale**: Astryx's composer, its Send, and its Enter send text only, and clear the field
  before the page could refuse; `ChatSendButton` takes the page's own send and state, which keeps
  its look and its "Send" name (an Astryx gap, listed in the plan). An image still being saved has
  no ID to send. The spec names `headerActions`, above the text; the mockup, the visual reference,
  puts the paperclip in the bar with Send, where a thumb reaches it on the phone.
- **Alternatives considered**: a `Button` of our own (another look than Astryx's send); the images
  sent once saved, after Send (a message whose images arrive later, or fail after it went).
- **If wrong**: `submit`, `onKeyDown`, and `send` in `packages/web/src/Composer.tsx`.
- **Where**: task 10.

## R62: The page keeps the message's images with its text

- **Decision**: the session page keeps a draft of the text and the images, which the composer draws,
  so they survive the composer drawn again when a first message creates the session. Each image is
  saved as soon as it comes, one after the other, and shows as a thumbnail labelled with its file's
  name, dimmed and showing the file itself while saved. A removed thumbnail deletes its image, once
  saved if it is being saved. A taken-back message puts its images back before the draft's, as its
  text goes before the text typed since. When more images come than the message has room for, the
  first ones are taken, and "A message takes at most 10 images." shows once they are saved.
- **Rationale**: the spec's thumbnails are removable and sent with the message; the chat's uploads
  are the same queue as the fields' (R49). A refusal shown before the uploads' statuses would be
  replaced by them at once. A taken-back message's images stay in its item (US2.5), so removing one
  from the composer again is refused by the server and the file is kept, which the cleanup also
  keeps while the item holds it.
- **Alternatives considered**: the images uploaded at Send (a slow send, and no early refusal); the
  whole batch refused past 10 (the human picks again).
- **If wrong**: `useChatImages` in `packages/web/src/Composer.tsx`, `useDraft` in
  `packages/web/src/SessionPage.tsx`.
- **Where**: task 10.

## R63: A chat image is a preview in its message

- **Decision**: a message's images show above its text, side by side while they fit, each at most
  the theme's `--size-message-image`, 120 px, tall, and open full screen with `ImageView`'s
  lightbox. They have no alt text: their link is named "Image" (R68), and a missing one shows "Image
  missing". A message not read yet has its images dimmed, as its text.
- **Rationale**: the mockup shows the images as small previews above the text; 120 px keeps a
  desktop screenshot and a phone screenshot side by side in a bubble beside a feature page, and
  wraps them on the phone. A chat image has no alt text to give: its name is a UUID.
- **Alternatives considered**: Astryx's `Thumbnail` with `onClick` (a square crop, and its own
  placeholder in place of the spec's "Image missing"); the column-wide images of documents (two
  screenshots fill the screen).
- **If wrong**: `Message` in `packages/web/src/Transcript.tsx`, `size` in
  `packages/web/src/ImageView.tsx`, `packages/web/src/theme/theme.ts`.
- **Where**: task 10.

## R64: A verdict waits for a comment's images, and an answer's images are saved at once

- **Decision**: a verdict, approving or requesting changes, is refused while the open comment holds
  an image added to it, or an image uploads, with "Add or cancel your comment first: its images are
  not in the review yet.", under the verdict's buttons on wide screens and in the comment's sheet on
  the phone. A comment cancelled during an upload stays cancelled. An image added to an answer's
  comment saves the answer at once, as an image added to a proposal saves its text; the notes save
  as typed. Submit waits for the images under way in every answer and in the notes, then saves what
  is still being typed, as before.
- **Rationale**: a verdict or a submit commits the folder's images that a file links, and deletes
  the others (Review focus 11). A review comment is a draft until it is added: sending it with the
  verdict would add a comment the human did not send, and the comment's anchor may still be
  changing. An answer has no such step: its comment is the answer, and saving it at once keeps the
  image linked even when the page is left. On the phone, the sheet lies over the page's end.
- **Alternatives considered**: adding the open comment before the verdict (a comment sent without
  the human's Add comment); refusing a verdict whenever a comment is open, image or not (a change to
  how reviews work beyond images); an answer's image link waiting for Save comment (an image deleted
  by the next commit if the page is left).
- **If wrong**: `verdict` and `useImageText`'s callbacks in `packages/web/src/ReviewPage.tsx`;
  `onImages` and the pending save in `packages/web/src/Question.tsx`; `submit` and `NotesField` in
  `packages/web/src/RoundPage.tsx`; `settled` in `packages/web/src/attach/useImageText.ts`.
- **Where**: task 11, Review focus 11.

## R65: A chat image's box is drawn before it loads

- **Decision**: `ImageView` takes the image's `width` and `height` when they are known, as a chat
  image's are: its `<img>` carries them, and its box gets their proportions and a height of the
  smaller of the image's own and the cap, the theme's `--size-message-image` or
  `--size-image-max-height`, through a dynamic StyleX style. The width still fits the column.
- **Rationale**: a transcript opens at its end once drawn (`useOpenAtEnd`); a message's images,
  loaded after, pushed the end out of view. The attributes alone do not size the box: the image's
  `inline-size: auto` and `block-size: auto`, which keep it in proportion under both caps, override
  them. An image already loaded in the page is drawn at once, at its size: the browser test serves
  the chat images a second late, through a test-only middleware, and sends them outside the page.
- **Alternatives considered**: scrolling to the end again as each image loads (the view jumps, and
  moves a human who scrolled up); the attributes alone (no box before load); sizes for the
  documents' images too (a document links images without their size).
- **If wrong**: `sized` in `packages/web/src/ImageView.tsx`, `Message` in
  `packages/web/src/Transcript.tsx`.
- **Where**: task 10, review.

## R66: A batch of chat images is saved in one run

- **Decision**: the images added at once, by a drop, a paste, or the picker, are saved in one
  `useAttach` run, which reports each result as it comes (`onResult`), so each thumbnail shows once
  saved; a refusal in the batch stays shown over the images added after it, as in a field. The
  images removed while being saved are remembered by the module, not by a composer, and deleted once
  saved.
- **Rationale**: an upload per file made each "Added" replace the refusal before it, at once: an SVG
  dropped with a PNG vanished. The page draws a new composer when the first message creates the
  session: an upload that ends after it read the old composer's images, and missed the removal.
- **Alternatives considered**: the last refusal kept until the queue drains (a second rule beside
  `useAttach`'s); the removals kept by the page's draft (a second state passed to the composer).
- **If wrong**: `useChatImages` in `packages/web/src/Composer.tsx`, `attach` in
  `packages/web/src/attach/useAttach.ts`.
- **Where**: task 10, review.

## R67: The workflow's message leaves the draft's images for the next one

- **Decision**: while the composer holds the workflow's message, "Start the agent" sends its text
  alone, and the draft's images stay in the composer, under "The workflow's message takes no images:
  they stay here for your next message.". Images still being saved do not hold it back.
- **Rationale**: the server refuses images with the workflow's message (R42), so a hand-over opened
  over a draft with images could never start. The images were picked for a question of the human's,
  which can follow the step.
- **Alternatives considered**: Start disabled until the images are removed (the human throws away
  what they picked); the images deleted with a notice (lost work).
- **If wrong**: `withImages` and `submit` in `packages/web/src/Composer.tsx`.
- **Where**: task 10, review.

## R68: Images are told apart by their place

- **Decision**: a message's images, when several, are named "Image 1 of 2", "Image 2 of 2"; one
  alone stays "Image". A thumbnail, when several, takes "image 1 of 3" as its alt text, so its
  remove button reads "Remove image.png — image 1 of 3". Removing one moves the focus to the next
  thumbnail's remove button, or the last, and to the message's text when none is left.
- **Rationale**: a chat image has no alt text, and the browsers name every pasted screenshot
  `image.png`: screen readers heard the same name for each. The focus stayed on a removed button,
  sending it back to the page's start.
- **Alternatives considered**: the file names alone (alike for pastes); the upload's ID (a UUID).
- **If wrong**: `Message` in `packages/web/src/Transcript.tsx`, the drawer and `focusAt` in
  `packages/web/src/Composer.tsx`.
- **Where**: task 10, review.

## R69: The composer's images follow what the agent can do

- **Decision**: an image added while the agent is not available is refused, under the composer, with
  "<agent> is not available on this machine.", before the other refusals. An agent not read yet
  refuses nothing. A taken-back message's images that bring the draft past 10 keep the first 10, the
  taken-back ones first, delete the draft's others, and show "A message takes at most 10 images.".
  During a turn, Send shows, disabled, while an image is saved, as it does when idle.
- **Rationale**: the page's drop reached the composer of an agent that could not take the message.
  An unknown agent is a moment, not a refusal; the server checks the message at Send. The server
  refuses a message past 10 images (R42), and a Send that vanished looked like the turn had taken
  the message.
- **Alternatives considered**: a drop queued until the agent is read (the agent is read with the
  page: no case was found); refusing the whole taken-back message (its images and text lost).
- **If wrong**: `refusedWith`, the `over` effect, and `sendActions` in
  `packages/web/src/Composer.tsx`.
- **Where**: task 10, review.

## R70: A verdict refused for images says it where the human looks, and leaves other errors

- **Decision**: a verdict refused while the open comment holds an image, or uploads one, says "Add
  or cancel your comment first: its images are not in the review yet.". A verdict refused while the
  image of a comment cancelled during its upload is still being added says "An image is still being
  added: wait for it, then try again.", and that refusal goes once the image is in. Either shows
  under the verdict's buttons on wide screens, and on the phone in the comment form when one is
  open, else under the verdict's buttons. Both are announced, assertive. A refusal goes when the
  comment is added or cancelled. It leaves the page's other errors, like a hook's refusal, on
  screen.
- **Rationale**: on the phone, the comment's sheet lies over the page's end, but a comment cancelled
  has no sheet left: the page's message is the only place left, and it showed nothing. The errors
  stay on screen until the human deals with them ([ui-behaviour](../decisions/ui-behaviour.md)): an
  image refusal is about the comment, and a hook's refusal, with its Try again, is not. A message
  drawn under buttons the human just pressed is not heard by a screen reader on its own.
- **Alternatives considered**: `role="alert"` on the message (a live region mounted with its text is
  not reliably announced, as Astryx notes; `useAnnounce` is the app's way, as `useAttach`'s); the
  cancelled comment's refusal in no place on the phone (a verdict that does nothing, silently);
  waiting for the upload, then giving the verdict (a commit the human cannot stop, for an image that
  would be deleted by it anyway).
- **If wrong**: `verdict`, `close`, and the `STILL_ADDING` effect in
  `packages/web/src/ReviewPage.tsx`.
- **Where**: task 11, review.

## R71: An image goes into the comment it was added for

- **Decision**: the review page counts the comments written: each cancel, add, or edit starts a new
  one. A run of uploads remembers the comment it started for, and its links go into the text only if
  that comment is still the one being written; else they are dropped, and the alt text is not
  selected. The image stays on disk, linked by no file, and the next commit deletes it. A general
  comment that becomes a line comment by a tap is the same comment.
- **Rationale**: the links are inserted in the text the field holds when the upload ends: an edit
  opened during the upload took the image picked for the comment before it. A cancelled comment
  already dropped its images (R64); an edit is the same case.
- **Alternatives considered**: comparing the draft's kind (a general comment cancelled and opened
  again would take the image of the cancelled one); the draft's object (a tap turning a general
  comment into a line comment would drop images of a text it keeps).
- **If wrong**: `writing`, `runFor`, and `onText` in `packages/web/src/ReviewPage.tsx`; `onText`'s
  `false` in `packages/web/src/attach/useImageText.ts`.
- **Where**: task 11, review.

## R72: An upload ends after 2 minutes

- **Decision**: an upload, the server's answer included, is aborted after 120 seconds, refused under
  its field with "The image could not be added: the server did not answer in time.".
- **Rationale**: Submit and a run's next files wait for the uploads under way: an upload the server
  never answers held them forever. 120 seconds leaves a 20 MB photo time over a slow phone
  connection, about 1.5 Mbit/s, and the core's encoding.
- **Alternatives considered**: 60 seconds (a 20 MB photo over a slow mobile uplink can take longer,
  and is refused after its wait); a timeout only on Submit's wait (the field's status stays
  "Adding…", and the next files never go).
- **If wrong**: `UPLOAD_TIMEOUT` and `upload` in `packages/web/src/attach/useAttach.ts`.
- **Where**: task 11, review.

## R73: A round's "Add image" buttons are named for their field

- **Decision**: `AttachButton` takes a `name`, its accessible name, starting with the text it shows,
  which stays "Add image": "Add image to Q3's comment", "Add image to the notes". The review's and
  the mockup's comment forms, the editor, and the composer keep "Add image" or "Add images": each
  page has one.
- **Rationale**: a round shows a button per question and one for the notes: a screen reader's list
  of buttons read "Add image" a dozen times. The name starts with the visible text, so a voice
  command saying what is seen still finds it (WCAG's label in name).
- **Alternatives considered**: `aria-describedby` to the question (the list of buttons still reads
  alike); visible names (long buttons, and the question is right above).
- **If wrong**: `AttachButton` in `packages/web/src/attach/AttachButton.tsx`, `CommentField` in
  `packages/web/src/Question.tsx`, `NotesField` in `packages/web/src/RoundPage.tsx`.
- **Where**: task 11, review.

## R74: A follow-up gone during its upload still saves its image, and Submit waits for it

- **Decision**: when a follow-up stops applying while an image uploads to its comment, its question
  leaves the page, but a wait stays in the page's pending saves until the image is added and the
  answer saved with its link. Submit waits for it, and commits the image with the round, in the
  follow-up's answer. A follow-up's comment typed and not saved is not saved by its leaving.
- **Rationale**: Submit commits the images the round links and deletes the others: a question that
  left the page took its wait with it, and Submit committed before the image was linked. The answer
  of a follow-up that no longer applies stays in the file, as an answer saved before it stopped
  applying does.
- **Alternatives considered**: dropping the image when its question leaves (the human's picked image
  lost, with no word); refusing Submit while it uploads (the human waits for a question no longer
  shown).
- **If wrong**: the pending saves' cleanup in `Question` in `packages/web/src/Question.tsx`.
- **Where**: task 11, review.

## R75: The comment form's buttons keep their order, unlike the mockup

- **Decision**: the comment form's buttons are "Add image", "Ask the agent" when offered, Cancel,
  then "Add comment", the primary action last, at the row's end. The mockup's section 5 shows "Add
  image", "Add comment", then Cancel.
- **Rationale**: Cancel then the primary action is the form's order before this feature, which the
  review and the mockup page share: the mockup drew the new button, not a new order. "Add image"
  goes first, as in the answers, where it leads the row.
- **Alternatives considered**: the mockup's order (a change to every comment form, for no gain the
  spec names).
- **If wrong**: `CommentForm` in `packages/web/src/CommentForm.tsx`.
- **Where**: task 11, review.

## R76: `:Uraeda image` inserts the link after the cursor's character, under `<leader>ai`

- **Decision**: the link goes after the character under the cursor, as `p` puts text, past every
  byte of a multi-byte character, or at the start of an empty line; the cursor then rests on the
  link's last character. The place is tracked by an extmark while the server works; on a moved
  draft, it is the same line and column of the reopened buffer. No blank lines are added around the
  link. The action's key is `i` under the prefix, `<leader>ai`. Its messages, errors and the core's
  refusals alike, start with "uraeda: ", as the spec writes them, and a saved image says "uraeda:
  added images/<name>", with "; the draft is now a folder" when it moved, as the mockup shows; other
  actions keep their messages as they are.
- **Rationale**: the spec says "at the cursor", and a Neovim user places the cursor on the line the
  link takes, as the mockup's line 6 shows; the web's paragraph rule (R43) guesses a place a field
  never focused lacks, which Neovim always has. In normal mode the cursor rests on the last
  character typed: inserting before it, as task 12 first did, split `See the login form:` into
  `See the login form![…](…):`. After it is where `p` puts text, which a Neovim user expects. Every
  action has a key (the keys test), and `i` is free, outside LazyVim's AI keys.
- **Alternatives considered**: before the cursor's character, as `P` does (splits the last word
  typed); R43's blank lines (two lines to remove by hand on an empty line); a line below the cursor,
  as img-clip.nvim does (not "at the cursor"); no key (the keys test requires one).
- **If wrong**: `after_cursor`, `M.image`, and `M.list` in `editors/nvim/lua/uraeda/actions.lua`.
- **Where**: task 12, and its review.

## R77: A clipboard command's output is an image only by its first bytes

- **Decision**: the output of `vim.g.uraeda.clipboard`, of `pngpaste`, and the file PowerShell
  writes count as an image only when they start as a PNG, a JPEG, a GIF, or a WebP file does; else
  Neovim says "uraeda: the clipboard holds no image" and sends nothing. `wl-paste` and `xclip` list
  the clipboard's types first, and take the first of `image/png`, `image/jpeg`, `image/gif`, and
  `image/webp`.
- **Rationale**: US5.4 wants "the clipboard holds no image" for text, and a configured command, like
  the tests' `echo text`, says nothing of its type. The core checks the bytes again and encodes
  them: the plugin neither names nor encodes the image, as the attachments decision requires.
- **Alternatives considered**: sending any output to the core (text refused as "Only PNG, JPEG, GIF,
  and WebP images can be added: pasted image is not one.", not the spec's message); a type option
  next to the command (one more option for every user). Task 12's review named a cleaner one: the
  core, or the language server, maps a type refusal of an image with no name to "the clipboard holds
  no image", and the plugin checks no bytes. Kept the check instead: the web's paste also sends
  images with no name, where "pasted image is not one" is right for a pasted SVG; text would still
  be written to a temporary file, the buffer saved, and a request sent, for a refusal the plugin can
  give at once; and the check is twelve lines that only decide the message, as the core checks the
  bytes again.
- **If wrong**: `is_image` in `editors/nvim/lua/uraeda/clipboard.lua`.
- **Where**: task 12, and its review.

## R78: On WSL, `:Uraeda image` tries PowerShell before `wl-paste`

- **Decision**: on `has("wsl")`, with `powershell.exe` and `wslpath` found, the clipboard is read
  through Windows' PowerShell, before `wl-paste` and `xclip`. Elsewhere the order is unchanged:
  `wl-paste`, `xclip`, `pngpaste`, PowerShell. The first tool available is the only one tried.
- **Rationale**: WSLg sets `WAYLAND_DISPLAY`, so `wl-paste` was picked first on WSL, but a
  screenshot taken in Windows reaches its clipboard bridge unreliably, and the human then reads "the
  clipboard holds no image" while one is there. PowerShell reads Windows' clipboard, where the
  screenshot is. One tool per system keeps `:checkhealth uraeda` naming the tool used.
- **Alternatives considered**: falling through to the next tool when one finds no image (two tools
  run, slowly through PowerShell, for every clipboard that holds text, and health cannot name the
  tool); leaving `wl-paste` first (wrong on most WSL setups).
- **If wrong**: the order of `tools` in `editors/nvim/lua/uraeda/clipboard.lua`.
- **Where**: task 12's review.

## R79: A draft edited while it moves keeps the edits in its new buffer

- **Decision**: when `:Uraeda image` moves a single-file draft into a folder and the old buffer was
  edited while the server worked, its lines replace the new buffer's, unsaved, before the link is
  inserted; the old buffer is then deleted, forced. The link's place is the mark in the old buffer,
  which counts those edits.
- **Rationale**: the core moves the file with `rename`, its text unchanged, so the old buffer's
  lines are the new file's plus the edits. Left as it was, the old buffer could not be deleted and
  still named the old path: a later `:w` re-created the single-file draft next to its folder.
- **Alternatives considered**: a warning, and the old buffer renamed so a save fails (the edits stay
  in a buffer the human must find and copy); an error asking to save first (the command already
  saved, and the edit came after).
- **If wrong**: `M.image` in `editors/nvim/lua/uraeda/actions.lua`.
- **Where**: task 12's review.

## R80: `ura` grew by 0.86 MB, within SC-003

- **Decision**: `ura`'s release binary grew by 863,832 bytes (0.86 MB) over the feature's start,
  measured after task 12, within SC-003's 1 MB. The spec's "about 0.83 MB" was the estimate before
  task 12's language server command; the approved spec is not edited.
- **Rationale**: SC-003 bounds the growth at 1 MB, and the measurement is what the pull request
  compares; the estimate in the spec was right in size, and editing an approved spec for it would
  need a new approval for no change in behaviour.
- **Alternatives considered**: a new spec revision with the measured number (an approval for a
  number); trimming the binary (no criterion is broken).
- **If wrong**: the binary size line of the pull request.
- **Where**: task 12's review.

## R81: A thumbnail's remove button sits under it

- **Decision**: each thumbnail of the composer is drawn without Astryx's remove button, in a group
  with an Astryx `Button` of its own under it, icon only, named as Astryx names it, "Remove
  image.png — image 1 of 2". The mockup's ✕ sits in the thumbnail's corner.
- **Rationale**: Astryx's remove button is 20 px tall whatever the pointer, which the UI layout
  decision's 44 px under a touch pointer refuses, and its style cannot be reached from the app. A 44
  px button in a 64 px thumbnail's corner would hide most of the image it removes. A button of the
  theme's size under the thumbnail is 44 px on the phone and stays small on a desktop.
- **Alternatives considered**: the theme growing Astryx's button under a touch pointer (it covers
  the image); larger thumbnails on the phone (fewer fit in the drawer, and the button still covers a
  quarter of each).
- **If wrong**: the drawer in `packages/web/src/Composer.tsx`.
- **Where**: task 13, found by the layout checks (SC-005).

## R82: The lightbox's Close has a scrim

- **Decision**: the theme gives the buttons of Astryx's lightbox the `--color-overlay` background
  that Astryx's thumbnails put under their remove button.
- **Rationale**: the lightbox's Close is a ghost button with a light icon and no background: a
  desktop screenshot opened on a desktop fills the window, and Close vanished over its light corner.
  The UI behaviour decision wants every dialog's close button visible. The theme owns overrides of
  Astryx's components.
- **Alternatives considered**: a margin around the image (the lightbox's layout is not reachable
  from the app); a lightbox of our own (one button's colour).
- **If wrong**: `lightbox` in the components of `packages/web/src/theme/theme.ts`.
- **Where**: task 13, found by the screenshots.

## R83: The drop hint of a labelled field sits on its label's line

- **Decision**: `DropHint` takes `isLabelled`: the hint of a review comment, an answer's comment,
  and the notes, whose label shows above the field, sits at the end of the label's line. The
  editor's text and the composer, whose labels are hidden, keep it inside the field's corner, as the
  mockup draws it.
- **Rationale**: the hint is placed from the top of what `DropHint` wraps, the label included: under
  a label, it lay across the field's border.
- **Alternatives considered**: the hint at the field's bottom (off screen in a long preview); a
  wrapper around the text area alone (Astryx draws the label and the field as one component).
- **If wrong**: `DropHint` in `packages/web/src/attach/DropHint.tsx`.
- **Where**: task 13, found by the screenshots.

## R84: The image routes are a repository's, under `/r/<name>/`

- **Decision**: `POST /attach`, `GET /images/<path>`, and `GET` and `DELETE /chat-images/<id>` are
  served only under the repository's prefix, `/r/<name>/attach`, `/r/<name>/images/…`, and
  `/r/<name>/chat-images/…`, with its host's context, like `/raw` and `/mockups`; an unknown name or
  a path without the prefix is a 404. The UI builds them with `repoPath`: the editor's and the
  comments' uploads, a document's images, and a chat's thumbnails and transcript. The dev proxy
  takes them only with a prefix, so Vite keeps every other `/images/…`. Chat images stay in the one
  data folder that every repository shares, served under the prefix of the session's repository.
- **Rationale**: the repositories decision, merged meanwhile, wants every route that reads or writes
  a repository's data under `/r/<name>/`: an upload writes a workflow file's folder, and an image is
  read from one. A chat image belongs to a session, which belongs to a repository. Unlike `/raw` and
  `/mockups`, no old link names the image routes, so they get no redirect.
- **Alternatives considered**: redirecting the unprefixed routes to the most recent repository, as
  `/raw` does (no link was ever written with them); chat images outside any prefix (a route reading
  the data folder that names no repository, against the decision's wording).
- **If wrong**: `createApp` in `packages/server/src/app.ts`, `SERVER_PATHS` in `dev.ts`, and
  `repoPath` in `useAttach.ts`, `Spans.tsx`, and `chatImageSrc`.
- **Where**: the catch-up with the default branch, 52a73ec.

## R85: The data folder is the core's, made absolute by the server

- **Decision**: the server reads the data folder from the core, `dataDir`, as the default branch
  does, and `loadDataDir` resolves it from the root the server starts in, so a relative
  `URAEDA_DATA_DIR`, or a relative `XDG_DATA_HOME`, still names one absolute folder (R39). The
  startup cleanup of chat images runs in `startSessions`, now in `server.ts`, once for the one
  server that serves every repository.
- **Rationale**: the repositories decision puts finding the data folder in the core; the agent runs
  in another folder than the server, so the chat images' paths and `--add-dir` must be absolute.
  Resolving a `.env` path from its file is the server's setting, not the core's rule.
- **Alternatives considered**: making the core's `data_dir` absolute from the process's folder
  (`ura add` and the server could then disagree on a relative setting read from `.env`).
- **If wrong**: `loadDataDir` in `packages/server/src/env.ts`.
- **Where**: the catch-up with the default branch, 52a73ec.

## R86: The feature's code meets the code quality limits without a marker

- **Decision**: no limit marker is added. Files over 500 lines on the default branch only shrink:
  the feature's additions to the core's `api.rs`, `document.rs`, `priorities.rs`, `git.rs`, and
  `workspace.rs` move to modules of their own (`api/files.rs`, `document/inline.rs`,
  `files/retarget.rs`, `git/status.rs`, `workspace/links.rs`), and the language server's
  `commands.rs`, its image and draft commands in `commands/`, falls to 500 lines and leaves the size
  test's list. In TypeScript, the composer, the editor's images, the review's images, a question's
  and the notes' images, and the session manager's message checks are split into hooks and modules,
  so no function the feature wrote passes 100 lines, no file passes 500, and the functions marked on
  the default branch do not grow. The fate config's rules apply to the feature's code, sorted keys
  included.
- **Rationale**: the code quality decision and the constitution's principle VI, both merged
  meanwhile: a new marker needs a human's approval, and the sizes the checks measure must not go up.
- **Alternatives considered**: markers on the feature's long functions (a human's approval for each,
  for code that splits along its responsibilities).
- **If wrong**: the modules named above, and `crates/cli/tests/structure.rs`.
- **Where**: the catch-up with the default branch, a17dc84, 12a155d.

## R87: The rules the feature copies across layers are listed and justified

- **Decision**: the plan's complexity tracking lists the three copies of a rule the feature keeps:
  the over-20 MB refusal and its rounding to MiB in `limits.ts`, the first bytes of the four image
  types in the Neovim plugin, and the four types' MIME names where files are chosen by type. The
  chat's own limits, 10 images and their refusals, live once, in `limits.ts`, for the sessions and
  the composer.
- **Rationale**: the constitution's amended principle VI wants each rule in one place, and a copy in
  another layer justified in the plan. Each copy decides only a message or a choice made before the
  core sees the bytes, and the core checks again.
- **Alternatives considered**: removing the copies (each removal costs a request the user waits for,
  or a body read that the limit exists to avoid, as R34, R52, and R77 say).
- **If wrong**: the plan's complexity tracking.
- **Where**: the catch-up with the default branch, in the plan's complexity tracking.

## R88: `:Uraeda image` from another branch's checkout writes the default branch's draft

- **Decision**: in another branch's checkout, `uraeda.attachImage` acts on a draft or backlog file
  only while its copy holds the default branch's text, and otherwise refuses, naming the default
  branch's checkout, as the other commands do. The image goes into the default branch's checkout, as
  the core already placed it, and the plugin reopens the buffer at the default branch's file to
  insert the link there; "the draft is now a folder" is said only when it moved.
- **Rationale**: the git decision, amended meanwhile, writes drafts on the default branch from every
  tool and checkout. Before, the link went into the other checkout's copy, which links an image it
  does not hold.
- **Alternatives considered**: refusing the command outside the default branch's checkout (the human
  chose acting from anywhere, for the Neovim plugin's other commands).
- **If wrong**: `attach_image` in `crates/lsp/src/commands/attach.rs`, and `M.image` in
  `editors/nvim/lua/uraeda/actions.lua`.
- **Where**: the catch-up with the default branch, 3f2be17.

## R89: The validation runs a bare `cargo test`

- **Decision**: the feature's Rust tests run with `cargo test`, through the workspace's
  `default-members`, and the binding's from TypeScript, as `vp run ready` does; the image tests of
  the core and the language server need no other member.
- **Rationale**: the toolchain decision, amended meanwhile, makes `cargo test --workspace`
  unsupported.
- **Alternatives considered**: none.
- **If wrong**: `package.json`'s `ready`.
- **Where**: the catch-up with the default branch.

## R90: `afterOverlayCloses` waits for the Backs under way

- **Decision**: the default branch's `afterOverlayCloses`, which the repository menu uses to open
  the add form, or a page, once the menu's history entry is gone, lives with `useBackCloses` and
  waits for the page's pending Backs as the overlays do (R58), instead of listening to `popstate` on
  its own.
- **Rationale**: both answer the same race, a Back still under way as the next overlay opens; with
  two listeners, the order of their `popstate` handlers decided which overlay took which entry, and
  a Back on the add form left the page. One count of the Backs under way serves both.
- **Alternatives considered**: the default branch's overlay without the count (the lightbox's and
  the forms' races of R58 come back).
- **If wrong**: `packages/web/src/layout/useBackCloses.ts`.
- **Where**: the catch-up with the default branch, 12a155d, found by the browser tests.

## R91: The spec moves to the human-first layout, its text unchanged

- **Decision**: the approved spec's sections move to the template's order merged meanwhile: its
  Approach becomes the Architecture section, Mockups follows it, and Data, Components, Error
  handling, and Testing go under Details at the end. No word of the spec changes; the links to its
  Approach and Design, in the spec, the plan, and the attachments decision, point to its
  Architecture, and the first discovery round's link to the skill's Markdown rules points to the
  conventions reference, where they moved.
- **Rationale**: `ura check`, in the default branch's validation, checks every spec against the
  template, as the code quality feature did for its own spec. The approval stands: only headings
  move.
- **Alternatives considered**: leaving the spec in its old layout (the validation fails).
- **If wrong**: `specs/2026-10-13-image-attachments/spec.md`.
- **Where**: the catch-up with the default branch.
