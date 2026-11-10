//! The workspace: the list of repositories, a repository's features in flight, what needs the
//! human across them, and the settings and the themes of the config folder.
//!
//! Two parts of it serve every other domain:
//!
//! - [`repositories::find`] gives the listed repository of a name, its folder there: what a
//!   record or an action of one repository starts from.
//! - [`settings::current`] gives the settings in force.
//!
//! The one watcher, [`super::watch`], calls [`files_changed`] after each change of a repository's
//! files, and [`config_changed`] after each change of the config folder.

mod features;
mod folders;
mod needs_you;
pub(crate) mod repositories;
pub(crate) mod settings;
pub(super) mod status;
mod themes;

use uraeda_core::watch::Changes;
use uraeda_protocol::{NeedsYouList, RepositoryArgs, Themes, Workspace};

use crate::Failure;
use crate::live::{Bus, Registry};
use crate::shared::Shared;

/// Registers the workspace's records and actions, and reads the list and the settings once.
pub(super) fn register(shared: &Shared, registry: &Registry) -> Result<(), Failure> {
    repositories::register(shared, registry);
    settings::register(shared, registry)?;
    themes::register(registry);
    features::register(registry);
    needs_you::register(registry);
    Ok(())
}

/// A repository's files changed, as the core's watcher reports after each burst: its workspace
/// and what needs the human are read again, whatever changed, since a step moves with any of it.
pub(super) fn files_changed(bus: &Bus, repository: &str, _: &Changes) {
    let repo = repository.to_owned();
    bus.changed::<Workspace>(&RepositoryArgs { repo });
    bus.changed::<NeedsYouList>(&());
}

/// The server wrote to a repository: its workspace and what needs the human are read again.
pub(super) fn written(bus: &Bus, repository: &str) {
    files_changed(bus, repository, &Changes::default());
}

/// The config folder changed: the settings file, or a theme file.
pub(super) fn config_changed(shared: &Shared) {
    settings::reload(shared);
    shared.get::<Bus>().changed::<Themes>(&());
}
