// Merge chats US1 1: the Sessions list keeps each card in the order it started, the oldest first,
// so rows never jump as agents work; a session that became a change keeps its start.
import { expect, test } from "vite-plus/test";
import { byStart, type Feature, type Row, startOf } from "../sidebar/cards.ts";

/** A feature or a change in its folder. */
const feature = (folder: string) => ({ folder }) as Feature;

/** A session of `folder`, or of none, started at `startedAt`. */
const session = (folder: string | null, startedAt: string) => ({ folder, startedAt }) as Row;

test("cards by start: the oldest first, whatever their kind", () => {
  const items = [
    { name: "Why is CI slow?", start: "2026-10-19T09:00:00.000Z" },
    { name: "look-and-feel", start: "2026-10-17" },
    { name: "flaky-tests", start: "2026-10-18" },
  ];

  expect(byStart(items).map((item) => item.name)).toEqual([
    "look-and-feel",
    "flaky-tests",
    "Why is CI slow?",
  ]);
});

test.each<[string, Array<Row>, string]>([
  ["its folder's date, before any session", [], "2026-10-18"],
  [
    "its first session's start, kept from before it was a change",
    [
      session("2026-10-18-flaky-tests", "2026-10-18T10:00:00.000Z"),
      session("2026-10-18-flaky-tests", "2026-10-17T22:00:00.000Z"),
      session(null, "2026-10-16T08:00:00.000Z"),
    ],
    "2026-10-17T22:00:00.000Z",
  ],
  [
    "its first session's start, on its folder's own day",
    [session("2026-10-18-flaky-tests", "2026-10-18T09:00:00.000Z")],
    "2026-10-18T09:00:00.000Z",
  ],
])("a change's start: %s", (_, rows, start) => {
  expect(startOf(feature("2026-10-18-flaky-tests"), rows)).toBe(start);
});
