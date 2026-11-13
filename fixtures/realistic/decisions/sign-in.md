---
icon: key-round
---

# Sign-in

> "Only I can reach my server, from any of my devices."

The server has one owner, who signs each browser in once with a key the server generates.

## Rules

- Every request carries a valid session, except the built UI's files, the sign-in routes, and the
  preview paths that carry the frame secret. _So:_ a new route is closed by default.
- The server listens only on its own machine, and never treats an address or a header as proof of
  identity. _So:_ a request from `127.0.0.1` still needs a session.
- The access key and the sessions are random, and stored only as hashes. A session lasts 30 days
  without use. _So:_ a lost key is replaced from the host's shell, which signs every device out.
- A failed sign-in costs a guesser time, and never locks the owner out. _So:_ no lockout after five
  tries.
- Only code turns sign-in off. _So:_ no flag, variable, or setting does, and the
  [sandbox](sandbox.md) is built without it.

## Why

The server commits, starts agents, and runs project code, and its owner reaches it from several
devices. A generated key cannot be guessed, so it needs no lockout an attacker could turn against the
owner. History: [Basic security](../done/2026-10-16-basic-security.md).

## Alternatives considered

- A password the owner chooses: guessable, and any limit on failures locks the owner out.
- Trusting `127.0.0.1` or Tailscale's identity: a full bypass behind a misconfigured proxy.

## Applies to

- [`packages/server/`](/packages/server/), and every feature that adds a route, a WebSocket, or a
  process the server runs
- [`packages/web/`](/packages/web/), for the sign-in screen and the previews' frames
