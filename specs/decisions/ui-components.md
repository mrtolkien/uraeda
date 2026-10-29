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

- Views MUST use Astryx components wherever one fits the job, and be styled only through its theme,
  with no global stylesheet or inline styles. Checked by lint.
- Drag and drop MUST use `@dnd-kit/react`. Checked by review.
- Astryx, StyleX, and `@dnd-kit/react` MUST be pinned to exact versions. Checked by review.
- A raw element MAY stand in where no Astryx component fits the job, with its reason in a comment,
  and the plan MUST list it as an Astryx gap. Checked by lint and review.
- A stylesheet or an element's `style` MAY stand in, with its reason in a comment, only for the
  closed rail's look, the theme's tokens set at run time, or a value written outside a render as the
  page moves. Checked by review.

## Why

The first pages drifted to 533 lines of global CSS in pixels, with text smaller on desktop than on
the phone, though their spec named the right components. Lint holds the line where written
guidelines did not, and the theme's tokens keep light and dark consistent. dnd-kit is the maintained
choice for dragging on touch screens in React 19
([UI improvements](../done/2026-10-12-ui-improvements.md#q1-how-should-this-apps-ui-be-built)).

Three kinds of style fall outside StyleX's props. The closed rail draws the sidebar's panes, cards,
and `SideNav` items as framed icons, through one stylesheet scoped to it (`RAIL_CSS`): `SideNav`'s
`xstyle` reaches an item's root, not its label. The fonts picked are read from the browser before
the app draws, and written over the theme's font tokens, so no text changes face. Some values change
frame by frame, as a column eases or the page scrolls: the code that follows one writes it to the
element's `style`, outside React's render.

## Alternatives considered

- Written guidelines only: what produced the first pages.
- A global stylesheet in tokens beside Astryx: two ways to style, and nothing checks the global
  file.
- A hand-written pointer drag: no dependency, but nothing moves under the finger.
- Astryx alone, with no component of Uraeda's own: the phone's glass bars, the status line's hints,
  and the outliner's field have no Astryx component, so Uraeda draws them.

## Consequences

- A size or a colour changes in one place, the theme, and reaches every view.
- StyleX's lint runs through oxlint's JavaScript plugins, still in alpha: an oxlint upgrade may need
  care.
- Astryx gaps are listed in plans, so they can be reported upstream. One is known: `ChatToolCalls`
  and the like mount every row while collapsed, so a long list is drawn through a shared component
  that hands them only what shows (`ToolGroups.tsx`).
- Read an Astryx component's source and measure the page before patching around it.
- The closed rail's stylesheet names Astryx's inner classes, which lint does not check: an Astryx
  upgrade may change them, and the rail must be looked at after one.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
- The styles outside StyleX: the closed rail's in
  [`shell/Column.tsx`](/packages/web/src/shell/Column.tsx), the fonts' in
  [`theme/fonts.ts`](/packages/web/src/theme/fonts.ts), and the values written outside a render,
  such as [`layout/useScreenCentre.ts`](/packages/web/src/layout/useScreenCentre.ts)
