// The session's column, beside every session's page, with or without a feature (US1, US2): the
// documents' column (`layout/DocumentColumn.tsx`), its one panel the split of the Activity over the
// Changes (approval comment C1), and the plan's progress at its foot. Narrower than the documents'
// at semi-wide, so the chat keeps the weight (approval comment C2, ruling R9), its fold and dragged
// width the documents'. A recap line's address, `?tab=activity&stretch=<turn>:<seq>`, unfolds it at
// the Activity. On the phone, the status line's Activity, Changes, and progress instead, the first
// two opening the column's split in a sheet kept in the address (`useSheetTab`, ruling R3). While
// the main agent runs sub-agents, or while the address opens it, a Sub-agents panel over the Changes
// joins it (US3), and its sheet on the phone, which a reload or a width change keeps.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { type ReactNode, useEffect, useMemo } from "react";
import { useFateClient, useView } from "react-fate";
import type { Session } from "uraeda-server/fate";
import { ColumnStatusLine } from "../layout/ColumnStatusLine.tsx";
import { type ColumnPanel, DocumentColumn, useAskedTab } from "../layout/DocumentColumn.tsx";
import { useSessionColumnWidth } from "../layout/documentColumnWidth.ts";
import { splitPanel } from "../layout/SplitPanel.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useSheetTab } from "../layout/useSheetTab.ts";
import { useSearch } from "../routes.tsx";
import { useSession } from "../sessionData.ts";
import { ActivityPanel, NoCall } from "./ActivityPanel.tsx";
import { ChangesPanel, fileCount } from "./ChangesPanel.tsx";
import { PlanProgress, ProgressChip } from "./PlanProgress.tsx";
import { Section } from "./Section.tsx";
import { STRETCH_PARAMETER } from "./stretches.ts";
import { SubagentsPanel, topLevel } from "./SubagentsPanel.tsx";
import { SessionView } from "../views.ts";

/** The key of the Sub-agents panel, its tab's in the address. */
const SUBAGENTS = "subagents";

/** What the session's column draws from: the feature's or the change's folder, and the session. */
type Of = { folder?: string | undefined; session?: string | undefined };

/** "2 running", its number shown, its word read out after it. */
function RunningCount({ count }: { count: number }) {
  return (
    <>
      {count}
      <VisuallyHidden> running</VisuallyHidden>
    </>
  );
}

/**
 * The session column's panels: the Activity over the Changes, a split shown as the Activity's tab;
 * then, while the main agent runs `running` sub-agents or the address's tab, `asked`, is theirs,
 * the Sub-agents over the Changes, its tab counting them.
 */
export function sessionPanels({
  asked = null,
  folder,
  running = 0,
  session,
}: Of & { asked?: string | null; running?: number }): Array<ColumnPanel> {
  const activity: ColumnPanel = {
    // Before its first message, the session has no call.
    content: session === undefined ? <NoCall /> : <ActivityPanel session={session} />,
    icon: "uraeda:activity",
    key: "activity",
    label: "Activity",
  };
  const changes: ColumnPanel = {
    content: (
      <ChangesPanel
        {...(folder === undefined ? {} : { folder })}
        {...(session === undefined ? {} : { session })}
      />
    ),
    icon: "uraeda:git-compare",
    key: "changes",
    label: "Changes",
  };
  if (running === 0 && asked !== SUBAGENTS) {
    return [splitPanel(activity, changes)];
  }
  const subagents: ColumnPanel = {
    ...(running === 0 ? {} : { badge: <RunningCount count={running} /> }),
    content: <SubagentsPanel session={session} />,
    icon: "uraeda:users",
    key: SUBAGENTS,
    label: "Sub-agents",
  };
  return [splitPanel(activity, changes), splitPanel(subagents, changes)];
}

/**
 * How many sub-agents the main agent of the session `session` runs, from its record as the page
 * read it, which this read shares: none before it exists.
 */
