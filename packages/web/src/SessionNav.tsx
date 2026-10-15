// The sidebar's features and chats, each with its session's status, and the search over them.
import { SideNavItem, SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { startTransition, useEffect, useState } from "react";
import type { SessionStatus } from "uraeda-server/fate";
import { AgentsAtWork } from "./AgentsAtWork.tsx";
import { type useNavigation, useSessionSearch } from "./data.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import {
  type Feature,
  FeatureRow,
  Item,
  type Row,
  type Status,
  Subagents,
} from "./SessionNavRows.tsx";
import { AddNoteButton, AddPriorityButton } from "./SidebarAdd.tsx";

/** How long typing must stop before a search is read (R2). */
const SEARCH_DELAY = 200;

/** The order of statuses within a group: what needs the human first. */
const STATUS_ORDER: Record<SessionStatus, number> = {
  attention: 1,
  idle: 4,
  "needs-you": 0,
  unread: 2,
  working: 3,
};

const styles = stylex.create({
  empty: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/** The workspace and the sessions' list, as the navigation reads them. */
type Data = ReturnType<typeof useNavigation>;

/**
 * The search's text as typed, and the query read from it once typing stops: the list keeps showing
 * the previous result while the next one loads.
 */
export function useSessionQuery() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => startTransition(() => setQuery(text.trim())), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [text]);
  return { query, setText, text };
}

/** The search field at the top of the navigation; the folded navigation has no room for it. */
export function SearchField({
  onChange,
  text,
}: {
  onChange: (text: string) => void;
  text: string;
}) {
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return null;
  }
  return (
    <TextInput
      hasClear
      isLabelHidden
      label="Search sessions"
      onChange={onChange}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
          onChange("");
        }
      }}
      placeholder="Search sessions"
      role="searchbox"
      startIcon="search"
      value={text}
    />
  );
}

/**
 * A feature's status: its session's, or, without a session, "Needs you" while its step waits on
 * the human, and idle otherwise.
 */
function featureStatus(feature: Feature, row: Row | undefined): Status {
  if (row) {
    return { label: row.statusLabel, status: row.status };
  }
  return feature.step.waitsOn === "human"
    ? { label: "Needs you", status: "needs-you" }
    : { label: "Idle", status: "idle" };
}

/** A chat's row, and its sub-agents'. */
function Chat({ pathname, row }: { pathname: string; row: Row }) {
  const to = `/chats/${row.id}`;
  return (
    <>
      <Item
        label={row.title}
        pathname={pathname}
        status={{ label: row.statusLabel, status: row.status }}
        to={to}
      />
      <Subagents row={row} to={to} />
    </>
  );
}

/**
 * The features a search shows: those whose session it found, or whose title or slug holds the
 * query.
 */
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
      feature.title.toLowerCase().includes(needle) ||
      feature.slug.toLowerCase().includes(needle)
    );
  });
}

/**
 * The feature groups, each sorted by status: what waits on the human, what agents work on, and
 * what is done.
 */
function grouped(
  features: Array<Feature>,
  statuses: Map<string, Status>,
): Array<[string, Array<Feature>]> {
  const sorted = (list: Array<Feature>) =>
    [...list].sort(
      (a, b) =>
        STATUS_ORDER[statuses.get(a.folder)!.status] - STATUS_ORDER[statuses.get(b.folder)!.status],
    );
  return [
    ["Waiting on you", sorted(features.filter((f) => f.step.waitsOn === "human"))],
    [
      "Agents at work",
      sorted(features.filter((f) => f.step.waitsOn === "agent" && f.step.name !== "none")),
    ],
    // Latest first within a status: a folder's name starts with its date.
    [
      "Done",
      sorted(
        features
          .filter((f) => f.step.name === "done")
          .sort((a, b) => b.folder.localeCompare(a.folder)),
      ),
    ],
  ];
}

/** A group of features, under its title, drawn only when it has one. */
function FeatureGroup({
  byFolder,
  list,
  pathname,
  statuses,
  title,
}: {
  byFolder: Map<string, Row>;
  list: Array<Feature>;
  pathname: string;
  statuses: Map<string, Status>;
  title: string;
}) {
  const rows = list.map((feature) => (
    <FeatureRow
      feature={feature}
      key={feature.folder}
      pathname={pathname}
      row={byFolder.get(feature.folder)}
      status={statuses.get(feature.folder)!}
    />
  ));
  return title === "Agents at work" ? (
    <AgentsAtWork empty={list.length === 0}>{rows}</AgentsAtWork>
  ) : list.length > 0 ? (
    <SideNavSection title={title}>{rows}</SideNavSection>
  ) : null;
}

