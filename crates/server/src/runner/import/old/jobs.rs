//! The scheduled jobs' runs of the Node server's store, its `job_runs`, which the import copies
//! as they are: the same columns, its times already in milliseconds, its ids kept.

use rusqlite::Transaction;

use super::Old;
use crate::runner::job_runs::{self, JobRun};
use crate::runner::store::time;

impl Old {
    /// Every run of a job, the oldest first.
    fn job_runs(&self) -> rusqlite::Result<Vec<JobRun>> {
        let mut read = self.0.prepare(
            "SELECT id, job, repository, CAST(due AS INTEGER) AS due, CAST(at AS INTEGER) AS at,
               trigger, outcome, reason, session, refusal,
               CAST(refused_turn AS INTEGER) AS refused_turn, blocked_by, error
             FROM job_runs ORDER BY id",
        )?;
        let runs = read.query_map([], |row| {
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
        })?;
        runs.collect()
    }

    /// Copies every run of a job into the new store: how many.
    pub(in crate::runner::import) fn copy_job_runs(
        &self,
        new: &Transaction,
    ) -> Result<rusqlite::Result<u64>, rusqlite::Error> {
        let runs = self.job_runs()?;
        Ok(runs
            .iter()
            .try_for_each(|run| job_runs::insert(new, run))
            .map(|()| runs.len() as u64))
    }
}
