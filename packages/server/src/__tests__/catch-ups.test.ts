import { join } from "node:path";
import { expect, test } from "vite-plus/test";
// The helpers first: they load the app, whose modules the catcher's import in a cycle.
import { atCatchUp, binding, fixtureRepo, testDataDir, testServer } from "./helpers.ts";
import { type CatchUps, startCatchUps } from "../catch-ups.ts";
import type { Binding, RepoContext } from "../fate/context.ts";
import { onTurnDone } from "../live.ts";
import type { TurnRow } from "../runner/cache.ts";

type Server = Awaited<ReturnType<typeof testServer>>;

/** A feature the tests put at Catch up. */
const AGENT = "2026-10-12-cli-tuis";
/** A second one, for the switch turned on with two pull requests behind. */
const OTHER = "2026-10-11-web-ui";

/** The default branch's tip the features at Catch up catch up with. */
const CATCH_UP = {
  branch: "main",
  commit: "c".repeat(40),
  subject: "finish(codex-runtime): Codex runtime + model settings",
};

const LINE =
  "Catching up with main, which moved to “finish(codex-runtime): Codex runtime + model settings”.";

/** A catcher of the server's one repository, on `using`, whose switch `enabled` gives. */
function catcher(server: Server, using: Binding, enabled: () => boolean): CatchUps {
  const context = (repo: string): RepoContext => ({
    binding: using,
    dataDir: server.dataDir,
    frames: server.frames,
    hosts: server.hosts,
    previews: server.previews,
    repo,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  });
  const catchUps = startCatchUps({
    context,
    enabled,
    repos: () => server.hosts.all().map((host) => host.path),
  });
  return catchUps;
}

/** A session of the folder whose one workflow turn, sent with `trigger` at `step`, ended `state`. */
async function endedRun(
  server: Server,
  folder: string,
  {
    caughtUpTo = null,
    state = "done",
    step = "pull-request",
  }: { caughtUpTo?: string | null; state?: "done" | "stopped"; step?: string } = {},
): Promise<{ session: string; turn: number }> {
  const { cache } = server.sessions;
  const repo = await server.sessions.mainRoot(server.repo);
  const session = cache.createSession({ agent: "fake", folder, nativeId: "n", repo, title: null });
  const turn = cache.addTurn({
    allowed: null,
    caughtUpTo,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step,
    trigger: "manual",
  });
  cache.endTurn(turn, { state });
  return { session: session.id, turn };
}

/** The turns the catcher added to the session: those after its first. */
const added = (server: Server, session: string): Array<TurnRow> =>
  server.sessions.cache.turns(session).slice(1);

/** Waits for the session's turns to end. */
async function settle(server: Server, session: string) {
  for (const turn of server.sessions.cache.turns(session)) {
    await server.sessions.settled(turn.id);
  }
}

/**
 * US2 1, more 1; review focus 4. Catches: no line, or the line on the agent's message; a second
 * send from two triggers at once; a run with the switch off.
 */
test("a feature at Catch up gets its run, with the line saying why", async () => {
  const using = atCatchUp(atCatchUp(binding, AGENT, CATCH_UP), OTHER, CATCH_UP);
  const server = await testServer(undefined, { binding: using });
  const first = await endedRun(server, AGENT);
  const second = await endedRun(server, OTHER);
  let enabled = false;
  const catchUps = catcher(server, using, () => enabled);
  await catchUps.runAll();
  expect(added(server, first.session)).toHaveLength(0);

  // The switch turned on, and main's watcher burst in the same tick.
  enabled = true;
  server.adapter.script([]);
  server.adapter.script([]);
  await Promise.all([catchUps.runAll(), catchUps.run(server.repo)]);

  // One turn each, counted before any ends: a second would be queued behind the first.
  expect(added(server, first.session)).toHaveLength(1);
  expect(added(server, second.session)).toHaveLength(1);
  for (const { session } of [first, second]) {
    await settle(server, session);
    const turns = added(server, session);
    expect(turns[0]).toMatchObject({
      caughtUpTo: CATCH_UP.commit,
      kind: "workflow",
      step: "catch-up",
      trigger: "catch-up",
    });
    // The line, before the message, shown to the human and never sent to the agent.
    const items = server.sessions.cache.items(turns[0].id, 0, 10);
    const line = items.findIndex((item) => item.kind === "system" && item.text === LINE);
    const message = items.findIndex((item) => item.kind === "message");
    expect(line).toBeGreaterThanOrEqual(0);
    expect(line).toBeLessThan(message);
  }
  expect(server.adapter.sent.map((sent) => sent.text).join("\n")).not.toContain("Catching up");
});

