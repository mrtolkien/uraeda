import { expect, test } from "vite-plus/test";
import { atCatchUp, binding, mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

/** The Claude Code failure the human signs in to fix, before pressing Continue all. */
const NOT_LOGGED_IN = "Not logged in · Please run /login";

/** The default branch's tip a feature at Catch up catches up with. */
const CATCH_UP = {
  branch: "main",
  commit: "a".repeat(40),
  subject: "finish(codex-runtime): Codex runtime + model settings",
};

/** A session of the folder whose one workflow turn ended `state` at `step`. */
async function endedRun(
  server: Server,
  folder: string,
  { reason, state, step }: { reason?: string; state: "done" | "failed"; step: string },
): Promise<string> {
  const { cache } = server.sessions;
  const repo = await server.sessions.mainRoot(server.repo);
  const session = cache.createSession({ agent: "fake", folder, nativeId: "n", repo, title: null });
  const turn = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step,
    trigger: "manual",
  });
  cache.endTurn(turn, { ...(reason === undefined ? {} : { reason }), state });
  return session.id;
}

/** A session of the folder whose one workflow turn failed, not logged in. */
function failedRun(server: Server, folder: string): Promise<string> {
  return endedRun(server, folder, { reason: NOT_LOGGED_IN, state: "failed", step: "plan" });
}

/** US5 1 and 3, SC-006: each run that asks is continued, and a feature at a gate is left alone. */
test("US5: Continue all sends each stopped run its step's message, and none to a gate", async () => {
  const server = await testServer();
  const failed = await failedRun(server, AGENT);
  // A run that failed at a human gate asks too, but the gate is the human's.
  const gate = await failedRun(server, HUMAN);

  server.adapter.script([]);
  const result = await mutate(server.app, "feature.continueAll", {}, ["id"]);

  expect(result.error).toBeUndefined();
  // In the run's own session, which goes on, not a new one.
  const turns = server.sessions.cache.turns(failed);
  expect(turns).toHaveLength(2);
  await server.sessions.settled(turns[1].id);
  expect(server.adapter.sent).toEqual([
    expect.objectContaining({
      text: expect.stringMatching(/^\/uraeda Continue the feature specs\/2026-10-12-cli-tuis\//),
    }),
  ]);
  expect(turns[1]).toMatchObject({ kind: "workflow", step: "plan", trigger: "manual" });
  expect(server.sessions.cache.turns(gate)).toHaveLength(1);
});

/** A refused run is left as it was, and the answer names it with its refusal, for the toast. */
test("Continue all answers the runs refused, by name, with their refusal", async () => {
  const server = await testServer();
  const failed = await failedRun(server, AGENT);
  // A move or a drop of the feature holds it: its sessions take no message.
  const release = await server.sessions.hold(server.repo, { folder: AGENT });

  const result = await mutate(server.app, "feature.continueAll", {}, ["id", "refused"]);
  release();

  expect(result.error).toBeUndefined();
  expect(result.data).toMatchObject({
    refused: [{ folder: AGENT, name: "cli-tuis", reason: "The agent is working" }],
  });
  expect(server.sessions.cache.turns(failed)).toHaveLength(1);
});

/** US1 2: an idle feature at Catch up gets the catch-up's message, though nothing asks. */
test("Continue all sends an idle catch-up its message", async () => {
  const server = await testServer(undefined, { binding: atCatchUp(binding, AGENT, CATCH_UP) });
  // Its run ended at the pull request, before main moved: it asks nothing.
  const idle = await endedRun(server, AGENT, { state: "done", step: "pull-request" });

  server.adapter.script([]);
  const result = await mutate(server.app, "feature.continueAll", {}, ["id"]);

  expect(result.error).toBeUndefined();
  const turns = server.sessions.cache.turns(idle);
  expect(turns).toHaveLength(2);
  await server.sessions.settled(turns[1].id);
  expect(server.adapter.sent).toEqual([
    expect.objectContaining({
      text: expect.stringMatching(/^\/uraeda Continue the feature specs\/2026-10-12-cli-tuis\//),
    }),
  ]);
  expect(turns[1]).toMatchObject({ kind: "workflow", step: "catch-up", trigger: "manual" });
});
