//! Watching a repository for changes to its workflow files and branches: after 200 ms without
//! file events, the workspace is read again, and the features, files, and priorities that changed
//! are reported. The server and the TUI share it.

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, RecvTimeoutError};
use std::sync::{Arc, Mutex, Weak};
use std::time::Duration;

#[cfg(feature = "napi")]
use napi_derive::napi;
use notify::{RecommendedWatcher, RecursiveMode, Watcher as _};
use serde::Serialize;

use crate::files::document::hash;
use crate::git::Git;
use crate::workspace::Workspace;

/// How long the file events must stop before the workspace is read again.
pub const QUIET: Duration = Duration::from_millis(200);

/// What changed since the last report.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Changes {
    /// The folders of the features whose files or step changed.
    pub features: Vec<String>,
    /// The files whose text changed, as `<folder>/<name>`.
    pub files: Vec<String>,
    /// Whether `PRIORITIES.md` or the drafts changed.
    pub priorities: bool,
    /// Whether a feature, a branch, or a worktree appeared or went.
    pub workspace: bool,
}

impl Changes {
    fn is_empty(&self) -> bool {
        self.features.is_empty() && self.files.is_empty() && !self.priorities && !self.workspace
    }
}

#[derive(Debug, thiserror::Error)]
#[error("cannot watch the repository: {0}")]
pub struct WatchError(String);

/// What the last read saw, by hash.
#[derive(Default, PartialEq, Eq)]
struct Snapshot {
    features: BTreeMap<String, String>,
    files: BTreeMap<String, String>,
    priorities: String,
    workspace: String,
    /// The folders to watch: `specs/` of every working tree, and git's references.
    folders: BTreeSet<(PathBuf, bool)>,
}

fn snapshot(root: &Path) -> Snapshot {
    let Ok(git) = Git::discover(root) else {
        return Snapshot::default();
    };
    let mut folders = BTreeSet::new();
    let common = git.common_dir();
    folders.insert((common.clone(), false));
    for name in ["refs", "worktrees"] {
        folders.insert((common.join(name), true));
    }
    for worktree in git.worktrees().unwrap_or_default() {
        folders.insert((worktree.path.join("specs"), true));
        // A worktree's `specs/` may not exist yet: its top level shows it appear.
        folders.insert((worktree.path.clone(), false));
    }
    let Ok(workspace) = Workspace::read(&git) else {
        return Snapshot {
            folders,
            ..Snapshot::default()
        };
    };
    let mut features = BTreeMap::new();
    let mut files = BTreeMap::new();
    let mut listing = Vec::new();
    for feature in &workspace.features {
        let mut texts = String::new();
        for file in &feature.files {
            let text = feature.text(&file.name).unwrap_or_default();
            let file_hash = hash(text);
            texts.push_str(&file_hash);
            files.insert(format!("{}/{}", feature.folder, file.name), file_hash);
        }
        let summary = serde_json::to_string(&(&feature.step, &feature.files, &feature.problems))
            .unwrap_or_default();
        // A code commit moves the branch's tip without touching `specs/`.
        let tip = feature
            .branch
            .as_deref()
            .and_then(|branch| git.tip(branch))
            .map(|id| id.to_hex().to_string())
            .unwrap_or_default();
        features.insert(
            feature.folder.clone(),
            hash(&format!("{summary}{texts}{}{tip}", feature.uncommitted)),
        );
        listing.push((&feature.folder, &feature.branch, &feature.worktree));
    }
    let worktrees: Vec<PathBuf> = git
        .worktrees()
        .unwrap_or_default()
        .into_iter()
        .map(|w| w.path)
        .collect();
    let branches: Vec<String> = git
        .branches()
        .unwrap_or_default()
        .into_iter()
        .map(|b| b.name)
        .collect();
    Snapshot {
        features,
        files,
        priorities: hash(
            &serde_json::to_string(&(&workspace.priorities, &workspace.drafts)).unwrap_or_default(),
        ),
        workspace: hash(
            &serde_json::to_string(&(listing, worktrees, branches)).unwrap_or_default(),
        ),
        folders,
    }
}

/// The keys whose hash differs between two maps, added and removed ones included.
fn differing(before: &BTreeMap<String, String>, after: &BTreeMap<String, String>) -> Vec<String> {
    let keys: BTreeSet<&String> = before.keys().chain(after.keys()).collect();
    keys.into_iter()
        .filter(|key| before.get(*key) != after.get(*key))
        .cloned()
        .collect()
}

fn compare(before: &Snapshot, after: &Snapshot) -> Changes {
    Changes {
        features: differing(&before.features, &after.features),
        files: differing(&before.files, &after.files),
        priorities: before.priorities != after.priorities,
        workspace: before.workspace != after.workspace,
    }
}

type Shared = Arc<Mutex<(RecommendedWatcher, BTreeSet<(PathBuf, bool)>)>>;

/// Watches more folders: those of `wanted` that exist and are not watched yet.
fn watch_folders(shared: &Shared, wanted: &BTreeSet<(PathBuf, bool)>) {
    let Ok(mut guard) = shared.lock() else {
        return;
    };
    let (watcher, watched) = &mut *guard;
    for (folder, recursive) in wanted {
        if watched.contains(&(folder.clone(), *recursive)) || !folder.exists() {
            continue;
        }
        let mode = if *recursive {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        };
        if watcher.watch(folder, mode).is_ok() {
            watched.insert((folder.clone(), *recursive));
        }
    }
}

/// A running watch: it stops when dropped.
pub struct Watcher {
    _shared: Shared,
}

/// Watches the repository holding `root`, and calls `on_change` with what changed, from its own
/// thread, after each burst of file events.
pub fn watch(
    root: &Path,
    on_change: impl Fn(Changes) + Send + 'static,
) -> Result<Watcher, WatchError> {
    let root = root.to_path_buf();
    let (sender, receiver) = mpsc::channel::<()>();
    let watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_ok() {
            let _ = sender.send(());
        }
    })
    .map_err(|error| WatchError(error.to_string()))?;
    let shared: Shared = Arc::new(Mutex::new((watcher, BTreeSet::new())));
    let mut last = snapshot(&root);
    if last.folders.is_empty() {
        return Err(WatchError(format!(
            "{} is not a git repository",
            root.display()
        )));
    }
    watch_folders(&shared, &last.folders);
    let weak: Weak<Mutex<_>> = Arc::downgrade(&shared);
    std::thread::spawn(move || {
        // Each burst of events ends after QUIET without one; the channel closes with the watcher.
        while receiver.recv().is_ok() {
            loop {
                match receiver.recv_timeout(QUIET) {
                    Ok(()) => continue,
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }
            let next = snapshot(&root);
            let Some(shared) = weak.upgrade() else {
                return;
            };
            watch_folders(&shared, &next.folders);
            drop(shared);
            let changes = compare(&last, &next);
            last = next;
            if !changes.is_empty() {
                on_change(changes);
            }
        }
    });
    Ok(Watcher { _shared: shared })
}
