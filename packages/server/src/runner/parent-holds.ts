// The parents' continues that wait for their sub-sessions (R21): a workflow session's run goes on
// only once the implementers it started answered, or it would call its tools again before.
import { subSessionsWork } from "./sub-sessions.ts";
import type { SessionContext } from "./session-state.ts";

/**
 * The continues of the parents whose sub-sessions work or wait to continue, by the parent: each is
 * fired once the last of them ends or stops waiting.
 */
export class ParentHolds {
  #context: SessionContext;
  #fire: (turn: number) => void;
  /** The continue of each parent that waits for its sub-sessions to end, by the parent. */
  #held = new Map<string, number>();

  constructor(context: SessionContext, fire: (turn: number) => void) {
    this.#context = context;
    this.#fire = fire;
  }

  /**
   * Holds the continue of turn `turn` of `parent` while one of the parent's sub-sessions works or
   * waits to continue: whether it held it.
   */
  hold(parent: string, turn: number): boolean {
    if (!subSessionsWork(this.#context, parent)) {
      return false;
    }
    this.#held.set(parent, turn);
    return true;
  }

  /** Forgets the held continue of `parent`: it was cancelled. */
  drop(parent: string): void {
    this.#held.delete(parent);
  }

  /**
   * Fires the held continue of `parent`, the parent of a sub-session that ended, or stopped waiting,
   * once none of its sub-sessions works or waits to continue.
   */
  subEnded(parent: string | null): void {
    const turn = parent === null ? undefined : this.#held.get(parent);
    if (parent !== null && turn !== undefined && !subSessionsWork(this.#context, parent)) {
      this.#held.delete(parent);
      this.#fire(turn);
    }
  }
}
