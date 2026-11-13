---
icon: component
---

# UI components

> "I dislike when the same information is presented in different ways in different pages, without an
> extremely good reason. I want re-use of components and a globally coherent application."

The app is built from one component library, Uraeda's own, in [`app/ui/`](/app/ui/). The
[components guide](../ui/components.md) says which component does which job.

## Rules

- A kind of information is drawn by one shared component on every page that shows it, where every
  change to how it is drawn is made. _So:_ the "needs you" card of the home and of the sidebar is
  one component, and the home's only shows more of it.
- A page never draws information its own way, unless the plan names an extremely good reason and the
  human approves it. _So:_ a session's messages got no `compact` spacing of their own: the same text
  would differ by page.
- A control that does one job behaves the same on every page. _So:_ a new text field takes the keys
  of its class, a one-line field, a field of several lines, or a composer, never keys of its own.
- Screens are built from Uraeda's own component library, not from a ready-made design system. _So:_
  a control the library lacks is added to the library before a screen uses it.
- A view takes every colour, size, and width from the library's tokens, its named values, never from
  a value of its own. _So:_ a page that needs a width the scale of widths lacks adds it to the
  scale, with the human's approval.

## Why

Pages built one at a time drift apart: two cards for one thing, two dialogs for one question. The
human reads the app for hours, and sees each difference. One component per kind of information, in
one library drawn from one set of tokens, makes a change reach every page at once. A library of
Uraeda's own can also draw the glass and the light of its look, which a ready-made one cannot.
History: [Decisions pass](../done/2026-10-19-decisions-pass.md).

## Alternatives considered

- Astryx, a ready-made design system, the earlier choice: its components constrained the look, and
  it draws in React only.

## Applies to

- [`app/`](/app/), and every feature that adds or changes a view
