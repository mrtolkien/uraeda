---
kind: feature
finished: 2026-10-19
---

# Record: Remove size from public image ID JWT

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19. Its full files are in git: `git log -- specs/2026-10-19-navidrome-image-jwt/`.

## What and why

Artist images are served without a login at `/img/{jwt}`. The token used to hold the artwork ID and
the size, which tied the identity of an image to how it is displayed. The token now holds only the
ID, and the size is a `size` query parameter.

## Behaviour

- A token has one string claim, `id`, written by `EncodeArtworkID` and read by `DecodeArtworkID` in
  [`core/artwork/artwork.go`](/core/artwork/artwork.go). A malformed token fails with `invalid JWT`,
  and an empty ID with `invalid artwork id`.
- `/img/{jwt}?size=N` resizes to N pixels, and a missing `size` returns the original image. The size
  is read like the Subsonic `getCoverArt` does, with no maximum, and a token that fails to decode
  answers 404.
- Old tokens that still carry `size` verify, and the claim is ignored.
- A PNG source stays a PNG after resizing, including at size 15.

## Design

The artwork package is the only place that knows the claim names.
[`handleImages`](/server/public/public_endpoints.go) decodes the token and reads the size, and the
signature and claim middlewares are gone. [`artistCoverArtURL`](/server/subsonic/helpers.go) builds
its link with `EncodeArtworkID`, and `PublicLink` is removed.

## Questions

### Round 01

#### Q1: How should the public image endpoint accept the size, now that it is not signed?

**Answer:** A, an optional `size` parameter like `getCoverArt`, with no maximum.

#### Q2: What happens to image URLs whose token already carries a size?

**Answer:** A, they are accepted and their `size` claim is ignored.

#### Q3: Is `size` the right name for the query parameter?

**Answer:** A, `size`.

## Changes after approval

- `DecodeArtworkID` decodes with the token auth's `Decode`, because the verifying helper gave
  `token is unauthorized` instead of `invalid JWT` for a malformed token.
- The image format detection now accepts images under 512 bytes, which a 15 pixel PNG is. Before,
  such an image lost its format.

## Follow-ups

- `artistCoverArtURL` still takes a `size` argument that it no longer uses.
