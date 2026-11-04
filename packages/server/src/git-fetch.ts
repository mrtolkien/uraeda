// A repository's fetcher: `origin` fetched at start, on the Git page's open, and every 5 minutes, in
// the repository's write queue after the writes made before it, outside its record, so no toast
// shows it. Its last failure is kept for the page until a fetch succeeds.
import type { Binding } from "./fate/context.ts";
import { reasonOf } from "./reason.ts";
import type { WriteQueue } from "./writes/queue.ts";

/** How often a repository is fetched. */
export const FETCH_EVERY_MS = 300_000;

export type Fetcher = {
  /** The last fetch's failure, or undefined once one succeeded. */
  failure(): string | undefined;
  /** Fetches now, or joins the fetch running; it resolves once it ran, failed or not. */
  now(): Promise<void>;
  /** Keeps the outcome of a fetch made elsewhere, the human's: its failure, or none. */
  settle(error?: unknown): void;
  stop(): void;
};

/**
 * Fetches the repository at `path` at once and every `FETCH_EVERY_MS`, one fetch at a time, telling
 * `changed` when its failure changed. What a fetch brings reaches the pages through the watcher,
 * which sees `FETCH_HEAD` change.
 */
export function startFetcher(
  path: string,
  binding: Binding,
  queue: WriteQueue,
  changed: () => void,
): Fetcher {
  let stopped = false;
  let running: Promise<void> | undefined;
  let failure: string | undefined;
  const settle = (error?: unknown) => {
    const before = failure;
    failure = error === undefined ? undefined : reasonOf(error);
    if (failure !== before && !stopped) {
      changed();
    }
  };
  const now = (): Promise<void> => {
    if (stopped) {
      return Promise.resolve();
    }
    // Its outcome is kept, and the next call fetches again, as it lands: before the queue's next.
    running ??= queue
      .background(async (onOutput) => {
        try {
          await binding.gitFetch(path, onOutput);
          settle();
        } catch (error) {
          settle(error);
        } finally {
          running = undefined;
        }
      })
      .then(() => {});
    return running;
  };
  void now();
  const timer = setInterval(() => void now(), FETCH_EVERY_MS);
  timer.unref?.();
  return {
    failure: () => failure,
    now,
    settle,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
