---
icon: component
---

# UI components

> "Each kind of information looks the same on every page."

The web UI is built from one design system, Astryx, styled only through its theme.

## Rules

- Views use Astryx components, styled only through its theme. _So:_ no global stylesheet, and no
  inline style.
- A kind of information is drawn by one shared component on every page that shows it. _So:_ a rule
  reads the same on the decisions page and the spec page.
- A page never draws information its own way, unless the plan names a reason and the human approves
  it. _So:_ a change to how a status looks is made in its component.

## Why

Pages built one at a time drift: the first ones grew 533 lines of global CSS, and the decisions page
drew a rule unlike the spec page. Lint holds the line where written guidelines did not. History:
[UI improvements](../done/2026-10-12-ui-improvements.md).

## Alternatives considered

- Written guidelines only: what produced the first pages.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
