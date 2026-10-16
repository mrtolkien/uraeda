// The sidebar's heading. On wide screens: the repository menu, then the button that folds the
// sidebar to its rail, shown under the pointer and always to the keyboard and on touch; folded, the
// button that unfolds it, on top of the rail. On the phone, where Astryx draws the heading as the top
// bar: the way home first, then the repository menu.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
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
});

export function SidebarHeading({
  homeHref,
  isHome,
  isRevealed,
  menu,
}: {
  homeHref: string;
  /** Whether home is the page shown: its button is then the current page. */
  isHome: boolean;
  /** Whether the pointer is over the sidebar, which shows the fold button. */
  isRevealed: boolean;
  /** The repository menu's trigger. */
  menu: ReactNode;
}) {
  const wide = useWidthClass() === "wide";
  const { isCollapsed, toggle } = useSideNavCollapse();
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
      </HStack>
    );
  }
  if (isCollapsed) {
    return (
      <VStack align="center" gap={1}>
        <IconButton
          icon={<Icon icon="uraeda:panel-left" />}
          label="Expand sidebar"
          onClick={toggle}
          variant="ghost"
        />
        {menu}
      </VStack>
    );
  }
  return (
    <HStack align="center" gap={1} xstyle={styles.heading}>
      <div {...stylex.props(styles.menu)}>{menu}</div>
      <IconButton
        icon={<Icon icon="uraeda:panel-left" />}
        label="Collapse sidebar"
        onClick={toggle}
        variant="ghost"
        xstyle={isRevealed ? undefined : styles.hidden}
      />
    </HStack>
  );
}
