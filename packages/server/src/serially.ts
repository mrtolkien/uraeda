// One run at a time under a key: the catcher's repositories, and the scheduler's ticks.

/** A repository's runs: the one running, and the one asked meanwhile, which runs once after it. */
export type Runs = { next?: Promise<void>; running?: Promise<void> };

/**
 * Runs `work` under `key` once the run there ends: one asked while another waits joins it, so
 * triggers at once run once after the current run.
 */
export function serially(
  runs: Map<string, Runs>,
  key: string,
  work: () => Promise<void>,
): Promise<void> {
  let at = runs.get(key);
  if (at === undefined) {
    at = {};
    runs.set(key, at);
  }
  const of = at;
  if (of.next !== undefined) {
    return of.next;
  }
  const start = () => {
    // A failed run leaves the next one to run.
    const running = work().finally(() => {
      if (of.running === running) {
        of.running = undefined;
      }
    });
    of.running = running;
    return running;
  };
  if (of.running === undefined) {
    return start();
  }
  const next = of.running
    .catch(() => {})
    .then(() => {
      of.next = undefined;
      return start();
    });
  of.next = next;
  return next;
}
