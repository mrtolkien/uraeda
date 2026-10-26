// What a list, a pane, or a page shows while it holds nothing: one line in secondary text, the same
// on every page (UI coherence), such as "No call yet." or "The inbox is empty.".
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  // In a pane of rows, the line sits where a row's text would.
  inset: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/** The line that says there is nothing, `isInset` as a row of the pane's rows would be. */
export function Empty({ children, isInset = false }: { children: ReactNode; isInset?: boolean }) {
  return (
    <Text color="secondary" display="block" xstyle={isInset && styles.inset}>
      {children}
    </Text>
  );
}
