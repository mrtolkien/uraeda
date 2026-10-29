//! A note's image taken out of its file, and taken back, each written on the default branch.

use std::path::Path;

use super::{Result, reach_default, write_lock};
use crate::actions::inbox::{self as edits, RemovedImage};
use crate::files::inbox::Inbox;

/// Takes the image at `image` out of the note file or proposal file at `file`, both from the top
/// level, over the file read at `previous`: the lines linking it go, and its file stays, for `ura
/// inbox clean` or a commit to delete. Gives the inbox, whose note no longer has it, and what Undo
/// takes back.
pub fn remove_note_image(
    repo: &Path,
    file: &str,
    image: &str,
    previous: &str,
) -> Result<(Inbox, RemovedImage)> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    let removed = edits::remove_image(&place, file, image, previous)?;
    Ok((edits::read(&place), removed))
}

/// Takes back an image's removal: its lines go back where they were, over the file as it is now.
/// Refused once the lines there changed, or the file links the image again.
pub fn restore_note_image(repo: &Path, removed: &RemovedImage) -> Result<Inbox> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    edits::restore_image(&place, removed)?;
    Ok(edits::read(&place))
}
