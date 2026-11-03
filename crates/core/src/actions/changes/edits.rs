//! A buffer's edits among a pane's changes: each file a buffer saved, recorded beside its checkout
//! and still differing from its commit, is one `- Edit <path>` line, in place of the lines its
//! changes would read as (ruling R1).

use std::fs;

use crate::actions::edited;
use crate::git::Git;

use super::{ActionError, Described, Listed, Place, place, versions};

/// The files a buffer saved in the checkout of `place` whose text still differs from `HEAD`'s,
/// from the top level: a file committed since, or put back, is no change.
pub(super) fn edits(place: &Place) -> Vec<String> {
    edited::list(place)
        .into_iter()
        .filter(|path| {
            let (now, then) = versions(place, path);
            now != then
        })
        .collect()
}

/// A buffer's edit of the file `shown`, as its pane names it.
pub(super) fn edit(shown: &str) -> Described {
    Described {
        subject: format!("edit {shown}"),
        line: format!("- Edit {shown}"),
    }
}

/// The pane of a branch other than the default one: the files a buffer edited alone, never an
/// agent's, each named from `folder`, the feature's folder from the top level, when it is in it.
pub(super) fn listed(place: &Place, folder: Option<&str>) -> Listed {
    let edits = edits(place);
    let changes = edits
        .iter()
        .map(|path| {
            let shown = folder
                .and_then(|folder| path.strip_prefix(folder)?.strip_prefix('/'))
                .unwrap_or(path);
            edit(shown)
        })
        .collect();
    Listed {
        changes,
        paths: edits.clone(),
        undo: Vec::new(),
        repairs: Vec::new(),
        edits,
    }
}

/// Puts the files of `edits` back as `HEAD` has them, deleting those no commit has, and forgets
/// them.
pub(super) fn restore(place: &Place, git: &Git, edits: &[String]) -> Result<(), ActionError> {
    for path in edits {
        if place::committed(place, path).is_some() {
            git.restore(path)?;
        } else if place.root.join(path).is_file() {
            fs::remove_file(place.root.join(path))?;
        }
    }
    edited::clear(place, edits)
}
