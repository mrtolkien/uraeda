// What an action did, next to what it concerns (UI behaviour): an error in red, kept until it is
// dealt with, a warning in yellow, or a save done in green, each the theme's text colour of its hue,
// which reads at 4.5:1 (UI look). Every status of the UI is drawn here, so an error reads the same
// on every page (UI coherence). Astryx's `Text` has no error colour: `color="error"` draws primary.
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  error: { color: colorVars["--color-text-red"] },
  saved: { color: colorVars["--color-text-green"] },
  warning: { color: colorVars["--color-text-yellow"] },
});

/**
 * A status in its tone's colour: in the text around it, or, with `type`, as a supporting line of its
 * own, as under a field. `role` makes a screen reader announce it, as an `alert` for a refusal.
 */
export function StatusText({
  children,
  role,
  tone,
  type,
}: {
  children: ReactNode;
  role?: "alert" | "status";
  tone: "error" | "saved" | "warning";
  type?: "supporting";
}) {
  return type ? (
    <Text role={role} type={type} xstyle={styles[tone]}>
      {children}
    </Text>
  ) : (
    <span role={role} {...stylex.props(styles[tone])}>
      {children}
    </span>
  );
}
