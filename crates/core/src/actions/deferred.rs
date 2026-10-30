//! Commits deferred for the server. With deferral on for a repository, a committing action writes
//! its files and returns without running git, and its commit waits for [`land`], which runs it
//! with the hooks. A hook's refusal puts back what the write left, file by file, from what each
//! held when the action reached its place. Deferred commits live in memory only: one never landed
//! leaves its files written, uncommitted. `ura` never turns deferral on, so it commits within the
//! call.

use std::cell::RefCell;
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

use crate::git::Git;

use super::place::Place;
use super::{ActionError, Change, Committed};

/// The folder whose files a deferred commit can put back.
const SPECS: &str = "specs";

/// What a file under `specs/` held.
#[derive(Clone, Debug, PartialEq, Eq)]
enum Held {
    /// A Markdown file's bytes.
    Markdown(Vec<u8>),
    /// Another kind of file, like an image, whose bytes are not kept: undo leaves it alone.
    Other,
}

/// The files under a working tree's `specs/`, by path from its top level.
type Before = HashMap<String, Held>;

/// A file a deferred commit holds: its bytes before the write, `None` when it did not exist, and
/// after it, `None` when the write deleted it.
struct Written {
    path: String,
    before: Option<Vec<u8>>,
    after: Option<Vec<u8>>,
}

/// A commit deferred, with what undoes its write.
struct Deferred {
    id: String,
    place: Place,
    change: Change,
    /// Whether the change is committed alone, as `commit_only` commits it.
    only: bool,
    written: Vec<Written>,
}

/// A deferred commit as the server takes it.
pub struct Taken {
    pub id: String,
    pub subject: String,
    pub paths: Vec<String>,
}

/// The deferred commits of a repository that defers them.
#[derive(Default)]
struct Repository {
    /// Deferred since the last take.
    fresh: Vec<Deferred>,
    /// Taken, waiting to land.
    taken: HashMap<String, Deferred>,
}

/// The repositories that defer their commits, by main checkout.
static DEFERRING: Mutex<Option<HashMap<PathBuf, Repository>>> = Mutex::new(None);
static IDS: AtomicU64 = AtomicU64::new(0);

thread_local! {
    /// What the files under `specs/` held when this thread's action reached its place, by the
    /// place's root, with its repository's key. An action reaches its place and commits on one
    /// thread, under its repository's write lock.
    static BEFORE: RefCell<HashMap<PathBuf, (PathBuf, Before)>> = RefCell::new(HashMap::new());
}

fn repositories<T>(act: impl FnOnce(&mut HashMap<PathBuf, Repository>) -> T) -> T {
    let mut locked: MutexGuard<'_, _> = DEFERRING.lock().unwrap_or_else(PoisonError::into_inner);
    act(locked.get_or_insert_with(HashMap::new))
}

/// Turns deferral on or off for the repository `key`. Turned off, its deferred commits are
/// forgotten, their files left written.
pub fn defer(key: &Path, on: bool) {
    repositories(|repositories| {
        if on {
            repositories.entry(key.to_path_buf()).or_default();
        } else {
            repositories.remove(key);
        }
    });
}

fn deferring(key: &Path) -> bool {
    repositories(|repositories| repositories.contains_key(key))
}

/// Records what the files under the `specs/` of `place` hold, when its repository defers its
/// commits: the "before" of the write that follows.
pub(super) fn record(git: &Git, place: &Place) {
    let key = git.main_root();
    if !deferring(&key) {
        return;
    }
    let before = files_under(&place.root, SPECS)
        .into_iter()
        .filter_map(|file| {
            let held = if file.ends_with(".md") {
                Held::Markdown(fs::read(place.root.join(&file)).ok()?)
            } else {
                Held::Other
            };
            Some((file, held))
        })
        .collect();
    BEFORE.with_borrow_mut(|befores| befores.insert(place.root.clone(), (key, before)));
}

/// Defers the commit of `change`, written in `place`, when its repository defers commits: returns
/// it as committed, with no commit yet. `None` when the commit is to run now.
pub(super) fn defer_commit(place: &Place, change: &Change, only: bool) -> Option<Committed> {
    BEFORE.with_borrow_mut(|befores| {
        let (key, before) = befores.get_mut(&place.root)?;
        if !deferring(key) {
            return None;
        }
        let written = written(&place.root, before, &change.paths);
        // The next commit of this action starts from what this one wrote.
        for file in &written {
            match &file.after {
                Some(bytes) if file.path.ends_with(".md") => {
                    before.insert(file.path.clone(), Held::Markdown(bytes.clone()));
                }
                Some(_) => drop(before.insert(file.path.clone(), Held::Other)),
                None => drop(before.remove(&file.path)),
            }
        }
        let deferred = Deferred {
            id: (IDS.fetch_add(1, Ordering::Relaxed) + 1).to_string(),
            place: place.clone(),
            change: change.clone(),
            only,
            written,
        };
        repositories(|repositories| {
            repositories
                .get_mut(key.as_path())
                .map(|repository| repository.fresh.push(deferred))
        })?;
        Some(Committed {
            change: change.clone(),
            commit: String::new(),
        })
    })
}

