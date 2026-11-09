// A feature's own run options: only what the feature or change changed, kept in Uraeda's data
// folder, in the session cache's database, and read over the settings as they are at each run.
import type { DatabaseSync } from "node:sqlite";
import type { RunOptions } from "uraeda-binding";
import type { Binding } from "../fate/context.ts";

/** What `FeatureOptions` takes: the core's rules, the database, and the settings' run options now. */
type FeatureOptionsOptions = {
  binding: Pick<Binding, "checkRunOptions" | "mergeRunOptions">;
  db: DatabaseSync;
  defaults: () => RunOptions;
};

/** A feature's run options: what it changed, and the settings' that apply to every other value. */
export type FeatureRunOptions = { defaults: RunOptions; own: RunOptions };

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
 * The features' options of the session manager's cache, over the settings' in force: every store
 * made of the same cache reads and writes the same rows.
 */
export function featureOptionsOf(parts: {
  binding: FeatureOptionsOptions["binding"];
  sessions: { cache: { db: DatabaseSync } };
  settings: { runs: () => { options: RunOptions } };
}): FeatureOptions {
  const { binding, sessions, settings } = parts;
  return new FeatureOptions({
    binding,
    db: sessions.cache.db,
    defaults: () => settings.runs().options,
  });
}

/**
 * The run options of each feature and change, a row per folder of a repository. A row holds only
 * what the feature changed, never a copy of the settings: every value it never changed follows the
 * settings, as they are when a run starts. The rows never touch a session: a change applies from
 * the feature's next run.
 */
export class FeatureOptions {
  readonly #options: FeatureOptionsOptions;

  constructor(options: FeatureOptionsOptions) {
    this.#options = options;
  }

  /** What the feature changed, `{ steps: [] }` when it changed nothing. */
  own(repo: string, folder: string): RunOptions {
    const row = this.#options.db
      .prepare("SELECT options FROM feature_options WHERE repo = ? AND folder = ?")
      .get(repo, folder) as { options: string } | undefined;
    return row ? (JSON.parse(row.options) as RunOptions) : { steps: [] };
  }

  /**
   * Keeps `options` as the feature's own, whole, or removes its row when they change nothing.
   * Throws the core's `refused: ` and its problem for options it refuses, keeping the row.
   */
  set(repo: string, folder: string, options: RunOptions): void {
    const { binding, db } = this.#options;
    binding.checkRunOptions(options);
    if (empty(options)) {
      db.prepare("DELETE FROM feature_options WHERE repo = ? AND folder = ?").run(repo, folder);
      return;
    }
    db.prepare(
      `INSERT INTO feature_options (repo, folder, options, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (repo, folder) DO UPDATE SET options = excluded.options,
         updated_at = excluded.updated_at`,
    ).run(repo, folder, JSON.stringify(options), new Date().toISOString());
  }

  /** The feature's options over the settings' as they are now: what its next run starts on. */
  resolved(repo: string, folder: string): RunOptions {
    const { binding, defaults } = this.#options;
    return binding.mergeRunOptions(defaults(), this.own(repo, folder));
  }
}
