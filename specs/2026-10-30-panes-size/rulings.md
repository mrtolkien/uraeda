# Rulings: Panes size

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Every reading page's column is the two-panes width

- **Decision**: a spec's, a plan's, a document's, and a round's page share one kind, `reading`: a
  column two reading panes and their gap wide, each pane a reading pane at most, centred.
- **Rationale**: a round needs the room for its split cards and a spec for its decision cards; a
  live window in either grows to the page's column. With the 1,200 px column gone, the two-panes
  width is the scale's next width up, and one kind replaces `isReading` with and without `isPaired`.
- **Alternatives considered**: a reading page as wide as one reading pane, with wider cards reaching
  past it: they would have no room to measure, and would overlap the side column on a narrow room.
- **If wrong**: a spec's live window grows to 1,424 px instead of 1,200 px; a kind of its own for
  the round brings it back.
- **Where**: task 1, `layout/Page.tsx`.

## R2: A question card splits once it has its split width

- **Decision**: a card splits into two columns once its group is at least `--size-split-card` wide,
  in place of the 840 px of `--size-round-split`.
- **Rationale**: the spec's scenario: "When a card has less room than its split width, Then it keeps
  one column". A split card narrower than its width would set its question under 50 characters a
  line.
- **If wrong**: cards between 840 px and 1,080 px of room show one column instead of two; a token of
  its own brings the old threshold back.
- **Where**: task 2, `QuestionCards.tsx`.

## R3: The side column's rail is the sidebar's width

- **Decision**: the side column's rail, folded on a wide window or railed on a half screen, is
  `--size-rail`, 52 px, in place of 48 px.
- **Rationale**: the spec's scenario draws a 52 px rail, and the code's own comment says the rail is
  the left sidebar's width, which is 52 px.
- **Where**: task 4, `layout/SideColumn.tsx`.

## R4: The column opened over the page has no resize bar

- **Decision**: opened over the page from its rail, the column keeps the width dragged on a wider
  window, and shows no resize bar.
- **Rationale**: the open column closes when the pointer leaves it; a drag at its edge would close
  it on the way, as the sidebar's open rail has no resize bar either.
- **Where**: task 4, `layout/SideColumn.tsx`.

## R5: The success criteria are measured, not tested

- **Decision**: SC-001 to SC-003 are measured in the sandbox, and the numbers go in the pull
  request; no test measures a page's width.
- **Rationale**: the [Testing](/specs/decisions/testing.md) decision rejects browser tests with
  measures, and the spec says "measured in the sandbox". The round's "the plan adds a check of each
  page's width" predates it in spirit and is read through it.
- **Where**: task 5.
