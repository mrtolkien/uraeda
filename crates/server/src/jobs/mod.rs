//! The scheduled jobs: the scheduler, the only code that starts a scheduled run, "Run now", and
//! the acceptance of the change a run offers.
//!
//! A job is the human's own, a `[[jobs]]` table of their settings, which the core reads and
//! writes (`uraeda_core::jobs`): nothing here reads a job from a repository. Every time is the
//! server's, `shared.now()`, read in its local time zone.
//!
//! - The scheduler looks every 30 seconds, and each time the settings file changes, for the times
//!   due, and queues them; the queue starts them a minute apart, reading the job and its guards
//!   again right before each start ([`scheduler`]). A time is recorded once, in the store's
//!   `job_runs`, which is the authority on what ran.
//! - A run is a chat of the main checkout ([`run`]). Its turn's end is read for a change offer,
//!   which starts the change as the offer's card would ([`accept`]).
//! - The record `Jobs` and its actions are in `records/jobs.rs`.

mod accept;
mod guards;
mod place;
pub(crate) mod problem;
mod run;
mod run_now;
mod scheduler;
pub(crate) mod times;

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime};

use jiff::tz::TimeZone;
use uraeda_protocol::Jobs;

pub(crate) use self::accept::{moved, turn_ended};
pub(crate) use self::guards::{Changes, Starts, open_changes};
pub(crate) use self::place::{agent_words, place_available, runs_here};
pub(crate) use self::run_now::run_now;
use self::scheduler::Ticking;
use crate::Failure;
use crate::http::Routes;
use crate::live::{Bus, locked};
use crate::records::settings;
use crate::shared::Shared;

/// The scheduler looks every 30 seconds.
const TICK: Duration = Duration::from_secs(30);

/// Runs due together start a minute apart.
const APART: Duration = Duration::from_secs(60);

/// What `ura serve-app --no-scheduled-jobs` provides: no job starts at its times.
pub struct NoScheduledJobs;

/// What the scheduled jobs keep in memory: `shared.get::<Scheduler>()`.
pub(crate) struct Scheduler {
    /// The zone the schedules run in: the server's own.
    pub zone: TimeZone,
    /// Held through a look and the starts it makes: one at a time.
    ticking: Mutex<Ticking>,
    /// The starts reserved, and the jobs an acceptance holds busy.
    pub starts: Mutex<Starts>,
    /// Held by the acceptance that runs: one at a time, and the stop waits for it.
    accepting: Mutex<()>,
    stopped: AtomicBool,
    /// The problems printed already, each once.
    printed: Mutex<HashSet<String>>,
}

impl Scheduler {
    /// Whether the scheduler stopped with the server.
    pub(crate) fn stopped(&self) -> bool {
        self.stopped.load(Ordering::SeqCst)
    }

    /// Prints a problem once.
    pub(crate) fn print_once(&self, key: String, text: &str) {
        if locked(&self.printed).insert(key) {
            say_err!("uraeda: {text}");
        }
    }
}

/// Whether jobs start at their times: the scheduler runs, and the switch in force is on.
pub(crate) fn enabled(shared: &Shared) -> bool {
    let scheduler = shared.find::<Scheduler>();
    let running = scheduler.is_some_and(|scheduler| !scheduler.stopped());
    running && settings::current(shared).runs.scheduled_jobs.in_force
}

/// Says the record `Jobs` of every repository changed.
pub(crate) fn announce(shared: &Shared) {
    shared.get::<Bus>().changed_all::<Jobs>();
}

/// Starts the scheduler, once the sessions' manager runs: it looks now, which only notes what
/// each job is due, then every 30 seconds. As the server stops, it starts nothing more, and
/// waits for the look and the acceptance in flight.
pub(crate) fn mount(shared: &Shared, _routes: &mut Routes) -> Result<(), Failure> {
    shared.provide(Scheduler {
        zone: TimeZone::system(),
        ticking: Mutex::new(Ticking::default()),
        starts: Mutex::default(),
        accepting: Mutex::default(),
        stopped: AtomicBool::new(false),
        printed: Mutex::default(),
    });
    let looking = shared.clone();
    tokio::spawn(async move {
        loop {
            let ticking = looking.clone();
            let _ = tokio::task::spawn_blocking(move || scheduler::tick(&ticking)).await;
            tokio::select! {
                () = looking.stopping() => return,
                () = tokio::time::sleep(TICK) => {}
            }
        }
    });
    let stopping = shared.clone();
    shared.on_stop("jobs", async move {
        let scheduler = stopping.get::<Scheduler>();
        scheduler.stopped.store(true, Ordering::SeqCst);
        let waiting = tokio::task::spawn_blocking(move || {
            // Each lock is taken once what holds it ended: a look, and an acceptance.
            drop(locked(&scheduler.ticking));
            drop(locked(&scheduler.accepting));
        });
        let _ = waiting.await;
    });
    Ok(())
}

/// Looks for the times due now, and starts those whose turn it is, before it returns: what the
/// timer does every 30 seconds, and the settings' change too. A test moves the server's clock,
/// then ticks.
pub async fn tick(shared: &Shared) {
    let ticking = shared.clone();
    let _ = tokio::task::spawn_blocking(move || scheduler::tick(&ticking)).await;
}

/// Waits until no acceptance of a run's offer holds a job busy: the ones whose turn ended are
/// decided. A test reads what they did after it.
pub async fn settled(shared: &Shared) {
    let scheduler = shared.get::<Scheduler>();
    let _ = tokio::task::spawn_blocking(move || {
        while !locked(&scheduler.starts).is_idle() {
            drop(locked(&scheduler.accepting));
            std::thread::yield_now();
        }
    })
    .await;
}

/// The settings file changed: a job saved, resumed, or switched on just before its time runs
/// at it, and the record shows the change.
pub(crate) fn config_changed(shared: &Shared) {
    announce(shared);
    let runner = crate::runner::Runner::find(shared);
    if let Some(runner) = runner.filter(|_| shared.find::<Scheduler>().is_some()) {
        runner.spawn(|runner| scheduler::tick(&runner.shared));
    }
}

/// Wakes the queue once the minute after the last start ended: `at` on the server's clock.
fn wake_at(shared: &Shared, at: SystemTime) {
    let wait = at.duration_since(shared.now()).unwrap_or_default();
    let waking = shared.clone();
    tokio::spawn(async move {
        tokio::select! {
            () = waking.stopping() => {}
            () = tokio::time::sleep(wait) => {
                let ticking = waking.clone();
                let _ = tokio::task::spawn_blocking(move || scheduler::tick(&ticking)).await;
            }
        }
    });
}

/// The key of a job in a repository, both by name.
pub(crate) type Key = (String, String);

/// What the scheduler has seen of each job in each repository.
pub(crate) type Seen = HashMap<Key, (SystemTime, uraeda_core::jobs::Schedule)>;
