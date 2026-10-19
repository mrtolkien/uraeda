# Discovery, round 01: Remove size from public image ID JWT

## Why this round

This is the first round. The proposal is a pull request description, so its requirements name
functions and error messages, not a user-facing design.

## Summary

Navidrome gives out public artwork links, `/p/img/<token>`, that do not expire. The token is a
signed JWT carrying two claims: `id` (an artwork ID such as `ar-1234`) and `size`. Today the server
builds every such link with size 0, so the `size` claim never changes an image. The proposal moves
size out of the token and into a `size` HTTP query parameter, and adds `EncodeArtworkID` and
`DecodeArtworkID` to `core/artwork`.

Products that serve image links with a size usually sign the size too, so a link holder cannot pick
arbitrary sizes. imgproxy's processing options are part of the signed path
([imgproxy docs](https://docs.imgproxy.net/usage/processing), read as a search snippet only).
Cloudinary's strict transformations block unsigned on-the-fly transformations
([Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media), read as
a search snippet only). The proposal removes that signature, so the size limit has to come from
somewhere else. This is the main open question.

The code already resizes PNG sources as PNG, so that requirement is already met (see
[The code](#the-code)).

## How other products do it

### imgproxy

- Its processing options, including the resize size, are part of the URL path. A signature over the
  path lets the server reject changed options. Source:
  [imgproxy processing](https://docs.imgproxy.net/usage/processing), search snippet only.
- Signing is off by default. The docs recommend enabling it in production, because a signature stops
  anyone from editing the options. Source:
  [imgproxy configuration](https://docs.imgproxy.net/configuration), search snippet only.
- An unsigned mode exists, where the signature segment can hold any value. Source: same as above.

### Cloudinary

- Strict transformations block on-the-fly transformations unless they are allowed through eager
  transformations, signed URLs, or referral-domain sources. Source:
  [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media), search
  snippet only.
- Signing does not stop link sharing: anyone holding a signed URL can access the asset. Source: same
  as above.

### What they have in common

- Each signs the transformation, so a link holder cannot change the size.
- Each accepts that a shared link gives access to the asset itself.
- Neither offers an unsigned size with no limit by default.

### Subsonic and OpenSubsonic

- Navidrome's own Subsonic `getCoverArt` takes a `size` query parameter and passes it straight to
  the artwork reader ([media_retrieval.go](../../server/subsonic/media_retrieval.go#L55-L60)). It is
  authenticated, and the size is not capped there.
- The official Subsonic API page was not reached in the search, so its documented size behaviour is
  in **Not checked**.

## Standards and libraries

### jwtauth v5.1.0 and jwx v2.0.8

- Verification errors come back as `token is unauthorized`, not `invalid JWT` (checked by a
  throwaway program, outside the repository).
- `jwt.Validate` with a nil token panics with a nil pointer dereference (checked the same way). The
  current `validator` middleware calls `jwt.Validate` before it checks for a nil token:
  [public_endpoints.go](../../server/public/public_endpoints.go#L91-L103).
- A token with no `id` claim fails `jwt.WithRequiredClaim("id")` with
  `"id" not satisfied: required claim not found`. The same check for `size` also fails, as expected.

### Go image resizing

- `imaging.Resize` with one dimension set keeps the aspect ratio, so a non-square source resized to
  15 has its other side less than 15
  ([reader_resized.go](../../core/artwork/reader_resized.go#L77-L107)).
- The test fixture `tests/fixtures/front.png` is 16 by 16 (checked from its header). The 15 by 15
  requirement holds for it, and for every square source.

## The code

### Important reads

- [core/artwork/artwork.go](../../core/artwork/artwork.go#L112-L117): `PublicLink` builds the token
  with `id` and `size`. It is the only encoder.
- [server/public/public_endpoints.go](../../server/public/public_endpoints.go#L47-L103): the
  `/img/{jwt}` handler reads `id` and `size` from the claims, and the `validator` middleware
  requires both claims.
- [server/subsonic/helpers.go](../../server/subsonic/helpers.go#L116-L120): `artistCoverArtURL`
  calls `PublicLink(artID, 0)`. Every caller passes 0, so no link carries a size today.
- [model/artwork_id.go](../../model/artwork_id.go#L27-L55): `ArtworkID.String()` gives `""` for an
  empty ID and `kind-id` otherwise. `ParseArtworkID` returns `invalid artwork id` on failure.
- [core/auth/auth.go](../../core/auth/auth.go#L42-L48): `CreatePublicToken` adds `iss` and `iat`,
  and signs with HS256 through `TokenAuth`.
- [core/artwork/image_cache.go](../../core/artwork/image_cache.go#L14-L27): the cache key includes
  the size, so each size of an image is stored as its own file. The item limit is 0 (unlimited):
  [consts.go](../../consts/consts.go#L76).
- [server/middlewares.go](../../server/middlewares.go#L206-L225): `URLParamsMiddleware` copies the
  path parameter `:jwt` into the query. A `size` query parameter survives it unchanged.

### The proposal's path and existing actions

1. A subsonic response lists an artist with `artistImageUrl`, built by `artistCoverArtURL`.
2. A client fetches `/p/img/<token>`. `jwtVerifier` reads the token from the query, then `validator`
   checks the claims, then `handleImages` calls `artwork.Get(ctx, id, size)`.
3. With the proposal, step 2 reads `size` from the query, and the token has only `id`.

Existing actions that meet the feature:

- **Old tokens** that carry `size` keep verifying. With the new decode, their `size` claim is
  ignored. Since every existing link has size 0, they serve the same image as before.
- **An invalid or unknown `size` query value** has no current behaviour: the handler does not read
  the query yet.
- **A deleted artwork** returns 404 today, through `model.ErrNotFound`. Nothing changes.
- **Undo, delete, edit**: no stored data. Tokens are not saved, so nothing needs a migration.

### Rules and their owners

- Token validity (signature, required claims, ID parsing): today split between `jwtVerifier`,
  `validator`, and `handleImages`. The proposal moves it to `DecodeArtworkID`, which becomes the one
  home. The router should call it, and drop its own claim checks.
- Public link format: `PublicLink` in `core/artwork`, called from one place, `artistCoverArtURL`.
- Size limits: none today on public links. The Subsonic `getCoverArt` sets no limit either
  ([media_retrieval.go](../../server/subsonic/media_retrieval.go#L55-L60)).

### Likely changes

- `core/artwork/artwork.go`: replace `PublicLink` with `EncodeArtworkID` and add `DecodeArtworkID`.
- `server/public/public_endpoints.go`: call `DecodeArtworkID`, read `size` from the query, drop the
  `size` claim check. Depends on
  [the size question](clarifications-01.md#q1-how-should-the-public-image-link-limit-the-size-query-parameter).
- `server/subsonic/helpers.go`: drop the size argument of `artistCoverArtURL`'s call to the encoder.
- `core/artwork/artwork_internal_test.go` or a new test: the PNG 15 by 15 requirement, and the
  round-trip tests.
- `core/artwork/artwork_test.go` or a new suite: the decode error cases from the proposal.

Baseline: `go test ./core/artwork/ ./core/auth/` passes on the current branch. `server/public` has
no test files.

## The proposal

### The size query parameter has no limit

The proposal says size becomes "an HTTP query parameter". It does not say which values the server
accepts. Today a public link cannot choose a size, because the signed token holds it. After the
change, any holder of a link can ask for any size. See [Approaches: size limit](#size-limit).

### The `invalid JWT` message

The requirement needs the error message `invalid JWT` for `xx-123`. The library's own message is
`token is unauthorized`. The decode must return its own error, and the requirement is met by
wrapping, not by the library.

### Old tokens keep working

Tokens already in clients' hands carry `size`. The proposal does not say what happens to them. The
decode ignores extra claims, so they keep working. Since their size is always 0, nothing visible
changes.

### Resize to 15 for non-square sources

The requirement says a PNG resized to 15 has bounds 15 by 15. That holds for square sources. A wide
source keeps its aspect ratio, so its shorter side is less than 15. The proposal does not say which
the human wants.

## Worth it and feasibility

- **Cost**: small. Two functions, one handler, one helper, and tests. No stored data, no migration,
  no UI change. The web UI asks Subsonic for sizes, not public links.
- **Gain**: a shorter token, a single home for the decode rules, and an end to the nil-token panic
  in `validator`. Also size is no longer part of a link's identity.
- **Verdict**: worth building, with a change to the size rule. The gain holds only if a size limit
  is chosen, because the unsigned size is what the proposal relaxes.
- **Outside behaviour relied on**: the library's error messages and its nil panic, checked by the
  throwaway program. The PNG resize, checked by the fixture header and the existing test.

### Guards relaxed

- **The signed size.** Today a link holder cannot ask for another size. After the change, any holder
  of any public link can make the server resize that one image to any size, one cache file per size,
  and any number of resizes. An attacker could fill the image cache disk with sizes, or keep the
  server busy resizing very large images. The scope is one artwork per token. Tokens are in the
  Subsonic artist responses, which every logged-in user receives.

## Approaches

### Size limit

This topic follows the proposal's query-parameter design. Criteria: the proposal's wording, the
guard above, and the cost of the chosen limit.

| Option                          | Matches proposal wording | Limits cache growth | Limits CPU work    | Matches Subsonic today |
| ------------------------------- | ------------------------ | ------------------- | ------------------ | ---------------------- |
| Any size                        | yes                      | no                  | no                 | yes                    |
| Maximum size, larger means none | yes                      | partly              | yes, up to maximum | no                     |
| Fixed list of sizes             | yes                      | yes                 | yes                | no                     |
| No size on public links at all  | no                       | yes                 | yes                | no                     |

The table compares options against the same criteria. The choice is the human's; see the question.

### Needs no choice

- **Encoding**: `EncodeArtworkID` uses `ArtworkID.String()` as the `id` claim. The proposal's
  round-trip and empty-ID requirements follow from it.
- **Decode errors**: every verification failure returns `invalid JWT`; a bad or missing `id` or a
  bad artwork ID returns the existing messages. The proposal names them.
- **Nil token**: check the error before `jwt.Validate`.
- **PNG preservation**: already implemented; a test covers it.
- **Old tokens**: keep working and ignore `size`.
- **Subsonic link builder**: drop the size argument, since it is always 0.

## Not checked

- The Subsonic API's official definition of `getCoverArt`'s `size` behaviour: the search gave no
  official page.
- imgproxy and Cloudinary pages: only search snippets were read, not the full pages.
- The proposal forbids looking up existing solutions for this change, so none were consulted.
