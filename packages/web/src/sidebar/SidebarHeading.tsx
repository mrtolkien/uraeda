// The sidebar's heading. On wide screens, one button folds the sidebar to its rail and unfolds it,
// at the heading's start in both states, so it never moves under the pointer (C3): shown under the
// pointer while unfolded, and always to the keyboard and on touch; `[` does the same. Then the
// repository menu, left out of the folded rail, and the page's own controls. On the phone, where Astryx draws the heading as the
// top bar: the way home first, then the repository menu.
import { HStack } from "@astryxdesign/core/HStack";
import { useHotkeys } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
  at: {
    // The same spot in both states, from the navigation's sticky top, whose padding differs folded
    // (C3): the row keeps a gap of the button's size for it.
    insetBlockStart: spacingVars["--spacing-2"],
    insetInlineStart: spacingVars["--spacing-1"],
    position: "absolute",
  },
  controls: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
  },
  folded: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
  heading: {
    flexGrow: 1,
    minWidth: 0,
    paddingInline: spacingVars["--spacing-2"],
  },
  hidden: {
    // Still focusable, and shown once focused: only its look waits for the pointer.
    opacity: { ":focus-visible": 1, "@media (hover: none)": 1, default: 0 },
  },
  menu: {
    flexGrow: 1,
    minWidth: 0,
  },
  room: {
    // The fold button's room, in the flow, under its absolute spot.
    flexShrink: 0,
    height: sizeVars["--size-element-md"],
    width: sizeVars["--size-element-md"],
  },
});

/** The button that folds and unfolds the sidebar, and its `[` shortcut, outside text fields. */
function FoldButton({ isRevealed, onFold }: { isRevealed: boolean; onFold: () => void }) {
  const { isCollapsed, toggle } = useSideNavCollapse();
  const fold = () => {
    onFold();
    toggle();
  };
  useHotkeys([{ keys: "[", onPress: fold }]);
  return (
    <>
      <span {...stylex.props(styles.room)} />
      <span {...stylex.props(styles.at)}>
        <IconButton
          icon={<Icon icon="uraeda:panel-left" />}
          label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={fold}
          variant="ghost"
          xstyle={isCollapsed || isRevealed ? undefined : styles.hidden}
        />
      </span>
    </>
  );
}

export function SidebarHeading({
  homeHref,
  isHome,
  isRevealed,
  menu,
  onFold = () => {},
  slot,
}: {
  homeHref: string;
  /** Whether home is the page shown: its button is then the current page. */
  isHome: boolean;
  /** Whether the pointer is over the sidebar, which shows the fold button. */
  isRevealed: boolean;
  /** The repository menu's trigger. */
  menu: ReactNode;
  /** Told as the sidebar folds or unfolds, so its width eases then only. */
  onFold?: () => void;
  /** The page's own controls. */
  slot?: ReactNode;
}) {
  const wide = useWidthClass() === "wide";
  const { isCollapsed } = useSideNavCollapse();
  if (!wide) {
    return (
      <HStack align="center" gap={1} xstyle={styles.heading}>
        <IconButton
          aria-current={isHome ? "page" : undefined}
          href={homeHref}
          icon={<Icon icon="uraeda:home" />}
          label="Home"
          variant="ghost"
        />
        <div {...stylex.props(styles.menu)}>{menu}</div>
        {slot && <div {...stylex.props(styles.controls)}>{slot}</div>}
      </HStack>
    );
  }
  if (isCollapsed) {
    return (
      <VStack align="center" gap={1} xstyle={styles.folded}>
        <FoldButton isRevealed onFold={onFold} />
        {slot}
      </VStack>
    );
  }
  return (
    <HStack align="center" gap={1} xstyle={styles.heading}>
      <FoldButton isRevealed={isRevealed} onFold={onFold} />
      <div {...stylex.props(styles.menu)}>{menu}</div>
      {slot && <div {...stylex.props(styles.controls)}>{slot}</div>}
    </HStack>
  );
}
