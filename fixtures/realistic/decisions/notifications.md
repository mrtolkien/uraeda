---
icon: bell
---

# Notifications

> "A notification always means you need me."

## Rules

- A notification shows only when an item comes to need the human. _So:_ a finished chat reply never
  notifies, unless it waits on them.
- The browser's permission is asked only after the human is told what will notify, and a refusal is
  kept. _So:_ never on page load, and never twice.
- Notifications never interrupt a human already looking at Uraeda. _So:_ an open, focused tab shows
  none.
- The tab's title counts the items that need the human. _So:_ a background tab says how many wait.

## Why

A notification that always means an ask is one the human keeps on. Browsers ignore a permission
request no click asked for, and a refusal cannot be asked again, so the page explains first. History:
[Redesign interface](../done/2026-10-16-redesign-interface.md).

## Alternatives considered

- Every finished chat reply notifying too: more notifications than asks.

## Applies to

- [`packages/web/`](/packages/web/) and [`packages/server/`](/packages/server/), and every feature
  that tells the human something happened: notifications, the tab's title, and a later Web Push
