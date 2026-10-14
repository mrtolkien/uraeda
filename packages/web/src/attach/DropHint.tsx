import { Badge } from "@astryxdesign/core/Badge";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

/** The outline of the field a file dragged over the page would go to. */
export const dropStyles = stylex.create({
  target: {
    backgroundColor: colorVars["--color-accent-muted"],
    outlineColor: colorVars["--color-accent"],
    outlineOffset: spacingVars["--spacing-0-5"],
    outlineStyle: "solid",
    outlineWidth: spacingVars["--spacing-0-5"],
  },
});

const styles = stylex.create({
  field: { position: "relative" },
  hint: {
    insetBlockStart: spacingVars["--spacing-2"],
    insetInlineEnd: spacingVars["--spacing-2"],
    pointerEvents: "none",
    position: "absolute",
    zIndex: 1,
  },
  // On the line of a field's label, at its end, clear of the field's border.
  labelled: { insetBlockStart: 0, insetInlineEnd: 0 },
});

/**
 * A field, with the hint "Drop to add to <label>" over its corner while it is the drop's target:
 * inside the field, or, for a field whose label shows, at the end of the label's line.
 */
export function DropHint({
  children,
  hint,
  isLabelled = false,
}: {
  children: ReactNode;
  hint?: string;
  isLabelled?: boolean;
}) {
  return (
    <div {...stylex.props(styles.field)}>
      {children}
      {hint && (
        <Badge label={hint} variant="info" xstyle={[styles.hint, isLabelled && styles.labelled]} />
      )}
    </div>
  );
}
