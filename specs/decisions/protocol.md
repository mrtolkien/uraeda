---
icon: cable
---

# Protocol

> "No WebSockets? That's pretty much a no-go, right? I want real-time updates and streaming agent
> responses."

Said while Native Shell was tested, when it seemed to have no WebSockets. The protocol is how a
client talks to the server: the Linux app, the web build, and later a phone. It is one set of
messages, Uraeda's own, over a WebSocket and a few HTTP routes. [Stack](stack.md) holds the rule
that a client reaches the server through nothing else.

## Rules

- What the server knows reaches every client as it changes, and an agent's reply streams as it is
  written. _So:_ no page asks again on a timer, and none has a refresh button. A record arrives
  whole once, then as changes only, so a reply in a long session never sends its transcript again.
- The protocol has one version at a time. _So:_ a change an older client cannot read raises the
  version, as two did in the protocol's first three days. A client and a server of different
  versions refuse each other, and name the side to update. No code keeps the older one working.

## Why

The human watches agents work. A reply that arrives whole at its end, or a page that shows an old
state, hides what is happening. Sending changes, not whole values, is also what keeps a long session
within the [Performance](performance.md) decision's frame. The project is early, with one user:
"it's really ok to break compatibility, no one really uses the tool atm". Updating both sides
together costs less than a second version kept alive. History:
[the move to Native Shell](../done/2026-11-10-nsh-migration.md).

## Alternatives considered

- Keeping older clients working when a message changes, the earlier rule: it was never done, and
  [Compatibility](compatibility.md) asks the opposite of every other format.

## Applies to

- `crates/protocol/`, `crates/server/`, and `app/store/`, and every feature that adds a record, an
  action, or a route

## Revisit when

Uraeda has users other than its owner, or a client that updates apart from its server, as an app
from a store does.
