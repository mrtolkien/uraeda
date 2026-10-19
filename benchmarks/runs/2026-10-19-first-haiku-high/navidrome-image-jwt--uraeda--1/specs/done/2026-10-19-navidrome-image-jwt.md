---
kind: feature
finished: 2026-10-19
---

# Record: Remove size from public image ID JWT

> [!NOTE]
>
> The record of a finished feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19. Its pull request is not open yet: no tool here could open one, so its description is
> in the body of the finishing commit. Its full files are in git:
> `git log -- specs/2026-10-19-navidrome-image-jwt/`.

## What and why

Public artwork links, `/p/img/<token>`, carry a signed token. The token held the artwork's ID and an
image `size`, so a link fixed its image size, and the size was part of the link's identity. Every
link built today has size 0, so no link resized anything. This feature moves the size out of the
token into a `size` query parameter, so a link names only the artwork and a client sets the size it
shows. The size is capped at 1000 pixels, because a link holder can then ask for any size, and each
size is a file in the image cache.

## Behaviour

- An artist's public image keeps working: a link with no `size` serves the artwork as stored, and a
  link issued before this change, with a `size` claim, still verifies, and the claim is ignored.
- A client adds `size` to a link to get the artwork resized. The longer side becomes the size, the
  other side keeps the proportions, and the format is kept: a PNG stays a PNG, a JPEG a JPEG.
- A `size` above 1000, or one that is missing, zero, negative, or not a whole number, serves the
  original image with status `200 OK`. A size above the image enlarges it, as before.
- A link whose signature does not verify, has no `id` claim, or whose `id` is not an artwork ID gets
  `404 Not Found`. A link for a deleted artwork gets `404 Not Found` with "Artwork not found".
- An image that cannot be decoded for resizing is served as stored, at any size.
- Subsonic responses give each artist's image as one of these links, in `artistImageUrl`, built from
  the artwork ID alone.

## Design

A link is a plain identity, and each request carries its own presentation. The token has one claim,
`id`, and the size is a query parameter. The image cache and the resizer kept their design: the
cache already stores each size as its own file, and the resizer already keeps the format.

- Token encoding and decoding in [`core/artwork/artwork.go`](/core/artwork/artwork.go):
  `EncodeArtworkID` builds the link token, and `DecodeArtworkID` is the one check of token validity.
  Every verification failure is `invalid JWT`, and an unusable `id` is `invalid artwork id`.
- The public image route in
  [`server/public/public_endpoints.go`](/server/public/public_endpoints.go) decodes each link, reads
  the `size` query, and applies the size rule in `imageSize`. The earlier verifier and validator
  middlewares are gone: their checks live in `DecodeArtworkID`.
- The Subsonic link builder, [`artistCoverArtURL`](/server/subsonic/helpers.go), drops its size
  argument, since every caller passed 0.
- The resizer, [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go), needed one fix:
  an image under 512 bytes was never resized.

## Questions

### Round 01

#### Q1: How should the public image link limit the `size` query parameter?

**Answer:** A, the recommended option: sizes from 1 to 1000 pixels resize, and a larger size serves
the original image. The human left the choice to the agent, which took it.

## Decisions

No decision was created or changed.

## Changes after approval

- Images shorter than 512 bytes are resized as the spec says. Before, such an image was served at
  its original size, which broke the spec's rule for a small image.
- `DecodeArtworkID` returns `invalid artwork id` for every unusable `id`, including an unknown kind
  and an empty ID such as `ar-`. The message for a missing or non-string `id` claim is ours: the
  spec pins none.
- The size is read with a standard integer parse, so `+15` and `015` resize to 15.

## Follow-ups

- The lint command could not run: its golangci-lint version panics on the Go toolchain of this
  environment. `go vet` and `gofmt` are clean.
