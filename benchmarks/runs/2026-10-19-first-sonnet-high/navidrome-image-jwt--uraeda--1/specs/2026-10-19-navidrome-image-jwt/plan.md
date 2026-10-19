---
status: auto-approved
spec-revision: 1
---

# Plan: Remove size from public image ID JWT

**Goal:** Public image tokens carry only the artwork ID, and the size travels as a `size` query
parameter.

**Architecture:** [`core/artwork/artwork.go`](/core/artwork/artwork.go) owns the token:
`EncodeArtworkID` writes the one claim `id`, and `DecodeArtworkID` reads it and owns every error
case. The public endpoint in
[`server/public/public_endpoints.go`](/server/public/public_endpoints.go) decodes with it, reads
`size` like `getCoverArt`, and calls `Artwork.Get`. The artist URL helper in
[`server/subsonic/helpers.go`](/server/subsonic/helpers.go) calls `EncodeArtworkID`. See the spec's
[architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): read it together with this plan.

## Review focus

- A token with an `id` that is a number, or no `id`: `DecodeArtworkID` errors and the endpoint
  answers 404, never 400 or a panic. Task 1 and Task 2.
- An old token holding `size` 300, requested with no `size` parameter: the original image is served,
  not a resized one. Task 2.

## Global constraints

- The token has one claim, a string `id`, plus the issuer and issued-at claims
  `auth.CreatePublicToken` adds. It has no `size` claim.
- `DecodeArtworkID("xx-123")` errors with exactly `invalid JWT`; the token of `model.ArtworkID{}`
  errors with exactly `invalid artwork id`.
- The endpoint reads the size with `utils.ParamInt(r, "size", 0)`, as `getCoverArt` does, with no
  maximum.
- A token that fails to decode answers 404.
- `PublicLink` is removed, and `EncodeArtworkID` replaces it.
- Old tokens carrying `size` still verify, and the claim is ignored.

## Code read

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink` is the only token writer;
  `Artwork.Get(ctx, id, size)` takes the size separately.
- [`core/auth/auth.go`](/core/auth/auth.go): `CreatePublicToken(claims)` adds the base claims.
  `Validate(tokenStr)` uses `jwtauth.VerifyToken` and returns the claims map.
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): `jwtVerifier` and
  `validator` middlewares, and `handleImages` reading claims. No tests exist in `server/public`.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL` is the only
  `PublicLink` caller, with size 0.
- Tests are Ginkgo and Gomega, with a suite file per package: `core/artwork/artwork_suite_test.go`.
  Validation: `go test ./core/... ./server/...`, `go vet ./...`, `gofmt -l .`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None.

## Test map

Integration-style Ginkgo tests: token tests call the public functions with the real `auth` secret;
endpoint tests use `httptest` against the public router with a fake `Artwork` that records the size
it was asked for.

| Spec item                          | Task | Test                                                        |
| ---------------------------------- | ---- | ----------------------------------------------------------- |
| US1.1, SC-002 round trip           | 1    | `core/artwork/artwork_test.go`: "round-trips an artwork ID" |
| US1.2 `invalid JWT`                | 1    | "fails with invalid JWT for a malformed token"              |
| US1.3 empty ID, edge case empty ID | 1    | "fails with invalid artwork id for an empty ID"             |
| US1.4 no `id` claim                | 1    | "fails when the token has no id claim"                      |
| US1 more 1: `id` not a string      | 1    | "fails when the id claim is not a string"                   |
| US1 more 2: other secret           | 1    | "fails when signed with another secret"                     |
| US1 more 3: old token with size    | 1    | "ignores a size claim in an old token"                      |
| SC-001 no size claim               | 1    | "encodes only the id claim"                                 |
| US2.1 size resized                 | 2    | `server/public`: "passes the size query parameter"          |
| US2.2, US2.4 no size, old token    | 2    | "serves the original when no size is sent" (old token case) |
| US2.3, edge: bad token             | 2    | "answers 404 for a token that fails to decode"              |
| Review focus: `id` not a string    | 2    | "answers 404 for a token whose id is not a string"          |
| Edge: size not a number            | 2    | "treats a non-numeric size as 0"                            |
| US3.1, SC-003 PNG at 15            | 3    | `artwork_internal_test.go`: "returns a PNG at size 15"      |

