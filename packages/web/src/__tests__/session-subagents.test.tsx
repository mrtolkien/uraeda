// Session US3 and its nested edge case: while the agent runs sub-agents, the session's column gains
// a Sub-agents tab, each running sub-agent a row with its calls, what it does now, and since when;
// once they end, the open tab marks them done and stays until the human leaves it (ruling R10).
import { screen, within } from "@testing-library/react";
import type { Item } from "uraeda-server/fate";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  addRun,
  atWidth,
  click,
  type Fake,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The column's name, its landmark's. */
const NAME = "The session's column";

/** The scenario's two sub-agents. */
const RESEARCH = "Research rrule's undo of an occurrence";
const CALLERS = "Find every caller of complete()";

/** When the scenario's run starts. */
const START = new Date("2026-10-25T10:00:00Z").getTime();

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

afterEach(() => {
  vi.useRealTimers();
});

/** The column, once drawn. */
async function findColumn() {
  return within(await screen.findByRole("complementary", { name: NAME }));
}

/** Whether the column's tabs are the Activity's alone. */
function activityAlone(column: ReturnType<typeof within>) {
  expect(column.getAllByRole("tab")).toEqual([column.getByRole("tab", { name: "Activity" })]);
}

/** The Sub-agents tab, whatever its count. */
function subagentsTab(column: ReturnType<typeof within>) {
  return column.getByRole("tab", { name: /^Sub-agents/ });
}

/** The sub-agents' list's row of `description`. */
function rowOf(column: ReturnType<typeof within>, description: string) {
  const list = column.getByRole("list", { name: "The session's sub-agents" });
  return within(list).getByText(description).closest("li")!;
}

/** The text of the sub-agents' list's row of `description`. */
function rowText(column: ReturnType<typeof within>, description: string) {
  return rowOf(column, description).textContent;
}

/** The status mark of the sub-agents' list's row of `description`, by its name. */
function mark(column: ReturnType<typeof within>, description: string) {
  return within(rowOf(column, description)).getByRole("img").getAttribute("aria-label");
}

/** A sub-agent's starting call, `id`, running `description`, of the sub-agent `parent`, if any. */
function subagent(id: string, description: string, parent?: string): Item {
  return {
    id,
    kind: "tool",
    name: "Task",
    status: "in_progress",
    subagent: { description },
    toolKind: "other",
    ...(parent === undefined ? {} : { parent }),
  };
}

/** A call of the sub-agent `parent`, of `toolKind` on `target`. */
function callOf(parent: string, id: string, toolKind: string, target: string): Item {
  return {
    id,
    kind: "tool",
    name: toolKind,
    parent,
    status: "completed",
    target,
    toolKind: toolKind as Extract<Item, { kind: "tool" }>["toolKind"],
  };
}

/** Appends `items` to the turn `turn` at `at` milliseconds after the run's start. */
function appendAt(fake: Fake, turn: number, at: number, items: ReadonlyArray<Item>) {
  vi.setSystemTime(START + at);
  for (const item of items) {
    fake.sessions.cache.appendItem(turn, item);
  }
}

/**
 * The feature's session, running the scenario's two sub-agents: "Research rrule's undo of an
 * occurrence", started at the run's start, 6 calls, the last fetching an issue; "Find every caller
 * of complete()", started 40 s later, 3 calls, the last searching `complete(`; and, when `nested`,
 * a sub-agent the first one started. The clock is set a minute after the start.
 */
