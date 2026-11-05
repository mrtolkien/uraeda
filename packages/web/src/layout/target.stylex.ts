// The least a pointer's target measures, padding included: WCAG 2.5.8's 24 CSS px, on every width.
// What is drawn as text, as the status line's hints, keeps its look and takes the room around it.
import * as stylex from "@stylexjs/stylex";

export const targetVars = stylex.defineVars({
  "--target-least": "24px",
});
