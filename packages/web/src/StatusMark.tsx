import { Icon } from "@astryxdesign/core/Icon";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { fontWeightVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { SessionStatus } from "uraeda-server/fate";

const styles = stylex.create({
  dot: {
    borderRadius: 0,
    // Large enough for its mark to read, as the sidebar's rows draw it.
    height: spacingVars["--spacing-4"],
    width: spacingVars["--spacing-4"],
  },
  mark: {
    fontSize: typeScaleVars["--text-heading-6-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    lineHeight: "100%",
  },
  small: {
    borderRadius: 0,
    // A sub-agent's row, and a line of text.
    height: spacingVars["--spacing-3"],
    width: spacingVars["--spacing-3"],
  },
  working: {
    // The `working` role while working, as the mockup draws it: the accent is its ink, near the
    // idle grey.
    backgroundColor: "var(--role-working)",
  },
  // A sub-agent at work: the `sub-agent` role, set apart from the session's `working` and the
  // buttons' accent.
  subagent: {
    backgroundColor: "var(--role-sub-agent)",
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
 * A session's status as a square, named by its label for screen readers: the activity icon on the
 * `working` role while it works (the small one, a plain square of it), a warning "!" when it needs
 * the human, an error "!" when it needs their attention, a success "✓" for a reply not seen yet,
 * and nothing when idle.
 */
export function StatusMark({
  isSubagent = false,
  label,
  small = false,
  status,
}: {
  /** A sub-agent's mark, in its own role where a session's own is `working`. */
  isSubagent?: boolean;
  label: string;
  small?: boolean;
  status: SessionStatus;
}) {
  if (status === "idle") {
    return null;
  }
  const { mark, variant } = DOTS[status];
  // A working session shows the activity icon, where the square is big enough to hold it.
  const icon =
    mark !== undefined ? (
      <span {...stylex.props(styles.mark)}>{mark}</span>
    ) : status === "working" && !small ? (
      <Icon color="inherit" icon="uraeda:activity" size="xsm" />
    ) : undefined;
  return (
    <StatusDot
      icon={icon}
      label={label}
      variant={variant}
      xstyle={[
        small ? styles.small : styles.dot,
        status === "working" && (isSubagent ? styles.subagent : styles.working),
      ]}
    />
  );
}
