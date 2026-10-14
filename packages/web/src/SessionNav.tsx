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
  "needs-you": 0,
  failed: 1,
  unread: 2,
  working: 3,
  idle: 4,
};

const styles = stylex.create({
  // A sub-agent's row, under its session's.
  subagent: {
    paddingInlineStart: spacingVars["--spacing-6"],
  },
  empty: {
    paddingInline: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-3"],
  },
});

/** The workspace and the sessions' list, as the navigation reads them. */
type Data = ReturnType<typeof useNavigation>;
type Row = NonNullable<Data["sessionList"]>["rows"][number];
type Feature = NonNullable<Data["workspace"]>["features"][number];

/** A status and its label. */
type Status = { status: SessionStatus; label: string };

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
  return { text, setText, query };
}

/** The search field at the top of the navigation; the folded navigation has no room for it. */
export function SearchField({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return null;
  }
  return (
    <TextInput
      label="Search sessions"
      isLabelHidden
      placeholder="Search sessions"
      role="searchbox"
      startIcon="search"
      hasClear
      value={text}
      onChange={onChange}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
          onChange("");
        }
      }}
    />
  );
}

/** A row that opens a page, selected while the page or one of its own pages is open. */
function Item({
  label,
  to,
  pathname,
  status,
  foldedIcon,
}: {
  label: string;
  to: string;
  pathname: string;
  status?: Status;
  /** Its icon in the folded navigation, which shows only rows with one. */
  foldedIcon?: ReactNode;
}) {
  const here = useRepoPath();
  const { isCollapsed } = useSideNavCollapse();
  return (
    <SideNavItem
      label={label}
      href={here(to)}
      isSelected={pathname === to || (to !== "/" && pathname.startsWith(`${to}/`))}
      {...(foldedIcon && isCollapsed && !status ? { icon: foldedIcon } : {})}
      {...(status
        ? {
            icon: <StatusMark status={status.status} label={status.label} />,
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
      key={subagent.id}
      label={subagent.description}
      aria-label={`${subagent.description}, Working`}
      icon={<StatusMark status="working" label="Working" small />}
      href={here(to)}
      xstyle={styles.subagent}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
    />
  ));
}

/**
 * A feature's status: its session's, or, without a session, "Needs you" while its step waits on
 * the human, and idle otherwise.
 */
function featureStatus(feature: Feature, row: Row | undefined): Status {
  if (row) {
    return { status: row.status, label: row.statusLabel };
  }
  return feature.step.waitsOn === "human"
    ? { status: "needs-you", label: "Needs you" }
    : { status: "idle", label: "Idle" };
}

/** A chat's row, and its sub-agents'. */
function Chat({ row, pathname }: { row: Row; pathname: string }) {
  const to = `/chats/${row.id}`;
  return (
    <>
      <Item
        label={row.title}
        to={to}
        pathname={pathname}
        status={{ status: row.status, label: row.statusLabel }}
      />
      <Subagents row={row} to={to} />
    </>
  );
}

/**
 * The navigation's sessions: the feature groups, each sorted by status, then the chats, with "New
 * chat" and the archived ones. `found`, during a search, holds the sessions found, by ID.
 */
function Sessions({
  data: { workspace, sessionList },
  pathname,
  query,
  found,
}: {
  data: Data;
  pathname: string;
  query: string;
  found?: Map<string, Row>;
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
    ["Done", sorted(features.filter((f) => f.step.name === "done"))],
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
            key={feature.folder}
            feature={feature}
            status={statuses.get(feature.folder)!}
            row={byFolder.get(feature.folder)}
            pathname={pathname}
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
          label="Home"
          to="/"
          pathname={pathname}
          foldedIcon={<span aria-hidden="true">⌂</span>}
        />
      )}
      {!found && <Item label="Priorities" to="/priorities" pathname={pathname} />}
      {groups.slice(0, 2).map(group)}
      {(!found || chats.length > 0) && (
        <SideNavSection title="Chats">
          {!found && (
            <SideNavItem
              label="New chat"
              icon={<span aria-hidden="true">＋</span>}
              href={here("/chats/new")}
              isSelected={pathname === "/chats/new"}
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                navigate(here("/chats/new"));
              }}
            />
          )}
          {open.map((row) => (
            <Chat key={row.id} row={row} pathname={pathname} />
          ))}
          {archived.length > 0 && (
            // Archived chats stay hidden until asked for, as archiving hides a chat.
            <SideNavItem label="Archived" collapsible={{ defaultIsCollapsed: true }}>
              {archived.map((row) => (
                <Chat key={row.id} row={row} pathname={pathname} />
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
  status,
  row,
  pathname,
}: {
  feature: Feature;
  status: Status;
  row: Row | undefined;
  pathname: string;
}) {
  // A finished feature with nothing to show draws no mark: an idle ring there reads as unfinished.
  const finished = feature.step.name === "done" && status.status === "idle";
  return (
    <>
      <Item
        label={feature.title}
        to={`/f/${feature.folder}`}
        pathname={pathname}
        status={finished ? undefined : status}
      />
      <Subagents row={row} to={sessionPath(feature.folder)} />
    </>
  );
}

/** The sessions a search found, by their IDs. */
function Found({ data, pathname, query }: { data: Data; pathname: string; query: string }) {
  const search = useSessionSearch(query);
  const found = new Map((search?.rows ?? []).map((row) => [row.id, row]));
  return <Sessions data={data} pathname={pathname} query={query} found={found} />;
}

/**
 * The navigation's rows below its search: Home, Priorities, the features by what they wait for,
 * and the chats; during a search, only the features and chats it found.
 */
export function SessionNav({
  workspace,
  sessionList,
  pathname,
  query,
}: Data & { pathname: string; query: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const data = { workspace, sessionList };
  // The folded navigation hides the search field: its rows are not filtered.
  return query && !isCollapsed ? (
    <Found data={data} pathname={pathname} query={query} />
  ) : (
    <Sessions data={data} pathname={pathname} query="" />
  );
}
