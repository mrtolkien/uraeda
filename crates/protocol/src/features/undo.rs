//! What an undoable write answers: the change it made, which the undo writes back.

// JOIN(wave 6): the undo (task 9) takes a change back as `undo.apply`'s input: the change is one
// type, whichever of the two names it keeps.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// The change a write made to the files of `specs/`: what undoing it takes. A client keeps it,
/// and hands it back to undo or redo the write.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecordedChange {
    /// The commit the files' checkout was at.
    pub commit: Option<String>,
    /// Each file the write changed, and each it left as it was that is kept with the change.
    pub files: Vec<RecordedFile>,
}

/// A file of a change, by its path from the top level, with its bytes on each side in base64:
/// none on the side where it did not exist.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct RecordedFile {
    /// Its path from the top level.
    pub path: String,
    /// Its bytes before the write.
    pub before: Option<String>,
    /// Its bytes after it.
    pub after: Option<String>,
}

/// A write of the inbox or of the priorities: the list's hash as written, which the next write
/// is made over, and the change to undo, none for a write that is not undone.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ListWritten {
    /// The SHA-256 of the list's text now.
    pub hash: String,
    /// The change the write made.
    pub change: Option<RecordedChange>,
}

/// A note moved from the inbox to the priorities: both lists changed, and their records show
/// them.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct NoteMoved {
    /// The change the move made.
    pub change: Option<RecordedChange>,
}

/// A write that made or moved a proposal file: where the file is now, for the page that opens.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct FileWritten {
    /// The file's path from the top level.
    pub path: String,
    /// The change the write made.
    pub change: Option<RecordedChange>,
}
