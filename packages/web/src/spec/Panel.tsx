// A part of the spec page: a card on a wide screen; on the phone, no card, the part taking the
// screen's width, its title sticking under the top bar with its breadcrumbs while it scrolls, as a
// round's question does. Every part, decision, and story of the spec page is one.
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
  belowBar: {
    // A jump puts the part below the phone's top bar, which stays in view.
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  belowNothing: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  crumbs: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
  },
  rows: {
    // The card's own inset at the end, which a list's rows would take back past their column's
    // end, where the list clips them: rows end with their text, as on the page.
    "--container-padding-inline-end": "0px",
  },
  stickyHead: {
    // On the phone, the part's title and breadcrumbs stay below the top bar, the top bar's own
    // height, over the page's background, to the screen's edges, while the part scrolls under them.
    backgroundColor: colorVars["--color-background-body"],
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: spacingVars["--spacing-0-5"],
    insetBlockStart: spacingVars["--spacing-12"],
    marginBlockEnd: spacingVars["--spacing-3"],
    marginInline: "var(--page-bleed)",
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: "var(--page-inset)",
    position: "sticky",
    zIndex: 1,
  },
  title: {
    // Focused by a jump from "Contents", without a ring: the jump shows where it went.
    outlineStyle: { ":focus:not(:focus-visible)": "none", default: null },
  },
});

/** What a panel takes: its id, its title, the badges after it, its breadcrumbs, and its content. */
export type PanelProps = {
  /** Its badges, after its title. */
  badges?: ReactNode;
  children: ReactNode;
  /**
   * The groups it sits in, shown above its title on the phone, joined by " › ": none for a part at
   * the page's top level, whose title is then a level-2 heading, a level-3 one otherwise.
   */
  crumbs: ReadonlyArray<string>;
  /** Its element's id, which "Contents" jumps to; its title's is `<id>-title`. */
  id: string;
  title: ReactNode;
  /** The card's tint on a wide screen. */
  variant?: "blue" | "default" | "purple";
};

/** A panel's head: on the phone, its breadcrumbs above it; its title, then its badges. */
function PanelHead({ badges, crumbs, id, title }: Omit<PanelProps, "children" | "variant">) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={1}>
      {!wide && crumbs.length > 0 && (
        <span {...stylex.props(styles.crumbs)}>{crumbs.join(" › ")}</span>
      )}
      <HStack align="center" gap={2} wrap="wrap">
        <Heading
          id={`${id}-title`}
          level={crumbs.length === 0 ? 2 : 3}
          tabIndex={-1}
          xstyle={styles.title}
        >
          {title}
        </Heading>
        {badges}
      </HStack>
    </VStack>
  );
}

/**
 * A part of the spec page, a region named by its title: a card on a wide screen, with `variant`'s
 * tint; on the phone, no card, its head sticking under the top bar with its breadcrumbs.
 */
export function Panel({ badges, children, crumbs, id, title, variant = "default" }: PanelProps) {
  const wide = useWidthClass() === "wide";
  const head = <PanelHead badges={badges} crumbs={crumbs} id={id} title={title} />;
  const labelled = { "aria-labelledby": `${id}-title`, id };
  if (!wide) {
    return (
      <section {...labelled} {...stylex.props(styles.belowBar)}>
        <div {...stylex.props(styles.stickyHead)}>{head}</div>
        <VStack gap={3}>{children}</VStack>
      </section>
    );
  }
  return (
    <section {...labelled} {...stylex.props(styles.belowNothing)}>
      <Card padding={6} variant={variant}>
        <VStack gap={3} xstyle={styles.rows}>
          {head}
          {children}
        </VStack>
      </Card>
    </section>
  );
}
