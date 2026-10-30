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

## R3: A wide table grows past its pane, framed, as a live window does

- **Decision**: in a pane, on semi-wide and wide screens, a table wider than the pane grows past it
  into the empty room beside it, centred as far as that room allows, with its own border over the
  pane's; it scrolls only past that room. On the phone it still scrolls inside its pane.
- **Rationale**: the reading guide already lets a live window grow past its pane, by the same
  measure (`embedLayout.ts`). A wider pane would end at another edge than the page's other panes,
  which the UI layout decision turned down. A table's width is its columns', from their longest
  text, as Astryx lays them out.
- **Alternatives considered**: keep it in the pane, with a fade at the clipped edge: the table still
  reads a column at a time.
- **If wrong**: a table drawn past its pane looks out of place: drop the growth in `TableBlock`, and
  it scrolls inside again.
- **Where**: `packages/web/src/Blocks.tsx`, `TableBlock`

## R4: The UI look decision's phone rule stays as approved

- **Decision**: the rule reads as approved in round 01, for every pane on the phone, though only a
  reading page's panes take the 2 px and 3 px room; a home card or a session's pane keeps its own.
- **Rationale**: the human approved this wording, and the rule it replaced was as wide: it too held
  only for the panes that opted in. Narrowing it is a change of an active decision, for a round.
- **If wrong**: a review against the rule would ask for the room on every page: scope the rule to
  reading pages, with the human's approval.
- **Where**: `specs/decisions/ui-look.md`

## R5: Small review findings left as they are

- **Decision**: three points stay. The answered round keeps "stays proposed until you approve it",
  as it read when asked: the decision commit records the approval. A question's options set
  `--pane-phone-reach` to `0%`, as `calc(2px - 0)` is not valid CSS and the token lint refuses a raw
  `0px`. A table's frame reads its holder's room when drawn and when the width class changes, not
  when it moves from a card to a pane, which no view does.
- **Rationale**: none changes what a user sees.
- **Where**: `clarifications-01.md`, `packages/web/src/Question.tsx`, `packages/web/src/Blocks.tsx`
