# Data model: Remove size from public image ID JWT

The formats that [the spec](spec.md) changes. Neither is stored by the server, but Subsonic clients
keep the links they receive, so both stay readable as they were. Internal types are the plan's.

## Public image token

The JWT in the path of a public image link, `/p/img/<token>`, signed with the server's secret by
[`auth.CreatePublicToken`](/core/auth/auth.go). It has no expiry.

| Field  | Type   | Meaning                                                    | Change  |
| ------ | ------ | ---------------------------------------------------------- | ------- |
| `id`   | string | the artwork ID, like `ar-1234`; required to open an image  |         |
| `size` | number | the image size; always `0` in tokens issued so far         | Removed |
| `iss`  | string | the issuer, `ND`                                           |         |
| `iat`  | number | when the token was issued, in seconds since the Unix epoch |         |

A token issued before the feature still carries `size`: the decoder ignores it.

## Public image link

The URL a Subsonic client receives in `artistImageUrl`, and opens without logging in.

| Field          | Type    | Meaning                                                                 | Change |
| -------------- | ------- | ----------------------------------------------------------------------- | ------ |
| path `<token>` | string  | the public image token above                                            |        |
| query `size`   | integer | the size to resize to; missing, malformed, or `0` and below is original | New    |
