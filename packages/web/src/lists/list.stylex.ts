// The lists' own lengths: a row's box, and its bullet's or icon's in its gutter (`Card.tsx`,
// `RowBar.tsx`), and the columns and panes a list is laid out in (`SectionBody.tsx`,
// `WorkList.tsx`).
import * as stylex from "@stylexjs/stylex";

export const listVars = stylex.defineVars({
  // The room above and below a line of a row: its text's, and its bar's.
  "--list-row-room": "0.125rem",
  // The gutter before a row's text: a 1 rem bullet or icon, and a little room after it. A nested
  // row steps in by as much for each level.
  "--list-gutter": "1.5rem",
  // The box of a row's bullet or icon in its gutter, centred on its first line, so that bullets
  // and icons line up in one column.
  "--list-mark-height": "1.5rem",
  "--list-mark-inset": "0.125rem",
  "--list-mark-width": "1rem",
  // The marks after a row's text, smaller than it.
  "--list-marks-size": "0.85em",
  // A column of a row of lists at its narrowest, and a column of a list whose lines are long, as
  // the priorities'.
  "--list-column-least": "400px",
  "--list-column-roomy": "500px",
  // The widest of a list whose lines are long: 80 characters a line, the measure of prose, with
  // room for the bullet and the pane's sides.
  "--list-line-max": "calc(80ch + 4rem)",
  // On the phone, the room under an outline's last row for the bar floating at the screen's
  // bottom, which a row scrolls clear of.
  "--list-bar-room": "6rem",
});
