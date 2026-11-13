//! The scheduler: the only code that starts a scheduled run. Each look reads the jobs, and
//! queues the time each one is due where it runs, when the server saw that time arrive; the
//! queue starts them a minute apart, reading the job and its guards again right before each
//! start. Every start goes through the record of runs, which holds one row per time.

use std::collections::{HashSet, VecDeque};
use std::time::SystemTime;

use uraeda_core::jobs::{self, Job};

use super::guards::{Reserved, Skip, read_for, skip_now};
use super::place::place_of;
use super::run::{self, Started};
use super::times::{MISSED_AFTER, due_at, startable};
use super::{APART, Key, Scheduler, Seen, enabled, wake_at};
use crate::live::locked;
use crate::runner::{NewJobRun, Store};
use crate::shared::Shared;

/// A time due in a repository, to start.
#[derive(Clone)]
pub(super) struct Due {
    due: SystemTime,
    job: Job,
    /// The repository's name in the list.
    name: String,
    root: String,
}

impl Due {
    fn key(&self) -> (String, String, SystemTime) {
        (self.job.name.clone(), self.name.clone(), self.due)
    }
}

/// What a look keeps between looks.
#[derive(Default)]
pub(super) struct Ticking {
    /// When this scheduler first saw each job on in each repository, with its schedule: a time
    /// before is not one it saw arrive.
    seen: Seen,
    /// The times due and not started yet, in order.
    queue: VecDeque<Due>,
    /// When the queue last started a run: the next waits a minute after it.
    last_start: Option<SystemTime>,
}

/// Looks for the times due now, queues them, and starts those whose turn it is.
pub(super) fn tick(shared: &Shared) {
    let scheduler = shared.get::<Scheduler>();
    let mut ticking = locked(&scheduler.ticking);
    if !enabled(shared) {
        ticking.seen.clear();
        ticking.queue.clear();
        return;
    }
    let now = shared.now();
    // The minute after the last start took more than 5 minutes beyond its length: the machine
    // slept, and every time still queued is hours old. They are dropped, recording nothing.
    if let Some(last) = ticking.last_start
        && now.duration_since(last).unwrap_or_default() > APART + MISSED_AFTER
    {
        ticking.queue.clear();
        ticking.last_start = None;
    }
    let read = jobs::read(shared.config_dir());
    if read.problem.is_some() {
        ticking.seen.clear();
    } else {
        let found = due_now(shared, &mut ticking.seen, &read.jobs, now);
        let queued: HashSet<_> = ticking.queue.iter().map(Due::key).collect();
        let store = shared.get::<Store>();
        let recorded = |due: &Due| {
            let recorded = store.job_recorded(&due.job.name, &due.root, due.due);
            recorded.unwrap_or(true)
        };
        let fresh = found
            .into_iter()
            .filter(|due| !queued.contains(&due.key()) && !recorded(due));
        ticking.queue.extend(fresh.collect::<Vec<_>>());
    }
    drain(shared, &scheduler, &mut ticking);
}

/// The times due now in the repositories where each job runs. A job off, paused, or no longer
/// in a repository loses the moment it was seen there: back, it is new.
fn due_now(shared: &Shared, seen: &mut Seen, jobs: &[Job], now: SystemTime) -> Vec<Due> {
    let zone = &shared.get::<Scheduler>().zone;
    let mut found = Vec::new();
    let mut eligible: HashSet<Key> = HashSet::new();
    for job in jobs {
        for name in &job.repositories {
            let (Some(place), Some(schedule)) = (place_of(shared, job, name), &job.schedule) else {
                continue;
            };
            let Some(due) = due_at(schedule, zone, now) else {
                continue;
            };
            let key = (job.name.clone(), name.clone());
            eligible.insert(key.clone());
            // A schedule edited is a job added: the moment it was seen starts again.
            let first = match seen.get(&key) {
                Some((first, before)) if before == schedule => *first,
                _ => now,
            };
            seen.insert(key, (first, schedule.clone()));
            if place.available && startable(due, first, now) {
                found.push(Due {
                    due,
                    job: job.clone(),
                    name: name.clone(),
                    root: place.root,
                });
            }
        }
    }
    seen.retain(|key, _| eligible.contains(key));
    found
}

