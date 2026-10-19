import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { createContext, type ReactNode, type RefObject, useRef } from "react";
import { useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  page: {
    // One inset on the phone, from the screen's edges; the reading column in the middle of a wide
    // screen. Text wraps anywhere rather than scroll the page sideways. `--page-inset` is the inset
    // at the sides, and `--page-bleed` takes it back, for what reaches the screen's edges.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-4"]})`,
    "--page-inset": spacingVars["--spacing-4"],
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: "var(--page-inset)",
    width: "100%",
  },
  snug: {
    // On the phone, an 8 px inset, for a page that is read as text from edge to edge: a session.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-2"]})`,
    "--page-inset": spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-3"],
  },
  tight: {
    // On the phone, the smallest inset, for a page whose parts take the screen's width.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-3"]})`,
    "--page-inset": spacingVars["--spacing-3"],
    paddingBlock: spacingVars["--spacing-3"],
  },
  wide: {
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-8"]})`,
    "--page-inset": spacingVars["--spacing-8"],
    paddingBlock: spacingVars["--spacing-6"],
  },
});

/**
 * The page's column, for what may grow past it into the space beside it, as a story's embed does:
 * null outside a page.
 */
export const PageColumn = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * A page's content: its inset, and its column on wide screens. `isTight` gives it the smallest inset
 * on the phone, 12 px, and `isSnug` 8 px.
 */
export function Page({
  children,
  isSnug = false,
  isTight = false,
}: {
  children: ReactNode;
  isSnug?: boolean;
  isTight?: boolean;
}) {
  const wide = useWidthClass() === "wide";
  const column = useRef<HTMLDivElement>(null);
  return (
    <PageColumn value={column}>
      <div
        ref={column}
        {...stylex.props(
          styles.page,
          isTight && styles.tight,
          isSnug && styles.snug,
          wide && styles.wide,
        )}
      >
        {children}
      </div>
    </PageColumn>
  );
}
