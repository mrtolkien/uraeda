// The watch of the settings file: its folder, or the nearest folder above it that exists until it
// does, and the folder of the file a symlinked `config.toml` points to, as dotfiles managers make.
import { type FSWatcher, realpathSync, statSync, watch } from "node:fs";
import { basename, dirname, join } from "node:path";

/** One folder watched, for the entries of `names`, as made: its inode tells a folder made again. */
type Watched = { names: ReadonlySet<string>; path: string };

/** A watch's key: its folder, that folder's device and inode, and the names it reports. */
function key({ names, path }: Watched, { dev, ino }: { dev: number; ino: number }): string {
  return JSON.stringify([path, dev, ino, [...names]]);
}

/** The folder's identity, or null when it is not a folder, or is gone. */
function folder(path: string): { dev: number; ino: number } | null {
  try {
    const stats = statSync(path);
    return stats.isDirectory() ? stats : null;
  } catch {
    return null;
  }
}

/**
 * The folder holding `dir` closest to it that exists, and the name of its entry toward `dir`:
 * `dir` itself, with the file's name, when it exists.
 */
function nearest(dir: string, file: string): Watched {
  let child = file;
  let path = dir;
  while (folder(path) === null && dirname(path) !== path) {
    child = basename(path);
    path = dirname(path);
  }
  // The folder's own name: a watched folder that is deleted reports itself.
  return { names: new Set([child, basename(path)]), path };
}

/** The folder of the file `path` points to, and its name, when a symlink leads elsewhere. */
function target(dir: string, path: string): Watched | null {
  try {
    const real = realpathSync(path);
    if (dirname(real) === realpathSync(dir) && basename(real) === basename(path)) {
      return null;
    }
    return { names: new Set([basename(real)]), path: dirname(real) };
  } catch {
    // No file, or a symlink to nothing: the folder's watch sees it made.
    return null;
  }
}

/**
 * Watches the file `file` of the folder `dir`, and calls `changed` on each event that may change
 * it, unfiltered by time: the caller waits for a quiet moment. `refresh` follows the folders
 * made, deleted, and the symlink's target; `close` stops every watch.
 */
export class FileWatch {
  readonly #dir: string;
  readonly #file: string;
  readonly #changed: () => void;
  readonly #watches = new Map<string, FSWatcher>();

  constructor(dir: string, file: string, changed: () => void) {
    this.#dir = dir;
    this.#file = file;
    this.#changed = changed;
    this.refresh();
  }

  /** Watches the folders the file depends on now, closing those it no longer does. */
  refresh(): void {
    const wanted = new Map<string, Watched>();
    for (const watched of [
      nearest(this.#dir, this.#file),
      target(this.#dir, join(this.#dir, this.#file)),
    ]) {
      const identity = watched && folder(watched.path);
      if (watched && identity) {
        wanted.set(key(watched, identity), watched);
      }
    }
    for (const [name, watcher] of this.#watches) {
      if (!wanted.has(name)) {
        watcher.close();
        this.#watches.delete(name);
      }
    }
    for (const [name, watched] of wanted) {
      if (!this.#watches.has(name)) {
        this.#open(name, watched);
      }
    }
  }

  #open(name: string, { names, path }: Watched): void {
    try {
      const watcher = watch(path, (_, entry) => {
        if (entry === null || names.has(String(entry))) {
          this.#changed();
        }
      });
      watcher.on("error", (error) => {
        process.stderr.write(
          `uraeda: ${error.message}; the settings are read again on their next change\n`,
        );
      });
      this.#watches.set(name, watcher);
    } catch (error) {
      process.stderr.write(
        `uraeda: ${(error as Error).message}; changes to the settings show after a restart\n`,
      );
    }
  }

  /** Stops every watch. */
  close(): void {
    for (const watcher of this.#watches.values()) {
      watcher.close();
    }
    this.#watches.clear();
  }
}
