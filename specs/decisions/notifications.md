---
icon: bell
---

# Notifications

> "Add notifications when there's a user action available (ping the user when input is needed)."

A notification always means an ask. An item needs the human when its next step is theirs: questions
to answer, a spec to approve, a run that failed.

## Rules

- A notification is shown only when something comes to need the human. _So:_ a chat blocked on an
  action the human must allow notifies, and a finished reply does not.

## Why

A notification that always means an ask is one the human keeps on. One more kind, a reply, a run
that ended, and they learn to dismiss them all, the asks with them. History:
[Redesign interface](../done/2026-10-16-redesign-interface.md).

## Alternatives considered

- Every finished chat reply notifying too: more notifications than asks.

## Applies to

- [`app/`](/app/) and [`crates/server/`](/crates/server/), and every feature that tells the human
  something happened
