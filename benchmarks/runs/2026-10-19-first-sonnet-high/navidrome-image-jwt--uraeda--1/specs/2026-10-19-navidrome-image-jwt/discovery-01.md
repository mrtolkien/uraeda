# Discovery, round 01: Remove size from public image ID JWT

## Summary

Navidrome serves artist images at a public URL, `/img/{jwt}`, without a login. The token is a JWT
signed with the server secret. Today its claims are `id` (the artwork ID, like `ar-1234`) and `size`
(pixels). The proposal removes `size` from the token. The token then carries only `id`, and the size
travels as an HTTP query parameter. It adds two public functions, `EncodeArtworkID` and
`DecodeArtworkID`, in `core/artwork/artwork.go`. It also asks that resizing keeps the source format,
so a PNG stays a PNG. The code already does the last part: a test covers it at sizes 300 and 200.

## How other products do it

Not researched: the proposal's discovery level is the default, but the feature is a small internal
refactor of one signed token with a fixed interface. The proposal states the target design. See
[Not checked](#not-checked).

### What they have in common

Not researched, same reason.

## Standards and libraries

### JWT libraries in use

- [`go.mod`](/go.mod) pins `github.com/go-chi/jwtauth/v5 v5.1.0` and
  `github.com/lestrrat-go/jwx/v2 v2.0.8`.
- `jwtauth.JWTAuth.Decode` parses with `jwt.WithValidate(false)`, so it verifies the signature but
  not the claims. `jwtauth.VerifyToken` then adds `jwt.Validate` and maps errors with `ErrorReason`
  (`/go/pkg/mod/github.com/go-chi/jwtauth/v5@v5.1.0/jwtauth.go`, lines 98 to 141).
- jwx defines `errInvalidJWT = errors.New("invalid JWT")` (`jwx/v2@v2.0.8/jwt/jwt.go`, line 20).
  Gomega's `MatchError("text")` compares the whole error message, so the requirement's
  `MatchError("invalid JWT")` needs the error text to be exactly that. Whether `"xx-123"` yields
  exactly that text through `jwtauth` is not checked: see [Not checked](#not-checked).

## The code

### Important reads

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink(artID, size)` builds the token
  with claims `id` and `size` through `auth.CreatePublicToken`, and ignores the error.
  `Artwork.Get(ctx, id, size)` already takes the size separately.
- [`core/auth/auth.go`](/core/auth/auth.go): `CreatePublicToken` adds the issuer and issued-at
  claims to the given claims. `Validate` exists for session tokens and returns a claims map.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): `jwtVerifier` verifies
  the signature. `validator` requires claims `id` and `size`, and answers 404 otherwise.
  `handleImages` reads `id` and `size` from the claims, and answers 400 when either is not the
  expected type.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go) line 116:
  `artistCoverArtURL(r, artID, size)` calls `PublicLink` and joins the token to
  `consts.URLPathPublicImages`. Its only caller passes size 0 (`toArtistID3`).
- [`server/subsonic/media_retrieval.go`](/server/subsonic/media_retrieval.go): `GetCoverArt` reads
  `size` with `utils.ParamInt(r, "size", 0)`, with no upper limit.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `resizeImage` detects the
  source format with `http.DetectContentType` and encodes PNG for PNG, JPEG otherwise.
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go) lines 173 to
  205: tests "returns a PNG if original image is a PNG" (size 300) and the JPEG case (size 200). The
  requirement's size 15 is not covered yet.
- [`model/artwork_id.go`](/model/artwork_id.go): `ParseArtworkID("")` fails with the exact message
  `invalid artwork id`. `ArtworkID.String()` returns `""` for an empty `ID`, so
  `EncodeArtworkID(model.ArtworkID{})` yields a token whose `id` claim is `""`, which matches the
  requirement's empty-ID example.

### The proposal's path and existing actions

- Today a client asks the Subsonic API for an artist. The response holds `artistImageUrl`, built by
  `artistCoverArtURL` with size 0. The client fetches `/img/{jwt}`.
- Responses are cached for ten years (`cache-control: public, max-age=315360000`), so clients and
  proxies may hold URLs with old tokens, which carry a `size` claim.
- With the change, an old token still verifies. Its `size` claim is no longer read by the new code
  unless the handler is told to.
- A token without an `id` claim: today the validator answers 404. The requirement says
  `DecodeArtworkID` returns an error for it.
- A token whose `id` is not a string: `handleImages` answers 400 today. The requirement says
  `DecodeArtworkID` returns an error for an invalid ID type.

### Rules and their owners

- Token claims: written by `PublicLink`, required by `validator`, read by `handleImages`. Three
  places know the claim names. After the change, the artwork package owns both writing and reading.
- Size parsing: `GetCoverArt` owns the Subsonic rule, `utils.ParamInt(r, "size", 0)`. The public
  endpoint would need the same rule.

### Likely changes

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): add `EncodeArtworkID` and
  `DecodeArtworkID`, and remove `PublicLink`, or keep it as a wrapper (see
  [Public link helper](#public-link-helper)).
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): decode with
  `DecodeArtworkID`, read the size from the query, and drop the `size` requirement. With option A of
  [Size in the URL](#size-in-the-url) it also validates the query value.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL` uses the new
  function, and appends the size as a query parameter when it is above 0.
- Tests: [`core/artwork`](/core/artwork) gets a round-trip test and error tests. The resize test
  gets a size 15 case.

## The proposal

### Size travels as a query parameter, with no name given

The proposal says size "should be handled separately as an HTTP query parameter" but never names the
parameter or the bounds. The Subsonic API calls it `size`, in
[`GetCoverArt`](/server/subsonic/media_retrieval.go). The name is a choice to settle.

### Unsigned size on a public endpoint

Today an attacker holding one image URL cannot change its size: the size is signed. After the
change, anyone with a valid token can request any size. Each distinct size creates a new cache entry
in the image cache ([`core/artwork/image_cache.go`](/core/artwork/image_cache.go)), and a very large
size makes the server resize to a very large image. This is a guard the change relaxes.

### Old tokens

Tokens already issued carry `size`. The proposal does not say what happens to them.

### "Unauthorized" errors

`DecodeArtworkID` must return an error when the token is "unauthorized". `jwtauth` has
`ErrUnauthorized`, returned by `VerifyToken` when no token results. How it applies to `Decode` is
settled in the plan.

## Worth it and feasibility

The change is small: two functions, one handler, one helper, and tests. It removes a claim and a
coupling, and it relies on nothing new. One guard loosens: the size is no longer signed. An attacker
who knows one image URL could then request that image at any size. The server would spend time and
cache space resizing each one.

Outside behaviour it relies on:

- The exact error text jwx gives for `"xx-123"` through `jwtauth.Decode` is unverified.
- That a token with `jwt.WithValidate(false)` still yields a usable claims map: read in source, not
  run.

## Approaches

Criteria come from [the proposal](proposal.md), and the [constitution](/specs/CONSTITUTION.md): keep
every requirement and interface as written, and add nothing the proposal does not ask for. There are
no active decisions.

### Size in the URL

The public endpoint must now read a size that is no longer signed. See
[Unsigned size on a public endpoint](#unsigned-size-on-a-public-endpoint).

| Option                                                      | Matches proposal | Abuse resistance | Extra code |
| ----------------------------------------------------------- | ---------------- | ---------------- | ---------- |
| A. `size` query parameter, same rule as `GetCoverArt`       | yes              | none             | none       |
| B. A, plus a maximum size, above which the request fails    | yes, and more    | bounded          | a constant |
| C. A, plus the server only resizes to a fixed list of sizes | yes, and more    | strong           | a list     |

### Old tokens

| Option                                                                | Matches proposal | Old URLs keep working | Extra code |
| --------------------------------------------------------------------- | ---------------- | --------------------- | ---------- |
| A. Accept them, and ignore their `size` claim (original size served)  | yes              | yes, at full size     | none       |
| B. Reject them                                                        | yes              | no, they answer 404   | none       |
| C. Accept them, and use their `size` claim when no query size is sent | partly           | yes, same size        | a branch   |

### Public link helper

- A. Replace `PublicLink` with `EncodeArtworkID`: the interface names only the new functions.
- B. Keep `PublicLink(artID, size)` as a wrapper. It would return a token with no size, so its
  second parameter would be misleading.

### Needs no choice

- **Resize format**: already kept. A test at size 15 is added.
- **Error cases of `DecodeArtworkID`**: fixed by the requirements.

## Not checked

- Other products' handling of signed or unsigned image sizes: not researched. The proposal fixes the
  design, and nothing in the repository depends on it.
- The exact message of the error `jwtauth.Decode` returns for `"xx-123"`: not run. The plan's first
  task checks it with a test.
- Tests were not run: the Go module cache is read-only in this session.
