---
status: proposed
approved-by:
icon: palette
---

# UI look

Uraeda looks like a terminal tool: a monospace font, square corners, and bordered panes with their
title in their border, as in Neovim, with frosted glass for what floats over the page. The look
lives in one theme, so the whole UI changes together. Only the fonts and the colours step outside
it: the human picks a font for each role, and a [colour theme](colour-themes.md) for each mode.

## Rules

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border.
- On the phone, a pane MUST keep its whole border, with little room inside it and around it, so its
  text has nearly the screen's width.
- Text MUST be set for readability first, in the font picked for its role: a monospace font by
  default, and a proportional one where it reads better, such as long prose.
- Text MUST be set at the reading size the human chose, once, in the theme.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, the
  contrast WCAG AA asks for, in every shipped colour theme. Checked by a test of the shipped themes.
- Fonts MUST be bundled with the app under an open licence, with no file loaded from another host.
  Checked by a test of the built app.
- A harness, the tool that runs an agent such as Claude Code, MUST be marked by Codicons' drawing of
  its mark where Codicons has one, and by a neutral glyph otherwise.
- What floats over the page, such as the phone's bottom bars or the leader menu, SHOULD be frosted
  glass: a light tint, what is behind it blurred, and square corners.
- Icons SHOULD come from Lucide, another free set's glyph standing in where it fits a concept
  clearly better.

## Why

The UI looked vanilla and unfinished, and of five directions mocked up over the same views, the
terminal one read best. Its colours come from colour themes, Catppuccin's Mocha and Latte by
default. On a phone, a pane's whole border sets its text apart, and a few pixels of room keep the
narrow lines wide
([the question](../done/2026-10-30-reading-pass.md#q2-should-a-pane-keep-its-whole-border-on-the-phone)).
Fonts are bundled because the server listens on its own machine and often runs offline. History:
[Layout and look](../done/2026-10-20-layout-look.md).

## Alternatives considered

- Only a pane's titled top border on the phone: a question's example ran into its context, and the
  wide screens' room inside a full pane left too little for the text.
- Material Design Icons: complete, but heavier than the monospace text.
- Neutral glyphs for every harness: no trademark question, but slower to recognise.

## Consequences

- Every view inherits the look from the theme, so later features restyle nothing.
- The marks of Claude Code and Codex are used without their owners' approval, as the human chose.
- The bundled fonts add to the app's download.

## Applies to

- [`packages/web/`](/packages/web/): its theme and fonts in
  [`src/theme/`](/packages/web/src/theme/), its icons, and every view
