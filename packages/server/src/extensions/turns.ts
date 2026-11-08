// Which runtimes have a session at work, so a runtime's reload waits until its turns end: a runtime
// replaced mid-turn would lose the process the turn runs on.
import type { SessionRow } from "../runner/cache.ts";
import type { Sessions } from "../runner/sessions.ts";

/** A session's name for people, in "reloads when the turn of … ends". */
export function sessionTitle(row: Pick<SessionRow, "folder" | "title">): string {
  return row.title ?? row.folder ?? "a chat";
}

/**
 * The sessions at work, by runtime: told of each session's change, it asks the session manager
 * whether the session still works. `busy` names the one at work longest; `idle` resolves once none
 * is. `onBusy` is called as a runtime with none at work gets one, and `onTitle` as the session
 * `busy` names ends while another of its runtime works on.
 */
export class RuntimeTurns {
  readonly #sessions: Pick<Sessions, "cache" | "sessionWorking">;
  readonly #onBusy: (runtime: string, title: string) => void;
  readonly #onTitle: (runtime: string, title: string) => void;
  /** The sessions at work: their runtime and title, by session ID. */
  readonly #working = new Map<string, { runtime: string; title: string }>();
  readonly #waiters = new Map<string, Array<() => void>>();

  constructor(
    sessions: Pick<Sessions, "cache" | "sessionWorking">,
    onBusy: (runtime: string, title: string) => void,
    onTitle: (runtime: string, title: string) => void = () => {},
  ) {
    this.#sessions = sessions;
    this.#onBusy = onBusy;
    this.#onTitle = onTitle;
  }

  /** Reads whether the session works now, after a change of it. */
  changed(session: string): void {
    const row = this.#sessions.cache.session(session);
    const known = this.#working.get(session);
    if (row && this.#sessions.sessionWorking(session)) {
      if (!known) {
        const wasIdle = this.busy(row.agent) === undefined;
        this.#working.set(session, { runtime: row.agent, title: sessionTitle(row) });
        if (wasIdle) {
          this.#onBusy(row.agent, sessionTitle(row));
        }
      }
      return;
    }
    if (known) {
      const shown = this.busy(known.runtime);
      this.#working.delete(session);
      const next = this.busy(known.runtime);
      if (next === undefined) {
        const waiters = this.#waiters.get(known.runtime) ?? [];
        this.#waiters.delete(known.runtime);
        waiters.forEach((resolve) => resolve());
      } else if (next !== shown) {
        this.#onTitle(known.runtime, next);
      }
    }
  }

  /** The title of the runtime's session at work longest, or undefined when none is. */
  busy(runtime: string): string | undefined {
    for (const working of this.#working.values()) {
      if (working.runtime === runtime) {
        return working.title;
      }
    }
    return undefined;
  }

  /** Resolves once no session of the runtime works, at once when none does. */
  idle(runtime: string): Promise<void> {
    if (this.busy(runtime) === undefined) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const waiters = this.#waiters.get(runtime) ?? [];
      this.#waiters.set(runtime, waiters);
      waiters.push(resolve);
    });
  }

  /** Lets every wait go, as the server stops. */
  close(): void {
    for (const waiters of this.#waiters.values()) {
      waiters.forEach((resolve) => resolve());
    }
    this.#waiters.clear();
    this.#working.clear();
  }
}
