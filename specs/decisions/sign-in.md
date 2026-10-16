---
status: active
approved-by: mrtolkien
icon: key-round
---

# Sign-in

Uraeda's server has one owner, who signs each browser in once with an access key the server
generates. Sessions are stored on the server and survive restarts, and every route needs one, except
the few that cannot carry a cookie: the UI's own files, signing in, the host's own calls, and the
frames of previews and mockups, which carry a secret in their path instead. Nothing turns sign-in
off but code, for tests.

## Rules

- Every request MUST carry a valid session, except: the built UI's files, the `/session` routes,
  `/open` and `/session/key` with the host token, and preview and mockup paths with the current
  frame secret. Checked by a table-driven test over every route of the app.
- The server MUST have one access key: 32 random bytes, shown as `ura_` and 43 base64url characters.
  It MUST store only its SHA-256 hash, and MUST show the key only once, when it is made. Checked by
  the sign-in store's tests.
- The key, sessions, and their hashes MUST live in one file, `sign-in.json` in the data folder,
  written with mode `0600` and replaced atomically. They MUST NOT be stored anywhere else. Checked
  by the sign-in store's tests.
- A session MUST be a random token of at least 128 bits, stored as a hash, sent only in an
  `HttpOnly`, `SameSite=Lax` cookie, never in a URL or a response body. Over HTTPS the cookie MUST
  be `__Host-uraeda` with `Secure`. Checked by the sign-in routes' tests.
- A session MUST end 30 days after its last use, when it is signed out, or when the key changes.
  Signing a session out MUST end its live streams. Checked by the sign-in routes' tests.
- A failed sign-in MUST wait at least one second before its answer, and MUST be logged with the
  request's address, never with the key typed. Checked by the sign-in routes' tests.
- Preview and mockup paths MUST carry the frame secret, 32 random bytes made at each start and
  replaced whenever a session ends. Only signed-in pages MAY receive it, through fate. Checked by
  the preview proxy's and the files' tests.
- A process the server runs, like a Storybook, MUST NOT receive Uraeda's cookie or an
  `Authorization` header. Checked by the preview proxy's tests.
- The server MUST NOT treat a request as signed in because of its address, its `Host`, or a header
  set by a proxy, like Tailscale's identity headers. Checked by review.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting. Only code MAY
  create an app without it, for tests and Uraeda's own Storybook fixture. Checked by review.
- A public address MUST reach the server through a proxy on the same machine that ends TLS, like
  Caddy or Tailscale Funnel. Checked by review.

## Why

The server commits, starts agents, and runs project code, and the human wants to reach it from a
phone and a laptop, and one day from a public address
([proposal](../done/2026-10-16-basic-security.md)). A generated key cannot be guessed, so a public
server needs no lockout an attacker could turn against its owner, and it is the stable key the
proposal asked for ([Q1](../done/2026-10-16-basic-security.md#q1-what-do-you-sign-in-with),
[the credential](../done/2026-10-16-basic-security.md#q1-what-do-you-sign-in-with)). Sessions on the
server let one device be signed out
([Q2](../done/2026-10-16-basic-security.md#q2-how-long-does-a-device-stay-signed-in-and-how-is-it-signed-out)).

No address, `Host`, or proxy header proves who sends a request: every proxy connects from 127.0.0.1,
NGINX rewrites `Host` by default, and a second proxy passes a forged Tailscale header
([Q3](../done/2026-10-16-basic-security.md#q3-does-a-browser-on-this-machine-sign-in-too),
[Q4](../done/2026-10-16-basic-security.md#q4-does-your-tailnet-sign-you-in)).

Frames sandboxed without `allow-same-origin` get no `Lax` or `Strict` cookie in Chromium and
Firefox, so previews and mockups prove themselves with a secret in their path. A Storybook bakes its
address in when it starts, so the secret is shared by every session and replaced whenever one ends
([Q6](../done/2026-10-16-basic-security.md#q6-how-do-previews-and-mockups-prove-they-come-from-you),
[cookies in sandboxed frames](../done/2026-10-16-basic-security.md)).

## Alternatives considered

- A password the owner chooses: easier to type, but guessable, and any limit on failures lets an
  attacker keep the owner out.
- Passkeys: the strongest, kept for a later feature, on top of the key.
- Trusting `127.0.0.1` or Tailscale's identity: no sign-in at home, but a full bypass behind a
  misconfigured or second proxy.
- One secret per session in preview paths: impossible while one Storybook serves every session.

## Consequences

- Every device signs in once, then stays signed in while it is used at least every 30 days.
- A lost key is replaced from the host's shell, which signs every device out.
- Signing a device out restarts the running Storybooks, under a new address.
- Every new route is closed by default; a route that cannot carry a cookie needs a change to this
  decision.
- Tests and fixtures create the app without sign-in, and the sign-in tests create it with a key.

## Applies to

- [`packages/server/`](/packages/server/), and every feature that adds a route, a WebSocket, or a
  process the server runs
- [`packages/web/`](/packages/web/), for the sign-in screen and the frames' addresses
