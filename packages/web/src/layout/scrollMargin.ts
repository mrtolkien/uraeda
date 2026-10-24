// The room a jump leaves above what it scrolls to: below the phone's tabs, which stay in view, a row
// of `--spacing-12`; a step from the top of what shows on a wider screen.
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

export const scrollMarginStyles = stylex.create({
  belowBar: {
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  belowNothing: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  // A pane's title stands half over its top border, the pane's top margin: a jump shows it whole.
  paneBelowBar: {
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]} + ${spacingVars["--spacing-3"]})`,
  },
  paneBelowNothing: {
    scrollMarginTop: `calc(${spacingVars["--spacing-4"]} + ${spacingVars["--spacing-3"]})`,
  },
});

/** The room above a jump's target, by the window's width: a pane's leaves room for its title. */
export function useScrollMargin(kind: "block" | "pane" = "block") {
  const narrow = isNarrow(useWidthClass());
  if (kind === "pane") {
    return narrow ? scrollMarginStyles.paneBelowBar : scrollMarginStyles.paneBelowNothing;
  }
  return narrow ? scrollMarginStyles.belowBar : scrollMarginStyles.belowNothing;
}
