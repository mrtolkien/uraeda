---
kind: feature
finished: 2026-10-19
---

# Record: Remove size from public image ID JWT

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, on the branch `2026-10-19-navidrome-image-jwt`. Its full files are in git:
> `git log -- specs/2026-10-19-navidrome-image-jwt/`.

## What and why

Subsonic clients get public links to artist images, `/p/img/<token>`, which open without logging in.
The token, a signed JWT, carried the artwork ID and the image size, which tied the image's identity
to how it is shown. The proposal asked for a token holding the artwork ID alone, with the size as an
HTTP query parameter, through two new functions, `artwork.EncodeArtworkID` and
`artwork.DecodeArtworkID`, and for PNG sources to stay PNG when resized, down to 15 pixels.

## Behaviour

- A public image token holds only the `id` claim, the artwork ID as a string, besides `iss` and
  `iat`. Decoding returns the same `model.ArtworkID`, and fails with `invalid JWT` for any token
  that does not verify (malformed, another secret, expired), with jwx's required-claim error when
  `id` is missing, `invalid id type` when `id` is not a string, and `ParseArtworkID`'s own error,
  such as `invalid artwork id`, unwrapped.
- The public endpoint, `/p/img/{jwt}`, reads the token from the path only, and answers 404 for any
  token that cannot be decoded, a session token included. It reads `size` from the query exactly as
  `getCoverArt` does, with `utils.ParamInt`, with no cap: missing, malformed, zero, or negative
  serves the original image. It still answers 404 `Artwork not found`, 500 for a failing image, and
  keeps its 10 second timeout and its `cache-control` and `last-modified` headers.
- Links issued before the feature keep working: their `size` claim, always 0, is ignored, and a
  `?size=` added to them is honoured.
- `artistImageUrl` keeps its shape, `/p/img/<token>`; the link helper adds `?size=<n>` only for a
  size above 0, after the absolute URL is built.
- An image under 512 bytes can be read and resized: a PNG resized to 15 pixels is a 15 by 15 PNG,
  and JPEG resizes stay JPEG. An empty image still fails to decode and is served as is.
- Anyone holding one public image link can have the image resized to any size, as the human chose: a
  size like 30000 costs gigabytes of memory per request, as it already did for `getCoverArt`.

## Design

The token's rules live in one place, next to the artwork ID, and the endpoint calls them instead of
reading JWT claims itself.

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `EncodeArtworkID` signs the `id` claim with
  `auth.CreatePublicToken`. `DecodeArtworkID` verifies with jwtauth's `VerifyToken` and
  `auth.TokenAuth`, then requires and type-checks `id`. They replace `PublicLink`, removed.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): one route, with no JWT
  middleware and no `URLParamsMiddleware`. The token comes from `chi.URLParam`, so a client's own
  `?:jwt=` cannot replace the token of the path, as it could when the token was read from the query.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL` builds the link
  and its optional `?size=`.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `asImageReader` accepts a
  short peek ending in `io.EOF`, and still fails on any other error.

## Questions

### Round 01

#### Q1: Should the public endpoint accept any size from the query, or cap it?

**Answer:** A: accept any size from the `size` query parameter, read as `getCoverArt` reads it, with
no cap, and note the missing cap of both image endpoints in the inbox for a separate change.

#### Q2: Should the project record its code-quality checks as a decision?

**Answer:** A: record today's `.golangci.yml`, run by `make lint`, as the project's checks, with no
new linter, revisited in a year.

## Decisions

- [Code quality](/specs/decisions/code-quality.md): Go code passes `make lint`, with the linters
  `.golangci.yml` enables today, and features add no linter.

## Changes after approval

- `make lint` could not pass on the default branch before the feature: golangci-lint v1.50.1 panics
  under Go 1.20 and later, and under Go 1.19 fails on `core/agents/agents_test.go`, which uses names
  that no longer exist. The feature was linted with the same linters and configuration under Go
  1.19, skipping `core/agents`, and passed.
- The public router no longer uses `URLParamsMiddleware`: the token is read from the path.

## Follow-ups

Noted in the inbox:

- A size cap for both image endpoints, `getCoverArt` and the public link.
- Repairing `make lint`: the `core/agents` tests, and a golangci-lint that runs on current Go.
- Test gaps the final review found: the endpoint's session-token case passes because the test token
  is already expired; the required-claim check is masked by the string check; no test pins that
  `asImageReader` fails on errors other than `io.EOF`.
- The endpoint formats the decoded artwork ID back to a string for `Artwork.Get`, which parses it
  again.
