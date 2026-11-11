// The minute between two runs, cut short by the scheduler's stop.

/** Waits `ms`, or until `signal` aborts, and leaves no listener on it once the timer fires. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise<void>((done) => {
    const stop = () => {
      clearTimeout(timer);
      done();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      done();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}
