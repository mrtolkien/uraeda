//! An image taken out of a note: the lines linking it leave the note's file, written over the
//! file read at `previous`; and its Undo, which puts them back over the file as it is now. The
//! image's file stays: `ura inbox clean`, or a commit of the folder, deletes it once nothing links
//! it, and Undo links it again meanwhile.

use std::fs;

use crate::files::document::hash;
use crate::files::image_links::without_image;
use crate::workspace::resolve;

use super::super::place::Place;
use super::super::{ActionError, STALE};
use super::moves::file_text;

/// What taking an image out of a file wrote, which its Undo takes back: the file's `before`
/// lines from its line `at`, and the `after` lines written in their place. Both hold a line of
/// the file around the change where it has one, which the Undo finds unchanged.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemovedImage {
    /// The note file or proposal file, from the top level.
    pub file: String,
    /// The image, from the top level.
    pub image: String,
    pub at: u32,
    pub before: Vec<String>,
    pub after: Vec<String>,
}

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

/// The lines `before` and `after` differ in, from the first that differs, with a line on each
/// side where there is one: the line they start at, and both runs of lines.
fn changed(before: &str, after: &str) -> (usize, Vec<String>, Vec<String>) {
    let old: Vec<&str> = before.split('\n').collect();
    let new: Vec<&str> = after.split('\n').collect();
    let same = old.iter().zip(&new).take_while(|(a, b)| a == b).count();
    let room = old.len().min(new.len()) - same;
    let tail = old
        .iter()
        .rev()
        .zip(new.iter().rev())
        .take(room)
        .take_while(|(a, b)| a == b)
        .count();
    let at = same.saturating_sub(1);
    let ends = |lines: &[&str]| (lines.len() - tail + 1).min(lines.len());
    let run = |lines: &[&str]| {
        lines[at..ends(lines)]
            .iter()
            .map(|l| l.to_string())
            .collect()
    };
    (at, run(&old), run(&new))
}

/// Takes the image at `image`, from the top level, out of the file at `file`, read at
/// `previous`: every link to it goes, and a line left empty with it. Refused when the file
/// changed since, when it links no such image, or when it is no note file or proposal file.
pub fn remove_image(
    place: &Place,
    file: &str,
    image: &str,
    previous: &str,
) -> Result<RemovedImage, ActionError> {
    let text = file_text(place, file)?;
    if hash(&text) != previous {
        return Err(ActionError::Refused(format!("{} {STALE}", shown(file))));
    }
    let edited = unlinked(&text, file, image).ok_or_else(|| {
        ActionError::Refused(format!("{} does not link {}", shown(file), name(image)))
    })?;
    fs::write(place.root.join(file), &edited)?;
    let (at, before, after) = changed(&text, &edited);
    Ok(RemovedImage {
        file: file.to_string(),
        image: image.to_string(),
        at: at as u32,
        before,
        after,
    })
}

/// Takes back an image's removal: its lines go back where they were, over the file as it is now,
/// so an edit elsewhere is kept. Refused once the lines there changed, or the file links the
/// image again.
pub fn restore_image(place: &Place, removed: &RemovedImage) -> Result<(), ActionError> {
    let text = file_text(place, &removed.file)?;
    let mut lines: Vec<&str> = text.split('\n').collect();
    let at = removed.at as usize;
    let end = at + removed.after.len();
    let unchanged = lines.get(at..end).is_some_and(|there| {
        there
            .iter()
            .copied()
            .eq(removed.after.iter().map(String::as_str))
    });
    if !unchanged || unlinked(&text, &removed.file, &removed.image).is_some() {
        return Err(ActionError::Refused(format!(
            "Could not undo: {} changed where {} was.",
            shown(&removed.file),
            name(&removed.image)
        )));
    }
    lines.splice(at..end, removed.before.iter().map(String::as_str));
    fs::write(place.root.join(&removed.file), lines.join("\n"))?;
    Ok(())
}
