# Rulings: Remove size from public image ID JWT

## R1: Decode with `TokenAuth.Decode`, not `jwtauth.VerifyToken`

- **Decided**: `DecodeArtworkID` calls `auth.TokenAuth.Decode`, then `jwt.Validate`.
- **Why**: the spec's unverified assumption was wrong. `VerifyToken` answers `token is unauthorized`
  for `"xx-123"`, and `Decode` gives the required `invalid JWT`.
- **Alternatives**: wrapping the `VerifyToken` error into `invalid JWT`, which would hide other
  failures.
- **If wrong**: a token error would carry the library's text, and the endpoint still answers 404.

## R2: A short read is valid in `asImageReader`

- **Decided**: `asImageReader` in `core/artwork/reader_resized.go` ignores `io.EOF` from
  `Peek(512)`.
- **Why**: the plan expected the size 15 test to pass already. A 15 pixel PNG is under 512 bytes, so
  the helper dropped its format. The same would fail the resize of a source image under 512 bytes.
- **Alternatives**: leaving the helper alone and changing the test, which would hide the bug.
- **If wrong**: a truncated image is detected from fewer bytes, and decoding it fails as before.
