// The sidebar's rows below its search, in Uraeda's flow: Home; what needs the human; the inbox and
// the priorities with their counts; the changes and the features in flight, each in the workflow's
// order; the Claude allowance; then the chats. During a search, only the cards and chats it found.
import { Badge } from "@astryxdesign/core/Badge";
import { SideNavItem, SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { type useNavigation, useBranchChanges, useInbox, useSessionSearch } from "../data.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { AddNoteButton, AddPriorityButton } from "../SidebarAdd.tsx";
import { Allowance } from "./Allowance.tsx";
import {
  byStatus,
  byStep,
  type Feature,
  featureStatus,
  inFlight,
  needsYou,
  type Row,
  type Status,
  toCard,
} from "./cards.ts";
import { useOpenSettings } from "./FeatureSettingsDialog.tsx";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { Chat, Item, NewRow, selects } from "./Row.tsx";
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

/** A feature's or a change's card, with the lines its branch changed once read. */
function FeatureCard({
  feature,
  pathname,
  row,
  tagged = false,
}: {
  feature: Feature;
  pathname: string;
  row: Row | undefined;
  tagged?: boolean;
}) {
  const here = useRepoPath();
  const settings = useOpenSettings();
  const to = `/f/${feature.folder}`;
  const card = (item: CardItem) => (
    <ItemCard
      hasChangeTag={tagged}
      href={here(to)}
      isSelected={selects(pathname, to)}
      item={item}
      onOpen={() => navigate(here(to))}
      onSettings={() => settings(feature)}
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

/** A section of cards, drawn only when it has one, or a row to add one. */
function Cards({
  add,
  after,
  byFolder,
  features,
  pathname,
  tagged,
  title,
}: {
  add?: React.ReactNode;
  /** What closes the section, like the Claude allowance under the features. */
  after?: React.ReactNode;
  byFolder: Map<string, Row>;
  features: Array<Feature>;
  pathname: string;
  tagged?: boolean;
  title: string;
}) {
  if (features.length === 0 && !add && !after) {
    return null;
  }
  return (
    <SideNavSection title={title}>
      {add}
      {features.map((feature) => (
        <FeatureCard
          feature={feature}
          key={feature.folder}
          pathname={pathname}
          row={byFolder.get(feature.folder)}
          {...(tagged ? { tagged } : {})}
        />
      ))}
      {after}
    </SideNavSection>
  );
}

/** The chats' section: "New chat" outside a search, the open chats, then the archived ones. */
function Chats({
  chats,
  pathname,
  searching,
}: {
  chats: Array<Row>;
  pathname: string;
  searching: boolean;
}) {
  if (searching && chats.length === 0) {
    return null;
  }
  const open = chats.filter((row) => !row.archived);
  const archived = chats.filter((row) => row.archived);
  return (
    <SideNavSection title="Chats">
      {!searching && <NewRow label="New chat" path="/chats/new" pathname={pathname} />}
      {open.map((row) => (
        <Chat key={row.id} pathname={pathname} row={row} />
      ))}
      {archived.length > 0 && <ArchivedChats pathname={pathname} rows={archived} />}
    </SideNavSection>
  );
}

/** Archived chats stay hidden until asked for, as archiving hides a chat. */
function ArchivedChats({ pathname, rows }: { pathname: string; rows: Array<Row> }) {
  return (
    <SideNavItem collapsible={{ defaultIsCollapsed: true }} label="Archived">
      {rows.map((row) => (
        <Chat key={row.id} pathname={pathname} row={row} />
      ))}
    </SideNavItem>
  );
}

/** The flow's rows: the inbox and the priorities, with their counts and their ＋. */
function Flow({ data, pathname }: { data: Data; pathname: string }) {
  const now = (data.workspace?.priorities ?? []).filter((entry) => entry.section === "now").length;
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
 * The navigation's rows. `found`, during a search, holds the sessions found, by ID: Home, the
 * flow's rows, and New change are then hidden.
 */
function Rows({
  data,
  found,
  pathname,
  query,
}: {
  data: Data;
  found?: Map<string, Row>;
  pathname: string;
  query: string;
}) {
  const rows = data.sessionList?.rows ?? [];
  const bySession = new Map(rows.map((row) => [row.id, row]));
  // A session found that the list leaves out, past its last row, shows as the search read it.
  const all = [...rows, ...[...(found?.values() ?? [])].filter((row) => !bySession.has(row.id))];
  const byFolder = new Map(all.flatMap((row) => (row.folder ? [[row.folder, row]] : [])));
  const features = matching(
    (data.workspace?.features ?? []).filter(inFlight),
    byFolder,
    found,
    query,
  );
  const statuses = new Map<string, Status>(
    features.map((feature) => [
      feature.folder,
      featureStatus(feature, byFolder.get(feature.folder)),
    ]),
  );
  const waiting = byStatus(
    features.filter((feature) => needsYou(statuses.get(feature.folder)!)),
    statuses,
  );
  const rest = features.filter((feature) => !needsYou(statuses.get(feature.folder)!));
  const chats = all.filter((row) => row.folder === null && (!found || found.has(row.id)));
  if (found && features.length === 0 && chats.length === 0) {
    return (
      <Text color="secondary" display="block" xstyle={styles.empty}>
        No session matches “{query}”.
      </Text>
    );
  }
  const section = { byFolder, pathname };
  return (
    <>
      {!found && (
        <Item
          foldedIcon={<span aria-hidden="true">⌂</span>}
          label="Home"
          pathname={pathname}
          to="/"
        />
      )}
      <Cards {...section} features={waiting} tagged title="Needs you" />
      {!found && <Flow data={data} pathname={pathname} />}
      <Cards
        {...section}
        {...(found
          ? {}
          : { add: <NewRow label="New change" path="/changes/new" pathname={pathname} /> })}
        features={byStep(rest.filter((feature) => feature.kind === "change"))}
        title="Changes"
      />
      <Cards
        {...section}
        {...(found ? {} : { after: <Allowance /> })}
        features={byStep(rest.filter((feature) => feature.kind !== "change"))}
        title="Features"
      />
      <Chats chats={chats} pathname={pathname} searching={!!found} />
    </>
  );
}

/** The sessions a search found, by their IDs. */
function Found({ data, pathname, query }: { data: Data; pathname: string; query: string }) {
  const search = useSessionSearch(query);
  const found = new Map((search?.rows ?? []).map((row) => [row.id, row]));
  return <Rows data={data} found={found} pathname={pathname} query={query} />;
}

/** The navigation's rows below its search; the folded navigation has no search to filter them. */
export function Sidebar({
  pathname,
  query,
  sessionList,
  workspace,
}: Data & { pathname: string; query: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const data = { sessionList, workspace };
  return query && !isCollapsed ? (
    <Found data={data} pathname={pathname} query={query} />
  ) : (
    <Rows data={data} pathname={pathname} query="" />
  );
}
