// The frosted glass's own colours (`glass.ts`), under what floats over the page: the phone's row
// actions, bottom bar, and sheets, and the leader menu.
import * as stylex from "@stylexjs/stylex";

export const glassVars = stylex.defineVars({
  // The tint over what is behind the glass: a warm amber of its own, not the theme's. On a light
  // page, a darker one, so the glass reads as smoked glass over the page's white, not as more of it.
  "--glass-tint": "light-dark(rgb(90 60 30 / 0.24), rgb(255 178 102 / 0.1))",
  // The page's own colour under the tint: text under the glass fades to a shape, so the glass's own
  // text reads over any page. Two thirds opaque on a dark page; on a light one, less, so the page
  // shows through, darkened by the tint.
  "--glass-scrim":
    "light-dark(color-mix(in srgb, var(--color-background-body) 40%, transparent), color-mix(in srgb, var(--color-background-body) 66%, transparent))",
});
