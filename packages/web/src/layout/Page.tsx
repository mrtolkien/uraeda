import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import type { ReactNode } from "react";
import { useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  page: {
    // One inset on the phone, from the screen's edges; the reading column in the middle of a wide
    // screen. Text wraps anywhere rather than scroll the page sideways.
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
    width: "100%",
  },
  wide: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
});

/** A page's content: its inset, and its column on wide screens. */
export function Page({ children }: { children: ReactNode }) {
  const wide = useWidthClass() === "wide";
  return <div {...stylex.props(styles.page, wide && styles.wide)}>{children}</div>;
}
