//! The records and the actions of the server's domains, one file per domain beside this one.
//!
//! A domain's file has one function, which registers its handlers with the engine, as
//! [the engine's documentation](crate::live) shows:
//!
//! ```ignore
//! pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
//!     registry.record::<Workspace>(read_workspace);
//!     registry.action::<RepositoriesAdd>(add_repository);
//!     Ok(())
//! }
//! ```
//!
//! its line among the modules below, `mod workspace;`, and its line in [`DOMAINS`]: a domain
//! missing from the list fails the lint, its `register` being called by nothing. Each record and
//! action is declared in the protocol's crate first, with its line in `catalog()`: the test
//! `every_declared_record_and_action_is_served_and_no_other` compares the two lists.
//!
//! What every domain needs of another is here too:
//!
//! - `repositories::find(shared, name)` gives the listed repository of a name, its main checkout
//!   as `path`: what a record or an action of one repository starts from. `repositories::all`
//!   gives them all, and `repositories::reload` reads the list again after a write of its file.
//! - `settings::current(shared)` gives the settings in force.
//! - `writing::write(shared, name, Write, run)` runs a write to a repository in its turn, and
//!   `writing::land` queues one that lands on the queue's own thread: every write goes through
//!   one of them. See `writing/queue.rs`.
//! - A domain whose records follow files adds its line to a list of `watch.rs`, the server's one
//!   file watcher: `FILES_CHANGED` for a repository's files, `CONFIG_CHANGED` for the config
//!   folder's; and to [`WRITTEN`], for the server's own writes.
//! - A domain that acts on a repository's pull requests adds its line to `SETTLED` of
//!   `pulls.rs`, which asks `gh` for them.

mod extensions;
pub(crate) mod features;
mod git;
mod jobs;
mod previews;
mod pulls;
pub(crate) mod sessions;
mod views;
pub(crate) mod watch;
mod workspace;
pub(crate) mod writing;

pub(crate) use sessions::move_to_change;
pub(crate) use views::word;
pub(crate) use workspace::repositories;
pub(crate) use workspace::settings;

use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// How a domain registers its records and actions.
type Register = fn(&Shared, &Registry) -> Result<(), Failure>;

/// The domains, in the order they register as the server starts: one line each. They are plain
/// `mod` lines above, and not a macro's, so that `cargo fmt` formats their files.
const DOMAINS: &[Register] = &[
    workspace::register,
    features::register,
    writing::register,
    git::register,
    previews::register,
    extensions::register,
    pulls::register,
    sessions::register,
    jobs::register,
];

/// What a domain says once the server wrote to a repository: it gets the bus and the
/// repository's name in the list, and says that every record of that repository it serves
/// changed. One line per domain.
const WRITTEN: &[fn(&Bus, &str)] = &[
    workspace::written,
    features::written,
    writing::written,
    git::written,
];

/// Says that the server wrote to the repository listed as `repository`: every record of it
/// somebody holds is read again. The write queue calls it after each write, and once each
/// queued write landed or was refused, so a client that reads after an action's answer finds
/// what the action changed, whichever domain's record shows it. The watcher follows with what
/// it saw change, which reads nothing again that this already did.
pub(crate) fn written(bus: &Bus, repository: &str) {
    WRITTEN.iter().for_each(|written| written(bus, repository));
}

/// Registers every domain's records and actions, then starts the one file watcher.
pub(crate) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    DOMAINS
        .iter()
        .try_for_each(|register| register(shared, registry))?;
    watch::start(shared)
}
