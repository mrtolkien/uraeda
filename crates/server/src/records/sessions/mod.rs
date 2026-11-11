//! The sessions' records and actions: the runtimes, a session, its turns and the pages of their
//! transcripts, the sidebar's list and its search; and what sends a message, stops a run,
//! allows a blocked action, and moves a session. Each reads the session store, and what the
//! sessions' manager keeps in memory of a turn that runs; each action is a call of the manager.

mod actions;
pub(crate) use actions::move_to_change;
mod agent;
pub(crate) mod feature;
mod images;
mod list;
pub(crate) mod runs;
mod session;
mod turn;

use crate::Failure;
use crate::live::Registry;
use crate::shared::Shared;

/// Registers the sessions' records and actions.
pub(super) fn register(_: &Shared, registry: &Registry) -> Result<(), Failure> {
    agent::register(registry);
    session::register(registry);
    list::register(registry);
    turn::register(registry);
    actions::register(registry);
    Ok(())
}

/// The config folder changed: where each runtime is on shows, the continues of a kind turned
/// off are dropped, and the pull requests behind the default branch are caught up when their
/// switch came on.
pub(super) fn config_changed(shared: &Shared) {
    let Some(runner) = crate::runner::Runner::find(shared) else {
        return;
    };
    agent::changed(shared);
    runner.spawn(|runner| {
        runner.runs_changed();
        runner.catch_up_all();
    });
}

/// A repository's files changed: its pull requests behind the default branch are caught up.
pub(super) fn files_changed(shared: &Shared, repository: &str, _: &uraeda_core::watch::Changes) {
    let Some(runner) = crate::runner::Runner::find(shared) else {
        return;
    };
    let repository = repository.to_owned();
    runner.spawn(move |runner| runner.catch_up(&repository));
}
