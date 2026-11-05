// The bars' own lengths: the phone's top tabs (`shell/Tabs.tsx`), the tiles of its bottom bar
// (`NavBar.tsx`), the row bar that floats over the phone's keyboard (`lists/RowBar.tsx`), and how
// far each slides to hide.
import * as stylex from "@stylexjs/stylex";

export const barVars = stylex.defineVars({
  // Half the glass between two of the phone's top tabs' fills, inside their 44 px targets: a 4 px
  // strip in all.
  "--bar-tab-room": "0.125rem",
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
  // The bottom bar's word, a step smaller, as a phone's tab bar writes its words: its icon and its
  // word fit a tile as tall as the top tabs.
  "--bar-word-small": "0.6875rem",
  // A word's line, no taller than its letters, so it sits close under its icon.
  "--bar-word-line": "1.2",
  // The room between a bottom bar tile's icon and its word.
  "--bar-word-gap": "0.125rem",
  // The room between the phone's keyboard and the row bar floating over it.
  "--bar-keyboard-room": "0.5rem",
  // How far past its own height a bar slides to hide: the row bar, and the bottom bar, its shadow
  // cast up the page out of sight too.
  "--bar-hide-past": "1rem",
  "--bar-hide-past-docked": "2rem",
});
