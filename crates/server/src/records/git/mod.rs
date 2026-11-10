//! Git: the page of a repository's checkouts, the sidebar's count, a file's diff, a commit, a
//! page of the history, a conflicted file, and the page's writes.
//!
//! The core reads the repository at each read: nothing of it is kept here. Each write runs in
//! its repository's turn, and is refused while an agent works in a checkout it writes. After
//! each, landed or refused, the records that show the repository are said to have changed.

mod fetcher;
mod queue;
mod reads;
mod repository;
mod views;
mod working;
mod writes;

use uraeda_core::watch::Changes;
use uraeda_protocol::{ConflictFile, GitArgs, GitDiff, GitHistoryPage, GitPage, GitSummary};

use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// Registers git's records and actions, and starts fetching the list's repositories.
pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    shared.provide(queue::Turns::default());
    shared.provide(fetcher::Fetcher::default());
    reads::register(registry);
    writes::register(registry);
    fetcher::start(shared, Bus::clone(&shared.get::<Bus>()));
    Ok(())
}

/// Says what git's records show of a repository changed, as the core's watcher reports it: an
/// edit of a list or of a feature, which is a change waiting for a commit, or a change of a
/// checkout's git state.
#[expect(
    dead_code,
    reason = "JOIN(wave 6): the one watcher of a repository's files calls it"
)]
pub(super) fn files_changed(bus: &Bus, repository: &str, changes: &Changes) {
    let edited = changes.priorities || changes.inbox || !changes.features.is_empty();
    if edited || changes.git {
        changed(bus, repository);
    }
}

/// Says what git's records show of a repository changed: its page and its count, and whatever
/// diff, page of the history, and conflicted file somebody holds. A commit never changes.
fn changed(bus: &Bus, repository: &str) {
    let args = GitArgs {
        repo: repository.to_owned(),
    };
    bus.changed::<GitPage>(&args);
    bus.changed::<GitSummary>(&args);
    bus.changed_all::<GitDiff>();
    bus.changed_all::<GitHistoryPage>();
    bus.changed_all::<ConflictFile>();
}
