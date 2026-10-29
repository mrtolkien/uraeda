// The leader menu's own lengths (`LeaderMenu.tsx`), and the key map's (`KeyMap.tsx`).
import * as stylex from "@stylexjs/stylex";

export const menuVars = stylex.defineVars({
  // The key map's column of keys, room for `j ↓` beside each other, so the labels line up.
  "--key-map-keys": "5.5rem",
  // The key map's narrowest column of sections: as many side by side as the dialog holds.
  "--key-map-section": "18rem",
  // The menu's words, a step over the supporting text, at the body's 16 px: no type token is 16 px
  // under the theme's 120% sizes.
  "--menu-text": "16px",
});
