//! The read cache and the write lock, one of each per repository, keyed by its main checkout.
//!
//! While a watch of a repository runs, each read of its workspace is kept, by the working tree it
//! was read from, until the next change: every file event the watcher sees, and every write's end,
//! moves the repository's generation, which drops what was kept. A read stores what it read only
//! when the generation did not move while it read, so a read that raced a change never keeps what
//! it saw before it. Without a watch nothing is kept, and every read reads git.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, MutexGuard, OnceLock, PoisonError};

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::git::Git;
use crate::view::WorkspaceView;
use crate::workspace::{Problem, Workspace, WorkspaceError};

/// The reads of a watched repository since its watch started.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct CacheStats {
    /// The reads of git.
    pub reads: u32,
    /// The answers from memory.
    pub hits: u32,
}

/// A workspace as read, with what the reads of it computed from it since.
pub(crate) struct Read {
    pub(crate) workspace: Arc<Workspace>,
    view: OnceLock<WorkspaceView>,
    checked: Mutex<HashMap<String, Vec<Problem>>>,
}

impl Read {
    fn new(workspace: Workspace) -> Read {
        Read {
            workspace: Arc::new(workspace),
            view: OnceLock::new(),
            checked: Mutex::new(HashMap::new()),
        }
    }

    /// The workspace's view, computed by `view` the first time.
    pub(crate) fn view(&self, view: impl FnOnce(&Workspace) -> WorkspaceView) -> WorkspaceView {
        self.view.get_or_init(|| view(&self.workspace)).clone()
    }

    /// The problems `ura check` finds in the feature `folder`, computed by `check` the first time.
    pub(crate) fn checked(
        &self,
        folder: &str,
        check: impl FnOnce() -> Vec<Problem>,
    ) -> Vec<Problem> {
        if let Some(problems) = locked(&self.checked).get(folder) {
            return problems.clone();
        }
        let problems = check();
        locked(&self.checked).insert(folder.to_string(), problems.clone());
        problems
    }
}

type Hook = Arc<dyn Fn() + Send + Sync>;

/// A repository's lock and cache.
#[derive(Default)]
struct Repository {
    /// Whether a write holds the repository's lock.
    writing: bool,
    /// The watches running: the cache is kept while there is one.
    watches: usize,
    /// Moved by every change.
    generation: u64,
    /// The reads kept, by the working tree read from, with the generation they were read at.
    kept: HashMap<PathBuf, (u64, Arc<Read>)>,
    stats: CacheStats,
    /// Called by a read between reading git and storing what it read, for the tests.
    before_storing: Option<Hook>,
}

impl Repository {
    fn change(&mut self) {
        self.generation += 1;
        self.kept.clear();
    }

    fn unused(&self) -> bool {
        !self.writing && self.watches == 0
    }
}

static REPOSITORIES: Mutex<Option<HashMap<PathBuf, Repository>>> = Mutex::new(None);
/// Notified when a write releases its repository's lock.
static RELEASED: Condvar = Condvar::new();

fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Runs `act` on the repositories, created empty on first use.
fn repositories<T>(act: impl FnOnce(&mut HashMap<PathBuf, Repository>) -> T) -> T {
    act(locked(&REPOSITORIES).get_or_insert_with(HashMap::new))
}

/// The key of the repository holding `path`: its main checkout, or the path itself outside git.
pub(crate) fn key(path: &Path) -> PathBuf {
    match Git::discover(path) {
        Ok(git) => git.main_root(),
        Err(_) => std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf()),
    }
}

/// Moves the generation of the repository `key` when its cache is kept: what was read before is
/// read again.
pub(crate) fn invalidate(key: &Path) {
    repositories(|repositories| {
        if let Some(repository) = repositories.get_mut(key) {
            repository.change();
        }
    });
}

/// What a read finds in memory.
enum Lookup {
    /// A read since the last change, kept.
    Kept(Arc<Read>),
    /// Nothing kept: what git reads is kept if the generation is still this one, after the hook.
    Missed(u64, Option<Hook>),
    /// The repository is not watched, or a write holds it: what git reads is not kept.
    Uncached,
}

