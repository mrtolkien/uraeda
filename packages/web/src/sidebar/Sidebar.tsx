// The sidebar's rows below its search, in Uraeda's flow: Home; what needs the human; the inbox and
// the priorities with their counts; then one Sessions list, where every session, change, and feature
// in flight is a card, the oldest started first, and the Claude allowance. During a search, only the
// cards it found.
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useFateClient } from "react-fate";
import { useBranchChanges, useInbox } from "../data.ts";
import { type useNavigation, useSessionSearch } from "../sessionData.ts";
import { waiting } from "../labels.ts";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import { AddNoteButton, AddPriorityButton } from "../SidebarAdd.tsx";
import { Allowance } from "./Allowance.tsx";
import {
  byStart,
  byStatus,
  type Feature,
  featureStatus,
  inFlight,
  needsYou,
  type Row,
  sessionCard,
  startOf,
  type Status,
  toCard,
} from "./cards.ts";
import { useOpenSettings } from "./FeatureSettingsDialog.tsx";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { useOpenRename } from "./RenameSession.tsx";
import { Item, NewRow, selects } from "./Row.tsx";
import { SessionView } from "../views.ts";
import { usePendingAction } from "../writes/store.ts";

const styles = stylex.create({
  empty: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/** The workspace and the sessions' list, as the navigation reads them. */
type Data = ReturnType<typeof useNavigation>;

/** A count at a row's end: seen, and left out of the row's name, which its visible label starts. */
const count = (n: number) => <Badge aria-hidden label={String(n)} variant="neutral" />;

/** The inbox's row, with its notes' count once read. */
function InboxCount() {
  const inbox = useInbox();
  return count(inbox?.count ?? 0);
}

/**
 * Where a card's status leads: what the human must do while it needs them, the page asking it for a
 * gate or the feature's page for a problem; its session otherwise.
 */
function statusPath(feature: Feature, status: Status) {
  if (!needsYou(status)) {
    return sessionPath(feature.folder);
  }
  if (feature.problems.length > 0) {
    return `/f/${feature.folder}`;
  }
  return feature.step.waitsOn === "human" ? waiting(feature).href : sessionPath(feature.folder);
}

/** A feature's or a change's card, with the lines its branch changed once read. */
function FeatureCard({
  feature,
  pathname,
  row,
}: {
  feature: Feature;
  pathname: string;
  row: Row | undefined;
}) {
  const here = useRepoPath();
  const settings = useOpenSettings();
  const to = `/f/${feature.folder}`;
  const card = (item: CardItem) => (
    <ItemCard
      href={here(to)}
      isSelected={selects(pathname, to)}
      item={item}
      onOpen={() => navigate(here(to))}
      onSettings={() => settings(feature)}
      onStatus={() => navigate(here(statusPath(feature, item.status)))}
    />
  );
  const base = toCard(feature, row);
  // What a button just started for it, until the server's status for it changes.
  const pending = usePendingAction(feature.folder, `${base.status.status} ${base.status.label}`);
  const item = pending === undefined ? base : { ...base, pending };
  return (
    <Suspense fallback={card(item)}>
      <WithChanges folder={feature.folder} item={item} render={card} />
    </Suspense>
  );
}

/** The card with its branch's lines added and removed, when it changed any. */
function WithChanges({
  folder,
  item,
  render,
}: {
  folder: string;
  item: CardItem;
  render: (item: CardItem) => React.ReactNode;
}) {
  const changes = useBranchChanges(folder)?.changes;
  return render(
    changes && (changes.added > 0 || changes.removed > 0)
      ? { ...item, changes: { added: changes.added, removed: changes.removed } }
      : item,
  );
}

/** The features a search shows: those whose session it found, or whose name, slug, or title holds it. */
function matching(
  features: Array<Feature>,
  byFolder: Map<string, Row>,
  found: Map<string, Row> | undefined,
  query: string,
) {
  if (!found) {
    return features;
  }
  const needle = query.toLowerCase();
  return features.filter((feature) => {
    const row = byFolder.get(feature.folder);
    return (
      (row && found.has(row.id)) ||
      [feature.title, feature.slug, feature.label ?? ""].some((text) =>
        text.toLowerCase().includes(needle),
      )
    );
  });
}

/** A card of the list: a feature or a change, or a session without a workflow. */
type Entry =
  | { feature: Feature; kind: "feature"; row: Row | undefined; start: string; status: Status }
  | { kind: "session"; row: Row; start: string; status: Status };

/** A session's card: its "…" renames it, and archives it or brings it back. */
function SessionCard({ pathname, row }: { pathname: string; row: Row }) {
  const here = useRepoPath();
  const fate = useFateClient();
  const rename = useOpenRename();
  const to = sessionIdPath(row.id);
  return (
    <ItemCard
      actions={[
        { label: "Rename", onClick: () => rename(row) },
        {
          label: row.archived ? "Unarchive" : "Archive",
          onClick: () =>
            void fate.mutations.session.archive({
              input: { archived: !row.archived, session: row.id },
              view: SessionView,
            }),
        },
      ]}
      href={here(to)}
      isSelected={selects(pathname, to)}
      item={sessionCard(row)}
      onOpen={() => navigate(here(to))}
    />
  );
}

/** An entry's card, by its kind. */
function EntryCard({ entry, pathname }: { entry: Entry; pathname: string }) {
  return entry.kind === "feature" ? (
    <FeatureCard feature={entry.feature} pathname={pathname} row={entry.row} />
  ) : (
    <SessionCard pathname={pathname} row={entry.row} />
  );
}

/**
 * The Sessions section: "＋ New" outside a search, every session, change, and feature in flight,
 * oldest started first, then the Claude allowance.
 */
function Sessions({
  entries,
  pathname,
  searching,
}: {
  entries: Array<Entry>;
  pathname: string;
  searching: boolean;
}) {
  if (searching && entries.length === 0) {
    return null;
  }
  return (
    <SideNavSection title="Sessions">
      {!searching && <NewRow label="New" path="/new" pathname={pathname} />}
      {entries.map((entry) => (
        <EntryCard
          entry={entry}
          key={entry.kind === "feature" ? entry.feature.folder : entry.row.id}
          pathname={pathname}
        />
      ))}
      {!searching && <Allowance />}
    </SideNavSection>
  );
}

/**
 * The flow's rows: the inbox and the priorities, with their counts and their ＋. Now counts its
 * entries whose feature or change does not run, as the priorities page does.
 */
function Flow({ data, pathname }: { data: Data; pathname: string }) {
  const running = new Set(
    (data.workspace?.features ?? []).filter(inFlight).map((feature) => feature.folder),
  );
  const now = (data.workspace?.priorities ?? []).filter(
    (entry) => entry.section === "now" && !(entry.feature && running.has(entry.feature)),
  ).length;
  return (
    <>
      <Item
        actions={<AddNoteButton />}
        endContent={
          // A repository without `specs/` has no inbox to count.
          data.workspace?.noSpecs ? undefined : (
            <Suspense fallback={null}>
              <InboxCount />
            </Suspense>
          )
        }
        label="Inbox"
        pathname={pathname}
        to="/inbox"
      />
      <Item
        actions={<AddPriorityButton />}
        endContent={count(now)}
        label="Priorities"
        pathname={pathname}
        to="/priorities"
      />
    </>
  );
}

/**
 * The list's entries: the features and changes in flight, each with its most urgent session's row,
 * and the sessions without a workflow. Outside a search, an archived session is left out, and a
 * session read to its end is done, in the Done area, unless it is `kept`, open since before; a
 * search lists every session it finds.
 */
function entriesOf(
  data: Data,
  { found, kept, query }: { found: Map<string, Row> | undefined; kept?: string; query: string },
) {
  const rows = data.sessionList?.rows ?? [];
  const bySession = new Map(rows.map((row) => [row.id, row]));
  // A session found that the list leaves out, past its last row, shows as the search read it.
  const all = [...rows, ...[...(found?.values() ?? [])].filter((row) => !bySession.has(row.id))];
  // The rows come what needs the human first: a folder's first is its most urgent.
  const byFolder = new Map<string, Row>();
  for (const row of all) {
    if (row.folder && !byFolder.has(row.folder)) {
      byFolder.set(row.folder, row);
    }
  }
  const features = matching(
    (data.workspace?.features ?? []).filter(inFlight),
    byFolder,
    found,
    query,
  );
  const sessions = all.filter((row) => row.folder === null && (!found || found.has(row.id)));
  const entries: Array<Entry> = [
    ...features.map((feature) => {
      const row = byFolder.get(feature.folder);
      return {
        feature,
        kind: "feature" as const,
        row,
        start: startOf(feature, all),
        status: featureStatus(feature, row),
      };
    }),
    ...sessions
      .filter((row) => found || (!row.archived && (!row.done || row.id === kept)))
      .map((row) => ({
        kind: "session" as const,
        row,
        start: row.startedAt,
        status: { label: row.statusLabel, status: row.status },
      })),
  ];
  return entries;
}

/**
 * The navigation's rows. `found`, during a search, holds the sessions found, by ID: Home, the
 * flow's rows, and "＋ New" are then hidden.
 */
function Rows({
  data,
  found,
  kept,
  pathname,
  query,
}: {
  data: Data;
  found?: Map<string, Row>;
  kept?: string;
  pathname: string;
  query: string;
}) {
  const entries = entriesOf(data, { found, ...(kept ? { kept } : {}), query });
  if (found && entries.length === 0) {
    return (
      <Text color="secondary" display="block" xstyle={styles.empty}>
        No session matches “{query}”.
      </Text>
    );
  }
  const waiting = byStatus(entries.filter((entry) => needsYou(entry.status)));
  return (
    <>
      {!found && (
        <Item foldedIcon={<Icon icon="uraeda:home" />} label="Home" pathname={pathname} to="/" />
      )}
      {waiting.length > 0 && (
        <SideNavSection title="Needs you">
          {waiting.map((entry) => (
            <EntryCard
              entry={entry}
              key={entry.kind === "feature" ? entry.feature.folder : entry.row.id}
              pathname={pathname}
            />
          ))}
        </SideNavSection>
      )}
      {!found && <Flow data={data} pathname={pathname} />}
      <Sessions
        entries={byStart(entries.filter((entry) => !needsYou(entry.status)))}
        pathname={pathname}
        searching={!!found}
      />
    </>
  );
}

/** The sessions a search found, by their IDs. */
function Found({ data, pathname, query }: { data: Data; pathname: string; query: string }) {
  const search = useSessionSearch(query);
  const found = new Map((search?.rows ?? []).map((row) => [row.id, row]));
  return <Rows data={data} found={found} pathname={pathname} query={query} />;
}

/**
 * The navigation's rows below its search; the folded navigation has no search to filter them.
 * `kept` is the session whose page is open since before it was done, which stays in the list.
 */
export function Sidebar({
  kept,
  pathname,
  query,
  sessionList,
  workspace,
}: Data & { kept?: string | undefined; pathname: string; query: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const data = { sessionList, workspace };
  return query && !isCollapsed ? (
    <Found data={data} pathname={pathname} query={query} />
  ) : (
    <Rows data={data} {...(kept ? { kept } : {})} pathname={pathname} query="" />
  );
}
