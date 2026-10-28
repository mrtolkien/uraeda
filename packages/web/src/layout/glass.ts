// The phone's frosted glass, under what floats over the page: a row's actions, and the bottom bar.
import * as stylex from "@stylexjs/stylex";

export const glassStyles = stylex.create({
  // Tinted a warm amber of its own, not the theme's, over what is behind it, blurred: its shapes
  // and colours show through, never its words; blurred more, the dim text of a dark page blends to
  // one flat colour, as if opaque. One blur every browser draws: Firefox draws no backdrop at all
  // for one that names an SVG filter.
  surface: {
    // The amber tint, which StyleX's colour values do not list.
    "--glass-tint": "rgb(255 178 102 / 0.1)",
    backdropFilter: "blur(7px) saturate(1.8)",
    backgroundColor: "var(--glass-tint)",
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
