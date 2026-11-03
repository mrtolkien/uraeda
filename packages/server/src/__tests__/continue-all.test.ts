import { expect, test } from "vite-plus/test";
import { mutate, testServer } from "./helpers.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";
/** Waits on the human, at its questions. */
const HUMAN = "2026-10-11-web-ui";

/** The Claude Code failure the human signs in to fix, before pressing Continue all. */
const NOT_LOGGED_IN = "Not logged in · Please run /login";

/** A session of the folder whose one workflow turn failed, not logged in. */
async function failedRun(server: Server, folder: string): Promise<string> {
  const { cache } = server.sessions;
  const repo = await server.sessions.mainRoot(server.repo);
  const session = cache.createSession({ agent: "fake", folder, nativeId: "n", repo, title: null });
  const turn = cache.addTurn({
    allowed: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "plan",
    trigger: "manual",
  });
  cache.endTurn(turn, { reason: NOT_LOGGED_IN, state: "failed" });
  return session.id;
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
