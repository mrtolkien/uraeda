//! The commit that ends a committing action.

use crate::git::{Git, GitError};

use super::place::Place;
use super::{ActionError, Change, Committed};

/// Commits an action's files alone in the working tree it wrote in, running the hooks, leaving
/// other staged files staged and out of the commit. A hook's refusal keeps the files written, and
/// returns its whole output.
pub fn commit_only(place: &Place, change: &Change) -> Result<Committed, ActionError> {
    let git = Git::open(&place.root)?;
    match git.commit_only(
        &change.paths,
        &change.subject,
        change.body.as_deref(),
        false,
    ) {
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
