//! A checkout's preview, from its own copy of the preview decision, and the commit it runs at.

use std::io::ErrorKind;
use std::path::Path;

use super::{Result, refused};
use crate::files::preview::{Preview, preview_of};
use crate::git::Git;

/// The preview of the checkout at `checkout`, from its `specs/decisions/preview.md`: `None` when
/// the file is missing, not `active`, or its fields are wrong.
pub fn preview(checkout: &Path) -> Result<Option<Preview>> {
    let path = checkout.join("specs/decisions/preview.md");
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(preview_of(&text)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(refused(format!("{}: {error}", path.display()))),
    }
}

/// The commit the checkout at `checkout` has checked out, as a full hash: `None` before its first
/// commit. A preview runs at it, and starts again once it moves.
pub fn checkout_commit(checkout: &Path) -> Result<Option<String>> {
    let git = Git::open(checkout).map_err(|error| refused(error.to_string()))?;
    Ok(git.head().map(|id| id.to_string()))
}
