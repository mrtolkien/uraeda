---
status: answered
---

# Clarifications, round 01: Remove size from public image ID JWT

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes, because a 15 pixel PNG cannot be read back today, so the
>   PNG requirement needs a small fix beyond the token.
> - Moving the size out of the token lets anyone holding one public image link ask for that image at
>   any size, including sizes large enough to exhaust the server's memory.
> - Whether to add a size cap to the public endpoint, beyond what the proposal asks.
> - Whether the project records its code-quality checks, asked once for the whole project.
> - Settled to check: old links keep working, and `PublicLink` is removed.

## Context

### Goal

Public image links should identify the artwork only. The token signs the artwork `id`, and the image
size moves to an HTTP query parameter. Subsonic clients that show artist images get these links.

### Today

- [`artwork.PublicLink(artID, size)`](/core/artwork/artwork.go) signs a JWT, a signed token, with
  the claims `id` and `size`. It is the only creator of public image tokens.
- [The public endpoint](/server/public/public_endpoints.go), `/p/img/{token}`, needs no login. It
  checks the token, reads both claims, and serves the image, resized when the size is above 0.
- [`artistCoverArtURL`](/server/subsonic/helpers.go) builds the `artistImageUrl` field of Subsonic
  responses. All three of its callers pass size 0, so every link issued so far serves the original
  image.
- [`getCoverArt`](/server/subsonic/media_retrieval.go), the logged-in Subsonic endpoint, already
  reads `size` from the query, with no cap.

### Scope

The feature covers the two new functions, the public endpoint reading `?size=`, the URL helper, and
the PNG resize down to 15 pixels. It leaves out `getCoverArt`, session tokens, and token expiry.

### Sources

- The code above, [`core/auth/auth.go`](/core/auth/auth.go),
  [`reader_resized.go`](/core/artwork/reader_resized.go), and
  [`model/artwork_id.go`](/model/artwork_id.go).
