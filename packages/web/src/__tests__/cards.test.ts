// Merge chats US1 1: the Sessions list keeps each card in the order it started, the oldest first,
// so rows never jump as agents work; a session that became a change keeps its start.
import { expect, test } from "vite-plus/test";
import {
  byStart,
  byStatus,
  type Feature,
  featureStatus,
  type Row,
  startOf,
  type Status,
} from "../sidebar/cards.ts";

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

/** A feature that waits on `waitsOn`, with or without problems. */
const waiting = (waitsOn: "agent" | "human", problems: Array<string> = []) =>
  ({ problems, step: { waitsOn } }) as unknown as Feature;

/** A session's row with its status, as the sessions' list reads it. */
const row = (status: Status["status"], statusLabel: string) => ({ status, statusLabel }) as Row;

const NEEDS_YOU: Status = { label: "Needs you", status: "needs-you" };

test.each<[string, Feature, Row | undefined, Status]>([
  ["waiting on the human, without a session: Needs you", waiting("human"), undefined, NEEDS_YOU],
  [
    "waiting on the agent, without a session: Idle",
    waiting("agent"),
    undefined,
    { label: "Idle", status: "idle" },
  ],
  [
    "a session's status, while the step waits on the agent",
    waiting("agent"),
    row("attention", "Needs attention"),
    { label: "Needs attention", status: "attention" },
  ],
  [
    "a working turn shows Working, though the step waits on the human",
    waiting("human"),
    row("working", "Working"),
    { label: "Working", status: "working" },
  ],
  [
    "a problem: Needs you, whatever its session",
    waiting("agent", ["x"]),
    row("working", "Working"),
    NEEDS_YOU,
  ],
])("a feature's status: %s", (_, feature, session, status) => {
  expect(featureStatus(feature, session)).toEqual(status);
});

/** An item of the sidebar: a name, its start, and its status. */
const item = (name: string, status: Status["status"], start: string) => ({
  name,
  start,
  status: { label: name, status },
});

test("Needs you sorts what needs the human before what needs their attention, then by start", () => {
  const items = [
    item("idle", "idle", "2026-10-10"),
    item("working", "working", "2026-10-11"),
    item("attention, later", "attention", "2026-10-13"),
    item("unread", "unread", "2026-10-12"),
    item("needs you, later", "needs-you", "2026-10-14"),
    item("attention, earlier", "attention", "2026-10-09"),
    item("needs you, earlier", "needs-you", "2026-10-08"),
  ];

  expect(byStatus(items).map((entry) => entry.name)).toEqual([
    "needs you, earlier",
    "needs you, later",
    "attention, earlier",
    "attention, later",
    "unread",
    "working",
    "idle",
  ]);
});
