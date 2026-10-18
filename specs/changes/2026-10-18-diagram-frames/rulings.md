# Rulings: Diagram frames

The low-impact choices made while building [the change](proposal.md), inside the limits of the
[round](clarifications-01.md) and the decisions. None binds future work: those are decisions.

## R1: Pele 1.5.2, not 1.6.0

- **Decision**: `packages/web` depends on `pele` at `^1.5.2`, which resolves to 1.5.2.
- **Rationale**: the repository's `minimumReleaseAge` in
  [`pnpm-workspace.yaml`](/pnpm-workspace.yaml) holds back versions that are only days old, and
  1.6.0 came out on 2026-10-17. An exclusion for it would bypass a supply-chain guard for one
  library.
- **Alternatives considered**: excluding `pele@1.6.0`, which the guard exists to avoid.
- **If wrong**: raise the range once 1.6.0 passes the age, with `vp add pele`.
- **Where**: [`packages/web/package.json`](/packages/web/package.json).

## R2: Each diagram draws responsive, its card scrolls when it is wider

- **Decision**: the diagram's box is as wide as Pele draws it, up to 4,000 by 3,000 pixels, and
  Pele's own `max-width: 100%` scales a larger one to the box. The card scrolls sideways when the
  box is wider than its room, as before.
- **Rationale**: a 16-step flowchart is 3,045 pixels wide, and shrunk to a phone it cannot be read.
- **Alternatives considered**: Pele's `maxWidth` option, which switches a wide flowchart to a
  vertical layout: it changes the diagram's reading, so it stays out of this change.
- **If wrong**: pass `maxWidth` the card's room to `renderAsync`.
- **Where**: [`Diagram.tsx`](/packages/web/src/Diagram.tsx).

## R3: Colours from the theme's tokens

- **Decision**: Pele's variables take the Astryx tokens: `--pele-bg` the surface colour,
  `--pele-surface` the muted background, `--pele-fg` the primary text, lines the secondary text.
- **Rationale**: the tokens change with the colour mode, so a diagram needs no redraw in the dark
  mode, and the round's axe checks pass in both. The screenshots show both.
- **Alternatives considered**: Pele's defaults, white boxes on the dark page.
- **If wrong**: a diagram in a card of another background shows a patch where an edge label covers a
  line: change `--pele-bg` there.
- **Where**: [`Diagram.tsx`](/packages/web/src/Diagram.tsx), its `theme` style.

## R4: The live-edit item could not be reproduced as a failing test

- **Decision**: the item is fixed by structure, and tested as a behaviour, but the test passed on
  the old code too.
- **Rationale**: the old component measured its card once, and its failed state returned another
  element, so the width followed the discarded one. The measured width stayed as it was at the
  start, which is right unless the card's width changes: no browser test here resizes the page. The
  new component keeps one element for the diagram's life.
- **Alternatives considered**: a test that resizes the window, which the browser tests have no
  command for.
- **If wrong**: the card's width stops following a resize after a failed draw, as before.
- **Where**: [`diagram.test.tsx`](/packages/web/src/__browser__/diagram.test.tsx).
