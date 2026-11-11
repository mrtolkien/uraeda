//! "Run now" of a job in a repository. It reads no schedule, no pause, no switch for all jobs,
//! and no open change, and shares the reservation of a start with the scheduler's queue, so a
//! time and a run by hand never start two.

use uraeda_core::jobs;

use super::Scheduler;
use super::guards::{Reserved, works};
use super::place::runs_here;
use super::problem::impossible;
use super::run::{self, Started};
use crate::live::{Fault, locked};
use crate::runner::Runner;
use crate::shared::Shared;

/// Starts the job's run in the repository of this name now: its session. Refused for a job
/// with a problem other than its schedule, where it does not run or the Jobs extension is off,
/// and while its last run there works.
pub(crate) fn run_now(shared: &Shared, repository: &str, name: &str) -> Result<String, Fault> {
    let scheduler = shared.get::<Scheduler>();
    let read = jobs::read(shared.config_dir());
    if let Some(problem) = read.problem {
        return Err(Fault::refused(problem));
    }
    let Some(job) = read.jobs.iter().find(|job| job.name == name) else {
        return Err(Fault::refused(format!("There is no job named “{name}”.")));
    };
    if let Some(why) = impossible(&read.jobs, job) {
        return Err(Fault::refused(why));
    }
    let Some(root) = runs_here(shared, job, repository) else {
        return Err(Fault::refused(format!(
            "“{name}” does not run in {repository}."
        )));
    };
    let still = || Fault::refused(format!("“{name}” still runs here."));
    let reserved = Reserved::take(&scheduler, (name.to_owned(), repository.to_owned()));
    let busy = locked(&scheduler.starts).is_busy(&(name.to_owned(), root.clone()));
    let store = shared.get::<crate::runner::Store>();
    let last = store
        .job_latest_started(name, &root)?
        .and_then(|run| run.session);
    let runner = Runner::of(shared);
    let working = last.is_some_and(|session| works(&runner, &session));
    let (Some(_reserved), false, false, false) = (reserved, busy, working, scheduler.stopped())
    else {
        return Err(still());
    };
    let started = Started {
        due: None,
        manual: true,
    };
    let session = run::start(shared, job, &started, &root)?;
    session.ok_or_else(|| Fault::internal("a run by hand is recorded without a time"))
}
