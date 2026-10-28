//! An image taken out of a note: the lines linking it leave the note's draft, written over the
//! draft read at `previous`; and its Undo, which puts them back over the draft as it is now. The
//! image's file stays: `ura inbox clean`, or a commit of the folder, deletes it once nothing links
//! it, and Undo links it again meanwhile.

use std::fs;

use crate::files::image_links::without_image;
use crate::workspace::resolve;

use super::super::ActionError;
use super::super::place::Place;
use super::{current, draft_text};

/// What taking an image out of a draft wrote, which its Undo takes back: the draft's `before`
/// lines from its line `at`, and the `after` lines written in their place. Both hold a line of
/// the draft around the change where it has one, which the Undo finds unchanged.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RemovedImage {
    /// The draft, from the top level.
    pub draft: String,
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

/// The folder of the file at `path`, from the top level.
fn folder(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(folder, _)| folder)
}

/// Whether `text`, the draft at `draft`, links `image`, from the top level.
fn links(text: &str, draft: &str, image: &str) -> bool {
    without_image(text, |target| {
        resolve(folder(draft), target).as_deref() == Some(image)
    })
    .is_some()
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

/// Takes the image at `image`, from the top level, out of the draft at `draft`, read at
/// `previous`: every link to it goes, and a line left empty with it. Refused when the draft
/// changed since, when it links no such image, or when it is no draft or backlog file.
pub fn remove_image(
    place: &Place,
    draft: &str,
    image: &str,
    previous: &str,
) -> Result<RemovedImage, ActionError> {
    draft_text(place, draft)?;
    let text = current(place, draft, previous)?;
    let edited = without_image(&text, |target| {
        resolve(folder(draft), target).as_deref() == Some(image)
    })
    .ok_or_else(|| {
        let file = draft.strip_prefix("specs/").unwrap_or(draft);
        ActionError::Refused(format!("{file} does not link {}", name(image)))
    })?;
    fs::write(place.root.join(draft), &edited)?;
    let (at, before, after) = changed(&text, &edited);
    Ok(RemovedImage {
        draft: draft.to_string(),
        image: image.to_string(),
        at: at as u32,
        before,
        after,
    })
}

/// Takes back an image's removal: its lines go back where they were, over the draft as it is now,
/// so an edit elsewhere is kept. Refused once the lines there changed, or the draft links the
/// image again.
pub fn restore_image(place: &Place, removed: &RemovedImage) -> Result<(), ActionError> {
    let text = draft_text(place, &removed.draft)?;
    let mut lines: Vec<&str> = text.split('\n').collect();
    let at = removed.at as usize;
    let end = at + removed.after.len();
    let unchanged = lines.get(at..end).is_some_and(|there| {
        there
            .iter()
            .copied()
            .eq(removed.after.iter().map(String::as_str))
    });
    if !unchanged || links(&text, &removed.draft, &removed.image) {
        let file = removed
            .draft
            .strip_prefix("specs/")
            .unwrap_or(&removed.draft);
        return Err(ActionError::Refused(format!(
            "Could not undo: {file} changed where {} was.",
            name(&removed.image)
        )));
    }
    lines.splice(at..end, removed.before.iter().map(String::as_str));
    fs::write(place.root.join(&removed.draft), lines.join("\n"))?;
    Ok(())
}
