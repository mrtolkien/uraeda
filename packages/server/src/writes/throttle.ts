// A write's streamed output, sent to the tabs at most once each 100 ms: a hook printing thousands of
// lines sends the record a few times a second, and its end at once.

/** How often a write's streamed output is sent, at most. */
export const OUTPUT_MS = 100;

/**
 * Sends with `send` at most once each `OUTPUT_MS` while `soon` is called, the last change sent once
 * the time is up; `now` sends at once, the change waiting with it.
 */
export class Throttle {
  #send: () => void;
  #last = -Infinity;
  #timer?: ReturnType<typeof setTimeout>;

  constructor(send: () => void) {
    this.#send = send;
  }

  /** Sends now if nothing was sent for `OUTPUT_MS`, or once it is up. */
  soon(): void {
    if (this.#timer !== undefined) {
      return;
    }
    const wait = this.#last + OUTPUT_MS - Date.now();
    if (wait <= 0) {
      this.now();
      return;
    }
    this.#timer = setTimeout(() => this.now(), wait);
  }

  /** Sends at once: what `soon` kept waiting goes with it. */
  now(): void {
    this.cancel();
    this.#last = Date.now();
    this.#send();
  }

  /** Drops what `soon` kept waiting, unsent: the end of the write is sent apart. */
  cancel(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}
