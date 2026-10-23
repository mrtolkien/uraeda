// Home: the core, then the overview. Above a dashed "Overview" line, the problems that stop the
// workflow when there are any, what waits on the human, then In progress beside Sessions; under it,
// the widgets two by two: the priorities now, the usage, the inbox's latest notes, and what is done.
// From semi-wide, two columns; on the phone, one, in the same order.
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { useInbox, usePriorities } from "../data.ts";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { plain } from "../Spans.tsx";
import { InProgress, NeedsYou, Problems, Sessions } from "./Core.tsx";
import { homeFeatures } from "./features.ts";
import { Columns, Empty, HomeRow, Overview, PaneLink } from "./parts.tsx";
import { Recent } from "./Recent.tsx";
import { inboxSummary, prioritySection, runningStatus } from "./summary.ts";
import { Usage } from "./Usage.tsx";

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
        <Empty>Nothing in Now.</Empty>
      ) : (
        entries.map((entry) => (
          <HomeRow
            href={here(entry.running ? `/f/${entry.running.folder}` : `/priorities/${entry.key}`)}
            icon={<Icon color="secondary" icon="uraeda:list" size="sm" />}
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
        <Empty>The inbox is empty.</Empty>
      ) : (
        latest.map((note) => (
          <HomeRow
            href={here(`/inbox/${note.key}`)}
            icon={<Icon color="secondary" icon="uraeda:pencil" size="sm" />}
            key={note.id}
            sub={note.category}
            title={note.text}
          />
        ))
      )}
      <PaneLink
        href={here("/inbox")}
        label={
          count === 0 ? "Open the inbox" : `${count} ${count === 1 ? "note" : "notes"} to organize`
        }
      />
    </Pane>
  );
}

export function HomeHub() {
  const { sessionList, workspace } = useNavigation();
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const rows = sessionList?.rows ?? [];
  const { agents, human, invalid } = homeFeatures(workspace.features);
  return (
    <VStack gap={1}>
      <Problems features={invalid} />
      <NeedsYou features={human} />
      <Columns isCore>
        <InProgress features={agents} rows={rows} />
        <Sessions rows={rows} />
      </Columns>
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
