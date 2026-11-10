---
status: active
approved-by: mrtolkien
icon: palette
---

# UI look

Uraeda looks like a terminal tool with depth: a monospace font, square corners, and titled, bordered
panes, as in Neovim, with glass, blur, and neon light over them. The look lives in one set of
tokens, so the whole UI changes together. Only the fonts and the colours step outside it: the human
picks a font for each role, and a [colour theme](colour-themes.md) for each mode.

## Rules

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes, each
  titled at its top edge.
- On the phone, a pane MUST keep its whole border, with little room inside it and around it, so its
  text has nearly the screen's width.
- Text MUST be set for readability first, in the font picked for its role: a monospace font by
  default, and a proportional one where it reads better, such as long prose.
- Text MUST be set at the reading size the human chose, once, in the tokens.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, the
  contrast WCAG AA asks for, in every shipped colour theme. Checked by a test of the shipped themes.
- Fonts MUST be bundled with the app under an open licence, with no file loaded from another host.
  Checked by a test of the built app.
- A harness, the tool that runs an agent such as Claude Code, MUST be marked by Codicons' drawing of
  its mark where Codicons has one, and by a neutral glyph otherwise.
- What sits above the page, such as a bar that stays, a menu, or a dialog, SHOULD be glass: a light
  tint over what is behind it, blurred, drawn by the platform's own material where it has one.
- Light SHOULD mark where the keys go: the focused pane glows, and nothing else does at rest.
- Icons SHOULD come from Lucide, another free set's glyph standing in where it fits a concept
  clearly better.

## Why

Of five directions mocked up over the same views, the terminal one read best, yet it looked plain.
Glass and glow give it depth and show what is active, without leaving the terminal's grid. Its
colours come from colour themes, Catppuccin's Mocha and Latte by default. On a phone, a pane's whole
border sets its text apart. Fonts are bundled because the server often runs offline. History:
[Layout and look](../done/2026-10-20-layout-look.md).

## Alternatives considered

- The flat terminal look, the earlier one: readable, but plain, with nothing showing depth.
- Glass everywhere: long prose over a blur is harder to read.
- Neutral glyphs for every harness: no trademark question, but slower to recognise.

## Consequences

- Every view inherits the look from the tokens, so later features restyle nothing.
- Glass and glow cost frames: each one is measured against the frame budget of
  [Performance](performance.md).
- The marks of Claude Code and Codex are used without their owners' approval, as the human chose.
- How strong glass and glow are, and when light moves, is set by the design language in
  [`specs/ui/`](/specs/ui/).

## Applies to

- `app/`: its tokens, its fonts, its icons, and every view
