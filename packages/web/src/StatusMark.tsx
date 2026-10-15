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
  dot: {
    // Large enough for its mark to read, as the sidebar's rows draw it.
    height: spacingVars["--spacing-4"],
    width: spacingVars["--spacing-4"],
  },
  idle: {
    // A ring when idle: apart from working by its shape, also when the pulse is off.
    backgroundColor: "transparent",
    borderColor: colorVars["--color-icon-secondary"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxSizing: "border-box",
  },
  mark: {
    fontSize: typeScaleVars["--text-heading-6-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    lineHeight: "100%",
  },
  small: {
    // A sub-agent's row, and a line of text.
    height: spacingVars["--spacing-3"],
    width: spacingVars["--spacing-3"],
  },
  working: {
    // Blue while working, as the mockup draws it: the theme's accent is its ink, near the idle grey.
    backgroundColor: colorVars["--color-icon-blue"],
  },
});

/** Each status's colour, and its mark beside the colour, so it never reads by colour alone. */
const DOTS = {
  attention: { mark: "!", variant: "error" },
  idle: { mark: undefined, variant: "neutral" },
  "needs-you": { mark: "!", variant: "warning" },
  unread: { mark: "✓", variant: "success" },
  working: { mark: undefined, variant: "accent" },
} as const;

/**
 * A session's status as a dot, named by its label for screen readers: a pulsing blue dot while it
 * works, a warning "!" when it needs the human, an error "!" when it needs their attention, a
 * success "✓" for a reply not seen yet, and a grey ring when idle.
 */
export function StatusMark({
  label,
  small = false,
  status,
}: {
  label: string;
  small?: boolean;
  status: SessionStatus;
}) {
  const { mark, variant } = DOTS[status];
  return (
    <StatusDot
      icon={mark ? <span {...stylex.props(styles.mark)}>{mark}</span> : undefined}
      isPulsing={status === "working"}
      label={label}
      variant={variant}
      xstyle={[
        small ? styles.small : styles.dot,
        status === "working" && styles.working,
        status === "idle" && styles.idle,
      ]}
    />
  );
}
