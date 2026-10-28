// The leader menu's own lengths (`LeaderMenu.tsx`).
import * as stylex from "@stylexjs/stylex";

export const menuVars = stylex.defineVars({
  // The menu's words, a step over the supporting text, at the body's 16 px: no type token is 16 px
  // under the theme's 120% sizes.
  "--menu-text": "16px",
});
