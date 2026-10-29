// The kind cards' own lengths (`KindCards.tsx`), and their art's, the small drawing of what each
// kind of work goes through (`KindArt.tsx`).
import * as stylex from "@stylexjs/stylex";

export const kindVars = stylex.defineVars({
  // A kind's chip: a touch target's height.
  "--kind-card-chip": "2.75rem",
  // The art's frame: one height for the three, so the cards line up.
  "--kind-art-stage": "11.5rem",
  // A bubble's tail's size.
  "--kind-art-tail": "6px",
  // A choice's letter in its chip, smaller than the text.
  "--kind-art-chip-text": "0.75em",
  // A skeleton line's thickness, a line of text's.
  "--kind-art-line": "5px",
  // The arrow between two steps pulled closer to them.
  "--kind-art-then": "-4px",
  // The width of a step's few lines at its end.
  "--kind-art-text": "3.5rem",
});
