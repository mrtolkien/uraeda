---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Remove size from public image ID JWT

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve public image tokens that carry only the artwork ID, with the size sent as a `size`
>   query parameter.
> - **Unsigned size**: anyone holding one image URL can ask for any size, and make the server resize
>   and cache each one. There is no maximum, as you chose.
> - **Old image URLs**: tokens that still carry a size keep working, and serve the original image
>   unless a `size` parameter is sent.
> - **Link helper**: `PublicLink` is removed, and `EncodeArtworkID` replaces it.
> - **Risk tier**: medium, because it changes a public, unauthenticated endpoint. No decision is
>   created or changed.

Artist images are served without a login at `/img/{jwt}`. The token is signed with the server secret
and today holds the artwork ID and the size. This feature keeps only the ID in the token, and reads
the size from the query. Clients get the same images, and the token no longer depends on how an
image is displayed. See the [proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed. The specs folder holds no active decision.

Relied on:

| Decision | What it means for this spec |
| -------- | --------------------------- |
| None     | No active decision applies. |

## User stories

### US1: A token that holds only the artwork ID (P1)

A caller turns an artwork ID into a public token with `EncodeArtworkID`, and back with
`DecodeArtworkID`. The token has one claim, a string `id`, and no size.

Key scenarios:

1. **Given** the artist artwork ID `ar-1234`, **When** it is encoded then decoded, **Then** the same
   ID comes back with no error.
2. **Given** the token string `"xx-123"`, **When** it is decoded, **Then** the error reads
   `invalid JWT`.
3. **Given** the token of an empty `model.ArtworkID{}`, **When** it is decoded, **Then** the error
   reads `invalid artwork id`.
4. **Given** a validly signed token with no `id` claim, **When** it is decoded, **Then** an error is
   returned.

More scenarios:

1. **Given** a validly signed token whose `id` claim is the number 5, **When** it is decoded,
   **Then** an error is returned.
2. **Given** a token signed with another secret, **When** it is decoded, **Then** an error is
   returned.
3. **Given** an old token holding `id` `ar-1234` and `size` 300, **When** it is decoded, **Then**
   `ar-1234` comes back and the size is ignored.

### US2: The size travels in the URL (P1)

A client fetches `/img/{jwt}`, optionally with `?size=N`. The endpoint decodes the token, reads the
size like the Subsonic `getCoverArt` endpoint does, and returns the image. The URL helper for artist
images builds the token with `EncodeArtworkID`. Artist image URLs carry no `size` parameter, since
they are built with size 0.

Key scenarios:

1. **Given** a token for `ar-1234`, **When** `/img/{jwt}?size=200` is requested, **Then** the image
   is resized to 200 pixels.
2. **Given** the same token, **When** `/img/{jwt}` is requested with no `size`, **Then** the
   original image is returned.
3. **Given** a token that fails to decode, **When** `/img/{jwt}` is requested, **Then** the answer
   is 404.
4. **Given** an old token holding `size` 300, **When** `/img/{jwt}` is requested with no `size`,
   **Then** the original image is returned.

### US3: Resizing keeps the source format (P2)

A PNG source stays a PNG after resizing. The code already does this, so only a test is added.

Key scenarios:

1. **Given** a PNG source, **When** it is resized to 15, **Then** the result is a PNG that decodes
   to 15 by 15 pixels.

## Architecture

The token is written and read only in [`core/artwork`](/core/artwork/artwork.go), so the claim name
`id` has one home. The endpoint stops reading claims itself. See the
[discovery](discovery-01.md#the-code) for today's three places.

- **`EncodeArtworkID`** signs a token with one string claim, `id`, using `auth.CreatePublicToken`.
  It replaces `PublicLink`.
- **`DecodeArtworkID`** verifies the signature, requires the `id` claim as a string, and parses it
  with `model.ParseArtworkID`. It owns the error cases.
- **The public endpoint** passes the `:jwt` URL parameter to `DecodeArtworkID` and answers 404 on
  any error. It reads `size` with `utils.ParamInt(r, "size", 0)`, as `getCoverArt` does, and calls
  `Artwork.Get`. The claim-checking `validator` goes away.
- **The artist image URL helper** in [`server/subsonic/helpers.go`](/server/subsonic/helpers.go)
  calls `EncodeArtworkID`, and keeps its path.

Tradeoffs:

- The size is unsigned, so the public endpoint has no bound on sizes, like `getCoverArt` but without
  a login.
- Old tokens are accepted and their size is ignored, so a client holding an old sized URL gets the
  full image.

## Edge cases

| Importance | Situation                                             | What happens                                                               |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| High       | One URL requested with many different `size` values   | each size is resized and cached, with no limit                             |
| High       | An old token holding a `size` claim                   | it verifies, and the claim is ignored                                      |
| Normal     | A token with no `id`, or an `id` that is not a string | `DecodeArtworkID` errors, the endpoint answers 404                         |
| Normal     | `size` is not a whole number, or is negative          | handled as `getCoverArt` does, by the same helper                          |
| Niche      | `EncodeArtworkID` of an empty ID                      | the token holds `id` `""`, and decoding it fails with `invalid artwork id` |

## Success criteria

- **SC-001** (no size claim): A token from `EncodeArtworkID` holds the claim `id` and no `size`.
- **SC-002** (round trip): Encoding then decoding `ar-1234` returns the same ID.
- **SC-003** (PNG at 15): Resizing a PNG source to 15 returns a PNG of 15 by 15 pixels.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- The size is optional on the endpoint, and a missing `size` means the original image, as the answer
  on the size parameter chose.
- The error text `invalid JWT` for `"xx-123"` comes from the libraries and is not verified yet. The
  plan's first task checks it with a test. If the text differs, `DecodeArtworkID` wraps the error to
  give that exact text.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: it changes how a public, unauthenticated endpoint accepts its input, with no stored data
change.
