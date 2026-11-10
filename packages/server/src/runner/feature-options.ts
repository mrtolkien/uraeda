// A feature's own run options: only what the feature or change changed, kept in their own database
// file in Uraeda's data folder, and read over the settings as they are at each run. The file is
// never the session cache's, which is cleared when it cannot be read: a feature's options are the
// human's choices, and are never lost with the cache.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { RunOptions } from "uraeda-binding";
import type { Binding } from "../fate/context.ts";
import { reasonOf } from "../reason.ts";
import { transaction } from "./migrations.ts";

/** The features' options' database, in Uraeda's data folder. */
export const FEATURE_OPTIONS_FILE = "run-options.sqlite";

/** How long a statement waits for another process's lock, by default. */
const TIMEOUT_MS = 5000;

/** What `FeatureOptions` takes: the core's rules, its file, and the settings' run options now. */
type FeatureOptionsOptions = {
  binding: Pick<Binding, "checkRunOptions" | "mergeRunOptions">;
  defaults: () => RunOptions;
  /** The database file, made with its folder when missing. */
  path: string;
  /** How long a statement waits for another process's lock. */
  timeout?: number;
};

/** Whether the options change nothing: no step, no implementers, no reviewers, and no depth. */
function empty(options: RunOptions): boolean {
  return (
    options.steps.length === 0 &&
    options.implementers === undefined &&
    options.reviewers === undefined &&
    options.reviewDepth === undefined
  );
}

/**
 * The options as the core reads them, merged over none: each step once, an empty reviewers' list
 * gone, as it keeps the settings'; checked, then without the tables that change nothing. Throws
 * the core's `refused: ` and its problem, and `refused: ` for a value of the wrong type, which the
 * binding cannot read.
 */
function normalized(binding: FeatureOptionsOptions["binding"], options: RunOptions): RunOptions {
  let merged: RunOptions;
  try {
    merged = binding.mergeRunOptions({ steps: [] }, options);
  } catch (error) {
    throw new Error(`refused: The run options are not of the right shape: ${reasonOf(error)}`, {
      cause: error,
    });
  }
  binding.checkRunOptions(merged);
  const { implementers, ...rest } = merged;
  return {
    ...rest,
    ...(implementers === undefined || Object.keys(implementers).length === 0
      ? {}
      : { implementers }),
    steps: merged.steps.filter((step) => Object.keys(step).some((key) => key !== "step")),
  };
}

/** The schema's one version: the table of the features' options. */
function migrate(db: DatabaseSync): DatabaseSync {
  db.exec("PRAGMA journal_mode = WAL");
  transaction(db, () => {
    const { user_version: version } = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (version < 1) {
      db.exec(`CREATE TABLE IF NOT EXISTS feature_options (
        repo       TEXT NOT NULL,
        folder     TEXT NOT NULL,
        options    TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (repo, folder)
      );
      PRAGMA user_version = 1;`);
    }
  });
  return db;
}

/**
 * The features' options of Uraeda's data folder, over the settings' in force: every store made on
 * the same folder reads and writes the same rows.
 */
export function featureOptionsOf(parts: {
  binding: FeatureOptionsOptions["binding"];
  dataDir: string;
  settings: { runs: () => { options: RunOptions } };
}): FeatureOptions {
  const { binding, dataDir, settings } = parts;
  return new FeatureOptions({
    binding,
    defaults: () => settings.runs().options,
    path: join(dataDir, FEATURE_OPTIONS_FILE),
  });
}

/**
 * The run options of each feature and change, a row per folder of a repository. A row holds only
 * what the feature changed, never a copy of the settings: every value it never changed follows the
 * settings, as they are when a run starts. The rows never touch a session: a change applies from
 * the feature's next run. The file opens at its first use, and again at the next one while it
 * cannot: it is never replaced, nor kept in memory in its place.
 */
export class FeatureOptions {
  readonly #options: FeatureOptionsOptions;
  #db: DatabaseSync | undefined;

  constructor(options: FeatureOptionsOptions) {
    this.#options = options;
  }

  /** The database, opened and migrated at its first use. Throws while the file cannot be. */
  #open(): DatabaseSync {
    if (this.#db === undefined) {
      const { path, timeout = TIMEOUT_MS } = this.#options;
      mkdirSync(dirname(path), { recursive: true });
      const db = new DatabaseSync(path, { timeout });
      try {
        this.#db = migrate(db);
      } catch (error) {
        db.close();
        throw error;
      }
    }
    return this.#db;
  }

  /**
   * What the feature changed, `{ steps: [] }` when it changed nothing, or while the file cannot be
   * read: its runs then take the settings', and the server says why.
   */
  own(repo: string, folder: string): RunOptions {
    try {
      const row = this.#open()
        .prepare("SELECT options FROM feature_options WHERE repo = ? AND folder = ?")
        .get(repo, folder) as { options: string } | undefined;
      return row ? (JSON.parse(row.options) as RunOptions) : { steps: [] };
    } catch (error) {
      process.stderr.write(
        `The features' run options could not be read from ${this.#options.path}, so ${folder} runs on the settings': ${String(error)}\n`,
      );
      return { steps: [] };
    }
  }

  /**
   * Keeps `given` as the feature's own, whole and normalized, or removes its row when they change
   * nothing.
   * Throws the core's `refused: ` and its problem for options it refuses, and `refused: ` while the
   * file cannot be written, keeping the row.
   */
  set(repo: string, folder: string, given: RunOptions): void {
    const options = normalized(this.#options.binding, given);
    try {
      const db = this.#open();
      if (empty(options)) {
        db.prepare("DELETE FROM feature_options WHERE repo = ? AND folder = ?").run(repo, folder);
        return;
      }
      db.prepare(
        `INSERT INTO feature_options (repo, folder, options, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (repo, folder) DO UPDATE SET options = excluded.options,
           updated_at = excluded.updated_at`,
      ).run(repo, folder, JSON.stringify(options), new Date().toISOString());
    } catch (error) {
      throw new Error(
        `refused: The run options could not be saved: ${this.#options.path} is locked by another process or cannot be read (${String(error)}).`,
        { cause: error },
      );
    }
  }

  /** The feature's options over the settings' as they are now: what its next run starts on. */
  resolved(repo: string, folder: string): RunOptions {
    const { binding, defaults } = this.#options;
    return binding.mergeRunOptions(defaults(), this.own(repo, folder));
  }

  /**
   * `given`, checked and normalized as `set` keeps them, over the settings' as they are now: what a
   * feature with those options would run on, for options not kept yet. Throws as `set` refuses.
   */
  over(given: RunOptions): RunOptions {
    const { binding, defaults } = this.#options;
    return binding.mergeRunOptions(defaults(), normalized(binding, given));
  }

  /** Closes the file, if it was opened. */
  close(): void {
    this.#db?.close();
    this.#db = undefined;
  }
}
