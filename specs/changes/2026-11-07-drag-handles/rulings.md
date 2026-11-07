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

## R2: Every sheet closes on the sheet's own swipe, once

- **Decision**: An `info` sheet closes on the sheet's own swipe down too, not on Astryx's alone. A
  close that comes within 600 ms of another, from Astryx's gesture or the sheet's, is the same one,
  and is dropped.
- **Rationale**: Astryx's handle reads pointer events alone, which a phone's browser may take back
  for its own gestures: on such a phone, the key map and the pickers would not close on a swipe.
  Closing from both, without the guard, would close twice, and the second close goes Back once more,
  off the page.
- **Alternatives considered**: Leaving an info sheet's swipe to Astryx: it closes them only after a
  fling, or a drag past 40% of their height, where a form closes after 48 px.
- **If wrong**: An Escape or a tap outside within 600 ms of a swipe whose form asked to keep its
  text is dropped once. The Close button is never dropped.
- **Where**: `packages/web/src/layout/Sheet.tsx`, `useOneClose`

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
