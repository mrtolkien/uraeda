---
status: proposed
approved-by:
icon: key-round
---

# Sign-in

Uraeda's server has one owner, who signs each browser in once with a key the server generates. Every
route is closed without a session, except the few that cannot carry a cookie, which prove themselves
with a secret instead. Nothing but code turns sign-in off.

## Rules

- Every request MUST carry a valid session, except the built UI's files, the `/session` routes,
  `/open` and `/session/key` with the host token, and preview and mockup paths with the current
  frame secret. Checked by a table-driven test over every route.
- The server MUST have one access key of 32 random bytes, shown only once and never stored: its
  SHA-256 hash and the sessions live only in one `0600` file in the data folder, replaced
  atomically. Checked by the sign-in store's tests.
- A session MUST be a random token of at least 128 bits, stored hashed, sent only in an `HttpOnly`,
  `SameSite=Lax` cookie, named `__Host-uraeda` and `Secure` over HTTPS. Checked by the sign-in
  routes' tests.
- A session MUST end 30 days after its last use, at sign-out, or when the key changes, and signing
  out MUST end its live streams. Checked by the sign-in routes' tests.
- A failed sign-in MUST wait at least one second before answering, and be logged with the request's
  address, never the key typed. Checked by the sign-in routes' tests.
- The frame secret MUST be 32 random bytes, made at each start, replaced whenever a session ends,
  and given only to signed-in pages. Checked by the preview proxy's and the files' tests.
- A process the server runs, like a Storybook, MUST NOT receive Uraeda's cookie or an
  `Authorization` header. Checked by the preview proxy's tests.
- The server MUST NOT treat a request as signed in for its address, `Host`, or a proxy's header, and
  a public address MUST reach it through a same-machine proxy that ends TLS. Checked by review.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting: only code MAY
  build an app without it, for tests and Uraeda's own Storybook fixture. Checked by review.

## Why

The server commits, starts agents, and runs project code, and its owner reaches it from several
devices and one day a public address ([the proposal](../done/2026-10-16-basic-security.md)). A
generated key cannot be guessed, so it needs no lockout an attacker could turn against the owner
([what you sign in with](../done/2026-10-16-basic-security.md#q1-what-do-you-sign-in-with)). No
address or header proves the sender, since proxies connect from 127.0.0.1 and can forge headers
([trusting the tailnet](../done/2026-10-16-basic-security.md#q4-does-your-tailnet-sign-you-in)).
Sandboxed frames get no `Lax` cookie and share one Storybook, so they share one secret in their path
([how previews prove themselves](../done/2026-10-16-basic-security.md#q6-how-do-previews-and-mockups-prove-they-come-from-you)).

## Alternatives considered

- A password the owner chooses: guessable, and any limit on failures lets an attacker lock the owner
  out.
- Passkeys: the strongest, kept for a later feature, on top of the key.
- Trusting `127.0.0.1` or Tailscale's identity: a full bypass behind a misconfigured or second
  proxy.
- One secret per session in preview paths: impossible while one Storybook serves every session.

## Consequences

- Every device signs in once, and stays signed in while used at least every 30 days.
- A lost key is replaced from the host's shell, which signs every device out, and any sign-out
  restarts the running Storybooks under a new address.
- Every new route is closed by default: a route that cannot carry a cookie needs a change to this
  decision.

## Applies to

- [`packages/server/`](/packages/server/), and every feature that adds a route, a WebSocket, or a
  process the server runs
- [`packages/web/`](/packages/web/), for the sign-in screen and the frames' addresses
