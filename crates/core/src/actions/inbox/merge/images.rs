//! The images of a note file a merge adds to a proposal file: found in the note file's folder,
//! copied beside the proposal file, and the copies deleted when the merge or its Undo takes them
//! back.

use std::fs;

use super::super::super::ActionError;
use super::super::super::attach;
use super::super::super::images::{folder_of, in_place};
use super::super::super::place::Place;
use super::parent;

/// The images of the note file at `path`, from the top level: the files of its folder's `images/`.
/// Refused when its folder holds anything else than the note and its images, which the add would
/// take away, or goes through a symbolic link.
pub(super) fn images_of(place: &Place, path: &str) -> Result<Vec<String>, ActionError> {
    let Some(folder) = folder_of(path) else {
        return Ok(Vec::new());
    };
    let refused = |what: &str| {
        ActionError::Refused(format!(
            "{folder} holds {what}: move it out of the folder first."
        ))
    };
    if !in_place(&place.root, folder) {
        return Err(ActionError::Refused(format!(
            "{folder} is a symbolic link: the note was not added."
        )));
    }
    let main = path.rsplit('/').next().unwrap_or(path);
    let mut images = Vec::new();
    for entry in fs::read_dir(place.root.join(folder))?.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let kind = entry.file_type()?;
        if name == main && kind.is_file() {
            continue;
        }
        if name != "images" || !kind.is_dir() {
            return Err(refused(&name));
        }
        for image in fs::read_dir(entry.path())?.flatten() {
            let image_name = image.file_name().to_string_lossy().into_owned();
            if !image.file_type()?.is_file() {
                return Err(refused(&format!("images/{image_name}")));
            }
            images.push(format!("{folder}/images/{image_name}"));
        }
    }
    images.sort();
    Ok(images)
}

/// Copies each image of `images` into the `images/` of `folder`, renamed when its name is taken
/// there. Returns each one's path and its copy's, or deletes the copies made when one fails.
pub(super) fn copy_images(
    place: &Place,
    images: &[String],
    folder: &str,
) -> Result<Vec<(String, String)>, ActionError> {
    let mut copied: Vec<(String, String)> = Vec::new();
    for image in images {
        let name = image.rsplit('/').next().unwrap_or(image);
        let (base, extension) = name.rsplit_once('.').unwrap_or((name, ""));
        let result = fs::read(place.root.join(image))
            .map_err(ActionError::from)
            .and_then(|bytes| attach::save_bytes(&place.root, folder, base, extension, &bytes));
        match result {
            Ok(saved) => copied.push((image.clone(), format!("{folder}/images/{saved}"))),
            Err(error) => {
                remove_copies(place, &copied);
                return Err(error);
            }
        }
    }
    Ok(copied)
}

/// Deletes the copies of `copied`, and their `images/` once empty.
pub(super) fn remove_copies(place: &Place, copied: &[(String, String)]) {
    for (_, copy) in copied {
        let _ = fs::remove_file(place.root.join(copy));
    }
    if let Some((_, copy)) = copied.first() {
        let _ = fs::remove_dir(place.root.join(parent(copy)));
    }
}
