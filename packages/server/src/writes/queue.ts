// The write queue: a repository's git writes, landed one after another, in the order they were
// made. A committing call writes its files at once and the core defers its commit; the queue lands
// the commits it took, with the hooks, and keeps the record the toast and the start's steps read.
import type { Deferred } from "uraeda-binding";
import { reasonOf } from "../reason.ts";
import { Throttle } from "./throttle.ts";

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

/**
 * Why a refused write did not land: `hook`, a hook refused its commit, and the core undid its
 * files; `failed`, anything else, a staging failure, a commit the core no longer holds after a
 * restart, other files staged: its files are left written, uncommitted, listed on the commit page.
 * `unsent` is no commit: messages kept for a feature's commits or start, which landed, that could
 * not be sent, their text in `queued` for the composer.
 */
export type WriteFailure = "failed" | "hook" | "unsent";

/** A write as the queue shows it: its name, where it is, and the feature and file it concerns. */
export type QueuedWrite = WriteInput & {
  /** Once refused, why. */
  failure?: WriteFailure;
  file?: string;
  folder?: string;
  id: string;
  /** What git and the hooks printed: as it comes, then the refusal's whole message. */
  output?: string;
  /** For a start, the messages sent while it runs, which its agent starts with once it lands. */
  queued?: string;
  state: "running" | "waiting" | "refused";
  steps?: Array<StartStep>;
};

/** A write to queue: its name, and the feature and file it concerns. */
export type NewWrite = Omit<QueuedWrite, "failure" | "id" | "output" | "queued" | "state">;

/** What a write's commits are landed with: each line git and the hooks print goes to `onOutput`. */
export type Land = (onOutput: (line: string) => void) => Promise<unknown>;

/** The queue's calls into the core, for one repository. */
export type QueueCore = {
  land: (id: string, onOutput: (line: string) => void) => Promise<unknown>;
  takeDeferred: () => Array<Deferred>;
};

/**
 * A queued write, the keys of the calls that wait for it, when it is landed or refused, and when
 * it lets some of its keys go before.
 */
type Entry = {
  freed: PromiseWithResolvers<void>;
  keys: Array<string>;
  settled: Promise<void>;
  write: QueuedWrite;
};

