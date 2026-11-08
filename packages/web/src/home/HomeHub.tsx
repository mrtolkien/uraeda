// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, In progress, and Sessions, as the sidebar's
// cards, in the two columns that end nearest each other (`Core.tsx`); under it, the widgets in two
// columns as well, the home panes of the extensions on here (`home/panes.tsx`): the inbox's latest
// notes with what is done under them, and the priorities now with the usage. From semi-wide, two columns; on the phone, one, in the same order. While Continue
// all's preview is on, the widgets are dimmed with the cards it leaves alone.
import { type FocusEvent, Fragment, type ReactNode, useMemo, useRef, useState } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { WorkList, type WorkSection } from "../lists/WorkList.tsx";
import { navigate } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import type { Move } from "../lists/destination.ts";
import {
  cardKeyOf,
  type CoreStep,
  focusCore,
  onCorePointer,
  stepCore,
  useCoreKeys,
} from "./coreKeys.ts";
import { type CorePart, continuedKeys, coreParts, splitColumns } from "./Core.tsx";
import { previewStyles } from "./ContinueAll.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { homeFeatures } from "./features.ts";
import { Columns, Overview } from "./parts.tsx";
import { Recent } from "./Recent.tsx";
import { Usage } from "./Usage.tsx";
import type { Feature, Row } from "../sidebar/cards.ts";
import { Collect } from "../extensions/Collect.tsx";
import type { HomePane } from "../extensions/registry.ts";
import { useContributions } from "../extensions/useContributions.ts";

const styles = stylex.create({
  // The widgets' space: the column of the page's grid it sits in, however wide it grows.
  widgets: { minWidth: 0 },
});

/** A list's key move, as the core's cards take it: the first and the last row are up and down. */
const STEP_OF: Record<Move, CoreStep> = {
  first: "up",
  last: "down",
  left: "left",
  next: "down",
  previous: "up",
  right: "right",
};

/**
 * The row the list selects as a move down from the core asks, `follow`: each move selects the first
 * row of its column, or of the other one where it has none. It follows each new `follow` as the
 * list renders, where an effect would render the list twice.
 */
function useFollowed(follow: { column: number } | undefined, sections: ReadonlyArray<WorkSection>) {
  const [selecting, setSelecting] = useState<{ key: string }>();
  const [followed, setFollowed] = useState<{ column: number }>();
  if (follow !== followed) {
    setFollowed(follow);
    const firsts = sections.map((section) => section.rows[0]?.key);
    const key =
      follow === undefined
        ? undefined
        : (firsts[follow.column] ?? firsts.find((k) => k !== undefined));
    if (key !== undefined) {
      setSelecting({ key });
    }
  }
  return selecting;
}

/** What the overview's list is given by the home. */
type ListsProps = {
  /** Each new object leaves no row selected: a card of the core is. */
  clear: object | undefined;
  features: Array<Feature>;
  /** A row to select, with the focus, as a move down from the core asks: by its column, 0 or 1. */
  follow: { column: number } | undefined;
  isNarrow: boolean;
  /** Up from a column's top row, by its column, or with no row selected: the core's cards. */
  onEdge: (move: Move, column: number | undefined) => boolean;
  /** Hears a row selected, by the keys or the pointer: the core's card is no longer. */
  onSelected: (key: string | undefined) => void;
  rows: Array<Row>;
};

/** A pane's section: a built-in's read by its own component, yours with its body as its footer. */
function readPane(pane: HomePane, next: (section: WorkSection) => ReactNode): ReactNode {
  if (pane.section) {
    const Section = pane.section;
    return <Section>{next}</Section>;
  }
  const Body = pane.component;
  return next({
    ...(Body ? { footer: <Body /> } : {}),
    icon: pane.icon,
    id: pane.id,
    isFixed: true,
    rows: [],
    title: pane.title,
    tone: pane.tone,
  });
}

/**
 * The panes of the extensions on here, by their column, the built-ins' first in each, the inbox's
 * and the priorities' now, as the same cards side by side as the columns of one list, so that `h l` moves between them as it
 * does on the priorities page.
 */
function Lists(props: ListsProps) {
  const contributed = useContributions("homePane");
  // Drawn left to right by their column, then in their order, so that a pane's place in the row is
  // the column `onEdge` names: a pane of column 0 registered after one of column 1 comes first.
  const panes = useMemo(() => [...contributed].sort((a, b) => a.column - b.column), [contributed]);
  return (
    <Collect items={panes} read={readPane}>
      {(sections) => <PaneList {...props} panes={panes} sections={sections} />}
    </Collect>
  );
}

/**
 * The overview's list. From semi-wide, the done items go under the first pane of the left column,
 * the inbox's, and the usage under the first of the right, the priorities', so that the columns end
 * near each other; on the phone, or with no pane in their column, under the list, in that order.
 */
