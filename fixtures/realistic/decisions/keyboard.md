---
icon: keyboard
---

# Keyboard

> "I drive the whole app from the keyboard."

## Rules

- A shortcut is declared in the key registry, and listened for nowhere else. _So:_ its hint, the
  leader menu, and the key search never drift from it.
- Every action works by keyboard and by tap, never by hover or a single key alone. _So:_ a row's
  `d` has a menu item too.
- Single-key shortcuts can be switched off, and a chord with a modifier then opens the leader menu.
  _So:_ a screen reader's user keeps every action.
- A key never means two things on one page. _So:_ a page's own key never shadows a base one.

## Why

Keys scattered through components drifted from their hints, so one registry feeds the leader menu,
the hints, and a search of the keys. The accessibility guideline WCAG 2.1.4 asks for a way to turn
single-key shortcuts off. History: [Leader key](../done/2026-10-26-leader-key.md).

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view or a shortcut
- [`crates/core/`](/crates/core/)'s settings, for the switch
