# Rulings: Reading and layout pass

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: A pane reaches past the page's inset, rather than the page losing it

- **Decision**: on the phone, a reading page keeps its 7.8 px inset, and each of its top-level panes
  takes it back to 2 px from the screen's edges, with 3 px inside its border, the proposal's
  numbers.
- **Rationale**: the page's own text, its crumbs, its title, and a question's heading and context,
  sits outside any pane: with the page's inset at 2 px, it touched the screen's edge. This way the
  text inside a pane starts at about 6 px, and the page's own text at 7.8 px, nearly in line.
- **Alternatives considered**: a 2 px page inset, the panes inside it: the page's own text then sat
  2 px from the edge.
- **Where**: `packages/web/src/layout/Pane.tsx`, `snugOnPhone`

## R2: The replaced behaviour sits in a pane titled Behaviours

- **Decision**: the spec page's Replaced behaviour draws its list in one pane, titled "Behaviours",
  under the section's heading, as How it is built draws Architecture.
- **Rationale**: its list was the only part of the spec drawn bare, from the page's left edge rather
  than its panes', at a reading pane's measure, so it read as stray text between centred panes.
- **Alternatives considered**: a pane for each behaviour, its claim as the title: it parses the
  item's bold lead, which the spec page otherwise draws as written.
- **Where**: `packages/web/src/spec/SpecPage.tsx`
