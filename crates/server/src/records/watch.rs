//! The server's one file watcher: the core's watch of each listed repository, and a watch of
//! the files outside any repository, the list's in the data folder and the settings and the
//! themes in the config folder. No domain watches a file itself: it adds its line to one of the
//! two lists below, and says on the bus what the change means for its records.
//!
//! The watches follow the list: a repository added is watched, one removed, or whose folder is
//! gone, no longer is, and the domains that start or stop something with a repository are told,
//! through the two other lists below. They all stop with the server.

pub(crate) mod files;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use uraeda_core::themes::themes_dir;
use uraeda_core::watch::{Changes, Watcher, watch};

use self::files::Target;
use super::workspace::{self, repositories};
use super::{extensions, features, git, jobs, previews, pulls, sessions, writing};
use crate::Failure;
use crate::live::locked;
use crate::shared::Shared;

/// What a domain does when a repository's files changed: it gets the server's shared state, the
/// repository's name in the list, and what the core's watcher saw change, after each burst of
/// file events, on the watcher's own thread. One line per domain.
const FILES_CHANGED: &[fn(&Shared, &str, &Changes)] = &[
    workspace::files_changed,
    features::files_changed,
    writing::files_changed,
    git::files_changed,
    previews::files_changed,
    extensions::files_changed,
    pulls::files_changed,
];

/// What a domain does when the config folder changed: the settings file, or a theme file. One
/// line per domain.
const CONFIG_CHANGED: &[fn(&Shared)] = &[
    workspace::config_changed,
    features::config_changed,
    extensions::config_changed,
    sessions::config_changed,
    jobs::config_changed,
];

/// What a domain does when a repository joins the list once the server runs, or its folder
/// comes back: it gets the repository's name. One line per domain.
const REPOSITORY_JOINED: &[fn(&Shared, &str)] = &[
    git::repository_joined,
    pulls::repository_joined,
    previews::repository_joined,
];

/// What a domain does when a repository leaves the list, or its folder goes: it gets the
/// repository's name. One line per domain.
const REPOSITORY_LEFT: &[fn(&Shared, &str)] =
    &[previews::repository_left, extensions::repository_left];

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
    /// Each listed repository whose folder is gone, by its name: where its `.git` was, watched
    /// until it is back, which reads the list again, as the page of a folder gone promises.
    gone: Mutex<HashMap<String, (PathBuf, files::Watch)>>,
}

/// Starts the watches, once every domain registered: each listed repository's, the list's own
/// file's, and the config folder's. `Server::stop` stops them.
pub(super) fn start(shared: &Shared) -> Result<(), Failure> {
    let watches = Arc::new(Watches::default());
    // The repositories listed as the server starts join nothing: each domain starts with them.
    follow(shared, &watches, &[]);
    let (following, listed) = (watches.clone(), shared.clone());
    repositories::on_change(shared, move || {
        follow(&listed, &following, REPOSITORY_JOINED);
    });
    watches.watch_folders(shared)?;
    let stopping = shared.clone();
    shared.on_stop("watch", async move {
        repositories::close(&stopping);
        locked(&watches.folders).clear();
        locked(&watches.repositories).clear();
        locked(&watches.gone).clear();
    });
    Ok(())
}

/// Watches the repositories the list holds now, and no other: one added is watched from here,
/// and the watch of one removed, moved, or whose folder is gone, ends. Each that left is told
/// to the domains of [`REPOSITORY_LEFT`], and each that joined to those of `joined`.
fn follow(shared: &Shared, watches: &Watches, joined: &[fn(&Shared, &str)]) {
    watches.follow_gone(shared);
    let there = |repository: &repositories::Repository| !repository.missing;
    let listed = repositories::all(shared).into_iter().filter(there);
    let listed: HashMap<_, _> = listed.map(|row| (row.name, row.path)).collect();
    let (mut left, mut came) = (Vec::new(), Vec::new());
    {
        let mut running = locked(&watches.repositories);
        running.retain(|name, (path, _)| {
            let stays = listed.get(name) == Some(path);
            if !stays {
                left.push(name.clone());
            }
            stays
        });
        for (name, path) in listed {
            if running.contains_key(&name) {
                continue;
            }
            came.push(name.clone());
            let (watched, repository) = (shared.clone(), name.clone());
            let changed = move |changes: Changes| {
                let hooks = FILES_CHANGED.iter();
                hooks.for_each(|hook| hook(&watched, &repository, &changes));
            };
            match watch(&path, changed) {
                Ok(watcher) => drop(running.insert(name, (path, watcher))),
                // The repository is still served: its records are read again when asked again.
                Err(error) => say_err!("uraeda: {name}: {error}"),
            }
        }
    }
    // Outside the lock: a domain may read the list, or start something of its own.
    for name in &left {
        REPOSITORY_LEFT.iter().for_each(|hook| hook(shared, name));
    }
    for name in &came {
        joined.iter().for_each(|hook| hook(shared, name));
    }
}

impl Watches {
    /// Watches where each gone repository's `.git` was, from the nearest folder there, and no
    /// longer one that came back or left the list: nothing else reads the list when it returns.
    fn follow_gone(&self, shared: &Shared) {
        let gone: HashMap<_, _> = repositories::all(shared)
            .into_iter()
            .filter(|repository| repository.missing)
            .map(|row| (row.name, row.path.join(".git")))
            .collect();
        let mut watched = locked(&self.gone);
        watched.retain(|name, (path, _)| gone.get(name) == Some(path));
        for (name, path) in gone {
            if watched.contains_key(&name) {
                continue;
            }
            let listed = shared.clone();
            let back = move || repositories::reload(&listed);
            match files::watch(vec![Target::file(path.clone())], back) {
                Ok(watch) => drop(watched.insert(name, (path, watch))),
                Err(error) => eprintln!("uraeda: {name}: {error}"),
            }
        }
    }

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
