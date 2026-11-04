# Rulings: Some stuff is weirdly left-aligned

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: A diagram narrower than its room is centred

- **Decision**: a diagram that fits its room sits in its middle, in a pane, a question's card, or
  the page's text, rather than at its left edge.
- **Rationale**: the proposal names graphs among what is "weirdly left-aligned". A diagram is a
  figure, not a line of text: centred, a small one reads as part of its block, where at the left it
  left an empty strip on its right.
- **If wrong**: one `marginInline` in [`Diagram.tsx`](/packages/web/src/Diagram.tsx)'s `sized`.
- **Where**: [`Diagram.tsx`](/packages/web/src/Diagram.tsx)

## R2: A question holding a diagram keeps one column

- **Decision**: a question whose context, example, why, or options hold a diagram keeps one column,
  as one holding a table does, instead of the split card.
- **Rationale**: the [Panes size](/specs/done/2026-10-30-panes-size.md) record had a diagram scroll
  inside the question's column, about 450 px, where the round mockup's flowchart showed a third of
  itself. The proposal allows more change on the questions page where it reads better. One column is
  the rule tables already follow, in [Reading](/specs/ui/reading.md#tables).
- **Alternatives considered**: the card taking the page's whole column, as one with a live window
  does: a small diagram then left a wide empty card.
- **If wrong**: drop the `mermaid` blocks from `holdsWide` in
  [`Question.tsx`](/packages/web/src/Question.tsx).
- **Where**: [`Question.tsx`](/packages/web/src/Question.tsx)

## R3: A diagram much wider than its room is laid out for it, one within a tenth is scaled

- **Decision**: a diagram more than a tenth wider than its room is drawn again with Pele's
  `maxWidth`, as Pele's own `mount()` does, the room taken in steps of 8 px, and shows that layout
  once it is in, when narrower. One within a tenth of its room, natural or fitted, is scaled down to
  fit, its text a few percent smaller. Wider than that, it scrolls sideways, as before.
- **Rationale**: Pele's fitted layout turned the mockup's flowchart top-down at 651 px, 17 px past
  its 634 px room: scrolling for 17 px hides a label's end behind a scroll bar, where 3% smaller
  text reads the same. A natural layout already within a tenth keeps its shape, scaled, rather than
  turn into a taller one. A diagram to fit shows nothing until its fitted layout is in, so the page
  never shows one layout, then another of a new height; while the room changes, the last fitted
  layout stays until the next is in.
- **If wrong**: `NEAR_FIT` and `FIT_STEP` in
  [`useDiagramDraw.ts`](/packages/web/src/useDiagramDraw.ts); `NEAR_FIT` at 1 turns the scaling off.
- **Where**: [`useDiagramDraw.ts`](/packages/web/src/useDiagramDraw.ts)
