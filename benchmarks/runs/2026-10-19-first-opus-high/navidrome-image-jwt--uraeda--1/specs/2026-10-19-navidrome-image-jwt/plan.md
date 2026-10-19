---
status: auto-approved
spec-revision: 1
---

# Plan: Remove size from public image ID JWT

**Goal:** Public image tokens sign the artwork ID alone, the public endpoint reads the size from a
`size` query parameter, and a PNG resized down to 15 pixels can be read back.

**Architecture:** As in the [spec's architecture](spec.md#architecture). `core/artwork` owns the
public image token: `EncodeArtworkID` writes its only claim, `id`, and `DecodeArtworkID` owns every
check and error message. The public endpoint owns the status codes and reading `?size=`. The URL
helper owns the rule that `?size=` appears only for a size above 0. `asImageReader` owns format
detection, and accepts a short input. Nothing is stored: the token and the link formats are in the
[data model](data-model.md).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **An old token opened with `?size=300`** gets the image at 300 pixels: the token's `size` claim
   is ignored, and only the query counts. Task 2.
2. **A query that also names `:jwt`**, like `/p/img/<token>?:jwt=other`, still decodes the token in
   the path. Today the token is read from the query that `URLParamsMiddleware` fills, where a
   client's own `:jwt` comes first. Task 2.
3. **A token signed with an expiry in the past** answers 404: `DecodeArtworkID` keeps jwtauth's
   verification, which checks `exp`. Task 1.
4. **A source image under 512 bytes** is now resized, since the 15 pixel fix applies to sources too,
   as the spec's tradeoffs say. Task 4.

## Global constraints

The approved rules and existing guarantees the change must preserve, with their sources. Every
task's requirements include these:

- `EncodeArtworkID(artID model.ArtworkID) string` "must transform a `model.ArtworkID` into a public
  token string that encodes only the artwork's `id` value (as a string `id` claim) and does not
  include image size information" ([proposal](proposal.md)).
- `DecodeArtworkID(tokenString string) (model.ArtworkID, error)` "must decode a provided token
  string, require an `id` claim, verify that the claim is a string, parse it into a
  `model.ArtworkID`, and return an error when the token is invalid, unauthorized, missing the
  required claim, has an invalid ID type, or contains an invalid artwork ID"
  ([proposal](proposal.md)).
- Error texts: "Any decode failure, or a nil token, returns `invalid JWT`. The `id` claim is
  required with jwx's `WithRequiredClaim`. A non-string claim returns `invalid id type`.
  `ParseArtworkID`'s own error, `invalid artwork id` for an empty id, passes through unwrapped"
  ([clarifications](clarifications-01.md#under-the-hood)).
- "The size parameter is named `size`, like Subsonic's `getCoverArt`. A missing, malformed, or zero
  value serves the original image, as `utils.ParamInt` does there"
  ([clarifications](clarifications-01.md#behaviour)). No cap: Q1 was answered A.
- "The URL helper adds `?size=` only for a size above 0"
  ([clarifications](clarifications-01.md#behaviour)), appended after the absolute URL is built
  ([spec](spec.md#assumptions)).
- "The endpoint keeps its 10 second timeout, and its `cache-control` and `last-modified` headers. It
  still answers 404 for a missing image, and 500 for a failing one" ([spec](spec.md#assumptions)).
  Every token that cannot be decoded answers 404.
- "Reading an image under 512 bytes ends with `io.EOF`. The image reader accepts that error only,
  and still fails on any other" ([spec](spec.md#assumptions)).
- `PublicLink` is removed ([spec](spec.md#architecture)).
- From the [code-quality decision](/specs/decisions/code-quality.md): "Go code MUST pass
  `make lint`, with the linters `.golangci.yml` enables." "A function's cyclomatic complexity MUST
  NOT exceed 30, golangci-lint's default for `gocyclo`." "A feature MUST NOT add, remove, or
  reconfigure a linter of `.golangci.yml` unless its proposal or a human's answer asks for it."
  `make lint` cannot run in full on this repository today: the lint step of each task is the one in
  [R1](rulings.md).

## Code read

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink(artID, size)` signs `id` and
  `size` with `auth.CreatePublicToken`. `Artwork.Get(ctx, id, size)` resizes only when `size > 0`
  (`getArtworkReader`), so 0 and negative sizes serve the original.
- [`core/auth/auth.go`](/core/auth/auth.go): `CreatePublicToken` adds `iss` and `iat`, signs with
  `TokenAuth`, no expiry. `CreateToken` makes session tokens with `sub`, `uid`, `adm`, `exp`, and no
  `id`. `Validate(tokenStr)` returns a token's claims as a map.
- [`core/auth/auth_test.go`](/core/auth/auth_test.go): tests set `auth.Secret` and
  `auth.TokenAuth = jwtauth.New("HS256", auth.Secret, nil)` in a `BeforeEach`, the pattern every new
  test with tokens follows.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): the router, with
  `URLParamsMiddleware`, `jwtVerifier` reading the query's `:jwt`, and `validator` requiring `id`
  and `size`, then `handleImages`. No tests, no suite file.
- [`server/server.go`](/server/server.go): `URLParamsMiddleware` appends `:jwt=<token>` after the
  client's own query; `AbsoluteURL` joins host, `BaseURL`, and path with `path.Join`.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL`, called with size
  0 by `toArtist`, `toArtistID3`, and [`searching.go`](/server/subsonic/searching.go).
  [`helpers_test.go`](/server/subsonic/helpers_test.go) is an internal Ginkgo spec.
- [`utils/request_helpers.go`](/utils/request_helpers.go): `ParamInt(r, "size", 0)` returns 0 for a
  missing or malformed value, and a negative number as is.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go): `asImageReader` peeks 512
  bytes and returns any peek error; `resizeImage` keeps PNG and encodes the rest as JPEG; on a
  resize error the reader serves the original.
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): the
  `resizedArtworkReader` specs resize `front.png` (3949 bytes, 16 by 16) and `cover.jpg` through
  `aw.Get`, and read the result back with `asImageReader`.
  [`artwork_test.go`](/core/artwork/artwork_test.go) is the external `artwork_test` spec.
- [`model/artwork_id.go`](/model/artwork_id.go): `ArtworkID{}.String()` is `""`;
  `ParseArtworkID("")` returns `invalid artwork id`.
- Validation: `go test ./core/artwork/ ./server/...` (Go 1.24, Ginkgo suites per package).
  `make lint` panics under Go 1.24, and under Go 1.19 fails on `core/agents/agents_test.go`,
  unchanged since before this branch: see [R1](rulings.md).

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Abstraction or exception                        | Why it is needed                                                                  | Simpler alternative rejected because                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `fakeArtwork`, a test double in `server/public` | the endpoint's tests check the id and size it passes to `Artwork.Get`, and errors | a real `Artwork` needs a datastore with artists and image files for each case |

## Test map

The tests are Ginkgo specs next to the code. Token tests sign with a test secret set in a
`BeforeEach`. Endpoint tests serve requests through `public.New(fake).ServeHTTP` with `httptest`,
over a fake `Artwork`. Resize tests go through `aw.Get` on the mock datastore, with the image cache
off, as the existing ones do.

| Spec                                                      | Task | Test                                                              |
| --------------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| US1 key 1; SC-001                                         | 1    | `core/artwork/artwork_test.go`, round trip per kind               |
| US1 key 1 (claims); SC-002                                | 1    | `artwork_test.go`, claims are `id`, `iss`, `iat`                  |
| US1 key 2; edge: other secret or altered                  | 1, 2 | `artwork_test.go` `invalid JWT`; `public_endpoints_test.go` 404   |
| US1 key 3                                                 | 1    | `artwork_test.go`, `invalid artwork id`                           |
| US1 more 1; edge: session token                           | 1, 2 | `artwork_test.go` no `id`; `public_endpoints_test.go` session 404 |
| US1 more 2                                                | 1, 2 | `artwork_test.go` `invalid id type`; endpoint 404                 |
| US1 more 3                                                | 2    | `public_endpoints_test.go`, 200 with the image, size 0            |
| US1 more 4                                                | 2    | `public_endpoints_test.go`, `/img/xx-123` is 404                  |
| US1 more 5                                                | 3    | `server/subsonic/helpers_test.go`, size 0 has no query            |
| US2 key 1                                                 | 2, 4 | endpoint passes 300 to `Get`; existing 300 pixel PNG resize       |
| US2 key 2; edge: old link                                 | 1, 2 | `artwork_test.go` old token decodes; endpoint serves size 0       |
| US2 more 1; edge: size missing, 0, negative, not a number | 2    | `public_endpoints_test.go`, a table of queries                    |
| US2 more 2                                                | 3    | `helpers_test.go`, ends with `?size=300`                          |
| US3 key 1; SC-003                                         | 4    | `artwork_internal_test.go`, 15 pixel PNG                          |
| US3 key 2                                                 | 4    | `artwork_internal_test.go`, existing JPEG at 200 pixels, kept     |
| Edge: very large size                                     | 2    | `public_endpoints_test.go`, `?size=30000` passes 30000            |
| Edge: artist not in the library                           | 2    | `public_endpoints_test.go`, 404 `Artwork not found`               |
| Edge: image cannot be decoded; empty image                | 4    | `artwork_internal_test.go`, `resizeImage` of 0 bytes fails        |
| Error: `Get` fails                                        | 2    | `public_endpoints_test.go`, 500                                   |
| SC-004                                                    | all  | the lint step of each task, see [R1](rulings.md)                  |
| Review focus: old token with `?size=300`                  | 2    | `public_endpoints_test.go`                                        |
| Review focus: `:jwt` in the query                         | 2    | `public_endpoints_test.go`                                        |
| Review focus: expired token                               | 1    | `artwork_test.go`                                                 |
| Review focus: source under 512 bytes                      | 4    | `artwork_internal_test.go`                                        |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1 and 4: Task 1 adds the token functions to `artwork.go` and tests to `artwork_test.go`;
   Task 4 changes `reader_resized.go` and `artwork_internal_test.go`.
2. Tasks 2 and 3: both consume Task 1. Task 2 changes `server/public`; Task 3 changes
   `server/subsonic/helpers.go` and removes `PublicLink` from `artwork.go`, which Task 2 does not
   touch.

---

## Task 1: The public image token

**Risky:** it decides which tokens open images on an endpoint that needs no login.

**Files:**

- Modify: `core/artwork/artwork.go` (add `EncodeArtworkID`, `DecodeArtworkID`; keep `PublicLink` for
  Task 3 to remove)
- Test: `core/artwork/artwork_test.go`

**Interfaces:**

- Consumes: nothing new.
- Produces: `func EncodeArtworkID(artID model.ArtworkID) string`, and
  `func DecodeArtworkID(tokenString string) (model.ArtworkID, error)`, in package `artwork`. Both
  use `auth.TokenAuth`, which must be initialized.

- [x] **Step 1: Write the failing tests**

In `artwork_test.go`, a new `Describe("Public image token")`, whose `BeforeEach` sets
`auth.Secret = []byte("test secret")` and `auth.TokenAuth = jwtauth.New("HS256", auth.Secret, nil)`:

```go
DescribeTable("round trips every artwork kind",
	func(kind model.Kind) {
		artID := model.NewArtworkID(kind, "1234")
		decoded, err := artwork.DecodeArtworkID(artwork.EncodeArtworkID(artID))
		Expect(err).ToNot(HaveOccurred())
		Expect(decoded).To(Equal(artID))
	},
	Entry("artist", model.KindArtistArtwork), Entry("album", model.KindAlbumArtwork),
	Entry("media file", model.KindMediaFileArtwork), Entry("playlist", model.KindPlaylistArtwork),
)
It("signs only the id, the issuer and the issue time", func() {
	claims, err := auth.Validate(artwork.EncodeArtworkID(model.NewArtworkID(model.KindArtistArtwork, "1234")))
	Expect(err).ToNot(HaveOccurred())
	Expect(claims).To(HaveLen(3))
	Expect(claims).To(HaveKeyWithValue("id", "ar-1234"))
	Expect(claims).To(HaveKey("iss"))
	Expect(claims).To(HaveKey("iat"))
})
It("decodes a token issued before the size moved out", func() { // claims id ar-1234, size 0
	// auth.CreatePublicToken(map[string]any{"id": "ar-1234", "size": 0}) decodes to ar-1234
})
It("fails with invalid JWT for a malformed token", func() {
	_, err := artwork.DecodeArtworkID("xx-123")
	Expect(err).To(MatchError("invalid JWT"))
})
// also, each with its own It:
// - a token signed with another secret: MatchError("invalid JWT")
// - a token with "exp" one hour in the past, from auth.CreatePublicToken: MatchError("invalid JWT")
// - EncodeArtworkID(model.ArtworkID{}): MatchError("invalid artwork id")
// - auth.CreatePublicToken(map[string]any{}): HaveOccurred()
// - auth.CreatePublicToken(map[string]any{"id": 1234}): MatchError("invalid id type")
```

The break each test catches:

- Round trip: a decoder that drops the kind prefix, or an encoder that signs `artID.ID` only.
- Claims: `size` left in the token.
- Old token: a decoder that rejects unknown claims, which breaks every link already issued.
- Malformed, other secret, expired: jwtauth's own error leaking out instead of `invalid JWT`, or a
  decode that skips verification.
- Empty ID: the error wrapped, so `MatchError` fails.
- No `id`: a session token accepted.
- Number `id`: a panic on the type assertion, or the number formatted into an ID.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/`
- Expected: FAIL, compile error `undefined: artwork.EncodeArtworkID`.

- [x] **Step 3: Implement `EncodeArtworkID` and `DecodeArtworkID` in `core/artwork/artwork.go`**

`EncodeArtworkID` signs `{"id": artID.String()}` with `auth.CreatePublicToken`, and returns the
token, as `PublicLink` does. `DecodeArtworkID` verifies with
`jwtauth.VerifyToken(auth.TokenAuth, tokenString)`, and returns `errors.New("invalid JWT")` for any
error or a nil token. It then requires `id` with `jwt.Validate(token, jwt.WithRequiredClaim("id"))`,
returning that error, reads the claim, returns `errors.New("invalid id type")` when it is not a
string, and returns `model.ParseArtworkID(id)` as is.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/`, then the lint of [R1](rulings.md)
- Expected: PASS, and no lint issue.

- [x] **Step 5: Commit**

```bash
git add core/artwork/artwork.go core/artwork/artwork_test.go
git commit -m "feat(navidrome-image-jwt): encode and decode public image tokens"
```

## Task 2: The public endpoint reads the size from the query

**Risky:** it changes how an endpoint open without login trusts its input.

**Files:**

- Modify: `server/public/public_endpoints.go` (`routes`, `handleImages`; remove `jwtVerifier` and
  `validator`)
- Create: `server/public/public_suite_test.go`
- Test: `server/public/public_endpoints_test.go`

**Interfaces:**

- Consumes: `artwork.DecodeArtworkID(tokenString string) (model.ArtworkID, error)`,
  `artwork.EncodeArtworkID(artID model.ArtworkID) string`, from Task 1.
- Produces: `GET /img/{jwt}?size=<n>` on the public router: 404 for an undecodable token, the image
  resized to `n` otherwise.

- [x] **Step 1: Write the failing tests, and the fake they use**

`public_suite_test.go` runs the Ginkgo suite "Public Endpoints Suite", as the other suites do. In
`public_endpoints_test.go`, package `public_test`, a `fakeArtwork` implements `artwork.Artwork`: it
records the `id` and `size` of its last `Get`, and returns `"image data"` with a fixed `lastUpdate`,
or a configured error. The `BeforeEach` sets the test secret as in Task 1, and builds
`router := public.New(fake)`. A helper `get(url string) *httptest.ResponseRecorder` serves a GET.

```go
It("serves the original image for a token without a size", func() {
	token := artwork.EncodeArtworkID(model.NewArtworkID(model.KindArtistArtwork, "1234"))
	w := get("/img/" + token)
	Expect(w.Code).To(Equal(http.StatusOK))
	Expect(w.Body.String()).To(Equal("image data"))
	Expect(w.Header().Get("cache-control")).To(Equal("public, max-age=315360000"))
	Expect(fake.id).To(Equal("ar-1234"))
	Expect(fake.size).To(Equal(0))
})
DescribeTable("reads the size from the query",
	func(query string, size int) {
		get("/img/" + token + query)
		Expect(fake.size).To(Equal(size))
	},
	Entry("asked size", "?size=300", 300), Entry("very large", "?size=30000", 30000),
	Entry("missing", "", 0), Entry("zero", "?size=0", 0),
	Entry("not a number", "?size=abc", 0), Entry("negative", "?size=-5", -5),
)
```

And, each with its own `It`:

- `/img/xx-123`, a token signed with another secret, a session token from `auth.CreateToken`, and a
  token whose `id` is the number 1234: 404, and `Get` never called.
- An old token, `{"id": "ar-1234", "size": 0}`, with no query: 200, size 0; with `?size=300`:
  size 300.
- `/img/<token>?:jwt=xx-123`: 200, `fake.id` is `ar-1234`.
- `Get` failing with `model.ErrNotFound`: 404, body `Artwork not found`; with another error: 500.

The break each test catches:

- Original image: the size read from the token, or the headers dropped.
- Query table: the query ignored, a size read with another default, or a cap added.
- 404 cases: a broken token reaching `Get`, or a 400 for a non-string `id`.
- Old token: the `size` claim still required, or still read and winning over the query.
- `:jwt` in the query: the token read from a value the client chose.
- Errors: a status changed for a missing or failing image.

A negative size is passed through: `Artwork.Get` already serves the original for any size not above
0 (`getArtworkReader`).

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./server/public/`
- Expected: FAIL, `Expected <int>: 404 to equal <int>: 200` for every new token, since today's
  validator requires a `size` claim; the `:jwt` spec panics in today's validator, on a nil token.

- [x] **Step 3: Implement**

The router keeps one route, `/img/{jwt}`, with no JWT middleware. `handleImages` decodes
`chi.URLParam(r, "jwt")` with `artwork.DecodeArtworkID`, answers 404 with
`http.StatusText(http.StatusNotFound)` on any error, reads `utils.ParamInt(r, "size", 0)`, and calls
`p.artwork.Get(ctx, artID.String(), size)`. The rest of the handler, from the timeout to the copy,
stays as it is. See [R2](rulings.md) for the dropped `URLParamsMiddleware`.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./server/...`, then the lint of [R1](rulings.md)
- Expected: PASS, and no lint issue.

- [x] **Step 5: Commit**

```bash
git add server/public/
git commit -m "feat(navidrome-image-jwt): read the public image size from the query"
```

## Task 3: Public image links carry the size in the query

**Files:**

- Modify: `server/subsonic/helpers.go` (`artistCoverArtURL`)
- Modify: `core/artwork/artwork.go` (remove `PublicLink`)
- Test: `server/subsonic/helpers_test.go`

**Interfaces:**

- Consumes: `artwork.EncodeArtworkID` and `artwork.DecodeArtworkID`, from Task 1.
- Produces: `artistCoverArtURL(r *http.Request, artID model.ArtworkID, size int) string`, unchanged
  signature: `<absolute URL>/p/img/<token>`, followed by `?size=<size>` when `size > 0`.

- [x] **Step 1: Write the failing tests**

In `helpers_test.go`, a `Describe("artistCoverArtURL")` whose `BeforeEach` sets the test secret as
in Task 1, with `r := httptest.NewRequest("GET", "http://localhost/rest/getArtists", nil)` and
`artID := model.NewArtworkID(model.KindArtistArtwork, "1234")`:

```go
It("links to the public image without a query for size 0", func() {
	url := artistCoverArtURL(r, artID, 0)
	Expect(url).To(HavePrefix("http://localhost/p/img/"))
	Expect(url).ToNot(ContainSubstring("?"))
	Expect(artwork.DecodeArtworkID(strings.TrimPrefix(url, "http://localhost/p/img/"))).To(Equal(artID))
})
It("adds the size to the query", func() {
	url := artistCoverArtURL(r, artID, 300)
	Expect(url).To(HaveSuffix("?size=300"))
	token := strings.TrimSuffix(strings.TrimPrefix(url, "http://localhost/p/img/"), "?size=300")
	Expect(artwork.DecodeArtworkID(token)).To(Equal(artID))
})
```

The break each test catches:

- Size 0: a `?size=0` appended, which changes every `artistImageUrl`.
- Size 300: the size dropped, or joined into the path by `path.Join`.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./server/subsonic/`
- Expected: FAIL,
  `Expected <string>: http://localhost/p/img/<token> to have suffix <string>: ?size=300`.

- [x] **Step 3: Implement**

`artistCoverArtURL` builds the path from `artwork.EncodeArtworkID(artID)`, makes it absolute with
`server.AbsoluteURL`, then appends `?size=<size>` when `size > 0`. Remove `PublicLink` from
`core/artwork/artwork.go`: it has no caller left.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/ ./server/...`, then the lint of [R1](rulings.md)
- Expected: PASS, and no lint issue.

- [x] **Step 5: Commit**

```bash
git add server/subsonic/helpers.go server/subsonic/helpers_test.go core/artwork/artwork.go
git commit -m "feat(navidrome-image-jwt): put the public image size in the query"
```

## Task 4: Small images can be read back

**Files:**

- Modify: `core/artwork/reader_resized.go` (`asImageReader`)
- Test: `core/artwork/artwork_internal_test.go`

**Interfaces:**

- Consumes: nothing new.
- Produces: `asImageReader(r io.Reader) (io.Reader, string, error)` returns no error for an input
  shorter than 512 bytes; `resizeImage` resizes such inputs.

- [x] **Step 1: Write the failing tests**

In the `resizedArtworkReader` specs of `artwork_internal_test.go`:

```go
It("returns a PNG of 15 pixels when resizing a PNG to 15", func() {
	conf.Server.CoverArtPriority = "front.png"
	r, _, err := aw.Get(context.Background(), alMultipleCovers.CoverArtID().String(), 15)
	Expect(err).ToNot(HaveOccurred())

	br, format, err := asImageReader(r)
	Expect(format).To(Equal("image/png"))
	Expect(err).ToNot(HaveOccurred())

	img, _, err := image.Decode(br)
	Expect(err).ToNot(HaveOccurred())
	Expect(img.Bounds().Size().X).To(Equal(15))
	Expect(img.Bounds().Size().Y).To(Equal(15))
})
```

And a `Describe("resizeImage")`:

- A source under 512 bytes, the 15 pixel PNG above read into a buffer, resized to 10: a PNG of 10
  by 10.
- An empty source, `bytes.NewReader(nil)`, resized to 15: an error, so the reader serves it as is.

The break each test catches:

- 15 pixels: the short peek still failing, so the format is empty.
- Short source: the fix applied to the result only.
- Empty source: a short peek accepted, but the decode error lost.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/`
- Expected: FAIL, `Expected <string>:  to equal <string>: image/png`.

- [x] **Step 3: Implement**

`asImageReader` accepts a peek that ends with `io.EOF`, and detects the format from the bytes it
got; any other peek error is still returned.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/`, then the lint of [R1](rulings.md)
- Expected: PASS, and no lint issue.

- [x] **Step 5: Commit**

```bash
git add core/artwork/reader_resized.go core/artwork/artwork_internal_test.go
git commit -m "fix(navidrome-image-jwt): read back images under 512 bytes"
```
