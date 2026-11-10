// The record of the scheduled jobs' runs, in the cache's `job_runs` table: one row per time a job
// was due in a repository, or was run by hand. The scheduler, the history, and the offer's
// acceptance read it, so it is the authority on what ran.
import type { DatabaseSync } from "node:sqlite";
import { transaction } from "./migrations.ts";

/** How many rows the history keeps for each job and repository. */
const KEPT = 50;

/** A run of a job in a repository, or a time it skipped. */
export type JobRunRow = {
  /** When it started, or was skipped, in ms since the epoch. */
  at: number;
  /** The folder of the open change that blocked a time skipped as `change-open` (R36). */
  blockedBy: string | null;
  /** The scheduled time it answers, in ms since the epoch: null for "Run now". */
  due: number | null;
  /** Why a scheduled start failed, null for every other row (R45). */
  error: string | null;
  id: number;
  job: string;
  /** `failed`: the time's session could not start (R45). */
  outcome: "failed" | "skipped" | "started";
  /** Why it was skipped. */
  reason: "change-open" | "working" | null;
  /** Why the change its run offered could not start, null when nothing refused (R1). */
  refusal: string | null;
  /** The turn whose offer was refused, so a later turn's offer asks again (R1). */
  refusedTurn: number | null;
  /** The repository's main checkout. */
  repository: string;
  /** The session it started. */
  session: string | null;
  trigger: "manual" | "schedule";
};

/** A row as the table stores it. */
type Stored = {
  at: number;
  blocked_by: string | null;
  due: number | null;
  error: string | null;
  id: number;
  job: string;
  outcome: JobRunRow["outcome"];
  reason: JobRunRow["reason"];
  refusal: string | null;
  refused_turn: number | null;
  repository: string;
  session: string | null;
  trigger: JobRunRow["trigger"];
};

function toRow({ blocked_by: blockedBy, refused_turn: refusedTurn, ...row }: Stored): JobRunRow {
  return { ...row, blockedBy, refusedTurn };
}

/** The table's columns, as `SELECT` lists them. */
const COLUMNS =
  "id, job, repository, due, at, trigger, outcome, reason, session, refusal, refused_turn, blocked_by, error";

