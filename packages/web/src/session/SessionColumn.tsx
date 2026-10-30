// The session's column, beside every session's page, with or without a feature (US1, US2): the
// documents' column (`layout/DocumentColumn.tsx`), its one panel the split of the Activity over the
// Changes (approval comment C1), and the plan's progress at its foot. Narrower than the documents'
// at semi-wide, so the chat keeps the weight (approval comment C2, ruling R9), its fold and dragged
// width the documents'. A recap line's address, `?tab=activity&stretch=<turn>:<seq>`, unfolds it at
// the Activity. On the phone, the bottom bar's tiles instead, as the documents' pages have them:
// Activity, Changes, Sub-agents while any run, and the plan's progress, the first three opening the
// column in a sheet kept in the address (`useSheetTab`, ruling R3). While the main
// agent runs sub-agents, or while the address opens it, a Sub-agents panel over the Changes joins
// it (US3), a tab in the column and in the phone's sheet (ruling R23), which a reload or a width
// change keeps.
import { Heading } from "@astryxdesign/core/Heading";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useFateClient, useView } from "react-fate";
import type { Session } from "uraeda-server/fate";
import { ColumnStatusLine } from "../layout/ColumnStatusLine.tsx";
import { usePublishedJump } from "../JumpToLatest.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { type ColumnPanel, DocumentColumn, useAskedTab } from "../layout/DocumentColumn.tsx";
import { useSessionColumnWidth } from "../layout/documentColumnWidth.ts";
import { Overlay } from "../layout/Overlay.tsx";
import { splitPanel } from "../layout/SplitPanel.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { openOverlayAt } from "../layout/useBackCloses.ts";
import { useSheetTab } from "../layout/useSheetTab.ts";
import { redirect, useSearch } from "../routes.tsx";
import { useSession, useTurn } from "../sessionData.ts";
import { ActivityPanel, NoCall } from "./ActivityPanel.tsx";
import { ChangesPanel, fileCount } from "./ChangesPanel.tsx";
import { PlanProgress, ProgressChip } from "./PlanProgress.tsx";
import { Section } from "./Section.tsx";
import { STRETCH_PARAMETER, stretchAddress } from "./stretches.ts";
import { SubagentsPanel, topLevel } from "./SubagentsPanel.tsx";
import { SessionView } from "../views.ts";
import { SpokenCount } from "../layout/SpokenCount.tsx";

/** The key of the Sub-agents panel, its tab's in the address. */
const SUBAGENTS = "subagents";

/** The key of the Changes panel, its own on the phone. */
const CHANGES = "changes";

const styles = stylex.create({
  // The sheet's open panel, its title first, takes the sheet's room and scrolls on its own, its
  // title with it: the sheet's Close alone stays in view.
  panel: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",
    // What its content places is placed in it, and scrolls with it, not past it in the sheet.
    position: "relative",
  },
});

/** What the session's column draws from: the feature's or the change's folder, and the session. */
type Of = { folder?: string | undefined; session?: string | undefined };

/**
 * The session column's panels: the Activity over the Changes, a split shown as the Activity's tab;
 * then, while the main agent runs `running` sub-agents or the address's tab, `asked`, is theirs,
 * the Sub-agents over the Changes, its tab counting them. On the phone, `isSplit` false, each its
 * own panel, as the bottom bar has a tile for each.
 */
function sessionPanels({
  asked = null,
  folder,
  isSplit,
  running = 0,
  session,
}: Of & { asked?: string | null; isSplit: boolean; running?: number }): Array<ColumnPanel> {
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
    key: CHANGES,
    label: "Changes",
  };
  const hasSubagents = running > 0 || asked === SUBAGENTS;
  if (!isSplit) {
    return hasSubagents
      ? [activity, changes, subagentsPanel(session, running)]
      : [activity, changes];
  }
  if (!hasSubagents) {
    return [splitPanel(activity, changes)];
  }
  return [splitPanel(activity, changes), splitPanel(subagentsPanel(session, running), changes)];
}

