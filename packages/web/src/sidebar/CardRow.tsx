// A card's row in the shell's panes, our own (an Astryx gap, plan's Complexity tracking):
// `SideNavItem` takes its label as a string on one line, cut by an ellipsis, where the card's name
// must read whole. Its link holds the kind's icon, the name, wrapping onto a second line when it
// must, the step under it, and the status at its end; after the link, a button of its own at the
// first line's end, such as Dismiss. It is drawn from the styles Astryx shares for nav rows.
import { navItemStyles } from "@astryxdesign/core/NavItem/navItemStyles.stylex";
import { Text } from "@astryxdesign/core/Text";
import { fontWeightVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
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

/** The closed rail's look of a row: what of it shows (`rail`). */
const railStyles = stylex.create({
  // Gone, as a done row's text: the row is its icon alone.
  gone: { display: "none" },
  // Hidden, as a card's text: it keeps its room, so the card keeps its height.
  hidden: { visibility: "hidden" },
  // Selected, as its card's frame shows it: in the selection's weight, with no fill of its own,
  // under the pointer or a press either.
  selected: {
    backgroundColor: "transparent",
    backgroundImage: "none",
    fontWeight: fontWeightVars["--font-weight-medium"],
  },
});

/**
 * How the closed rail draws a row: a card's keeps its lines' room, hidden, by its icon, `card`, or
 * with its icon hidden too, under the card's mark, `mark`; a done row is its icon alone, `row`.
 */
export type RailLook = "card" | "mark" | "row";

/** The row's second line, like a feature's step, after a space for what reads the link's text. */
function Sub({ sub }: { sub: ReactNode }) {
  return (
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
  );
}

/**
 * Where the pointer is over a row whose end, or what follows its link, is a button, when
 * `isSplit`: the card and the button are two surfaces, and only the one under it brightens.
 * `isCardLit` while it is over the card; `pointer`, the row's handlers.
 */
function useSplitHover(isSplit: boolean) {
  const [over, setOver] = useState<"button" | "card" | "none">("none");
  const pointer = isSplit
    ? {
        onPointerLeave: () => setOver("none"),
        onPointerMove: (event: PointerEvent) =>
          setOver(
            (event.target as Element).closest("[data-card-status], [data-card-after]")
              ? "button"
              : "card",
          ),
      }
    : {};
  return { isCardLit: isSplit && over === "card", pointer };
}

export function CardRow({
  after,
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
  rail,
  sub,
}: {
  /** A button after the link, at the first line's end, like a run's Dismiss: no link holds one. */
  after?: ReactNode;
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
  /** How the closed rail draws it, while it does. */
  rail?: RailLook;
  /** Its second line, like a feature's step, which `name` reads after the name. */
  sub?: ReactNode;
}) {
  const isSplit = isEndTall || after !== undefined;
  const { isCardLit, pointer } = useSplitHover(isSplit);
  // What the closed rail hides after the icon, and the icon itself under a card's mark alone.
  const railRest = rail === "row" ? railStyles.gone : rail && railStyles.hidden;
  const railIcon = rail === "mark" && railStyles.hidden;
  // A card's frame shows its selection, in the closed rail.
  const isFramed = rail === "card" || rail === "mark";
  return (
    <div
      {...pointer}
      {...stylex.props(
        navItemStyles.item,
        interactionOverlayStyles.backgroundColor,
        navItemStyles.sm,
        isSelected && (isFramed ? railStyles.selected : navItemStyles.selected),
        styles.row,
        isSplit ? styles.pointer : brighten,
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
        <span {...stylex.props(styles.icon, isCardLit && styles.lit, railIcon)}>{icon}</span>
        <span {...stylex.props(styles.text, isCardLit && styles.lit, railRest)}>
          <span {...stylex.props(styles.name)}>{label}</span>
          {sub !== undefined && <Sub sub={sub} />}
        </span>
        {/* A space before its end too: its visible text, as the name reads it, never runs together. */}{" "}
        <span
          {...stylex.props(
            styles.end,
            isEndTall && styles.endTall,
            // Passive, it is the card's: lit with it.
            isCardLit && !isEndTall && styles.lit,
            railRest,
          )}
        >
          {endContent}
        </span>
      </RouterAnchor>
      {after !== undefined && (
        <span data-card-after {...stylex.props(styles.end, railRest)}>
          {after}
        </span>
      )}
    </div>
  );
}
