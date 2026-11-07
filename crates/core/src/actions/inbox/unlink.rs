//! An image taken out of a note: the lines linking it leave the note's file, written over the
//! file read at `previous`. The image's file stays: `ura inbox clean`, or a commit of the folder,
//! deletes it once nothing links it.

use std::fs;

use crate::files::document::hash;
use crate::files::image_links::without_image;
use crate::workspace::resolve;

use super::super::place::Place;
use super::super::{ActionError, STALE};
use super::moves::file_text;

/// An image's file name, as the refusals name it.
fn name(image: &str) -> &str {
    image.rsplit('/').next().unwrap_or(image)
}

/// A file's path from `specs/`, as the refusals name it.
fn shown(file: &str) -> &str {
    file.strip_prefix("specs/").unwrap_or(file)
}

/// `text`, the file at `file`, without its links to `image`, both from the top level, or `None`
/// when it links none.
fn unlinked(text: &str, file: &str, image: &str) -> Option<String> {
    let folder = file.rsplit_once('/').map_or("", |(folder, _)| folder);
    without_image(text, |target| {
        resolve(folder, target).as_deref() == Some(image)
    })
}

/// Takes the image at `image`, from the top level, out of the file at `file`, read at
/// `previous`: every link to it goes, and a line left empty with it. Refused when the file
/// changed since, when it links no such image, or when it is no note file or proposal file.
pub fn remove_image(
    place: &Place,
    file: &str,
    image: &str,
    previous: &str,
) -> Result<(), ActionError> {
    let text = file_text(place, file)?;
    if hash(&text) != previous {
        return Err(ActionError::Refused(format!("{} {STALE}", shown(file))));
    }
    let edited = unlinked(&text, file, image).ok_or_else(|| {
        ActionError::Refused(format!("{} does not link {}", shown(file), name(image)))
    })?;
    fs::write(place.root.join(file), &edited)?;
    Ok(())
}
