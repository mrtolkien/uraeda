// The shell's panes of work: Needs you, then the sessions without a workflow, then the features and
// changes in progress, each the oldest started first, then the latest done items. The column draws
// them under Navigate, as many done items as fit; the phone's sessions page draws them as its own.
import { type ReactNode, type RefObject, useRef } from "react";
import { Pane, type PaneTone } from "../layout/Pane.tsx";
import { currentEntry, navigate, useLocalPath, useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { byStart } from "../sidebar/cards.ts";
import { EntryCard } from "../sidebar/Cards.tsx";
import { DoneArea } from "../sidebar/DoneArea.tsx";
import { doneRows, useKeptSession } from "../sidebar/done.ts";
import { type Data, type Entry, entriesOf, entryKey, splitNeedsYou } from "../sidebar/entries.ts";
import { Empty } from "../layout/Empty.tsx";

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

/** A pane of the shell, titled. Left out, empty, with `isHiddenEmpty`; else it says so, in `empty`. */
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
  const isEmpty = count === 0;
  if (isEmpty && isHiddenEmpty) {
    return null;
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
  kept,
  pathname,
}: {
  data: Data;
  kept?: string | undefined;
  pathname: string;
}) {
  const entries = entriesOf(data, { found: undefined, ...(kept ? { kept } : {}), query: "" });
  const { rest: others, waiting } = splitNeedsYou(entries);
  const rest = byStart(others);
  const sessions = rest.filter((entry) => entry.kind === "session");
  const progress = rest.filter((entry) => entry.kind === "feature");
  return (
    <>
      <ShellPane count={waiting.length} isHiddenEmpty title="Needs you" tone="attention">
        <Cards entries={waiting} pathname={pathname} />
      </ShellPane>
      <ShellPane count={sessions.length} isHiddenEmpty title="Sessions">
        <Cards entries={sessions} pathname={pathname} />
      </ShellPane>
      <ShellPane count={progress.length} empty="Nothing in progress." title="In progress">
        <Cards entries={progress} pathname={pathname} />
      </ShellPane>
    </>
  );
}

/**
 * The shell's Done: what is done, newest first. `content`, in the column, is its rows above it:
 * Done then shows as many items as the room they leave.
 */
export function ShellDone({ content }: { content?: RefObject<HTMLElement | null> }) {
  const { data, kept, pathname } = useShellData();
  const here = useRepoPath();
  return (
    <DoneArea
      {...(content ? { content } : {})}
      onOpen={(href) => navigate(href)}
      rows={doneRows(data.workspace?.features ?? [], data.sessionList?.rows ?? [], {
        here,
        ...(kept ? { kept } : {}),
        pathname,
      })}
    />
  );
}

/**
 * The panes: `before` first, like the column's Navigate, then the work, then Done, unless
 * `hasDone` is false, for a page that draws it apart (`ShellDone`). In the column, `isFitted`,
 * Done shows as many items as the room the rows above leave.
 */
export function ShellPanes({
  before,
  hasDone = true,
  isFitted = false,
}: {
  before?: ReactNode;
  hasDone?: boolean;
  isFitted?: boolean;
}) {
  const { data, kept, pathname } = useShellData();
  const rows = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={rows}>
        {before}
        <Work data={data} kept={kept} pathname={pathname} />
      </div>
      {hasDone && <ShellDone {...(isFitted ? { content: rows } : {})} />}
    </>
  );
}
