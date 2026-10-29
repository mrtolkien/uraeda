---
status: proposed
approved-by:
icon: palette
---

# UI look

Uraeda looks like a terminal tool: a monospace font, Catppuccin colours, square corners, and
bordered panes with their title in their border, as in Neovim, with frosted glass for what floats
over the page. The look lives in one theme, so the whole UI changes together. Only the fonts step
outside it: the human picks one for each role.

## Rules

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border. Checked by review.
- On the phone, a pane MUST keep only its titled top border, so its text has the screen's width.
  Checked by review.
- Text MUST be set for readability first, in the font picked for its role: a monospace font by
  default, and a proportional one where it reads better, such as long prose. Checked by review.
- Text MUST be set at the reading size the human chose, once, in the theme. Checked by review.
- A new colour scheme MUST be added as a named scheme of the same theme, never as styles in a view.
  Checked by review.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, the
  contrast WCAG AA asks for, in every scheme. Checked by a test of the theme's tokens.
- Fonts MUST be bundled with the app under an open licence, with no file loaded from another host.
  Checked by a test of the built app.
- A harness, the tool that runs an agent such as Claude Code, MUST be marked by Codicons' drawing of
  its mark where Codicons has one, and by a neutral glyph otherwise. Checked by review.
- What floats over the page, such as the phone's bottom bars or the leader menu, SHOULD be frosted
  glass: a light tint, what is behind it blurred, and square corners. Checked by review.
- Icons SHOULD come from Lucide, another free set's glyph standing in where it fits a concept
  clearly better. Checked by review.

## Why

The UI looked vanilla and unfinished, and of five directions mocked up over the same views, the
terminal one read best. Catppuccin's Mocha and Latte give a dark and a light mode, with more schemes
to come. A pane's side borders take the room a phone's narrow lines need. Fonts are bundled because
the server listens on its own machine and often runs offline. History:
[Layout and look](../done/2026-10-20-layout-look.md).

## Alternatives considered

- Bordered panes on the phone too: their borders and padding left too little room for the text.
- Material Design Icons: complete, but heavier than the monospace text.
- Neutral glyphs for every harness: no trademark question, but slower to recognise.

## Consequences

- Every view inherits the look from the theme, so later features restyle nothing.
- The marks of Claude Code and Codex are used without their owners' approval, as the human chose.
- The bundled fonts add to the app's download.

## Applies to

- [`packages/web/`](/packages/web/): its theme and fonts in
  [`src/theme/`](/packages/web/src/theme/), its icons, and every view
