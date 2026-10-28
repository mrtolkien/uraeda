// The phone's bottom bar as a page's navigation, in the status line's row: a tile for each of the
// page's parts, its icon alone, as the column's tabs on a wide screen, the open one in the accent;
// and the step that moves the human forward last, its icon in the accent, as Next, Verdict, or Submit:
// no filled block on the glass. The same tile, its word under its icon, is an action of the phone's
// floating row bar (see `RowBar`).
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import { barVars } from "./bar.stylex.ts";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { bareButtonStyles } from "./bareButton.ts";

const styles = stylex.create({
  // The open part's tile: its icon in the accent.
  open: { color: colorVars["--color-text-accent"] },
  // A tile: flat on the glass, in the theme's text colour, which reads over the clear glass.
  tile: {
    alignItems: "center",
    borderRadius: 0,
    color: colorVars["--color-text-primary"],
    display: "flex",
  },
  // The bottom bar's tile: its icon alone, centred, sharing the bar's width.
  shared: {
    flexBasis: 0,
    flexGrow: 1,
    justifyContent: "center",
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-1"],
  },
  // The row bar's tile: its icon over its word, as wide as a finger at least.
  worded: {
    flexDirection: "column",
    gap: barVars["--bar-tile-gap"],
    minWidth: barVars["--bar-tile-least"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // A tile's word, small under its icon.
  word: { fontSize: barVars["--bar-word"] },
  // The tiles share the bar's width, each as tall as the bar.
  tiles: {
    alignSelf: "stretch",
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-1"],
  },
  // The step forward, as Next, Verdict, or Submit: its icon in the accent, on the glass as the
  // others.
  tinted: { color: colorVars["--color-text-accent"] },
});

/**
 * A tile of the glass: `icon` alone, named by `label`, sharing the bar's width; or, `hasWord`, its
 * icon over `label`, as wide as its word. `isOpen` while its part shows, or `isTinted` for the step
 * forward, its icon in the accent.
 */
export function NavTile({
  hasWord = false,
  icon,
  isOpen,
  isTinted = false,
  label,
  onPress,
}: {
  hasWord?: boolean;
  icon: ComponentProps<typeof Icon>["icon"];
  isOpen?: boolean;
  isTinted?: boolean;
  label: string;
  onPress: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a tile of the phone's glass, its icon alone and stretched to share the bottom bar's width, or its big icon over its word on the floating row bar, flat, which Astryx's Button, with its own height, padding, and surface, does not draw (an Astryx gap)
    <button
      aria-label={hasWord ? undefined : label}
      aria-pressed={isOpen}
      onClick={onPress}
      type="button"
      {...stylex.props(
        focusOutlineStyles.focusVisible,
        bareButtonStyles.bare,
        styles.tile,
        hasWord ? styles.worded : styles.shared,
        isOpen && styles.open,
        isTinted && styles.tinted,
      )}
    >
      <Icon icon={icon} size="lg" />
      {hasWord && <span {...stylex.props(styles.word)}>{label}</span>}
    </button>
  );
}

/** The bar's tiles, sharing its width, named `label`. */
export function NavTiles({ children, label }: { children: ReactNode; label: string }) {
  return (
    <nav aria-label={label} {...stylex.props(styles.tiles)}>
      {children}
    </nav>
  );
}
