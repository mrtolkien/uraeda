//! The commit that ends a committing action, shared by `ura` and the server.

use crate::git::{Git, GitError};

use super::place::Place;
use super::{ActionError, Change, Committed};

/// Commits an action's files in the working tree it wrote in, running the hooks. A hook's refusal
/// keeps the files written, and returns its whole output.
pub fn commit(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    let git = Git::open(&place.root)?;
    match git.commit(&change.paths, &change.subject, change.body.as_deref()) {
        Ok(()) => {}
        Err(GitError::Command {
            subcommand,
            message,
            output,
        }) if subcommand == "commit" => return Err(ActionError::Hook { message, output }),
        Err(error) => return Err(error.into()),
    }
    let head = Git::open(&place.root)?
        .head()
        .map(|id| id.to_hex_with_len(7).to_string())
        .unwrap_or_default();
    Ok(Committed {
        change: change.clone(),
        commit: head,
    })
}
