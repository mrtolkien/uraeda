import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { live as globalLive } from "../fate.ts";
import { TAKEN_BACK } from "../runner/session-state.ts";
import { SERVER_STOPPED } from "../runner/sessions.ts";
import { byId, type Data, fixtureRepo, mutate, testDataDir, testServer } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

type Server = Awaited<ReturnType<typeof testServer>>;

/** A new session of the repository, of `folder` or a chat, with a turn left running: their IDs. */
async function runningTurn(server: Server, folder: string | null, repo?: string) {
  const { cache } = server.sessions;
  const session = cache.createSession({
    agent: "fake",
    folder,
    nativeId: "n",
    repo: repo ?? (await server.sessions.mainRoot(server.repo)),
    title: folder === null ? "A chat" : null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: folder === null ? "chat" : "workflow",
    sessionId: session.id,
    state: "running",
    step: folder === null ? null : "plan",
    trigger: folder === null ? null : "manual",
  });
  return { session: session.id, turn };
}

/** The session's status and why, as its record and its row in the sidebar give them. */
async function rowOf(server: Server, id: string) {
  const [session] = await byId(server.app, "Session", [id], ["status", "statusReason"]);
  const [list] = await byId(server.app, "SessionList", ["all"], ["id", "rows"]);
  const row = ((list?.rows ?? []) as Array<Record<string, Data>>).find((each) => each.id === id);
  expect(row?.status).toBe(session?.status);
  return { status: session?.status, statusReason: session?.statusReason };
}

const dismiss = (server: Server, turn: number) =>
  mutate(server.app, "session.dismiss", { turn: String(turn) }, ["id", "status", "statusReason"]);

/** US2.1, US2.2, US2's restart, review focus 3, and the edge case of a run replaced meanwhile. */
test("a dismissed run stops asking, across a restart, and a new failure asks again", async () => {
  const repo = fixtureRepo();
  const cache = join(testDataDir(), "runner.sqlite");
  const server = await testServer(repo, { cache });
  const stopped = await runningTurn(server, AGENT);
  // The server's next start stops the turns a stopped server left running.
  server.sessions.cache.interrupted(SERVER_STOPPED);
  expect(await rowOf(server, stopped.session)).toEqual({
    status: "attention",
    statusReason: "interrupted",
  });

  // A turn still running, and a turn of another repository, are refused, and nothing changes.
  const chat = await runningTurn(server, null);
  const elsewhere = await runningTurn(server, null, "/another/repo");
  server.sessions.cache.endTurn(elsewhere.turn, { state: "failed" });
  expect((await dismiss(server, chat.turn)).error?.message).toMatch(/^refused: /);
  expect((await dismiss(server, elsewhere.turn)).error?.message).toMatch(/^refused: /);
  expect(server.sessions.cache.turn(chat.turn)).toMatchObject({ dismissedAt: null });
  expect(server.sessions.cache.turn(elsewhere.turn)).toMatchObject({ dismissedAt: null });

  const dismissed = await dismiss(server, stopped.turn);

  expect(dismissed.data).toEqual({ id: stopped.session, status: "idle", statusReason: null });
  expect(await rowOf(server, stopped.session)).toEqual({ status: "idle", statusReason: null });
  // A new server over the same cache: the dismissal was kept.
  const restarted = await testServer(repo, { cache });
  expect(await rowOf(restarted, stopped.session)).toEqual({ status: "idle", statusReason: null });

  // A new run fails: dismissing the older run leaves the new one asking.
  const failed = restarted.sessions.cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: stopped.session,
    state: "running",
    step: "plan",
    trigger: "manual",
  });
  restarted.sessions.cache.endTurn(failed, { reason: "Usage limit reached.", state: "failed" });
  await dismiss(restarted, stopped.turn);
  expect(await rowOf(restarted, stopped.session)).toEqual({
    status: "attention",
    statusReason: "failed",
  });
});

test("a dismissal sends the session's list, feature, workspace, and what needs the human", async () => {
  const server = await testServer(fixtureRepo());
  const host = server.hosts.get(server.name)!;
  const { session, turn } = await runningTurn(server, AGENT);
  server.sessions.cache.endTurn(turn, { reason: "Usage limit reached.", state: "failed" });
  const update = vi.spyOn(host.live, "update");
  const global = vi.spyOn(globalLive, "update");

  expect((await dismiss(server, turn)).error).toBeUndefined();

  expect(update).toHaveBeenCalledWith("Session", session, expect.anything());
  expect(update).toHaveBeenCalledWith("SessionList", "all", expect.anything());
  expect(update).toHaveBeenCalledWith("Feature", AGENT, expect.anything());
  expect(update).toHaveBeenCalledWith("Workspace", "workspace", expect.anything());
  expect(global).toHaveBeenCalledWith("NeedsYouList", expect.anything(), expect.anything());
});

test("a queued message taken back never asks for the human", async () => {
  const server = await testServer(fixtureRepo());
  const { adapter, repo, sessions } = server;
  const root = await sessions.mainRoot(repo);
  const session = await sessions.featureSession(root, AGENT);
  const { turn: first } = await sessions.send(root, session.id, { text: "What is left?" });
  const { turn: queued } = await sessions.send(root, session.id, {
    text: "Continue the feature.",
    workflow: { fresh: false, trigger: "manual" },
  });

  sessions.takeBack(root, session.id, sessions.cache.itemsOf(queued, "message")[0]!.id);
  adapter.emit({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
  await sessions.settled(first);

  expect(sessions.cache.turn(queued)).toMatchObject({ reason: TAKEN_BACK, state: "stopped" });
  // Seen since the first turn's reply: idle, as before the message was queued.
  sessions.seen(root, session.id);
  expect(await rowOf(server, session.id)).toEqual({ status: "idle", statusReason: null });
});
