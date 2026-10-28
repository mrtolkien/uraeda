// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, In progress, and Sessions, as the sidebar's
// cards, in the two columns that end nearest each other (`Core.tsx`); under it, the widgets in two
// columns as well: the inbox's latest notes with what is done under them, and the priorities now
// with the usage. From semi-wide, two columns; on the phone, one, in the same order.
import { type FocusEvent, Fragment, useRef, useState } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useInbox, usePriorities } from "../data.ts";
import { byRunning, lookOf, marksOf } from "../lists/PrioritiesList.tsx";
import { WorkList, type WorkSection } from "../lists/WorkList.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { plain } from "../Spans.tsx";
import type { Move } from "../lists/destination.ts";
import {
  cardKeyOf,
  type CoreStep,
  focusCore,
  onCorePointer,
  stepCore,
  useCoreKeys,
} from "./coreKeys.ts";
import { type CorePart, coreParts, splitColumns } from "./Core.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { homeFeatures } from "./features.ts";
import { Columns, Overview, PaneLink } from "./parts.tsx";
import { Recent } from "./Recent.tsx";
import { inboxSummary, NOT_SORTED } from "./summary.ts";
import { Usage } from "./Usage.tsx";
import { plural } from "../labels.ts";
import type { Feature, Row } from "../sidebar/cards.ts";

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

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const PRIORITIES_SHOWN = 5;

/**
 * The row the list selects as a move down from the core asks, `follow`: each move selects the first
 * row of its column, or of the other one where it has none. It follows each new `follow` as the
 * list renders, where an effect would render the list twice.
 */
function useFollowed(follow: { column: number } | undefined, sections: Array<WorkSection>) {
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

/**
 * The inbox's three latest notes and the first five entries of Now that are not running, which the
 * core above already shows, as the inbox and the priorities pages draw them: the same cards, side
 * by side as the columns of one list, so that `h l` moves between them as it does on the
 * priorities page. A note shows its category in its border, none for one without; an entry, a draft
 * marked so. A card opens its note or its entry's pane, and each pane ends with its way to its page.
 * From semi-wide, the done items go under the inbox and the usage under the priorities, so that the
 * columns end near each other; on the phone, one under the other, in that order, `below` the list.
 */
function Lists({
  clear,
  features,
  follow,
  isNarrow: narrow,
  onEdge,
  onSelected,
  rows,
}: {
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
}) {
  const here = useRepoPath();
  const { count, latest } = inboxSummary(useInbox());
  const priorities = usePriorities();
  const entries = (
    priorities
      ? (byRunning(priorities).sections.find((s) => s.section === "now")?.entries ?? [])
      : []
  ).slice(0, PRIORITIES_SHOWN);
  const recent = <Recent features={features} rows={rows} />;
  const usage = <Usage />;
  const sections: Array<WorkSection> = [
    {
      ...(narrow ? {} : { below: recent }),
      ...(count === 0 ? { context: "The inbox is empty." } : {}),
      // Of all its notes, though three are listed.
      count,
      footer: (
        <PaneLink
          href={here("/inbox")}
          label={count === 0 ? "Open the inbox" : `${plural(count, "note")} to organize`}
        />
      ),
      icon: "uraeda:inbox",
      id: "inbox",
      isFixed: true,
      rows: latest.map((note) => ({
        href: here(`/inbox/${note.key}`),
        isFixed: true,
        key: note.key,
        lines: note.nestedSpans.map(plain),
        ...(note.category === NOT_SORTED ? {} : { marks: note.category }),
        text: plain(note.spans),
      })),
      title: "Inbox",
      tone: "neutral",
    },
    {
      ...(narrow ? {} : { below: usage }),
      ...(entries.length === 0 ? { context: "Nothing in Now." } : {}),
      footer: <PaneLink href={here("/priorities")} label="Open priorities" />,
      icon: "uraeda:list",
      id: "now",
      isFixed: true,
      rows: entries.map((entry) => ({
        href: here(`/priorities/${entry.key}`),
        ...lookOf(entry),
        isFixed: true,
        key: entry.key,
        lines: entry.nestedSpans.map(plain),
        marks: marksOf(entry),
        text: plain(entry.spans),
      })),
      title: "Priorities now",
      tone: "blue",
    },
  ];
  const selecting = useFollowed(follow, sections);
  return (
    <VStack gap={1}>
      <WorkList
        clear={clear}
        follow={selecting}
        layout="columns"
        level={3}
        onEdge={(move, section) =>
          onEdge(move, section === undefined ? undefined : section === "now" ? 1 : 0)
        }
        onOpen={navigate}
        onSelected={onSelected}
        sections={sections}
      />
      {narrow && recent}
      {narrow && usage}
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
  // card, or starts at the first one.
  const core = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<string>();
  const [follow, setFollow] = useState<{ column: number }>();
  const [clear, setClear] = useState<object>();
  const onLeave = (column: number) => setFollow({ column });
  const onCoreKey = useCoreKeys(core, onLeave);
  const onEdge = (move: Move, column: number | undefined) => {
    if (column !== undefined) {
      return focusCore(core, column, "last");
    }
    const step = STEP_OF[move];
    return (
      (picked !== undefined && stepCore(core, picked, step, onLeave)) || focusCore(core, 0, "first")
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
  const { agents, human, invalid } = homeFeatures(workspace.features);
  const parts = coreParts({ agents, human, invalid, picked, rows });
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
      <div {...stylex.props(styles.widgets)}>
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
