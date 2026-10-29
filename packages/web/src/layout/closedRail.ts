// Whether the shell's column is drawn as its closed rail of icons, on a semi-wide screen or folded
// on a wide one, until it opens over the page. The column's parts read it to draw the rail's look:
// panes as separators, cards as framed icons, rows as their icons alone (`shell/Column.tsx`).
import { borderVars, colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, use } from "react";
import { columnVars } from "../shell/column.stylex.ts";

export const ClosedRail = createContext(false);

/** Whether the closed rail draws what reads it. */
export function useClosedRail() {
  return use(ClosedRail);
}

/** A pane in the closed rail (`Pane.tsx`): no frame, its top line a separator, its title hidden. */
export const railPaneStyles = stylex.create({
  pane: {
    borderColor: "transparent",
    // Its top line, over the whole rail's width, where its border's top was.
    "::before": {
      borderBlockStartColor: colorVars["--color-border"],
      borderBlockStartStyle: "solid",
      borderBlockStartWidth: borderVars["--border-width"],
      content: '""',
      insetBlockStart: "var(--pane-border-pull)",
      insetInlineEnd: `calc(-1 * ${columnVars["--rail-separator-reach"]})`,
      insetInlineStart: `calc(-1 * ${columnVars["--rail-separator-reach"]})`,
      pointerEvents: "none",
      position: "absolute",
    },
    // Up by the border's width: a custom property, as the token lint takes a `var()` only whole,
    // not in a calc.
    "--pane-border-pull": "calc(-1 * var(--pane-border))",
  },
  title: { visibility: "hidden" },
});
