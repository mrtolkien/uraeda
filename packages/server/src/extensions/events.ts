// The events extensions listen to: the bus that delivers them only to extensions on in the
// event's repository, and the watch that turns the core's changes into steps reached and commits
// landed, comparing each feature's step and the main checkout's `HEAD` before and after.
import type { Changes, StepView } from "uraeda-binding";
import type { EventName, Events } from "../extension-api.ts";
import type { Binding } from "../fate/context.ts";

/** Prints an extension's failure, which never reaches Uraeda's caller. */
export function reportFor(name: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`uraeda: ${name}: ${message}\n`);
}

/**
 * Calls `run` for the extension `name`: a throw, or a rejection of what it returns, is printed
 * under its name, and never thrown.
 */
export function guarded(name: string, run: () => unknown): void {
  try {
    const result = run();
    if (typeof (result as PromiseLike<unknown> | undefined)?.then === "function") {
      Promise.resolve(result).catch((error: unknown) => reportFor(name, error));
    }
  } catch (error) {
    reportFor(name, error);
  }
}

type Handler = { extension: string; handler: (payload: never) => unknown };

/**
 * The event bus: handlers by event, each with its extension, called only for a repository its
 * extension is on in, by `isOn`.
 */
export class EventBus {
  readonly #handlers = new Map<EventName, Set<Handler>>();
  readonly #isOn: (extension: string, repository: string) => boolean;

  constructor(isOn: (extension: string, repository: string) => boolean) {
    this.#isOn = isOn;
  }

  /** Adds `handler` of the extension for `event`: gives its removal. */
  on<E extends EventName>(
    extension: string,
    event: E,
    handler: (payload: Events[E]) => unknown,
  ): () => void {
    const handlers = this.#handlers.get(event) ?? new Set();
    this.#handlers.set(event, handlers);
    const entry: Handler = { extension, handler: handler as Handler["handler"] };
    handlers.add(entry);
    return () => handlers.delete(entry);
  }

  /** Sends the event to each handler whose extension is on in its repository. */
  emit<E extends EventName>(event: E, payload: Omit<Events[E], "time">): void {
    const full = { ...payload, time: new Date().toISOString() } as Events[E];
    for (const { extension, handler } of this.#handlers.get(event) ?? []) {
      if (this.#isOn(extension, full.repository)) {
        guarded(extension, () => (handler as (payload: Events[E]) => unknown)(full));
      }
    }
  }
}

/** A step as events name it: the waiting file's kind at a human gate, else the step's name. */
export function stepName(step: StepView): string {
  return step.name === "human-gate" && step.fileKind ? step.fileKind : step.name;
}

/** What a repository was last seen at: each feature's step, and the main checkout's `HEAD`. */
type Seen = { branch?: string; commit: string | null; steps: Map<string, string> };

/** A repository as the watch knows it: its name and main checkout. */
type Repo = { name: string; path: string };

/**
 * The watch of the repositories' steps and commits: `seed` reads where a repository is, and each
 * of its `changes` compares the features they list, and the `HEAD` when git changed, with what was
 * seen, emitting `step-reached` and `commit-landed` for what moved.
 */
export class StepWatch {
  readonly #binding: Pick<Binding, "checkoutCommit" | "readWorkspace">;
  readonly #bus: EventBus;
  /** Each repository's last read, by its path: a promise, so changes wait for the seed. */
  readonly #seen = new Map<string, Promise<Seen>>();

  constructor(binding: Pick<Binding, "checkoutCommit" | "readWorkspace">, bus: EventBus) {
    this.#binding = binding;
    this.#bus = bus;
  }

  /** Reads where the repository is now, before any change of it is compared. */
  seed({ path }: Repo): void {
    this.#seen.set(path, this.#read(path));
  }

  /** Compares the repository after `changes`, emitting what moved; never throws. */
  changes(repo: Repo, changes: Pick<Changes, "features" | "git">): Promise<void> {
    if (changes.features.length === 0 && !changes.git) {
      return Promise.resolve();
    }
    const before = this.#seen.get(repo.path) ?? this.#read(repo.path);
    const next = before.then(async (seen) => {
      const now = await this.#read(repo.path);
      this.#compare(repo, seen, now, changes);
      return now;
    });
    this.#seen.set(
      repo.path,
      next.catch(() => before),
    );
    return next.then(
      () => undefined,
      (error: unknown) => reportFor("events", error),
    );
  }

  /** Forgets a repository that left the list. */
  forget({ path }: Repo): void {
    this.#seen.delete(path);
  }

  #compare(repo: Repo, seen: Seen, now: Seen, changes: Pick<Changes, "features" | "git">) {
    for (const feature of changes.features) {
      const step = now.steps.get(feature);
      if (step !== undefined && step !== seen.steps.get(feature)) {
        const [name, waitsOn] = step.split("\u0000");
        this.#bus.emit("step-reached", {
          feature,
          repository: repo.name,
          step: name,
          waitsOn: waitsOn as Events["step-reached"]["waitsOn"],
        });
      }
    }
    if (changes.git && now.commit !== null && now.commit !== seen.commit) {
      this.#bus.emit("commit-landed", {
        branch: now.branch ?? null,
        commit: now.commit,
        repository: repo.name,
      });
    }
  }

  async #read(path: string): Promise<Seen> {
    const [workspace, commit] = await Promise.all([
      this.#binding.readWorkspace(path),
      this.#binding.checkoutCommit(path).catch(() => null),
    ]);
    const steps = new Map(
      workspace.features.map((feature) => [
        feature.folder,
        `${stepName(feature.step)}\u0000${feature.step.waitsOn}`,
      ]),
    );
    return { branch: workspace.currentBranch, commit, steps };
  }
}
