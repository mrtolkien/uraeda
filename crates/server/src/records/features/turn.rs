//! One writer per repository: a write waits for the writes of its repository before it.

// JOIN(wave 6): the write queue (task 9). Each call of `in_turn` is a write the queue takes: it
// gives the turn, names the write in the record `WriteQueue`, and defers its commit.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};

use crate::live::Fault;
use crate::shared::Shared;

/// The turn of each repository, by its main checkout.
#[derive(Default)]
pub(super) struct Turns(Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>);

/// Runs a write of the repository whose main checkout is `root` in its turn: after the writes of
/// that repository that came before it, and before the ones that come after.
pub(super) fn in_turn<T>(
    shared: &Shared,
    root: &Path,
    write: impl FnOnce() -> Result<T, Fault>,
) -> Result<T, Fault> {
    let turns = shared.get::<Turns>();
    let turn = {
        let mut held = turns.0.lock().unwrap_or_else(PoisonError::into_inner);
        held.entry(root.to_owned()).or_default().clone()
    };
    // A write that panicked left its files as the core's own lock allows: the next one goes on.
    let _held = turn.lock().unwrap_or_else(PoisonError::into_inner);
    write()
}
