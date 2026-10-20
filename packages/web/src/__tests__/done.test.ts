// Merge chats US1 2: the sidebar's Done area lists the sessions read to their end with the merged
// changes and features, the latest first.
import { expect, test } from "vite-plus/test";
import type { Feature, Row } from "../sidebar/cards.ts";
import { doneRows } from "../sidebar/done.ts";

/** A feature or a change at a step, in its folder. */
const feature = (folder: string, step: string) =>
  ({ folder, kind: "change", slug: folder.slice(11), step: { name: step }, title: "" }) as Feature;

/** A session without a workflow, done or not, last updated at `updatedAt`. */
const session = (id: string, title: string, done: boolean, updatedAt: string) =>
  ({ archived: false, done, folder: null, id, title, updatedAt }) as Row;

test("Done lists a session read to its end, then a merged change", () => {
  const rows = doneRows(
    [feature("2026-10-16-ctrl-enter", "done"), feature("2026-10-18-flaky-tests", "change")],
    [
      session("a", "What does ura clean keep?", true, "2026-10-19T10:00:00.000Z"),
      session("b", "Why is CI slow?", false, "2026-10-19T11:00:00.000Z"),
    ],
    { here: (path) => path, pathname: "/" },
  );

  expect(rows.map((row) => [row.label, row.href])).toEqual([
    ["What does ura clean keep?", "/sessions/a"],
    ["ctrl-enter", "/f/2026-10-16-ctrl-enter"],
  ]);
});

test("an archived session, or the open one, is not in Done", () => {
  const archived = {
    ...session("a", "Archived", true, "2026-10-19T10:00:00.000Z"),
    archived: true,
  };
  const open = session("b", "Open", true, "2026-10-19T10:00:00.000Z");

  expect(
    doneRows([], [archived, open], { here: (path) => path, kept: "b", pathname: "/" }),
  ).toEqual([]);
});
