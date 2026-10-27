// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, In progress, and Sessions, as the sidebar's
// cards, in the two columns that end nearest each other (`Core.tsx`); under it, the widgets in two
// columns as well: the inbox's latest notes with what is done under them, and the priorities now
// with the usage. From semi-wide, two columns; on the phone, one, in the same order.
import { Fragment } from "react";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useInbox, usePriorities } from "../data.ts";
import { byRunning, lookOf, marksOf } from "../lists/PrioritiesList.tsx";
import { WorkList, type WorkSection } from "../lists/WorkList.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { plain } from "../Spans.tsx";
import { coreParts, splitColumns } from "./Core.tsx";
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

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const PRIORITIES_SHOWN = 5;

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
  features,
  isNarrow: narrow,
  rows,
}: {
  features: Array<Feature>;
  isNarrow: boolean;
  rows: Array<Row>;
}) {
  const here = useRepoPath();
  const { count, latest } = inboxSummary(useInbox());
  const priorities = usePriorities();
  const entries = (
    priorities ? byRunning(priorities).sections.find((s) => s.section === "now")?.entries ?? [] : []
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
  return (
    <VStack gap={1}>
      <WorkList layout="columns" level={3} onOpen={navigate} sections={sections} />
      {narrow && recent}
      {narrow && usage}
    </VStack>
  );
}

export function HomeHub() {
  const { sessionList, workspace } = useNavigation();
  const narrow = isNarrow(useWidthClass());
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const rows = sessionList?.rows ?? [];
  const { agents, human, invalid } = homeFeatures(workspace.features);
  const parts = coreParts({ agents, human, invalid, rows });
  // Two columns from semi-wide, split so that they end as near each other as they can; the
  // reading order on the phone.
  const [left, right] = splitColumns(parts);
  return (
    <VStack gap={1}>
      {narrow ? (
        <VStack gap={1}>
          {parts.map((part) => (
            <Fragment key={part.key}>{part.node}</Fragment>
          ))}
        </VStack>
      ) : (
        <Columns>
          <VStack gap={1}>
            {left.map((part) => (
              <Fragment key={part.key}>{part.node}</Fragment>
            ))}
          </VStack>
          <VStack gap={1}>
            {right.map((part) => (
              <Fragment key={part.key}>{part.node}</Fragment>
            ))}
          </VStack>
        </Columns>
      )}
      <Overview />
      <div {...stylex.props(styles.widgets)}>
        <Lists features={workspace.features} isNarrow={narrow} rows={rows} />
      </div>
    </VStack>
  );
}
