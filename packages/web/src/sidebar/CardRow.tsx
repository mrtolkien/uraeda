// A card's row in the shell's panes, our own (an Astryx gap, plan's Complexity tracking):
// `SideNavItem` takes its label as a string on one line, cut by an ellipsis, where the card's name
// must read whole. Its link holds the kind's icon, the name, wrapping onto a second line when it
// must, the step under it, and the status at its end. It is drawn from the styles Astryx shares
// for nav rows.
import { navItemStyles } from "@astryxdesign/core/NavItem/navItemStyles.stylex";
import { Text } from "@astryxdesign/core/Text";
import { sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import { interactionOverlayStyles } from "@astryxdesign/core/utils/interactionOverlay.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, type PointerEvent, type ReactNode, useState } from "react";
import { pickedStyles } from "../layout/picked.ts";
import { RouterAnchor } from "../links.tsx";
import { brighten } from "./brighten.ts";

const styles = stylex.create({
  end: {
    // On the name's first line.
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-label-line)",
  },
  endTall: {
    // Two lines high, for an end that is a button of its own: it takes the room of both lines. A
    // custom property, as the token lint takes a `var()` only whole, not in a calc.
    "--card-end-tall": "calc(2 * var(--size-label-line))",
    height: "var(--card-end-tall)",
  },
  icon: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-label-line)",
  },
  // The row's link: the icon, the name and its step, beside each other.
  link: {
    alignItems: "flex-start",
    color: "inherit",
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-2"],
    minWidth: 0,
    textDecoration: "none",
  },
  // Under the pointer, the card's own parts brighten, where its end is a button of its own.
  lit: { filter: "brightness(1.25)" },
  name: {
    // Whole, on as many lines as it takes: a slug breaks at its hyphens, or anywhere when it has
    // none. The panes' titles set `nowrap`, which this row never inherits.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  // A row whose end is a button: the pointer over all of it, its parts lit on their own (`lit`).
  pointer: { cursor: "pointer" },
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
  endContent,
  hasRing = true,
  href,
  icon,
  isEndTall = false,
  isPicked = false,
  isSelected,
  label,
  name,
  onClick,
  sub,
}: {
  /** Passive content at the link's end, like its status. */
  endContent: ReactNode;
  /** Its own focus ring, which a card picked whole drops for its own (`ItemCard`). */
  hasRing?: boolean;
  href: string;
  icon: ReactNode;
  /** Whether its end is two lines high, the name's and the second's. */
  isEndTall?: boolean;
  /** Its link tinted as a list's selected row, as the keys or the pointer picked it. */
  isPicked?: boolean;
  isSelected: boolean;
  /** Its name, shown whole. */
  label: string;
  /** What screen readers read, in full words. */
  name: string;
  onClick?: (event: MouseEvent) => void;
  /** Its second line, like a feature's step, which `name` reads after the name. */
  sub?: ReactNode;
}) {
  // Where the pointer is over a row whose end is a button: the card and the button are two
  // surfaces, and only the one under it brightens.
  const [over, setOver] = useState<"button" | "card" | "none">("none");
  const isCardLit = isEndTall && over === "card";
  return (
    <div
      {...(isEndTall
        ? {
            onPointerLeave: () => setOver("none"),
            onPointerMove: (event: PointerEvent) =>
              setOver((event.target as Element).closest("[data-card-status]") ? "button" : "card"),
          }
        : {})}
      {...stylex.props(
        navItemStyles.item,
        interactionOverlayStyles.backgroundColor,
        navItemStyles.sm,
        isSelected && navItemStyles.selected,
        styles.row,
        isEndTall ? styles.pointer : brighten,
        hasRing && focusOutlineStyles.focusWithinFirstChild,
      )}
    >
      {/* A page of the UI opens without reloading, as every Astryx link's does. */}
      <RouterAnchor
        aria-current={isSelected ? "page" : undefined}
        aria-label={name}
        href={href}
        {...(onClick ? { onClick } : {})}
        {...stylex.props(
          focusOutlineStyles.suppressed,
          styles.link,
          isPicked && pickedStyles.picked,
        )}
      >
        <span {...stylex.props(styles.icon, isCardLit && styles.lit)}>{icon}</span>
        <span {...stylex.props(styles.text, isCardLit && styles.lit)}>
          <span {...stylex.props(styles.name)}>{label}</span>
          {sub !== undefined && (
            <>
              {/* A space between the two lines' words, for what reads the link's text. */}{" "}
              {typeof sub === "string" ? (
                <Text color="secondary" type="supporting">
                  {sub}
                </Text>
              ) : (
                sub
              )}
            </>
          )}
        </span>
        {/* A space before its end too: its visible text, as the name reads it, never runs together. */}{" "}
        <span {...stylex.props(styles.end, isEndTall && styles.endTall)}>{endContent}</span>
      </RouterAnchor>
    </div>
  );
}
