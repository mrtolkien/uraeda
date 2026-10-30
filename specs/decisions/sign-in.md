---
status: active
approved-by: mrtolkien
icon: key-round
---

# Sign-in

Uraeda's server has one owner, who signs each browser in once with a key the server generates. The
server listens only on its own machine, and accepts only requests from Uraeda's own pages, or from
the frames that show previews when they carry a secret it gave them. Nothing but code turns sign-in
off.

## Rules

- Every request MUST carry a valid session, except the built UI's files, the sign-in routes, and the
  preview paths that carry the current frame secret. Checked by a table-driven test over every
  route.
- The server MUST listen only on the loopback interface, accepting only requests made by Uraeda's
  own pages or by frames carrying the frame secret. Checked by the guard's tests.
- The access key and the sessions MUST be random and stored only as hashes, the key shown once.
  Checked by the sign-in store's tests.
- A session MUST end after 30 days without use, at sign-out, or when the key changes, along with its
  live streams. Checked by the sign-in routes' tests.
- A failed sign-in MUST cost a guesser time without ever locking the owner out. Checked by the
  sign-in routes' tests.
- The frame secret MUST change whenever a session ends, and reach only signed-in pages. Checked by
  the preview proxy's tests.
- Previews MUST run in a sandbox apart from Uraeda's pages, unable to save, create, or open files.
  Checked by the preview proxy's and the embed's tests.
- A process the server runs MUST NOT receive Uraeda's credentials. Checked by the preview proxy's
  tests.
- The server MUST NOT treat an address, a `Host`, or a proxy header as proof of identity. Checked by
  review.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting: only code builds
  an app without it, for tests, Storybook, and the [sandbox](sandbox.md). Checked by review.

## Why

The server commits, starts agents, and runs project code, and its owner reaches it from several
devices, one day from a public address. A generated key cannot be guessed, so it needs no lockout an
attacker could turn against the owner. Proxies connect from the machine itself and can forge
headers, so no address proves the sender. Preview frames cannot carry the sign-in cookie, so they
prove themselves with a secret. History: [Basic security](../done/2026-10-16-basic-security.md).

## Alternatives considered

- A password the owner chooses: guessable, and any limit on failures lets an attacker lock the owner
  out.
- Trusting `127.0.0.1` or Tailscale's identity: a full bypass behind a misconfigured or second
  proxy.
- One secret per session in preview paths: impossible while one Storybook serves every session.

## Consequences

- Every device signs in once, and stays signed in while used at least every 30 days. A lost key is
  replaced from the host's shell, which signs every device out.
- A public address needs a proxy on the same machine that ends TLS, and anyone signed in can allow a
  new host name.
- A story can read any checkout's preview and mockup paths, and make Storybook show another story,
  but nothing more.
- Every new route is closed by default: a route that cannot carry a cookie needs a change to this
  decision.

## Applies to

- [`packages/server/`](/packages/server/), and every feature that adds a route, a WebSocket, or a
  process the server runs
- [`packages/web/`](/packages/web/), for the sign-in screen and the previews' frames
