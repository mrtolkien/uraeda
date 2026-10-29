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
- A stylesheet MAY stand in, with its reason in a comment, only for the closed rail's `SideNavItem`
  rows, whose width, centring, and label no prop reaches. Checked by review.
- An element's `style` MAY be written outside a render, with its reason in a comment, only for a
  value that changes frame by frame, or that must be measured in the frame it is written. Checked by
  review.

## Why

The first pages drifted to 533 lines of global CSS in pixels, with text smaller on desktop than on
the phone, though their spec named the right components. Lint holds the line where written
guidelines did not, and the theme's tokens keep light and dark consistent. dnd-kit is the maintained
choice for dragging on touch screens in React 19
([UI improvements](../done/2026-10-12-ui-improvements.md#q1-how-should-this-apps-ui-be-built)).

Two kinds of style remain outside StyleX. In the closed rail, a `SideNavItem` row is its icon alone,
centred in the rail's box: its `xstyle` reaches its root, not the row's width and centring or its
label (`RAIL_ROW_CSS`). Some values change frame by frame, as a column eases, a transcript streams,
or a row follows the pointer; an outliner's field is let go and measured in one frame. Rendering
each frame would stutter, and a render between the two writes would show, so the code writes them to
the element's `style`. Everything else is StyleX, the rest of the closed rail's look and the fonts
picked included, as the human asked: "everything should use StyleX if possible, it's more coherent".

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
- The closed rail's stylesheet names Astryx's `.astryx-side-nav-item`, which lint does not check: an
  Astryx upgrade may change it, and the rail must be looked at after one.
- The fonts picked are a style of the app's root (`theme/PickedFonts.tsx`): what draws outside it,
  in the page's body, must take `useFontStyle` too, as the phone's row bar and the sandbox's bar do.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
- The styles outside StyleX: the closed rail's rows in
  [`shell/Column.tsx`](/packages/web/src/shell/Column.tsx), and the values written outside a render
  in [`layout/useScreenCentre.ts`](/packages/web/src/layout/useScreenCentre.ts),
  [`following.ts`](/packages/web/src/following.ts),
  [`lists/dragDepth.ts`](/packages/web/src/lists/dragDepth.ts) and
  [`lists/useDragOrder.ts`](/packages/web/src/lists/useDragOrder.ts), and
  [`lists/useOutlineField.ts`](/packages/web/src/lists/useOutlineField.ts)
