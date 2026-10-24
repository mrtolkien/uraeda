import { Heading } from "@astryxdesign/core/Heading";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Document, SettledGroup } from "uraeda-binding";
import { type Folds, useHashFold } from "./Folds.tsx";
import { Pane } from "./layout/Pane.tsx";
import { CheckPane } from "./RoundParts.tsx";
import { plain } from "./Spans.tsx";
import { useOpenKeys } from "./useOpenKeys.ts";

const styles = stylex.create({
  settled: {
    marginBlockEnd: spacingVars["--spacing-6"],
  },
});

/** The parts of a round's settled points: "Check these", before the questions, or the round's end. */
export type SettledPart = "check" | "end";

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

/** The line "Under the hood" folds to, "1 choice in the code only" for one point. */
const foldedLabel = (count: number) =>
  `${count} ${count === 1 ? "choice" : "choices"} in the code only`;

/** A group of the round's end, a pane by its kind: Behaviour, or Under the hood folded. */
function GroupPane({
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
  const count = group.points;
  const isHood = group.kind === "hood";
  return (
    <Pane
      count={count}
      fold={
        isHood
          ? {
              folded: foldedLabel(count),
              isOpen: folds.open.includes(HOOD),
              onOpenChange: (isOpen) => folds.onOpenChange(HOOD, isOpen),
            }
          : undefined
      }
      icon={isHood ? "uraeda:wrench" : "uraeda:eye"}
      id={isHood ? "under-the-hood" : "behaviour"}
      isOpenOnPhone
      level={3}
      title={heading ? plain(heading.spans) : ""}
    >
      {children}
    </Pane>
  );
}

/**
 * The points a round settled without the human, in the groups the round has, by `part`: `check`,
 * the "Check these" pane, when it has points; `end`, "Settled without you" with Behaviour and Under
 * the hood folded; both without `part`. `points` draws a group's blocks.
 */
export function SettledGroups({
  document,
  groups,
  hoodForced,
  part,
  points,
}: {
  document: Document;
  groups: ReadonlyArray<SettledGroup>;
  /** Whether "Under the hood" is opened by what it shows, a comment form on its point. */
  hoodForced: boolean;
  part?: SettledPart;
  points: (group: SettledGroup) => ReactNode;
}) {
  const folds = useHoodFold(document, groups, hoodForced);
  const check = groups.find((group) => group.kind === "check");
  // A group without points draws no pane, as the outline has no row for it.
  const end = groups.filter((group) => group.kind !== "check" && group.points > 0);
  const hasCheck = part !== "end" && check !== undefined && check.points > 0;
  const hasEnd = part !== "check" && end.length > 0;
  if (!hasCheck && !hasEnd) {
    return null;
  }
  // One tree at every width, so a comment being typed stays as the window crosses the breakpoint.
  return (
    <div {...stylex.props(styles.settled)}>
      {hasCheck && check && <CheckPane count={check.points}>{points(check)}</CheckPane>}
      {hasEnd && (
        <>
          <Heading level={2}>Settled without you</Heading>
          {end.map((group) => (
            <GroupPane document={document} folds={folds} group={group} key={group.heading}>
              {points(group)}
            </GroupPane>
          ))}
        </>
      )}
    </div>
  );
}
