import { StatusDot } from "@astryxdesign/core/StatusDot";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SessionStatus } from "uraeda-server/fate";

const styles = stylex.create({
  // Large enough for its mark to read, as the sidebar's rows draw it.
  dot: {
    width: spacingVars["--spacing-4"],
    height: spacingVars["--spacing-4"],
  },
  // A sub-agent's row, and a line of text.
  small: {
    width: spacingVars["--spacing-3"],
    height: spacingVars["--spacing-3"],
  },
  // Blue while working, as the mockup draws it: the theme's accent is its ink, near the idle grey.
  working: {
    backgroundColor: colorVars["--color-icon-blue"],
  },
  // A ring when idle: apart from working by its shape, also when the pulse is off.
  idle: {
    boxSizing: "border-box",
    backgroundColor: "transparent",
    borderWidth: borderVars["--border-width"],
    borderStyle: "solid",
    borderColor: colorVars["--color-icon-secondary"],
  },
  mark: {
    fontSize: typeScaleVars["--text-heading-6-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    lineHeight: "100%",
  },
});

/** Each status's colour, and its mark beside the colour, so it never reads by colour alone. */
const DOTS = {
  working: { variant: "accent", mark: undefined },
  "needs-you": { variant: "warning", mark: "!" },
  failed: { variant: "error", mark: "×" },
  unread: { variant: "success", mark: "✓" },
  idle: { variant: "neutral", mark: undefined },
} as const;

/**
 * A session's status as a dot, named by its label for screen readers: a pulsing blue dot while it
 * works, a warning "!" when it needs the human, an error "×" when it failed, a success "✓" for a
 * reply not seen yet, and a grey ring when idle.
 */
export function StatusMark({
  status,
  label,
  small = false,
}: {
  status: SessionStatus;
  label: string;
  small?: boolean;
}) {
  const { variant, mark } = DOTS[status];
  return (
    <StatusDot
      variant={variant}
      label={label}
      isPulsing={status === "working"}
      icon={mark ? <span {...stylex.props(styles.mark)}>{mark}</span> : undefined}
      xstyle={[
        small ? styles.small : styles.dot,
        status === "working" && styles.working,
        status === "idle" && styles.idle,
      ]}
    />
  );
}
