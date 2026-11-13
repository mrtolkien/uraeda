---
icon: palette
---

# UI look

> "It should look like a terminal tool, not vanilla."

The look lives in one theme, so the whole UI changes together.

## Rules

- The UI looks like a terminal tool: square corners, and bordered panes whose title sits in their
  top border. _So:_ no rounded card.
- A colour scheme is a named scheme of the theme, never styles in a view. _So:_ a new scheme
  changes every page at once.
- Every text colour reaches the contrast WCAG AA asks for, in every scheme. _So:_ a scheme that
  fails it is not added.
- Fonts are bundled under an open licence, and no file is loaded from another host. _So:_ the app
  reads the same offline.

## Why

Of five directions mocked up over the same views, the terminal one read best. Fonts are bundled
because the server listens on its own machine and often runs offline. History:
[Layout and look](../done/2026-10-20-layout-look.md).

## Alternatives considered

- Bordered panes on the phone too: their borders and padding left too little room for the text.

## Applies to

- [`packages/web/`](/packages/web/): its theme and fonts in
  [`src/theme/`](/packages/web/src/theme/), its icons, and every view