/// The workspace of the working tree `git` opened, from memory when a read since the last change
/// kept it.
pub(crate) fn read(git: &Git) -> Result<Arc<Read>, WorkspaceError> {
    let key = git.main_root();
    let root = git.root().to_path_buf();
    let lookup = repositories(|repositories| {
        let Some(repository) = repositories.get_mut(&key).filter(|r| r.watches > 0) else {
            return Lookup::Uncached;
        };
        // A write's reads see the files it writes: they never answer from memory, nor keep.
        if repository.writing {
            repository.stats.reads = repository.stats.reads.saturating_add(1);
            return Lookup::Uncached;
        }
        if let Some((generation, read)) = repository.kept.get(&root)
            && *generation == repository.generation
        {
            repository.stats.hits = repository.stats.hits.saturating_add(1);
            return Lookup::Kept(Arc::clone(read));
        }
        repository.stats.reads = repository.stats.reads.saturating_add(1);
        Lookup::Missed(repository.generation, repository.before_storing.clone())
    });
    let (generation, hook) = match lookup {
        Lookup::Kept(read) => return Ok(read),
        Lookup::Missed(generation, hook) => (generation, hook),
        Lookup::Uncached => return Ok(Arc::new(Read::new(Workspace::read(git)?))),
    };
    let read = Arc::new(Read::new(Workspace::read(git)?));
    if let Some(hook) = hook {
        hook();
    }
    repositories(|repositories| {
        if let Some(repository) = repositories.get_mut(&key)
            && repository.watches > 0
            && !repository.writing
            && repository.generation == generation
        {
            repository
                .kept
                .insert(root, (generation, Arc::clone(&read)));
        }
    });
    Ok(read)
}

/// The reads of the repository holding `repo` since its watch started; none without a watch.
pub fn cache_stats(repo: &Path) -> CacheStats {
    let canonical = std::fs::canonicalize(repo).unwrap_or_else(|_| repo.to_path_buf());
    repositories(|repositories| repositories.get(&canonical).map(|r| r.stats))
        .or_else(|| repositories(|repositories| repositories.get(&key(repo)).map(|r| r.stats)))
        .unwrap_or_default()
}

/// Calls `hook` in each read of the repository holding `repo` that may keep what it read, between
/// reading git and keeping it, while its watch runs. For the tests: a read held there races the
/// changes made meanwhile.
#[doc(hidden)]
pub fn before_storing(repo: &Path, hook: impl Fn() + Send + Sync + 'static) {
    let key = key(repo);
    repositories(|repositories| {
        if let Some(repository) = repositories.get_mut(&key) {
            repository.before_storing = Some(Arc::new(hook));
        }
    });
}

/// Keeps the reads of a repository while it lives: a watch holds one.
pub(crate) struct Kept {
    key: PathBuf,
}

impl Kept {
    pub(crate) fn new(key: PathBuf) -> Kept {
        repositories(|repositories| {
            let repository = repositories.entry(key.clone()).or_default();
            repository.watches += 1;
        });
        Kept { key }
    }

    pub(crate) fn key(&self) -> &Path {
        &self.key
    }
}

impl Drop for Kept {
    fn drop(&mut self) {
        repositories(|repositories| {
            let Some(repository) = repositories.get_mut(&self.key) else {
                return;
            };
            repository.watches = repository.watches.saturating_sub(1);
            if repository.watches == 0 {
                // Without a watch, nothing sees the changes: the entry goes with what it kept.
                if repository.unused() {
                    repositories.remove(&self.key);
                } else {
                    *repository = Repository {
                        writing: repository.writing,
                        ..Repository::default()
                    };
                }
            }
        });
    }
}

/// A repository's write lock, held until dropped: dropping it moves the repository's generation.
pub(crate) struct WriteGuard {
    key: PathBuf,
}

/// One write at a time in the repository holding `repo`: reaching a branch creates its worktree,
/// and an action reads, edits, and writes a file, which two calls at once would interleave.
/// Writes to different repositories run at once.
pub(crate) fn write_lock(repo: &Path) -> WriteGuard {
    let key = key(repo);
    let mut repositories = locked(&REPOSITORIES);
    loop {
        let repository = repositories
            .get_or_insert_with(HashMap::new)
            .entry(key.clone())
            .or_default();
        if !repository.writing {
            repository.writing = true;
            return WriteGuard { key };
        }
        repositories = RELEASED
            .wait(repositories)
            .unwrap_or_else(PoisonError::into_inner);
    }
}

impl Drop for WriteGuard {
    fn drop(&mut self) {
        repositories(|repositories| {
            if let Some(repository) = repositories.get_mut(&self.key) {
                repository.writing = false;
                repository.change();
                if repository.unused() {
                    repositories.remove(&self.key);
                }
            }
        });
        RELEASED.notify_all();
    }
}
