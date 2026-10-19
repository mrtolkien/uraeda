# Inbox

## Security

- [agent] [navidrome-image-jwt] Neither image endpoint caps the `size` it resizes to: `getCoverArt`
  and the public `/p/img/` link both accept any size, and a size like 30000 makes the server
  allocate gigabytes

## Tooling

- [agent] [navidrome-image-jwt] `make lint` cannot pass: `core/agents/agents_test.go` uses
  `placeholderBiography` and the `placeholderArtistImage*Url` names, which no longer exist, and
  golangci-lint v1.50.1 panics under Go 1.20 and later ("unsupported version: 2"), so it only runs
  with Go 1.19

## Deferred fixes

- [agent] [navidrome-image-jwt] The public endpoint's "session token" 404 test passes because the
  token is already expired (`SessionTimeout` is 0 in tests), not because it lacks `id`; set
  `SessionTimeout` to an hour in that entry
- [agent] [navidrome-image-jwt] `DecodeArtworkID`'s `WithRequiredClaim("id")` is untested: a missing
  `id` also fails the string check; assert the required-claim error text
- [agent] [navidrome-image-jwt] No test pins that `asImageReader` accepts `io.EOF` only: a reader
  failing with another error, like `iotest.ErrReader`, would
- [agent] [navidrome-image-jwt] The public endpoint formats the decoded artwork ID back to a string
  for `Artwork.Get`, which parses it again
