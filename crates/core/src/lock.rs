//! The write lock, one per repository, keyed by its main checkout, and one per folder.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex, MutexGuard, PoisonError};

/// The keys whose lock a write holds.
static WRITING: Mutex<Option<HashSet<PathBuf>>> = Mutex::new(None);
/// Notified when a write releases its lock.
static RELEASED: Condvar = Condvar::new();

fn locked<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

/// A write lock, held until dropped. A guard taken by a thread that already held the lock
/// re-enters it: the lock is released once the thread's last guard of it goes, in whatever order.
/// It stays on its thread.
pub(crate) struct WriteGuard {
    key: PathBuf,
    /// Not `Send`: the thread that took the lock releases it.
    _thread: std::marker::PhantomData<*const ()>,
}

thread_local! {
    /// How many guards of each lock this thread holds, by key: taking one held is re-entering it.
    static HELD: std::cell::RefCell<HashMap<PathBuf, usize>> =
        std::cell::RefCell::new(HashMap::new());
}

/// One write at a time in the folder `dir`, by its own path, as the data folder: a folder inside a
/// repository, like a dotfiles one, locks nothing of that repository's.
pub(crate) fn folder_lock(dir: &Path) -> WriteGuard {
    lock(std::fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf()))
}

/// Takes the lock `key`, or re-enters it when this thread holds it.
fn lock(key: PathBuf) -> WriteGuard {
    let guard = |key| WriteGuard {
        key,
        _thread: std::marker::PhantomData,
    };
    let reentered = HELD.with(|held| match held.borrow_mut().get_mut(&key) {
        Some(depth) => {
            *depth += 1;
            true
        }
        None => false,
    });
    if reentered {
        return guard(key);
    }
    let mut writing = locked(&WRITING);
    while writing.get_or_insert_with(HashSet::new).contains(&key) {
        writing = RELEASED
            .wait(writing)
            .unwrap_or_else(PoisonError::into_inner);
    }
    writing.get_or_insert_with(HashSet::new).insert(key.clone());
    HELD.with(|held| held.borrow_mut().insert(key.clone(), 1));
    guard(key)
}

impl Drop for WriteGuard {
    fn drop(&mut self) {
        let last = HELD.with(|held| {
            let mut held = held.borrow_mut();
            let depth = held.get_mut(&self.key).map_or(0, |depth| {
                *depth -= 1;
                *depth
            });
            if depth == 0 {
                held.remove(&self.key);
            }
            depth == 0
        });
        if !last {
            return;
        }
        if let Some(writing) = locked(&WRITING).as_mut() {
            writing.remove(&self.key);
        }
        RELEASED.notify_all();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Whether the lock `key` is taken.
    fn writing(key: &Path) -> bool {
        locked(&WRITING).as_ref().is_some_and(|it| it.contains(key))
    }

    /// A nested guard dropped after the outer one still holds the lock until it goes.
    #[test]
    fn a_nested_guard_outliving_the_outer_one_keeps_the_lock() {
        let key = PathBuf::from("/a-repository-for-the-nested-lock");
        let outer = lock(key.clone());
        let nested = lock(key.clone());
        drop(outer);
        assert!(writing(&key));
        drop(nested);
        assert!(!writing(&key));
        let again = lock(key.clone());
        assert!(writing(&key));
        drop(again);
        assert!(!writing(&key));
    }
}
