//! The pull requests' refresh: each listed repository's open and merged pull requests, asked of
//! `gh` and kept by the core, which gives every read of the repository's workspace its
//! features' pull requests, and the steps they decide.
//!
//! A repository is asked:
//!
//! - as the server starts, and as it joins the list;
//! - after a burst of the watcher that says a branch moved: a feature changed, or a feature, a
//!   branch, or a worktree came or went;
//! - every minute while one of its branches is past its last task, where the pull request's
//!   state, which no file of the repository says, decides the next step.
//!
//! One round runs at a time, on a blocking thread: the bursts told meanwhile are one round
//! after it, each repository asked once. A refresh that changed what is known tells the bus,
//! so the workspace's and the features' records of the repository are read again. The server's
//! stop ends the round that runs, and the `gh` it waits for.
//!
//! It is the Node server's `pulls.ts`. What follows a refresh is in [`SETTLED`].

mod gh;

use std::collections::BTreeMap;
use std::time::Duration;

use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender, unbounded_channel};
use tokio::time::{Instant, MissedTickBehavior, interval_at};
use uraeda_core::git::Git;
use uraeda_core::steps::StepName;
use uraeda_core::watch::Changes;
use uraeda_core::{api, pulls};

use super::{features, repositories, sessions, workspace};
use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// How often a repository is asked again while one of its branches is past its last task.
const EVERY: Duration = Duration::from_secs(60);

/// The steps whose pull request's state decides the next one: a branch at one of them is past
/// its last task.
const PAST_LAST_TASK: [StepName; 7] = [
    StepName::CatchUp,
    StepName::FinalReview,
    StepName::Finish,
    StepName::PullRequest,
    StepName::PullRequestChanges,
    StepName::PullRequestUnknown,
    StepName::Push,
];

/// What a domain does once a repository's pull requests are settled: it gets the server's
/// shared state and the repository's name in the list, on a blocking thread, after each burst
/// of the watcher, once the refresh it asked for ended, and after each other refresh that
/// changed what is known. The repository's workspace, read from there, holds each feature's
/// pull request and the step it decides. One line per domain.
///
/// The sessions start the catch-up runs here, not on the burst itself: a burst read before its
/// refresh ended would see a pull request opened or merged on GitHub as it was before.
const SETTLED: &[fn(&Shared, &str)] = &[sessions::settled];

/// Where the refresher is told of a repository to settle: `shared.get::<Refresher>()`.
struct Refresher {
    bursts: UnboundedSender<Burst>,
}

/// A repository to settle, and whether its pull requests are asked first.
struct Burst {
    repository: String,
    refresh: bool,
}

/// Starts the refresh: every repository of the list is asked now, and the rounds run until
/// the server stops, which waits for the one that runs.
pub(super) fn register(shared: &Shared, _: &Registry) -> Result<(), Failure> {
    let (bursts, told) = unbounded_channel();
    shared.provide(Refresher { bursts });
    for repository in repositories::all(shared) {
        tell(shared, &repository.name, true);
    }
    let rounds = tokio::spawn(run(shared.clone(), told));
    shared.on_stop("pull requests", async move {
        // The rounds end by themselves as the server stops: a round that panicked ended too.
        let _ = rounds.await;
    });
    Ok(())
}

/// A burst of the watcher ended: the repository is settled, after its pull requests were asked
/// again when a branch moved.
pub(super) fn files_changed(shared: &Shared, repository: &str, changes: &Changes) {
    let moved = !changes.features.is_empty() || changes.workspace;
    tell(shared, repository, moved);
}

/// A repository joined the list once the server runs: it is asked now.
pub(super) fn repository_joined(shared: &Shared, repository: &str) {
    tell(shared, repository, true);
}

/// Tells the refresher of a repository to settle.
fn tell(shared: &Shared, repository: &str, refresh: bool) {
    let burst = Burst {
        repository: repository.to_owned(),
        refresh,
    };
    // The rounds ended with the server: nothing is left to ask for.
    let _ = shared.get::<Refresher>().bursts.send(burst);
}

/// Runs the rounds, one at a time, until the server stops: the bursts told, and each minute's.
async fn run(shared: Shared, mut told: UnboundedReceiver<Burst>) {
    let mut minutes = interval_at(Instant::now() + EVERY, EVERY);
    minutes.set_missed_tick_behavior(MissedTickBehavior::Delay);
    loop {
        let round = tokio::select! {
            biased;
            () = shared.stopping() => return,
            Some(burst) = told.recv() => Round::Bursts(together(burst, &mut told)),
            _ = minutes.tick() => Round::Minute,
        };
        let shared = shared.clone();
        // A round that panicked is the next one's to do again.
        let _ = tokio::task::spawn_blocking(move || round.run(&shared)).await;
    }
}

/// A burst and those told since, as one round: each repository once, asked when one of its
/// bursts asks.
fn together(first: Burst, told: &mut UnboundedReceiver<Burst>) -> BTreeMap<String, bool> {
    let mut bursts = BTreeMap::new();
    let mut next = Some(first);
    while let Some(burst) = next {
        *bursts.entry(burst.repository).or_default() |= burst.refresh;
        next = told.try_recv().ok();
    }
    bursts
}

/// What a round does.
enum Round {
    /// Settles each of these repositories, after asking for its pull requests where it says.
    Bursts(BTreeMap<String, bool>),
    /// Asks each listed repository that has a branch past its last task.
    Minute,
}

impl Round {
    /// Runs the round, on a blocking thread.
    fn run(self, shared: &Shared) {
        match self {
            Round::Bursts(bursts) => {
                for (repository, asks) in bursts {
                    if asks {
                        refresh(shared, &repository);
                    }
                    settled(shared, &repository);
                }
            }
            Round::Minute => {
                for repository in past_last_task(shared) {
                    if refresh(shared, &repository) {
                        settled(shared, &repository);
                    }
                }
            }
        }
    }
}

/// The listed repositories that have a branch past its last task. One that cannot be read is
/// read again at the next minute.
fn past_last_task(shared: &Shared) -> Vec<String> {
    let past = |repository: &repositories::Repository| {
        let Ok(workspace) = api::read_workspace(&repository.path) else {
            return false;
        };
        let steps = PAST_LAST_TASK.map(|step| step.as_str());
        let mut features = workspace.features.iter();
        features.any(|feature| steps.contains(&feature.step.name.as_str()))
    };
    let listed = repositories::all(shared).into_iter();
    let listed = listed.filter(|repository| !repository.missing);
    listed
        .filter(past)
        .map(|repository| repository.name)
        .collect()
}

/// Asks `gh` for the pull requests of the repository listed as `name`, and keeps them for the
/// reads of its workspace: whether they changed, which the bus is told. A repository that left
/// the list, or whose folder is gone, has nothing to ask.
fn refresh(shared: &Shared, name: &str) -> bool {
    let Ok(path) = repositories::path(shared, name) else {
        return false;
    };
    let Ok(git) = Git::discover(&path) else {
        return false;
    };
    let root = git.main_root();
    // Asked as the server stops, `gh` was ended before it answered: nothing new is known.
    let Ok(asked) = gh::pull_requests(shared, &root) else {
        return false;
    };
    let changed = pulls::settle(&root, asked, shared.now());
    if changed {
        let bus = shared.get::<Bus>();
        workspace::written(&bus, name);
        features::written(&bus, name);
    }
    changed
}

/// Tells the domains of [`SETTLED`] that a repository's pull requests are settled.
fn settled(shared: &Shared, repository: &str) {
    SETTLED.iter().for_each(|hook| hook(shared, repository));
}