/// The commits of the repository `key` deferred since the last take, each handed out once.
pub fn take(key: &Path) -> Vec<Taken> {
    repositories(|repositories| {
        let Some(repository) = repositories.get_mut(key) else {
            return Vec::new();
        };
        let fresh = std::mem::take(&mut repository.fresh);
        fresh
            .into_iter()
            .map(|deferred| {
                let taken = Taken {
                    id: deferred.id.clone(),
                    subject: deferred.change.subject.clone(),
                    paths: deferred.change.paths.clone(),
                };
                repository.taken.insert(deferred.id.clone(), deferred);
                taken
            })
            .collect()
    })
}

/// Runs the deferred commit `id` of the repository `key` with the hooks, as `commit` would have,
/// `on_output` given each line git and its hooks print. On a hook's refusal, each file still
/// holding what the write left gets back what it held before; the others are named after the
/// hook's output. Called under the repository's write lock.
pub fn land(key: &Path, id: &str, on_output: &dyn Fn(&str)) -> Result<Committed, ActionError> {
    let deferred = repositories(|repositories| {
        let repository = repositories.get_mut(key)?;
        if let Some(deferred) = repository.taken.remove(id) {
            return Some(deferred);
        }
        let index = repository.fresh.iter().position(|d| d.id == id)?;
        Some(repository.fresh.remove(index))
    })
    .ok_or_else(|| {
        ActionError::Refused(format!("no deferred commit {id}: it landed or was dropped"))
    })?;
    let landed = super::commit::run(&deferred.place, &deferred.change, deferred.only, on_output);
    match landed {
        Err(ActionError::Hook { message, output }) => {
            let left = undo(&deferred.place.root, &deferred.written);
            let output = if left.is_empty() {
                output
            } else {
                format!(
                    "{output}\n\nChanged since, left as it is: {}",
                    left.join(", ")
                )
            };
            Err(ActionError::Hook { message, output })
        }
        landed => landed,
    }
}

/// Puts back what each file held before the write while it holds what the write left, and
/// returns the files left as they are: changed since, or failing to write.
fn undo(root: &Path, written: &[Written]) -> Vec<String> {
    let mut left = Vec::new();
    for file in written {
        let path = root.join(&file.path);
        let now = fs::read(&path).ok();
        if now != file.after {
            left.push(file.path.clone());
            continue;
        }
        let put_back = match &file.before {
            Some(bytes) if now.as_ref() == Some(bytes) => Ok(()),
            Some(bytes) => path
                .parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&path, bytes)),
            None if now.is_none() => Ok(()),
            None => fs::remove_file(&path).map(|()| remove_empty_folders(root, &path)),
        };
        if put_back.is_err() {
            left.push(file.path.clone());
        }
    }
    left
}

/// Removes the folders holding `path` that its removal left empty, up to `specs/`.
fn remove_empty_folders(root: &Path, path: &Path) {
    let specs = root.join(SPECS);
    let mut folder = path.parent();
    while let Some(dir) = folder.filter(|dir| dir.starts_with(&specs) && *dir != specs) {
        if fs::remove_dir(dir).is_err() {
            return;
        }
        folder = dir.parent();
    }
}

/// The files under `specs/` a change of `paths`, files or folders, holds: those of `before` and
/// those on disk now, with what each held before the write and holds after it. A file that was
/// not Markdown before is left out: undo leaves it alone.
fn written(root: &Path, before: &Before, paths: &[String]) -> Vec<Written> {
    let mut files = BTreeSet::new();
    for path in paths {
        let path = path.trim_end_matches('/');
        let folder = format!("{path}/");
        files.extend(
            before
                .keys()
                .filter(|file| *file == path || file.starts_with(&folder))
                .cloned(),
        );
        files.extend(files_under(root, path));
    }
    files
        .into_iter()
        .filter(|file| file.starts_with(&format!("{SPECS}/")))
        .filter_map(|file| {
            let before = match before.get(&file) {
                Some(Held::Markdown(bytes)) => Some(bytes.clone()),
                Some(Held::Other) => return None,
                None => None,
            };
            let after = fs::read(root.join(&file)).ok();
            Some(Written {
                path: file,
                before,
                after,
            })
        })
        .collect()
}

/// The files at `path` from `root`: itself, or every file under the folder, symbolic links not
/// followed; none when it does not exist.
fn files_under(root: &Path, path: &str) -> Vec<String> {
    let Ok(metadata) = fs::symlink_metadata(root.join(path)) else {
        return Vec::new();
    };
    if !metadata.is_dir() {
        return vec![path.to_string()];
    }
    let Ok(entries) = fs::read_dir(root.join(path)) else {
        return Vec::new();
    };
    entries
        .flatten()
        .flat_map(|entry| {
            files_under(
                root,
                &format!("{path}/{}", entry.file_name().to_string_lossy()),
            )
        })
        .collect()
}
