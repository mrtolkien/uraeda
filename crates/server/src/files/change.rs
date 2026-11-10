//! The change an upload's write made, as its answer carries it for the undo.

use std::path::Path;

use serde_json::Value;
use uraeda_core::api::ApiError;
use uraeda_core::api::undo::{self, Change};

use crate::records::writing::undo::sent;

/// Runs a write of the core, and returns its answer with the change it made to the files under
/// `scope`. A refused or failed write records nothing.
pub(super) fn recorded<T>(
    repo: &Path,
    scope: &[String],
    write: impl FnOnce() -> Result<T, ApiError>,
) -> Result<(T, Value), ApiError> {
    let (answer, change) = undo::recorded(repo, scope, write)?;
    Ok((answer, view(change)))
}

/// A change as a client holds it and hands it back to undo it: the undo's own form of it.
fn view(change: Change) -> Value {
    serde_json::to_value(sent(change)).unwrap_or_default()
}
