# Rulings: Remove size from public image ID JWT

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Every unusable artwork ID gives "invalid artwork id"

- **Decision**: `DecodeArtworkID` returns exactly `invalid artwork id` for any `id` claim that
  `model.ParseArtworkID` rejects, including an unknown kind. `ParseArtworkID` alone would return
  `invalid artwork kind` for that case.
- **Rationale**: the spec's success criterion SC-004 says a valid token with an unusable `id` gives
  `invalid artwork id`. The proposal names the same text for an unparseable artwork ID.
- **Alternatives considered**: pass `ParseArtworkID`'s messages through. That keeps more detail for
  a log reader, but it breaks SC-004 for unknown kinds.
- **If wrong**: the cost is one message. The error wrap in `DecodeArtworkID` is the only place to
  change.
- **Where**: Task 1, `core/artwork/artwork.go`.

## R2: An empty ID after its kind is an unusable artwork ID

- **Decision**: `DecodeArtworkID` rejects a token whose `id` is `ar-`, with an empty ID part, as
  `invalid artwork id`.
- **Rationale**: `ParseArtworkID` accepts `ar-` as kind `artist` with an empty ID. No link the
  server builds has that form, since `ArtworkID.String()` gives `""` for an empty ID. The route
  would otherwise look up an artwork with no ID.
- **Alternatives considered**: accept it, as `ParseArtworkID` does. Then the route serves the
  placeholder for a link no one was given.
- **If wrong**: a link of this form would get `404 Not Found` instead of a placeholder. No stored
  link has this form, so no user sees a change.
- **Where**: Task 1, `core/artwork/artwork.go`.

## R3: Messages for a missing or non-string `id` claim

- **Decision**: a token with no `id` claim gives `missing id claim`, and one whose `id` is not a
  string gives `invalid id claim type`.
- **Rationale**: the proposal requires an error for both cases and names no text, so each has a
  message that says which check failed. The route answers `404 Not Found` for both, so no caller
  sees the text.
- **Alternatives considered**: one shared text, `invalid artwork id`. It hides which claim failed.
- **If wrong**: the cost is a message. No caller compares these texts.
- **Where**: Task 1, `core/artwork/artwork.go`.

## R4: `EncodeArtworkID` ignores the signing error

- **Decision**: `EncodeArtworkID` returns the token and drops the error from
  `auth.CreatePublicToken`, as `PublicLink` did.
- **Rationale**: the proposal fixes the signature as `(model.ArtworkID) string`, with no error to
  return. The signing with a configured HS256 key does not fail in practice.
- **Alternatives considered**: panic on a signing error. That turns a failure into a crash of the
  request that builds a Subsonic response.
- **If wrong**: a failed signature gives an empty link, which the route answers with
  `404 Not Found`. The failure is then visible as a broken image, not a crash.
- **Where**: Task 1, `core/artwork/artwork.go`.

## R5: A small image is resized too

- **Decision**: `asImageReader` ignores `io.EOF` from its 512-byte peek, so an image under 512 bytes
  is resized like any other. Before, it failed the resize and was served at its original size.
- **Rationale**: the spec's US2 scenario 1 says a 16 by 16 PNG at `size=15` returns a 15 by 15 PNG.
  A single-colour PNG of that size is under 512 bytes, so the old code broke the rule for it. The
  fixture `front.png` is 3949 bytes and hid the problem. The fix meets the spec's rule and adds no
  choice the human must make.
- **Alternatives considered**: keep serving small images as stored. That contradicts US2 scenario 1
  and SC-002 for every small file.
- **If wrong**: revert the one changed line, and small images are served at their original size
  again.
- **Where**: Task 2, `core/artwork/reader_resized.go`. The plan's Task 2 changed from tests-only to
  a tests-first fix, and its text was edited to say so. The resize test of the 1000 sizes takes
  about 4 seconds in the artwork suite.

## R6: A size with a leading plus or zeros is a whole number

- **Decision**: `imageSize` parses the `size` query with `strconv.Atoi`, so `+15` and `015` resize
  to 15, as the whole number they spell. `15.5`, a space, an empty value, and a lone `+` serve the
  original.
- **Rationale**: the spec says a size is a whole number from 1 to 1000, and `+15` and `015` are that
  number. `Atoi` is the standard parse, and it rejects everything else the spec rules out.
- **Alternatives considered**: accept only plain digits. That would make `+15` serve the original,
  which the spec does not ask for.
- **If wrong**: the cost is the same as any size: one cached file for that size. Tightening the
  parse is a one-line change in `imageSize`.
- **Where**: Task 3, `server/public/public_endpoints.go`.
