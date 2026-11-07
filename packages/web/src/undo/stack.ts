// The tab's undo stack: the entries of what the tab did, the latest on top, and the redo side. It
// owns their order, the limit of 50, the run of moves, and the one-at-a-time replay; each entry
// owns how its action is undone and redone, and each page its labels and its place. The stack is
// module memory, which a reload empties.

export type UndoEntry = {
  /** Whether a commit since touched what it wrote: asks before undoing or redoing. */
  committed?: () => Promise<boolean>;
  /** What the action did, as its toast says it: "Deleted “Color themes”". */
  label: string;
  /**
   * A move of a list's row, which joins the run on top: `join(earlier)` makes the run's entry.
   * `list` names the list with its repository, `uraeda:inbox`: the stack is the tab's.
   */
  move?: { join: (earlier: UndoEntry) => UndoEntry; list: string };
  /**
   * Where it happened: the repository, by its name in the location, the page's path from it, and
   * the key of what to select. The stack is the tab's, across its repositories.
   */
  place: { path: string; repo: string; select?: string };
  /** Redoes the action: resolves with nothing once done, or with the refusal to show. */
  redo: () => Promise<string | undefined>;
  /** Undoes the action: resolves with nothing once done, or with the refusal to show. */
  undo: () => Promise<string | undefined>;
};

export type UndoOutcome =
  | { kind: "empty" }
  | { entry: UndoEntry; kind: "kept" }
  | { entry: UndoEntry; kind: "done" }
  | { entry: UndoEntry; kind: "refused"; reason: string };

/** Answers whether to go on with an entry committed since; `redo` tells a redo from an undo. */
type Ask = (entry: UndoEntry, redo: boolean) => Promise<boolean>;

export type UndoStack = {
  canRedo(): boolean;
  clear(): void;
  record(entry: UndoEntry): void;
  /** Redoes the entry undone last, in turn after any undo or redo still on its way. */
  redo(ask: Ask): Promise<UndoOutcome>;
  subscribe(listener: () => void): () => void;
  top(): UndoEntry | undefined;
  /** Undoes the top entry, in turn after any undo or redo still on its way. */
  undo(ask: Ask): Promise<UndoOutcome>;
};

/** The entries the stack keeps: the oldest goes past it. */
const LIMIT = 50;
/** A move joins the run on top while it comes less than this after the run's last move. */
const RUN_MS = 1000;

/**
 * A stack whose clock is `now`: the global `Date`'s, read at each record, so that a test faking
 * `Date` after this module loaded still sets the time of a run.
 */
export function createUndoStack(now: () => number = () => Date.now()): UndoStack {
  const done: Array<UndoEntry> = [];
  const undone: Array<UndoEntry> = [];
  const { notify, subscribe } = listened();
  // The run of moves on top: its entry, its list, and when its last move came. Any other entry recorded, an
  // undo or a redo pressed, or a clear ends it.
  let run: { at: number; entry: UndoEntry; list: string } | undefined;
  // Moves on at each entry recorded and each clear: an undo or a redo that lands after one leaves its
  // entry off both sides, as its reverse would come after the new action.
  let epoch = 0;
  // The replays in the order pressed: each starts once the one before it settled.
  let queue: Promise<unknown> = Promise.resolve();

  const keep = (entry: UndoEntry) => {
    done.push(entry);
    if (done.length > LIMIT) {
      done.splice(0, done.length - LIMIT);
    }
  };

  const record = (entry: UndoEntry) => {
    const time = now();
    const top = done.at(-1);
    undone.length = 0;
    epoch += 1;
    if (!entry.move) {
      keep(entry);
      run = undefined;
    } else if (
      top &&
      run?.entry === top &&
      run.list === entry.move.list &&
      time - run.at < RUN_MS
    ) {
      const joined = entry.move.join(top);
      done[done.length - 1] = joined;
      run = { at: time, entry: joined, list: entry.move.list };
    } else {
      keep(entry);
      run = { at: time, entry, list: entry.move.list };
    }
    notify();
  };

  // Replays the top entry of `from`, moving it to `to` once done, and dropping it once refused.
  const replay = async (redo: boolean, ask: Ask): Promise<UndoOutcome> => {
    const from = redo ? undone : done;
    const entry = from.at(-1);
    if (!entry) {
      return { kind: "empty" };
    }
    const started = epoch;
    if (entry.committed && (await entry.committed()) && !(await ask(entry, redo))) {
      return { entry, kind: "kept" };
    }
    const reason = await (redo ? entry.redo() : entry.undo());
    remove(from, entry);
    // An entry recorded or a clear while it was on its way leaves it off both sides: kept above the
    // new action, its undo would come after it.
    if (reason === undefined && epoch === started) {
      if (redo) {
        keep(entry);
      } else {
        undone.push(entry);
      }
    }
    notify();
    return reason === undefined ? { entry, kind: "done" } : { entry, kind: "refused", reason };
  };

  const enqueue = (redo: boolean, ask: Ask) => {
    // The press ends the run at once: a move recorded while the replay is on its way is its own entry.
    run = undefined;
    const outcome = queue.then(() => replay(redo, ask));
    queue = outcome.catch(() => undefined);
    return outcome;
  };

  return {
    canRedo: () => undone.length > 0,
    clear: () => {
      done.length = 0;
      undone.length = 0;
      run = undefined;
      epoch += 1;
      notify();
    },
    record,
    redo: (ask) => enqueue(true, ask),
    subscribe,
    top: () => done.at(-1),
    undo: (ask) => enqueue(false, ask),
  };
}

/** The stack's listeners, each called at every change. */
function listened() {
  const listeners = new Set<() => void>();
  return {
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function remove(entries: Array<UndoEntry>, entry: UndoEntry) {
  const index = entries.lastIndexOf(entry);
  if (index >= 0) {
    entries.splice(index, 1);
  }
}

/** The tab's one stack. */
export const undoStack: UndoStack = createUndoStack();
