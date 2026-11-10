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
  /** The scheduled time it answers, in ms since the epoch: null for "Run now". */
  due: number | null;
  id: number;
  job: string;
  outcome: "skipped" | "started";
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
  due: number | null;
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

function toRow({ refused_turn: refusedTurn, ...row }: Stored): JobRunRow {
  return { ...row, refusedTurn };
}

/** The table's columns, as `SELECT` lists them. */
const COLUMNS =
  "id, job, repository, due, at, trigger, outcome, reason, session, refusal, refused_turn";

/** The record of runs: made by `SessionCache`, which owns the database. */
export class JobRuns {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /**
   * Records a run, and drops the oldest rows of its job and repository past 50, but its latest
   * started one. Returns the row, or undefined when its `due` time is recorded already for that job
   * and repository.
   */
  add(row: Omit<JobRunRow, "id" | "refusal" | "refusedTurn">): JobRunRow | undefined {
    return transaction(this.#db, () => {
      const stored = this.#db
        .prepare(
          `INSERT OR IGNORE INTO job_runs
             (job, repository, due, at, trigger, outcome, reason, session)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
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
        ) as Stored | undefined;
      if (stored === undefined) {
        return undefined;
      }
      this.#prune(row.job, row.repository);
      return toRow(stored);
    });
  }

  /**
   * Drops the rows of the job in the repository past the 50 newest, but the latest started one:
   * the open-change check and the offer's acceptance read it, however many skips follow it.
   */
  #prune(job: string, repository: string): void {
    this.#db
      .prepare(
        `DELETE FROM job_runs WHERE job = ?1 AND repository = ?2
           AND id NOT IN (SELECT id FROM job_runs WHERE job = ?1 AND repository = ?2
                          ORDER BY id DESC LIMIT ${KEPT})
           AND id IS NOT (SELECT MAX(id) FROM job_runs
                          WHERE job = ?1 AND repository = ?2 AND outcome = 'started')`,
      )
      .run(job, repository);
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

  /** The job's latest run that started a session in the repository. */
  latestStarted(job: string, repository: string): JobRunRow | undefined {
    const row = this.#db
      .prepare(
        `SELECT ${COLUMNS} FROM job_runs
         WHERE job = ? AND repository = ? AND outcome = 'started' ORDER BY id DESC LIMIT 1`,
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
  }

  /** Sets, or with null clears, why the change the run offered could not start (R1). */
  setRefusal(id: number, refusal: { text: string; turn: number } | null): void {
    this.#db
      .prepare("UPDATE job_runs SET refusal = ?, refused_turn = ? WHERE id = ?")
      .run(refusal?.text ?? null, refusal?.turn ?? null, id);
  }
}
