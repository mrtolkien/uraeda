// What a row of the column does under the pointer: it brightens. One style for the cards and the
// plain rows, so they answer the pointer the same way.
import * as stylex from "@stylexjs/stylex";

export const brighten = stylex.create({
  hover: {
    cursor: "pointer",
    filter: { ":hover": "brightness(1.25)", default: "none" },
  },
}).hover;
