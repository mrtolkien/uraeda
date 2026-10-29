// What follows a pane's title in its border: a live window's size and scale, a record's rounds, or
// a decision's "New" badge.
import { colorVars, fontWeightVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { paneVars } from "./pane.stylex.ts";

const styles = stylex.create({
  // Secondary, in the title's line.
  suffix: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-normal"],
  },
  // Words take the room the title leaves, wrapping in it, or go under it when that room is narrower
  // than a few words; a badge keeps its own width, or the title's band would run on past it.
  words: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: paneVars["--pane-suffix-least"],
  },
});

/** The suffix `children` after a pane's title, words or a badge. */
export function PaneSuffix({ children }: { children: ReactNode }) {
  return (
    <span {...stylex.props(styles.suffix, typeof children === "string" && styles.words)}>
      {/* The space is for the text's reading: flex items show no space between them. */} {children}
    </span>
  );
}
