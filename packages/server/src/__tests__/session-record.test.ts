import { afterEach, expect, test, vi } from "vite-plus/test";
import type { AgentEvent } from "../runner/events.ts";
import { byId, type Data, mutate, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

const result: AgentEvent = {
  denials: [],
  errors: [],
  interrupted: false,
  ok: true,
  type: "result",
};

/** Lets the session manager read the events emitted so far. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type Server = Awaited<ReturnType<typeof testServer>>;

afterEach(() => {
  vi.useRealTimers();
});

/** Sends a message to the feature's session, and returns the session it went to. */
async function send(server: Server, text: string) {
  const sent = await mutate(server.app, "session.send", { folder: AGENT, text }, ["id", "turns"]);
  expect(sent.error).toBeUndefined();
  return sent.data as Record<string, Data>;
}

/** A tool call's start and end, of the kind, on the target. */
function call(
  id: string,
  kind: "edit" | "fetch" | "read" | "search",
  target: string,
  { failed = false, parent }: { failed?: boolean; parent?: string } = {},
): Array<AgentEvent> {
  return [
    {
      id,
      input: {},
      kind,
      name: kind,
      ...(parent === undefined ? {} : { parent }),
      target,
      type: "toolStart",
    },
    { id, isError: failed, output: "", type: "toolEnd" },
  ];
}

const emit = (server: Server, events: Array<AgentEvent>) => {
  for (const event of events) {
    server.adapter.emit(event);
  }
};

test("a session's edited files, with their completed edits, in order", async () => {
  const server = await testServer();
  const first = await send(server, "Build it");
  emit(server, [
    ...call("edit-1", "edit", "src/tasks/complete.ts"),
    ...call("edit-2", "edit", "src/tasks/complete.test.ts"),
    ...call("edit-3", "edit", "src/tasks/complete.test.ts"),
    {
      id: "agent-1",
      input: {},
      kind: "other",
      name: "Agent",
      subagent: { description: "Write the rule" },
      type: "toolStart",
    },
    // A sub-agent's edit is the session's too.
    ...call("edit-4", "edit", "src/tasks/repeat.ts", { parent: "agent-1" }),
    { id: "agent-1", isError: false, output: "", type: "toolEnd" },
    result,
  ]);
  await server.sessions.settled(Number(first.turns.at(-1)));
  const second = await send(server, "Go on");
  emit(server, [
    ...call("edit-5", "edit", "src/tasks/undo.ts", { failed: true }),
    ...call("read-1", "read", "src/tasks/repeat.ts"),
    // Files first edited in the first turn: one place each, their edits of both turns counted.
    ...call("edit-6", "edit", "src/tasks/complete.ts"),
    ...call("edit-7", "edit", "src/tasks/complete.test.ts"),
    result,
  ]);
  await server.sessions.settled(Number(second.turns.at(-1)));

  const [record] = await byId(server.app, "Session", [first.id], ["id", "edited"]);

  // In the order of their first edit, not of their count.
  expect(record.edited).toEqual([
    { edits: 2, path: "src/tasks/complete.ts" },
    { edits: 3, path: "src/tasks/complete.test.ts" },
    { edits: 1, path: "src/tasks/repeat.ts" },
  ]);
});

test("a running sub-agent's calls, its latest call, and its start", async () => {
  const server = await testServer();
  const session = await send(server, "Research it");
  vi.setSystemTime(new Date("2026-10-25T15:00:00.000Z"));
  server.adapter.emit({
    id: "agent-1",
    input: {},
    kind: "other",
    name: "Agent",
    subagent: { description: "Research rrule" },
    type: "toolStart",
  });
  await flush();
  vi.setSystemTime(new Date("2026-10-25T15:00:30.000Z"));
  emit(server, [
    ...call("search-1", "search", "rrule", { parent: "agent-1" }),
    ...call("read-1", "read", "node_modules/rrule/README.md", { parent: "agent-1" }),
    ...call("read-2", "read", "node_modules/rrule/dist/rrule.js", { parent: "agent-1" }),
    ...call("fetch-1", "fetch", "github.com/jkbrzt/rrule", { parent: "agent-1" }),
    // Another call of the main agent, between the sub-agent's.
    ...call("read-3", "read", "src/tasks/repeat.ts"),
    ...call("fetch-2", "fetch", "github.com/jkbrzt/rrule/issues", { parent: "agent-1" }),
  ]);
  server.adapter.emit({
    id: "agent-2",
    input: {},
    kind: "other",
    name: "Agent",
    parent: "agent-1",
    subagent: { description: "Read the issues" },
    type: "toolStart",
  });
  emit(server, [
    ...call("read-4", "read", "issues/412.md", { parent: "agent-2" }),
    ...call("fetch-3", "fetch", "github.com/jkbrzt/rrule/issues/412", { parent: "agent-1" }),
  ]);
  await flush();

  const [record] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);

  expect(record.subagents).toEqual([
    {
      calls: 7,
      description: "Research rrule",
      id: "agent-1",
      latest: { target: "github.com/jkbrzt/rrule/issues/412", toolKind: "fetch" },
      parent: null,
      startedAt: "2026-10-25T15:00:00.000Z",
    },
    // The nested sub-agent is listed too while it runs, with its parent: the tab leaves it out.
    {
      calls: 1,
      description: "Read the issues",
      id: "agent-2",
      latest: { target: "issues/412.md", toolKind: "read" },
      parent: "agent-1",
      startedAt: "2026-10-25T15:00:30.000Z",
    },
  ]);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id);
  await server.sessions.settled(Number(session.turns.at(-1)));
});

test("a sub-agent that has not called a tool yet has no latest call", async () => {
  const server = await testServer();
  const session = await send(server, "Research it");
  server.adapter.emit({
    id: "agent-1",
    input: {},
    kind: "other",
    name: "Agent",
    subagent: { description: "Research rrule" },
    type: "toolStart",
  });
  await flush();

  const [record] = await byId(server.app, "Session", [session.id], ["id", "subagents"]);

  expect(record.subagents).toMatchObject([{ calls: 0, latest: null, parent: null }]);
  await server.sessions.mainRoot(server.repo);
  server.sessions.stop(server.repo, session.id);
  await server.sessions.settled(Number(session.turns.at(-1)));
});
