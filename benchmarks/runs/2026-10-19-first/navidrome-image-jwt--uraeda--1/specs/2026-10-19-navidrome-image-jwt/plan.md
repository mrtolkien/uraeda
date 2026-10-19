---
status: auto-approved
spec-revision: 1
---

# Plan: Remove size from public image ID JWT

**Goal:** Public image tokens hold only the artwork id, and the image size comes from a `size` query
parameter.

**Architecture:** `core/artwork/artwork.go` owns the token format: `EncodeArtworkID` writes it and
`DecodeArtworkID` reads and validates it, so the claim rules live in one place. The public endpoint
and the Subsonic link builder are callers only. `PublicLink` is removed. Resizing is unchanged. See
the [spec's architecture](spec.md#architecture).

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A token from an old link, with `id` and `size` claims** still verifies and serves the original
   image; the `size` claim is ignored. Task 2.
2. **A bad token, or a signed token without `id`, on the endpoint** answers 404, not 400 or 500.
   Task 2.
3. **A non-numeric `size` query value** counts as 0 and serves the original. Task 2.

## Global constraints

- Public tokens hold one string claim, `id`. `auth.CreatePublicToken` still adds the issuer and
  issued-at claims ([auth.go](/core/auth/auth.go)).
- Error messages: "invalid JWT" for an unverifiable token, "invalid artwork id" for an unparseable
  id.
- The `size` query parameter is read like `getCoverArt` reads it: `utils.ParamInt(r, "size", 0)`,
  with no cap.
- `artistCoverArtURL` appends `?size=N` only when N is above 0.
- Follow the repository's patterns: Ginkgo/Gomega tests, `go test -race ./...`, `make lint`.
- Do not add features beyond the spec (constitution II).

## Code read

- [`core/artwork/artwork.go`](/core/artwork/artwork.go): `PublicLink` is the only token producer;
  `getArtworkId` shows `model.ParseArtworkID` for parsing.
- [`core/auth/auth.go`](/core/auth/auth.go): `Validate(tokenStr)` verifies with
  `jwtauth.VerifyToken` and returns claims as a map; `CreatePublicToken` signs. `auth.TokenAuth` is
  nil until `auth.Init(ds)`, which tests call (see [`server/auth_test.go`](/server/auth_test.go)).
- [`server/public/public_endpoints.go`](/server/public/public_endpoints.go): `jwtVerifier`,
  `validator` (requires `id` and `size`), and `handleImages`. It has no tests and no suite file yet.
- [`server/subsonic/helpers.go`](/server/subsonic/helpers.go): `artistCoverArtURL`, with three
  callers passing 0 (`helpers.go`, `searching.go`). Tests are in the package `subsonic`
  ([`helpers_test.go`](/server/subsonic/helpers_test.go)).
- [`core/artwork/artwork_internal_test.go`](/core/artwork/artwork_internal_test.go): the PNG resize
  test at 300; `asImageReader` helper.
- Validation: `go test -race ./...` and `make lint`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None.

## Test map

Integration-style Ginkgo tests: artwork tests use the mock datastore and `auth.Init`; the endpoint
tests drive the router with `httptest` and a fake `Artwork`.

| Spec item                      | Task | Test                                                                   |
| ------------------------------ | ---- | ---------------------------------------------------------------------- |
| US1.1, SC-001 round trip       | 1    | `artwork_test.go`: encode then decode returns the same id              |
| US1.2, SC-002 no size claim    | 1    | `artwork_test.go`: `auth.Validate` of the token has `id` and no `size` |
| US1 "xx-123", SC-003           | 1    | `MatchError("invalid JWT")`                                            |
| US1 empty id, SC-003           | 1    | `MatchError("invalid artwork id")`                                     |
| US1 no `id` claim, SC-003      | 1    | token from `auth.CreatePublicToken(map{})` returns an error            |
| US1 non-string `id`, SC-003    | 1    | token with `id: 5` returns an error                                    |
| US2.2, SC-004 PNG at 15        | 1    | `artwork_internal_test.go`: PNG, 15 by 15                              |
| US1.3, edge: size missing      | 2    | endpoint test: fake artwork receives size 0                            |
| US2.1                          | 2    | endpoint test: `?size=300` gives size 300                              |
| US3.1, edge: old token         | 2    | endpoint test: token with `id` and `size` 0 serves size 0              |
| Edge: bad or id-less token     | 2    | endpoint test: 404                                                     |
| Review focus: non-numeric size | 2    | endpoint test: `?size=abc` gives size 0                                |
| US2.3 and builder size 0       | 2    | `helpers_test.go`: `?size=200` suffix, and no `?` with 0               |

## Waves

- Wave 1: Task 1.
- Wave 2: Task 2, which consumes Task 1's functions.

---

## Task 1: Encode and decode the artwork id token

**Risky:** Security: it defines which claims a public, login-free token must hold.

**Files:**

- Modify: `core/artwork/reader_resized.go` (`asImageReader`: accept sources shorter than 512 bytes,
  found by the PNG at 15 test)
- Modify: `core/artwork/artwork.go` (add `EncodeArtworkID` and `DecodeArtworkID`; keep `PublicLink`
  until Task 2)
- Test: `core/artwork/artwork_test.go`, `core/artwork/artwork_internal_test.go`

**Interfaces:**

- Consumes: `auth.CreatePublicToken`, `auth.Validate`, `model.ParseArtworkID`.
- Produces: `func EncodeArtworkID(artID model.ArtworkID) string` and
  `func DecodeArtworkID(tokenString string) (model.ArtworkID, error)`.

- [x] **Step 1: Write the failing tests**

In `artwork_test.go`, a `Describe("EncodeArtworkID/DecodeArtworkID")` calling `auth.Init(ds)` first,
with the cases of the Test map for Task 1. Add to `artwork_internal_test.go` a PNG resize to 15
mirroring the 300 test.

The break each test catches:

- Round trip: a token that drops or mangles the id.
- No `size`: the old claim left in.
- Missing and non-string `id`: a decoder that panics or returns an empty id.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./core/artwork/...`
- Expected: FAIL to compile, `undefined: artwork.EncodeArtworkID`.

- [x] **Step 3: Implement both functions in `core/artwork/artwork.go`**

`EncodeArtworkID` signs `{"id": artID.String()}` through `auth.CreatePublicToken`. `DecodeArtworkID`
calls `auth.Validate`, wraps its error as "invalid JWT", requires a string `id` claim (distinct
errors for missing and non-string), and wraps a `model.ParseArtworkID` failure as "invalid artwork
id". If the wrapped text does not satisfy `MatchError`, adjust the wrapping (the spec's unverified
assumption).

- [x] **Step 4: Run the project's validation**

- Run: `go test -race ./core/... && make lint`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add core/artwork specs/2026-10-19-navidrome-image-jwt/plan.md
git commit -m "feat(navidrome-image-jwt): encode and decode the artwork id token"
```

## Task 2: Use the token in the endpoint and the link builder

**Risky:** Security: the endpoint is open without a login, and its size parameter has no cap
(accepted in the spec).

**Files:**

- Modify: `server/public/public_endpoints.go` (`handleImages`, `validator`)
- Modify: `server/subsonic/helpers.go` (`artistCoverArtURL`)
- Modify: `core/artwork/artwork.go` (remove `PublicLink`)
- Create: `server/public/public_suite_test.go`, `server/public/public_endpoints_test.go`
- Test: `server/subsonic/helpers_test.go`

**Interfaces:**

- Consumes: `artwork.EncodeArtworkID`, `artwork.DecodeArtworkID`.
- Produces: `/share/img/<token>[?size=N]`; `artistCoverArtURL(r, artID, size)` keeps its signature.

- [x] **Step 1: Write the failing tests**

Endpoint tests: a fake `artwork.Artwork` recording the id and size it gets; cases from the Test map
for Task 2, including an old token made with
`auth.CreatePublicToken(map[string]any{"id": ..., "size": 0})`. Builder tests in `helpers_test.go`
for `?size=200` and size 0.

The break each test catches:

- Old token: rejecting tokens that still hold `size`.
- Bad token: a 400 or 500 instead of 404.

- [x] **Step 2: Run them to check they fail**

- Run: `go test ./server/public/... ./server/subsonic/...`
- Expected: FAIL, the endpoint answers 404 for tokens without `size`, and the link has no
  `?size=200`.

- [x] **Step 3: Implement**

`validator` requires only a verified token with `id`, answering 404 otherwise. `handleImages` calls
`artwork.DecodeArtworkID` on the `jwt` URL param (404 on error) and reads
`utils.ParamInt(r, "size", 0)`, then calls `Get(ctx, artID.String(), size)`. `artistCoverArtURL`
uses `EncodeArtworkID` and appends `?size=N` when above 0. Delete `PublicLink`.

- [x] **Step 4: Run the project's validation**

- Run: `go test -race ./... && make lint`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add core server specs/2026-10-19-navidrome-image-jwt/plan.md
git commit -m "feat(navidrome-image-jwt): read the public image size from the query"
```
