// The frosted glass's own colours (`glass.ts`), under what floats over the page: the phone's row
// actions and bottom bar, and the leader menu.
import * as stylex from "@stylexjs/stylex";

export const glassVars = stylex.defineVars({
  // The tint over what is behind the glass: a warm amber of its own, not the theme's, the same on
  // a light page and a dark one.
  "--glass-tint": "rgb(255 178 102 / 0.1)",
  // The page's own colour under the tint, two thirds opaque: text under the glass fades to a
  // shape, so the glass's own text reads over any page, light or dark.
  "--glass-scrim": "color-mix(in srgb, var(--color-background-body) 66%, transparent)",
});
