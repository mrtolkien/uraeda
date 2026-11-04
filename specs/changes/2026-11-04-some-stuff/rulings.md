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

## R3: A diagram wider than its room is drawn again to fit, then scaled within a tenth

- **Decision**: a diagram wider than its room is drawn again with Pele's `maxWidth`, as Pele's own
  `mount()` does, and kept when narrower. One still at most a tenth wider than its room is scaled
  down to fit. Wider than that, it scrolls sideways, as before.
- **Rationale**: Pele's fitted layout turned the mockup's flowchart top-down at 651 px, 17 px past
  its 634 px room: scrolling for 17 px hides a label's end behind a scroll bar, where 3% smaller
  text reads the same.
- **If wrong**: `NEAR_FIT` in [`Diagram.tsx`](/packages/web/src/Diagram.tsx); 1 turns the scaling
  off.
- **Where**: [`Diagram.tsx`](/packages/web/src/Diagram.tsx)
