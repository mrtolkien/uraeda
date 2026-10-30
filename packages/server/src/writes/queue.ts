// The write queue: a repository's git writes, landed one after another, in the order they were
// made. A committing call writes its files at once and the core defers its commit; the queue lands
// the commits it took, with the hooks, and keeps the record the toast and the start's steps read.
import type { Deferred } from "uraeda-binding";

/** What the web UI names a write with: its running text, and the page it opens. */
export type WriteInput = { href: string; label: string };

/** A step of a start, and where it is, as the start's steps show it. */
export type StartStep = {
  label: string;
  /** The hook's output, while the commit's step runs or once it refused. */
  output?: string;
  /** Seconds it took, or has taken so far. */
  seconds?: number;
  state: "done" | "running" | "waiting" | "refused";
};

/** A write as the queue shows it: its name, where it is, and the feature and file it concerns. */
export type QueuedWrite = WriteInput & {
  file?: string;
  folder?: string;
  id: string;
  /** What git and the hooks printed: as it comes, then the refusal's whole message. */
  output?: string;
  state: "running" | "waiting" | "refused";
  steps?: Array<StartStep>;
};

/** A write to queue: its name, and the feature and file it concerns. */
export type NewWrite = Omit<QueuedWrite, "id" | "output" | "state">;

/** What a write's commits are landed with: each line git and the hooks print goes to `onOutput`. */
export type Land = (onOutput: (line: string) => void) => Promise<unknown>;

/** The queue's calls into the core, for one repository. */
export type QueueCore = {
  land: (id: string, onOutput: (line: string) => void) => Promise<unknown>;
  takeDeferred: () => Array<Deferred>;
};

/** A queued write, the keys of the calls that wait for it, and when it is landed or refused. */
type Entry = { keys: Array<string>; settled: Promise<void>; write: QueuedWrite };

/** The message of an error, its code taken off: the record says it was refused. */
const refusal = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/^(hook|refused): /, "");

/**
 * A repository's write queue. Committing calls run one at a time, each with the commits it
 * deferred taken right after it, so two calls' commits never mix. A call waits first for the
 * queued commits of its keys, the files it may write: the core counts a file a commit has not
 * landed yet as changed, and would not defer a second commit of it. The commits land one after
 * another, in order; a refused one stays in the record until dismissed, and does not stop the
 * next. `changed` is told of each change of the record.
 */
export class WriteQueue {
  #core: QueueCore;
  #changed: () => void;
  #entries: Array<Entry> = [];
  /** The committing calls' turn: each one's write and take, one at a time. */
  #calls: Promise<void> = Promise.resolve();
  /** The last landing queued: the next one starts once it settles. */
  #tail: Promise<void> = Promise.resolve();
  #next = 0;

  constructor(core: QueueCore, changed: () => void) {
    this.#core = core;
    this.#changed = changed;
  }

  /** The writes landing, waiting, or refused, in the order they were made. */
  writes(): Array<QueuedWrite> {
    return this.#entries.map(({ write }) => ({ ...write }));
  }

  /**
   * Runs `call`, a committing core call writing what `keys` name, in its turn, and queues the
   * commits it deferred, named by `write`, or by each commit's subject. It answers once its files
   * are written: the commits land behind it. Its commits are queued even when it fails after
   * deferring one.
   */
  async commit<T>(
    keys: Array<string>,
    write: Partial<NewWrite> | undefined,
    call: () => Promise<T>,
  ): Promise<T> {
    const release = await this.#turn(keys);
    try {
      return await call();
    } finally {
      for (const deferred of this.#core.takeDeferred()) {
        const named = { href: "", label: deferred.subject, ...write };
        // A refusal stays in the record: the call answered already.
        this.enqueue(named, (onOutput) => this.#core.land(deferred.id, onOutput), keys).catch(
          () => {},
        );
      }
      release();
    }
  }

  /**
   * Queues a write landed by `land`, after the writes queued before it: it rejects with the
   * refusal, which stays in the record, or resolves with what `land` resolved with. The calls
   * of `keys` wait for it.
   */
  enqueue(write: NewWrite, land: Land, keys: Array<string> = []): Promise<unknown> {
    const entry: Entry = {
      keys,
      settled: Promise.resolve(),
      write: { ...write, id: `write-${++this.#next}`, state: "waiting" },
    };
    const landed = this.#tail.then(() => this.#land(entry, land));
    entry.settled = landed.then(
      () => {},
      () => {},
    );
    this.#tail = entry.settled;
    this.#entries.push(entry);
    this.#changed();
    return landed;
  }

  /** Removes a refused write from the record; a write still landing stays. */
  dismiss(id: string): void {
    const index = this.#entries.findIndex(({ write }) => write.id === id);
    if (index !== -1 && this.#entries[index].write.state === "refused") {
      this.#entries.splice(index, 1);
      this.#changed();
    }
  }

  /** Resolves once every write queued so far landed or was refused. */
  idle(): Promise<void> {
    return this.#tail;
  }

  async #land(entry: Entry, land: Land): Promise<unknown> {
    entry.write.state = "running";
    this.#changed();
    try {
      const landed = await land((line) => {
        entry.write.output =
          entry.write.output === undefined ? line : `${entry.write.output}\n${line}`;
        this.#changed();
      });
      this.#entries.splice(this.#entries.indexOf(entry), 1);
      return landed;
    } catch (error) {
      entry.write.state = "refused";
      entry.write.output = refusal(error);
      throw error;
    } finally {
      this.#changed();
    }
  }

  /** The writes of `keys` still to land. */
  #pending(keys: Array<string>): Array<Entry> {
    return this.#entries.filter(
      ({ keys: own, write }) => write.state !== "refused" && own.some((key) => keys.includes(key)),
    );
  }

  /**
   * Waits for the calls before and the queued writes of `keys`, then holds the turn until the
   * returned release: a write of the same keys queued meanwhile is waited for too.
   */
  async #turn(keys: Array<string>): Promise<() => void> {
    for (;;) {
      await Promise.all(this.#pending(keys).map(({ settled }) => settled));
      const before = this.#calls;
      const turn = Promise.withResolvers<void>();
      this.#calls = turn.promise;
      await before;
      if (this.#pending(keys).length === 0) {
        return turn.resolve;
      }
      turn.resolve();
    }
  }
}
