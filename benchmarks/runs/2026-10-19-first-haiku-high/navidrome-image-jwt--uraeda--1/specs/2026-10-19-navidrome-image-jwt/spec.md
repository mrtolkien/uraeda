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
> - You approve that public artwork links carry only the artwork, and a `size` query parameter sets
>   the image size, up to 1000 pixels.
> - Size limit: 1000 pixels. You left it to the agent, which took the recommended option. A larger,
>   missing, or invalid size serves the original image.
> - Relaxed guard: anyone holding a public link can make the server cache up to 1000 resized copies
>   of its image, one per size. Each new size costs a resize, so a shared link can fill the image
>   cache and use CPU.
> - Settled while writing: a link that fails verification still gets "Not Found", as it does today.
> - Risk tier medium, and the plan does not wait for review.

Navidrome gives out public links to artwork, `/p/img/<token>`, which do not expire. Each link
carries a token, a JWT: a signed string holding the artwork's ID and an image `size`. Every link
built today has size 0, so no link resizes its image. This feature moves the size out of the token
into a `size` query parameter, so a link names only the artwork. The change is described in the
[proposal](proposal.md), investigated in the [discovery](discovery-01.md), and settled in the
[clarifications](clarifications-01.md). Subsonic responses give artists their image as one of these
links, in `artistImageUrl`.

## Decisions

No decision is created, changed, or removed: the ledger in `specs/decisions/` has none yet.

Relied on: no decision applies to this feature.

## User stories

### US1: An artist's public image keeps working (P1)

A listener's app shows an artist's image from its public link. It fetches the link as it is, and
gets the artwork as stored. This holds for links issued before this change, and for links issued
after it.

Why this priority: every link already handed out depends on it, so it ships first.

Key scenarios:

1. **Given** an artist with a 16 by 16 pixel PNG cover, **When** a client fetches the link without
   `size`, **Then** that PNG is served unchanged.
2. **Given** a link from before this change, with a token `size` of 300, **When** a client fetches
   it without a `size`, **Then** the original is served.
3. **Given** a link whose signature does not verify, **When** a client fetches it, **Then** the
   server answers `404 Not Found`, as it does today.

### US2: A client asks for a smaller image (P2)

A client that shows a small picture adds `size` to the link, and gets the artwork resized. The
longer side becomes the requested size, and the other side keeps the image's proportions. The image
keeps its format.

Key scenarios:

1. **Given** a 16 by 16 pixel PNG, **When** a client asks for `size=15`, **Then** the server returns
   a 15 by 15 pixel PNG.
2. **Given** a 1200 by 600 pixel PNG, **When** a client asks for `size=300`, **Then** the server
   returns a 300 by 150 pixel PNG.
3. **Given** a 1200 by 600 pixel image, **When** a client asks for `size=1001`, **Then** the server
   returns the original image.

More scenarios:

4. **Given** a 1200 by 600 pixel image, **When** a client fetches the link with `size=1000`,
   **Then** the server returns a 1000 by 500 pixel image.
5. **Given** a link fetched with `size=abc`, `size=0`, or `size=-5`, **When** the client reads the
   response, **Then** it is the original image, with status `200 OK`.
6. **Given** a JPEG image, **When** a client fetches the link with `size=300`, **Then** the server
   returns a JPEG whose longer side is 300 pixels.

## Architecture

The public link becomes a plain identity: the artwork's ID, with no presentation detail. The size is
a property of each request, so it moves to the query, where the client that asks for it sets it.
This follows [the discovery's rules and their owners](discovery-01.md#rules-and-their-owners). The
image cache and the resizer stay as they are. The cache already keeps each size as its own file, and
the resizer already keeps the format.

- **The link encoder** (`EncodeArtworkID`) turns an artwork ID into a token that carries only the
  `id` claim. It replaces [`PublicLink`](/core/artwork/artwork.go#L112-L117), and owns the link's
  format.
- **The link decoder** (`DecodeArtworkID`) owns token validity: the signature, the required `id`
  claim, its type, and the artwork ID it names. Every verification failure reports as "invalid JWT",
  so callers get one error for a bad link.
- **The public image route** decodes each link, and answers `404 Not Found` for any failure, as
  [today's checks](/server/public/public_endpoints.go#L91-L103) do. It reads the `size` query, and
  owns the size rule: a whole number from 1 to 1000 resizes, and anything else serves the original.
- **The Subsonic link builder** (`artistCoverArtURL`) builds links from the artwork alone. Its size
  argument goes, since every caller passes 0 today.

Tradeoffs:

- A link holder can ask for any of 1000 sizes, so one artwork can take up to 1000 cached files.
- Tokens already in clients' hands keep their `size` claim. The claim is ignored, so it stays as a
  dead field.
- The 1000-pixel limit is a number to change if larger sizes are wanted later.

## Edge cases

| Importance | Situation                                                                   | What happens                                                |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Normal     | A link whose signature does not verify                                      | Answers `404 Not Found`, as today                           |
| Normal     | A link with no `id` claim, or whose `id` is not an artwork ID               | Answers `404 Not Found`, as today                           |
| Normal     | A link issued before this change, with a `size` claim                       | Verifies, and the claim is ignored                          |
| Normal     | A `size` that is missing, zero, negative, not a whole number, or above 1000 | Serves the original image                                   |
| Normal     | A `size` larger than the image                                              | Enlarges the image to that size, as resizing does today     |
| Normal     | An image that cannot be decoded for resizing                                | Serves the image as stored, as today                        |
| Normal     | The artwork was deleted                                                     | Answers `404 Not Found`, "Artwork not found", as today      |
| Normal     | Requests for every size from 1 to 1000, for one artwork                     | One cached file per size, up to 1000 files for that artwork |

## Success criteria

- **SC-001** (original bytes): A link with no `size` returns the artwork's stored bytes.
- **SC-002** (every size): Each whole size from 1 to 1000 returns an image whose longer side is that
  size.
- **SC-003** (round trip): Each token from `EncodeArtworkID` decodes to the same artwork ID.
- **SC-004** (error text): A token that fails verification gives "invalid JWT". A valid token with
  an unusable `id` gives "invalid artwork id", and one with no `id` gives an error.
- **SC-005** (no panic): No link that fails decoding makes the server panic.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- A size is a whole number of pixels, from 1 to the 1000 limit. A larger size, or a missing or
  invalid one, serves the original, as the size limit's answer says.
- A size above the image enlarges it, as the resize does today.
- A new token keeps the issuer and issued-at claims that every token has.
- A PNG stays a PNG and a JPEG stays a JPEG when resized, as the code does today.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: public link tokens change format, and old links keep working. The size guard is relaxed,
but bounded to 1000 pixels. No stored data changes.
