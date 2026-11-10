//! The undo of the human's writes: an undoable write answers the change it made, which
//! `undo.apply` writes back, or forward for a redo, while every file still holds the other side.
//! It writes files only: no commit, and no git command.

use std::path::Path;

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD;
use uraeda_core::api::ApiError;
use uraeda_core::api::undo::{self, Change, ChangedFile, Direction};
use uraeda_protocol::{
    Recorded, UndoApplied, UndoApply, UndoChange, UndoCommitted, UndoDirection, UndoFile,
};

use super::{Write, write};
use crate::live::{Fault, Registry};
use crate::records::repositories;

/// Registers the actions `undo.apply` and `undo.committed`.
pub(super) fn register(registry: &Registry) {
    registry.action::<UndoApply>(|call, input| {
        let change = taken(input.change)?;
        let direction = match input.direction {
            UndoDirection::Undo => Direction::Undo,
            UndoDirection::Redo => Direction::Redo,
        };
        write(call.shared(), &input.repo, Write::saving(), |repo| {
            let commit = undo::apply_change(repo, &change, direction, &input.subject)?;
            Ok(UndoApplied { commit })
        })
    });
    registry.action::<UndoCommitted>(|call, input| {
        let repo = repositories::path(call.shared(), &input.repo)?;
        Ok(undo::committed_since(&repo, &taken(input.change)?)?)
    });
}

/// Runs an undoable write of the core, and answers the change it made to the files under
/// `scope`: a write that fails records none.
pub(super) fn recorded<T>(
    repo: &Path,
    scope: Result<Vec<String>, ApiError>,
    write: impl FnOnce() -> Result<T, ApiError>,
) -> Result<Recorded, Fault> {
    let (_, change) = undo::recorded(repo, &scope?, write)?;
    Ok(Recorded {
        change: sent(change),
    })
}

/// A change as an answer gives it: each file's bytes in base64.
fn sent(change: Change) -> UndoChange {
    let encode = |bytes: Option<Vec<u8>>| bytes.map(|bytes| STANDARD.encode(bytes));
    let file = |file: ChangedFile| UndoFile {
        path: file.path,
        before: encode(file.before),
        after: encode(file.after),
    };
    UndoChange {
        commit: change.commit,
        files: change.files.into_iter().map(file).collect(),
    }
}

/// A change as a client gave it back.
fn taken(change: UndoChange) -> Result<Change, Fault> {
    let decode = |path: &str, bytes: Option<String>| {
        let bytes = bytes.map(|bytes| STANDARD.decode(bytes)).transpose();
        bytes.map_err(|_| Fault::refused(format!("{path}: its bytes are not base64")))
    };
    let file = |file: UndoFile| {
        Ok(ChangedFile {
            before: decode(&file.path, file.before)?,
            after: decode(&file.path, file.after)?,
            path: file.path,
        })
    };
    let files: Result<_, Fault> = change.files.into_iter().map(file).collect();
    Ok(Change {
        commit: change.commit,
        files: files?,
    })
}
