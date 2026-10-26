// The shell's panes of work: Needs you, then the sessions without a workflow, then the features and
// changes in progress, each the oldest started first, then the latest done items. The column draws
// them under Navigate, as many done items as fit; the phone's sessions page draws them as its own.
// During a search, only the cards it found.
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef } from "react";
import { Pane, type PaneTone } from "../layout/Pane.tsx";
import { currentEntry, navigate, useLocalPath, useRepoPath } from "../routes.tsx";
import { useNavigation, useSessionSearch } from "../sessionData.ts";
import { byStart, byStatus, needsYou, type Row } from "../sidebar/cards.ts";
import { EntryCard } from "../sidebar/Cards.tsx";
import { DoneArea } from "../sidebar/DoneArea.tsx";
import { doneRows, useKeptSession } from "../sidebar/done.ts";
import { type Data, type Entry, entriesOf, entryKey } from "../sidebar/entries.ts";
import { useColumnFold } from "./fold.ts";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  rail: {
    // Folded: a group of icons under a line, in the rail's column.
    alignItems: "center",
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    paddingBlock: spacingVars["--spacing-2"],
  },
});

/** The page's path as the shell selects its rows by it. */
export function useShellPath() {
  const path = useLocalPath();
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  return path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
}

/**
 * What the shell's panes read: the workspace and the sessions, the page's path, and the session
 * kept in the list while its page is open.
 */
function useShellData() {
  const data = useNavigation();
  const pathname = useShellPath();
  const kept = useKeptSession(data.sessionList?.rows ?? [], pathname);
  return { data, kept, pathname };
}

/**
 * A pane of the shell, titled; folded to the rail, its icons alone, under a line. Left out, empty,
 * during a search or in the rail; else it says it is empty, in `empty`.
 */
export function ShellPane({
  children,
  count,
  empty,
  isHiddenEmpty = false,
  title,
  tone,
}: {
  children?: ReactNode;
  count?: number;
  empty?: string;
  isHiddenEmpty?: boolean;
  title: string;
  tone?: PaneTone;
}) {
  const { isFolded } = useColumnFold();
  const isEmpty = count === 0;
  if (isEmpty && (isHiddenEmpty || isFolded)) {
    return null;
  }
  if (isFolded) {
    return <div {...stylex.props(styles.rail)}>{children}</div>;
  }
  return (
    <Pane
      isGroup
      title={title}
      {...(count === undefined ? {} : { count })}
      {...(tone ? { tone } : {})}
    >
      {isEmpty && empty ? <Empty isInset>{empty}</Empty> : children}
    </Pane>
  );
}

/** The cards of a pane. */
function Cards({ entries, pathname }: { entries: Array<Entry>; pathname: string }) {
  return entries.map((entry) => (
    <EntryCard entry={entry} key={entryKey(entry)} pathname={pathname} />
  ));
}

/** The panes' cards: what needs the human, the sessions, and the features and changes. */
function Work({
  data,
  found,
  kept,
  pathname,
  query,
}: {
  data: Data;
  found?: Map<string, Row>;
  kept?: string | undefined;
  pathname: string;
  query: string;
}) {
  const entries = entriesOf(data, { found, ...(kept ? { kept } : {}), query });
  if (found && entries.length === 0) {
    return <Empty isInset>No session matches “{query}”.</Empty>;
  }
  const waiting = byStatus(entries.filter((entry) => needsYou(entry.status)));
  const rest = byStart(entries.filter((entry) => !needsYou(entry.status)));
  const sessions = rest.filter((entry) => entry.kind === "session");
  const progress = rest.filter((entry) => entry.kind === "feature");
  return (
    <>
      <ShellPane count={waiting.length} isHiddenEmpty title="Needs you" tone="attention">
        <Cards entries={waiting} pathname={pathname} />
      </ShellPane>
      <ShellPane
        count={sessions.length}
        empty="No session running."
        isHiddenEmpty={!!found}
        title="Sessions"
      >
        <Cards entries={sessions} pathname={pathname} />
      </ShellPane>
      <ShellPane
        count={progress.length}
        empty="Nothing in progress."
        isHiddenEmpty={!!found}
        title="In progress"
      >
        <Cards entries={progress} pathname={pathname} />
      </ShellPane>
    </>
  );
}

/** The cards a search found, by their IDs. */
function Found({ data, pathname, query }: { data: Data; pathname: string; query: string }) {
  const search = useSessionSearch(query);
  const found = new Map((search?.rows ?? []).map((row) => [row.id, row]));
  return <Work data={data} found={found} pathname={pathname} query={query} />;
}

/**
 * The panes: `before` first, like the column's Navigate, then the work, then Done. In the column,
 * `isFitted`, Done shows as many items as the room the rows above leave. `query`, during a search,
 * shows the cards it found alone, without `before`.
 */
export function ShellPanes({
  before,
  isFitted = false,
  query,
}: {
  before?: ReactNode;
  isFitted?: boolean;
  query: string;
}) {
  const { data, kept, pathname } = useShellData();
  const here = useRepoPath();
  const { isFolded } = useColumnFold();
  const rows = useRef<HTMLDivElement>(null);
  const searching = query !== "" && !isFolded;
  return (
    <>
      <div ref={rows}>
        {!searching && before}
        {searching ? (
          <Found data={data} pathname={pathname} query={query} />
        ) : (
          <Work data={data} kept={kept} pathname={pathname} query="" />
        )}
      </div>
      <DoneArea
        allHref={here("/#done")}
        {...(isFitted ? { content: rows } : {})}
        onOpen={(href) => navigate(href)}
        rows={doneRows(data.workspace?.features ?? [], data.sessionList?.rows ?? [], {
          here,
          ...(kept ? { kept } : {}),
          pathname,
        })}
      />
    </>
  );
}
