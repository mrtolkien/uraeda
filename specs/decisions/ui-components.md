---
status: proposed
approved-by:
icon: component
---

# UI components

The web UI looks and behaves as one product. It is built from one design system, Astryx, styled only
through its theme, and each kind of information, such as a rule, a status, or a question, is drawn
by one shared component on every page. An agent never guesses a size, a colour, or a component: lint
tells it.

## Rules

- Views MUST use Astryx components wherever one fits the job. Checked by lint.
- Views MUST be styled only through Astryx's theme, never with a global stylesheet or inline styles.
  Checked by lint.
- A kind of information MUST be drawn by one shared component on every page that shows it. Checked
  by review.
- A change to how information is drawn MUST be made in its shared component, so every page follows.
  Checked by review.
- A page MUST NOT draw information its own way, unless the plan names an extremely good reason and
  the human approves it. Checked by review.
- A text input MUST behave as its class does everywhere: a single-line input, a multi-line markdown
  input, or a composer. Checked by review.
- Reading text MUST be drawn through the one shared component for prose, never sized or measured by
  a page. Checked by lint and a test.
- Drag and drop MUST use `@dnd-kit/react`. Checked by review.
- Astryx, StyleX, its styling library, and `@dnd-kit/react` MUST be pinned to exact versions.
  Checked by review.
- A raw element or a plain style MAY stand in where Astryx and StyleX cannot do the job, with its
  reason in a comment, the plan listing it as an Astryx gap. Checked by lint and review.

## Why

Pages built one at a time drift. The first ones grew 533 lines of global CSS, and the decisions page
drew a rule unlike the spec page, which the human dislikes more than a missing feature. Lint holds
the line where written guidelines did not, and the theme keeps light and dark consistent. dnd-kit is
the maintained choice for dragging on touch screens. History:
[UI improvements](../done/2026-10-12-ui-improvements.md).

## Alternatives considered

- Written guidelines only: what produced the first pages.
- A global stylesheet in tokens beside Astryx: two ways to style, and nothing checks the global
  file.
- A hand-written pointer drag: no dependency, but nothing moves under the finger.

## Consequences

- A size or a colour changes in one place, the theme, and reaches every view.
- A shared component gets harder to change, since every page shows the change at once.
- StyleX's lint runs through Oxlint's JavaScript plugins, still in alpha: an upgrade may need care.
- Astryx gaps are listed in plans, so they can be reported upstream.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
