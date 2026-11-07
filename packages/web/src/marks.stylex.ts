// The marks of a line: the bar at its start, and the room its sign or bullet hangs in.
import * as stylex from "@stylexjs/stylex";

export const markVars = stylex.defineVars({
  // A list section's note's bar, a callout's (`lists/SectionBody.tsx`).
  "--mark-note-bar": "3px",
  // A diff row's sign column: a character and a half of the code font (`spec/ledger/Rows.tsx`).
  "--mark-sign": "1.5em",
  // A list's markers' room, a bullet's (`spec/SpecOpening.tsx`, `BlockList.tsx`): prose's, which
  // the theme's markdown lists take too.
  "--mark-list-room": "var(--prose-list-room)",
  // A ledger row's faint tint, its role at 6% over the pane, light enough that muted words keep
  // 4.5:1 on it over the page's darker surface on the phone (`spec/ledger/Rows.tsx`).
  "--mark-row-added": "color-mix(in srgb, var(--role-added) 6%, transparent)",
  "--mark-row-changed": "color-mix(in srgb, var(--role-caution) 6%, transparent)",
  "--mark-row-removed": "color-mix(in srgb, var(--role-removed) 6%, transparent)",
});
