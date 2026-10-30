// The messages sent to a feature while its start is still in the write queue: kept in memory only,
// sent once the start lands, dropped if it is refused or the server stops, never sent twice. The
// server's stop drops those kept for features' commits too.
import type { SessionCache } from "./cache.ts";
import type { SendInput } from "./send-input.ts";

/** A start under way: the session its messages go to, once one is kept, and the messages. */
type Waiting = {
  inputs: Array<SendInput>;
  /** Told of the messages' text as each one is kept, for the start's write. */
  onKept: (text: string) => void;
  session?: string;
};

/** The key of a start: its repository's main checkout, and its folder. */
const keyOf = (root: string, folder: string) => `${root}\0${folder}`;

/**
 * The starts still in the write queue, by their repository's main checkout and their folder, and
 * the messages sent to each meanwhile. The messages go to the feature's session, made for them,
 * which a start that never lands removes while it has no turn.
 */
export class StartMessages {
  #cache: SessionCache;
  #waiting = new Map<string, Waiting>();
  /** What drops the messages kept for features' commits as the server stops. */
  #stops = new Set<() => void>();

  constructor(cache: SessionCache) {
    this.#cache = cache;
  }

  /** Opens the start of `folder`: the messages sent to it wait until `take` or `drop`. */
  open(root: string, folder: string, onKept: (text: string) => void): void {
    this.#waiting.set(keyOf(root, folder), { inputs: [], onKept });
  }

  /** Whether the start of `folder` is still in the queue, keeping its messages. */
  waits(root: string, folder: string): boolean {
    return this.#waiting.has(keyOf(root, folder));
  }

  /**
   * Keeps a message for the start of `folder`, to go to `session`, the feature's. False when the
   * start is no longer in the queue: the message goes as to any feature.
   */
  keep(root: string, folder: string, session: string, input: SendInput): boolean {
    const waiting = this.#waiting.get(keyOf(root, folder));
    if (!waiting) {
      return false;
    }
    waiting.session = session;
    waiting.inputs.push(input);
    waiting.onKept(waiting.inputs.map(({ text }) => text).join("\n\n"));
    return true;
  }

  /**
   * Closes the start of `folder`, which landed, and takes its messages, to send in order to their
   * session: taken once, so none is sent twice.
   */
  take(root: string, folder: string): { inputs: Array<SendInput>; session?: string } {
    const key = keyOf(root, folder);
    const waiting = this.#waiting.get(key);
    this.#waiting.delete(key);
    return waiting?.session === undefined
      ? { inputs: [] }
      : { inputs: waiting.inputs, session: waiting.session };
  }

  /**
   * Closes the start of `folder`, which was refused, its messages dropped: the start's write keeps
   * their text for the composer. The session made for them goes, while it has no turn.
   */
  drop(root: string, folder: string): void {
    this.#remove(keyOf(root, folder));
  }

  /**
   * Runs `drop` as the server stops, until the returned function forgets it: it drops messages kept
   * for a feature's commits, and removes the sessions made for them.
   */
  onStop(drop: () => void): () => void {
    this.#stops.add(drop);
    return () => this.#stops.delete(drop);
  }

  /**
   * Drops every start's messages, and those kept for features' commits, as the server stops: a
   * start or a commit landing after sends nothing.
   */
  dropAll(): void {
    for (const key of this.#waiting.keys()) {
      this.#remove(key);
    }
    for (const drop of this.#stops) {
      drop();
    }
    this.#stops.clear();
  }

  #remove(key: string): void {
    const session = this.#waiting.get(key)?.session;
    this.#waiting.delete(key);
    if (session !== undefined) {
      this.#cache.removeEmptySession(session);
    }
  }
}
