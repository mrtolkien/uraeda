//! A note with an image, added in one call: a draft folder holding the note and the image, linked
//! from the inbox, all written or none, as the attachments decision keeps an image with the file
//! that links it.

use std::fs;

use crate::files::{inbox, proposal};
use crate::images::Encoded;

use super::super::place::Place;
use super::super::{ActionError, attach, draft};
use super::{Marks, PATH, checked_note, current, no_note};

/// An image a note takes: as [`crate::images::encode`] checked and encoded it, and its original
/// file name, `None` for a pasted image.
pub type NoteImage = (Encoded, Option<String>);

/// Adds a note as a new draft folder, `specs/drafts/<slug>/proposal.md` or the next free name,
/// over the inbox read at `previous`: the draft holds the note as its title and What, then the
/// images' links in order; the images are in its `images/`; and the note links the draft at the end
/// of its category. A failed write takes back what was written. Returns the draft's path.
pub fn add_with_image(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    images: &[NoteImage],
    previous: &str,
) -> Result<String, ActionError> {
    checked_note(marks, text)?;
    let current = current(place, PATH, previous)?;
    let title = text.split_whitespace().collect::<Vec<_>>().join(" ");
    new_draft(place, &current, &title, &[], images, |link| {
        let line = inbox::note_line(marks.agent, marks.about.as_deref(), link);
        inbox::add(&current, category, &line).0
    })
}

/// Adds images to a note of the inbox, over the inbox read at `previous`, and returns the draft
/// that holds them, from the top level. A note that links a draft has its images in that draft,
/// linked at the end of its What. Another note becomes a draft folder holding its text, its
/// sub-items, and the images, and links it from its own place, its marks kept. A failed write
/// takes back the draft it made.
pub fn attach_to_note(
    place: &Place,
    id: &str,
    images: &[NoteImage],
    previous: &str,
) -> Result<String, ActionError> {
    let current = current(place, PATH, previous)?;
    let note = inbox::note(&current, id).ok_or_else(|| no_note(id))?;
    if let Some(draft) = note.draft() {
        return into_draft(place, &draft, images);
    }
    let (title, nested) = inbox::draft_parts(&current, id).ok_or_else(|| no_note(id))?;
    new_draft(place, &current, &title, &nested, images, |link| {
        inbox::relink(&current, id, link).unwrap_or_else(|| current.clone())
    })
}

/// Makes a draft folder named after `title`, holding it, the `nested` lines, and `images`, then
/// writes the inbox that `linked` makes from the link to its proposal. Returns the proposal's path.
fn new_draft(
    place: &Place,
    current: &str,
    title: &str,
    nested: &[String],
    images: &[NoteImage],
    linked: impl FnOnce(&str) -> String,
) -> Result<String, ActionError> {
    let free = draft::free_path(place, title);
    let folder = free.strip_suffix(".md").unwrap_or(&free).to_string();
    let path = format!("{folder}/proposal.md");
    fs::create_dir_all(place.root.join("specs/drafts"))?;
    // `create_dir` claims the name, even when another process claims it at the same time.
    fs::create_dir(place.root.join(&folder))?;
    let written = write_draft(place, &folder, &path, title, nested, images).and_then(|()| {
        let link = inbox::link_to(title, path.trim_start_matches("specs/"));
        fs::write(place.root.join(PATH), linked(&link)).map_err(|error| {
            let _ = fs::write(place.root.join(PATH), current);
            ActionError::from(error)
        })
    });
    if let Err(error) = written {
        let _ = fs::remove_dir_all(place.root.join(&folder));
        return Err(error);
    }
    Ok(path)
}

/// Adds `images` to the draft at `path`, a folder's proposal or a single file that becomes a
/// folder, linked at the end of its What. Returns the draft's path once it is a folder's.
fn into_draft(place: &Place, path: &str, images: &[NoteImage]) -> Result<String, ActionError> {
    let mut path = path.to_string();
    let mut links = Vec::new();
    for (encoded, name) in images {
        let attached = attach::attach(place, &path, encoded, name.as_deref(), crate::today::stamp)?;
        if let Some(moved) = attached.moved {
            path = moved;
        }
        links.push(attached.link);
    }
    let text = fs::read_to_string(place.root.join(&path))?;
    let edited = with_links(&text, links)
        .ok_or_else(|| ActionError::Refused(format!("{path} has no ## What section")))?;
    fs::write(place.root.join(&path), edited)?;
    Ok(path)
}

/// The links as paragraphs, one image each, the first after a blank line: right after a list item,
/// it would read as part of the item.
fn stacked(links: Vec<String>) -> Vec<String> {
    links
        .into_iter()
        .flat_map(|link| [String::new(), link])
        .collect()
}

/// The text of `what` with the images' `links` at the end of its What, set off from what comes
/// before them by one blank line, whether that is a paragraph or a list.
fn with_links(what: &str, links: Vec<String>) -> Option<String> {
    let first = links.first()?.clone();
    let edited = proposal::append_to_what(what, &stacked(links))?;
    Some(edited.replacen(&format!("\n\n\n{first}"), &format!("\n\n{first}"), 1))
}

/// Writes the draft at `path` in its new `folder`: the images first, then the proposal, with the
/// note's `nested` lines, and the images' links at the end of its What.
fn write_draft(
    place: &Place,
    folder: &str,
    path: &str,
    title: &str,
    nested: &[String],
    images: &[NoteImage],
) -> Result<(), ActionError> {
    let mut links = Vec::new();
    for (encoded, name) in images {
        links.push(attach::save_in(
            place,
            folder,
            encoded,
            name.as_deref(),
            crate::today::stamp,
        )?);
    }
    let text = with_links(&draft::from_note(path, title, nested), links)
        .ok_or_else(|| ActionError::Refused("no proposal template".to_string()))?;
    fs::write(place.root.join(path), text)?;
    Ok(())
}
