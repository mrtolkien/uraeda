// The lines that set parts apart without a pane: a rule above or below a part, as between a
// terminal's panes, and a bar down a part's side, as a quote or a callout draws it. A part's own
// colour, or a row's divider that its last row drops, stays the part's (UI look, UI coherence).
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export const ruleStyles = stylex.create({
  // A hairline above the part, in the border's colour.
  above: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
  },
  // A hairline below the part, in the border's colour.
  below: {
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
  },
  // A heavier line above a row, setting it apart from the one before, as a story's scenarios and a
  // spec part's rows are.
  between: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
  },
  // A bar down the part's start, its colour the part's, its text set in from it.
  bar: {
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});
