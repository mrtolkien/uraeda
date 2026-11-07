// The colour themes the server serves: the shipped ones and the user's, read through the core from
// the themes folder beside the settings file, and read again on each change of that folder.
import { basename, dirname } from "node:path";
import type { Themes } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { LIST_QUIET_MS } from "./repositories.ts";
import { FileWatch } from "./settings-watch.ts";

/** How long a failed first read waits before it is tried again. */
const RETRY_MS = 1000;

/** What `ServerThemes.open` takes: the binding, and the config folder. */
type ThemesOptions = {
  binding: Pick<Binding, "readThemes" | "themesFolder">;
  dir: string;
};

/**
 * The themes of the config folder, the only reader of its themes folder for the running server:
 * read at start and again on each change of the folder or of a file in it, after a quiet moment.
 * A read that fails keeps the last themes, and its problem is printed once, until it changes; a
 * first read that fails is tried again each second until one succeeds, as there is no last one.
 */
export class ServerThemes {
  readonly #options: ThemesOptions;
  #themes: Themes;
  #problem: string | null = null;
  #read = false;
  #listeners = new Set<() => void>();
  #reloading: Promise<void> = Promise.resolve();
  #watch?: FileWatch;
  #timer?: ReturnType<typeof setTimeout>;
  #closed = false;

  private constructor(options: ThemesOptions) {
    this.#options = options;
    // Before the first read: no theme, as no read could give.
    this.#themes = { files: [], folder: "", themes: [] };
  }

  /**
   * The themes of the config folder `dir`: read once, then watched, a themes folder that does not
   * exist yet watched from the nearest folder above it, and a symlinked one at its target. `close`
   * stops the watch.
   */
  static async open(options: ThemesOptions): Promise<ServerThemes> {
    const themes = new ServerThemes(options);
    const folder = options.binding.themesFolder(options.dir);
    const changed = () => {
      clearTimeout(themes.#timer);
      themes.#timer = setTimeout(() => void themes.reload(), LIST_QUIET_MS);
    };
    themes.#watch = new FileWatch(dirname(folder), basename(folder), changed, {
      folder: true,
      what: "the themes",
    });
    await themes.reload();
    return themes;
  }

  /** The themes as last read: the shipped ones and the user's, with every file's problems. */
  current(): Themes {
    return this.#themes;
  }

  /** Calls `listener` once each time the themes change; returns its removal. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Reads the themes again, after any read in progress. */
  reload(): Promise<void> {
    const next = this.#reloading.then(() => this.#reload());
    this.#reloading = next.catch(() => {});
    return next;
  }

  async #reload(): Promise<void> {
    if (this.#closed) {
      return;
    }
    // The folders to watch may have changed: made, deleted, or a symlink pointed elsewhere.
    this.#watch?.refresh();
    let read: Themes | null = null;
    let problem: string | null = null;
    try {
      read = await this.#options.binding.readThemes(this.#options.dir);
    } catch (error) {
      problem = (error instanceof Error ? error.message : String(error)).replace(/^[a-z]+: /, "");
    }
    if (this.#closed) {
      return;
    }
    if (problem !== null && problem !== this.#problem) {
      process.stderr.write(`uraeda: ${problem} The themes stay as last read.\n`);
    }
    this.#problem = problem;
    if (read === null && !this.#read) {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => void this.reload(), RETRY_MS);
    }
    this.#read ||= read !== null;
    if (read !== null && JSON.stringify(read) !== JSON.stringify(this.#themes)) {
      this.#themes = read;
      this.#tell();
    }
  }

  /** Calls each listener: one that throws is printed, and the others are still called. */
  #tell(): void {
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch (error) {
        process.stderr.write(`uraeda: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  }

  /** Stops the watches of the themes folder, as the server stops. */
  close(): void {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#watch?.close();
    this.#listeners.clear();
  }
}
