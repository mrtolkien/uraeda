//! The server's one file watcher: the core's watch of each listed repository, and a watch of
//! the files outside any repository, the list's in the data folder and the settings and the
//! themes in the config folder. No domain watches a file itself: it adds its line to one of the
//! two lists below, and says on the bus what the change means for its records.
//!
//! The watches follow the list: a repository added is watched, one removed, or whose folder is
//! gone, no longer is. They all stop with the server.

mod files;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use uraeda_core::themes::themes_dir;
use uraeda_core::watch::{Changes, Watcher, watch};

use self::files::Target;
use super::workspace::{self, repositories};
use crate::Failure;
use crate::live::Bus;
use crate::shared::Shared;

/// What a domain does when a repository's files changed: it gets the bus, the repository's name
/// in the list, and what the core's watcher saw change, after each burst of file events, on the
/// watcher's own thread. One line per domain.
const FILES_CHANGED: &[fn(&Bus, &str, &Changes)] = &[workspace::files_changed];

/// What a domain does when the config folder changed: the settings file, or a theme file. One
/// line per domain.
const CONFIG_CHANGED: &[fn(&Shared)] = &[workspace::config_changed];

/// The list's file, in the data folder.
const LIST: &str = "repositories.json";

/// The settings file, in the config folder.
const SETTINGS: &str = "config.toml";

/// The watches that run.
#[derive(Default)]
struct Watches {
    /// Each watched repository's main checkout and its watch, by its name.
    repositories: Mutex<HashMap<String, (PathBuf, Watcher)>>,
    /// The watches of the data folder and of the config folder.
    folders: Mutex<Vec<files::Watch>>,
}

/// Starts the watches, once every domain registered: each listed repository's, the list's own
/// file's, and the config folder's. `Server::stop` stops them.
pub(super) fn start(shared: &Shared) -> Result<(), Failure> {
    let watches = Arc::new(Watches::default());
    follow(shared, &watches);
    let (following, listed) = (watches.clone(), shared.clone());
    repositories::on_change(shared, move || follow(&listed, &following));
    watches.watch_folders(shared)?;
    let stopping = shared.clone();
    shared.on_stop("watch", async move {
        repositories::close(&stopping);
        locked(&watches.folders).clear();
        locked(&watches.repositories).clear();
    });
    Ok(())
}

/// Watches the repositories the list holds now, and no other: one added is watched from here,
/// and the watch of one removed, moved, or whose folder is gone, ends.
fn follow(shared: &Shared, watches: &Watches) {
    let there = |repository: &repositories::Repository| !repository.missing;
    let listed = repositories::all(shared).into_iter().filter(there);
    let listed: HashMap<_, _> = listed.map(|row| (row.name, row.path)).collect();
    let mut running = locked(&watches.repositories);
    running.retain(|name, (path, _)| listed.get(name) == Some(path));
    for (name, path) in listed {
        if running.contains_key(&name) {
            continue;
        }
        let (bus, repository) = (shared.get::<Bus>(), name.clone());
        let changed = move |changes: Changes| {
            let hooks = FILES_CHANGED.iter();
            hooks.for_each(|hook| hook(&bus, &repository, &changes));
        };
        match watch(&path, changed) {
            Ok(watcher) => drop(running.insert(name, (path, watcher))),
            // The repository is still served: its records are read again when asked again.
            Err(error) => eprintln!("uraeda: {name}: {error}"),
        }
    }
}

impl Watches {
    /// Watches the list's file, which `ura add` and a hand edit write, and the settings file and
    /// the themes folder.
    fn watch_folders(&self, shared: &Shared) -> Result<(), Failure> {
        let list = vec![Target::file(shared.data_dir().join(LIST))];
        let listed = shared.clone();
        let list = files::watch(list, move || repositories::reload(&listed))?;
        let config = vec![
            Target::file(shared.config_dir().join(SETTINGS)),
            Target::folder(themes_dir(shared.config_dir())),
        ];
        let configured = shared.clone();
        let config = files::watch(config, move || {
            let hooks = CONFIG_CHANGED.iter();
            hooks.for_each(|hook| hook(&configured));
        })?;
        locked(&self.folders).extend([list, config]);
        Ok(())
    }
}

/// A lock, whoever panicked while holding it: a map of watches is whole between two steps.
// JOIN(wave 6): `live::locked`, private to the live engine.
fn locked<T>(lock: &Mutex<T>) -> MutexGuard<'_, T> {
    lock.lock().unwrap_or_else(PoisonError::into_inner)
}