function PaneList({
  clear,
  features,
  follow,
  isNarrow: narrow,
  onEdge,
  onSelected,
  panes,
  rows,
  sections,
}: ListsProps & { panes: ReadonlyArray<HomePane>; sections: ReadonlyArray<WorkSection> }) {
  const recent = <Recent features={features} rows={rows} />;
  const usage = <Usage />;
  const columnOf = (id: string) => panes.find((pane) => pane.id === id)?.column ?? 0;
  const firstIn = (column: number) =>
    narrow ? undefined : sections.find((section) => columnOf(section.id) === column)?.id;
  const recentAt = firstIn(0);
  const usageAt = firstIn(1);
  const placed = sections.map((section) =>
    section.id === recentAt
      ? { ...section, below: recent }
      : section.id === usageAt
        ? { ...section, below: usage }
        : section,
  );
  const selecting = useFollowed(follow, placed);
  return (
    <VStack gap={1}>
      <WorkList
        clear={clear}
        follow={selecting}
        layout="columns"
        level={3}
        onEdge={(move, section) =>
          onEdge(move, section === undefined ? undefined : columnOf(section))
        }
        onOpen={navigate}
        onSelected={onSelected}
        sections={placed}
      />
      {recentAt === undefined && recent}
      {usageAt === undefined && usage}
    </VStack>
  );
}

/** A column of the core's panes, which its keys move along (see `coreKeys.ts`). */
function CoreColumn({ parts }: { parts: ReadonlyArray<CorePart> }) {
  return (
    <div data-core-column="">
      <VStack gap={1}>
        {parts.map((part) => (
          <Fragment key={part.key}>{part.node}</Fragment>
        ))}
      </VStack>
    </div>
  );
}

export function HomeHub() {
  const { sessionList, workspace } = useNavigation();
  const narrow = isNarrow(useWidthClass());
  // One selection on the page, as on a list: a card of the core, `picked`, or a row of the list
  // under it, each clearing the other. A card is picked as it takes the focus, by the keys or the
  // pointer. Down from a column's last card selects the list's row under it, and up from the
  // list's top row comes back to the core; a key with no row selected goes on from the picked
  // card, or starts at the first one, the right column's for `l`.
  const core = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string>();
  const [follow, setFollow] = useState<{ column: number }>();
  const [clear, setClear] = useState<object>();
  // Continue all under the pointer or focused: its preview, on while it has a run to continue.
  const [isPreviewing, setPreviewing] = useState(false);
  const onLeave = (column: number) => setFollow({ column });
  const onCoreKey = useCoreKeys(core, onLeave);
  const onEdge = (move: Move, column: number | undefined) => {
    if (column !== undefined) {
      return focusCore(core, column, "last");
    }
    const step = STEP_OF[move];
    // With no card picked yet, `l` starts at the right column's first card, as its key says, and
    // every other key at the first one.
    return (
      (picked !== undefined && stepCore(core, picked, step, onLeave)) ||
      focusCore(core, step === "right" ? 1 : 0, "first")
    );
  };
  const onCoreFocus = (event: FocusEvent) => {
    const key = cardKeyOf(event.target);
    if (key !== undefined && key !== picked) {
      setPicked(key);
      setClear({});
    }
  };
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const rows = sessionList?.rows ?? [];
  const { agents, human, invalid } = homeFeatures(workspace.features, rows);
  // Its button goes with the last run to continue, under the pointer too: the preview goes with it.
  if (isPreviewing && continuedKeys(human).size === 0) {
    setPreviewing(false);
  }
  const parts = coreParts({
    agents,
    human,
    invalid,
    picked,
    preview: { isOn: isPreviewing, onChange: setPreviewing },
    rows,
  });
  // Two columns from semi-wide, split so that they end as near each other as they can; the
  // reading order on the phone.
  const [left, right] = splitColumns(parts);
  return (
    <VStack gap={1}>
      {/* The keys and the pointer of its cards' links, which have the focus: the page's keys leave a key it took. */}
      <div onFocus={onCoreFocus} onKeyDown={onCoreKey} onPointerMove={onCorePointer} ref={core}>
        {narrow ? (
          <CoreColumn parts={parts} />
        ) : (
          <Columns>
            <CoreColumn parts={left} />
            <CoreColumn parts={right} />
          </Columns>
        )}
      </div>
      <Overview />
      <div
        {...stylex.props(styles.widgets, previewStyles.row, isPreviewing && previewStyles.dimmed)}
      >
        <Lists
          clear={clear}
          features={workspace.features}
          follow={follow}
          isNarrow={narrow}
          onEdge={onEdge}
          onSelected={(key) => {
            if (key !== undefined) {
              setPicked(undefined);
            }
          }}
          rows={rows}
        />
      </div>
    </VStack>
  );
}
