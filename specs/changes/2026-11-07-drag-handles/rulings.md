# Rulings: Drag handles on the phone's sheets

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: A swipe down closes a form sheet, and asks first when it has text

- **Decision**: A swipe down on any sheet's top closes it, forms included. A form sheet closes
  through its `onClose`, the same path as its Close button, so a form with text still asks before it
  drops it.
- **Rationale**: Most sheets are forms (`Overlay`'s default `purpose`), and Astryx closes a sheet on
  a swipe only when its purpose is `info`: the session's sheet, a form, sprang back. Making every
  sheet `info` would also close a form on a tap outside, which loses a draft without a gesture meant
  to close it.
- **Where**: `packages/web/src/layout/Sheet.tsx`, `useTopSwipe`

## R2: An info sheet's swipe stays Astryx's

- **Decision**: On an `info` sheet, Astryx alone closes it on a swipe down; the sheet's own swipe
  only takes it up.
- **Rationale**: Closing it from both would close it twice, and the second close goes Back once
  more, off the page.
- **If wrong**: If Astryx's own swipe fails on a phone, an info sheet (the key map, a picker) does
  not close on a swipe. Passing `onClose` for every sheet, with a guard against the second close,
  fixes it.
- **Where**: `packages/web/src/layout/Sheet.tsx`, `Sheet`

## R3: Only the sheet's top takes the swipe

- **Decision**: The swipe starts in the sheet's top 64 px, its handle and title row, and not on
  content scrolled down. A swipe down from the whole screen closes the sheet too, rather than
  bringing it back to its own height.
- **Rationale**: The proposal names the drag handle. A swipe down elsewhere scrolls the content, and
  closing it there would close the sheet when the human meant to scroll back up. The whole screen
  has no stop under it but closed, as the proposal's "close the pane on swipe down" reads.
- **Alternatives considered**: Closing on a swipe down anywhere at the top of the content, as Astryx
  does for an info sheet: it would fight the session's transcript, which scrolls.
- **Where**: `packages/web/src/layout/Sheet.tsx`, `isScrolledDown`