function useRunningSubagents(session: string | undefined): number {
  const fate = useFateClient();
  // The reference's identity is the view's subscription: one per session.
  const ref = useMemo(
    () => (session === undefined ? undefined : fate.ref<Session>("Session", session, SessionView)),
    [fate, session],
  );
  const record = useView(SessionView, ref);
  return topLevel(record?.subagents ?? []).length;
}

/**
 * The status line's Changes: the `count` files the session edited, opening the sheet. Its name
 * starts with what it shows, as a spoken command names it.
 */
function ChangesButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <Button
      icon={<Icon icon="uraeda:git-compare" />}
      label={`Changes ${count} · ${fileCount(count)} edited`}
      onClick={onOpen}
      variant="ghost"
    >
      {`Changes ${count}`}
    </Button>
  );
}

/** The status line's Changes of the session `session`, as it is read. */
function SessionChanges({ onOpen, session }: { onOpen: () => void; session: string }) {
  return <ChangesButton count={useSession(session)?.edited.length ?? 0} onOpen={onOpen} />;
}

/**
 * On the phone, the column outside the page: the status line's Activity and Changes, each opening
 * the column's split in the sheet `activity`, and the plan's progress, opening the plan at its
 * task. Each of `panels` is a sheet the address may open, as a reload or a width change does.
 */
function PhoneParts({ folder, panels, session }: Of & { panels: ReadonlyArray<ColumnPanel> }) {
  // A sheet for each panel, by its tab's key: the Sub-agents' too, while its tab shows.
  const sheets = Object.fromEntries(panels.map((panel) => [panel.key, panel.label]));
  const sheet = useSheetTab(sheets, true);
  const [, setSheet] = sheet;
  const open = () => setSheet("activity");
  const buttons = (
    <>
      <Button
        icon={<Icon icon="uraeda:activity" />}
        label="Activity"
        onClick={open}
        variant="ghost"
      />
      {/* Before its first message, the session does not exist: it changed nothing. */}
      {session === undefined ? (
        <ChangesButton count={0} onOpen={open} />
      ) : (
        <Section>
          <SessionChanges onOpen={open} session={session} />
        </Section>
      )}
      {folder !== undefined && (
        <Section>
          <ProgressChip folder={folder} />
        </Section>
      )}
    </>
  );
  return (
    <ColumnStatusLine
      buttons={buttons}
      sheet={sheet}
      sheets={panels.map(({ content, key, label }) => ({ key, label, panel: content }))}
    />
  );
}

/**
 * Unfolds the column with `setShown` each time the address names a stretch: a recap line opens
 * the Activity at it, folded or not.
 */
function useStretchUnfolds(setShown: (shown: boolean) => void) {
  const stretch = new URLSearchParams(useSearch()).get(STRETCH_PARAMETER);
  useEffect(() => {
    if (stretch !== null) {
      setShown(true);
    }
  }, [setShown, stretch]);
}

/**
 * `content`, a session's page, with the session's column, "The session's column", beside it on
 * wide and semi-wide screens, and its parts on the phone's status line: of the session `session`,
 * once it exists, and of the feature or the change in `folder`, if any.
 */
export function SessionColumn({ content, folder, session }: Of & { content: ReactNode }) {
  const column = useSessionColumnWidth();
  const wide = !isNarrow(useWidthClass());
  useStretchUnfolds(column.setShown);
  const panels = sessionPanels({
    asked: useAskedTab(),
    folder,
    running: useRunningSubagents(session),
    session,
  });
  return (
    <>
      <DocumentColumn
        column={column}
        content={content}
        footer={
          folder === undefined ? undefined : (
            <Section>
              <PlanProgress folder={folder} />
            </Section>
          )
        }
        label="The session's column"
        panels={panels}
      />
      {!wide && <PhoneParts folder={folder} panels={panels} session={session} />}
    </>
  );
}
