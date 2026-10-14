// The sidebar's features and chats, each with its session's status, and the search over them.
import { SideNavItem, SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, startTransition, useEffect, useState } from "react";
import type { SessionStatus } from "uraeda-server/fate";
import { type useNavigation, useSessionSearch } from "./data.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { StatusMark } from "./StatusMark.tsx";

/** How long typing must stop before a search is read (R2). */
const SEARCH_DELAY = 200;

/** The order of statuses within a group: what needs the human first. */
const STATUS_ORDER: Record<SessionStatus, number> = {
  failed: 1,
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
  subagent: {
    // A sub-agent's row, under its session's.
    paddingInlineStart: spacingVars["--spacing-6"],
  },
});

/** The workspace and the sessions' list, as the navigation reads them. */
type Data = ReturnType<typeof useNavigation>;
type Row = NonNullable<Data["sessionList"]>["rows"][number];
type Feature = NonNullable<Data["workspace"]>["features"][number];

/** A status and its label. */
type Status = { label: string; status: SessionStatus };

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

/** A row that opens a page, selected while the page or one of its own pages is open. */
function Item({
  foldedIcon,
  label,
  pathname,
  status,
  to,
}: {
  /** Its icon in the folded navigation, which shows only rows with one. */
  foldedIcon?: ReactNode;
  label: string;
  pathname: string;
  status?: Status;
  to: string;
}) {
  const here = useRepoPath();
  const { isCollapsed } = useSideNavCollapse();
  return (
    <SideNavItem
      href={here(to)}
      isSelected={pathname === to || (to !== "/" && pathname.startsWith(`${to}/`))}
      label={label}
      {...(foldedIcon && isCollapsed && !status ? { icon: foldedIcon } : {})}
      {...(status
        ? {
            icon: <StatusMark label={status.label} status={status.status} />,
            // The status is read with the title, also when the folded navigation shows only the dot.
            "aria-label": `${label}, ${status.label}`,
          }
        : {})}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
    />
  );
}

/** The rows of a session's running sub-agents, under its own, each opening the session. */
function Subagents({ row, to }: { row: Row | undefined; to: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const here = useRepoPath();
  if (!row || isCollapsed) {
    return null;
  }
  return row.subagents.map((subagent) => (
    <SideNavItem
      aria-label={`${subagent.description}, Working`}
      href={here(to)}
      icon={<StatusMark label="Working" small status="working" />}
      key={subagent.id}
      label={subagent.description}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
      xstyle={styles.subagent}
    />
  ));
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
 * The navigation's sessions: the feature groups, each sorted by status, then the chats, with "New
 * chat" and the archived ones. `found`, during a search, holds the sessions found, by ID.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the search's filter in a function, and each group in a component
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
  const here = useRepoPath();
  // The live list gives statuses, also of the sessions a search found, which is not live.
  const rows = sessionList?.rows ?? [];
  const bySession = new Map(rows.map((row) => [row.id, row]));
  // A session found that the list leaves out, past its last row, shows as the search read it.
  const all = [...rows, ...[...(found?.values() ?? [])].filter((row) => !bySession.has(row.id))];
  const byFolder = new Map(all.flatMap((row) => (row.folder ? [[row.folder, row]] : [])));
  const needle = query.toLowerCase();
  const features = (workspace?.features ?? []).filter((feature) => {
    if (!found) {
      return true;
    }
    const row = byFolder.get(feature.folder);
    return (row && found.has(row.id)) || feature.title.toLowerCase().includes(needle);
  });
  const statuses = new Map(
    features.map((feature) => [
      feature.folder,
      featureStatus(feature, byFolder.get(feature.folder)),
    ]),
  );
  const sorted = (list: Array<Feature>) =>
    [...list].sort(
      (a, b) =>
        STATUS_ORDER[statuses.get(a.folder)!.status] - STATUS_ORDER[statuses.get(b.folder)!.status],
    );
  const groups: Array<[string, Array<Feature>]> = [
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
  // The list's order: what needs the human first, then the last updated.
  const chats = all.filter((row) => row.folder === null && (!found || found.has(row.id)));
  const open = chats.filter((row) => !row.archived);
  const archived = chats.filter((row) => row.archived);
  const group = ([title, list]: [string, Array<Feature>]) =>
    list.length > 0 && (
      <SideNavSection key={title} title={title}>
        {list.map((feature) => (
          <FeatureRow
            feature={feature}
            key={feature.folder}
            pathname={pathname}
            row={byFolder.get(feature.folder)}
            status={statuses.get(feature.folder)!}
          />
        ))}
      </SideNavSection>
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
      {!found && <Item label="Priorities" pathname={pathname} to="/priorities" />}
      {groups.slice(0, 2).map(group)}
      {(!found || chats.length > 0) && (
        <SideNavSection title="Chats">
          {!found && (
            <SideNavItem
              href={here("/chats/new")}
              icon={<span aria-hidden="true">＋</span>}
              isSelected={pathname === "/chats/new"}
              label="New chat"
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                navigate(here("/chats/new"));
              }}
            />
          )}
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
      )}
      {groups.slice(2).map(group)}
    </>
  );
}

/** A feature's row, with its session's status, and its running sub-agents under it. */
function FeatureRow({
  feature,
  pathname,
  row,
  status,
}: {
  feature: Feature;
  pathname: string;
  row: Row | undefined;
  status: Status;
}) {
  // A finished feature with nothing to show draws no mark: an idle ring there reads as unfinished.
  const finished = feature.step.name === "done" && status.status === "idle";
  return (
    <>
      <Item
        label={feature.title}
        pathname={pathname}
        status={finished ? undefined : status}
        to={`/f/${feature.folder}`}
      />
      <Subagents row={row} to={sessionPath(feature.folder)} />
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
 * The navigation's rows below its search: Home, Priorities, the features by what they wait for,
 * and the chats; during a search, only the features and chats it found.
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
