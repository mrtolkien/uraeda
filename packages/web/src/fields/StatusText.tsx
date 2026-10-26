// What an action did, next to what it concerns (UI behaviour): an error in the theme's error colour,
// kept until it is dealt with, or a save done in its success colour. Every status of the UI is
// drawn here, so an error reads the same on every page (UI coherence).
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  error: { color: colorVars["--color-error"] },
  saved: { color: colorVars["--color-success"] },
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
  tone: "error" | "saved";
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
