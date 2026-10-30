# Rulings: Phone bottom bars on more pages

The low-impact choices made while building the change, inside the limits of
[its proposal](proposal.md), [its answered round](clarifications-01.md), and the decisions. None
binds future work: those are decisions.

## R1: The bar's shape follows the count of its tiles

- **Decision**: `NavTiles` counts its children and draws the shape itself: one tile is a square
  glass button at the bottom right, two a button in each corner, three or more the bar of glass
  across the screen. The glass moved from the status line's row to what `NavTiles` draws, and the
  row takes no tap where no glass is drawn.
- **Rationale**: every bar, today's and the new ones, follows the proposal's shapes from one place,
  [one home per rule](/skills/uraeda/references/code-quality.md). The count is of React's children,
  so a tile shown or not is written `{shown && <NavTile />}`: the decisions' reader's Previous and
  Next became two tiles instead of one fragment.
- **Alternatives considered**: counting the tiles drawn in the page, after it draws: a second
  render, and a bar that changes shape once shown. Each page passing its shape: the same rule in
  every page.
- **If wrong**: a child that draws nothing would count as a tile. Every caller's children are tiles
  today; `layout/NavBar.tsx`'s comment says so.
- **Where**: `layout/NavBar.tsx`, `shell/StatusLine.tsx`, `decisions/DecisionsPage.tsx`.

## R2: A corner button sits inside the bar's row

- **Decision**: a floating button is `--bar-button`, 2.75 rem, a 44 px target at least, at the
  bottom of the bar's row, with a step of room around it.
- **Rationale**: the page's end already scrolls past the bar's row, so its content shows above the
  buttons too, as the human's note asks, with no second padding to keep in step.
- **Where**: `layout/bar.stylex.ts`, `layout/NavBar.tsx`.

## R3: The page's surface goes under the status line's row

- **Decision**: the frame's surface is at least the window's height, the row included.
- **Rationale**: between the corner buttons, the row showed the window's background under a short
  page, a band of another colour. The bar of glass used to hide it.
- **Where**: `Shell.tsx`.

## R4: The feature's sheets show the panes' rows without their pane

- **Decision**: the Produced and Links sheets hold `ProducedRows` and `LinkRows`, titled by the
  sheet, and hug their content. A figure's jump into the page closes the sheet first.
- **Rationale**: a sheet titled "Links" over a pane titled "Links" said it twice. The jump waits as
  the spec's Contents do (`afterOverlayCloses`), since the page under a sheet does not scroll.
- **Where**: `feature/FeatureBar.tsx`, `feature/ProducedPane.tsx`, `feature/LinksPane.tsx`.

## R5: The Commit tile runs as a git write of its own

- **Decision**: the commit page's Commit tile starts its commit through `useOwnWrite`, as the page's
  Commit button does: the write's progress shows at the top, and both tiles are blocked while any
  write runs. The tile has no "Committing…" label: a tile holds no words. Its icon is Lucide's
  `save`, as the human asked.
- **Rationale**: the [UI behaviour](/specs/decisions/ui-behaviour.md) decision asks that a git write
  block the others from the UI until it ends.
- **Where**: `CommitPage.tsx`. Discard is blocked while a write runs too; the wide page's Discard
  button was not, before this change, and stays so: outside the proposal.

## R6: The research effort's pick is dropped as the page draws

- **Decision**: in `useResearchEffort`, the effort picked is dropped during the render once the file
  says the same or the write was refused, not in an effect.
- **Rationale**: moved out of the page so the page stays under its 100 lines, React Compiler
  compiles it, and lint refuses a state set in an effect. Setting it during the render is the
  pattern React documents for it, and shows the same: the pick at once, then the file's.
- **Where**: `EditorPage.tsx`.

## R7: The new UI rules after the catch-up

- **Decision**: the testing decision, rewritten on the default branch while this change was built,
  asks that each changed view be reviewed in both themes and at a phone's and a desktop's width.
  Each changed view was, in the sandbox.
- **Rationale**: it applies to every view the change touched, without conflict.
- **Where**: [testing](/specs/decisions/testing.md).
