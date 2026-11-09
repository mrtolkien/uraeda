// A repository's pull requests, asked of `gh` through the core, which keeps the latest snapshot
// for every read: at start, after each branch move the watcher reports, and every minute while a
// branch is past its last task. A snapshot that changed publishes the repository's features.
import type { Changes } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { CATCH_UP } from "./runner/status.ts";

/** How often the pull requests are asked again while a branch is past its last task. */
export const PULL_REQUESTS_EVERY_MS = 60_000;

/** The steps whose pull request's state decides the next one. */
const PAST_LAST_TASK = new Set([
  CATCH_UP,
  "final-review",
  "finish",
  "pull-request",
  "pull-request-changes",
  "pull-request-unknown",
  "push",
]);

export type PullRequests = {
  /**
   * A watcher's burst: a branch moved, or a feature, branch, or worktree came or went. The refresh
   * it asks, done once it ends, or undefined when it asks none.
   */
  onChanges(changes: Changes): Promise<void> | undefined;
  stop(): void;
};

/**
 * Keeps the pull requests of the repository at `path` fresh. `changed` gets the repository's
 * features' folders when a refresh changed the snapshot. Refreshes run one at a time: those asked
 * meanwhile run once, after the current one ends. A failure is logged once, until a refresh
 * succeeds.
 */
export function startPullRequests(
  path: string,
  binding: Binding,
  changed: (folders: Array<string>) => void,
): PullRequests {
  let stopped = false;
  let failing = false;
  let running: Promise<void> | undefined;
  let next: Promise<void> | undefined;
  const once = async (): Promise<void> => {
    try {
      if ((await binding.refreshPullRequests(path)) && !stopped) {
        changed((await binding.readWorkspace(path)).features.map((feature) => feature.folder));
      }
      failing = false;
    } catch (error) {
      if (!failing) {
        process.stderr.write(`uraeda-server: pull requests of ${path}: ${String(error)}\n`);
      }
      failing = true;
    }
  };
  const start = (): Promise<void> => {
    const current = once().finally(() => {
      if (running === current) {
        running = undefined;
      }
    });
    running = current;
    return current;
  };
  const refresh = (): Promise<void> => {
    if (stopped) {
      return Promise.resolve();
    }
    if (next !== undefined) {
      return next;
    }
    if (running === undefined) {
      return start();
    }
    const queued = running.then(() => {
      next = undefined;
      return stopped ? undefined : start();
    });
    next = queued;
    return queued;
  };
  const tick = async () => {
    try {
      const { features } = await binding.readWorkspace(path);
      if (features.some((feature) => PAST_LAST_TASK.has(feature.step.name))) {
        await refresh();
      }
    } catch {
      // The repository is read again at the next tick.
    }
  };
  void refresh();
  const timer = setInterval(() => void tick(), PULL_REQUESTS_EVERY_MS);
  timer.unref?.();
  return {
    onChanges(changes) {
      return changes.features.length > 0 || changes.workspace ? refresh() : undefined;
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
