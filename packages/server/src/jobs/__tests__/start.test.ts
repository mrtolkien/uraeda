import type { Job, Jobs } from "uraeda-binding";
import { expect, onTestFinished, test } from "vite-plus/test";
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

/**
 * Review 07, finding 5. Catches: a job saved, resumed, or switched on up to 30 seconds before its
 * time losing that run, because the moment it was first seen (R2) was the next tick's, after its
 * time, though its card read "Today at 3:00". The settings' read ticks too.
 */
test("a job written just before its time runs at it", async () => {
  const state: { clock: Date; jobs: Jobs } = {
    clock: new Date("2026-11-11T02:59:30"),
    jobs: { jobs: [] },
  };
  const using: Binding = { ...binding, readJobs: async () => state.jobs };
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
  const jobs = startJobs(shared, { every: null, now: () => state.clock });
  onTestFinished(() => jobs.stop());
  await jobs.tick();
  server.adapter.script([]);
  const created: Array<string> = [];
  server.sessions.cache.onCreated((row) => created.push(row.id));

  // Saved at 02:59:45: the file's read sees it, 15 seconds before its time.
  state.clock = new Date("2026-11-11T02:59:45");
  state.jobs = { jobs: [{ ...job, repositories: [server.name] }] };
  await server.settings.reload();
  await turns(50);
  // The timer's next look, after 03:00: the time starts, once.
  state.clock = new Date("2026-11-11T03:00:10");
  await jobs.tick();
  await jobs.settled();
  expect(created).toHaveLength(1);
  expect(
    server.sessions.cache.jobs.history(NAME, await server.sessions.mainRoot(server.repo)),
  ).toHaveLength(1);

  // A job added after its time still waits for the next one.
  state.jobs = { jobs: [{ ...job, name: "Late", repositories: [server.name] }] };
  state.clock = new Date("2026-11-12T03:00:20");
  await server.settings.reload();
  await turns(50);
  await jobs.tick();
  await jobs.settled();
  expect(created).toHaveLength(1);
});