- [imgproxy, Signing a URL](https://docs.imgproxy.net/usage/signing_url),
  [thumbor, Security](https://thumbor.readthedocs.io/en/latest/security.html), and the
  [Subsonic API](https://www.subsonic.org/pages/api.jsp).
- jwtauth v5.1.0 and jwx v2.0.8, read in the Go module cache.
- The full investigation is in [discovery](discovery-01.md).

## Q1: Should the public endpoint accept any size from the query, or cap it?

Today the server alone chooses the size of a public image, since the size is signed in the token. It
always chooses 0, the original image. Once the size is a plain query parameter, anyone holding a
link chooses it.

What a link holder could then do: make the server resize one image to thousands of sizes, one
request each. Each new size costs a full decode and resize, and adds an entry to the image cache. A
single request with a very large size, like 30000, makes the server allocate several gigabytes. The
resize library builds the whole bitmap in memory, 4 bytes per pixel.

Two facts weigh against a cap here:

- Logged-in users can already do all of this through `getCoverArt`, which reads `size` with no cap.
- Public links are handed only to logged-in Subsonic clients, though they can be shared.

Image services that take a size from the URL protect it by signing it. imgproxy signs "so an
attacker won't be able to perform a denial-of-service attack by requesting multiple different image
resizes" ([imgproxy](https://docs.imgproxy.net/usage/signing_url)). thumbor calls unsigned sizes
"URL Tampering" ([thumbor](https://thumbor.readthedocs.io/en/latest/security.html)). Neither uses a
cap as its defense. More in [discovery](discovery-01.md#size-on-the-public-endpoint).

Why it matters: it decides whether the feature adds a rule the proposal does not ask for. Without a
cap, the memory risk stays open on both image endpoints until a separate change closes it.

- **A (recommended). Accept any size from the `size` query parameter, read exactly as `getCoverArt`
  reads it, with no cap. Note the missing cap of both endpoints in the inbox, for a separate
  change.**
  - [pro] stays within the proposal, as the constitution asks, and keeps one rule for both
    endpoints.
  - [con] until that change, anyone holding a public link can make the server resize at any size.
  - Why recommended: the risk already exists for every logged-in user. A cap on one endpoint only
    would leave it open on the other, and both deserve the same fix.
- **B. Cap the size on the public endpoint only, in this feature.**
  - [pro] closes the memory risk for anyone holding a public link, now.
  - [con] adds a rule beyond the proposal, and `getCoverArt` stays uncapped.

**Answer:** A. Your call, taking the recommended option.

### Q1.B: What happens to a size above the cap?

Only if you picked B in Q1. The cap would be a constant in the public endpoint. Artist images in
Subsonic clients are rarely shown above a few hundred pixels: 1200 leaves room for large screens.
More in [discovery](discovery-01.md#the-cap).

Why it matters: it decides whether a client asking for too much gets a smaller image or an error.

- **A (recommended). Serve the image at 1200 pixels when a larger size is asked for.**
  - [pro] clients always get an image.
  - [con] a client gets a smaller image than it asked for, without being told.
  - Why recommended: a client showing an image prefers a smaller one to a broken one.
- **B. Answer 400, Bad Request, when the size is above 1200 pixels.**
  - [pro] the client learns its request was refused.
  - [con] the client shows no image at all.

**Answer:** Not applicable, Q1 is A.

## Q2: Should the project record its code-quality checks as a decision?

The project has no code-quality decision yet: this is asked once, for the whole project.
[`.golangci.yml`](/.golangci.yml) enables 25 linters, run by `make lint`. One of them, `gocyclo`,
limits a function's complexity, at its default of 30. Nothing limits the length of a function, its
nesting, or a file's length. `funlen` and `nestif` are the golangci-lint linters that would. More in
[discovery](discovery-01.md#code-quality-checks).

Why it matters: the decision binds every later feature's plan and review. New linters would change
files outside this feature.

- **A (recommended). Record today's `.golangci.yml` as the project's checks, adding no new linter,
  and revisit in a year.**
  - [pro] no change outside this feature, and agents know which checks must pass.
  - [con] long or deeply nested functions stay unchecked.
  - Why recommended: adding linters goes beyond this task, which the constitution forbids. Recording
    what exists costs nothing.
- **B. Add `funlen` and `nestif` to `.golangci.yml`, with values today's code mostly meets, marking
  today's offenders in place.**
  - [pro] function length and nesting are checked from now on.
  - [con] touches files outside this feature, with offenders not yet counted.
- **C. Record that the project has no code-quality limits, and revisit in a year.**
  - [pro] the lightest record.
  - [con] the linters that already run are not named as checks to pass.

**Answer:** A. Your call, taking the recommended option.

## Settled without the human

### Check these

- **Old links** keep working: the decoder ignores a `size` claim. Every token issued so far has size
  0, so an old link serves the same original image. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **`PublicLink`** is removed, and its only caller uses `EncodeArtworkID`. Keeping both would give
  the token's rules two homes. See [discovery](discovery-01.md#rules-and-their-owners).
- **Small images** become readable: `asImageReader` accepts an input shorter than 512 bytes. A
  throwaway test showed a 15 pixel PNG is 86 bytes, and reading it back fails today. The PNG
  requirement cannot pass without it. Sources under 512 bytes, served unresized today, then resize
  too. See [discovery](discovery-01.md#the-png-requirement-fails-on-todays-code).

### Behaviour

- **The size parameter** is named `size`, like Subsonic's `getCoverArt`. A missing, malformed, or
  zero value serves the original image, as `utils.ParamInt` does there. See
  [discovery](discovery-01.md#subsonic-api).
- **The URL helper** adds `?size=` only for a size above 0. Today's callers all pass 0, so
  `artistImageUrl` keeps its shape. See [discovery](discovery-01.md#important-reads).
- **Failed requests** answer 404 for every token that cannot be decoded, as today's validator does.
  A non-string `id`, answered 400 today, becomes 404 too. See
  [discovery](discovery-01.md#important-reads).

### Under the hood

- **One home for the token** in `core/artwork`: the endpoint calls `DecodeArtworkID`, and its two
  JWT middlewares go away. See [discovery](discovery-01.md#rules-and-their-owners).
- **Error messages** are exact, so the required matches hold. Any decode failure, or a nil token,
  returns `invalid JWT`. The `id` claim is required with jwx's `WithRequiredClaim`. A non-string
  claim returns `invalid id type`. `ParseArtworkID`'s own error, `invalid artwork id` for an empty
  id, passes through unwrapped. See [discovery](discovery-01.md#go-chijwtauth-v510).
- **Tests** are Ginkgo specs next to the code: the round trip and each error in `artwork_test.go`,
  and the 15 pixel PNG in `artwork_internal_test.go`, from the 16 pixel `front.png` fixture. See
  [discovery](discovery-01.md#likely-changes).

**Notes:**
