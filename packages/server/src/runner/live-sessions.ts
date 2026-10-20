import type { SessionRow } from "./cache.ts";
import type { Live } from "./session-state.ts";

/**
 * The sessions this server keeps in memory while they are used, each with one lock for its sends
 * and turn starts. A session with nothing left in memory is forgotten.
 */
export class LiveSessions {
  #live = new Map<string, Live>();

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

  /**
   * Whether another session of the live session's change or feature works: they share its worktree,
   * so one works at a time. One works while its turn runs or starts, and, with `queued`, while a
   * turn of it waits.
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

  #others(live: Live): Array<Live> {
    if (live.folder === null) {
      return [];
    }
    return [...this.#live.values()].filter(
      (other) => other !== live && other.repo === live.repo && other.folder === live.folder,
    );
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
      live.messages.size === 0
    ) {
      clearTimeout(live.idle);
      this.#live.delete(live.id);
    }
  }
}
