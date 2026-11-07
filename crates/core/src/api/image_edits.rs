//! A note's image taken out of its file, written on the default branch.

use std::path::Path;

use super::{Result, reach_default, write_lock};
use crate::actions::inbox as edits;
use crate::files::inbox::Inbox;

/// Takes the image at `image` out of the note file or proposal file at `file`, both from the top
/// level, over the file read at `previous`: the lines linking it go, and its file stays, for `ura
/// inbox clean` or a commit to delete. Gives the inbox, whose note no longer has it.
pub fn remove_note_image(repo: &Path, file: &str, image: &str, previous: &str) -> Result<Inbox> {
    let _lock = write_lock(repo);
    let place = reach_default(repo)?;
    edits::remove_image(&place, file, image, previous)?;
    Ok(edits::read(&place))
}
