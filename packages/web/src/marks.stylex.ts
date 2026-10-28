// The marks of a line: the bar at its start, and the room its sign or bullet hangs in.
import * as stylex from "@stylexjs/stylex";

export const markVars = stylex.defineVars({
  // A change's bar on the commit page (`CommitPage.tsx`).
  "--mark-change-bar": "2px",
  // A list section's note's bar, a callout's (`lists/SectionBody.tsx`).
  "--mark-note-bar": "3px",
  // A diff row's sign column: a character and a half of the code font (`spec/ledger/Rows.tsx`).
  "--mark-sign": "1.5em",
  // A list's markers' room, a bullet's (`spec/SpecOpening.tsx`, `BlockList.tsx`).
  "--mark-list-room": "1.25em",
});
