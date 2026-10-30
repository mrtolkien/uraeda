//! Commits deferred for the server. With deferral on for a repository, a committing action writes
//! its files and returns without running git, and its commit waits for [`land`], which runs it
//! with the hooks. A hook's refusal puts back what the write left, file by file, from what each
//! held when the action reached its place. Deferred commits live in memory only: one never landed
//! leaves its files written, uncommitted. `ura` never turns deferral on, so it commits within the
//! call.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

use crate::cache;
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
    /// Another kind of file, like an image, whose bytes are not kept: undo leaves it alone, unless
    /// the write deleted it, when it comes back from `HEAD`.
    Other,
}

/// The files under a working tree's `specs/`, by path from its top level.
type Before = HashMap<String, Held>;

/// What undo puts back at a file's path.
#[derive(Debug)]
enum Undone {
    /// The bytes it held before the write.
    Bytes(Vec<u8>),
    /// No file: it did not exist before the write.
    Absent,
    /// Its version at `HEAD`, when it is tracked: a file the write deleted, whose bytes were not
    /// kept, like an image.
    Head,
}

/// A file a deferred commit holds: what undo puts back at its path, and its bytes after the write,
/// `None` when the write deleted it.
struct Written {
    path: String,
    before: Undone,
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

/// Whether the repository `key` defers its commits: the server's, whose refused commits leave
/// nothing written.
pub(crate) fn deferring(key: &Path) -> bool {
    repositories(|repositories| repositories.contains_key(key))
}

/// Records what the files under the `specs/` of `place` hold, when its repository defers its
/// commits: the "before" of the write that follows.
pub(super) fn record(git: &Git, place: &Place) {
    let key = git.main_root();
    if !deferring(&key) {
        BEFORE.with_borrow_mut(|befores| befores.remove(&place.root));
        return;
    }
    let before = held(&place.root);
    BEFORE.with_borrow_mut(|befores| befores.insert(place.root.clone(), (key, before)));
}

/// What the files under the `specs/` of `root` hold.
fn held(root: &Path) -> Before {
    files_under(root, SPECS)
        .into_iter()
        .filter_map(|file| {
            let held = if file.ends_with(".md") {
                Held::Markdown(fs::read(root.join(&file)).ok()?)
            } else {
                Held::Other
            };
            Some((file, held))
        })
        .collect()
}

/// Defers the commit of `change`, written in `place`, when its repository defers commits: returns
/// it as committed, with no commit yet. `None` when the commit is to run now.
pub(super) fn defer_commit(place: &Place, change: &Change, only: bool) -> Option<Committed> {
    // An action commits once: what its place held is used, and goes.
    let (key, before) = BEFORE.with_borrow_mut(|befores| befores.remove(&place.root))?;
    if !deferring(&key) {
        return None;
    }
    let written = written(&place.root, &before, &change.paths);
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
/// `on_output` given each line git and its hooks print. When its files are committed already, it
/// lands as `HEAD`, with no commit. On a hook's refusal, each file still
/// holding what the write left gets back what it held before; the others are named after the
/// hook's output. Takes the repository's write lock to check and stage the change, and to put back
/// or move the cache's generation once git is done, never while `git commit` and its hooks run:
/// the server lands one commit at a time, a deferring write never touches the index, and a save
/// meanwhile changes the working tree, not what is staged.
pub fn land(key: &Path, id: &str, on_output: &dyn Fn(&str)) -> Result<Committed, ActionError> {
    let held = cache::write_lock(key);
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
    if let Some(head) = already_committed(&deferred.place, &deferred.change)? {
        return Ok(head);
    }
    // The lock held since the check, handed to the first staging, then taken again each time.
    let held = Cell::new(Some(held));
    let lock = || held.take().unwrap_or_else(|| cache::write_lock(key));
    let landed = super::commit::run(
        &deferred.place,
        &deferred.change,
        deferred.only,
        on_output,
        &lock,
    );
    // Dropped once the commit's files are put back, it moves the cache's generation.
    let _lock = lock();
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

/// `HEAD` as the commit of `change`, when each of its paths is as `HEAD` has it, on disk and in
/// the index: someone committed its files since the write, and git would refuse a commit with
/// nothing in it. Its hooks are not run, and nothing is put back.
fn already_committed(place: &Place, change: &Change) -> Result<Option<Committed>, ActionError> {
    let git = Git::open(&place.root)?;
    for path in &change.paths {
        if !git.as_committed(path)? {
            return Ok(None);
        }
    }
    let commit = git
        .head()
        .map(|id| id.to_hex_with_len(7).to_string())
        .unwrap_or_default();
    Ok(Some(Committed {
        change: change.clone(),
        commit,
    }))
}

/// Puts back what each file held before the write while it holds what the write left, and
/// returns the files left as they are: changed since, or failing to write. A file the write
/// deleted and whose bytes were not kept comes back as `HEAD` has it, when tracked.
fn undo(root: &Path, written: &[Written]) -> Vec<String> {
    let mut left = Vec::new();
    let git = Git::open(root).ok();
    for file in written {
        let path = root.join(&file.path);
        let now = fs::read(&path).ok();
        if now != file.after {
            left.push(file.path.clone());
            continue;
        }
        let write = |bytes: &[u8]| {
            path.parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&path, bytes))
        };
        let put_back = match &file.before {
            Undone::Bytes(bytes) if now.as_ref() == Some(bytes) => Ok(()),
            Undone::Bytes(bytes) => write(bytes),
            Undone::Absent if now.is_none() => Ok(()),
            Undone::Absent => fs::remove_file(&path).map(|()| remove_empty_folders(root, &path)),
            Undone::Head => match committed(git.as_ref(), &file.path) {
                Ok(Some(bytes)) => write(&bytes),
                // Never committed: nothing holds it to bring back.
                Ok(None) => Ok(()),
                Err(()) => Err(std::io::ErrorKind::NotFound.into()),
            },
        };
        if put_back.is_err() {
            left.push(file.path.clone());
        }
    }
    left
}

/// The bytes `HEAD` holds at `path`, `None` when it does not track it; an error when git cannot
/// be read.
fn committed(git: Option<&Git>, path: &str) -> Result<Option<Vec<u8>>, ()> {
    let git = git.ok_or(())?;
    match git.head() {
        Some(head) => git.read_file(head, path).map_err(drop),
        None => Ok(None),
    }
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
/// not Markdown before is left out, undo leaving it alone, unless the write deleted it: it then
/// comes back from `HEAD`.
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
            let after = fs::read(root.join(&file)).ok();
            let before = match before.get(&file) {
                Some(Held::Markdown(bytes)) => Undone::Bytes(bytes.clone()),
                Some(Held::Other) if after.is_none() => Undone::Head,
                Some(Held::Other) => return None,
                None => Undone::Absent,
            };
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Undo deletes a file the write created, with the folders it leaves empty, and leaves an
    /// image that was there before as the write left it.
    #[test]
    fn undo_deletes_what_the_write_created_and_leaves_images() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let write = |path: &str, bytes: &[u8]| {
            let path = root.join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, bytes).unwrap();
        };
        write("specs/README.md", b"# Specs\n");
        write("specs/images/shot.png", b"before");
        let before = held(root);

        write("specs/new/deep/note.md", b"# Note\n");
        write("specs/images/shot.png", b"after");
        let paths = ["specs/new".to_string(), "specs/images".to_string()];
        let written = written(root, &before, &paths);
        let left = undo(root, &written);

        assert!(left.is_empty(), "{left:?}");
        assert!(!root.join("specs/new").exists());
        assert!(root.join("specs/README.md").exists());
        assert_eq!(
            fs::read(root.join("specs/images/shot.png")).unwrap(),
            b"after"
        );
    }
}
