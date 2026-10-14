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
  rounded to one decimal, without a trailing `.0`.
- **Rationale**: the same unit for the limit and the message, so a file said to be "20 MB" is never
  refused as over 20 MB.
- **If wrong**: one constant.
- **Where**: task 1.

## R10: A WebP input is a photo when it holds lossy data

- **Decision**: a WebP input holding a `VP8 ` chunk is re-encoded lossy; one holding only `VP8L` is
  near-lossless.
- **Rationale**: the decision splits "lossy WebP" from the rest; the chunk names it without
  decoding.
- **If wrong**: one test row and one condition.
- **Where**: task 1.
