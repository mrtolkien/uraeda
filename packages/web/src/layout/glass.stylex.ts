// The frosted glass's own colours (`glass.ts`), under what floats over the page: the phone's row
// actions, bottom bar, and sheets, the leader menu, and the key map.
import * as stylex from "@stylexjs/stylex";

export const glassVars = stylex.defineVars({
  // The tint over what is behind the glass: a warm amber of its own, not the theme's. On a light
  // page, a faint one: a darker, smoked tint left its text under the contrast the theme asks for.
  "--glass-tint": "light-dark(rgb(90 60 30 / 0.06), rgb(255 178 102 / 0.1))",
  // The page's own colour under the tint: text under the glass fades to a shape, so the glass's own
  // text reads over any page, at 4.5:1 or more. Two thirds opaque on a dark page; on a light one,
  // more, since dark text needs a lighter ground than the blurred shapes of a light page give it.
  "--glass-scrim":
    "light-dark(color-mix(in srgb, var(--color-background-body) 85%, transparent), color-mix(in srgb, var(--color-background-body) 66%, transparent))",
  // The page dimmed under a glass that holds the focus, the key map's: on a light page, Latte's text
  // at 30%, where Astryx's dialogs dim it to 70%, which turns the glass grey; on a dark page, as
  // theirs, Mocha's crust at 80%.
  "--glass-dim": "light-dark(rgb(76 79 105 / 0.3), rgb(17 17 27 / 0.8))",
});
