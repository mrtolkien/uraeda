// The shell's column's own lengths: the phone's column, and what its folded rail draws, the usage
// bar (`sidebar/Allowance.tsx`) and a card's status mark (`sidebar/ItemCard.tsx`).
import * as stylex from "@stylexjs/stylex";

export const columnVars = stylex.defineVars({
  // The phone's column at its widest.
  "--column-phone-max": "400px",
  // The box of a row of the rail, which the usage bar is centred in.
  "--rail-row-box": "38px",
  // The usage bar's nudge towards the rows: the foot is inset 6.8 px from the rail's edge, and
  // the rows' boxes 7.3 px.
  "--rail-allowance-nudge": "0.5px",
  // The usage bar's track.
  "--rail-allowance-height": "6px",
  "--rail-allowance-width": "28px",
  // A card's status mark under its icon: from the rail's edge, and below the card's first line.
  "--rail-mark-below": "12px",
  "--rail-mark-start": "7.7px",
  // A column's pane action's icon, nudged past the room before it to stand under the rows'.
  "--column-action-nudge": "4.6px",
});
