// The phone's bottom bar as a page's navigation, in the status line's row: a tile for each of the
// page's parts, its icon over a small word, as the column's tabs on a wide screen, the open one in
// the accent; and the step that moves the human forward last, in the accent, as Next, Verdict, or
// Submit: no filled block on the glass. One tile is a single glass button at the bottom right, two
// are a button in each corner, and three or more the bar of glass across the screen. The same
// tile, its word a step bigger, is an action of the phone's floating row bar (see `RowBar`).
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import { safeAreaVars } from "./safeArea.stylex.ts";
import { barVars } from "./bar.stylex.ts";
import {
  Children,
  type ComponentProps,
  createContext,
  type MouseEvent,
  type ReactNode,
  use,
} from "react";
import { bareButtonStyles } from "./bareButton.ts";
import { glassStyles } from "./glass.ts";

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
  // The bottom bar's tile: its icon over its word, centred, sharing the bar's width.
  shared: {
    flexBasis: 0,
    flexDirection: "column",
    flexGrow: 1,
    gap: barVars["--bar-word-gap"],
    justifyContent: "center",
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-1"],
  },
  // A tile alone or one of two: a glass button of its own, a finger wide at least, and wider when
  // its word asks, at the bottom of the bar's row and inside it, so the page's end shows above it.
  floating: {
    flexBasis: "auto",
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: barVars["--bar-button"],
    minWidth: barVars["--bar-button"],
    pointerEvents: "auto",
  },
  // The row bar's tile: its icon over its word, as wide as a finger at least. A step of room on
  // each side of its word, no more: five tiles fit a 360 px phone's bar.
  worded: {
    flexDirection: "column",
    gap: barVars["--bar-tile-gap"],
    minWidth: barVars["--bar-tile-least"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-1"],
  },
  // A tile's word, small under its icon, on one line: where a wide font leaves the tiles too little
  // room, it ends in an ellipsis inside its tile, never over its neighbour's.
  word: {
    fontSize: barVars["--bar-word"],
    lineHeight: barVars["--bar-word-line"],
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  // The bottom bar's word, a step smaller than the row bar's, so the icon keeps its size in a tile
  // as tall as the top tabs.
  smallWord: { fontSize: barVars["--bar-word-small"] },
  // The tiles share the bar's width, each as tall as the bar.
  tiles: {
    alignSelf: "stretch",
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-1"],
  },
  // Three tiles or more: the glass across the screen, which takes the taps under it, and goes on
  // down to the screen's edge under the home indicator, as an iPhone's tab bar does, its tiles
  // above it.
  bar: {
    marginBlockEnd: `calc(-1 * ${safeAreaVars["--safe-area-bottom"]})`,
    paddingBlockEnd: safeAreaVars["--safe-area-bottom"],
    pointerEvents: "auto",
  },
  // One or two tiles: no glass between them, and the page under it takes the taps.
  buttons: {
    alignItems: "flex-end",
    // Above the home indicator by its safe area alone, which the status line pads by: the small
    // room under them only where the screen has none.
    paddingBlockEnd: `max(0px, calc(${spacingVars["--spacing-1"]} - ${safeAreaVars["--safe-area-bottom"]}))`,
    pointerEvents: "none",
  },
  // One tile: at the bottom right.
  one: { justifyContent: "flex-end" },
  // Two tiles: one in each corner.
  two: { justifyContent: "space-between" },
  // The step forward, as Next, Verdict, or Submit: its icon in the accent, on the glass as the
  // others.
  tinted: { color: colorVars["--color-text-accent"] },
  // A tile with nothing to do now, as the jump to the latest at the end: dimmed.
  disabled: { color: colorVars["--color-text-disabled"] },
});

/**
 * A tile of the glass: `icon` over a small `word`, named by `label`, sharing the bar's width; or,
 * `hasWord`, its icon over `label`, the row bar's action, as wide as its word. `word` is short, one
 * word the name holds, so a spoken command finds the tile by what it shows, and eight letters at
 * most, so five tiles keep their words whole on a 360 px phone; it is `label` itself when that is
 * short already. `isOpen` while its part shows, or `isTinted` for the step forward, in
 * the accent.
 */
export function NavTile({
  hasWord = false,
  icon,
  isDisabled = false,
  isOpen,
  isTinted = false,
  label,
  onPress,
  word = label,
}: {
  hasWord?: boolean;
  icon: ComponentProps<typeof Icon>["icon"];
  isDisabled?: boolean;
  isOpen?: boolean;
  isTinted?: boolean;
  label: string;
  onPress: (event: MouseEvent<HTMLButtonElement>) => void;
  word?: string;
}) {
  const isFloating = use(Floating) && !hasWord;
  return (
    // oxlint-disable-next-line react/forbid-elements -- a tile of the phone's glass, its icon over a small word and stretched to share the bottom bar's width, or its big icon over its word on the floating row bar, flat, which Astryx's Button, with its own height, padding, and surface, does not draw (an Astryx gap)
    <button
      aria-label={hasWord ? undefined : label}
      aria-pressed={isOpen}
      disabled={isDisabled}
      onClick={onPress}
      type="button"
      {...stylex.props(
        focusOutlineStyles.focusVisible,
        bareButtonStyles.bare,
        styles.tile,
        hasWord ? styles.worded : styles.shared,
        isFloating && [styles.floating, glassStyles.surface, glassStyles.floating],
        isOpen && styles.open,
        isTinted && styles.tinted,
        isDisabled && styles.disabled,
      )}
    >
      <Icon icon={icon} size="lg" />
      <span {...stylex.props(styles.word, !hasWord && styles.smallWord)}>
        {hasWord ? label : word}
      </span>
    </button>
  );
}

/** Whether the bar's tiles are buttons of their own, one or two of them, not a bar of glass. */
const Floating = createContext(false);

/**
 * The bar's tiles, named `label`: three or more share the glass across the screen; one is a glass
 * button at the bottom right, two a glass button in each corner. Each child is a tile: a part
 * shown or not is `{shown && <NavTile />}`, never a fragment of several.
 */
export function NavTiles({ children, label }: { children: ReactNode; label: string }) {
  const count = Children.toArray(children).length;
  const isFloating = count < 3;
  return (
    <nav
      aria-label={label}
      {...stylex.props(
        styles.tiles,
        isFloating
          ? [styles.buttons, count === 1 ? styles.one : styles.two]
          : [styles.bar, glassStyles.surface, glassStyles.docked],
      )}
    >
      <Floating value={isFloating}>{children}</Floating>
    </nav>
  );
}
