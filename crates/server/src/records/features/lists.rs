//! A write of the default branch's lists, the inbox and the priorities, and of the files they
//! link: each runs in its repository's turn, through the write queue, which says what changed,
//! and records the change an undo writes back.

use std::path::Path;

use uraeda_core::api::ApiError;
use uraeda_core::files::inbox::Inbox;
use uraeda_core::files::priorities::Priorities;
use uraeda_protocol::{FileWritten, ListWritten, NoteMoved};

use super::undo;
use crate::live::{Call, Fault};
use crate::records::writing::{self, Write as Queued};

/// A list the core read back once written, with the hash the next write is made over.
pub(super) trait List {
    /// The SHA-256 of its text.
    fn hash(&self) -> &str;
}

impl List for Inbox {
    fn hash(&self) -> &str {
        &self.hash
    }
}

impl List for Priorities {
    fn hash(&self) -> &str {
        &self.hash
    }
}

/// What a write of the core takes: the repository's main checkout.
type Write<'a, T> = Box<dyn FnOnce(&Path) -> Result<T, ApiError> + 'a>;

/// The undoable write of one list: answers its hash as written, and the change to undo.
pub(super) fn written<L: List>(
    call: &Call,
    repo: &str,
    scope: &[&str],
    write: Write<'_, L>,
) -> Result<ListWritten, Fault> {
    let (list, change) = recorded(call, repo, scope, write)?;
    Ok(ListWritten {
        hash: list.hash().to_owned(),
        change,
    })
}

/// A write of one list that is not undone, as an edit in a text field, a commit, or a discard:
/// `queued` says whether it commits, and under which name.
pub(super) fn plain<L: List>(
    call: &Call,
    repo: &str,
    queued: Queued,
    write: Write<'_, L>,
) -> Result<ListWritten, Fault> {
    let list = writing::write(call.shared(), repo, queued, |root| Ok(write(root)?))?;
    Ok(ListWritten {
        hash: list.hash().to_owned(),
        change: None,
    })
}

/// The undoable move of a note from the inbox into the priorities.
pub(super) fn moved(
    call: &Call,
    repo: &str,
    scope: &[&str],
    write: Write<'_, ()>,
) -> Result<NoteMoved, Fault> {
    let ((), change) = recorded(call, repo, scope, write)?;
    Ok(NoteMoved { change })
}

/// The undoable write that makes or moves a proposal file: answers where the file is now.
pub(super) fn filed(
    call: &Call,
    repo: &str,
    scope: &[&str],
    write: Write<'_, String>,
) -> Result<FileWritten, Fault> {
    let (path, change) = recorded(call, repo, scope, write)?;
    Ok(FileWritten { path, change })
}

/// Runs an undoable write of the lists in its repository's turn: it commits nothing.
fn recorded<T>(
    call: &Call,
    repo: &str,
    scope: &[&str],
    write: Write<'_, T>,
) -> Result<(T, Option<uraeda_protocol::UndoChange>), Fault> {
    writing::write(call.shared(), repo, Queued::saving(), |root| {
        undo::recorded(root, scope, || write(root))
    })
}
