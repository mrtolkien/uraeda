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
//! - A domain whose records follow files adds its line to a list of `watch.rs`, the server's one
//!   file watcher: `FILES_CHANGED` for a repository's files, `CONFIG_CHANGED` for the config
//!   folder's.

mod features;
mod git;
mod previews;
mod views;
mod watch;
mod workspace;
pub(crate) mod writing;

pub(crate) use workspace::repositories;
pub(crate) use workspace::settings;

use crate::Failure;
use crate::live::Registry;
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
];

/// Registers every domain's records and actions, then starts the one file watcher.
pub(crate) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    DOMAINS
        .iter()
        .try_for_each(|register| register(shared, registry))?;
    watch::start(shared)
}
