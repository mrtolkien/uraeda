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

## R6: What a reading page draws outside its panes starts at their edge

- **Decision**: a style of `Page.tsx`, `pageText`, puts a reading page's title, crumbs, review line,
  and a plan's opening blocks at its panes' left edge, a reading pane wide, from variables only the
  `reading` kind sets (`--page-text-max`, `--page-text-centre`).
- **Rationale**: the spec puts the title and crumbs at the panes' edge; the review line and a plan's
  Important callout sat at the page's edge too, 140 px left of everything under them. Variables of
  their own keep the editor's title, whose page sets `--pane-max` for its panes, where it was.
- **If wrong**: a wide table in a plan's opening scrolls at 692 px rather than at the page's width.
- **Where**: task 1, `layout/Page.tsx`, and the files it lists.

## R7: A token made of others is measured, not parsed

- **Decision**: `useAtLeast` resolves its token with a hidden probe as wide as it, in place of
  parsing the token's text.
- **Rationale**: `--size-split-card` is a `calc()` of other tokens: its computed text is the
  unevaluated `calc()`, which parsed as no width, so no card ever split. Found by the review of
  wave 1.
- **Where**: task 2, `layout/useWidthOf.ts`.

## R8: A branch's decision page keeps a reading pane

- **Decision**: a branch's decision, on its own page, is a page of rows: its card, which a spec
  draws at the big-text width, is a reading pane there.
- **Rationale**: the spec's big-text width is for a spec's decision cards (US5), and the page of a
  decision is a page of rows (US1).
- **Where**: task 1, `decisions/BranchDecision.tsx`.

## R9: The railed column has its own button, and one owner for `]`

- **Decision**: the railed column draws an "Show the column" button at the top of its rail, the
  sidebar rail's logo button's twin, which a tap opens and Escape focuses; `]` stays `ColumnAt`'s
  one binding, which opens or closes the rail when railed and folds the column otherwise.
- **Rationale**: `useRail` needs a button to return the focus to on Escape, and touch needs a
  target; two components binding `]` clashed in the key registry while the window crossed into the
  rail.
- **Where**: task 4, `layout/SideColumn.tsx`.

## R10: One rail open at a time

- **Decision**: opening the sidebar's rail closes the side column's, and the other way round
  (`shell/Rail.tsx`'s `claim`).
- **Rationale**: each open rail binds Escape as a fallback, and the key registry refuses two; one
  Escape then folds the one rail open. Found by the review of wave 2.
- **Where**: `shell/Rail.tsx`, `layout/SideColumn.tsx`.

## R11: The railed column moves the keyboard's focus with its button

- **Decision**: opened from its button, the railed column moves the focus to its open tab; closed by
  Escape from inside it, the focus goes back to the button.
- **Rationale**: the button belongs to the closed rail, so opening the column removed the focused
  element, and the focus fell to the page. Found by the review of wave 2.
- **Where**: `layout/SideColumn.tsx`, `useRailFocus`.

## R12: On a half screen, the column narrows before it rails

- **Decision**: on a semi-wide window, the column beside its page draws narrower than its dragged
  width when it must, so the page keeps a reading pane; it becomes a rail only when even its least,
  400 px, would not leave that. The width kept in the browser does not change.
- **Rationale**: deciding the rail on the dragged width let a drag turn the column into a rail under
  the pointer, its resize bar gone, and the kept width railed every page at that window size. Found
  by the final review.
- **If wrong**: a column dragged wide shows narrower on a half screen than on a wide one.
- **Where**: `layout/columnRail.ts`'s `useRailing`.
