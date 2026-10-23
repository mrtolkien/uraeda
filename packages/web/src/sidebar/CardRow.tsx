// A card's row in the shell's panes, our own (an Astryx gap, plan's Complexity tracking):
// `SideNavItem` takes its label as a string on one line, cut by an ellipsis, where the card's name
// must read whole. Its link holds the kind's icon, the name, wrapping onto a second line when it
// must, the step under it, and the status at its end; its "…" sits beside the link, as
// `SideNavItem`'s actions do. It is drawn from the styles Astryx shares for nav rows.
import { navItemStyles } from "@astryxdesign/core/NavItem/navItemStyles.stylex";
import { Text } from "@astryxdesign/core/Text";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import { interactionOverlayStyles } from "@astryxdesign/core/utils/interactionOverlay.stylex";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";
import { RouterAnchor } from "../links.tsx";

const styles = stylex.create({
  actions: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
  },
  end: {
    // On the name's first line.
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-label-line)",
  },
  icon: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-label-line)",
  },
  link: {
    alignItems: "flex-start",
    color: "inherit",
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-2"],
    minWidth: 0,
    textDecoration: "none",
  },
  name: {
    // Whole, on as many lines as it takes: a slug breaks at its hyphens, or anywhere when it has
    // none. The panes' titles set `nowrap`, which this row never inherits.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  row: {
    // As tall as its lines, from Astryx's compact row up.
    alignItems: "flex-start",
    height: "auto",
    minHeight: sizeVars["--size-element-sm"],
    paddingBlock: spacingVars["--spacing-1"],
  },
  text: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
});

export function CardRow({
  actions,
  endContent,
  href,
  icon,
  isSelected,
  label,
  name,
  onClick,
  sub,
}: {
  /** Its controls beside the link, like its "…": none on home's rows. */
  actions?: ReactNode;
  /** Passive content at the link's end, like its status. */
  endContent: ReactNode;
  href: string;
  icon: ReactNode;
  isSelected: boolean;
  /** Its name, shown whole. */
  label: string;
  /** What screen readers read, in full words. */
  name: string;
  onClick?: (event: MouseEvent) => void;
  /** Its second line, like a feature's step, which `name` reads after the name. */
  sub?: string | undefined;
}) {
  return (
    <div
      {...stylex.props(
        navItemStyles.item,
        interactionOverlayStyles.backgroundColor,
        navItemStyles.sm,
        isSelected && navItemStyles.selected,
        styles.row,
        focusOutlineStyles.focusWithinFirstChild,
      )}
    >
      {/* A page of the UI opens without reloading, as every Astryx link's does. */}
      <RouterAnchor
        aria-current={isSelected ? "page" : undefined}
        aria-label={name}
        href={href}
        {...(onClick ? { onClick } : {})}
        {...stylex.props(focusOutlineStyles.suppressed, styles.link)}
      >
        <span {...stylex.props(styles.icon)}>{icon}</span>
        <span {...stylex.props(styles.text)}>
          <span {...stylex.props(styles.name)}>{label}</span>
          {sub !== undefined && (
            <>
              {/* A space between the two lines' words, for what reads the link's text. */}{" "}
              <Text color="secondary" type="supporting">
                {sub}
              </Text>
            </>
          )}
        </span>
        <span {...stylex.props(styles.end)}>{endContent}</span>
      </RouterAnchor>
      {actions && <span {...stylex.props(styles.actions)}>{actions}</span>}
    </div>
  );
}
