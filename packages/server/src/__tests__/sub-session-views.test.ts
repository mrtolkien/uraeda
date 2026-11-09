// The sub-sessions' records (US6 of the run options): a session's record lists the sub-sessions
// Uraeda started for its runs, each with its role, its task, its agent, model, and effort by their
// names, its state, its time, and its usage; a sub-session's own record names its parent and role.
// The sidebar's list leaves them out: their parent's views list them.
import { expect, test } from "vite-plus/test";
import { TAKEN_BACK } from "../runner/session-state.ts";
import { byId, type Data, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

type Server = Awaited<ReturnType<typeof testServer>>;

/** A session of the feature, its runs' parent, titled `title`. */
async function featureSession(server: Server, title: string | null = null) {
  return server.sessions.cache.createSession({
    agent: "fake",
    folder: AGENT,
    nativeId: "n",
    repo: await server.sessions.mainRoot(server.repo),
    title,
  });
}

/** A sub-session of `parent`, as `role`, on the fake's large model at `effort`, titled `about`. */
function subSession(
  server: Server,
  parent: { id: string; repo: string },
  { about, effort, role }: { about: string; effort?: string; role: "implementer" | "reviewer" },
) {
  return server.sessions.cache.createSession({
    agent: "fake",
    ...(effort === undefined ? {} : { effort, model: "fake-big" }),
    folder: AGENT,
    nativeId: about,
    parent: parent.id,
    repo: parent.repo,
    role,
    title: about,
  });
}

/** A workflow turn of `session`, left running or ended as `state`, with its tokens. */
function turn(server: Server, session: string, state: "done" | "failed" | "running" | "stopped") {
  const { cache } = server.sessions;
  const id = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session,
    state: "running",
    step: "implementation",
    trigger: "manual",
  });
  cache.addTurnTokens(id, { cacheRead: 5000, cacheWrite: 1000, input: 200, output: 300 });
  if (state !== "running") {
    cache.endTurn(id, { state });
  }
  return id;
}

/** US6 1 and 3: the Sub-agents pane's and the feature's sessions' rows, from the parent's record. */
test("a session's record lists its sub-sessions, with what each runs on and where it stands", async () => {
  const server = await testServer();
  const parent = await featureSession(server);
  const working = subSession(server, parent, {
    about: "Task 4: Next due date",
    effort: "low",
    role: "implementer",
  });
  turn(server, working.id, "running");
  const reviewer = subSession(server, parent, { about: "Wave 1", role: "reviewer" });
  turn(server, reviewer.id, "done");
  const failed = subSession(server, parent, { about: "Task 5", role: "implementer" });
  turn(server, failed.id, "failed");
  // At its agent's limit, it waits to continue: the runner holds its parent meanwhile.
  const limited = subSession(server, parent, { about: "Task 6", role: "implementer" });
  const limit = turn(server, limited.id, "failed");
  server.sessions.cache.scheduleContinue(limit, Date.now() + 3_600_000, "limit", TAKEN_BACK);
  // Never started, and its parent no longer runs a turn to start it.
  const unstarted = subSession(server, parent, { about: "Task 7", role: "implementer" });

  const [record] = await byId(
    server.app,
    "Session",
    [parent.id],
    ["parent", "role", "subSessions"],
  );

  expect(record).toMatchObject({ parent: null, role: null });
  const subs = record!.subSessions as Array<Record<string, Data>>;
  expect(subs.map((sub) => [sub.id, sub.role, sub.state])).toEqual([
    [working.id, "implementer", "working"],
    [reviewer.id, "reviewer", "done"],
    [failed.id, "implementer", "failed"],
    [limited.id, "implementer", "working"],
    [unstarted.id, "implementer", "stopped"],
  ]);
  expect(subs[0]).toEqual({
    about: "Task 4: Next due date",
    agent: "fake",
    effort: "Low",
    endedAt: null,
    id: working.id,
    model: "Fake Big",
    parent: parent.id,
    role: "implementer",
    startedAt: working.createdAt,
    state: "working",
    usage: { input: 1200, output: 300 },
  });
  // On the agent's own model and effort, until it says which.
  expect(subs[1]).toMatchObject({ effort: null, model: "Default" });
  expect(subs[1]!.endedAt).toEqual(expect.any(String));

  const [own] = await byId(server.app, "Session", [working.id], ["parent", "role", "subSessions"]);
  expect(own).toMatchObject({ parent: parent.id, role: "implementer", subSessions: [] });
});

/** The IDs of a list's rows. */
const ids = (rows: Data) => (rows as Array<{ id: string }>).map((row) => row.id);

test("the sessions' list and search leave the sub-sessions out, past the search's limit too", async () => {
  const server = await testServer();
  const parent = await featureSession(server, "Task 4 and its waves");
  turn(server, parent.id, "done");
  // More sub-sessions match than the search keeps, each updated after the parent.
  const subs = Array.from({ length: 51 }, (_, n) =>
    subSession(server, parent, { about: `Task 4.${n}`, role: "implementer" }),
  );
  turn(server, subs[0]!.id, "running");

  const [listed] = await byId(server.app, "SessionList", ["all"], ["id", "rows"]);
  const [found] = await byId(server.app, "SessionSearch", ["task 4"], ["id", "rows"]);

  expect(ids(listed!.rows)).toContain(parent.id);
  expect(ids(listed!.rows)).not.toContain(subs[0]!.id);
  expect(ids(found!.rows)).toEqual([parent.id]);
});