/** Why a landing failed: only a hook's refusal, which the core undid, has the code `hook`. */
const failureOf = (error: unknown): WriteFailure =>
  error instanceof Error && error.message.startsWith("hook: ") ? "hook" : "failed";

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
  #moved: (keys: Array<string>) => void;
  #entries: Array<Entry> = [];
  /** The committing calls' turn: each one's write and take, one at a time. */
  #calls: Promise<void> = Promise.resolve();
  /** The last landing queued: the next one starts once it settles. */
  #tail: Promise<void> = Promise.resolve();
  #next = 0;

  /**
   * `moved` is told of the keys of each write as it is queued, its files written, then again once
   * it landed or was refused.
   */
  constructor(
    core: QueueCore,
    changed: () => void,
    moved: (keys: Array<string>) => void = () => {},
  ) {
    this.#core = core;
    this.#changed = changed;
    this.#moved = moved;
  }

  /** The writes landing, waiting, or refused, in the order they were made. */
  writes(): Array<QueuedWrite> {
    return this.#entries.map(({ write }) => ({ ...write }));
  }

  /**
   * Runs `call`, a committing core call writing what `keys` name, in its turn, and queues the
   * commits it deferred, named by `write`, or by each commit's subject. It answers once its files
   * are written: the commits land behind it, and `onQueued` is given whether they all land. Its
   * commits are queued even when it fails after deferring one.
   */
  async commit<T>(
    keys: Array<string>,
    write: Partial<NewWrite> | undefined,
    call: () => Promise<T>,
    onQueued?: (landed: Promise<boolean>) => void,
  ): Promise<T> {
    const release = await this.#turn(keys);
    try {
      return await call();
    } finally {
      const landings = this.#core
        .takeDeferred()
        .map((deferred) =>
          this.enqueue(
            { href: "", label: deferred.subject, ...write },
            (onOutput) => this.#core.land(deferred.id, onOutput),
            keys,
          ),
        );
      // A refusal stays in the record: the call answered already.
      const landed = Promise.allSettled(landings).then((all) =>
        all.every(({ status }) => status === "fulfilled"),
      );
      onQueued?.(landed);
      release();
    }
  }

  /**
   * Queues a write landed by `land`, after the writes queued before it: it rejects with the
   * refusal, which stays in the record, or resolves with what `land` resolved with. The calls
   * of `keys` wait for it.
   */
  enqueue(write: NewWrite, land: Land, keys: Array<string> = []): Promise<unknown> {
    return this.add(write, land, keys).landed;
  }

  /** `enqueue`, answering the write's id in the record too, which `update` takes. */
  add(
    write: NewWrite,
    land: Land,
    keys: Array<string> = [],
  ): { id: string; landed: Promise<unknown> } {
    const entry: Entry = {
      freed: Promise.withResolvers(),
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
    this.#moved(keys);
    return { id: entry.write.id, landed };
  }

  /**
   * Changes a write still in the record, a start's steps, or the messages queued for it: false when
   * it is no longer there.
   */
  update(id: string, change: Partial<Pick<QueuedWrite, "queued" | "steps">>): boolean {
    const entry = this.#entries.find(({ write }) => write.id === id);
    if (entry) {
      Object.assign(entry.write, change);
      this.#changed();
    }
    return entry !== undefined;
  }

  /**
   * Records messages kept for `write`'s folder that could not be sent once its commits landed: a
   * refused write, `unsent`, its `queued` the messages' text, given back to their composer, and its
   * output why, until dismissed.
   */
  unsent(write: NewWrite, queued: string, reason: string): void {
    const id = `write-${++this.#next}`;
    this.#entries.push({
      freed: Promise.withResolvers(),
      keys: [],
      settled: Promise.resolve(),
      write: { ...write, failure: "unsent", id, output: reason, queued, state: "refused" },
    });
    this.#changed();
  }

  /**
   * Runs `call` in the committing calls' turn, waiting for no queued write: a start's run, so no
   * call is between its write and the take of its commits while the start checks the checkout.
   */
  async inTurn<T>(call: () => Promise<T>): Promise<T> {
    const release = await this.#callTurn();
    try {
      return await call();
    } finally {
      release();
    }
  }

  /**
   * Lets the calls of `keys` stop waiting for the write `id`, still landing: a start whose commit
   * landed lets the lists go while it makes its branch and starts its agent.
   */
  free(id: string, keys: Array<string>): void {
    const entry = this.#entries.find(({ write }) => write.id === id);
    if (entry) {
      entry.keys = entry.keys.filter((key) => !keys.includes(key));
      entry.freed.resolve();
      entry.freed = Promise.withResolvers();
    }
  }

  /**
   * Removes a refused write from the record; a write still landing stays. A call whose refusal it
   * answers with dismisses it `keepingMessages`: one holding messages kept for it stays, until the
   * human dismisses it, so their composer takes them back.
   */
  dismiss(id: string, keepingMessages = false): void {
    const index = this.#entries.findIndex(({ write }) => write.id === id);
    const write = index === -1 ? undefined : this.#entries[index].write;
    if (write?.state === "refused" && !(keepingMessages && write.queued !== undefined)) {
      this.#entries.splice(index, 1);
      this.#changed();
    }
  }

  /** Whether a write of `keys` is still queued, landing or waiting: a refused one is not. */
  waits(keys: Array<string>): boolean {
    return this.#pending(keys).length > 0;
  }

  /**
   * Resolves once the writes of `keys` queued now landed or were refused: with the id of the first
   * refused, or undefined when every one landed.
   */
  async settled(keys: Array<string>): Promise<string | undefined> {
    const pending = this.#pending(keys);
    await Promise.all(pending.map(({ settled }) => settled));
    return pending.find(({ write }) => write.state === "refused")?.write.id;
  }

  /** Resolves once every write queued so far landed or was refused. */
  idle(): Promise<void> {
    return this.#tail;
  }

  async #land(entry: Entry, land: Land): Promise<unknown> {
    entry.write.state = "running";
    this.#changed();
    // The output streams at most once each 100 ms; the end goes at once.
    const output = new Throttle(() => this.#changed());
    try {
      const landed = await land((line) => {
        entry.write.output =
          entry.write.output === undefined ? line : `${entry.write.output}\n${line}`;
        output.soon();
      });
      this.#entries.splice(this.#entries.indexOf(entry), 1);
      return landed;
    } catch (error) {
      entry.write.state = "refused";
      entry.write.failure = failureOf(error);
      entry.write.output = reasonOf(error);
      throw error;
    } finally {
      output.cancel();
      this.#changed();
      this.#moved(entry.keys);
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
      await Promise.all(
        this.#pending(keys).map(({ freed, settled }) => Promise.race([settled, freed.promise])),
      );
      const release = await this.#callTurn();
      if (this.#pending(keys).length === 0) {
        return release;
      }
      release();
    }
  }

  /** Waits for the calls before, then holds the calls' turn until the returned release. */
  async #callTurn(): Promise<() => void> {
    const before = this.#calls;
    const turn = Promise.withResolvers<void>();
    this.#calls = turn.promise;
    await before;
    return turn.resolve;
  }
}
