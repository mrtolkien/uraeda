// The shell's entries: the features and changes in flight, each with its most urgent session's row,
// and the sessions without a workflow, which its panes split into Needs you, Sessions, and In
// progress; and the counts the column's rows and the phone's tabs show.
import type { useNavigation } from "../sessionData.ts";
import { type Feature, featureStatus, inFlight, type Row, startOf, type Status } from "./cards.ts";

/** The workspace and the sessions' list, as the shell reads them. */
export type Data = ReturnType<typeof useNavigation>;

/** A card of the panes: a feature or a change, or a session without a workflow. */
export type Entry =
  | { feature: Feature; kind: "feature"; row: Row | undefined; start: string; status: Status }
  | { kind: "session"; row: Row; start: string; status: Status };

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

/**
 * The entries: the features and changes in flight, each with its most urgent session's row, and the
 * sessions without a workflow. Outside a search, an archived session is left out, and a session read
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
  return [
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
