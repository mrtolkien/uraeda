# Rulings: Text focus on new work

The low-impact choices made while building [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: The New page's keys wait for Escape

- **Decision**: the New page opens with the focus in the composer, so its single keys (`s c f`, `/`,
  `j k` through the entries, `Space`) type into the field until `Escape` leaves it, as on every
  other field.
- **Rationale**: the proposal asks for the focus in the text field. The keyboard guide already makes
  `Escape` leave a field for the page's keys ([Keyboard](/specs/ui/keyboard.md#the-habits)), and `i`
  comes back to the composer.
- **If wrong**: the page's keys cost one more key, `Escape`. Undone by removing the visit's focus in
  `useComposerFocus` ([NewPage.tsx](/packages/web/src/NewPage.tsx)).
- **Where**: `packages/web/src/NewPage.tsx`

## R2: `s c f` move the focus to the composer, the arrows do not

- **Decision**: picking a card with `s c f` moves the focus to its composer, as a click or Space
  does. The cards' arrows, Home, and End keep it on the cards, and a pick in the same visit never
  takes it.
- **Rationale**: `s c f` say what to start, the same intent as opening the page at that kind. The
  arrows move through a radio group, where the focus follows the pick, as the
  [WAI-ARIA radio group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) describes.
- **Where**: `packages/web/src/KindCards.tsx`, `packages/web/src/NewPage.tsx`

## R3: Back to a scrolled New page keeps its place

- **Decision**: a visit that comes back to a New page scrolled down its entries, by Back or a
  reload, leaves the focus where it is: focusing the composer, above the entries, would scroll the
  human's place away.
- **Rationale**: the page restores its scroll on Back (`useRestoreScroll`), and the human was
  reading the entries, not writing.
- **Alternatives considered**: focusing without scrolling: Astryx's composer handle has no
  `preventScroll`, and a field focused out of view hides where typing goes.
- **Where**: `packages/web/src/NewPage.tsx`

## R4: The phone focuses only once a card is picked

- **Decision**: the phone's New page, opened with no card picked, has no composer to focus: the pick
  focuses it, by a tap or `s c f`, as before. Opened at a kind, it focuses the composer, which opens
  the phone's keyboard.
- **Rationale**: the phone's flow is New, pick, composer ([the phone](/specs/ui/phone.md)); opened
  at a kind, the human already said what to write.
- **Where**: `packages/web/src/NewPage.tsx`
