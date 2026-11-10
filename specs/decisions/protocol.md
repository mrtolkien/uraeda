---
status: proposed
approved-by:
icon: cable
---

# Protocol

Clients reach the server through one versioned protocol, Uraeda's own. A client subscribes to
records and calls actions; a record arrives whole once, then as changes. It keeps every client, on
every platform, on the same contract.

## Rules

- A client MUST reach the server only through the protocol and the HTTP routes it names. Checked by
  the protocol's contract tests.
- A record MUST arrive whole once, then only as changes, each numbered. Checked by the live engine's
  tests.
- A client and a server of different protocol versions MUST refuse each other, naming the side to
  update. Checked by the server's tests.
- The protocol's messages MUST be defined once, in one crate that the server and the client's types
  both come from.
- A client MUST treat what it holds as a cache: the server owns every durable fact.
- A change to a message SHOULD keep older clients working, and raises the version when it cannot.

## Why

Several clients share one server: a Linux app, a web build, and later phones. A streamed reply
resent whole on each word is slow, and loses parts under load. One definition keeps the server and
every client from drifting apart, and a version check turns a silent mismatch into a clear message.

## Alternatives considered

- fate, the earlier data library: bound to React and to Node.
- Whole values on each update: simpler, but measured as too slow for long sessions.
- A general protocol such as GraphQL: more machinery than one server and its own clients need.

## Consequences

- A new record or action is declared in the protocol's crate before either side uses it.
- A client that falls far behind gets a whole value again.
- An older client must be updated when the version rises.

## Applies to

- `crates/protocol/`, `crates/server/`, and `app/store/`, and every feature that adds a record, an
  action, or a route
