---
status: active
approved-by: mrtolkien
---

# UI components

The web UI is built from Astryx components wherever one exists, and the few styles of its own are
written in StyleX, next to the component that uses them, with Astryx's tokens only. There is no
global stylesheet besides Astryx's own. Lint enforces it, so an agent gets a precise message instead
of a taste to guess.

## Rules

- Views MUST use an Astryx component wherever one exists for the job: buttons, links, inputs, text
  areas, menus, sheets, dialogs, toasts, banners, lists and rows, headings and text, outlines,
  breadcrumbs, and the shell.
- Raw `button`, `input`, `textarea`, `select`, and `dialog` elements MUST NOT be written in
  `packages/web/src`. Lint (`react/forbid-elements`) names the Astryx component to use instead.
- A raw element MAY be used where no Astryx component fits, only with a lint suppression on its line
  giving the reason, and the plan MUST list it as an Astryx gap.
- Components MUST NOT take a `style` prop, and Astryx components MUST NOT take a `className`. Their
  own styles go through `xstyle`.
- The app's own styles MUST be written with `stylex.create`, in the file of the component that uses
  them, and MUST use Astryx's tokens for colours, spacing, sizes, radii, borders, and type. Raw
  values are allowed only for `0`, percentages, `auto`, and layout keywords. StyleX's lint plugin
  (`valid-styles`) enforces it.
- No stylesheet MAY be imported besides Astryx's reset, core, and theme stylesheets.
- Sizes MUST come from the theme. A size the theme lacks is added to the theme, not written in a
  component.
- Reordering by drag MUST use `@dnd-kit/react`. No other drag-and-drop library MAY be added.
- Astryx, `@dnd-kit/react`, and StyleX MUST be pinned to exact versions, and upgraded deliberately.

## Why

The web UI's spec named the right Astryx components, like `Outline`, `Toast`, and `List`. The pages
drifted to 533 lines of global CSS in px anyway, and grew text smaller on desktop than on the phone.
No rule or check caught it, and the human found the views "mostly good but also very scuffed"
([proposal](../done/2026-10-12-ui-improvements.md),
[Q1](../done/2026-10-12-ui-improvements.md#q1-how-should-this-apps-ui-be-built),
[how the UI is built](../done/2026-10-12-ui-improvements.md#q1-how-should-this-apps-ui-be-built)).
Design systems hold the line with lint: one vocabulary, whose sizes and colours follow the theme in
light and dark. Dragging that animates well on touch is a lot of code to write by hand, and dnd-kit
is the maintained choice for React 19
([Q9](../done/2026-10-12-ui-improvements.md#q9-how-should-dragging-a-line-work),
[reordering](../done/2026-10-12-ui-improvements.md)).

## Alternatives considered

- Astryx components checked by lint, with the reading layout kept in one global stylesheet in
  tokens: less to rewrite, but two ways to style, and nothing checks the global file.
- Written guidelines only: what produced today's pages.
- The hand-written pointer drag, with an animation after the drop: no dependency, but nothing moves
  under the finger.

## Consequences

- Every page's styles move from `styles.css` to StyleX, and the web package compiles StyleX with its
  Vite plugin.
- A size or a colour changes in one place, the theme, and reaches every view.
- An agent meets a lint error, with the component to use, the moment it writes a raw element.
- StyleX's lint plugin runs through oxlint's JavaScript plugins, which are in alpha: an oxlint
  upgrade may need care.
- `@dnd-kit/react` is pre-1.0: its upgrades may change its API.
- Astryx gaps are listed in plans, so they can be reported upstream.

## Applies to

- [`packages/web/`](/packages/web/), and every feature that adds or changes a view
