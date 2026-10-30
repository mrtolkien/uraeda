# Space and motion

## Room

Room is consistent, so the eye reads structure from it, and set by tokens, never by a number in a
view:

| Room                                           | Token                                                   |
| ---------------------------------------------- | ------------------------------------------------------- |
| Under a pane's last line, and under its title  | `--pane-end` (`layout/pane.stylex.ts`)                  |
| A pane's sides                                 | `--pane-inset`, the theme's `--spacing-3` by default    |
| The page's sides, and what reaches past them   | `--page-inset` and `--page-bleed` (`layout/Page.tsx`)   |
| Between blocks of prose, a list's included     | `--prose-paragraph-gap`; airy paragraphs, `--spacing-4` |
| Around a table                                 | `--spacing-5`                                           |
| Between a round's question cards, and sections | `--spacing-8`                                           |
| Between a list's items                         | `--prose-item-gap`                                      |

- **A pane ends right after its last line**, with one room under it, `--pane-end`, the same as under
  its title, whether it ends with text or with a button. "Generally all those buttons at the end of
  panes don't have enough padding below them. Make sure it's a global variable." Its last block has
  no room of its own on top of that.
- **Blocks keep their room under them**, paragraph after paragraph, list after paragraph, even when
  a review wraps each block to make it tappable.
- **Sections are apart from each other** as cards are: a heading after a card, like "Settled without
  you" after the last question, has a card's room above it.
- **Wide content has room around it**: a table, an example's pane, a mockup.
- **No void.** Empty space with no job is cut: "the home layout should be SMART: minimize empty
  vertical space", and "pretty big at the bottom for no good reason" is the complaint to avoid.
- **The phone's insets are the sidebar's**, small, so the text has the screen's width; what reaches
  the screen's edges takes the page's inset back with `--page-bleed`, never a fixed number.

## Motion

"Anything that moves existing content deserves an animation."

- **Nothing jumps.** A layout never shifts on hover: the folded rail unfolds over the page, its
  icons staying where they were. "NOTHING SHOULD CHANGE PLACES."
- **About 200 ms, eased**, for what moves: the sidebar folding, the leader menu rising from the
  bottom and resizing, the columns gliding sideways to the selection, a row moving to its new place,
  a bar sliding away as the page scrolls. 100 ms was tried and felt abrupt.
- **Smooth scrolling** for the keys that scroll or move the selection, as a browser's arrows do.
- **No motion for its own sake**: no pulsing, no blinking. Motion shows where something went.
- **Reduced motion** is honoured: every animation is instant when the system asks for less motion.

## Speed

A press shows its effect at once.

- **Optimistic writes.** A move, an edit, or a reorder shows its result immediately, and the write
  runs behind it: "make everything optimistic and changes async". A refused write puts the result
  back and says why where it happened.
- **Instant layers.** A form closes as it is sent; a page's top changes at once ("Can the top change
  be instant?"); the leader menu opens without delay when clicked.
- **The one delay is deliberate**: the leader menu waits a moment after `Space`, so a quick key
  sequence never flashes it.
- **A git write never waits on its commit.** Its result shows at once, as the
  [UI behaviour](../decisions/ui-behaviour.md) decision asks, and its commit lands behind it, in
  order, one after another, while the commit toast says what is still landing
  ([surfaces](surfaces.md#the-commit-toast)). Nothing is blocked meanwhile, and no bar runs at the
  page's top. Only an action that is no git write, as "Starting the agent…" or "Stopping…", shows on
  its item's card until the server's status for it changes.
