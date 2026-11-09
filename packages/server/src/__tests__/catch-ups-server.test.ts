// The catcher as the server wires it (review): through `startServer`, its triggers are the
// settings' changes, the pull requests' refresh, and the watcher's bursts, and its stop ends them.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";
import type { Changes, WatchHandle } from "uraeda-binding";
import { afterEach, expect, test } from "vite-plus/test";
import type { Binding } from "../fate/context.ts";
import { FakeAdapter } from "../runner/fake.ts";
import { startServer } from "../server.ts";
import { testSettings } from "../testing.ts";
import { atStep, binding, fixtureRepo, type PastLastTask } from "./helpers.ts";

/** The feature the tests move from step to step. */
const AGENT = "2026-10-12-cli-tuis";

/** The default branch's tip the feature at Catch up catches up with. */
const CATCH_UP: PastLastTask = {
  catchUp: {
    branch: "main",
    commit: "c".repeat(40),
    subject: "finish(codex-runtime): Codex runtime + model settings",
  },
  name: "catch-up",
  pullRequest: "behind",
  waitsOn: "agent",
};
/** The pull request ready for review, main not moved. */
const READY: PastLastTask = { name: "pull-request", waitsOn: "human" };
/** The pull request's state `gh` has not told yet. */
const UNKNOWN: PastLastTask = { name: "pull-request-unknown", waitsOn: "human" };

/** The switch's line in the settings file. */
const SWITCH_ON = "[runs]\ncatch_up_pull_requests = true\n";

/** How long a trigger may take to reach the catcher: a settings change is read from its file. */
const POLL = { timeout: 5000 };

/** The servers of a test, stopped after it. */
const started: Array<{ stop: () => Promise<void> }> = [];

afterEach(async () => {
  for (const server of started.splice(0)) {
    await server.stop();
  }
});

/**
 * The core's binding with the feature at `fake.step`, the pull requests' refresh `fake.refresh`,
 * and the watcher's bursts sent by `fake.burst`.
 */
function faked(step: PastLastTask) {
  const fake = {
    burst: (_: Changes) => {},
    refresh: async () => false,
    step,
  };
  const at = () => atStep(binding, AGENT, fake.step);
  const using: Binding = {
    ...binding,
    nextStep: (repo, folder) => at().nextStep(repo, folder),
    readFeature: (repo, folder) => at().readFeature(repo, folder),
    readWorkspace: (repo) => at().readWorkspace(repo),
    refreshPullRequests: () => fake.refresh(),
    watch: (_, callback) => {
      fake.burst = callback;
      return { close: () => {} } as WatchHandle;
    },
  };
  return { fake, using };
}

/**
 * A server on `using` and the fake agent, which ends every turn, its settings in `config`, with an
 * idle session of the feature: its run ended at the pull request. Stopped after the test.
 */
async function start(using: Binding, config: string) {
  const repo = fixtureRepo();
  const adapter = new FakeAdapter();
  adapter.fallback = () => [];
  const server = await startServer({
    agents: { fake: adapter },
    allowOrigins: [],
    binding: using,
    dataDir: temporaryFolder("uraeda-data"),
    given: false,
    port: 4310,
    repo,
    settings: await testSettings({ dir: config }),
    signIn: false,
  });
  started.push(server);
  const { cache } = server.sessions;
  const root = await server.sessions.mainRoot(repo);
  const session = cache.createSession({
    agent: "fake",
    folder: AGENT,
    nativeId: "n",
    repo: root,
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    caughtUpTo: null,
    kind: "workflow",
    sessionId: session.id,
    state: "running",
    step: "pull-request",
    trigger: "manual",
  });
  cache.endTurn(turn, { state: "done" });
  /** The session's catch-up turns. */
  const catchUps = () =>
    cache.turns(session.id).filter((row) => row.step === "catch-up" && row.trigger === "catch-up");
  return { adapter, catchUps, server };
}

/** A config folder, its switch on when `on`. */
function config(on: boolean): string {
  const dir = temporaryFolder("uraeda-config");
  if (on) {
    writeFileSync(join(dir, "config.toml"), SWITCH_ON);
  }
  return dir;
}

/**
 * Review: `gh` alone sees a pull request's state known at start, a draft made ready, or changes
 * requested answered. Catches: a refresh changing the snapshot that never reaches the catcher.
 */
test("a refresh of the pull requests that moves a feature to Catch up catches it up", async () => {
  const { fake, using } = faked(UNKNOWN);
  const { promise: held, resolve: release } = Promise.withResolvers<boolean>();
  fake.refresh = () => held;
  const { catchUps } = await start(using, config(true));
  expect(catchUps()).toHaveLength(0);

  fake.step = CATCH_UP;
  release(true);

  await expect.poll(() => catchUps().length, POLL).toBe(1);
});

/** A burst of the watcher: main moved under the feature's branch. */
const MOVED: Changes = {
  branchDecisions: [],
  decisions: false,
  features: [AGENT],
  files: [],
  git: true,
  inbox: false,
  priorities: false,
  workspace: false,
};

/** US2 more 1, through the server. Catches: the settings' changes not reaching the catcher. */
test("turning the switch on in the settings catches up a feature at Catch up", async () => {
  const { using } = faked(CATCH_UP);
  const dir = config(false);
  const { catchUps } = await start(using, dir);
  expect(catchUps()).toHaveLength(0);

  writeFileSync(join(dir, "config.toml"), SWITCH_ON);

  await expect.poll(() => catchUps().length, POLL).toBe(1);
});

/** US2 1, SC-001, through the server. Catches: the watcher's bursts not reaching the catcher. */
test("a watcher burst moving main catches up the feature", async () => {
  const { fake, using } = faked(READY);
  const { catchUps } = await start(using, config(true));
  // Main moves as the burst's refresh runs, the snapshot unchanged: only the burst settles.
  fake.refresh = async () => {
    fake.step = CATCH_UP;
    return false;
  };

  fake.burst(MOVED);

  await expect.poll(() => catchUps().length, POLL).toBe(1);
});

/** Review: the server stopped. Catches: a trigger left running the catcher after the stop. */
test("a stopped server catches up nothing", async () => {
  const { fake, using } = faked(READY);
  const dir = config(true);
  const { adapter, server } = await start(using, dir);
  await server.stop();

  fake.step = CATCH_UP;
  fake.burst(MOVED);
  writeFileSync(join(dir, "config.toml"), `${SWITCH_ON}\n`);
  await new Promise((resolve) => setTimeout(resolve, 300));

  expect(adapter.sent).toHaveLength(0);
});
