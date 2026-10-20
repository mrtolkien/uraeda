---
status: active
approved-by: mrtolkien
icon: component
---

# UI components

The web UI looks and behaves as one product because it is built from one design system, Astryx, and
styled only through its theme. An agent never guesses a size, a colour, or which component to use:
lint tells it.

## Rules

- Views MUST use Astryx components wherever one fits the job, and be styled only through its theme,
  with no global stylesheet or inline styles. Checked by lint.
- Drag and drop MUST use `@dnd-kit/react`. Checked by review.
- Astryx, StyleX, and `@dnd-kit/react` MUST be pinned to exact versions. Checked by review.
- A raw element MAY stand in for a missing Astryx component, with a reason, and the plan MUST list
  it as an Astryx gap. Checked by lint and review.

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
- Astryx gaps are listed in plans, so they can be reported upstream. One is known: `ChatToolCalls`
  and the like mount every row while collapsed, so a long list is drawn through a shared component
  that hands them only what shows (`ToolGroups.tsx`).
- Read an Astryx component's source and measure the page before patching around it.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
