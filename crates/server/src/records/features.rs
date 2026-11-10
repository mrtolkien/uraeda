//! The features and the changes of a repository, and the lists they start from: the records a
//! feature's page, the priorities, the inbox, and the decisions read, and the actions that write
//! the lists, start a feature or a change, and move one through its life.
//!
//! Every read and every write is a call of the core, on the main checkout of the repository the
//! arguments name. A write goes through the write queue, [`crate::records::writing::write`],
//! which keeps one writer per repository and says what changed.

mod branch;
mod changed;
mod feature;
mod files;
mod inbox;
mod ledger;
mod lists;
mod messages;
mod moves;
mod options;
mod priorities;
mod proposals;
mod starts;
mod undo;
mod views;

use uraeda_core::watch::Changes;
use uraeda_protocol::Feature;

use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// Registers the features' records and actions.
pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    shared.provide(options::Store::new(shared.data_dir()));
    feature::register(registry);
    files::register(registry);
    priorities::register(registry);
    proposals::register(registry);
    inbox::register(registry);
    moves::register(registry);
    ledger::register(registry);
    branch::register(registry);
    messages::register(registry);
    starts::register(registry);
    Ok(())
}

/// A repository's files changed, as the core's watcher reports after each burst: each record of
/// this domain that reads them is read again.
// JOIN(wave 6): the server's one watcher (task 7) calls it, from its list `FILES_CHANGED`.
#[expect(
    dead_code,
    reason = "called by the server's one file watcher, which joins this domain after the wave"
)]
pub(super) fn files_changed(bus: &Bus, repository: &str, changes: &Changes) {
    changed::files(bus, repository, changes);
}

/// The server wrote to a repository: every record of this domain that reads it is read again.
pub(super) fn written(bus: &Bus, repository: &str) {
    changed::everything(bus, repository);
}

/// The config folder changed: each feature holds its run options merged over the settings', so
/// every feature somebody holds is read again.
// JOIN(wave 6): the server's one watcher (task 7) calls it, from its list `CONFIG_CHANGED`.
#[expect(
    dead_code,
    reason = "called by the server's one file watcher, which joins this domain after the wave"
)]
pub(super) fn config_changed(shared: &Shared) {
    shared.get::<Bus>().changed_all::<Feature>();
}
