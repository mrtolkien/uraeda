import { join } from "node:path";
import type { Changes, WatchHandle } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { pages } from "./fate/runs.ts";
import { PRIORITIES_ID, RUNNER_ID, WORKSPACE_ID } from "./fate/views.ts";
import { live } from "./fate.ts";
import type { Adapter } from "./runner/adapter.ts";
import { RunCache } from "./runner/cache.ts";
import { Runner, type RunnerChange, type RunnerOptions } from "./runner/runner.ts";

/** A run's live updates are sent at most this often while its events arrive. */
export const RUN_UPDATE_MS = 250;
/** How often the server checks that the agent still works. */
export const CHECK_EVERY_MS = 60_000;

let sent = 0;
/** A live update's event ID, unique in this process. */
const eventId = (topic: string) => `${topic}:${Date.now()}:${sent++}`;

/** Sends live updates for each change the core's watcher reports. */
export function publish(changes: Changes) {
  const eventId = `${Date.now()}`;
  live.update("Workspace", WORKSPACE_ID, { eventId: `workspace:${eventId}` });
  for (const folder of changes.features) {
    live.update("Feature", folder, { eventId: `feature:${folder}:${eventId}` });
  }
  for (const file of changes.files) {
    live.update("WorkflowFile", file, { eventId: `file:${file}:${eventId}` });
  }
  if (changes.priorities) {
    live.update("Priorities", PRIORITIES_ID, { eventId: `priorities:${eventId}` });
  }
}

/**
 * The watch of each repository. The core stops watching once its handle is collected, so the
 * server keeps them for as long as it runs.
 */
const watches = new Map<string, WatchHandle>();

/** Stops watching a repository, as the browser tests do once done with a copy of the fixture. */
export function stopLive(repo: string): void {
  watches.get(repo)?.close();
  watches.delete(repo);
}

/** Watches the repository, once, and publishes its changes until the handle is closed. */
export function startLive(binding: Binding, repo: string): WatchHandle {
  let handle = watches.get(repo);
  if (!handle) {
    handle = binding.watch(repo, publish);
    watches.set(repo, handle);
  }
  return handle;
}

/**
 * Sends the live updates of the runner's changes. A run's record and its last two log pages, where
 * a tool call may finish, go out at most every 250 ms while events arrive, and right away when its
 * state changes, with its feature's runs and the workspace's running folders.
 */
export function runPublisher(cache: RunCache): (change: RunnerChange) => void {
  /** The runs going on: when each was last sent, and its pending update. */
  const runs = new Map<number, { last: number; timer?: ReturnType<typeof setTimeout> }>();
  const send = (run: number) => {
    live.update("Run", String(run), { eventId: eventId(`run:${run}`) });
    const count = pages(cache, run);
    for (const page of [count - 2, count - 1].filter((page) => page >= 0)) {
      live.update("RunLog", `${run}:${page}`, { eventId: eventId(`log:${run}:${page}`) });
    }
  };
  return (change) => {
    if ("runner" in change) {
      live.update("Runner", RUNNER_ID, { eventId: eventId("runner") });
      return;
    }
    const entry = runs.get(change.run);
    if (!entry || change.state !== "running") {
      clearTimeout(entry?.timer);
      if (change.state === "running") {
        runs.set(change.run, { last: Date.now() });
      } else {
        runs.delete(change.run);
      }
      send(change.run);
      live.update("Feature", change.folder, { eventId: eventId(`feature:${change.folder}`) });
      live.update("Workspace", WORKSPACE_ID, { eventId: eventId("workspace") });
      return;
    }
    if (entry.timer) {
      return;
    }
    const wait = entry.last + RUN_UPDATE_MS - Date.now();
    if (wait <= 0) {
      entry.last = Date.now();
      send(change.run);
      return;
    }
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      entry.last = Date.now();
      send(change.run);
    }, wait);
  };
}

/** A runner whose changes are sent as live updates. */
export function createRunner(options: Omit<RunnerOptions, "onChange">): Runner {
  return new Runner({ ...options, onChange: runPublisher(options.cache) });
}

/**
 * The server's runner: its cache opened in the data folder, the runs a stopped server left marked
 * stopped, and the agent checked now and every 60 seconds. `stop` stops its runs.
 */
export async function startRunner(options: {
  adapter: Adapter;
  binding: Binding;
  dataDir: string;
  pluginDir: string;
}): Promise<{ runner: Runner; stop: () => Promise<void> }> {
  const cache = RunCache.open(join(options.dataDir, "runner.sqlite"));
  cache.interrupted("Stopped: the server stopped while it ran.");
  const runner = createRunner({ ...options, cache });
  await runner.check();
  const timer = setInterval(() => void runner.check(), CHECK_EVERY_MS);
  timer.unref();
  return {
    runner,
    stop: async () => {
      clearInterval(timer);
      await runner.stopAll();
      runner.close();
    },
  };
}
