//! The record `Jobs` of a repository: the jobs that name it, and those that name no repository
//! of the list, each with its problem, its next run or why not, its last run, and its history.

use std::collections::HashSet;
use std::time::SystemTime;

use uraeda_core::jobs::{self as core, Job as CoreJob};
use uraeda_protocol::{
    Job, JobBlockedBy, JobNext, JobNotNext, JobOutcome, JobRun, JobSchedule, JobSkip, JobTrigger,
    Jobs,
};

use crate::jobs::problem::core_problem;
use crate::jobs::times::next_after;
use crate::jobs::{Scheduler, agent_words, open_changes};
use crate::live::Fault;
use crate::records::{repositories, settings};
use crate::runner::{JobRun as Row, Store};
use crate::shared::Shared;

/// A time as RFC 3339.
fn rfc3339(time: SystemTime) -> String {
    uraeda_core::today::rfc3339(time)
}

/// The record of the repository of this name.
pub(super) fn jobs(shared: &Shared, name: &str) -> Result<Jobs, Fault> {
    let root = repositories::path(shared, name)?
        .to_string_lossy()
        .into_owned();
    let read = core::read(shared.config_dir());
    let listed: HashSet<String> = repositories::all(shared)
        .into_iter()
        .map(|repository| repository.name)
        .collect();
    // A job that names no repository of the list runs nowhere: every repository lists it, so the
    // human finds it.
    let lists_here = |job: &CoreJob| {
        job.repositories.iter().any(|one| one == name)
            || job.repositories.iter().all(|one| !listed.contains(one))
    };
    let store = shared.get::<Store>();
    let here: Vec<(usize, &CoreJob)> = read
        .jobs
        .iter()
        .enumerate()
        .filter(|(_, job)| lists_here(job))
        .collect();
    // The workspace is read once, and only when a job started a change, or skipped a time for
    // one, whose title the history says.
    let looks = here.iter().any(|(_, job)| {
        let started = store.job_change_folders(&job.name, &root);
        let history = store.job_history(&job.name, &root);
        !started.unwrap_or_default().is_empty()
            || history
                .unwrap_or_default()
                .iter()
                .any(|run| run.blocked_by.is_some())
    });
    let changes = looks.then(|| open_changes(&root));
    let place = Place {
        shared,
        store: &store,
        name,
        root: &root,
        listed: &listed,
        changes: changes.as_ref(),
    };
    let scheduler = shared.find::<Scheduler>();
    let zone = scheduler
        .as_ref()
        .and_then(|scheduler| scheduler.zone.iana_name().map(str::to_owned));
    Ok(Jobs {
        enabled: settings::current(shared).runs.scheduled_jobs.in_force,
        jobs: here
            .into_iter()
            .map(|(index, job)| place.row(index, job))
            .collect::<Result<_, Fault>>()?,
        problem: read.problem,
        time_zone: zone.unwrap_or_else(|| "UTC".to_owned()),
    })
}

/// What a row of the record reads: the repository, and the workspace's changes once read.
struct Place<'a> {
    shared: &'a Shared,
    store: &'a Store,
    name: &'a str,
    root: &'a str,
    listed: &'a HashSet<String>,
    changes: Option<&'a crate::jobs::Changes>,
}

