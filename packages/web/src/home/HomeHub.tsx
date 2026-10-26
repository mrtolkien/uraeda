// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, In progress, and Sessions, as the sidebar's
// cards, in the two columns that end nearest each other (`Core.tsx`); under it, the widgets two by
// two: the priorities now, the usage, the inbox's latest notes, and what is done. From semi-wide,
// two columns; on the phone, one, in the same order.
import { Fragment } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { useInbox, usePriorities } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { plain } from "../Spans.tsx";
import { coreParts, splitColumns } from "./Core.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { homeFeatures } from "./features.ts";
import { Columns, HomeRow, Overview, PaneLink } from "./parts.tsx";
import { Recent } from "./Recent.tsx";
import { inboxSummary, prioritySection, runningStatus } from "./summary.ts";
import { Usage } from "./Usage.tsx";
import { plural } from "../labels.ts";
import { Empty } from "../layout/Empty.tsx";

/** How many entries Priorities now shows: the rest are one tap away, on the priorities page. */
const PRIORITIES_SHOWN = 5;

/**
 * The entries of Now, the running ones first with their status, a draft marked so, the first five:
 * a running entry opens its feature, another its pane.
 */
function PrioritiesNow({ running }: { running: Array<string> }) {
  const here = useRepoPath();
  const priorities = usePriorities();
  const entries = (priorities ? prioritySection(priorities, "now") : []).slice(0, PRIORITIES_SHOWN);
  return (
    <Pane level={3} title="Priorities now">
      {entries.length === 0 ? (
        <Empty isInset>Nothing in Now.</Empty>
      ) : (
        entries.map((entry) => (
          <HomeRow
            href={here(entry.running ? `/f/${entry.running.folder}` : `/priorities/${entry.key}`)}
            icon={<Icon color="secondary" icon="uraeda:list" size="md" />}
            key={entry.key}
            sub={
              entry.running
                ? `Ongoing · ${runningStatus(entry.running, running).label}`
                : entry.draft
                  ? entry.draft.backlog
                    ? "Backlog"
                    : "Draft"
                  : "Not started"
            }
            title={plain(entry.spans)}
          />
        ))
      )}
      <PaneLink href={here("/priorities")} label="Open priorities" />
    </Pane>
  );
}

/** The inbox's three latest notes, each with its category, and the way to the inbox with its count. */
function Inbox() {
  const here = useRepoPath();
  const { count, latest } = inboxSummary(useInbox());
  return (
    <Pane count={count} level={3} title="Inbox">
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
        <PrioritiesNow running={workspace.running} />
        <Usage />
        <Inbox />
        <Recent features={workspace.features} rows={rows} />
      </Columns>
    </VStack>
  );
}
