import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon, type IconColor } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Document, SettledGroup, SettledKind } from "uraeda-binding";
import { type Folds, useHashFold } from "./Folds.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { plain } from "./Spans.tsx";
import { useOpenKeys } from "./useOpenKeys.ts";

const styles = stylex.create({
  content: {
    // The points' list items keep inside the card: Astryx's items reach into its padding.
    "--container-padding-inline-end": "0px",
  },
  flat: {
    // On the phone, no card: the points are the page's, after its band.
    borderRadius: 0,
    overflow: "visible",
  },
  settled: {
    marginBlockEnd: spacingVars["--spacing-6"],
  },
});

/** Each group's icon and its colour, by the group's kind, as the core names it. */
const LOOKS: Record<SettledKind, { color: IconColor; icon: string }> = {
  behaviour: { color: "secondary", icon: "info" },
  check: { color: "warning", icon: "warning" },
  hood: { color: "secondary", icon: "wrench" },
};

/** The key "Under the hood" is open by, among the history entry's open items. */
const HOOD = "settled-hood";

/**
 * "Under the hood" as a fold, open as the history entry keeps it, for Back and reloads, opened by a
 * link to a block in it, and while `forced`, as a comment form on its point is, until it is folded.
 */
function useHoodFold(
  document: Document,
  groups: ReadonlyArray<SettledGroup>,
  forced: boolean,
): Folds {
  const keys = useOpenKeys();
  const [shut, setShut] = useState(false);
  const hood = groups.find((group) => group.kind === "hood");
  const folds: Folds = {
    list: hood ? [{ ids: [hood.heading, ...hood.blocks], key: HOOD, label: "Under the hood" }] : [],
    onOpenChange: (key, isOpen) => {
      setShut(!isOpen);
      keys.onOpenChange(key, isOpen);
    },
    open: forced && !shut ? [...keys.open, HOOD] : keys.open,
  };
  useHashFold(document, folds);
  return folds;
}

/** A group's points: the items of its lists. */
const pointCount = (document: Document, group: SettledGroup) =>
  document.blocks.filter(
    (b) => b.kind === "item" && b.parent !== undefined && group.blocks.includes(b.parent),
  ).length;

/** The label of the fold's button, "Show the point" for one point. */
const showLabel = (count: number) => (count === 1 ? "Show the point" : `Show the ${count} points`);

/** A group: its icon and heading, then its points, "Under the hood" folded until opened. */
function Group({
  children,
  document,
  folds,
  group,
}: {
  children: ReactNode;
  document: Document;
  folds: Folds;
  group: SettledGroup;
}) {
  const heading = document.blocks[group.heading];
  const look = LOOKS[group.kind];
  const folded = group.kind === "hood";
  const open = !folded || folds.open.includes(HOOD);
  return (
    <VStack gap={2}>
      <HStack align="center" gap={2} id={heading?.anchor}>
        <Icon color={look.color} icon={look.icon} size="md" />
        <Heading level={3}>{heading ? plain(heading.spans) : ""}</Heading>
        {folded && (
          <Button
            label={open ? "Fold" : showLabel(pointCount(document, group))}
            onClick={() => folds.onOpenChange(HOOD, !open)}
            size="sm"
            variant="ghost"
          />
        )}
      </HStack>
      {open && children}
    </VStack>
  );
}

/**
 * The points a round settled without the human, under "Settled without you", in the groups the
 * round has: a card on a wide screen, and none on the phone, after the page's band there. `points`
 * draws a group's blocks.
 */
export function SettledGroups({
  document,
  groups,
  hoodForced,
  points,
}: {
  document: Document;
  groups: ReadonlyArray<SettledGroup>;
  /** Whether "Under the hood" is opened by what it shows, a comment form on its point. */
  hoodForced: boolean;
  points: (group: SettledGroup) => ReactNode;
}) {
  const wide = useWidthClass() === "wide";
  const folds = useHoodFold(document, groups, hoodForced);
  // One tree at every width, so a comment being typed stays as the window crosses the breakpoint.
  return (
    <div {...stylex.props(styles.settled)}>
      <Card
        padding={wide ? 6 : 0}
        variant={wide ? "default" : "transparent"}
        xstyle={!wide && styles.flat}
      >
        <VStack gap={5} xstyle={styles.content}>
          <Heading level={2}>Settled without you</Heading>
          {groups.map((group) => (
            <Group document={document} folds={folds} group={group} key={group.heading}>
              {points(group)}
            </Group>
          ))}
        </VStack>
      </Card>
    </div>
  );
}
