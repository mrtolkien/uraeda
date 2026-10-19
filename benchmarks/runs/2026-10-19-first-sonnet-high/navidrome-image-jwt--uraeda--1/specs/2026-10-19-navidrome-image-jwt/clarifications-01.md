---
status: answered
---

# Clarifications, round 01: Remove size from public image ID JWT

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, a small change that decouples the token from the size.
> - Unsigned size: anyone holding one image URL can now ask for any size, and make the server resize
>   and cache each one.
> - Old image URLs: clients may hold URLs whose token still carries a size, valid for up to ten
>   years.
> - Size parameter: its name is not in the proposal, and I propose `size`, like the Subsonic API.
> - Settled to check: the helper `PublicLink` is replaced, not kept.

## Context

### Goal

Artist image links carry a signed token. Today it holds the artwork ID and the size. The proposal
keeps only the ID in the token, and sends the size as a query parameter. It adds `EncodeArtworkID`
and `DecodeArtworkID`, and keeps PNG sources as PNG after resizing.

### Today

- [`PublicLink`](/core/artwork/artwork.go) signs `id` and `size` into the token.
- [`validator` and `handleImages`](/server/public/public_endpoints.go) require both claims on
  `/img/{jwt}`.
- [`GetCoverArt`](/server/subsonic/media_retrieval.go) reads `size` from the query, with no maximum.
- PNG sources already stay PNG: [tests](/core/artwork/artwork_internal_test.go) cover sizes 300
  and 200.
- Images are cached by clients for ten years (`max-age=315360000`).

### Scope

Covers the token, its two functions, the public endpoint, the artist image URL helper, and tests.
Leaves out the Subsonic `getCoverArt` endpoint, the image cache, and any change to resizing.

### Sources

- The code linked above, and the `jwtauth` v5.1.0 and `jwx` v2.0.8 sources in the Go module cache.
- Not researched online: the proposal fixes the design. The full investigation is in
  [discovery](discovery-01.md).

## Q1: How should the public image endpoint accept the size, now that it is not signed?

Today the size is inside the signed token, so nobody can change it. After the change the size is a
plain query parameter on `/img/{jwt}`, and anyone with one valid URL can ask for any size. Each new
size is resized, then stored in the image cache. A huge size also costs memory and time. The
Subsonic [`getCoverArt`](/server/subsonic/media_retrieval.go) already works this way with no limit,
but it needs a login. More in [discovery](discovery-01.md#size-in-the-url).

Why it matters: it decides how exposed the public endpoint is, and whether the change adds a limit
the proposal did not ask for.

B and C add behaviour on top of what the proposal lists.

- **A (recommended). Read an optional `size` query parameter as a whole number, with the same rule
  as the Subsonic `getCoverArt`: missing means the original image, and no maximum.**
  - [pro] exactly what the proposal asks for, with no new behaviour.
  - [pro] one rule for both endpoints.
  - [con] anyone holding one URL can make the server resize and cache many sizes.
  - Why recommended: it follows the proposal, and the constitution forbids adding features it does
    not ask for.
- **B. Same as A, and a request above a fixed maximum size fails.**
  - [pro] bounds the cost of one request.
  - [con] a new limit, and a constant to choose and to document.
  - [con] still allows many different sizes below the maximum.
- **C. Same as A, and only a fixed list of sizes is served, any other size fails.**
  - [pro] the cache holds a bounded set of entries per image.
  - [con] clients with their own sizes break, and the list is a new rule.

**Answer:** A

## Q2: What happens to image URLs whose token already carries a size?

Servers already running hand out URLs with the old token, and clients or proxies may keep them for
ten years. The new decoder reads only `id`, so these tokens still verify. More in
[discovery](discovery-01.md#old-tokens).

Why it matters: it decides whether existing links keep working, and at which size.

C adds a branch that is removed later, and it is not in the proposal.

- **A (recommended). Accept old tokens and ignore their `size` claim, so they serve the original
  image unless a `size` query parameter is sent.**
  - [pro] no link breaks, and no code is kept for the old format.
  - [con] a client holding an old sized URL now downloads the full-size image.
  - Why recommended: artist image URLs are built with size 0 today, so most old tokens already mean
    the original size.
- **B. Reject old tokens, so they answer 404.**
  - [pro] one format only.
  - [con] every cached artist image link breaks until the client asks for the artist again.
- **C. Accept old tokens, and use their `size` claim when no `size` query parameter is sent.**
  - [pro] old links keep their exact size.
  - [con] the token's old format stays in the code, against the proposal's aim.

**Answer:** A

## Q3: Is `size` the right name for the query parameter?

The proposal says "an HTTP query parameter" without a name. The Subsonic API uses `size`.

Why it matters: the name becomes part of the public image URL that clients may store.

- **A (recommended). Name it `size`, like the Subsonic `getCoverArt` endpoint.**
  - [pro] the same word in both APIs.
  - [con] none found.
  - Why recommended: it is the existing convention.
- **B. Use another name, which you write in the answer.**
  - [pro] free choice.
  - [con] differs from the Subsonic API.

**Answer:** A

## Settled without the human

### Check these

- **Public link helper** is replaced by `EncodeArtworkID`, and `PublicLink` is removed. The proposal
  names only the new functions, and `PublicLink(artID, size)` would keep a size it no longer uses.
  See [discovery](discovery-01.md#public-link-helper).
- **Scope of the resize test** adds a size 15 case. The behaviour already exists, so no resize code
  changes. See [discovery](discovery-01.md#the-code).

### Behaviour

- **Invalid size value** (not a whole number, or negative) behaves as `getCoverArt` does today, with
  the same parsing helper, so the two endpoints answer alike.
- **Artist image URLs** in Subsonic responses are built with size 0, so they carry no `size`
  parameter.
- **Errors on the public endpoint**: a token that fails `DecodeArtworkID` answers 404, as the
  validator does today.

### Under the hood

- **Token claims** are written and read only in `core/artwork`, so the claim name `id` has one home.
- **Error texts** of `DecodeArtworkID` keep the messages of the libraries, `invalid JWT` and
  `invalid artwork id`, as the requirements spell them. The plan checks the first with a test.

**Notes:**
