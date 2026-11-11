//! Watching files outside a repository: a file, as the settings file, or a folder and its
//! entries, as the themes folder. A change is told once, after a quiet moment.
//!
//! Each is watched where it is, or from the nearest folder above it that exists, until it is
//! made. A link is also watched where it leads, as the files a dotfiles manager links, and so is
//! each linked entry of a folder. After each change the places to watch are worked out again: a
//! folder made, deleted, made again, or a link pointed elsewhere, is followed.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::event::{AccessKind, AccessMode, EventKind};
use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher as _};

use crate::live::locked;

/// How long the file events must stop before a change is told, so a write is read once.
const QUIET: Duration = Duration::from_millis(100);

/// How long after its first file event a burst ends, even while the events go on.
const LONGEST: Duration = Duration::from_secs(1);

/// How many links a chain that leads nowhere is followed through, as the system's own limit.
const MOST_LINKS: usize = 40;

/// What to watch: a file, or a folder with its entries.
pub(crate) struct Target {
    path: PathBuf,
    entries: bool,
}

impl Target {
    /// A file: its making, its changes, and its removal.
    pub(crate) fn file(path: PathBuf) -> Target {
        let entries = false;
        Target { path, entries }
    }

    /// A folder, and every entry of it.
    pub(crate) fn folder(path: PathBuf) -> Target {
        let entries = true;
        Target { path, entries }
    }
}

/// A running watch: it stops when dropped.
pub(crate) struct Watch {
    _watcher: Arc<Mutex<RecommendedWatcher>>,
}

/// Watches the targets, and calls `on_change` from a thread of its own after each burst of
/// events that may change one of them. It does not say which: the caller reads them again.
///
/// # Errors
///
/// When the system gives no watcher.
pub(crate) fn watch(
    targets: Vec<Target>,
    on_change: impl Fn() + Send + 'static,
) -> Result<Watch, notify::Error> {
    let (sender, receiver) = mpsc::channel::<()>();
    let places = Arc::new(Mutex::new(Places::default()));
    let seen = places.clone();
    let watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
        // A failure of the watcher may hide a change: the targets are read again.
        if event.map_or(true, |event| {
            changes_files(&event) && locked(&seen).show(&event)
        }) {
            let _ = sender.send(());
        }
    })?;
    let watcher = Arc::new(Mutex::new(watcher));
    refresh(&watcher, &places, &targets);
    let weak = Arc::downgrade(&watcher);
    std::thread::spawn(move || {
        while burst_ends(&receiver) {
            // The watcher is gone once the watch is dropped.
            let Some(watcher) = weak.upgrade() else {
                return;
            };
            refresh(&watcher, &places, &targets);
            drop(watcher);
            on_change();
        }
    });
    Ok(Watch { _watcher: watcher })
}

/// Waits for an event, then for the burst it starts to end: after `QUIET` without one, or
/// `LONGEST` after the first. False once the watch is dropped.
fn burst_ends(events: &Receiver<()>) -> bool {
    if events.recv().is_err() {
        return false;
    }
    let end = Instant::now() + LONGEST;
    loop {
        let left = end.saturating_duration_since(Instant::now());
        match events.recv_timeout(QUIET.min(left)) {
            Ok(()) if !left.is_zero() => {}
            Ok(()) | Err(RecvTimeoutError::Timeout) => return true,
            Err(RecvTimeoutError::Disconnected) => return false,
        }
    }
}

/// Whether an event may change what a read sees: opening or reading a file changes nothing, and
/// every read opens files.
fn changes_files(event: &Event) -> bool {
    match event.kind {
        EventKind::Access(kind) => kind == AccessKind::Close(AccessMode::Write),
        _ => true,
    }
}

/// Watches the folders the targets depend on now, and no longer those they do not.
fn refresh(watcher: &Mutex<RecommendedWatcher>, places: &Mutex<Places>, targets: &[Target]) {
    let wanted = Places::of(targets);
    // The lock is not held while the watcher is called: its own thread takes it for each event.
    let held = std::mem::replace(&mut *locked(places), wanted.clone());
    let mut watcher = locked(watcher);
    for folder in held.folders.difference(&wanted.folders) {
        // A folder that is gone has no watch left to end.
        let _ = watcher.unwatch(&folder.path);
    }
    for folder in wanted.folders.difference(&held.folders) {
        if let Err(error) = watcher.watch(&folder.path, RecursiveMode::NonRecursive) {
            let path = folder.path.display();
            eprintln!("uraeda: {path} is not watched: {error}. Its changes show after a restart.");
        }
    }
}

