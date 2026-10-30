//! Commits deferred for the server. With deferral on for a repository, a committing action writes
//! its files and returns without running git, and its commit waits for [`land`], which runs it
//! with the hooks. A hook's refusal puts back what the write left, file by file, from what each
//! held when the action reached its place. Deferred commits live in memory only: one never landed
//! leaves its files written, uncommitted. `ura` never turns deferral on, so it commits within the
//! call. Until a deferred commit lands or is refused, [`pending`] gives what it wrote, which a
//! feature's step is read with.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard, PoisonError};

use crate::cache;
use crate::git::Git;

use super::place::Place;
use super::{ActionError, Change, Committed};

mod undo;

use undo::{Before, Written, held, undo, written};

/// A commit deferred, with what undoes its write.
#[derive(Clone)]
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
    /// Landing: its commit and hooks run, and what it wrote is not in `HEAD` yet.
    landing: HashMap<String, Deferred>,
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
    // Its writes pending, or forgotten, change the steps read: what was kept is read again.
    cache::invalidate(key);
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
        let deferred = match repository.taken.remove(id) {
            Some(deferred) => deferred,
            None => {
                let index = repository.fresh.iter().position(|d| d.id == id)?;
                repository.fresh.remove(index)
            }
        };
        repository.landing.insert(id.to_string(), deferred.clone());
        Some(deferred)
    })
    .ok_or_else(|| {
        ActionError::Refused(format!("no deferred commit {id}: it landed or was dropped"))
    })?;
    // Dropped under the write lock, so a read sees its files pending or in `HEAD`, never neither,
    // and on a panic too.
    let settled = Settled { key, id };
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
    let result = match landed {
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
    };
    drop(settled);
    result
}

/// Takes a commit out of its repository's landing map as it drops.
struct Settled<'a> {
    key: &'a Path,
    id: &'a str,
}

impl Drop for Settled<'_> {
    fn drop(&mut self) {
        repositories(|repositories| {
            repositories
                .get_mut(self.key)
                .map(|repository| repository.landing.remove(self.id))
        });
    }
}

/// The writes of a repository's deferred commits not landed yet, as [`pending`] took them.
#[derive(Default)]
pub struct Pending(Vec<(u64, PathBuf, Vec<Written>)>);

/// The writes of the deferred commits of the repository `key` not landed yet, at once: a read
/// takes them before it reads a branch's tip, so a commit landing meanwhile is in them, or in the
/// tip it reads, or both, never neither.
pub fn pending(key: &Path) -> Pending {
    let mut deferred: Vec<_> = repositories(|repositories| {
        let Some(repository) = repositories.get(key) else {
            return Vec::new();
        };
        repository
            .fresh
            .iter()
            .chain(repository.taken.values())
            .chain(repository.landing.values())
            .map(|deferred| {
                let id = deferred.id.parse().unwrap_or(0);
                (id, deferred.place.root.clone(), deferred.written.clone())
            })
            .collect()
    });
    deferred.sort_by_key(|(id, _, _)| *id);
    Pending(deferred)
}

impl Pending {
    /// The files directly in the folder `folder_path` of the working tree at `root` that the
    /// writes wrote: by name, with their text after the write, `None` when the write deleted the
    /// file. A file the write left not UTF-8 is left out, the tip's text read. A later write of a
    /// file wins. What a hand edit wrote since is not read: only the write's own bytes.
    pub fn files(&self, root: &Path, folder_path: &str) -> BTreeMap<String, Option<String>> {
        let mut files = BTreeMap::new();
        let in_it = |written: &[Written]| {
            written
                .iter()
                .any(|file| in_folder(&file.path, folder_path).is_some())
        };
        let mut writes = self
            .0
            .iter()
            .filter(|(_, _, written)| in_it(written))
            .peekable();
        if writes.peek().is_none() {
            return files;
        }
        let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
        for (_, place, written) in writes {
            if fs::canonicalize(place).unwrap_or_else(|_| place.clone()) != root {
                continue;
            }
            for file in written {
                let Some(name) = in_folder(&file.path, folder_path) else {
                    continue;
                };
                match file.after.clone().map(String::from_utf8) {
                    Some(Ok(text)) => files.insert(name.to_string(), Some(text)),
                    None => files.insert(name.to_string(), None),
                    Some(Err(_)) => None,
                };
            }
        }
        files
    }
}

/// The name of `path` when it is a file directly in the folder `folder_path`.
fn in_folder<'p>(path: &'p str, folder_path: &str) -> Option<&'p str> {
    let name = path.strip_prefix(folder_path)?.strip_prefix('/')?;
    (!name.contains('/')).then_some(name)
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

#[cfg(test)]
mod tests {
    use super::*;

    /// A write that left a file not UTF-8 is not read: the tip's text stays, rather than the file
    /// read as deleted.
    #[test]
    fn a_write_left_not_utf8_is_not_read() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let folder = root.join("specs/feature");
        fs::create_dir_all(&folder).unwrap();
        fs::write(folder.join("spec.md"), b"\xff\xfe").unwrap();
        fs::write(folder.join("plan.md"), "# Plan\n").unwrap();
        let paths = ["specs/feature".to_string()];
        let written = written(root, &Before::new(), &paths);

        let files = Pending(vec![(1, root.to_path_buf(), written)]).files(root, "specs/feature");

        assert_eq!(
            files,
            BTreeMap::from([("plan.md".to_string(), Some("# Plan\n".to_string()))])
        );
    }
}
