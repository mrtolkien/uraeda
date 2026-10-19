---
status: answered
---

# Clarifications, round 01: Remove size from public image ID JWT

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, because it is small and the proposal's requirements fit the
>   code.
> - Public image size: once size leaves the token, anyone holding a link can ask for any size.
> - Old links: tokens already issued still carry a size, and clients may cache them for years.
> - Gap in the proposal: it says size becomes a query parameter, but lists no requirement for who
>   reads it.
> - Settled points to check: the old token builder is removed, and no new rule rejects old tokens.

## Context

### Goal

Public image links hold a signed token. The token should carry only which artwork it is, not how big
the image is. Size becomes a plain query parameter, so the token no longer mixes identity with
presentation.

### Today

- [`PublicLink`](/core/artwork/artwork.go) signs `id` and `size` into the token.
- [`handleImages`](/server/public/public_endpoints.go) reads both claims, and answers 404 when
  either is missing.
- The only caller, [`artistCoverArtURL`](/server/subsonic/helpers.go), always passes size `0`.
- The Subsonic [`GetCoverArt`](/server/subsonic/media_retrieval.go) already takes `size` as a query
  parameter, with no upper bound.
- Resizing already keeps a PNG as a PNG, in [`resizeImage`](/core/artwork/reader_resized.go).

### Scope

- Covers: `EncodeArtworkID` and `DecodeArtworkID`, the public endpoint, the link builder, and tests,
  including a PNG resized to 15.
- Leaves out: any change to the Subsonic endpoints, to token expiry, or to the image cache.

### Sources

- The code linked above, and the pinned JWT libraries in [`go.mod`](/go.mod).
- The proposal forbids consulting existing solutions, so no products were compared. The full
  investigation is in [discovery](discovery-01.md).

## Q1: Should public image links be able to carry a size?

The proposal says size is "handled separately as an HTTP query parameter", but its requirements only
name the encoder, the decoder, and PNG resizing. After the change, the endpoint no longer gets a
size from the token. Today every link is built with size 0, so users see no change in the first two
options. More in [discovery](discovery-01.md#where-the-size-goes).

Why it matters: it decides whether public images can still be served resized, and whether the link
builder gains a way to ask for a size.

- **A (recommended). The public endpoint reads an optional `size` query parameter, defaulting to 0,
  and the link builder appends `?size=N` when N is above 0.**
  - [pro] keeps resizing available to public links, as the proposal describes.
  - [pro] current links, built with size 0, stay the same.
  - [con] a small addition to the link builder that nothing calls with a size yet.
  - Why recommended: it follows the proposal's sentence about the query parameter with the least
    code.
- **B. The public endpoint reads an optional `size` query parameter, but the link builder never
  appends one.**
  - [pro] the smallest change.
  - [con] a caller that wants a resized public image has to build the URL itself.
- **C. The public endpoint ignores size and always serves the original image.**
  - [pro] removes the guard concern of Q2.
  - [con] contradicts the proposal's query parameter, and drops resizing from public images.

**Answer:** A: size handled separately as an HTTP query parameter

## Q2: Should the public endpoint cap the requested size?

Any size is now allowed, and the endpoint needs no login. Someone with one link could request the
same image at many sizes. Each size is resized by the server, and each result is a separate file in
the [image cache](/core/artwork/image_cache.go). Subsonic's `getCoverArt` already has this property,
but only for logged-in users. Only matters if you picked A or B in Q1. More in
[discovery](discovery-01.md#limiting-the-size).

Why it matters: it decides whether a stranger who holds a link could fill the server's image cache
and keep its CPU busy.

- **A (recommended). No cap, the same as `getCoverArt`.**
  - [pro] adds no rule the proposal does not ask for, as the constitution requires.
  - [pro] one behaviour for both endpoints.
  - [con] anyone holding a link can make the server resize one image to many sizes.
  - Why recommended: the proposal asks for no cap, and the cache already evicts old files.
- **B. Reject public sizes above a fixed maximum, such as 2000 pixels, with a 400 answer.**
  - [pro] bounds the cost of each request.
  - [con] a new rule and a new number to choose, which the proposal does not ask for. It does not
    bound how many distinct sizes below the cap are requested.

**Answer:** A: your call, no cap, proposal asks for none

## Q3: What should happen to links already issued with a size claim?

Existing tokens carry `id` and `size`. The new decoder requires only `id`, so they still verify. The
response is cached for 10 years (`max-age=315360000`), so clients may keep these URLs. All of them
were built with size 0. More in [discovery](discovery-01.md#tokens-already-issued).

Why it matters: it decides whether links people already hold keep working.

- **A (recommended). Accept them, and ignore their `size` claim.**
  - [pro] old links keep working, with no code for them.
  - [con] a link built for a size would now serve the original, though none was built that way.
  - Why recommended: all existing links used size 0, so they behave the same.
- **B. Reject tokens that still carry a `size` claim.**
  - [pro] the token format is strictly the new one.
  - [con] breaks every old link, and adds a rule the proposal does not ask for.

**Answer:** A: your call, accept and ignore size

## Settled without the human

### Check these

- **The old token builder** `PublicLink` is replaced by `EncodeArtworkID`, and its one caller is
  updated, because keeping a wrapper that ignores its size argument would mislead. See
  [discovery](discovery-01.md#what-happens-to-publiclink).
- **Invalid-token errors** wrap the library's error with the text "invalid JWT", and an unparseable
  ID with "invalid artwork id", as the proposal fixes. The other failures (missing `id`, non-string
  `id`) get their own messages. See
  [discovery](discovery-01.md#unauthorized-and-invalid-id-type-errors).

### Behaviour

- **A missing or bad token** on the public endpoint still answers 404, as today. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A missing `size` query parameter** means the original size, the same as size 0 today.

### Under the hood

- **PNG preservation** is already implemented, so the work is a test resizing a PNG to 15 and
  checking a 15 by 15 PNG. See [discovery](discovery-01.md#resizing-needs-no-code-change).
- **Tests** cover the round trip, `"xx-123"`, an encoded empty ID, and a token without `id`, to
  satisfy the constitution's rule on acceptance tests.

**Notes:**
