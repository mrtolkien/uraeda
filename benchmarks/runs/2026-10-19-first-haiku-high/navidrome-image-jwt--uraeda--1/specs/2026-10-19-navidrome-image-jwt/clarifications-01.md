---
status: answered
---

# Clarifications, round 01: Remove size from public image ID JWT

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes, because the proposal lets any link holder pick the image
>   size.
> - The size limit for public image links: any size, a maximum, or a fixed list. It decides what a
>   shared link can cost the server.
> - Settled points to check: old links keep working and ignore their size, and a wide image keeps
>   its aspect ratio at size 15.

## Context

### Goal

Public artwork links should identify only the artwork. The size becomes an HTTP query parameter, so
a link no longer fixes the size of its image.

### Today

Each public link is a signed token with an artwork `id` and a `size`. Every link the server builds
today uses size 0, so no link resizes anything. The token is built in
[artwork.go](../../core/artwork/artwork.go#L112-L117), and checked in
[public_endpoints.go](../../server/public/public_endpoints.go#L91-L103).

### Scope

This round covers the size rule of the public image link, and the settled points of the change. It
leaves out the Subsonic `getCoverArt` endpoint, which already takes any size for logged-in users.

### Sources

- The code linked above, and
  [server/subsonic/helpers.go](../../server/subsonic/helpers.go#L116-L120).
- [imgproxy processing](https://docs.imgproxy.net/usage/processing) and
  [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media), read as
  search snippets only.
- The full investigation is in [discovery](discovery-01.md).

## Q1: How should the public image link limit the `size` query parameter?

Once the size leaves the token, anyone holding a public link can ask for any size. Each size is
stored as its own file in the image cache, and each resize costs CPU. Today a link cannot choose its
size. The Subsonic `getCoverArt` endpoint already accepts any size for logged-in users, with no
limit. See [the size limit](discovery-01.md#size-limit).

Why it matters: this decides how much one shared link can make the server store and compute. It is
the only open choice in the change, and it sets the rule for every public link.

- **A (recommended). Accept sizes up to a maximum of 1000 pixels, and return the original image for
  a larger size.**
  - [pro] keeps the `size` query parameter the proposal asks for, and bounds the cache and the
    resizing work.
  - [con] a fixed maximum is a number you may want to change later.
  - Why recommended: it closes the gap with the least change to the proposal.
- **B. Accept any size, as the Subsonic `getCoverArt` endpoint does today.**
  - [pro] matches the proposal's wording and the existing Subsonic endpoint.
  - [con] any holder of one link can fill the image cache with one file per size.
- **C. Accept only sizes from a fixed list.** Its follow-up, Q1.C, asks which sizes.
  - [pro] the cache holds a fixed number of files per image.
  - [con] clients that ask for other sizes get the original, and the list needs updating over time.

**Answer:** Your call; take the recommended A

### Q1.C: Which sizes are on the list?

Only if you picked C in Q1. The web UI asks for 300 pixels in its Subsonic cover requests
([AlbumDetails.js](../../ui/src/album/AlbumDetails.js#L215)).

Why it matters: the list sets the most files one image can produce in the cache, and which clients
get a resized image.

- **A (recommended). Only 300 pixels, the size the web UI asks for.**
  - [pro] the smallest cache, and the web UI's size is served.
  - [con] other clients that ask for other sizes receive the original image.
  - Why recommended: no size the code uses is left out.
- **B. 300 and 600 pixels, leaving room for larger screens.**
  - [pro] a larger screen gets a sharper image without the original's size.
  - [con] two files per image in the cache, and a size chosen without a client that asks for it.

**Answer:** Not applicable, A chosen in Q1

## Settled without the human

### Check these

- **Old links keep working.** Tokens with a `size` claim still verify, and the size is ignored,
  because every link the server builds today has size 0. See
  [discovery](discovery-01.md#needs-no-choice).
- **Resizing to 15 keeps the aspect ratio.** A square PNG becomes 15 by 15, as the proposal asks. A
  wide image keeps its proportions, so its shorter side is less than 15. See
  [discovery](discovery-01.md#standards-and-libraries).

### Behaviour

- **An invalid token always gets `invalid JWT`.** The library's own message is
  `token is unauthorized`, so the decode wraps it. See [discovery](discovery-01.md#needs-no-choice).
- **A missing or invalid `size` serves the original image.** No error is returned, as the size is
  optional. See [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **`PublicLink` is replaced by `EncodeArtworkID`.** The Subsonic helper drops its size argument,
  since it always passes 0. See [discovery](discovery-01.md#likely-changes).
- **The public router calls `DecodeArtworkID`** and drops its own claim checks. The nil-token panic
  goes away with them. See [discovery](discovery-01.md#rules-and-their-owners).
- **No stored data changes, and no migration is needed,** because tokens are never stored. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

**Notes:**
