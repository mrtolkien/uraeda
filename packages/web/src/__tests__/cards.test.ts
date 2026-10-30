// Merge chats US1 1: the Sessions list keeps each card in the order it started, the oldest first,
// so rows never jump as agents work; a session that became a change keeps its start. A card's
// status is the server's, and a gate's label drops "ready" while an agent works on it.
import { expect, test } from "vite-plus/test";
import {
  byStart,
  byStatus,
  type Feature,
  type Row,
  startOf,
  type Status,
  toCard,
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

/** A feature at `step`, with the status the server gave it, its gate's file `kind`. */
const at = (step: string, status: Status, kind?: string) =>
  ({
    files: kind ? [{ kind, name: `${kind}.md` }] : [],
    folder: "2026-10-30-panes-size",
    problems: [],
    slug: "panes-size",
    status: { ...status, reason: null, session: null, turn: null },
    step: { file: kind ? `${kind}.md` : null, name: step, waitsOn: kind ? "human" : "agent" },
    title: "Panes size",
  }) as unknown as Feature;

const WORKING: Status = { label: "Working", status: "working" };
const NEEDS_YOU: Status = { label: "Needs you", status: "needs-you" };

test.each<[string, Feature, Status, string]>([
  ["a spec at rest", at("human-gate", NEEDS_YOU, "spec"), NEEDS_YOU, "Spec ready"],
  ["a spec an agent works on", at("human-gate", WORKING, "spec"), WORKING, "Spec"],
  ["a plan an agent works on", at("human-gate", WORKING, "plan"), WORKING, "Plan"],
  [
    "questions an agent works on",
    at("human-gate", WORKING, "clarifications"),
    WORKING,
    "Questions",
  ],
  ["a pull request at rest", at("pull-request", NEEDS_YOU), NEEDS_YOU, "PR ready"],
  ["a pull request an agent works on", at("pull-request", WORKING), WORKING, "PR"],
  [
    "commits to push",
    at("push", { label: "Idle", status: "idle" }),
    { label: "Idle", status: "idle" },
    "Push",
  ],
])("a card: %s", (_, feature, status, label) => {
  const card = toCard(feature, undefined);

  expect(card.status).toEqual(status);
  expect(card.step?.label).toBe(label);
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
