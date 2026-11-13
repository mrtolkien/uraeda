//! The change an undoable write made, recorded as the write runs, for its answer.

use std::path::Path;

use uraeda_core::api::ApiError;
use uraeda_core::api::undo;
use uraeda_protocol::UndoChange;

use crate::live::Fault;
use crate::records::writing::undo::sent;

/// Runs a write of the repository at `repo`, and gives what it answers with the change it made
/// to the files under `scope`, one of the core's scopes. A write that fails records nothing.
pub(super) fn recorded<T>(
    repo: &Path,
    scope: &[&str],
    write: impl FnOnce() -> Result<T, ApiError>,
) -> Result<(T, Option<UndoChange>), Fault> {
    let (value, change) = undo::recorded(repo, scope, write)?;
    Ok((value, Some(sent(change))))
}

/// [`recorded`], keeping with the change each file of `kept` the write left as it was: a later
/// commit may delete it, and the undo writes it back.
pub(super) fn recorded_keeping<T>(
    repo: &Path,
    scope: &[String],
    kept: &[String],
    write: impl FnOnce() -> Result<T, ApiError>,
) -> Result<(T, Option<UndoChange>), Fault> {
    let (value, change) = undo::recorded_keeping(repo, scope, kept, write)?;
    Ok((value, Some(sent(change))))
}
