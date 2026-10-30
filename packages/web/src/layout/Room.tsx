// A room that eases its height open and closed, the content under it gliding into its place, and
// out of view once closed: the column's Unfold, and Home's Setup pane. Plain elements: no Astryx
// component eases a height to none.
import { easeVars, focusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

/** How long a room takes to open or close, as the column's width eases as it folds (`Column.tsx`). */
const EASE = "200ms";

const styles = stylex.create({
  // The gap under its content, inside the room, which closes with it.
  gap1: { paddingBlockEnd: spacingVars["--spacing-1"] },
  gap4: { paddingBlockEnd: spacingVars["--spacing-4"] },
  inner: { minHeight: 0 },
  // Closed: no height, and out of view once closed. Clipped to the room and its focus ring, so it
  // shows nothing past them as it closes, under what rises over it.
  room: {
    clipPath: `inset(calc(-1 * (${focusVars["--focus-outline-width"]} + ${focusVars["--focus-outline-offset"]})))`,
    display: "grid",
    gridTemplateRows: "0fr",
    transitionDelay: {
      "@media (prefers-reduced-motion: reduce)": "0s, 0s",
      default: `0s, ${EASE}`,
    },
    transitionDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s, 0s",
      default: `${EASE}, 0s`,
    },
    transitionProperty: "grid-template-rows, visibility",
    transitionTimingFunction: easeVars["--ease-standard"],
    visibility: "hidden",
  },
  // Open: shown at once.
  open: { gridTemplateRows: "1fr", transitionDelay: "0s, 0s", visibility: "visible" },
  // The gap after the room in its stack, taken back, so what follows keeps its place.
  takesGapBack: { marginBlockEnd: `calc(-1 * ${spacingVars["--spacing-1"]})` },
});

/**
 * A room for `children`, open while `isOpen`, with a gap of `gap` under them that closes with it.
 * `takesGapBack` takes back its stack's gap of 1 after it. `onClosed` runs once it has closed.
 */
export function Room({
  children,
  gap,
  isOpen,
  onClosed,
  takesGapBack = false,
}: {
  children: ReactNode;
  gap: 1 | 4;
  isOpen: boolean;
  onClosed?: () => void;
  takesGapBack?: boolean;
}) {
  return (
    <div
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && !isOpen) {
          onClosed?.();
        }
      }}
      {...stylex.props(styles.room, takesGapBack && styles.takesGapBack, isOpen && styles.open)}
    >
      <div {...stylex.props(styles.inner)}>
        <div {...stylex.props(gap === 1 ? styles.gap1 : styles.gap4)}>{children}</div>
      </div>
    </div>
  );
}