/** A "＋" row opening a new item's page at `path`, like "New change" or "New chat". */
function NewRow({ label, path, pathname }: { label: string; path: string; pathname: string }) {
  const here = useRepoPath();
  return (
    <SideNavItem
      href={here(path)}
      icon={<span aria-hidden="true">＋</span>}
      isSelected={pathname === path}
      label={label}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(path));
      }}
    />
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
  const open = chats.filter((row) => !row.archived);
  const archived = chats.filter((row) => row.archived);
  if (searching && chats.length === 0) {
    return null;
  }
  return (
    <SideNavSection title="Chats">
      {!searching && <NewRow label="New chat" path="/chats/new" pathname={pathname} />}
      {open.map((row) => (
        <Chat key={row.id} pathname={pathname} row={row} />
      ))}
      {archived.length > 0 && (
        // Archived chats stay hidden until asked for, as archiving hides a chat.
        <SideNavItem collapsible={{ defaultIsCollapsed: true }} label="Archived">
          {archived.map((row) => (
            <Chat key={row.id} pathname={pathname} row={row} />
          ))}
        </SideNavItem>
      )}
    </SideNavSection>
  );
}

/**
 * The navigation's sessions: the feature groups, each sorted by status, then the chats, with "New
 * chat" and the archived ones. `found`, during a search, holds the sessions found, by ID.
 */
function Sessions({
  data: { sessionList, workspace },
  found,
  pathname,
  query,
}: {
  data: Data;
  found?: Map<string, Row>;
  pathname: string;
  query: string;
}) {
  // The live list gives statuses, also of the sessions a search found, which is not live.
  const rows = sessionList?.rows ?? [];
  const bySession = new Map(rows.map((row) => [row.id, row]));
  // A session found that the list leaves out, past its last row, shows as the search read it.
  const all = [...rows, ...[...(found?.values() ?? [])].filter((row) => !bySession.has(row.id))];
  const byFolder = new Map(all.flatMap((row) => (row.folder ? [[row.folder, row]] : [])));
  const features = matching(workspace?.features ?? [], byFolder, found, query);
  const statuses = new Map(
    features.map((feature) => [
      feature.folder,
      featureStatus(feature, byFolder.get(feature.folder)),
    ]),
  );
  const groups = grouped(features, statuses);
  // The list's order: what needs the human first, then the last updated.
  const chats = all.filter((row) => row.folder === null && (!found || found.has(row.id)));
  const group = ([title, list]: [string, Array<Feature>]) => (
    <FeatureGroup
      byFolder={byFolder}
      key={title}
      list={list}
      pathname={pathname}
      statuses={statuses}
      title={title}
    />
  );

  if (found && features.length === 0 && chats.length === 0) {
    return (
      <Text color="secondary" display="block" xstyle={styles.empty}>
        No session matches “{query}”.
      </Text>
    );
  }
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
      {!found && (
        <Item
          actions={<AddPriorityButton />}
          label="Priorities"
          pathname={pathname}
          to="/priorities"
        />
      )}
      {!found && <Item actions={<AddNoteButton />} label="Inbox" pathname={pathname} to="/inbox" />}
      {/* "New change", after "Inbox": a composer that starts a change. */}
      {!found && <NewRow label="New change" path="/changes/new" pathname={pathname} />}
      {groups.slice(0, 2).map(group)}
      <Chats chats={chats} pathname={pathname} searching={!!found} />
      {groups.slice(2).map(group)}
    </>
  );
}

/** The sessions a search found, by their IDs. */
function Found({ data, pathname, query }: { data: Data; pathname: string; query: string }) {
  const search = useSessionSearch(query);
  const found = new Map((search?.rows ?? []).map((row) => [row.id, row]));
  return <Sessions data={data} found={found} pathname={pathname} query={query} />;
}

/**
 * The navigation's rows below its search: Home, Priorities, Inbox, New change, the features by
 * what they wait for, and the chats; during a search, only the features and chats it found.
 */
export function SessionNav({
  pathname,
  query,
  sessionList,
  workspace,
}: Data & { pathname: string; query: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const data = { sessionList, workspace };
  // The folded navigation hides the search field: its rows are not filtered.
  return query && !isCollapsed ? (
    <Found data={data} pathname={pathname} query={query} />
  ) : (
    <Sessions data={data} pathname={pathname} query="" />
  );
}
