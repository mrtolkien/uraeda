//! The change an undoable write made: what its answer gives, a client keeps, and `undo.apply`
//! takes back.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// What a write changed, as its answer gives it and `undo.apply` takes it back: the commit its
/// checkout was at, and each file on both sides.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoChange {
    pub commit: Option<String>,
    pub files: Vec<UndoFile>,
}

/// A file of a change, by its path from the top level: its bytes before and after, in base64,
/// `null` on the side where it did not exist.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UndoFile {
    pub path: String,
    pub before: Option<String>,
    pub after: Option<String>,
}
