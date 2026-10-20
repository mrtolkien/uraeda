---
status: active
approved-by: mrtolkien
icon: key-round
---

# Sign-in

Uraeda's server has one owner, who signs each browser in once with a key the server generates. Every
route is closed without a session, except the few that cannot carry a cookie, which prove themselves
with a secret instead. Nothing but code turns sign-in off.

## Rules

- Every request MUST carry a valid session, except the built UI's files, the sign-in routes, and
  preview and mockup paths that carry the current frame secret. Checked by a table-driven test over
  every route.
- The access key MUST be generated, shown once, and stored only as a hash; sessions MUST be random
  and stored hashed. Checked by the sign-in store's tests.
- A session MUST end after 30 days without use, at sign-out, or when the key changes, and signing
  out MUST end its live streams. Checked by the sign-in routes' tests.
- A failed sign-in MUST NOT lock the owner out, and MUST NOT be a cheap guess. Checked by the
  sign-in routes' tests.
- The frame secret MUST change whenever a session ends and reach only signed-in pages, and a process
  the server runs MUST NOT receive Uraeda's credentials. Checked by the preview proxy's tests.
- The server MUST NOT treat an address, `Host`, or proxy header as proof of identity, and a public
  address MUST reach it through a same-machine proxy that ends TLS. Checked by review.
- Sign-in MUST NOT be turned off by a flag, an environment variable, or a setting: only code MAY
  build an app without it, for tests, Uraeda's own Storybook fixture, and the [sandbox](sandbox.md).
  Checked by review.

## Why

The server commits, starts agents, and runs project code, and its owner reaches it from several
devices and one day a public address ([the proposal](../done/2026-10-16-basic-security.md)). A
generated key cannot be guessed, so it needs no lockout an attacker could turn against the owner
([what you sign in with](../done/2026-10-16-basic-security.md#q1-what-do-you-sign-in-with)). No
address or header proves the sender, since proxies connect from 127.0.0.1 and can forge headers
([trusting the tailnet](../done/2026-10-16-basic-security.md#q4-does-your-tailnet-sign-you-in)).
Sandboxed frames get no `Lax` cookie and share one Storybook, so they share one secret in their path
([how previews prove themselves](../done/2026-10-16-basic-security.md#q6-how-do-previews-and-mockups-prove-they-come-from-you)).
The sandbox holds sample projects only, and an agent must open its pages without signing in
([sign-in in the sandbox](../2026-10-20-ui-sandbox/clarifications-01.md#q8-does-the-sandbox-need-sign-in)).

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
