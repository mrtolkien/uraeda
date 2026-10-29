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
  // A card's status mark under its icon: from the rail's edge, and below the card's first line. A
  // sub-agent's mark stands under it, as far from the edge.
  "--rail-mark-below": "12px",
  "--rail-mark-start": "7.7px",
  // How far a card's frame and a pane's row start left of the card's row, in the closed rail.
  "--rail-frame-pull": "4px",
  // How far a pane's separator runs past the rail's edges, so it spans the whole rail.
  "--rail-separator-reach": "40px",
  // Commit's and New's icon, from their 38 px box's edge, under the rows' icons.
  "--rail-fit-inset": "11.5px",
  // A column's pane action's icon, nudged past the room before it to stand under the rows'.
  "--column-action-nudge": "4.6px",
});
