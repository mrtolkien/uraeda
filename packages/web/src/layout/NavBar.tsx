// The phone's bottom bar as a page's navigation, in the status line's row: a tile for each of the
// page's parts, its icon alone, as the column's tabs on a wide screen, the open one in the accent;
// and the step that moves the human forward last, its icon in the accent, as Next, Verdict, or Submit:
// no filled block on the glass.
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";

const styles = stylex.create({
  // The open part's tile: its icon in the accent.
  open: { color: colorVars["--color-text-accent"] },
  // A tile: its icon alone, centred, flat on the bar.
  tile: {
    alignItems: "center",
    background: "none",
    borderRadius: 0,
    borderStyle: "none",
    borderWidth: 0,
    color: colorVars["--color-text-primary"],
    cursor: "pointer",
    display: "flex",
    flexBasis: 0,
    flexGrow: 1,
    font: "inherit",
    justifyContent: "center",
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-1"],
  },
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
 * A tile of the bar: `icon` alone, named by `label`; `isOpen` while its part shows, or `isTinted`
 * for the step forward, its icon in the accent.
 */
export function NavTile({
  icon,
  isOpen,
  isTinted = false,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Icon>["icon"];
  isOpen?: boolean;
  isTinted?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- a tile of the phone's bottom bar, its icon alone, flat and stretched to share the bar's width, which Astryx's Button, with its own height, padding, and surface, does not draw (an Astryx gap)
    <button
      aria-label={label}
      aria-pressed={isOpen}
      onClick={onPress}
      type="button"
      {...stylex.props(
        focusOutlineStyles.focusVisible,
        styles.tile,
        isOpen && styles.open,
        isTinted && styles.tinted,
      )}
    >
      <Icon icon={icon} size="lg" />
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
