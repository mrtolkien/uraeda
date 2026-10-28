// The frosted glass under what floats over the page: the phone's row actions and bottom bar, and
// the leader menu.
import * as stylex from "@stylexjs/stylex";
import { glassVars } from "./glass.stylex.ts";

export const glassStyles = stylex.create({
  // Tinted a warm amber of its own, not the theme's, over what is behind it, blurred: its shapes
  // and colours show through, never its words; blurred more, the dim text of a dark page blends to
  // one flat colour, as if opaque. One blur every browser draws: Firefox draws no backdrop at all
  // for one that names an SVG filter.
  surface: {
    // Its amber tint over the page's own colour (`glass.stylex.ts`).
    backdropFilter: "blur(7px) saturate(1.8)",
    backgroundColor: glassVars["--glass-scrim"],
    backgroundImage: `linear-gradient(${glassVars["--glass-tint"]}, ${glassVars["--glass-tint"]})`,
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own spelling, which Safari still needs
    WebkitBackdropFilter: "blur(7px) saturate(1.8)",
  },
  // A box floating free: a bright rim catches the light on its top edge, and a soft shadow lifts it.
  floating: {
    boxShadow:
      "inset 0 0 0 1px rgb(255 226 190 / 0.4), inset 0 1px 1px rgb(255 248 236 / 0.75), inset 0 -1px 2px rgb(255 190 130 / 0.18), 0 10px 30px rgb(0 0 0 / 0.28)",
  },
  // A bar on the screen's bottom edge: the rim on its top edge alone, its shadow cast up the page.
  docked: {
    boxShadow:
      "inset 0 1px 0 rgb(255 226 190 / 0.4), inset 0 2px 1px -1px rgb(255 248 236 / 0.5), 0 -6px 24px rgb(0 0 0 / 0.24)",
  },
});
