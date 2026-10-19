# Discovery, round 01: Remove size from public image ID JWT

## Summary

Public image URLs are `/share/img/<jwt>` (see [`consts.URLPathPublicImages`](/consts/consts.go)).
The JWT is signed with the server secret, and holds an artwork `id` and a `size` claim. The proposal
asks for a token holding only the `id`, with two public functions, `EncodeArtworkID` and
`DecodeArtworkID`, in [`core/artwork/artwork.go`](/core/artwork/artwork.go). Size becomes an HTTP
query parameter. Today the only public link ever built uses size `0`. Resizing already keeps the
source format. The PNG requirement needs a test at size 15, not new code.

## How other products do it

Not researched: the proposal's constraints forbid consulting existing solutions or external pull
requests. The question of how products carry image size is settled by the repository's own Subsonic
endpoint, which already takes `size` as a query parameter (see
[the code](#the-proposals-path-and-existing-actions)).

## Standards and libraries

### JWT libraries

- [`go.mod`](/go.mod) pins `github.com/go-chi/jwtauth/v5 v5.1.0` and
  `github.com/lestrrat-go/jwx/v2 v2.0.8`.
- [`auth.Validate`](/core/auth/auth.go) already calls `jwtauth.VerifyToken(TokenAuth, tokenStr)` and
  returns the claims as a map. It returns an error for structurally invalid or badly signed tokens,
  so `"xx-123"` fails there. Its error text is not verified yet (see [Not checked](#not-checked)).
- [`auth.CreatePublicToken`](/core/auth/auth.go) adds the issuer and issued-at claims to the claims
  it is given, then signs. It sets no expiry.

## The code

### Important reads

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink(artID, size)` builds the token
  with `id` and `size`. It is the only token producer. `Get(ctx, id, size)` takes the size
  separately.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): `handleImages` reads
  `id` and `size` from the claims. `validator` requires both claims, answering 404 otherwise.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL(r, artID, size)`
  calls `PublicLink`. Its callers pass `0`.
- [`server/subsonic/media_retrieval.go`](/server/subsonic/media_retrieval.go): `GetCoverArt` reads
  `size` with `utils.ParamInt(r, "size", 0)`, with no upper bound.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `resizeImage` encodes PNG
  when the sniffed type is `image/png`, JPEG otherwise.
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): the existing
  PNG test resizes to 300, not 15.
- [`core/artwork/image_cache.go`](/core/artwork/image_cache.go): the cache key includes the size, so
  each distinct size is a separate cached file.
- `git log` on these files: the public endpoint was added in `387acc5f`, then artist images in
  `77a99a73`.

### The proposal's path and existing actions

- Creating a link: the Subsonic artist responses call `artistCoverArtURL`, which calls `PublicLink`.
  This changes to `EncodeArtworkID`.
- Opening a link: `jwtVerifier` verifies the token, `validator` requires claims, `handleImages`
  reads them. This changes to `DecodeArtworkID` plus a `size` query parameter.
- Tokens already issued: they carry a `size` claim. Under a decoder that only requires `id`, they
  still verify, and the extra claim is ignored. The response sets
  `cache-control: public, max-age=315360000`, so clients may keep old URLs for a long time.
- Invalid or empty IDs: encoding `model.ArtworkID{}` yields an `id` claim that does not parse, which
  the decoder must reject as "invalid artwork id".

### Rules and their owners

- Which claims a public token must hold: owned by `validator` and `handleImages` in the public
  router, and by `PublicLink`. The new functions become the single home, in `core/artwork`.

### Likely changes

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): add `EncodeArtworkID` and
  `DecodeArtworkID`. `PublicLink` is removed or kept, per
  [the first topic](#what-happens-to-publiclink).
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): decode with
  `DecodeArtworkID`, read `size` from the query, drop the `size` claim requirement.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): call the new encoder, and add `size`
  to the URL under option A of [where the size goes](#where-the-size-goes).
- [`core/artwork/artwork_test.go`](/core/artwork/artwork_test.go) and
  [`artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): tests for the round trip,
  the three error cases, and the PNG resize to 15.

## The proposal

### Who reads the size

The proposal says size is "handled separately as an HTTP query parameter", but its requirements list
only the encoder, the decoder, and PNG resizing. Once the `size` claim is gone, `handleImages` has
no size. Either it reads a query parameter, or it always serves the original image.

### "Unauthorized" and "invalid ID type" errors

The decoder must fail for an invalid or unauthorized token, a missing `id`, a non-string `id`, and
an unparseable ID. Only the invalid-JWT and invalid-artwork-id messages are fixed by the proposal.
The other messages are free.

### Resizing needs no code change

"Resizing must preserve the source format" already holds in `resizeImage`. The requirement then
reduces to a test of a PNG source resized to 15.

## Worth it and feasibility

The feature is small: one new pair of functions, one handler change, tests. It relies on nothing
new. The behaviour of `jwtauth.VerifyToken` on malformed input is read from the pinned library's
source and the existing `auth.Validate`, and is named as unverified in [Not checked](#not-checked)
until a test runs it.

Guard relaxed: today a link can only produce one size, chosen by the server when it creates the
link. With size as a query parameter, anyone holding a link can request any size. They could make
the server resize one image to many sizes, filling the image cache and using CPU. The Subsonic
`getCoverArt` endpoint already allows this to logged-in users, but the public endpoint does not
require a login.

## Approaches

Criteria come from [the proposal](proposal.md) (tokens hold only the id; size is a query parameter;
no feature beyond it) and the [constitution](/specs/CONSTITUTION.md) (principles II and III).

### What happens to PublicLink

`PublicLink` is the old token builder, with a size argument.

| Option                                                          | Matches proposal | Code left behind      |
| --------------------------------------------------------------- | ---------------- | --------------------- |
| A. Replace it with `EncodeArtworkID`, and update the one caller | yes              | none                  |
| B. Keep it as a wrapper that ignores its size                   | partly           | a misleading argument |

### Where the size goes

Only matters if public links should carry a size at all.

| Option                                                                                              | Matches proposal | Behaviour change                    |
| --------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------- |
| A. The public endpoint reads `?size=N` (default 0), and `artistCoverArtURL` appends it when above 0 | yes              | none for current callers, size 0    |
| B. The endpoint reads `?size=N`, but no link builder appends it                                     | yes              | none                                |
| C. The endpoint ignores size and always serves the original                                         | no               | removes resizing from public images |

### Limiting the size

| Option                                       | Matches proposal                          | Guard                                     |
| -------------------------------------------- | ----------------------------------------- | ----------------------------------------- |
| A. No limit, like `getCoverArt`              | yes                                       | anyone with a link can force many resizes |
| B. Reject public sizes above a fixed maximum | adds a rule the proposal does not ask for | bounds the cache and CPU use              |

### Tokens already issued

| Option                                        | Matches proposal | Cost                              |
| --------------------------------------------- | ---------------- | --------------------------------- |
| A. Accept them, and ignore their `size` claim | yes              | old links serve the original size |
| B. Reject tokens that still carry `size`      | adds a rule      | breaks old links                  |

### Needs no choice

- Resizing format preservation: already implemented, so only a test is added.

## Not checked

- The exact error text `jwtauth.VerifyToken` returns for `"xx-123"`. The requirement is that the
  decoder's error matches "invalid JWT", so the decoder may wrap the library's error. A test settles
  it.
- Online comparison of other products: skipped on purpose, per the proposal's constraint.
