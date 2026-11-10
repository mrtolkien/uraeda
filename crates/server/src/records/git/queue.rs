//! A repository's turn: its git writes land one at a time.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};

use crate::shared::Shared;

/// Each repository's turn, by its main checkout.
#[derive(Default)]
pub(super) struct Turns(Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>);

/// Runs a write of a repository once the ones before it landed, and gives what it gives.
// JOIN(wave 6): write queue, its entry point for a write that lands within its call
pub(super) fn in_turn<T>(shared: &Shared, repository: &Path, write: impl FnOnce() -> T) -> T {
    let turns = shared.get::<Turns>();
    let turn = {
        let mut turns = turns.0.lock().unwrap_or_else(PoisonError::into_inner);
        turns.entry(repository.to_owned()).or_default().clone()
    };
    // A write that panicked left git's own state, which the next one reads.
    let _held = turn.lock().unwrap_or_else(PoisonError::into_inner);
    write()
}
