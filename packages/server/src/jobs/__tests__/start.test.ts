import type { Job, Jobs } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
// The helpers first: they load the app, whose modules the jobs' imports in a cycle.
import { binding, testFeatureOptions, testServer } from "../../__tests__/helpers.ts";
import type { Binding } from "../../fate/context.ts";
import { startRun } from "../run.ts";
import { startJobs } from "../start.ts";

const NAME = "Dependencies";

const OFFER = "```uraeda-offer change\n# Upgrade three dependencies\n\nUpgrade a, b, and c.\n```\n";

const job: Job = {
  agent: "fake",
  name: NAME,
  on: true,
  prompt: "Check the dependencies and report what is outdated.",
  reportOnly: false,
  repositories: ["uraeda"],
  schedule: { hour: 3, kind: "daily", minute: 0 },
  scheduleText: "daily 03:00",
};

/** Turns of the event loop, a bound that does not read the clock. */
async function turns(count: number) {
  for (let turn = 0; turn < count; turn += 1) {
    await new Promise((done) => setImmediate(done));
  }
}

/**
 * Codex P2. Catches: a stop that resolves while an acceptance is awaiting the settings or `toChange`,
 * so the server stops its sessions and unloads its extensions under a change being created.
 */
test("the stop waits for an acceptance in flight", async () => {
  const state: { gate?: Promise<void>; jobs: Jobs } = { jobs: { jobs: [job] } };
  const using: Binding = {
    ...binding,
    readJobs: async () => {
      await state.gate;
      return state.jobs;
    },
  };
  const server = await testServer(undefined, { binding: using });
  const shared = {
    binding: using,
    dataDir: server.dataDir,
    featureOptions: testFeatureOptions(server.dataDir, server.settings, using),
    frames: server.frames,
    hosts: server.hosts,
    previews: server.previews,
    sessions: server.sessions,
    settings: server.settings,
    themes: server.themes,
  };
  const jobs = startJobs(shared);
  // The first look of the scheduler is done: only the acceptance reads the settings from here on.
  await jobs.tick();
  server.adapter.fallback = () => [];
  const gate = Promise.withResolvers<void>();
  state.gate = gate.promise;
  server.adapter.script([{ text: OFFER, type: "text" }]);
  const run = await startRun({ ...shared, repo: server.repo }, job, {
    at: Date.now(),
    due: 1,
    trigger: "schedule",
  });
  const session = run!.session;
  for (const turn of server.sessions.cache.turns(session)) {
    await server.sessions.settled(turn.id);
  }

  // The turn ended and the acceptance waits for the settings: the server stops.
  let stopped = false;
  const stopping = jobs.stop().then(() => {
    stopped = true;
  });
  await turns(50);
  expect(stopped).toBe(false);
  gate.resolve();
  await stopping;
  // The change started before the stop resolved, not after it.
  expect(server.sessions.cache.session(session)?.folder).not.toBeNull();
  for (const turn of server.sessions.cache.turns(session)) {
    await server.sessions.settled(turn.id);
  }
});
