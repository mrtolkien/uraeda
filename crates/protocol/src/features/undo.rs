//! What an undoable write answers: the change it made, which the undo writes back.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::shared::UndoChange;

/// A write of the inbox or of the priorities: the list's hash as written, which the next write
/// is made over, and the change to undo, none for a write that is not undone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ListWritten {
    /// The SHA-256 of the list's text now.
    pub hash: String,
    /// The change the write made.
    pub change: Option<UndoChange>,
}

/// A note moved from the inbox to the priorities: both lists changed, and their records show
/// them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NoteMoved {
    /// The change the move made.
    pub change: Option<UndoChange>,
}

/// A write that made or moved a proposal file: where the file is now, for the page that opens.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileWritten {
    /// The file's path from the top level.
    pub path: String,
    /// The change the write made.
    pub change: Option<UndoChange>,
}
