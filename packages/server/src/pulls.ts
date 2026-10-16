// A repository's pull requests, asked of `gh` through the core, which keeps the latest snapshot
// for every read: at start, after each branch move the watcher reports, and every minute while a
// branch is past its last task. A snapshot that changed publishes the repository's features.
import type { Changes } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";

/** How often the pull requests are asked again while a branch is past its last task. */
export const PULL_REQUESTS_EVERY_MS = 60_000;

/** The steps whose pull request's state decides the next one. */
const PAST_LAST_TASK = new Set([
  "final-review",
  "finish",
  "pull-request",
  "pull-request-changes",
  "pull-request-unknown",
]);

export type PullRequests = {
  /** A watcher's burst: a branch moved, or a feature, branch, or worktree came or went. */
  onChanges(changes: Changes): void;
  stop(): void;
};

/**
 * Keeps the pull requests of the repository at `path` fresh. `changed` gets the repository's
 * features' folders when a refresh changed the snapshot. Refreshes run one at a time: one asked
 * meanwhile runs once the current one ends. A failure is logged once, until a refresh succeeds.
 */
export function startPullRequests(
  path: string,
  binding: Binding,
  changed: (folders: Array<string>) => void,
): PullRequests {
  let stopped = false;
  let running = false;
  let again = false;
  let failing = false;
  const refresh = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    if (running) {
      again = true;
      return;
    }
    running = true;
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
    } finally {
      running = false;
      if (again) {
        again = false;
        void refresh();
      }
    }
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
      if (changes.features.length > 0 || changes.workspace) {
        void refresh();
      }
    },
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
