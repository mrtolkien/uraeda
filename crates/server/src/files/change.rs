//! The change an upload's write made, as its answer carries it for the undo.

use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Value, json};
use uraeda_core::api::ApiError;
use uraeda_core::api::undo::{self, Change};

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

/// A change as a client holds it and hands it back to undo it: the commit its checkout was at,
/// and each file's bytes before and after, in base64, `null` on the side where it did not exist.
// JOIN(wave 6): the change's form for a client, which the undo's actions own (task 9).
fn view(change: Change) -> Value {
    let encode = |bytes: Option<Vec<u8>>| bytes.map(|bytes| STANDARD.encode(bytes));
    let files = change.files.into_iter().map(|file| {
        json!({
            "path": file.path,
            "before": encode(file.before),
            "after": encode(file.after),
        })
    });
    json!({ "commit": change.commit, "files": files.collect::<Vec<_>>() })
}