/// Starts the queued times in order, each a minute after the last start: one whose minute has
/// not passed waits for a wake at its end. The switch turned off, or the server stopping, drops
/// the queue.
fn drain(shared: &Shared, scheduler: &Scheduler, ticking: &mut Ticking) {
    while let Some(item) = ticking.queue.front().cloned() {
        let now = shared.now();
        if let Some(last) = ticking.last_start {
            let waited = now.duration_since(last).unwrap_or_default();
            if waited < APART {
                wake_at(shared, last + APART);
                return;
            }
        }
        ticking.queue.pop_front();
        if start_one(shared, scheduler, &item) {
            ticking.last_start = Some(shared.now());
        }
        if !enabled(shared) {
            ticking.queue.clear();
        }
    }
    ticking.last_start = None;
}

/// Records a time skipped, once: the unique row of the time keeps it from a second.
fn skip(shared: &Shared, store: &Store, item: &Due, why: &Skip) {
    let blocked_by = match why {
        Skip::ChangeOpen(folder) => Some(folder.clone()),
        Skip::Working => None,
    };
    let row = NewJobRun {
        job: item.job.name.clone(),
        repository: item.root.clone(),
        due: Some(item.due),
        trigger: "schedule",
        outcome: "skipped",
        reason: Some(why.reason()),
        blocked_by,
        ..NewJobRun::default()
    };
    if store.add_job_run(&row, shared.now()).is_ok() {
        super::announce(shared);
    }
}

/// Records a time whose session did not start, once, with why: it is not tried again.
fn fail(shared: &Shared, store: &Store, item: &Due, error: &str) {
    let row = NewJobRun {
        job: item.job.name.clone(),
        repository: item.root.clone(),
        due: Some(item.due),
        trigger: "schedule",
        outcome: "failed",
        error: Some(error.to_owned()),
        ..NewJobRun::default()
    };
    if store.add_job_run(&row, shared.now()).is_ok() {
        super::announce(shared);
    }
}

/// The job as it is now, when its queued time still holds: the job exists, runs the same
/// schedule there, in the same main checkout, with its agent available. The time's own age is
/// not read: a look saw it in time. None drops the time, recording nothing.
fn fresh(shared: &Shared, item: &Due) -> Option<Job> {
    let read = jobs::read(shared.config_dir());
    if read.problem.is_some() {
        return None;
    }
    let job = read
        .jobs
        .into_iter()
        .find(|job| job.name == item.job.name)?;
    let place = place_of(shared, &job, &item.name)?;
    let same = place.root == item.root && job.schedule == item.job.schedule;
    (same && place.available).then_some(job)
}

/// Starts or skips one due time: whether it started a session. The start of the job in the
/// repository is reserved from its first read to its start: a run by hand finds it taken. The
/// workspace is read first, as it is slow, then the job, then the guards, which read only what
/// is in memory and the store, and the row is written right after them.
fn start_one(shared: &Shared, scheduler: &Scheduler, item: &Due) -> bool {
    let store = shared.get::<Store>();
    if store
        .job_recorded(&item.job.name, &item.root, item.due)
        .unwrap_or(true)
    {
        return false;
    }
    let key = (item.job.name.clone(), item.name.clone());
    let Some(_reserved) = Reserved::take(scheduler, key) else {
        skip(shared, &store, item, &Skip::Working);
        return false;
    };
    let read = read_for(&store, &item.job.name, &item.root);
    let Some(job) = fresh(shared, item).filter(|_| enabled(shared)) else {
        return false;
    };
    if let Some(why) = skip_now(shared, &job.name, &item.root, read.as_ref()) {
        skip(shared, &store, item, &why);
        return false;
    }
    let started = Started {
        due: Some(item.due),
        manual: false,
    };
    match run::start(shared, &job, &started, &item.root) {
        Ok(session) => session.is_some(),
        Err(fault) => {
            // A start cut by the server's stop failed for no reason of the job's: nothing is
            // recorded, and the time is not run, as a missed one.
            if !scheduler.stopped() {
                fail(shared, &store, item, fault.message());
            }
            let why = format!(
                "the run of {} in {} was refused: {}",
                job.name,
                item.name,
                fault.message()
            );
            let key = format!("{}\0{}\0{:?}", job.name, item.name, item.due);
            scheduler.print_once(key, &why);
            false
        }
    }
}
