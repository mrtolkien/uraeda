---
status: active
approved-by: mrtolkien
icon: palette
---

# UI look

Uraeda looks like a terminal tool: a monospace font, Catppuccin colours, square corners, and
bordered panes with their title in their border, as in Neovim. Readability comes first, so text that
reads better in a proportional font gets one. The look lives in one theme, so the whole UI changes
together, and more colour schemes can join it later.

## Rules

- The UI MUST look like a terminal tool: square corners, and content grouped in bordered panes whose
  title sits in their top border. Checked by review.
- Text MUST be set for readability first: a monospace font by default, and a proportional font where
  it reads better, such as long prose. Checked by review.
- A new colour scheme MUST be added as a named scheme of the same theme, never as styles in a view.
  Checked by review.
- Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, in every
  scheme. Checked by a test of the theme's tokens.
- Text MUST be set at 120% of Astryx's base size, the size the human chose to read at. Checked by a
  test of the theme's tokens.
- Fonts MUST be bundled with the app under an open licence, and the UI MUST NOT load a file from
  another host. Checked by a test of the built app.
- A harness MUST be marked by Codicons' drawing of its mark where Codicons has one, and by a neutral
  glyph drawn for Uraeda otherwise. Checked by review.
- Icons SHOULD come from Lucide, and another free set's glyph MAY stand in where it fits a concept
  clearly better. Checked by review.

## Why

The UI looked vanilla and unfinished before 1.0. The human compared five directions and picked the
terminal one, with a touch of cyber
([the visual direction](../2026-10-20-layout-look/clarifications-01.md#q2-which-visual-direction-should-the-ui-take)).
They asked for Catppuccin Mocha and Latte, with more schemes later
([colour modes](../2026-10-20-layout-look/clarifications-01.md#q7-which-colour-modes-must-the-ui-support)),
and found 120% text more readable. Fonts are bundled because the server listens on the loopback and
often runs offline
([dependencies and fonts](../2026-10-20-layout-look/clarifications-01.md#q9-may-the-redesign-add-dependencies-and-bundled-fonts)).
The human kept Lucide after comparing ten sets, and allowed another set's glyph where it fits better
([the icon set](../2026-10-20-layout-look/clarifications-02.md#q1-which-icon-set-should-the-ui-use)).
They chose Codicons' marks for the harnesses that have one
([harness marks](../2026-10-20-layout-look/clarifications-02.md#q2-how-should-a-session-show-which-harness-runs-it)),
and the dot-matrix tree as the logo
([logo](../2026-10-20-layout-look/clarifications-01.md#q11-which-logo-concept-should-the-ui-use)).
The investigation is in [discovery](../2026-10-20-layout-look/discovery-01.md#the-visual-direction).

## Alternatives considered

- Natural, cyber, glass, and blueprint directions: drawn over the same views, and not picked.
- Material Design Icons, as in the human's Neovim: complete, but heavier than the mono text.
- Neutral glyphs for every harness: no trademark question, but slower to recognise.

## Consequences

- Every view inherits the look from the theme, so later features restyle nothing.
- The marks of Claude Code and Codex are used without their owners' approval, as the human chose.
- The bundled font adds to the app's download.

## Applies to

- [`packages/web/`](/packages/web/): its theme in [`src/theme/`](/packages/web/src/theme/), its
  icons, and every view
