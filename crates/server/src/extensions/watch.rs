//! What wakes the loader when the owner's extensions change on disk: the extensions folder,
//! for an extension that comes or goes, and each extension's own folders, for a save.
//!
//! They are watched with the server's one file watcher's own `files::watch`, from here and
//! not from its lists, since which folders are watched follows what is loaded (ruling R112).
//! The settings file's changes come through the watcher's `CONFIG_CHANGED`.
//!
//! - A folder linked or written in place is watched with the folders of its compiled files,
//!   of the files its imports were looked for at, and of its page's files: a save reloads it.
//! - One `ura` installed from git is watched by its `.ura-source` alone, which
//!   `ura extension update` rewrites.

use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;

use uraeda_core::extensions::{Extension, extensions_dir};

use super::loader::Wake;
use crate::records::watch::files::{self, Target, Watch};
use crate::shared::Shared;

/// Where `ura` installed an extension from, in its folder.
const SOURCE: &str = ".ura-source";

/// The watches that wake the loader.
pub(super) struct Watches {
    wake: Sender<Wake>,
    /// The watch of the extensions folder.
    folder: Option<Watch>,
    /// Each extension's watch, with what it watches as one text.
    extensions: HashMap<String, (String, Watch)>,
}

impl Watches {
    /// Watches the extensions folder: an entry that comes, goes, or is linked elsewhere reads
    /// the extensions again.
    pub(super) fn start(shared: &Shared, wake: Sender<Wake>) -> Watches {
        let folder = extensions_dir(shared.config_dir());
        let scan = wake.clone();
        let watched = files::watch(vec![Target::folder(folder)], move || {
            let (force, done) = (None, None);
            let _ = scan.send(Wake::Scan { force, done });
        });
        let folder = watched.map_err(|error| eprintln!("uraeda: the extensions' folder: {error}"));
        Watches {
            wake,
            folder: folder.ok(),
            extensions: HashMap::new(),
        }
    }

    /// Watches what a change of the extension shows in, given the files of its code and the
    /// folders of its page's files, from its folder. A watch that already covers them is kept.
    pub(super) fn follow(&mut self, extension: &Extension, files: &[String], page: &[PathBuf]) {
        let name = &extension.name;
        if extension.folder.is_empty() {
            return self.forget(name);
        }
        let root = PathBuf::from(&extension.folder);
        let targets = match extension.is_linked {
            true => folders(files)
                .into_iter()
                .chain(page.iter().cloned())
                .collect::<BTreeSet<PathBuf>>()
                .into_iter()
                .map(|folder| root.join(folder))
                .collect(),
            false => vec![root.join(SOURCE)],
        };
        let print = format!("{} {targets:?}", extension.is_linked);
        let known = self.extensions.get(name);
        if known.is_some_and(|(watched, _)| *watched == print) {
            return;
        }
        let targets = targets.into_iter().map(|path| match extension.is_linked {
            true => Target::folder(path),
            false => Target::file(path),
        });
        let (wake, saved) = (self.wake.clone(), name.clone());
        let watched = files::watch(targets.collect(), move || {
            let (force, done) = (Some(saved.clone()), None);
            let _ = wake.send(Wake::Scan { force, done });
        });
        match watched {
            Ok(watch) => drop(self.extensions.insert(name.clone(), (print, watch))),
            Err(error) => eprintln!("uraeda: {name}: {error}"),
        }
    }

    /// Stops watching an extension gone from the folder.
    pub(super) fn forget(&mut self, name: &str) {
        self.extensions.remove(name);
    }

    /// Stops every watch, as the server stops.
    pub(super) fn close(&mut self) {
        self.folder = None;
        self.extensions.clear();
    }
}

/// The folders of the files, from the extension's folder, with the folder itself first.
fn folders(files: &[String]) -> BTreeSet<PathBuf> {
    let parents = files.iter().filter_map(|file| Path::new(file).parent());
    let mut folders: BTreeSet<PathBuf> = parents.map(Path::to_owned).collect();
    folders.insert(PathBuf::new());
    folders
}
