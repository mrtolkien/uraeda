---
icon: key-round
---

# Sign-in

> "Keep it simple _but_ it should be secure enough to start running uraeda on a public,
> internet-accessible server."

Uraeda's server has one owner, who reaches it from several devices through their own tunnel. A
browser signs in with the access key, a key the server generates, and holds a session. Another
device pairs once, with a one-time code, then holds a token of its own.

## Rules

- Every route asks for a session or a device's token, unless it serves the app's files, signs in or
  pairs a device, or checks a secret of its own. _So:_ the route an agent's process calls takes the
  token the server gave that process, and nothing else. A new route is closed until this decision
  opens it.
- The server listens only on the loopback interface, its own machine, and answers only Uraeda's own
  clients. _So:_ a phone reaches it through the owner's tunnel, and a public address through a proxy
  on the same machine. No flag makes it listen on every interface.
- No address, `Host`, or proxy header proves who is asking. _So:_ a browser on the server's own
  machine signs in like any other, and being on the owner's tailnet signs nobody in.
- The access key, the pairing codes, the sessions, and each device's token are random, and stored
  only as hashes. _So:_ the access key is made only where a person sees it, on a terminal. A server
  whose output goes to a log file makes none, so no file holds one in clear.
- A session ends after 30 days without use, at sign-out, when the access key changes, or when the
  owner revokes its device. _So:_ a lost phone is revoked alone, from the settings, and the other
  devices stay signed in.
- A project's preview runs apart from Uraeda's own views, and cannot save, create, or open files.
  _So:_ a preview draws in a web view of its own, and proves itself with a secret in its address,
  since it carries no session.
- A process the server runs never receives Uraeda's credentials. _So:_ an agent's process gets a
  token of its own, which ends with it. Its owner's session would give the agent everything the
  owner reaches.
- Sign-in is never turned off by a flag, an environment variable, or a setting. _So:_ only code
  builds a server without it, for tests and the [sandbox](sandbox.md), which never read the owner's
  folders.

## Why

The server commits and starts agents, so whoever reaches it acts as its owner. Proxies and tunnels
connect from the machine itself and can forge headers, so where a request comes from proves nothing.
A generated key cannot be guessed, and a token per device lets a lost one be revoked alone. A
preview and an agent run code that Uraeda did not write: neither may hold what would let it act as
the owner. History: [Basic security](../done/2026-10-16-basic-security.md).

## Alternatives considered

- A password the owner chooses: guessable, so it needs a limit on failed tries.
- A lockout after failed tries: an attacker could use it to lock the owner out. A failed try costs a
  second instead.
- Trusting `127.0.0.1` or the tailnet's identity: a full bypass behind a proxy set up wrong.

## Applies to

- [`crates/server/`](/crates/server/), and every feature that adds a route, a WebSocket, or a
  process the server runs
- [`app/`](/app/), for the sign-in and pairing screens and the previews

## Revisit when

Passkeys, next on the priorities, or several users, later, change how a device proves who it is.
