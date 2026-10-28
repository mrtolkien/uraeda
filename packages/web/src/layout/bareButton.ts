// A raw button drawn as the text around it, or as a tile of the glass: no surface, frame, or
// padding of its own, in its text's font and colour. The status line's hints, the leader menu's
// rows and keys, the row bar's actions, and the glass's tiles.
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export const bareButtonStyles = stylex.create({
  bare: {
    background: "none",
    borderStyle: "none",
    borderWidth: 0,
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
  // Under the pointer, in the primary text's colour, out of the secondary text it is drawn in.
  lit: { color: { ":hover": colorVars["--color-text-primary"], default: "inherit" } },
});
