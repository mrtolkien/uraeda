---
status: proposed
approved-by:
icon: component
---

# UI components

The web UI looks and behaves as one product because it is built from one design system, Astryx, and
styled only through its theme. An agent never guesses a size, a colour, or which component to use:
lint tells it.

## Rules

- Views MUST use an Astryx component wherever one fits the job. Checked by lint, which names the
  component to use for a raw button, input, text area, select, or dialog.
- Styles MUST be written with StyleX, in the file of the component that uses them, from the theme's
  tokens and sizes, raw values only for `0`, percentages, `auto`, and keywords. Checked by lint.
- Components MUST NOT take a `style` prop, and only Astryx's stylesheets MAY be imported. Checked by
  lint and review.
- Drag and drop MUST use `@dnd-kit/react`. Checked by review.
- Astryx, StyleX, and `@dnd-kit/react` MUST be pinned to exact versions. Checked by review.
- A raw element MAY stand in for a missing Astryx component, with a lint suppression that gives the
  reason, and the plan MUST list it as an Astryx gap. Checked by lint and review.

## Why

The first pages drifted to 533 lines of global CSS in pixels, with text smaller on desktop than on
the phone, though their spec named the right components. Lint holds the line where written
guidelines did not, and the theme's tokens keep light and dark consistent. dnd-kit is the maintained
choice for dragging on touch screens in React 19
([UI improvements](../done/2026-10-12-ui-improvements.md#q1-how-should-this-apps-ui-be-built)).

## Alternatives considered

- Written guidelines only: what produced the first pages.
- A global stylesheet in tokens beside Astryx: two ways to style, and nothing checks the global
  file.
- A hand-written pointer drag: no dependency, but nothing moves under the finger.

## Consequences

- A size or a colour changes in one place, the theme, and reaches every view.
- StyleX's lint runs through oxlint's JavaScript plugins, still in alpha: an oxlint upgrade may need
  care.
- Astryx gaps are listed in plans, so they can be reported upstream.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