async function runningSubagents(fake: Fake, repo: string, nested = false) {
  const session = await fake.sessions.featureSession(repo, CLI);
  vi.setSystemTime(START);
  const turn = addRun(
    fake,
    session.id,
    [{ kind: "text", streaming: false, text: "Looking into undo." }],
    "running",
  );
  appendAt(fake, turn, 0, [
    subagent("agent-a", RESEARCH),
    callOf("agent-a", "a1", "read", "src/tasks/undo.ts"),
    callOf("agent-a", "a2", "read", "src/tasks/repeat.ts"),
    callOf("agent-a", "a3", "search", "rrule undo"),
    callOf("agent-a", "a4", "fetch", "github.com/jkbrzt/rrule#usage"),
    callOf("agent-a", "a5", "read", "src/tasks/complete.ts"),
  ]);
  appendAt(fake, turn, 40_000, [
    subagent("agent-b", CALLERS),
    callOf("agent-b", "b1", "read", "src/tasks/complete.ts"),
    callOf("agent-b", "b2", "read", "src/tasks/list.ts"),
    callOf("agent-b", "b3", "search", "complete("),
  ]);
  appendAt(fake, turn, 50_000, [
    callOf("agent-a", "a6", "fetch", "github.com/jkbrzt/rrule/issues/412"),
    ...(nested ? [subagent("agent-c", "Look deeper", "agent-a")] : []),
  ]);
  vi.setSystemTime(START + 60_000);
  return { session: session.id, turn };
}

test("US3.1: a run with no sub-agent has the Activity tab alone", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const session = await fake.sessions.featureSession(repo, CLI);
  // The main agent reads a file, and starts no sub-agent.
  const read: Item = {
    id: "r1",
    kind: "tool",
    name: "Read",
    status: "in_progress",
    target: "src/tasks/undo.ts",
    toolKind: "read",
  };
  addRun(fake, session.id, [read], "running");

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const column = await findColumn();
  activityAlone(column);
});

test("US3.2: two running sub-agents, their calls, what they do, and since when", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await runningSubagents(fake, repo);

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const column = await findColumn();
  await click(await column.findByRole("tab", { name: /^Sub-agents/ }));
  expect(subagentsTab(column).getAttribute("aria-selected")).toBe("true");
  expect(rowText(column, RESEARCH)).toContain(
    "6 calls · fetching github.com/jkbrzt/rrule/issues/412",
  );
  expect(rowText(column, RESEARCH)).toContain("1 min");
  expect(rowText(column, CALLERS)).toContain("3 calls · searching complete(");
  expect(rowText(column, CALLERS)).toContain("20 s");
  const list = column.getByRole("list", { name: "The session's sub-agents" });
  expect(within(list).getAllByRole("img", { name: "Working" })).toHaveLength(2);
  // Changes stays under the sub-agents, as under the Activity.
  expect(column.getByRole("region", { name: "Changes" })).toBeTruthy();
});

test("US3.3: once the last ends, each is marked done, and the tab stays until left", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const { turn } = await runningSubagents(fake, repo);
  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });
  const column = await findColumn();
  await click(await column.findByRole("tab", { name: /^Sub-agents/ }));
  expect(mark(column, CALLERS)).toBe("Working");

  // Both sub-agents end; the run goes on.
  const { cache } = fake.sessions;
  for (const seq of [1, 7]) {
    const item = cache.items(turn, seq, 1)[0]!;
    const { seq: _seq, ...data } = item;
    cache.updateItem(turn, seq, { ...data, status: "completed" } as Item);
  }

  await refreshUntil(() => expect(mark(column, CALLERS)).toBe("Done"));
  expect(mark(column, RESEARCH)).toBe("Done");
  expect(column.queryAllByRole("img", { name: "Working" })).toHaveLength(0);
  // The tab stays while it is open, with no running count.
  expect(subagentsTab(column).getAttribute("aria-selected")).toBe("true");
  expect(column.getByRole("tab", { name: "Sub-agents" })).toBe(subagentsTab(column));

  // Left for the Activity, it goes, none running.
  await click(column.getByRole("tab", { name: "Activity" }));
  activityAlone(column);
});

test("edge: a sub-agent's own sub-agent is not listed", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  await runningSubagents(fake, repo, true);

  await renderPage(`/f/${CLI}/session`, repo, { agent: fake });

  const column = await findColumn();
  // Its count is the session's own sub-agents', two.
  const tab = await column.findByRole("tab", { name: /^Sub-agents\s*2 running$/ });
  await click(tab);
  const list = column.getByRole("list", { name: "The session's sub-agents" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  expect(within(list).queryByText("Look deeper")).toBeNull();
});
