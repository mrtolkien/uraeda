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

## R8: A draft's priorities entry keeps its text when it becomes a folder

- **Decision**: only the link target of the entry that links the draft changes, from
  `drafts/<slug>.md` to `drafts/<slug>/proposal.md`.
- **Rationale**: `priorities::link` rewrites the whole entry from its plain text, which would drop
  the human's inline markdown.
- **Alternatives considered**: reusing `priorities::link`.
- **If wrong**: an entry with the same link twice would get both replaced; entries link a draft
  once.
- **Where**: task 2.

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
