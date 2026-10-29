---
status: proposed
approved-by:
icon: palette
---

# UI look

Uraeda looks like a terminal tool: a monospace font, Catppuccin colours, square corners, and
bordered panes with their title in their border, as in Neovim. What floats over the page is frosted
glass, as modern Linux desktops draw their panels with transparency and blur. Readability comes
first, so text that reads better in a proportional font gets one. The look lives in one theme, so
the whole UI changes together, and more colour schemes can join it later. Only the fonts step
outside it: the human picks one for each role.

## Rules

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border. Checked by review.
- On the phone, a pane MUST keep only its titled top border, so its text has the screen's width.
  Checked by review.
- Text MUST be set for readability first, in the font picked for its role: a monospace font by
  default, and a proportional font where it reads better, such as long prose. Checked by review.
- A new colour scheme MUST be added as a named scheme of the same theme, never as styles in a view.
  Checked by review.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, the
  contrast WCAG AA asks for, in every scheme. Checked by a test of the theme's tokens.
- Text MUST be set at the reading size the human chose, once, in the theme. Checked by review.
- Fonts MUST be bundled with the app under an open licence, and the UI MUST NOT load a file from
  another host. Checked by a test of the built app.
- A harness MUST be marked by Codicons' drawing of its mark where Codicons has one, and by a neutral
  glyph drawn for Uraeda otherwise. Checked by review.
- What floats over the page, such as the phone's bottom bars or the leader menu, SHOULD be frosted
  glass: a light tint of its own, what is behind it blurred, and square corners. Checked by review.
- Icons SHOULD come from Lucide, and another free set's glyph MAY stand in where it fits a concept
  clearly better. Checked by review.

## Why

The UI looked vanilla and unfinished before 1.0. The human compared five directions and picked the
terminal one, with a touch of cyber
([the visual direction](../done/2026-10-20-layout-look.md#q2-which-visual-direction-should-the-ui-take)).
They asked for Catppuccin Mocha and Latte, with more schemes later
([colour modes](../done/2026-10-20-layout-look.md#q7-which-colour-modes-must-the-ui-support)), and
found 120% text more readable. Panes work poorly on a phone: their side borders and padding take the
room its narrow lines need. A bar or a menu floating over the page reads apart from the page through
its glass, without hiding what is behind it. Fonts are bundled because the server listens on the
loopback and often runs offline
([dependencies and fonts](../done/2026-10-20-layout-look.md#q9-may-the-redesign-add-dependencies-and-bundled-fonts)).
The human kept Lucide after comparing ten sets, and allowed another set's glyph where it fits better
([the icon set](../done/2026-10-20-layout-look.md#q1-which-icon-set-should-the-ui-use)). They chose
Codicons' marks for the harnesses that have one
([harness marks](../done/2026-10-20-layout-look.md#q2-how-should-a-session-show-which-harness-runs-it)),
and the dot-matrix tree as the logo
([logo](../done/2026-10-20-layout-look.md#q11-which-logo-concept-should-the-ui-use)). The
investigation is in
[discovery](../done/2026-10-20-layout-look.md#q2-which-visual-direction-should-the-ui-take).

Monaspace and Atkinson Hyperlegible Next are the default fonts, and each role's font is the human's
pick: the UI, headings, prose, code and keys, and their own messages
([fonts, by role](../ui/reading.md#fonts-by-role)). A pick is kept in the browser and read before
the app draws, so `theme/fonts.ts` writes it over the theme's font tokens, with its prose measure.
The theme keeps JetBrains Mono and Inter underneath.

## Alternatives considered

- Other visual directions, a natural one, a cyber one, and a blueprint one, each mocked up over the
  same views: the terminal one read best, and only took a few touches from the cyber one.
- Bordered panes on the phone too: their borders and padding left too little room for the text.
- Material Design Icons, as in the human's Neovim: complete, but heavier than the mono text.
- Neutral glyphs for every harness: no trademark question, but slower to recognise.

## Consequences

- Every view inherits the look from the theme, so later features restyle nothing.
- The marks of Claude Code and Codex are used without their owners' approval, as the human chose.
- The bundled fonts add to the app's download.

## Applies to

- [`packages/web/`](/packages/web/): its theme and its fonts in
  [`src/theme/`](/packages/web/src/theme/), its icons, and every view
