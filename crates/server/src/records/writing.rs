//! Writing: the human's writes to a repository's workflow files. The records `Buffer` and
//! `WriteQueue`, and the actions that answer rounds, review specs and plans, save and commit
//! texts, and undo.
//!
//! This domain owns the write queue, for the whole server: every write to a repository, of any
//! domain, runs through [`write`], which keeps one writer per repository, in order. See
//! [`queue`].

mod buffer;
mod queue;
mod review;
mod rounds;
mod text;
pub(crate) mod undo;

use uraeda_core::watch::Changes;
use uraeda_protocol::Buffer;

pub(crate) use queue::{Landing, Queued, Write, land, settled, working, write};

use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// Registers the domain's records and actions, and starts the write queue.
pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    queue::register(shared, registry);
    buffer::register(registry);
    review::register(registry);
    rounds::register(registry);
    text::register(registry);
    undo::register(registry);
    Ok(())
}

/// Says which of the domain's records a change of the repository's files changed: the core's
/// watcher reports them. A buffer shows any Markdown file of `specs/`, so every buffer of the
/// repository somebody holds is read again.
pub(super) fn files_changed(shared: &Shared, repository: &str, changes: &Changes) {
    if *changes != Changes::default() {
        written(&shared.get::<Bus>(), repository);
    }
}

/// The server wrote to a repository: every buffer of it somebody holds is read again.
pub(super) fn written(bus: &Bus, repository: &str) {
    bus.changed_where::<Buffer>(|args| args.repo == repository);
}