/// A folder to watch, as it is now: made again, it is another one.
#[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
struct Folder {
    /// Its path, with every link followed: an event names its entries from there.
    path: PathBuf,
    inode: u64,
}

impl Folder {
    /// The folder at a path, when there is one.
    fn at(path: &Path) -> Option<Folder> {
        let path = fs::canonicalize(path).ok()?;
        let metadata = fs::metadata(&path).ok()?;
        #[cfg(unix)]
        let inode = std::os::unix::fs::MetadataExt::ino(&metadata);
        #[cfg(not(unix))]
        let inode = 0;
        metadata.is_dir().then_some(Folder { path, inode })
    }
}

/// Where a change of the targets shows.
#[derive(Clone, Default)]
struct Places {
    /// The folders to watch.
    folders: BTreeSet<Folder>,
    /// The paths whose events count: a watched folder's entry toward a target, and the folder
    /// itself, which says so when it is deleted.
    paths: BTreeSet<PathBuf>,
    /// The folders whose every entry counts.
    whole: BTreeSet<PathBuf>,
}

impl Places {
    /// The places of the targets, as the files are now.
    fn of(targets: &[Target]) -> Places {
        let mut places = Places::default();
        for target in targets {
            places.follow(&target.path);
            if target.entries {
                places.follow_entries(&target.path);
            }
        }
        places
    }

    /// Whether an event is one of these places'. One that names no path, as a rescan, is.
    fn show(&self, event: &Event) -> bool {
        let shown = |path: &PathBuf| {
            let within = |folder: &Path| self.whole.contains(folder);
            self.paths.contains(path) || within(path) || path.parent().is_some_and(within)
        };
        event.paths.is_empty() || event.paths.iter().any(shown)
    }

    /// Follows a file, or a folder as an entry: where it is, and where it leads when it is a
    /// link.
    fn follow(&mut self, path: &Path) {
        self.entry(path);
        if let Some(target) = led_to(path) {
            self.entry(&target);
        }
    }

    /// Follows an entry by its name, in its folder, or else in the nearest folder above it that
    /// exists, by the name of the folder toward it: its making shows there.
    fn entry(&mut self, path: &Path) {
        let mut child = path;
        while let (Some(parent), Some(name)) = (child.parent(), child.file_name()) {
            if let Some(folder) = Folder::at(parent) {
                self.paths.insert(folder.path.join(name));
                self.paths.insert(folder.path.clone());
                self.folders.insert(folder);
                return;
            }
            child = parent;
        }
    }

    /// Follows every entry of a folder, through a link to it, and each linked entry where it
    /// leads, as GNU Stow links them.
    fn follow_entries(&mut self, path: &Path) {
        let Some(folder) = Folder::at(path) else {
            // Not made yet: the watch of the folder above it sees it made.
            return;
        };
        let entries = fs::read_dir(&folder.path).into_iter().flatten().flatten();
        let is_link = |entry: &fs::DirEntry| entry.file_type().is_ok_and(|kind| kind.is_symlink());
        for link in entries.filter(is_link) {
            if let Some(target) = led_to(&link.path()) {
                self.entry(&target);
            }
        }
        self.whole.insert(folder.path.clone());
        self.folders.insert(folder);
    }
}

/// Where a link leads: the file it points to, or, for a link to nothing, the missing file its
/// chain ends at, which may be made later. None for what is no link.
fn led_to(path: &Path) -> Option<PathBuf> {
    let Ok(real) = fs::canonicalize(path) else {
        return dangling(path);
    };
    let folder = path
        .parent()
        .and_then(|folder| fs::canonicalize(folder).ok());
    let here = real.parent() == folder.as_deref() && real.file_name() == path.file_name();
    (!here).then_some(real)
}

/// The missing file a link's chain ends at, or none when `path` is no link, or leads through a
/// file in the way.
fn dangling(path: &Path) -> Option<PathBuf> {
    let mut at = path.to_owned();
    for _ in 0..MOST_LINKS {
        match fs::symlink_metadata(&at) {
            Ok(metadata) if metadata.is_symlink() => {
                at = at.parent()?.join(fs::read_link(&at).ok()?);
            }
            Ok(_) => return None,
            Err(_) => return (at != path).then_some(at),
        }
    }
    None
}