/**
 * US2 3, SC-002, US2 more 3, the edge case of a stopped catch-up; review focus 5. Catches: the
 * record read by the catcher's trigger only; a restart forgetting it; the catcher's own turn of an
 * older tip read as a conflict, never caught up again.
 */
test("one catch-up per tip, across a restart", async () => {
  const repo = fixtureRepo();
  const cache = join(testDataDir(), "runner.sqlite");
  // The tip the test moves: the feature reads it at each read.
  const moving = { ...CATCH_UP };
  const using = atCatchUp(binding, AGENT, moving);
  const server = await testServer(repo, { binding: using, cache });
  // A catch-up sent with Continue, which the human stopped and dismissed: it reads idle.
  const manual = await endedRun(server, AGENT, {
    caughtUpTo: CATCH_UP.commit,
    state: "stopped",
    step: "catch-up",
  });
  server.sessions.cache.dismiss(manual.turn);

  await catcher(server, using, () => true).run(repo);
  expect(added(server, manual.session)).toHaveLength(0);

  // A new server on the same cache.
  const restarted = await testServer(repo, { binding: using, cache });
  await catcher(restarted, using, () => true).run(repo);
  expect(added(restarted, manual.session)).toHaveLength(0);

  // Main moves: one catch-up, for the new tip.
  moving.commit = "d".repeat(40);
  restarted.adapter.script([]);
  const catchUps = catcher(restarted, using, () => true);
  await catchUps.run(repo);
  await settle(restarted, manual.session);
  expect(added(restarted, manual.session)).toMatchObject([{ caughtUpTo: "d".repeat(40) }]);

  // Its run ended done, still behind the same tip: a conflict, left to the human.
  await catchUps.run(repo);
  expect(added(restarted, manual.session)).toHaveLength(1);

  // Main moved again during it: its turn, of an older tip, is no conflict, and one more starts.
  moving.commit = "e".repeat(40);
  restarted.adapter.script([]);
  await catchUps.run(repo);
  await settle(restarted, manual.session);
  expect(added(restarted, manual.session).map((turn) => turn.caughtUpTo)).toEqual([
    "d".repeat(40),
    "e".repeat(40),
  ]);
});

/** US2 more 2. Catches: a send into a session at work; no run at its turn's end. */
test("a feature at work catches up once its turn ends", async () => {
  const using = atCatchUp(binding, AGENT, CATCH_UP);
  const server = await testServer(undefined, { binding: using });
  const { session } = await endedRun(server, AGENT);
  const catchUps = catcher(server, using, () => true);
  const ended = new Promise<void>((resolve) => {
    onTurnDone(server.sessions, (repo) => resolve(catchUps.run(repo)));
  });
  const { promise: held, resolve: release } = Promise.withResolvers<void>();
  server.adapter.script([() => held]);
  const chat = await server.sessions.send(server.repo, session, { text: "How is it going?" });

  await catchUps.run(server.repo);
  expect(added(server, session)).toHaveLength(1);

  server.adapter.script([]);
  release();
  await server.sessions.settled(chat.turn);
  await ended;
  await settle(server, session);
  const turns = added(server, session);
  expect(turns).toHaveLength(2);
  expect(turns[1]).toMatchObject({ caughtUpTo: CATCH_UP.commit, trigger: "catch-up" });
});

/** US2 more 4, SC-003. Catches: anything sent with the switch off. */
test("the switch off starts nothing when main moves", async () => {
  const using = atCatchUp(binding, AGENT, CATCH_UP);
  const server = await testServer(undefined, { binding: using });
  const { session } = await endedRun(server, AGENT);
  const catchUps = catcher(server, using, () => false);

  await catchUps.run(server.repo);
  await catchUps.runAll();

  expect(added(server, session)).toHaveLength(0);
});
