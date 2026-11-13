//! The record of the scheduled jobs' runs, the store's `job_runs`: one row per time a job was
//! due in a repository, run, skipped, or failed to start, or per run by hand. The scheduler, a
//! job's history, and the acceptance of a run's offer read it: it is the authority on what ran.

use std::time::SystemTime;

use rusqlite::{Connection, OptionalExtension, Row, Transaction};

use super::store::{Store, StoreError, millis, time};

/// How many rows the history keeps for each job and repository.
pub const KEPT: u32 = 50;

/// A run of a job in a repository, a time it skipped, or a time whose run failed to start.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct JobRun {
    pub id: i64,
    pub job: String,
    /// The repository's main checkout.
    pub repository: String,
    /// The scheduled time it answers: none for "Run now".
    pub due: Option<SystemTime>,
    /// When it started, was skipped, or failed.
    pub at: SystemTime,
    /// `schedule` or `manual`.
    pub trigger: String,
    /// `started`, `skipped`, or `failed`.
    pub outcome: String,
    /// Why a time was skipped: `working` or `change-open`.
    pub reason: Option<String>,
    /// The session it started, once it has one.
    pub session: Option<String>,
    /// Why the change its run offered could not start.
    pub refusal: Option<String>,
    /// The turn whose offer was refused: a later turn's offer asks again.
    pub refused_turn: Option<i64>,
    /// The folder of the open change that blocked a time skipped as `change-open`.
    pub blocked_by: Option<String>,
    /// Why a scheduled start failed.
    pub error: Option<String>,
}

/// A row to add: see [`JobRun`].
#[derive(Clone, Debug, Default)]
pub struct NewJobRun {
    pub job: String,
    pub repository: String,
    pub due: Option<SystemTime>,
    pub at: Option<SystemTime>,
    pub trigger: &'static str,
    pub outcome: &'static str,
    pub reason: Option<&'static str>,
    pub blocked_by: Option<String>,
    pub error: Option<String>,
}

const COLUMNS: &str = "id, job, repository, due, at, trigger, outcome, reason, session, refusal,
  refused_turn, blocked_by, error";

fn job_run(row: &Row) -> rusqlite::Result<JobRun> {
    Ok(JobRun {
        id: row.get("id")?,
        job: row.get("job")?,
        repository: row.get("repository")?,
        due: row.get::<_, Option<i64>>("due")?.map(time),
        at: time(row.get("at")?),
        trigger: row.get("trigger")?,
        outcome: row.get("outcome")?,
        reason: row.get("reason")?,
        session: row.get("session")?,
        refusal: row.get("refusal")?,
        refused_turn: row.get("refused_turn")?,
        blocked_by: row.get("blocked_by")?,
        error: row.get("error")?,
    })
}

/// Drops the rows of the job in the repository past the 50 newest, but the ones the open-change
/// check and the offer's acceptance read, however many skips follow them: the latest started run
/// that has a session, and each started run whose session belongs to a change or a feature,
/// which stay while that session does. Also the latest failed start, while no run that has a
/// session started after it: the card shows it until then.
fn prune(db: &Connection, job: &str, repository: &str) -> rusqlite::Result<()> {
    db.prepare_cached(&format!(
        "DELETE FROM job_runs WHERE job = ?1 AND repository = ?2
           AND id NOT IN (SELECT id FROM job_runs WHERE job = ?1 AND repository = ?2
                          ORDER BY id DESC LIMIT {KEPT})
           AND id IS NOT (SELECT MAX(id) FROM job_runs
                          WHERE job = ?1 AND repository = ?2 AND outcome = 'started'
                            AND session IS NOT NULL)
           AND id IS NOT (SELECT MAX(id) FROM job_runs
                          WHERE job = ?1 AND repository = ?2 AND outcome = 'failed'
                            AND id > COALESCE((SELECT MAX(id) FROM job_runs
                                               WHERE job = ?1 AND repository = ?2
                                                 AND outcome = 'started'
                                                 AND session IS NOT NULL), 0))
           AND NOT EXISTS (SELECT 1 FROM sessions
                           WHERE sessions.id = job_runs.session AND sessions.folder IS NOT NULL
                             AND job_runs.outcome = 'started')"
    ))?
    .execute((job, repository))?;
    Ok(())
}