/** The Sub-agents panel, its tab counting the `running` ones. */
function subagentsPanel(session: string | undefined, running: number): ColumnPanel {
  return {
    ...(running === 0 ? {} : { badge: <SpokenCount count={running} word="running" /> }),
    content: <SubagentsPanel session={session} />,
    icon: "uraeda:users",
    key: SUBAGENTS,
    label: "Sub-agents",
  };
}

/**
 * The record of the session `session` as the page read it, which this read shares: none before it
 * exists.
 */
function useSessionRecord(session: string | undefined) {
  const fate = useFateClient();
  // The reference's identity is the view's subscription: one per session.
  const ref = useMemo(
    () => (session === undefined ? undefined : fate.ref<Session>("Session", session, SessionView)),
    [fate, session],
  );
  return useView(SessionView, ref);
}

/**
 * Takes the stretch out of the address, in place, once the turn `turn`, a later one than `first`,
 * the latest as the page opened, runs: the Activity follows the latest calls again, rather than
 * keeping to a stretch of a run before. A turn queued behind the running one waits until it runs.
 */
function StretchEndsWithTurn({ first, turn }: { first: string; turn: string }) {
  const running = useTurn(turn, true)?.state === "running";
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (turn === first || !running || !search.has(STRETCH_PARAMETER)) {
      return;
    }
    search.delete(STRETCH_PARAMETER);
    const query = search.toString();
    redirect(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [first, running, turn]);
  return null;
}

/** The session's latest turn as the page first read it, kept as later turns start. */
function useFirstLatest(latest: string | undefined) {
  const [first, setFirst] = useState(latest);
  if (first === undefined && latest !== undefined) {
    setFirst(latest);
  }
  return first ?? latest;
}

/**
 * The bottom bar's Changes: the `count` files the session edited, opening the sheet. Its name
 * starts with what it shows, as a spoken command names it.
 */
function ChangesTile({
  count,
  isOpen,
  onOpen,
}: {
  count: number;
  isOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <NavTile
      icon="uraeda:git-compare"
      isOpen={isOpen}
      label={`Changes ${count} · ${fileCount(count)} edited`}
      onPress={onOpen}
    />
  );
}

/** The status line's Changes of the session `session`, as it is read. */
function SessionChanges({
  isOpen,
  onOpen,
  session,
}: {
  isOpen: boolean;
  onOpen: () => void;
  session: string;
}) {
  return (
    <ChangesTile count={useSession(session)?.edited.length ?? 0} isOpen={isOpen} onOpen={onOpen} />
  );
}

/** The name of the phone's sheet of the column, the status line's Activity, which opens it. */
const SHEET = "Activity";

/**
 * The phone's sheet of the column, open on `open`'s panel among `panels`, titled by it: no tabs,
 * since the bottom bar has a tile for each panel. Back closes it.
 */
function ColumnSheet({
  onClose,
  open,
  panels,
}: {
  onClose: () => void;
  open: string | undefined;
  panels: ReadonlyArray<ColumnPanel>;
}) {
  const shown = panels.find((panel) => panel.key === open) ?? panels[0];
  // No tabs: the bottom bar has a tile for each panel, and the sheet is titled by the one it shows.
  return (
    <Overlay
      fills
      isOpen={open !== undefined}
      isTitleInContent
      label={shown?.label ?? SHEET}
      onClose={onClose}
    >
      {/* Its title scrolls away with the panel; the sheet's Close alone stays. */}
      <div {...stylex.props(styles.panel)}>
        <Heading level={2}>{shown?.label ?? SHEET}</Heading>
        {shown?.content}
      </div>
    </Overlay>
  );
}

/**
 * Opens the phone's sheet at the Activity's latest calls: a stretch the page's address kept, from a
 * recap line's sheet closed since, is not where the status line opens it.
 */
function openActivity() {
  openOverlayAt(stretchAddress(window.location.pathname), SHEET);
}

