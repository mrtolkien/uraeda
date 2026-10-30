// The shell's entries: the features and changes in flight, each with the row of the session its
// status follows, and the sessions without a workflow or at work on what left the flight, which its
// panes split into Needs you, Sessions, and In progress; and the counts the column's rows and the
// phone's tabs show.
import type { useNavigation } from "../sessionData.ts";
import {
  byStatus,
  type Feature,
  inFlight,
  isSessionCard,
  needsYou,
  type Row,
  rowOf,
  startOf,
  type Status,
} from "./cards.ts";

/** The workspace and the sessions' list, as the shell reads them. */
export type Data = ReturnType<typeof useNavigation>;

/** A card of the panes: a feature or a change, or a session without a workflow. */
export type Entry =
  | { feature: Feature; kind: "feature"; row: Row | undefined; start: string; status: Status }
  | { kind: "session"; row: Row; start: string; status: Status };

/**
 * The features a search shows: those with any session it found, or whose name, slug, or title
 * holds it.
 */
function matching(features: Array<Feature>, found: Map<string, Row> | undefined, query: string) {
  if (!found) {
    return features;
  }
  const needle = query.toLowerCase();
  const folders = new Set([...found.values()].map((row) => row.folder));
  return features.filter((feature) => {
    return (
      folders.has(feature.folder) ||
      [feature.title, feature.slug, feature.label ?? ""].some((text) =>
        text.toLowerCase().includes(needle),
      )
    );
  });
}

/**
 * The entries: the features and changes in flight, each with its status, the server's, and the row
 * of the session it follows, and the sessions without a workflow, or at work on a feature or a
 * change no longer in flight. Outside a search, an archived session is left out, and a session read
 * to its end is done, in the Done pane, unless it is `kept`, open since before; a search lists every
 * session it finds.
 */
export function entriesOf(
  data: Data,
  { found, kept, query }: { found: Map<string, Row> | undefined; kept?: string; query: string },
): Array<Entry> {
  const rows = data.sessionList?.rows ?? [];
  const bySession = new Map(rows.map((row) => [row.id, row]));
  // A session found that the list leaves out, past its last row, shows as the search read it.
  const all = [...rows, ...[...(found?.values() ?? [])].filter((row) => !bySession.has(row.id))];
  const flying = (data.workspace?.features ?? []).filter(inFlight);
  const folders = new Set(flying.map((feature) => feature.folder));
  const features = matching(flying, found, query);
  const sessions = all.filter(
    (row) => isSessionCard(row, folders) && (!found || found.has(row.id)),
  );
  return [
    ...features.map((feature) => ({
      feature,
      kind: "feature" as const,
      row: rowOf(feature, all),
      start: startOf(feature, all),
      status: feature.status,
    })),
    ...sessions
      .filter((row) => found || (!row.archived && (!row.done || row.id === kept)))
      .map((row) => ({
        kind: "session" as const,
        row,
        start: row.startedAt,
        status: { label: row.statusLabel, status: row.status },
      })),
  ];
}

/**
 * Splits entries into the cards that need the human, the most urgent first, and the rest as they
 * were: the one rule of the shell's Needs you pane.
 */
export function splitNeedsYou(entries: ReadonlyArray<Entry>): {
  rest: Array<Entry>;
  waiting: Array<Entry>;
} {
  return {
    rest: entries.filter((entry) => !needsYou(entry.status)),
    waiting: byStatus(entries.filter((entry) => needsYou(entry.status))),
  };
}

/**
 * The cards that need the human, what the most urgent first: the entries of the shell's Needs you
 * pane, which the status line counts and Continue opens.
 */
export function needsYouEntries(data: Data): Array<Entry> {
  return splitNeedsYou(entriesOf(data, { found: undefined, query: "" })).waiting;
}

/** An entry's key among the cards: its folder, or its session's ID. */
export function entryKey(entry: Entry): string {
  return entry.kind === "feature" ? entry.feature.folder : entry.row.id;
}

/** How many sessions are at work: a turn running, not archived. */
export function runningSessions(data: Data): number {
  return (data.sessionList?.rows ?? []).filter((row) => !row.archived && row.status === "working")
    .length;
}

/**
 * How many entries Now holds whose feature or change does not run, as the priorities page counts
 * them.
 */
export function nowCount(data: Data): number {
  const running = new Set(
    (data.workspace?.features ?? []).filter(inFlight).map((feature) => feature.folder),
  );
  return (data.workspace?.priorities ?? []).filter(
    (entry) => entry.section === "now" && !(entry.feature && running.has(entry.feature)),
  ).length;
}