/// Writes a row as it is, its id included: the import's.
pub(super) fn insert(db: &Transaction, run: &JobRun) -> rusqlite::Result<()> {
    db.prepare_cached(&format!(
        "INSERT INTO job_runs ({COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)"
    ))?
    .execute(rusqlite::params![
        run.id,
        run.job,
        run.repository,
        run.due.map(millis),
        millis(run.at),
        run.trigger,
        run.outcome,
        run.reason,
        run.session,
        run.refusal,
        run.refused_turn,
        run.blocked_by,
        run.error,
    ])?;
    Ok(())
}

impl Store {
    /// Records a run, and prunes its job's rows in its repository. None when its time is
    /// recorded already for that job and repository: the unique index is what starts a time
    /// once, from two ticks, two servers, or a clock set back.
    pub fn add_job_run(
        &self,
        run: &NewJobRun,
        now: SystemTime,
    ) -> Result<Option<JobRun>, StoreError> {
        self.write(|db| {
            let added = db
                .prepare_cached(&format!(
                    "INSERT INTO job_runs
                       (job, repository, due, at, trigger, outcome, reason, blocked_by, error)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                     ON CONFLICT (job, repository, due) DO NOTHING RETURNING {COLUMNS}"
                ))?
                .query_row(
                    rusqlite::params![
                        run.job,
                        run.repository,
                        run.due.map(millis),
                        millis(run.at.unwrap_or(now)),
                        run.trigger,
                        run.outcome,
                        run.reason,
                        run.blocked_by,
                        run.error,
                    ],
                    job_run,
                )
                .optional()?;
            if added.is_some() {
                prune(db, &run.job, &run.repository)?;
            }
            Ok(added)
        })
    }

    /// Whether the time `due` of the job is recorded in the repository.
    pub fn job_recorded(
        &self,
        job: &str,
        repository: &str,
        due: SystemTime,
    ) -> Result<bool, StoreError> {
        self.read(|db| {
            let found = db
                .prepare_cached(
                    "SELECT 1 FROM job_runs WHERE job = ?1 AND repository = ?2 AND due = ?3",
                )?
                .query_row((job, repository, millis(due)), |_| Ok(()))
                .optional()?;
            Ok(found.is_some())
        })
    }

    /// The rows of a query of one or no row.
    fn job_run_where(
        &self,
        query: &str,
        params: impl rusqlite::Params,
    ) -> Result<Option<JobRun>, StoreError> {
        self.read(|db| {
            let sql =
                format!("SELECT {COLUMNS} FROM job_runs WHERE {query} ORDER BY id DESC LIMIT 1");
            Ok(db
                .prepare_cached(&sql)?
                .query_row(params, job_run)
                .optional()?)
        })
    }

