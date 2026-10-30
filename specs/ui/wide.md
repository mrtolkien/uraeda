# Wide screens

From 1280 px: a full desktop. The keyboard is at hand, the pointer too, and there is room for the
page and its companions side by side.

## The frame

- **The sidebar** on the left, open, about 14% of the window and resizable, or folded to the rail
  with `[`, unfolding over the page on hover as on [semi-wide screens](semi-wide.md).
- **Unfold**, folded, the rail's first button, above Commit and New: its icon alone in the rail, its
  name too once the rail opens over the page. A click or a tap unfolds the sidebar, as `[` does. Its
  room opens and closes as the sidebar's width eases, so the rows under it glide, never jump.
- **The page** in the middle of the room right of the sidebar, as if the side column were closed, as
  far as the room allows (`layout/useScreenCentre.ts`): the home's columns sit in the middle of what
  shows beside the sidebar, and a page stays where it is as the side column opens. Each page takes
  its width from [the scale](reading.md#the-scale-of-widths): a document centres its panes, each a
  reading pane; a page of rows keeps a reading pane's text column; a round's split question card
  holds the question beside its answers, at a split card's width. The round's context stays one pane
  wide, its parts one under the other: "put them back one by one".
- **The decisions page** puts its list and its reader side by side only where the list shows about
  40 characters a line and the reader 60 (`decisions/useSplit.ts`); narrower, the list is the page
  and what is open is a page of its own, at the reading measure. The reader grows first, to 80
  characters, then the list, to 60, and the two are centred together, as a page is. The constitution
  is one page, at `/decisions/constitution`.
- **The side column** on the right, for a document's or a session's companions, 400 px until
  dragged, foldable with `]`, resizable, its tab in the address.
- **The status line** at the bottom: `Space menu`, `[ ] fold`, then the page's hints in the order
  they are used, each one clickable, and the counts of what needs the human and what runs.

## Pages of columns

The priorities are a page of columns, one per section, each 500 px at least, taking the window's
whole width, or, at the human's choice with `v`, one centred list, its text column a reading pane,
as on every page of rows. The switch is the human's, not a breakpoint's: "Instead of doing the
switch ourself it should simply be up to the user." Moving the selection across columns glides the
view sideways to it.

## Layers

- **Popovers** for menus, anchored to what opened them.
- **Dialogs** for the shared confirmation, short forms, and pickers, centred.
- **The leader menu** in the bottom right, over the page, in the phone bars' frosted glass, rising
  from the bottom, its frame easing to each group's size.

## The pointer

- Hover brightens what can be pressed, as a whole, and moves a list's selection to the row under the
  pointer.
- A click selects; a click on the selected row, or a double click, edits it.
- Rows drag to reorder, and sideways to nest, with the dragged row's children.
- Hover is never the only way: everything hovered can be reached by a key and by a tap.
