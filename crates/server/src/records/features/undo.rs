//! The change an undoable write made, recorded as the write runs, for its answer.

use std::path::Path;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use uraeda_core::api::ApiError;
use uraeda_core::api::undo::{self, Change};
use uraeda_protocol::{RecordedChange, RecordedFile};

use crate::live::Fault;

/// Runs a write of the repository at `repo`, and gives what it answers with the change it made
/// to the files under `scope`, one of the core's scopes. A write that fails records nothing.
pub(super) fn recorded<T>(
    repo: &Path,
    scope: &[&str],
    write: impl FnOnce() -> Result<T, ApiError>,
) -> Result<(T, Option<RecordedChange>), Fault> {
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
) -> Result<(T, Option<RecordedChange>), Fault> {
    let (value, change) = undo::recorded_keeping(repo, scope, kept, write)?;
    Ok((value, Some(sent(change))))
}

/// A change as a client keeps it: each file's bytes in base64.
fn sent(change: Change) -> RecordedChange {
    let encode = |bytes: Option<Vec<u8>>| bytes.map(|bytes| STANDARD.encode(bytes));
    let file = |file: undo::ChangedFile| RecordedFile {
        path: file.path,
        before: encode(file.before),
        after: encode(file.after),
    };
    RecordedChange {
        commit: change.commit,
        files: change.files.into_iter().map(file).collect(),
    }
}
