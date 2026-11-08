// The watch of the settings file: its folder, or the nearest folder above it that exists until it
// does, and the folder of the file a symlinked `config.toml` points to, as dotfiles managers make.
// The themes folder is watched the same way, and its own entries too, through any symlink, and
// each of its entries that is a symlink at its target.
import {
  type FSWatcher,
  lstatSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  statSync,
  watch,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * One folder watched, for the entries of `names`, or every entry for `"all"`, as made: its inode
 * tells a folder made again.
 */
type Watched = { names: ReadonlySet<string> | "all"; path: string };

/** A watch's key: its folder, that folder's device and inode, and the names it reports. */
function key({ names, path }: Watched, { dev, ino }: { dev: number; ino: number }): string {
  return JSON.stringify([path, dev, ino, names === "all" ? names : [...names]]);
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

/** How many symlinks a dangling chain is followed through, as the system's own limit. */
const MOST_LINKS = 40;

/**
 * The folder of the file `path` points to, and its name, when a symlink leads elsewhere; for a
 * symlink to nothing, the nearest folder toward its missing target, which sees it made.
 */
function target(dir: string, path: string): Watched | null {
  try {
    const real = realpathSync(path);
    if (dirname(real) === realpathSync(dir) && basename(real) === basename(path)) {
      return null;
    }
    return { names: new Set([basename(real)]), path: dirname(real) };
  } catch {
    // No file, or a symlink to nothing: the folder's watch sees the first made.
    const missing = dangling(path);
    return missing === null ? null : nearest(dirname(missing), basename(missing));
  }
}

/** The missing file the symlink `path` ends at, through its chain, or null when it is no link. */
function dangling(path: string): string | null {
  let at = path;
  for (let links = 0; links < MOST_LINKS; links++) {
    try {
      if (!lstatSync(at).isSymbolicLink()) {
        // A link through a missing folder or a file in the way: no target to wait for.
        return null;
      }
      at = resolve(dirname(at), readlinkSync(at));
    } catch {
      return at === path ? null : at;
    }
  }
  return null;
}

/** The folder `path`, its symlinks followed, watched for every entry, when it is a folder. */
function entries(path: string): Watched | null {
  try {
    return { names: "all", path: realpathSync(path) };
  } catch {
    // Not made yet: the watch of the folder above it sees it made.
    return null;
  }
}

/**
 * The folders of the files the symlinked entries of the folder `path` point to, as GNU Stow makes.
 */
function linkedEntries(path: string): Array<Watched | null> {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isSymbolicLink())
      .map((entry) => target(path, join(path, entry.name)));
  } catch {
    // Not made yet, or not a folder: no entry to follow.
    return [];
  }
}

/**
 * Watches the file `file` of the folder `dir`, and calls `changed` on each event that may change
 * it, unfiltered by time: the caller waits for a quiet moment. With `folder`, `file` is a folder,
 * and an event on any of its entries is one too; `what` names what it holds in the messages of a
 * failed watch, `the settings` by default. `refresh` follows the folders made, deleted, and
 * the symlink's target; `close` stops every watch.
 */
export class FileWatch {
  readonly #dir: string;
  readonly #file: string;
  readonly #changed: () => void;
  readonly #folder: boolean;
  readonly #what: string;
  readonly #watches = new Map<string, FSWatcher>();

  constructor(
    dir: string,
    file: string,
    changed: () => void,
    { folder = false, what = "the settings" } = {},
  ) {
    this.#dir = dir;
    this.#file = file;
    this.#changed = changed;
    this.#folder = folder;
    this.#what = what;
    this.refresh();
  }

  /** Watches the folders the file depends on now, closing those it no longer does. */
  refresh(): void {
    const wanted = new Map<string, Watched>();
    for (const watched of [
      nearest(this.#dir, this.#file),
      target(this.#dir, join(this.#dir, this.#file)),
      ...(this.#folder
        ? [entries(join(this.#dir, this.#file)), ...linkedEntries(join(this.#dir, this.#file))]
        : []),
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
        if (entry === null || names === "all" || names.has(String(entry))) {
          this.#changed();
        }
      });
      watcher.on("error", (error) => {
        process.stderr.write(
          `uraeda: ${error.message}; ${this.#what} are read again on their next change\n`,
        );
      });
      this.#watches.set(name, watcher);
    } catch (error) {
      process.stderr.write(
        `uraeda: ${(error as Error).message}; changes to ${this.#what} show after a restart\n`,
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