impl Place<'_> {
    fn row(&self, index: usize, job: &CoreJob) -> Result<Job, Fault> {
        let history = self.store.job_history(&job.name, self.root)?;
        let missing = job
            .repositories
            .iter()
            .find(|one| !self.listed.contains(*one));
        let local = missing.map(|missing| format!("“{missing}” is not in Uraeda's list."));
        Ok(Job {
            name: job.name.clone(),
            index: u32::try_from(index).unwrap_or(u32::MAX),
            prompt: job.prompt.clone(),
            schedule_text: job.schedule_text.clone(),
            schedule: job.schedule.as_ref().map(|schedule| JobSchedule {
                kind: schedule.kind.clone(),
                day: schedule.day,
                hour: schedule.hour,
                minute: schedule.minute,
            }),
            repositories: job.repositories.clone(),
            on: job.on,
            report_only: job.report_only,
            agent: job.agent.clone(),
            model: job.model.clone(),
            effort: job.effort.clone(),
            problem: job.problem.as_deref().map(core_problem).or(local),
            next: self.next(job)?,
            last: self.last(&job.name)?,
            history: history
                .iter()
                .map(|run| self.run(run))
                .collect::<Result<_, Fault>>()?,
        })
    }

    /// When the job runs next here, or why not, in the order the scheduler decides in.
    fn next(&self, job: &CoreJob) -> Result<JobNext, Fault> {
        let not = |why: JobNotNext, text: Option<String>| JobNext {
            at: None,
            why: Some(why),
            text,
        };
        let here = job.repositories.iter().any(|one| one == self.name);
        let (Some(schedule), None, true) = (&job.schedule, &job.problem, here) else {
            return Ok(not(JobNotNext::Problem, None));
        };
        if !job.on {
            return Ok(not(JobNotNext::Paused, None));
        }
        if !crate::jobs::enabled(self.shared) {
            return Ok(not(JobNotNext::Off, None));
        }
        let agent = crate::jobs::runs_here(self.shared, job, self.name)
            .and_then(|root| crate::jobs::place_available(self.shared, job, &root));
        if agent != Some(true) {
            let words = agent_words(self.shared, job, self.name);
            return Ok(not(JobNotNext::AgentOff, Some(words)));
        }
        let folders = self.store.job_change_folders(&job.name, self.root)?;
        let open = self
            .changes
            .is_some_and(|changes| folders.iter().any(|one| changes.open.contains(one)));
        if open {
            return Ok(not(JobNotNext::ChangeOpen, None));
        }
        let zone = &self.shared.get::<Scheduler>().zone;
        let at = next_after(schedule, zone, self.shared.now());
        Ok(JobNext {
            at: at.map(rfc3339),
            why: None,
            text: None,
        })
    }

    /// The job's latest run here: the latest that started a session, or the latest start that
    /// failed, when it is newer. A skipped time is no run.
    fn last(&self, job: &str) -> Result<Option<JobRun>, Fault> {
        let started = self.store.job_latest_started(job, self.root)?;
        let failed = self.store.job_latest_failed(job, self.root)?;
        let last = match (started, failed) {
            (Some(started), Some(failed)) if failed.id > started.id => Some(failed),
            (started, None) | (started @ Some(_), Some(_)) => started,
            (None, failed) => failed,
        };
        last.map(|run| self.run(&run)).transpose()
    }

    /// A run as the history lists it, with its session's folder and title.
    fn run(&self, run: &Row) -> Result<JobRun, Fault> {
        let session = match &run.session {
            Some(id) => self.store.session(id)?,
            None => None,
        };
        let titles = self.changes.map(|changes| &changes.titles);
        let blocked_by = run.blocked_by.as_ref().and_then(|folder| {
            let title = titles?.get(folder)?;
            Some(JobBlockedBy {
                folder: folder.clone(),
                title: title.clone(),
            })
        });
        Ok(JobRun {
            id: run.id.to_string(),
            at: rfc3339(run.at),
            due: run.due.map(rfc3339),
            trigger: match run.trigger.as_str() {
                "manual" => JobTrigger::Manual,
                _ => JobTrigger::Schedule,
            },
            outcome: match run.outcome.as_str() {
                "skipped" => JobOutcome::Skipped,
                "failed" => JobOutcome::Failed,
                _ => JobOutcome::Started,
            },
            reason: run.reason.as_deref().map(|reason| match reason {
                "change-open" => JobSkip::ChangeOpen,
                _ => JobSkip::Working,
            }),
            blocked_by,
            error: run.error.clone(),
            refusal: run.refusal.clone(),
            session: session.as_ref().map(|session| session.id.clone()),
            title: session.as_ref().and_then(|session| session.title.clone()),
            folder: session.and_then(|session| session.folder),
        })
    }
}
