import { Badge } from "@astryxdesign/core/Badge";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

/** The outline of the field a file dragged over the page would go to. */
export const dropStyles = stylex.create({
  target: {
    outlineColor: colorVars["--color-accent"],
    outlineStyle: "solid",
    outlineWidth: spacingVars["--spacing-0-5"],
    outlineOffset: spacingVars["--spacing-0-5"],
    backgroundColor: colorVars["--color-accent-muted"],
  },
});

const styles = stylex.create({
  field: { position: "relative" },
  hint: {
    position: "absolute",
    insetBlockStart: spacingVars["--spacing-2"],
    insetInlineEnd: spacingVars["--spacing-2"],
    zIndex: 1,
    pointerEvents: "none",
  },
  // On the line of a field's label, at its end, clear of the field's border.
  labelled: { insetBlockStart: 0, insetInlineEnd: 0 },
});

/**
 * A field, with the hint "Drop to add to <label>" over its corner while it is the drop's target:
 * inside the field, or, for a field whose label shows, at the end of the label's line.
 */
export function DropHint({
  hint,
  isLabelled = false,
  children,
}: {
  hint?: string;
  isLabelled?: boolean;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.field)}>
      {children}
      {hint && (
        <Badge variant="info" label={hint} xstyle={[styles.hint, isLabelled && styles.labelled]} />
      )}
    </div>
  );
}