    /// The job's runs in the repository, the newest first, 50 at most.
    pub fn job_history(&self, job: &str, repository: &str) -> Result<Vec<JobRun>, StoreError> {
        self.read(|db| {
            let sql = format!(
                "SELECT {COLUMNS} FROM job_runs WHERE job = ?1 AND repository = ?2
                 ORDER BY id DESC LIMIT {KEPT}"
            );
            let mut read = db.prepare_cached(&sql)?;
            let rows = read.query_map((job, repository), job_run)?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// The job's latest run that started a session in the repository, once it has one.
    pub fn job_latest_started(
        &self,
        job: &str,
        repository: &str,
    ) -> Result<Option<JobRun>, StoreError> {
        let query = "job = ?1 AND repository = ?2 AND outcome = 'started' AND session IS NOT NULL";
        self.job_run_where(query, (job, repository))
    }

    /// The job's latest scheduled start that failed in the repository.
    pub fn job_latest_failed(
        &self,
        job: &str,
        repository: &str,
    ) -> Result<Option<JobRun>, StoreError> {
        let query = "job = ?1 AND repository = ?2 AND outcome = 'failed'";
        self.job_run_where(query, (job, repository))
    }

    /// The run that started the session, when a job did.
    pub fn job_run_of(&self, session: &str) -> Result<Option<JobRun>, StoreError> {
        self.job_run_where("session = ?1", [session])
    }

    /// The folders of the changes and features the sessions of the job's runs in the repository
    /// are in, the one of the latest run first.
    pub fn job_change_folders(
        &self,
        job: &str,
        repository: &str,
    ) -> Result<Vec<String>, StoreError> {
        self.read(|db| {
            let mut read = db.prepare_cached(
                "SELECT sessions.folder FROM job_runs JOIN sessions ON sessions.id = job_runs.session
                 WHERE job_runs.job = ?1 AND job_runs.repository = ?2
                   AND job_runs.outcome = 'started' AND sessions.folder IS NOT NULL
                 GROUP BY sessions.folder ORDER BY MAX(job_runs.id) DESC",
            )?;
            let rows = read.query_map((job, repository), |row| row.get(0))?;
            Ok(rows.collect::<rusqlite::Result<_>>()?)
        })
    }

    /// Moves the rows of the job `from` to the job `to`, and prunes the merged history. A time
    /// both recorded keeps the row of `from`: it is the live job's, and holds its session.
    pub fn rename_job(&self, from: &str, to: &str) -> Result<(), StoreError> {
        if from == to {
            return Ok(());
        }
        self.write(|db| {
            db.execute(
                "DELETE FROM job_runs WHERE job = ?2 AND due IS NOT NULL AND EXISTS
                   (SELECT 1 FROM job_runs AS live
                    WHERE live.job = ?1 AND live.repository = job_runs.repository
                      AND live.due = job_runs.due)",
                (from, to),
            )?;
            db.execute("UPDATE job_runs SET job = ?1 WHERE job = ?2", (to, from))?;
            let mut read = db.prepare("SELECT DISTINCT repository FROM job_runs WHERE job = ?1")?;
            let repositories: Vec<String> = read
                .query_map([to], |row| row.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            for repository in repositories {
                prune(db, to, &repository)?;
            }
            Ok(())
        })
    }

    /// Removes a row: a run whose session did not start, so its time is not marked run.
    pub fn remove_job_run(&self, id: i64) -> Result<(), StoreError> {
        self.write(|db| {
            Ok(db
                .execute("DELETE FROM job_runs WHERE id = ?1", [id])
                .map(drop)?)
        })
    }

    /// Sets the session a run started, once it has one.
    pub fn set_job_run_session(&self, id: i64, session: &str) -> Result<(), StoreError> {
        let sql = "UPDATE job_runs SET session = ?1 WHERE id = ?2";
        self.write(|db| Ok(db.execute(sql, (session, id)).map(drop)?))
    }

    /// Sets, or with none clears, why the change the run offered could not start, with the
    /// turn that offer ended.
    pub fn set_job_refusal(&self, id: i64, refusal: Option<(&str, i64)>) -> Result<(), StoreError> {
        let (text, turn) = refusal.unzip();
        let sql = "UPDATE job_runs SET refusal = ?1, refused_turn = ?2 WHERE id = ?3";
        self.write(|db| Ok(db.execute(sql, (text, turn, id)).map(drop)?))
    }
}

impl super::Runner {
    /// Adds a line of Uraeda's at the end of a turn's transcript, as the line saying the change
    /// a job's run offered started: its page shows it.
    pub(crate) fn note(&self, session: &str, turn: i64, text: &str) {
        let (Ok(row), store) = (self.row(session), self.store()) else {
            return;
        };
        let Ok(added) = store.append(turn, self.now(), &super::running::line(text)) else {
            return;
        };
        let page = store.page_of(turn, added.seq).ok().flatten();
        self.page_changed(&row.repo, turn, page.unwrap_or_default());
    }

    /// Says a session changed, as what it reads beyond its turns did: a job's refusal.
    pub(crate) fn session_changed(&self, session: &str) {
        let mut state = self.state();
        self.changed(&mut state, session, None, None);
    }
}
