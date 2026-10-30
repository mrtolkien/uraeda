// The bars' own lengths: the tiles of the phone's bottom bar (`NavBar.tsx`), the row bar that
// floats over the phone's keyboard (`lists/RowBar.tsx`), and how far each slides to hide.
import * as stylex from "@stylexjs/stylex";

export const barVars = stylex.defineVars({
  // A tile of the bottom bar that is a button of its own, one of one or two: a 44 px target at
  // least, inside the bar's row.
  "--bar-button": "2.75rem",
  // The room between a tile's icon and its word.
  "--bar-tile-gap": "0.25rem",
  // A tile's least width, as wide as a finger and more than a 44 px target: five tiles, their
  // words in the widest bundled font, fit a 360 px phone's row bar.
  "--bar-tile-least": "3.5rem",
  // A tile's word, small under its icon: no type token is 0.75 rem on every screen.
  "--bar-word": "0.75rem",
  // The room between the phone's keyboard and the row bar floating over it.
  "--bar-keyboard-room": "0.5rem",
  // How far past its own height a bar slides to hide: the row bar, and the bottom bar, its shadow
  // cast up the page out of sight too.
  "--bar-hide-past": "1rem",
  "--bar-hide-past-docked": "2rem",
});
