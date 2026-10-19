---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Remove size from public image ID JWT

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve public image links that sign the artwork ID only, with the size in a `size` query
>   parameter. PNG images also resize down to 15 pixels.
> - New decision, for the whole project: the code-quality checks are today's `make lint`, with no
>   new linter, revisited on 2027-10-19.
> - Relaxed guard: anyone holding one public image link can have it resized to any size, as you
>   chose. A size like 30000 costs gigabytes of memory per request.
> - The missing cap on both image endpoints is noted in the inbox, for a separate change.
> - Old links keep working: every token issued so far carries size 0, which the decoder ignores.
> - Risk tier `high`, as it changes an endpoint open without login. The plan does not wait for your
>   review.

Navidrome gives Subsonic clients public links to artist images, which open without logging in. The
link's token, a signed JWT, carries the artwork ID and the image size today. This feature signs the
ID alone, and moves the size to a `size` query parameter, so one token serves every size. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Decisions

- **New: [Code quality](../decisions/code-quality.md)**. Go code passes `make lint`, with the
  linters `.golangci.yml` enables today, and features add no linter.

Relied on: no other decision is active in the project.

## User stories

### US1: Public image links sign the artwork ID only (P1)

A Subsonic client lists artists, and receives an `artistImageUrl` per artist. The token in that link
holds the artwork ID alone, and opening the link serves the original image, as today.

Key scenarios:

1. **Given** `model.NewArtworkID(model.KindArtistArtwork, "1234")`, **When** it is encoded with
   `EncodeArtworkID` and decoded with `DecodeArtworkID`, **Then** the result is that same ID. The
   decode returns no error, and the token's only claims are `id`, `iss`, and `iat`.
2. **Given** the string `xx-123`, **When** it is decoded with `DecodeArtworkID`, **Then** the error
   is `invalid JWT`.
3. **Given** a token encoded from the empty `model.ArtworkID{}`, **When** it is decoded, **Then**
   the error is `invalid artwork id`.

More scenarios:

1. **Given** a valid public token with no `id` claim, **When** it is decoded, **Then** it returns an
   error.
2. **Given** a valid public token whose `id` claim is the number `1234`, **When** it is decoded,
   **Then** the error is `invalid id type`.
3. **Given** a public image link to an artist's image, **When** a client opens it without a query,
   **Then** the endpoint answers 200 with the original image.
4. **Given** the path `/p/img/xx-123`, **When** a client opens it, **Then** the endpoint
   answers 404.
5. **Given** an artist listed by `getArtists`, **When** the response is built, **Then** its
   `artistImageUrl` is `/p/img/<token>`, with no query, as today.

### US2: Ask for a public image at a size (P1)

A client adds `?size=` to a public image link, and receives the image resized, from the same token.

Key scenarios:

1. **Given** a public link to a 600 by 600 pixel image, **When** a client opens it with `?size=300`,
   **Then** it receives the image at 300 by 300 pixels.
2. **Given** an old link, its token holding `id` `ar-1234` and `size` `0`, **When** a client opens
   it without a query, **Then** it receives the original image.

More scenarios:

1. **Given** a public image link, **When** a client opens it with `?size=abc`, **Then** it receives
   the original image.
2. **Given** `artistCoverArtURL` called with size `300`, **When** it builds the link, **Then** the
   link ends with `?size=300`.

### US3: A PNG image stays PNG when resized small (P2)

An image resized for a client keeps the PNG format of its source, down to a 15 pixel thumbnail.

Why this priority: it is part of the proposal, but the links work without it. It fixes small images,
which cannot be resized today.

Key scenarios:

1. **Given** the 16 pixel PNG fixture `tests/fixtures/front.png`, **When** it is resized to size
   `15`, **Then** the result is a PNG decoding to bounds of 15 by 15 pixels.
2. **Given** a 300 pixel resize of a JPEG source, **When** it is read back, **Then** it is a JPEG of
   300 pixels, as today.

## Architecture

The token's rules move into `core/artwork`, next to the artwork ID, in two functions the proposal
names. The public endpoint calls them instead of reading JWT claims itself, so the claim names live
in one place. The size is read exactly as `getCoverArt` reads it, with no cap, as you chose. See
[rules and their owners](discovery-01.md#rules-and-their-owners) in the discovery.

- **The public image token**, `EncodeArtworkID` and `DecodeArtworkID` in
  [`core/artwork/artwork.go`](/core/artwork/artwork.go), creates and reads public tokens. It owns
  the claims, the required `id`, and the error messages `invalid JWT` and `invalid id type`. It
  replaces `PublicLink`, which is removed.
- **The public endpoint**, in [`public_endpoints.go`](/server/public/public_endpoints.go), decodes
  the token from the path, reads `size` with [`utils.ParamInt`](/utils/request_helpers.go), and
  serves the image. It owns the status codes. Its two JWT middlewares are removed.
- **The URL helper**, `artistCoverArtURL` in [`helpers.go`](/server/subsonic/helpers.go), builds
  public image links. It owns the rule that `?size=` appears only for a size above 0.
- **The image reader**, `asImageReader` in [`reader_resized.go`](/core/artwork/reader_resized.go),
  detects an image's format from its first bytes. It now accepts an image shorter than 512 bytes.

Tradeoffs:

- The size is no longer signed: anyone holding a link chooses it, with no cap, until a separate
  change adds one.
- A token whose `id` is not a string answers 404 instead of 400, like every other unusable token.
- Images under 512 bytes, served unresized today, are now resized like any other.

## Edge cases

| Importance | Situation                                              | What happens                                     |
| ---------- | ------------------------------------------------------ | ------------------------------------------------ |
| High       | A link issued before the feature, with `size` 0        | the original image, as today                     |
| High       | A session token used as a public image token           | 404: it has no `id` claim                        |
| High       | A token signed with another secret, or altered         | 404, from the `invalid JWT` error                |
| Normal     | `?size=` missing, `0`, negative, or not a number       | the original image                               |
| Normal     | A very large size, like `?size=30000`                  | resized as asked: the cost the inbox note covers |
| Normal     | The artist the token names is no longer in the library | 404, `Artwork not found`, as today               |
| Niche      | An image that cannot be decoded at the requested size  | served as is, unresized, as today                |
| Niche      | An empty image, 0 bytes, asked at a size               | served as is: decoding fails, as today           |

## Success criteria

- **SC-001** (round trip): Every artwork kind's ID encodes and decodes back to itself.
- **SC-002** (claims): A token from `EncodeArtworkID` holds no `size` claim.
- **SC-003** (15 pixels): A 15 pixel resize of `front.png` is a PNG of 15 by 15 pixels.
- **SC-004** (lint): `make lint` passes on the branch.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- `DecodeArtworkID` verifies tokens with jwtauth's `VerifyToken` and the server's `auth.TokenAuth`,
  the same check the endpoint's middleware makes today
  ([go-chi/jwtauth](discovery-01.md#go-chijwtauth-v510)).
- The `?size=` query is appended after the absolute URL is built, so the path join never touches it
  ([`server.AbsoluteURL`](/server/server.go)).
- The endpoint keeps its 10 second timeout, and its `cache-control` and `last-modified` headers. It
  still answers 404 for a missing image, and 500 for a failing one.
- Reading an image under 512 bytes ends with `io.EOF`. The image reader accepts that error only, and
  still fails on any other ([Go standard library](discovery-01.md#go-standard-library)).
- No data migration: tokens are not stored by the server, and old links keep working, as the data
  model shows ([data model](data-model.md)).

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**High**: it changes how an endpoint open without login trusts its input, and relaxes a guard.
