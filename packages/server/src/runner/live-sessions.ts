import type { SessionRow } from "./cache.ts";
import type { Live } from "./session-state.ts";

/** Whether a turn of the session runs, starts, or waits. */
export const working = (live: Live) =>
  live.turn !== undefined || live.starting === true || live.queue.length > 0;

/**
 * The sessions this server keeps in memory while they are used, each with one lock for its sends
 * and turn starts. A session with nothing left in memory is forgotten.
 */
export class LiveSessions {
  #live = new Map<string, Live>();
  /** The folders, and the sessions without one, that a move or a drop holds, by `#key`. */
  #moving = new Set<string>();

  /** The session's state, created when it has none. */
  of(row: SessionRow): Live {
    let live = this.#live.get(row.id);
    if (!live) {
      live = {
        calls: 0,
        folder: row.folder,
        id: row.id,
        lock: Promise.resolve(),
        messages: new Map(),
        parent: row.parent,
        queue: [],
        repo: row.repo,
      };
      this.#live.set(row.id, live);
    }
    return live;
  }

  get(session: string): Live | undefined {
    return this.#live.get(session);
  }

  has(session: string): boolean {
    return this.#live.has(session);
  }

  values(): IterableIterator<Live> {
    return this.#live.values();
  }

  /** The sessions of the main checkout `root` with a turn running, starting, or waiting. */
  working(root: string): Array<Live> {
    return [...this.#live.values()].filter((live) => live.repo === root && working(live));
  }

  /**
   * Whether another session of the live session's change or feature works: they share its worktree,
   * so one works at a time. One works while its turn runs or starts, and, with `queued`, while a
   * turn of it waits. A sub-session works in its task's worktree, beside its parent and the other
   * sub-sessions: it neither waits for its folder's sessions nor makes them wait.
   */
  otherWorking(live: Live, { queued }: { queued: boolean }): boolean {
    return this.#others(live).some(
      (other) =>
        other.turn !== undefined || other.starting === true || (queued && other.queue.length > 0),
    );
  }

  /** The other sessions of the live session's change or feature whose turn waits, none running. */
  waiting(live: Live): Array<Live> {
    return this.#others(live).filter((other) => other.turn === undefined && other.queue.length > 0);
  }

  /** The other sessions of the live session's change or feature, sub-sessions left out. */
  #others(live: Live): Array<Live> {
    if (live.folder === null || live.parent !== null) {
      return [];
    }
    return [...this.#live.values()].filter(
      (other) =>
        other !== live &&
        other.parent === null &&
        other.repo === live.repo &&
        other.folder === live.folder,
    );
  }

  /**
   * Holds the change or the feature, or the session without one, while it moves or is dropped: its
   * sessions take no message until `release`. None when a move holds it already.
   */
  hold(target: { folder: string; repo: string } | { session: string }): (() => void) | undefined {
    const key = this.#key(target);
    if (this.#moving.has(key)) {
      return undefined;
    }
    this.#moving.add(key);
    return () => this.#moving.delete(key);
  }

  /** Whether a move or a drop holds the change or the feature. */
  holds(target: { folder: string; repo: string }): boolean {
    return this.#moving.has(this.#key(target));
  }

  /** Whether a move or a drop holds the session, or its change or feature. */
  moving(live: Live): boolean {
    return (
      this.#moving.has(this.#key({ session: live.id })) ||
      (live.folder !== null &&
        this.#moving.has(this.#key({ folder: live.folder, repo: live.repo })))
    );
  }

  #key(target: { folder: string; repo: string } | { session: string }): string {
    return "session" in target ? `session:${target.session}` : `${target.repo}:${target.folder}`;
  }

  /** Runs `body` after the session's earlier sends and turn starts. */
  serial<T>(live: Live, body: () => Promise<T>): Promise<T> {
    live.calls++;
    const run = live.lock.then(body, body).finally(() => {
      live.calls--;
      this.prune(live);
    });
    live.lock = run.catch(() => {});
    return run;
  }

  /**
   * Forgets the session once nothing of it is left in memory: no process, no turn running or
   * queued, no message the agent may read, and no call on its way.
   */
  prune(live: Live) {
    if (
      this.#live.get(live.id) === live &&
      live.calls === 0 &&
      live.proc === undefined &&
      live.turn === undefined &&
      live.queue.length === 0 &&
      live.messages.size === 0 &&
      live.held === undefined
    ) {
      clearTimeout(live.idle);
      this.#live.delete(live.id);
    }
  }
}
