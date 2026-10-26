// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, In progress, and Sessions, as the sidebar's
// cards, in the two columns that end nearest each other (`Core.tsx`); under it, the widgets two by
// two: the inbox's latest notes and the priorities now, then what is done and the usage. From semi-wide,
// two columns; on the phone, one, in the same order.
import { Fragment } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { useInbox, usePriorities } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { byRunning, marksOf } from "../lists/PrioritiesList.tsx";
import { WorkList } from "../lists/WorkList.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { plain } from "../Spans.tsx";
import { coreParts, splitColumns } from "./Core.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { homeFeatures } from "./features.ts";
import { Columns, HomeRow, Overview, PaneLink } from "./parts.tsx";
import { Recent } from "./Recent.tsx";
import { inboxSummary } from "./summary.ts";
import { Usage } from "./Usage.tsx";
import { plural } from "../labels.ts";
import { Empty } from "../layout/Empty.tsx";

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const PRIORITIES_SHOWN = 5;

/**
 * The first five entries of Now that are not running, which the core above already shows, as the
 * priorities page draws them: the same cards, a draft marked so. A card opens its entry's pane.
 */
function PrioritiesNow() {
  const here = useRepoPath();
  const priorities = usePriorities();
  const entries = (
    priorities ? byRunning(priorities).sections.find((s) => s.section === "now")?.entries ?? [] : []
  ).slice(0, PRIORITIES_SHOWN);
  const link = <PaneLink href={here("/priorities")} label="Open priorities" />;
  if (entries.length === 0) {
    return (
      <Pane icon="uraeda:list" level={3} title="Priorities now">
        <Empty isInset>Nothing in Now.</Empty>
        {link}
      </Pane>
    );
  }
  return (
    <WorkList
      level={3}
      onOpen={navigate}
      sections={[
        {
          footer: link,
          icon: "uraeda:list",
          id: "now",
          isFixed: true,
          rows: entries.map((entry) => ({
            href: here(`/priorities/${entry.key}`),
            isFixed: true,
            key: entry.key,
            lines: entry.nestedSpans.map(plain),
            marks: marksOf(entry),
            text: plain(entry.spans),
          })),
          title: "Priorities now",
          tone: "blue",
        },
      ]}
    />
  );
}

/** The inbox's three latest notes, each with its category, and the way to the inbox with its count. */
function Inbox() {
  const here = useRepoPath();
  const { count, latest } = inboxSummary(useInbox());
  return (
    <Pane count={count} icon="uraeda:inbox" level={3} title="Inbox">
      {count === 0 ? (
        <Empty isInset>The inbox is empty.</Empty>
      ) : (
        latest.map((note) => (
          <HomeRow
            href={here(`/inbox/${note.key}`)}
            icon={<Icon color="secondary" icon="uraeda:pencil" size="md" />}
            key={note.id}
            sub={note.category}
            title={note.text}
          />
        ))
      )}
      <PaneLink
        href={here("/inbox")}
        label={count === 0 ? "Open the inbox" : `${plural(count, "note")} to organize`}
      />
    </Pane>
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
      <Columns>
        <Inbox />
        <PrioritiesNow />
        <Recent features={workspace.features} rows={rows} />
        <Usage />
      </Columns>
    </VStack>
  );
}