/** The record of runs: made by `SessionCache`, which owns the database. */
export class JobRuns {
  readonly #db: DatabaseSync;
  readonly #listeners = new Set<() => void>();

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /** Calls `listener` after each change of the rows: gives its removal. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #changed(): void {
    this.#listeners.forEach((listener) => listener());
  }

  /**
   * Records a run, and drops the oldest rows of its job and repository past 50, but its latest
   * started one. Returns the row, or undefined when its `due` time is recorded already for that job
   * and repository.
   */
  add(
    row: Omit<JobRunRow, "blockedBy" | "error" | "id" | "refusal" | "refusedTurn"> & {
      blockedBy?: string | null;
      error?: string | null;
    },
  ): JobRunRow | undefined {
    const added = transaction(this.#db, () => {
      const stored = this.#db
        .prepare(
          `INSERT INTO job_runs
             (job, repository, due, at, trigger, outcome, reason, session, blocked_by, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (job, repository, due) DO NOTHING RETURNING ${COLUMNS}`,
        )
        .get(
          row.job,
          row.repository,
          row.due,
          row.at,
          row.trigger,
          row.outcome,
          row.reason,
          row.session,
          row.blockedBy ?? null,
          row.error ?? null,
        ) as Stored | undefined;
      if (stored === undefined) {
        return undefined;
      }
      this.#prune(row.job, row.repository);
      return toRow(stored);
    });
    if (added !== undefined) {
      this.#changed();
    }
    return added;
  }

  /**
   * Drops the rows of the job in the repository past the 50 newest, but the ones the open-change
   * check and the offer's acceptance read, however many skips follow them: the latest started run
   * that has a session, which a run still starting cannot displace, and each started run whose
   * session belongs to a change or a feature, which stay while that session does.
   */
  #prune(job: string, repository: string): void {
    this.#db
      .prepare(
        `DELETE FROM job_runs WHERE job = ?1 AND repository = ?2
           AND id NOT IN (SELECT id FROM job_runs WHERE job = ?1 AND repository = ?2
                          ORDER BY id DESC LIMIT ${KEPT})
           AND id IS NOT (SELECT MAX(id) FROM job_runs
                          WHERE job = ?1 AND repository = ?2 AND outcome = 'started'
                            AND session IS NOT NULL)
           AND NOT EXISTS (SELECT 1 FROM sessions
                           WHERE sessions.id = job_runs.session AND sessions.folder IS NOT NULL
                             AND job_runs.outcome = 'started')`,
      )
      .run(job, repository);
  }

  /** Whether the time `due` of the job is recorded in the repository: a lookup by the unique index. */
  recorded(job: string, repository: string, due: number): boolean {
    return (
      this.#db
        .prepare("SELECT 1 FROM job_runs WHERE job = ? AND repository = ? AND due = ?")
        .get(job, repository, due) !== undefined
    );
  }

  /** The job's runs in the repository, the newest first, 50 at most. */
  history(job: string, repository: string): Array<JobRunRow> {
    const rows = this.#db
      .prepare(
        `SELECT ${COLUMNS} FROM job_runs WHERE job = ? AND repository = ?
         ORDER BY id DESC LIMIT ${KEPT}`,
      )
      .all(job, repository) as Array<Stored>;
    return rows.map(toRow);
  }

  /** The job's latest run that started a session in the repository, once it has one. */
  latestStarted(job: string, repository: string): JobRunRow | undefined {
    const row = this.#db
      .prepare(
        `SELECT ${COLUMNS} FROM job_runs
         WHERE job = ? AND repository = ? AND outcome = 'started' AND session IS NOT NULL
         ORDER BY id DESC LIMIT 1`,
      )
      .get(job, repository) as Stored | undefined;
    return row && toRow(row);
  }

  /**
   * The folders of the changes and features the sessions of the job's runs in the repository are in,
   * the one of the latest run first.
   */
  changeFolders(job: string, repository: string): Array<string> {
    const rows = this.#db
      .prepare(
        `SELECT sessions.folder FROM job_runs JOIN sessions ON sessions.id = job_runs.session
         WHERE job_runs.job = ? AND job_runs.repository = ? AND job_runs.outcome = 'started'
           AND sessions.folder IS NOT NULL
         GROUP BY sessions.folder ORDER BY MAX(job_runs.id) DESC`,
      )
      .all(job, repository) as Array<{ folder: string }>;
    return rows.map(({ folder }) => folder);
  }

  /** The folders of the changes and features any job's runs in the repository are in. */
  allChangeFolders(repository: string): Set<string> {
    const rows = this.#db
      .prepare(
        `SELECT DISTINCT sessions.folder FROM job_runs JOIN sessions ON sessions.id = job_runs.session
         WHERE job_runs.repository = ? AND job_runs.outcome = 'started'
           AND sessions.folder IS NOT NULL`,
      )
      .all(repository) as Array<{ folder: string }>;
    return new Set(rows.map(({ folder }) => folder));
  }

  /** The job's latest scheduled start that failed in the repository (R45). */
  latestFailed(job: string, repository: string): JobRunRow | undefined {
    const row = this.#db
      .prepare(
        `SELECT ${COLUMNS} FROM job_runs
         WHERE job = ? AND repository = ? AND outcome = 'failed'
         ORDER BY id DESC LIMIT 1`,
      )
      .get(job, repository) as Stored | undefined;
    return row && toRow(row);
  }

  /** The run that started the session, when a job did. */
  ofSession(session: string): JobRunRow | undefined {
    const row = this.#db
      .prepare(`SELECT ${COLUMNS} FROM job_runs WHERE session = ? ORDER BY id DESC LIMIT 1`)
      .get(session) as Stored | undefined;
    return row && toRow(row);
  }

  /**
   * Moves the rows of the job `from` to the job `to`, and prunes the merged history. A time both
   * have recorded keeps the row of `from`: it is the live job's, and holds its session.
   */
  rename(from: string, to: string): void {
    if (from === to) {
      return;
    }
    transaction(this.#db, () => {
      this.#db
        .prepare(
          `DELETE FROM job_runs WHERE job = ?2 AND due IS NOT NULL AND EXISTS
             (SELECT 1 FROM job_runs AS live
              WHERE live.job = ?1 AND live.repository = job_runs.repository
                AND live.due = job_runs.due)`,
        )
        .run(from, to);
      this.#db.prepare("UPDATE job_runs SET job = ? WHERE job = ?").run(to, from);
      const repositories = this.#db
        .prepare("SELECT DISTINCT repository FROM job_runs WHERE job = ?")
        .all(to) as Array<{ repository: string }>;
      for (const { repository } of repositories) {
        this.#prune(to, repository);
      }
    });
    this.#changed();
  }

  /** Removes a row: a run whose session did not start, so its time is not marked run. */
  remove(id: number): void {
    this.#db.prepare("DELETE FROM job_runs WHERE id = ?").run(id);
    this.#changed();
  }

  /** Sets the session a run started, once it has one. */
  setSession(id: number, session: string): void {
    this.#db.prepare("UPDATE job_runs SET session = ? WHERE id = ?").run(session, id);
    this.#changed();
  }

  /** Sets, or with null clears, why the change the run offered could not start (R1). */
  setRefusal(id: number, refusal: { text: string; turn: number } | null): void {
    this.#db
      .prepare("UPDATE job_runs SET refusal = ?, refused_turn = ? WHERE id = ?")
      .run(refusal?.text ?? null, refusal?.turn ?? null, id);
    this.#changed();
  }
}
