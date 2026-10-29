// The muted band between the parts of a page that reads as one column: between a round's sibling
// questions, before its settled points on the phone, and before a review's end.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  band: {
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
  },
  // On the phone, to the screen's edges: the page's inset taken back (see `Page`).
  bleed: { marginInline: "var(--page-bleed)" },
});

/** The muted band between parts; on the phone, to the screen's edges. */
export function Band() {
  const wide = !isNarrow(useWidthClass());
  return <div {...stylex.props(styles.band, !wide && styles.bleed)} />;
}
