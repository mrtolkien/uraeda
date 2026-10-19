# Discovery, round 01: Remove size from public image ID JWT

## Summary

Navidrome serves artist images to Subsonic clients through an unauthenticated public endpoint,
`/p/img/{jwt}`. The JWT, a signed token, is what lets the endpoint trust the request. Today the
token carries two claims, the artwork `id` and the image `size`. The proposal asks for a token that
carries only the `id`, with the size moved to an HTTP query parameter, `?size=`. It names two
functions, `artwork.EncodeArtworkID` and `artwork.DecodeArtworkID`, and requires PNG sources to stay
PNG when resized, down to a 15 pixel image.

Image services that sign their URLs, imgproxy and thumbor, sign the size on purpose. An unsigned
size lets anyone holding one link make the server resize the image to any size. Moving the size out
of the token relaxes that guard: this is the one choice of the feature with an impact beyond it.

The code is small and the change contained: one token creator, one endpoint, one URL helper. A
throwaway check found a bug in the way: an image under 512 bytes cannot be read back by
`asImageReader`, so a 15 pixel PNG fails the check the requirement describes.

## How other products do it

### imgproxy

- imgproxy signs the whole processing path, size included: "A signature is a URL-safe Base64-encoded
  HMAC digest of the rest of the path", where the path is
  `/%processing_options/%encoded_url.%extension`
  ([Signing a URL](https://docs.imgproxy.net/usage/signing_url)).
- Its reason is denial of service: signing exists "so an attacker won't be able to perform a
  denial-of-service attack by requesting multiple different image resizes", and is "highly
  recommended" in production (same page).

### thumbor

- thumbor's unsigned `/unsafe/` URLs let a malicious user "easily ask for other sizes in loops or
  worse", from `300x301` up to `9999x9999`. It calls this "URL Tampering"
  ([Security](https://thumbor.readthedocs.io/en/latest/security.html)).
- Its fix is an HMAC over the options and the image path, `300x200/smart/path/to/image.jpg`, so the
  size is signed (same page).

### Subsonic API

- `getCoverArt` takes `id`, required, and `size`, optional: "If specified, scale image to this
  size." No default and no maximum are given
  ([Subsonic API](https://www.subsonic.org/pages/api.jsp)).
- The page does not describe `artistImageUrl`, the field Navidrome fills with public image links
  (same page).

### What they have in common

- Image services that accept a size from the URL either sign it, or accept the resize cost of any
  size. Neither imgproxy nor thumbor documents a size cap as the defense: both rely on the
  signature.
- Clients expect a `size` query parameter that scales the image, as in Subsonic's `getCoverArt`.

## Standards and libraries

### go-chi/jwtauth v5.1.0

- [`VerifyToken`](https://github.com/go-chi/jwtauth/blob/v5.1.0/jwtauth.go) decodes and verifies a
  token string. Any decode failure is normalized by `ErrorReason`, mostly to `ErrUnauthorized`,
  "token is unauthorized". A nil token is also `ErrUnauthorized`. Read in the module cache,
  `jwtauth.go`.
- `Encode` sets each claim with `t.Set(k, v)`, so an empty string claim is stored, not dropped (same
  file).

### lestrrat-go/jwx v2.0.8

- `jwt.WithRequiredClaim(name)` is `WithValidator(IsRequired(name))`: `jwt.Validate` fails when the
  claim is absent ([options.go](https://github.com/lestrrat-go/jwx/blob/v2.0.8/jwt/options.go)). The
  current endpoint already uses it.
- Numeric claims come back as `float64`, which is why the endpoint casts `claims["size"]` to
  `float64` today ([public_endpoints.go](/server/public/public_endpoints.go)).

### Go standard library

- [`http.DetectContentType`](https://pkg.go.dev/net/http#DetectContentType) "considers at most the
  first 512 bytes of data".
- [`bufio.Reader.Peek`](https://pkg.go.dev/bufio#Reader.Peek): "If Peek returns fewer than n bytes,
  it also returns an error explaining why the read is short." On a short input that error is
  `io.EOF`.

## The code

### Important reads

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink(artID, size)` is the only
  creator of public tokens, with claims `id` and `size`. `Artwork.Get(ctx, id string, size int)`
  serves an image, resized when `size > 0`, original otherwise.
- [`core/auth/auth.go`](/core/auth/auth.go): `CreatePublicToken` adds `iss` and `iat` to the given
  claims and signs with the same secret as session tokens. Public tokens have no expiry. A session
  token has no `id` claim, so requiring `id` keeps it from opening images.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): the `/img/{jwt}` route.
  A `jwtVerifier` middleware decodes the token, a `validator` middleware requires `id` and `size`
  and answers 404 otherwise. The handler answers 400 when `id` is not a string or `size` not a
  number. It has no tests.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL(r, artID, size)`
  builds `/p/img/<token>` with `consts.URLPathPublicImages`. Its three callers all pass size `0`
  ([helpers.go](/server/subsonic/helpers.go), [searching.go](/server/subsonic/searching.go)).
- [`server/subsonic/media_retrieval.go`](/server/subsonic/media_retrieval.go): the authenticated
  `getCoverArt` reads `size` with `utils.ParamInt(r, "size", 0)`, with no cap.
  [`utils.ParamInt`](/utils/request_helpers.go) returns the default on a missing or malformed value.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `resizeImage` keeps PNG as
  PNG and encodes everything else as JPEG. `asImageReader` peeks 512 bytes and returns the error of
  a short peek. When resizing fails, the original image is returned as is.
- [`model/artwork_id.go`](/model/artwork_id.go): `ParseArtworkID("")` returns
  `errors.New("invalid artwork id")`, and an unknown kind `"invalid artwork kind"`.
  `ArtworkID{}.String()` is `""`.
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): the resize
  tests read the result back with `asImageReader`, for 300 and 200 pixels.
  [`tests/fixtures/front.png`](/tests/fixtures/front.png) is 16 by 16 pixels.
- `git log` on these files: the public endpoint came with 387acc5f, "Add public endpoint to expose
  images", and artist images moved behind it with 77a99a73.

### The proposal's path and existing actions

- **A client lists artists.** `toArtist`, `toArtistID3`, and search build `artistImageUrl` with
  size 0. With the feature, the token holds only `id`, and no `?size=` is added for size 0, so the
  URL keeps its shape.
- **A client opens the link.** The endpoint verifies the token, reads `id`, and calls `Artwork.Get`.
  With the feature, the size comes from `?size=`, unsigned.
- **A client opens an old link.** Every token issued so far has `size` 0. A decoder that ignores the
  `size` claim serves the original image, the same image as today.
- **A request with a broken token, or a session token.** Today: 404 from `validator`. A non-string
  `id` is 400 from the handler.
- **A resize of a small image.** A 15 pixel PNG of `front.png` is 86 bytes. A throwaway test,
  outside the repository's history and deleted after, showed `resizeImage` returns a valid 15 by 15
  PNG. `asImageReader` on that result fails with `EOF`. So does `resizeImage` on any source under
  512 bytes: such an image is served unresized today.

### Rules and their owners

- **What a public image token holds.** Written in `PublicLink`, read in the public endpoint's
  middlewares and handler: two copies of the claim names. With the feature, `EncodeArtworkID` and
  `DecodeArtworkID` own both sides in `core/artwork`.
- **How a size is read from a request.** `utils.ParamInt` in `getCoverArt`. The public endpoint
  would be its second user.

### Likely changes

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `EncodeArtworkID` and `DecodeArtworkID`
  replace `PublicLink`, under every option.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): the handler decodes
  with `DecodeArtworkID` and reads `?size=`. The two middlewares go away. With a size cap, the cap
  lives here.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL` adds `?size=`
  when the size is above 0.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `asImageReader` accepts an
  input shorter than 512 bytes.
- [`core/artwork/artwork_test.go`](/core/artwork/artwork_test.go) and
  [`artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): tests for the round trip,
  the errors, and the 15 pixel PNG.

## The proposal

### The PNG requirement fails on today's code

The proposal reads as if PNG resizing already works and must keep working. It does at 300 pixels. At
15 pixels the result is under 512 bytes, and `asImageReader` cannot read it, as
[the proposal's path](#the-proposals-path-and-existing-actions) shows. Meeting the requirement needs
a fix in `asImageReader`.

### The size becomes unsigned

The proposal calls the size in the token "potential security concerns", but moving it out has the
opposite effect on one point. Today only the server chooses the size, and it always chooses 0. After
the change, anyone holding a link chooses any size. See
[worth it and feasibility](#worth-it-and-feasibility).

### Behaviour the proposal leaves open

- The name of the query parameter: the proposal says "an HTTP query parameter", without a name.
  Subsonic uses `size`.
- What happens to `PublicLink`: the proposal names its replacement only.
- The status codes of the endpoint for each failure.

## Worth it and feasibility

- **Cost against gain.** About 60 lines of production code across four files, plus tests. The gain
  is a token that identifies the artwork alone, so one link serves every size, and a single home for
  the token's rules. Judgement: worth it.
- **Outside behaviour relied on.** jwtauth's decoding and jwx's required claim were read in the
  module cache, at the versions in [`go.mod`](/go.mod). The resize to 15 pixels was checked by the
  throwaway test above.
- **The guard it relaxes.** Anyone who holds one public image link could ask the server for that
  image at any size. Each new size costs a full decode and resize, and a new entry in the image
  cache. A very large size, like 30000, makes the server allocate several gigabytes for a single
  image, since `imaging.Resize` builds a full NRGBA bitmap, 4 bytes per pixel. Logged-in users can
  already do this through `getCoverArt`, which has no cap. Public links are handed only to logged-in
  clients, but they can be shared.

## Approaches

Criteria come from the proposal, the constitution's [principles I and II](/specs/CONSTITUTION.md)
(no feature beyond the task), and [principle III](/specs/CONSTITUTION.md) (explicit code that
follows the repository's patterns).

### Size on the public endpoint

How the endpoint treats the unsigned `?size=`. Relies on
[the guard it relaxes](#worth-it-and-feasibility) and [imgproxy](#imgproxy).

| Option                                       | Within the task | Resize abuse by a link holder  | Matches `getCoverArt` |
| -------------------------------------------- | --------------- | ------------------------------ | --------------------- |
| A. Accept any size, read with `ParamInt`     | yes             | open, as for logged-in users   | yes                   |
| B. Cap the size on the public endpoint       | adds a rule     | bounded memory, any size below | no                    |
| C. Sign the size in a second token parameter | no              | closed                         | no                    |

Option C undoes the proposal's goal and is listed for completeness.

### The cap

Only with option B of [size on the public endpoint](#size-on-the-public-endpoint).

| Option                                   | Client sees                | Cache entries |
| ---------------------------------------- | -------------------------- | ------------- |
| A. Clamp a size above the cap to the cap | a smaller image than asked | bounded sizes |
| B. Answer 400 above the cap              | an error                   | bounded sizes |

### Reading short images

How `asImageReader` handles an input under 512 bytes. Relies on
[the Go standard library](#go-standard-library).

| Option                                               | 15 pixel PNG | Change      |
| ---------------------------------------------------- | ------------ | ----------- |
| A. Accept a short peek ending in `io.EOF`            | works        | a few lines |
| B. Leave it, and test the resize with a larger image | fails        | none        |

### Code-quality checks

The project has no `specs/decisions/code-quality.md`. [`.golangci.yml`](/.golangci.yml) enables 25
linters, among them `gocyclo` at its default of 30. It has no function length or nesting limit:
`funlen` and `nestif` are not enabled.

| Option                                              | Within the task | New markers in code |
| --------------------------------------------------- | --------------- | ------------------- |
| A. Record today's `.golangci.yml` as the checks     | yes             | none                |
| B. Add `funlen` and `nestif`, at values today meets | no              | some, unmeasured    |
| C. Record that the project has no limits            | yes             | none                |

### Needs no choice

- **The query parameter's name**: Subsonic's `size`, read with `utils.ParamInt` like `getCoverArt`.
- **Old links**: every issued token has size 0, so ignoring the claim serves the same image.
- **`PublicLink`**: its only caller moves to `EncodeArtworkID`, so it has no reason to stay.
- **Status codes**: today's 404 for an unusable token covers every decode error.
- **The image cache**: its key already holds the size, `artID@size`, in
  [`reader_resized.go`](/core/artwork/reader_resized.go).

## Not checked

- Navidrome's own upstream code, pull requests, and issues for this change were deliberately not
  read: the proposal forbids looking up existing solutions.
- Whether Navidrome has released a version with the public endpoint: the repository has no tags. It
  does not matter here, since every issued token has size 0.
- `funlen` and `nestif` offenders were not measured: golangci-lint was not run.
