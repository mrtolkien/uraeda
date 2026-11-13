---
icon: layout-panel-left
---

# UI layout

> "Every layout serves one goal: I read and understand what is on screen."

## Rules

- The UI adapts to three width classes, narrow, semi-wide, and wide, never to the device. _So:_ half
  a desktop screen and a tablet get one layout.
- On narrow screens, views are pages. _So:_ a feature's session opens as its own page on a phone.
- An open detail, tab, or sheet is in the address. _So:_ reload, Back, or a width change keeps it.
- Text stays readable at each width without zoom. _So:_ prose holds about 80 characters a line, even
  on a wide page.

## Why

What reads best depends on the room a view has, not the device. Lines much longer than 80
characters are hard to follow. History: [Panes size](../done/2026-10-30-panes-size.md).

## Alternatives considered

- Two width classes: half a screen got the desktop's layout, and broke.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
