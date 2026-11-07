// A ready Storybook's story compiles: each story compiled once by the warmer, shared by every ask,
// ended once its warm ends or passes its time, and aborted with its Storybook.
import type { IndexEntry } from "./index.ts";
import { warmStory } from "./warmer.ts";

/** How long a story's compile may take before its frame shows anyway. */
export const WARM_MS = 60_000;

/** One story's compile: whether it ended, and a promise of its end. */
type Compile = { ended: boolean; promise: Promise<void> };

/** The compiles of one ready Storybook, on its port, served under its base. */
export class Compiles {
  readonly #compiles = new Map<string, Compile>();
  readonly #stop = new AbortController();
  readonly #port: number;
  readonly #base: string;
  readonly #ms: number;
  readonly #onEnd: () => void;

  /** `onEnd` is called as each compile ends, unless its Storybook stopped first. */
  constructor(options: { base: string; ms: number; onEnd: () => void; port: number }) {
    this.#port = options.port;
    this.#base = options.base;
    this.#ms = options.ms;
    this.#onEnd = options.onEnd;
  }

  /** Whether the story's compile ended or passed its time: the first ask starts it. */
  ended(story: IndexEntry): boolean {
    return this.compile(story).ended;
  }

  /** The story's compile, started on its first ask, shared by the later ones. */
  compile(story: IndexEntry): Compile {
    const known = this.#compiles.get(story.id);
    if (known !== undefined) {
      return known;
    }
    const signal = AbortSignal.any([this.#stop.signal, AbortSignal.timeout(this.#ms)]);
    const compile: Compile = { ended: false, promise: Promise.resolve() };
    compile.promise = warmStory(this.#port, this.#base, story, signal).then(() => {
      compile.ended = true;
      if (!this.#stop.signal.aborted) {
        this.#onEnd();
      }
    });
    this.#compiles.set(story.id, compile);
    return compile;
  }

  /** Aborts every compile, as their Storybook stops: their ends call nothing. */
  abort(): void {
    this.#stop.abort();
  }
}
