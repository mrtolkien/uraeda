//! A note's image taken out of its draft, and taken back, each written on the default branch.

use std::path::Path;

use super::{Result, reach_default, write_lock};
use crate::actions::inbox::{self as edits, RemovedImage};
use crate::files::inbox::Inbox;

/// Takes the image at `image` out of the draft at `draft`, both from the top level, over the draft
/// read at `previous`: the lines linking it go, and its file stays, for `ura inbox clean` or a
/// commit to delete. Gives the inbox, whose note no longer has it, and what Undo takes back.
pub fn remove_note_image(
    repo: &Path,
    draft: &str,
    image: &str,
    previous: &str,
) -> Result<(Inbox, RemovedImage)> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let removed = edits::remove_image(&place, draft, image, previous)?;
    Ok((edits::read(&place), removed))
}

/// Takes back an image's removal: its lines go back where they were, over the draft as it is now.
/// Refused once the lines there changed, or the draft links the image again.
pub fn restore_note_image(repo: &Path, removed: &RemovedImage) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::restore_image(&place, removed)?;
    Ok(edits::read(&place))
}