/**
 * On the phone, the column outside the page, in the bottom bar by their icons, after the jump to
 * the latest: Activity and Changes, each opening its own sheet, Sub-agents while the column has
 * them, and the plan's progress, opening the plan at its task. A sheet may open at each of
 * `panels`, as the address asks, as a reload or a width change does.
 */
function PhoneParts({ folder, panels, session }: Of & { panels: ReadonlyArray<ColumnPanel> }) {
  // Each sheet's history entry is named as its title is, so Close and Back leave none behind.
  const sheets = Object.fromEntries(panels.map((panel) => [panel.key, panel.label]));
  const sheet = useSheetTab(sheets, true);
  const [open, setSheet] = sheet;
  const hasSubagents = panels.some((panel) => panel.key === SUBAGENTS);
  const jump = usePublishedJump();
  const buttons = (
    <NavTiles label="The session's parts">
      {/* Always there, dimmed at the end, so the other tiles never move. */}
      <NavTile
        icon="arrowDown"
        isDisabled={jump === undefined}
        label="Jump to the latest"
        onPress={() => jump?.()}
      />
      <NavTile
        icon="uraeda:activity"
        isOpen={open !== undefined && open !== SUBAGENTS && open !== CHANGES}
        label="Activity"
        onPress={openActivity}
      />
      {/* Before its first message, the session does not exist: it changed nothing. */}
      {session === undefined ? (
        <ChangesTile count={0} isOpen={open === CHANGES} onOpen={() => setSheet(CHANGES)} />
      ) : (
        <Section>
          <SessionChanges
            isOpen={open === CHANGES}
            onOpen={() => setSheet(CHANGES)}
            session={session}
          />
        </Section>
      )}
      {hasSubagents && (
        <NavTile
          icon="uraeda:users"
          isOpen={open === SUBAGENTS}
          label="Sub-agents"
          onPress={() => setSheet(SUBAGENTS)}
        />
      )}
      {folder !== undefined && (
        <Section>
          <ProgressChip folder={folder} />
        </Section>
      )}
    </NavTiles>
  );
  return (
    <>
      <ColumnStatusLine buttons={buttons} sheet={sheet} sheets={[]} />
      <ColumnSheet onClose={() => setSheet()} open={open} panels={panels} />
    </>
  );
}

/**
 * Unfolds the column with `setShown` each time the address names a stretch while the column is
 * drawn, `wide`: a recap line opens the Activity at it, folded or not. On the phone, the sheet
 * opens instead, and the fold, the desktop's, stays as the human left it.
 */
function useStretchUnfolds(setShown: (shown: boolean) => void, wide: boolean) {
  const stretch = new URLSearchParams(useSearch()).get(STRETCH_PARAMETER);
  useEffect(() => {
    if (wide && stretch !== null) {
      setShown(true);
    }
  }, [setShown, stretch, wide]);
}

/**
 * `content`, a session's page, with the session's column, "The session's column", beside it on
 * wide and semi-wide screens, and its parts on the phone's status line: of the session `session`,
 * once it exists, and of the feature or the change in `folder`, if any.
 */
export function SessionColumn({ content, folder, session }: Of & { content: ReactNode }) {
  const column = useSessionColumnWidth();
  const wide = !isNarrow(useWidthClass());
  useStretchUnfolds(column.setShown, wide);
  const record = useSessionRecord(session);
  const latest = record?.turns.at(-1);
  const first = useFirstLatest(latest);
  const panels = sessionPanels({
    asked: useAskedTab(),
    folder,
    isSplit: wide,
    running: topLevel(record?.subagents ?? []).length,
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
        isBeside
        label="The session's column"
        panels={panels}
      />
      {!wide && <PhoneParts folder={folder} panels={panels} session={session} />}
      {latest !== undefined && first !== undefined && (
        <Section>
          <StretchEndsWithTurn first={first} key={latest} turn={latest} />
        </Section>
      )}
    </>
  );
}
