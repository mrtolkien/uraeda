---
status: auto-approved
spec-revision: 1
---

# Plan: Remove size from public image ID JWT

**Goal:** Public artwork links carry only the artwork's ID, and a `size` query parameter on the link
sets the image size, from 1 to 1000 pixels, with every other value serving the original image.

**Architecture:** The link format moves into `core/artwork`: `EncodeArtworkID` builds a token with
the `id` claim only, and `DecodeArtworkID` is the one home of token validity: signature, the
required `id` claim, its type, and the artwork ID it names. The public image route in
`server/public` calls `DecodeArtworkID`, reads the `size` query, applies the size rule, and answers
`404 Not Found` for any failure. The validator and verifier middlewares of that route go, since
their checks move into the decoder. The image cache and the resizer are unchanged: the cache already
keeps each size as its own file, and the resizer already keeps the format and the longer side. See
[the spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A token whose `id` claim is not a string** (for example a number) must return an error, not
   panic on a type assertion. Task 1.
2. **A token signed with another key, or unsigned with `alg: none`**, must be rejected with
   `invalid JWT`, and the route answers `404 Not Found`. Tasks 1 and 3.
3. **A `size` too large for an integer** (a long run of digits) must serve the original image, not
   fail or wrap around into the range. Task 3.
4. **A `size` that is not a whole number** (`15.5`, `+`, empty, spaces) serves the original, so the
   cache never holds a size the rule does not allow. Task 3.
5. **A portrait image** (taller than wide) at a size resizes its height to the size, so the longer
   side is the size. Task 2.
6. **An undecodable cover** served with a size returns the file as stored, not an error. Task 2 (the
   artwork level) and Task 3 (the route).

## Global constraints

Approved rules, copied word for word from the spec:

- "A link whose signature does not verify: Answers `404 Not Found`, as today"
- "A link with no `id` claim, or whose `id` is not an artwork ID: Answers `404 Not Found`, as today"
- "A link issued before this change, with a `size` claim: Verifies, and the claim is ignored"
- "A `size` that is missing, zero, negative, not a whole number, or above 1000: Serves the original
  image"
- "A `size` larger than the image: Enlarges the image to that size, as resizing does today"
- "An image that cannot be decoded for resizing: Serves the image as stored, as today"
- "The artwork was deleted: Answers `404 Not Found`, "Artwork not found", as today"
- "Every verification failure reports as "invalid JWT", so callers get one error for a bad link."
- "The size rule: a whole number from 1 to 1000 resizes, and anything else serves the original."
- "The image cache and the resizer stay as they are."

Messages from the proposal and the spec's success criteria, word for word:

- `EncodeArtworkID` followed by `DecodeArtworkID` round-trips, for example
  `model.NewArtworkID(model.KindArtistArtwork, "1234")`.
- The input `"xx-123"` gives an error matching `invalid JWT`.
- The token of an empty `model.ArtworkID{}` gives an error matching `invalid artwork id`.
- A valid token with no `id` claim gives a non-nil error.
- A PNG source keeps its format when resized, and a PNG resized to `15` has bounds `15` x `15`.

Existing guarantees the change keeps, from the route's current code,
[public_endpoints.go](/server/public/public_endpoints.go#L44-L82):

- Responses set `cache-control: public, max-age=315360000` and `last-modified` from the artwork's
  last update.
- `context.Canceled` writes nothing. `model.ErrNotFound` answers `404` with "Artwork not found". Any
  other error answers `500` with "Error retrieving coverArt".
- The handler's context has a 10-second timeout.

## Code read

- [`core/artwork/artwork.go`](/core/artwork/artwork.go#L112-L118): `PublicLink(artID, size)` builds
  the token with `id` and `size`, and ignores the signing error. Its only caller is
  `artistCoverArtURL`. It is replaced by `EncodeArtworkID`, which returns only a string, so the
  error stays ignored, as before. Task 1 adds the new functions beside it; Task 3 switches the
  caller and removes it.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go#L32-L106): the router
  group is `URLParamsMiddleware` (copies the `:jwt` path parameter into the query), `jwtVerifier`
  (reads `:jwt` from the query and verifies it), and `validator`. `validator` calls `jwt.Validate`
  before it checks for a nil token, and requires both `id` and `size`. `handleImages` reads `id` and
  `size` from the claims. The package has no test files and no test suite.
- [`server/middlewares.go`](/server/middlewares.go#L206-L225): `URLParamsMiddleware` appends
  `:jwt=<token>` to the query, so `r.URL.Query().Get(":jwt")` yields the token. A `size` query
  parameter survives it.
- [`core/auth/auth.go`](/core/auth/auth.go#L42-L50): `CreatePublicToken` adds `iss` and `iat`, and
  signs with HS256 through `TokenAuth`. [`Validate`](/core/auth/auth.go#L77-L83) verifies a token
  and returns its claims as a map, through `jwtauth.VerifyToken`, which checks the signature and the
  standard time claims.
- [`core/auth/auth_test.go`](/core/auth/auth_test.go#L36): tests set
  `auth.TokenAuth = jwtauth.New("HS256", auth.Secret, nil)` directly, the pattern the new tests
  follow.
- [`model/artwork_id.go`](/model/artwork_id.go#L27-L55): `ArtworkID.String()` is `""` for an empty
  ID and `kind-id` otherwise. `ParseArtworkID` returns `invalid artwork id` when there is no `-`,
  and `invalid artwork kind` for an unknown kind. It accepts `ar-` with an empty ID part.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go#L116-L120):
  `artistCoverArtURL(r, artID, size)` calls `PublicLink(artID, size)`. Its callers are
  [helpers.go](/server/subsonic/helpers.go#L93) and [helpers.go](/server/subsonic/helpers.go#L107),
  which pass `0` for `toArtist` and `toArtistID3`, and
  [searching.go](/server/subsonic/searching.go#L115), which passes `0` too. No test asserts
  `artistImageUrl`'s value.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go#L27-L66): `resizedFromOriginal`
  and the reader. The reader fetches the original at size 0, resizes it, and serves the original as
  stored when resizing fails.
- [`core/artwork/reader_resized.go`](/core/artwork/reader_resized.go#L77-L105): `resizeImage`
  resizes the longer side (the width when the image is wider than tall, else the height), and
  encodes a PNG as PNG and anything else as JPEG with `conf.Server.CoverJpegQuality`. It returns an
  error when the image cannot be decoded.
- [`core/artwork/artwork.go`](/core/artwork/artwork.go#L27-L80): `Get(ctx, id string, size int)`
  parses the ID, then `getArtworkReader`. A size above 0 goes through the resized reader. The image
  cache key includes the size, so each size is its own file:
  [image_cache.go](/core/artwork/image_cache.go#L14-L27).
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go#L173-L207): the
  existing resize tests. They use the mock datastore
  (`ds.Album(ctx).(*tests.MockAlbumRepo).SetData`), `conf.Server.CoverArtPriority`, and the fixture
  `tests/fixtures/front.png`, which is 16 by 16. They check a PNG resized to 300 and a JPEG resized
  to 200.
- [`core/artwork/artwork_suite_test.go`](/core/artwork/artwork_suite_test.go),
  [`artwork_test.go`](/core/artwork/artwork_test.go): the Ginkgo v2 and Gomega suite. The internal
  and external test files of the package run in one suite, `TestArtwork`.
- [`tests/init_tests.go`](/tests/init_tests.go#L16-L22): `tests.Init(t, skipOnShort)` moves to the
  repository root, so relative fixture paths like `tests/fixtures/front.png` resolve.
- [`server/subsonic/api_suite_test.go`](/server/subsonic/api_suite_test.go): the suite file pattern
  a new package suite copies.
- `tests/fixtures/index.html` exists, and serves as a non-image cover for the undecodable case.
- Validation: `go test ./core/artwork/ ./core/auth/ ./server/public/ ./server/subsonic/` is the test
  command. The lint command is `make lint`, which runs golangci-lint through `go run`
  ([Makefile](/Makefile#L39-L40), [.golangci.yml](/.golangci.yml)).

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None. The change adds two functions in `core/artwork` and one private helper, `imageSize`, with a
constant for the 1000-pixel limit in `server/public`. No new types, interfaces, or layers. No
decision of the repository sets a limit that a function or file would cross: `specs/decisions/` has
none.

## Review comments

None. The spec was approved without comments.

## Test map

Integration tests run through the real components: the artwork service on the mock datastore with
the image cache disabled (`conf.Server.ImageCacheSize = "0"`) and the mock ffmpeg, and the HTTP
router of `server/public`, called with `httptest`. Tokens are made with `EncodeArtworkID` or
`auth.CreatePublicToken`. The suites set `auth.TokenAuth` in `BeforeEach`, as in
[auth_test.go](/core/auth/auth_test.go#L36). Each test follows
[writing tests](code-quality.md#writing-tests): Arrange, Act, Assert.

| Spec                                                             | Task | Test                                                                                                                 |
| ---------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| US1 1, SC-001: no size, original PNG served unchanged            | 3    | `public_endpoints_test.go`: "serves the stored bytes when no size is given"                                          |
| US1 2: old token with `size` 300, no query size                  | 3    | "serves the original for a token issued with a size claim"                                                           |
| US1 3: signature does not verify                                 | 3    | "answers 404 Not Found for a token signed with another key"; Task 1: "rejects a token signed with another key"       |
| US2 1: 16 by 16 PNG, `size=15`                                   | 3    | "resizes a 16 by 16 PNG to 15 by 15"; Task 2: "resizes a 16 by 16 PNG to 15 by 15 and keeps the PNG format"          |
| US2 2: 1200 by 600 PNG, `size=300`                               | 3    | "resizes the longer side of a wide PNG"; Task 2: "keeps the proportions of a wide PNG"                               |
| US2 3: `size=1001` serves the original                           | 3    | "serves the original for a size above 1000"                                                                          |
| US2 4: `size=1000`, 1000 by 500                                  | 3    | "resizes to the 1000 pixel limit"                                                                                    |
| US2 5: `size=abc`, `0`, `-5` serve the original, 200 OK          | 3    | "serves the original for a size that is not a positive whole number" (DescribeTable)                                 |
| US2 6: JPEG, `size=300`, JPEG with longer side 300               | 3    | "keeps a JPEG as a JPEG"; Task 2: "keeps a JPEG as a JPEG"                                                           |
| SC-001: no size returns the stored bytes                         | 3    | "serves the stored bytes when no size is given"                                                                      |
| SC-002: every whole size from 1 to 1000 has that longer side     | 2    | "gives each size from 1 to 1000 as its longer side" (loop over the sizes)                                            |
| SC-003: round trip                                               | 1    | "round-trips an artwork ID"                                                                                          |
| SC-004: `invalid JWT`, `invalid artwork id`, no-`id` error       | 1    | "reports invalid JWT", "reports invalid artwork id", "rejects a token with no id claim" (DescribeTables)             |
| SC-005: no panic on a link that fails decoding                   | 1, 3 | Task 1: "rejects an id claim that is not a string"; Task 3: "answers 404 for a token whose id is not a string"       |
| Edge: signature does not verify                                  | 3    | "answers 404 Not Found for a token signed with another key"                                                          |
| Edge: no `id` claim, or `id` not an artwork ID                   | 1, 3 | Task 1: "rejects a token with no id claim"; Task 3: "answers 404 for a token with no id claim"                       |
| Edge: old token with `size` claim verifies and the claim ignored | 1, 3 | Task 1: "decodes an old token with a size claim"; Task 3: "serves the original for a token issued with a size claim" |
| Edge: size missing, zero, negative, not whole, above 1000        | 3    | "serves the original for a size that is not a positive whole number" (DescribeTable)                                 |
| Edge: size larger than the image enlarges it                     | 3    | "enlarges a 16 by 16 PNG to size 300"                                                                                |
| Edge: image that cannot be decoded is served as stored           | 2, 3 | Task 2: "serves an undecodable cover as stored"; Task 3: "serves an undecodable cover as stored at a size"           |
| Edge: artwork deleted gives 404 Artwork not found                | 3    | "answers 404 Artwork not found for a valid token whose artwork is gone"                                              |
| Edge: requests for every size, one cached file per size          | 3    | Covered by the existing cache keying of [image_cache.go](/core/artwork/image_cache.go#L14-L27); not re-tested here   |
| Review focus 1: `id` claim not a string                          | 1    | "rejects an id claim that is not a string"                                                                           |
| Review focus 2: another key, or `alg: none`                      | 1, 3 | Task 1: "rejects a token signed with another key", "rejects an unsigned token"                                       |
| Review focus 3: size overflows an integer                        | 3    | "serves the original for a size too large for an integer"                                                            |
| Review focus 4: size that is not a whole number                  | 3    | "serves the original for a size that is not a positive whole number" (`15.5`, `+`, empty, spaces rows)               |
| Review focus 5: portrait image keeps its longer side             | 2    | "resizes the longer side of a tall PNG"                                                                              |
| Review focus 6: undecodable cover at a size                      | 2, 3 | "serves an undecodable cover as stored" (both)                                                                       |

## Waves

1. Tasks 1 and 2: they touch different files. Task 1 adds the two token functions beside
   `PublicLink`; Task 2 adds only its own test file. Neither consumes the other. After this wave the
   project works as before: nothing calls the new functions yet.
2. Task 3: it consumes `EncodeArtworkID` and `DecodeArtworkID` from Task 1, switches the Subsonic
   link builder and the route to them, and removes `PublicLink`. It is built alone.

---

## Task 1: Encode and decode public artwork IDs

**Risky:** It changes how public link tokens are verified: the decoder is the one check that stands
between a request and the artwork. Nothing calls it until Task 3, so this task changes no served
behaviour.

**Files:**

- Modify: `core/artwork/artwork.go` (`EncodeArtworkID` and `DecodeArtworkID` added beside
  `PublicLink`, which stays until Task 3)
- Test: `core/artwork/artwork_token_test.go` (new, package `artwork_test`)

**Interfaces:**

- Consumes: nothing from earlier tasks. Uses `auth.CreatePublicToken` and `auth.Validate` from
  `core/auth`, and `model.ParseArtworkID`.
- Produces:
  - `func EncodeArtworkID(artID model.ArtworkID) string`: a token whose claims are `iss`, `iat`, and
    `id`, where `id` is `artID.String()`. Task 3 makes it replace `PublicLink`.
  - `func DecodeArtworkID(tokenString string) (model.ArtworkID, error)`: verifies the token, then
    the `id` claim. Its errors:
    - any token that fails verification, including the empty string: exactly `invalid JWT`;
    - no `id` claim: `missing id claim`;
    - an `id` claim that is not a string: `invalid id claim type`;
    - an `id` that does not parse, is empty after its kind, or has an unknown kind: exactly
      `invalid artwork id`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

The suite's `BeforeEach` sets `auth.TokenAuth = jwtauth.New("HS256", []byte("test secret"), nil)`,
so that tokens are signed in the test. A helper signs a claims map with a given key, for the cases
that need a second key or no key.

```go
// core/artwork/artwork_token_test.go
It("round-trips an artwork ID", func() {
	artID := model.NewArtworkID(model.KindArtistArtwork, "1234")

	decoded, err := artwork.DecodeArtworkID(artwork.EncodeArtworkID(artID))

	Expect(err).ToNot(HaveOccurred())
	Expect(decoded).To(Equal(artID))
})
```

The other tests, each named as in the [test map](#test-map):

- "carries only the id claim": the claims from `auth.Validate(token)` have key `id` with the artwork
  ID, and no `size`.
- "reports invalid JWT" (table): `""`, `"xx-123"`, a token signed with the key `"other secret"`, and
  an unsigned token built with base64 `RawURLEncoding` as `{"alg":"none","typ":"JWT"}` `.`
  `{"id":"ar-1234"}` `.` with an empty signature. Each gives `MatchError("invalid JWT")`. The last
  two are the review focus rows.
- "reports invalid artwork id" (table): `EncodeArtworkID(model.ArtworkID{})`, which encodes `""`; a
  token with `id` `xx-1234`, an unknown kind; a token with `id` `ar-`, an empty ID after its kind.
  Each gives `MatchError("invalid artwork id")`.
- "rejects a token with no id claim": a token whose claims are `size: 0` only gives
  `HaveOccurred()`.
- "rejects an id claim that is not a string": a token with `id: 1234` gives `HaveOccurred()` and
  does not panic.
- "rejects a token signed with another key": the second key in the table above gives `invalid JWT`.
- "decodes an old token with a size claim": a token with `id: "ar-1234"` and `size: 300` decodes to
  the artist 1234 with no error.

The break each test catches:

- Round trip: encoding a different kind, or the empty ID, than the one given.
- Only the `id` claim: keeping a `size` claim in `EncodeArtworkID`.
- `invalid JWT`: returning the library's `token is unauthorized`, or skipping verification and
  parsing the token without its signature.
- `alg: none`: accepting an unsigned token.
- `invalid artwork id`: returning `ParseArtworkID`'s `invalid artwork kind` for an unknown kind, or
  accepting `ar-` as a valid ID.
- No `id` claim: an `id` that defaults to the empty string and decodes with no error.
- Non-string `id`: a type assertion without its `ok`, which panics.
- Old token: rejecting any token that has an unknown claim.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/`
- Expected: FAIL, a build error, `undefined: artwork.EncodeArtworkID`.

- [x] **Step 3: Implement `EncodeArtworkID` and `DecodeArtworkID` in `core/artwork/artwork.go`,
      beside `PublicLink`**

Responsibility: `EncodeArtworkID` is the encoder of public link tokens. It signs the `id` claim
only, through `auth.CreatePublicToken`, and ignores its error as `PublicLink` did, since the
signature has no error to return.

`DecodeArtworkID` is the verifier of public link tokens. It calls `auth.Validate`, which verifies
the signature and the standard time claims. Any error from it becomes exactly `invalid JWT`. It then
requires the `id` claim, checks that it is a string, and parses it with `model.ParseArtworkID`. Any
parse failure, including an empty ID part, becomes exactly `invalid artwork id`. It never calls
`jwt.Validate` itself, which panics on a nil token.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/ ./core/auth/` and `go vet ./core/artwork/`
- Expected: PASS, with no vet output.

- [x] **Step 5: Commit**

```bash
git add core/artwork/artwork.go core/artwork/artwork_token_test.go
git commit -m "feat(navidrome-image-jwt): encode and decode public artwork IDs"
```

Its commit body records the failure seen: the new "rejects an id claim that is not a string" test,
with the type assertion made unchecked, fails with a panic.

---

## Task 2: Pin the resize rules of public images

Task 2 pins the resize rules the route depends on. Most of its tests check behaviour the resizer
already has. One does not: `asImageReader` peeks 512 bytes with `bufio`, and returns `io.EOF` for
any input shorter than that. A PNG under 512 bytes is therefore never resized, and is served at its
original size. That breaks the spec's US2 rule for a small image, such as a 16 by 16 PNG of a single
colour. The fix is in the resizer, inside the spec's rule, so the task makes it, with a test that
fails first. This is a plan change made while building: see
[R5](rulings.md#r5-a-small-image-is-resized-too).

**Files:**

- Modify: `core/artwork/reader_resized.go` (`asImageReader` accepts an input shorter than 512 bytes)
- Test: `core/artwork/reader_resized_test.go` (new, package `artwork`, the internal test package,
  since it calls `resizeImage`)

**Interfaces:**

- Consumes: nothing from earlier tasks. Uses
  `resizeImage(reader io.Reader, size int) (io.Reader, int, error)` from
  [reader_resized.go](/core/artwork/reader_resized.go#L77).
- Produces: `asImageReader(r io.Reader) (io.Reader, string, error)` returns the detected format for
  an input of any length, and an error only when reading fails, not when the input is short. Its
  callers are `resizeImage`, and the internal tests that check the format of an image.

- [x] **Step 1: Write the tests, and the helpers they use**

Helpers, in the same file: `pngOf(w, h int) []byte` and `jpegOf(w, h int) []byte`, which build a
solid image in memory with the standard library's `image/png` and `image/jpeg`, and
`decodeImage(r io.Reader) (image.Image, string, error)`.

The tests, each named as in the [test map](#test-map):

- "resizes a 16 by 16 PNG to 15 by 15 and keeps the PNG format": `resizeImage` on `pngOf(16, 16)`
  with size 15 decodes to a PNG of bounds 15 by 15. Through `artwork.Get` on the mock datastore, the
  same resize with `front.png` as the cover gives bounds 15 by 15 and format PNG, following
  [artwork_internal_test.go](/core/artwork/artwork_internal_test.go#L173-L192).
- "keeps the proportions of a wide PNG": 1200 by 600, size 300, gives 300 by 150 PNG.
- "resizes the longer side of a tall PNG": 600 by 1200, size 300, gives 150 by 300 PNG.
- "keeps a JPEG as a JPEG": 1200 by 600 JPEG, size 300, gives a JPEG of 300 by 150.
- "resizes to the 1000 pixel limit": 1200 by 600 PNG, size 1000, gives 1000 by 500.
- "gives each size from 1 to 1000 as its longer side": for every size from 1 to 1000, a 40 by 20 PNG
  resized to that size has its longer side equal to the size.
- "serves an undecodable cover as stored": the artwork's `Get` on an album whose cover is
  `tests/fixtures/index.html`, with `conf.Server.CoverArtPriority = "index.html"`, at size 300
  returns the file's bytes, as read by `os.ReadFile`. The mock datastore setup is as in the existing
  `resizedArtworkReader` block.

The break each test catches:

- The 15 by 15 PNG: encoding a PNG source as JPEG, which changes the format.
- Wide and tall PNG: resizing the width for every image, which gives the wrong side for a tall
  image.
- JPEG: encoding every resized image as PNG.
- The 1000 pixel bound: resizing to half the size, or swapping its sides.
- Every size: an off-by-one on the longer side for any size, such as `size - 1` for sizes above 15.
- Undecodable cover: returning the resizer's error to the caller instead of the stored image.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/`
- Expected: FAIL for the 16 by 16 PNG to 15 and for the loop from 1 to 1000, both with
  `Unexpected error: EOF`, from `resizeImage` on a PNG under 512 bytes. The other tests pass
  already: their PNGs and JPEGs are larger than 512 bytes, and the fixture `front.png` is 3949
  bytes.

- [x] **Step 3: Accept a short input in `asImageReader`**

`asImageReader` takes the first bytes to detect the format. When the input is shorter than 512
bytes, `Peek` returns the bytes it has with `io.EOF`: that is not a failure, so the function ignores
`io.EOF` and returns the format of what it read. Any other read error is still returned. Add
`errors` to the imports of [reader_resized.go](/core/artwork/reader_resized.go).

- [x] **Step 4: Run the tests, and check that they can fail**

- Run: `go test ./core/artwork/`
- Expected: PASS.

Then make one break by hand: always resize the width in `resizeImage`, so that a tall image is not
resized to its longer side. Run `go test ./core/artwork/` and see the "tall PNG" test fail with
`Expected ... to equal` for the height. Revert the break, and run the test again: PASS.

- [x] **Step 5: Run the project's validation**

- Run: `go test ./core/artwork/`
- Expected: PASS, and the suite runs the 1000-size loop within its time budget. The loop is the only
  slow test; if it takes more than a few seconds, record it in `rulings.md` and keep it.

- [x] **Step 6: Commit**

```bash
git add core/artwork/reader_resized.go core/artwork/reader_resized_test.go
git commit -m "fix(navidrome-image-jwt): resize images shorter than 512 bytes"
```

Its commit body records the two failures seen: the EOF in Step 2, and the tall-PNG failure in
Step 4.

---

## Task 3: Serve public images with the size query

**Risky:** It changes the route that verifies public links and serves their images, and the size
rule the route applies to every link. A mistake here serves artwork without a valid signature, or
resizes without a limit. It also switches every public link the Subsonic responses hand out to the
ID-only token.

**Files:**

- Modify: `core/artwork/artwork.go` (`PublicLink` removed, its last caller gone)
- Modify: `server/subsonic/helpers.go` (`artistCoverArtURL` loses its `size` argument and builds the
  link with `EncodeArtworkID`; its callers in `toArtist` and `toArtistID3` pass only the ID)
- Modify: `server/subsonic/searching.go` (its `artistCoverArtURL` call loses the `0`)
- Modify: `server/public/public_endpoints.go` (`handleImages` decodes the link and reads `size`;
  `jwtVerifier` and `validator` are removed, with the `jwt` and `jwtauth` imports they used)
- Create: `server/public/public_suite_test.go` (the suite, following
  [api_suite_test.go](/server/subsonic/api_suite_test.go))
- Create: `server/public/public_endpoints_test.go`

**Interfaces:**

- Consumes: `artwork.EncodeArtworkID` and `artwork.DecodeArtworkID` from Task 1; `artwork.Artwork`
  and `artwork.NewArtwork`; `artwork.GetImageCache`.
- Produces:
  - `artistCoverArtURL(r *http.Request, artID model.ArtworkID) string`, which builds its link from
    the artwork ID alone.
  - `const maxImageSize = 1000`, in `server/public`.
  - `func imageSize(value string) int`: returns the parsed size when `value` is a whole number from
    1 to `maxImageSize`, and `0` otherwise. `0` serves the original.
  - `handleImages` keeps its signature. It reads the token from `r.URL.Query().Get(":jwt")`, decodes
    it, and calls `p.artwork.Get(ctx, artID.String(), imageSize(r.URL.Query().Get("size")))`.
  - The router serves `/img/{jwt}` with `URLParamsMiddleware` only, so a request with a bad token
    gets `404 Not Found` from `handleImages`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

The suite file calls `tests.Init(t, false)`, sets `log.SetLevel(log.LevelFatal)`, and calls
`RunSpecs`, as in [api_suite_test.go](/server/subsonic/api_suite_test.go) and
[artwork_suite_test.go](/core/artwork/artwork_suite_test.go). In `BeforeEach` the test sets
`conf.Server.ImageCacheSize = "0"`, `auth.TokenAuth`, a mock datastore with an album `444` whose
`ImageFiles` is `tests/fixtures/front.png`, and a real
`artwork.NewArtwork(ds, artwork.GetImageCache(), tests.NewMockFFmpeg("content from ffmpeg"))`. The
router is `public.New(aw)`, called with `httptest`. A helper,
`get(path string) *httptest.ResponseRecorder`, serves `/img/<token>?<query>`. Two more helpers make
a 1200 by 600 PNG and JPEG in `GinkgoT().TempDir()`, and point an album's `ImageFiles` at them.

The tests, each named as in the [test map](#test-map):

- "serves the stored bytes when no size is given": a token for `al-444`, with no query, gives `200`
  and a body equal to `front.png`'s bytes.
- "serves the original for a token issued with a size claim": a token made with
  `auth.CreatePublicToken` with `id` and `size: 300` and no query gives `200` and the original
  bytes.
- "answers 404 Not Found for a token signed with another key": `404` with body `Not Found`.
- "answers 404 for a token with no id claim", and "answers 404 for a token whose id is not a
  string": `404`.
- "answers 404 Artwork not found for a valid token whose artwork is gone": an album not in the
  datastore gives `404` with body `Artwork not found`.
- "resizes a 16 by 16 PNG to 15 by 15": `size=15` gives `200`, a PNG of bounds 15 by 15.
- "enlarges a 16 by 16 PNG to size 300": `size=300` gives 300 by 300.
- "resizes the longer side of a wide PNG": 1200 by 600, `size=300`, gives 300 by 150.
- "resizes to the 1000 pixel limit": 1200 by 600, `size=1000`, gives 1000 by 500.
- "serves the original for a size above 1000": 1200 by 600, `size=1001`, gives the original bytes.
- "serves the original for a size that is not a positive whole number" (DescribeTable): `abc`, `0`,
  `-5`, `15.5`, `+`, the empty string, and a space `%20`. Each gives `200` and the original bytes.
- "serves the original for a size too large for an integer": `size=99999999999999999999` gives the
  original bytes, `200`.
- "keeps a JPEG as a JPEG": a JPEG of 1200 by 600 with `size=300` gives a JPEG of 300 by 150.
- "serves an undecodable cover as stored at a size": the cover `tests/fixtures/index.html` at
  `size=300` gives `200` and the file's bytes.

The break each test catches:

- No-size and old-token tests: requiring the `size` claim, as the current `validator` does, which
  answers `404`.
- Another key: skipping verification and serving the artwork by the claims alone.
- Deleted artwork: mapping `ErrNotFound` to `500`.
- `size=15`, `300`, `1000`: ignoring the query, so the output stays at the original size.
- `size=1001`, and the non-positive or non-whole sizes: accepting any integer, or parsing with
  `ParseFloat`, which takes `15.5`.
- Overflow: panicking or wrapping when the parse fails with a range error, rather than serving the
  original.
- Undecodable cover: answering `500` when the resize fails.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./server/public/`
- Expected: FAIL. The first failure the run hits is for a token with only an `id` claim:
  `Expected <int>: 404 to equal <int>: 200`, from the `validator`'s `size` requirement.

- [x] **Step 3: Implement `imageSize` and the new `handleImages`, and remove `jwtVerifier` and
      `validator`**

`imageSize` parses with `strconv.Atoi`. A parse error, or a value below 1 or above `maxImageSize`,
gives `0`. This is the whole size rule, and no other place reads the `size` query.

`handleImages` decodes the token first. Any decode error answers `http.StatusNotFound` with
`http.StatusText(http.StatusNotFound)`, as the `validator` does today. It then calls
`p.artwork.Get(ctx, artID.String(), imageSize(...))`, and keeps its existing response handling and
headers unchanged. The `id` used in its log lines is `artID.String()`.

The router group keeps `server.URLParamsMiddleware`, which copies `:jwt` into the query, and drops
`jwtVerifier` and `validator`. Their checks now live in `DecodeArtworkID`.

In `core/artwork/artwork.go`, `PublicLink` is removed. Its only caller is `artistCoverArtURL`, which
now calls `EncodeArtworkID`.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/ ./core/auth/ ./server/public/ ./server/subsonic/` and `make lint`
- Expected: PASS for the tests, and no lint findings in the changed packages. `make lint` runs
  golangci-lint through `go run`; if it cannot run offline, record that in the pull request, and run
  `go vet ./...` instead.

- [x] **Step 5: Commit**

```bash
git add core/artwork/artwork.go server/subsonic/helpers.go server/subsonic/searching.go server/public/public_endpoints.go server/public/public_suite_test.go server/public/public_endpoints_test.go
git commit -m "feat(navidrome-image-jwt): serve public images with the size query"
```

Its commit body records the failure seen in Step 2, and the break that made the "bad signature" test
fail, which the step names.
