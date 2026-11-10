---
status: proposed
approved-by:
icon: key-round
---

# Sign-in

Uraeda's server has one owner. A browser signs in once with a key the server generates, and another
device pairs once with a one-time code, then signs in with a token of its own, which the owner can
revoke. The server listens only on its own machine, and nothing but code turns sign-in off.

## Rules

- Every request MUST carry a valid session or device token, except the built UI's files, the sign-in
  and pairing routes, and the preview paths that carry the current frame secret. Checked by a
  table-driven test over every route.
- The server MUST listen only on the loopback interface, accepting only requests made by Uraeda's
  own clients or by frames carrying the frame secret. Checked by the guard's tests.
- The access key, the pairing codes, the sessions, and each device's token MUST be random and stored
  only as hashes, the key shown once and a pairing code used once. Checked by the sign-in store's
  tests.
- A session MUST end after 30 days without use, at sign-out, when the key changes, or when the owner
  revokes its device, along with its live streams. Checked by the sign-in routes' tests.
- A failed sign-in MUST cost a guesser time without ever locking the owner out. Checked by the
  sign-in routes' tests.
- The frame secret MUST change whenever a session ends, and reach only signed-in pages. Checked by
  the preview proxy's tests.
- Previews MUST run in a sandbox apart from Uraeda's pages, unable to save, create, or open files.
  Checked by the preview proxy's and the embed's tests.
- A process the server runs MUST NOT receive Uraeda's credentials. Checked by the preview proxy's
  tests.
- The server MUST NOT treat an address, a `Host`, or a proxy header as proof of identity.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting: only code builds
  an app without it, for tests, the gallery, and the [sandbox](sandbox.md).

## Why

The server commits and starts agents, and its owner reaches it from several devices, through their
own tunnel. A generated key cannot be guessed, so it needs no lockout an attacker could turn against
the owner. A token per device lets a lost one be revoked alone. Proxies connect from the machine
itself and can forge headers, so no address proves the sender. Preview frames carry no cookie, so
they prove themselves with a secret. History:
[Basic security](../done/2026-10-16-basic-security.md).

## Alternatives considered

- A password the owner chooses: guessable, and any limit on failures lets an attacker lock the owner
  out.
- Trusting `127.0.0.1` or Tailscale's identity: a full bypass behind a misconfigured or second
  proxy.
- One secret per session in preview paths: impossible while one Storybook serves every session.

## Consequences

- Every device signs in or pairs once, and stays signed in while used at least every 30 days. A lost
  key is replaced from the host's shell, which signs every device out.
- A public address needs a proxy on the same machine that ends TLS, and anyone signed in can allow a
  new host name.
- A story can read any checkout's preview and mockup paths, and make Storybook show another story,
  but nothing more.
- Every new route is closed by default: a route that cannot carry a cookie needs a change to this
  decision.

## Applies to

- `crates/server/`, and every feature that adds a route, a WebSocket, or a process the server runs
- `app/`, for the sign-in and pairing screens and the previews' frames
