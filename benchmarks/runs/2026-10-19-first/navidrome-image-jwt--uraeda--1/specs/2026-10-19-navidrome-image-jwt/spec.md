---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Remove size from public image ID JWT

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve public image tokens that hold only the artwork id, with the image size read from a
>   `size` query parameter.
> - Relaxed guard: anyone holding a public link can request any size, so they could fill the image
>   cache and use CPU. You chose no cap.
> - Old links: tokens already issued still work, and their `size` claim is ignored.
> - Risk tier `medium`: the public token format changes, and the public endpoint is open without a
>   login.
> - No decision is created or changed, and the plan does not wait for your review.

Public image links, `/share/img/<token>`, carry a signed token. Today the token holds the artwork id
and the image size. This spec makes it hold only the id, and moves the size to a query parameter. It
follows the [proposal](proposal.md), the [discovery](discovery-01.md), and the
[clarifications](clarifications-01.md).

## Decisions

None. The answers are choices inside this feature, so they sit in the spec as behaviour.

Relied on: no active decision applies to this feature.

## User stories

### US1: Share an artwork link whose token holds only the id (P1)

A client asks the server for a public image link. The token inside it names the artwork and nothing
else. Opening the link serves the original image.

Key scenarios:

1. **Given** the artwork `model.NewArtworkID(model.KindArtistArtwork, "1234")`, **When** it is
   encoded with `EncodeArtworkID` and the result is decoded with `DecodeArtworkID`, **Then** the
   same artwork id comes back with no error.
2. **Given** a token made by `EncodeArtworkID`, **When** its claims are read, **Then** they hold a
   string `id` claim and no `size` claim.
3. **Given** a public link without a `size` parameter, **When** it is opened, **Then** the original
   image is served.

More scenarios:

1. **Given** the string `"xx-123"`, **When** it is decoded, **Then** the error matches "invalid
   JWT".
2. **Given** the token of an encoded empty `model.ArtworkID{}`, **When** it is decoded, **Then** the
   error matches "invalid artwork id".
3. **Given** a validly signed public token with no `id` claim, **When** it is decoded, **Then** an
   error is returned.
4. **Given** a validly signed public token whose `id` claim is the number 5, **When** it is decoded,
   **Then** an error is returned.

### US2: Ask for a resized public image (P2)

A client adds `?size=N` to a public link and gets the image resized to N pixels. A PNG source stays
a PNG.

Key scenarios:

1. **Given** a public link to an artist image, **When** it is opened with `?size=300`, **Then** the
   image is resized to 300 pixels.
2. **Given** a PNG source image, **When** it is resized to 15, **Then** the result is a PNG that
   decodes to 15 by 15 pixels.
3. **Given** the Subsonic artist cover link builder, **When** it is given size 200, **Then** the
   link ends in `?size=200`.

More scenarios:

1. **Given** the same builder, **When** it is given size 0, **Then** the link has no query string.

### US3: Old links keep working (P2)

A client holds a link made before this change. Its token carries `id` and `size` 0. It keeps serving
the original image.

Key scenarios:

1. **Given** a token signed with `id` "ar-1234" and `size` 0, **When** its link is opened, **Then**
   the original image is served and the `size` claim is ignored.

## Architecture

The token code moves into `core/artwork`, as two public functions. The public endpoint and the link
builder call them. See [what happens to `PublicLink`](discovery-01.md#what-happens-to-publiclink)
and [where the size goes](discovery-01.md#where-the-size-goes).

- **`EncodeArtworkID(artID) string`** in [`core/artwork/artwork.go`](/core/artwork/artwork.go) signs
  a public token with one string claim, `id`. It replaces `PublicLink`, which is removed.
- **`DecodeArtworkID(token) (ArtworkID, error)`** in the same file verifies the token and requires a
  string `id` claim. It owns the rule of which claims a public token holds. Each failure has its own
  message: "invalid JWT" for an unverifiable token, and "invalid artwork id" for an unparseable id.
  A missing or non-string `id` fails too.
- **The public image handler** in
  [`server/public/public_endpoints.go`](/server/public/public_endpoints.go) decodes the token with
  `DecodeArtworkID`, reads an optional `size` query parameter that defaults to 0, and serves the
  image. It no longer requires a `size` claim. A bad token still answers 404.
- **The artist cover link builder** in [`server/subsonic/helpers.go`](/server/subsonic/helpers.go)
  calls `EncodeArtworkID`, and appends `?size=N` when N is above 0.
- **Resizing** in [`reader_resized.go`](/core/artwork/reader_resized.go) is unchanged: it already
  keeps the source format. A new test covers a PNG at 15.

Tradeoffs:

- The link builder gains a size option that no caller uses yet. It is the way the proposal's query
  parameter is reachable from a built link.
- A public size has no cap, so one image can be cached at many sizes.

## Edge cases

| Importance | Situation                                         | What happens                                       |
| ---------- | ------------------------------------------------- | -------------------------------------------------- |
| High       | A token carries a `size` claim from an old link   | it verifies, and the claim is ignored              |
| High       | A bad, unsigned, or id-less token on the endpoint | the endpoint answers 404, as today                 |
| Normal     | The `size` parameter is missing                   | the original image is served                       |
| Normal     | The `size` parameter is not a number              | it counts as 0, as `getCoverArt` does for its size |
| Niche      | An empty artwork id is encoded                    | the token is made, and decoding it fails           |

## Success criteria

- **SC-001** (round trip): Decoding the token of a valid artwork id returns that same id.
- **SC-002** (no size): A token from `EncodeArtworkID` has no claim but `id` and the signer's
  standard claims.
- **SC-003** (errors): Each of the four failures, an unverifiable token, a missing `id`, a
  non-string `id`, and an unparseable id, returns a non-nil error, with the two fixed messages.
- **SC-004** (PNG): A PNG resized to 15 is a PNG of 15 by 15 pixels.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Your answers keep their wording: size is handled separately as an HTTP query
parameter, with no cap and with old tokens accepted. Settled while writing this spec:

- **The signer's own claims** (issuer and issued-at) stay in the token. `auth.CreatePublicToken`
  adds them, and the proposal's "only the id" is about claims this feature sets.
- **A non-numeric `size`** counts as 0, because the endpoint reads it the way `getCoverArt` does
  with `utils.ParamInt`.
- **Unverified**: the exact error text of the JWT library for `"xx-123"`. The decoder wraps it with
  "invalid JWT", and the plan's first test run confirms the match.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: the format of a public, login-free token changes, and a size parameter opens resizing to
anyone with a link.