## Waves

- Wave 1: Task 1.
- Wave 2: Task 2, which consumes Task 1.
- Wave 3: Task 3, which consumes nothing, and is last to keep the order simple.

---

## Task 1: Encode and decode the public artwork token

**Risky:** It changes the format of a public, signed token, and checks outside library behaviour
(the `invalid JWT` text).

**Files:**

- Modify: `core/artwork/artwork.go` (remove `PublicLink`, add the two functions)
- Test: `core/artwork/artwork_test.go`

**Interfaces:**

- Consumes: `auth.CreatePublicToken`, `auth.TokenAuth`, `model.ParseArtworkID`.
- Produces: `func EncodeArtworkID(artID model.ArtworkID) string` and
  `func DecodeArtworkID(tokenString string) (model.ArtworkID, error)`. `PublicLink` no longer
  exists.

- [x] **Step 1: Write the failing tests** in `artwork_test.go`, with the names of the Test map.
      `auth.Init` is needed for the secret: seed it with the mock datastore the file already uses.
      The `invalid JWT` test comes first: it checks the outside text.

The break each test catches:

- Malformed token: an error text that differs from `invalid JWT`.
- `id` not a string: a panic or a silently accepted number.
- Old token with size: a decoder that rejects extra claims.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/`
- Expected: FAIL to compile, `undefined: artwork.EncodeArtworkID`

- [x] **Step 3: Implement the functions** in `artwork.go`. `Encode` signs `{"id": artID.String()}`.
      `Decode` verifies with `auth.TokenAuth` and `jwtauth.VerifyToken`, reads `id` from the claims,
      and requires a string. It parses with `model.ParseArtworkID`. If the verification error text
      is not exactly `invalid JWT`, wrap it to give that text.

- [x] **Step 4: Run the project's validation**

- Run: `go test ./core/artwork/ && go build ./...`
- Expected: build fails in `server/subsonic` on `PublicLink`, fixed in Task 2. Keep the commit for
  Task 2 together if the build must stay green.

- [x] **Step 5: Commit** with Task 2, since `PublicLink` is removed here and its caller changes
      there.

## Task 2: Read the size from the query in the endpoint and the URL helper

**Risky:** It changes a public, unauthenticated endpoint.

**Files:**

- Modify: `server/public/public_endpoints.go` (`routes`, `handleImages`; remove `validator`)
- Modify: `server/subsonic/helpers.go` (`artistCoverArtURL`)
- Create: `server/public/public_suite_test.go`, `server/public/public_endpoints_test.go`

**Interfaces:**

- Consumes: `artwork.EncodeArtworkID`, `artwork.DecodeArtworkID`, `utils.ParamInt`.
- Produces: `GET /img/{jwt}?size=N`. Any decode error answers 404.

- [x] **Step 1: Write the failing tests** named in the Test map, with a fake `artwork.Artwork`
      recording the size.

The break each test catches:

- Old token: a handler still reading the `size` claim.
- `id` not a string: a 400 instead of a 404.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./server/public/`
- Expected: FAIL, the old validator answers 404 for a token without `size`.

- [x] **Step 3: Implement** the handler: decode `:jwt`, 404 on error, read `size`, call `Get`.
      Remove `validator`. Update `artistCoverArtURL` to call `EncodeArtworkID`.

- [x] **Step 4: Run the project's validation**

- Run: `go build ./... && go vet ./... && go test ./core/... ./server/...`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add core server
git commit -m "feat(navidrome-image-jwt): keep only the artwork ID in the public image token"
```

## Task 3: Test that a PNG stays a PNG at size 15

**Files:**

- Test: `core/artwork/artwork_internal_test.go`

**Interfaces:**

- Consumes: `aw.Get`. Produces: nothing.

- [x] **Step 1: Write the test** "returns a PNG at size 15" next to the size 300 case, asserting
      format `image/png` and bounds 15 by 15. It catches an encoder that falls back to JPEG for
      small sizes.

- [x] **Step 2: Run it**

- Run: `go test ./core/artwork/`
- Expected: PASS: the code already keeps the format, so this preserves behaviour.

- [x] **Step 3: Commit**

```bash
git add core/artwork/artwork_internal_test.go
git commit -m "test(navidrome-image-jwt): resize a PNG to 15 pixels"
```
