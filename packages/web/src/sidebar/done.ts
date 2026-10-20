// What the sidebar's Done area lists: the sessions read to their end, and the merged changes and
// features, the latest first.
import { useState } from "react";
import { sessionIdPath } from "../routes.tsx";
import type { Feature, Row } from "./cards.ts";
import type { DoneRow } from "./DoneArea.tsx";
import { selects } from "./Row.tsx";

/** A done item, with the date the Done area orders it by. */
type Dated = DoneRow & { date: string };

/**
 * The done items, the latest first. A session is dated by its last turn; a change or a feature by
 * its folder's date, the only one the sidebar reads, which sorts before any time of that day. An
 * archived session, and `kept`, the session whose page is open since before it was done, are left
 * out.
 */
export function doneRows(
  features: Array<Pick<Feature, "folder" | "label" | "slug" | "step" | "title">>,
  sessions: Array<Pick<Row, "archived" | "done" | "folder" | "id" | "title" | "updatedAt">>,
  { here, kept, pathname }: { here: (path: string) => string; kept?: string; pathname: string },
): Array<DoneRow> {
  const done: Array<Dated> = [
    ...features
      .filter((feature) => feature.step.name === "done")
      .map((feature) => ({
        date: feature.folder.slice(0, 10),
        folder: feature.folder,
        href: here(`/f/${feature.folder}`),
        isSelected: selects(pathname, `/f/${feature.folder}`),
        label: feature.label ?? feature.slug,
        title: feature.title,
      })),
    ...sessions
      .filter((row) => row.folder === null && row.done && !row.archived && row.id !== kept)
      .map((row) => ({
        date: row.updatedAt,
        folder: row.id,
        href: here(sessionIdPath(row.id)),
        isSelected: selects(pathname, sessionIdPath(row.id)),
        kind: "session" as const,
        label: row.title,
        title: row.title,
      })),
  ];
  return done
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.folder.localeCompare(a.folder)))
    .map(({ date: _, ...row }) => row);
}

/**
 * The session whose page is open since before it was done: read to its end while open, it stays in
 * the list until its page is left. A session opened once done stays in Done.
 */
export function useKeptSession(
  rows: Array<Pick<Row, "done" | "folder" | "id">>,
  pathname: string,
): string | undefined {
  const [kept, setKept] = useState<string>();
  const open = rows.find((row) => row.folder === null && selects(pathname, sessionIdPath(row.id)));
  const next = open && (!open.done || open.id === kept) ? open.id : undefined;
  if (next !== kept) {
    setKept(next);
  }
  return next;
}
