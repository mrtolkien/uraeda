//! A note with an image, added in one call: a note file's folder holding the note and the image,
//! linked from the inbox, all written or none, as the attachments decision keeps an image with the
//! file that links it.

use std::fs;

use crate::files::inbox::{self, Inbox};
use crate::files::markdown::Document;
use crate::files::proposal;
use crate::images::Encoded;
use crate::workspace::resolve;

use super::super::expand::{self, NOTES};
use super::super::place::Place;
use super::super::{ActionError, attach};
use super::{Marks, PATH, checked_note, current, no_note};

/// An image a note takes: as [`crate::images::encode`] checked and encoded it, and its original
/// file name, `None` for a pasted image.
pub type NoteImage = (Encoded, Option<String>);

/// Adds a note as a new note file's folder, `specs/notes/<slug>/note.md` or the next free name,
/// over the inbox read at `previous`: the file, freeform, holds the note as its title, then the
/// images' links in order; the images are in its `images/`; and the note links the file at the end
/// of its category. A failed write takes back what was written. Returns the note file's path.
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
    new_note_file(place, &current, &title, &[], images, |link| {
        let line = inbox::note_line(marks.agent, marks.about.as_deref(), link);
        inbox::add(&current, category, &line).0
    })
}

/// Adds images to a note of the inbox, over the inbox read at `previous`, and returns the note file
/// that holds them, from the top level. A note with a note file has its images in that file, linked
/// at its end. Another note gets a note file's folder holding its text, its sub-items,
/// and the images, and links it from its own place, its marks kept. A failed write takes back the
/// file it made.
pub fn attach_to_note(
    place: &Place,
    id: &str,
    images: &[NoteImage],
    previous: &str,
) -> Result<String, ActionError> {
    let current = current(place, PATH, previous)?;
    let note = inbox::note(&current, id).ok_or_else(|| no_note(id))?;
    if let Some(file) = note.file() {
        return into_file(place, &file, images);
    }
    let (title, nested) = inbox::note_file_parts(&current, id).ok_or_else(|| no_note(id))?;
    new_note_file(place, &current, &title, &nested, images, |link| {
        inbox::relink(&current, id, link).unwrap_or_else(|| current.clone())
    })
}

/// Makes a note file's folder named after `title`, holding it, the `nested` lines, and `images`,
/// then writes the inbox that `linked` makes from the link to its `note.md`. Returns that file's
/// path.
fn new_note_file(
    place: &Place,
    current: &str,
    title: &str,
    nested: &[String],
    images: &[NoteImage],
    linked: impl FnOnce(&str) -> String,
) -> Result<String, ActionError> {
    let folder = format!("{NOTES}/{}", expand::free_name(place, NOTES, title));
    let path = format!("{folder}/note.md");
    fs::create_dir_all(place.root.join(NOTES))?;
    // `create_dir` claims the name, even when another process claims it at the same time.
    fs::create_dir(place.root.join(&folder))?;
    let written = write_note_file(place, &folder, &path, title, nested, images).and_then(|()| {
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

/// Adds `images` to the note file at `path`, a folder's `note.md` or a single file that becomes a
/// folder, linked at its end, or at the end of its What for one older tools wrote from the proposal
/// template. Returns the file's path once it is a folder's.
fn into_file(place: &Place, path: &str, images: &[NoteImage]) -> Result<String, ActionError> {
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
    fs::write(place.root.join(&path), proposal::with_images(&text, &links))?;
    Ok(path)
}

/// Writes the note file at `path` in its new `folder`: the images first, then the file, freeform,
/// the note as its title, its `nested` lines, and the images' links at its end.
fn write_note_file(
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
    let text = proposal::with_images(&expand::from_note(path, title, nested), &links);
    fs::write(place.root.join(path), text)?;
    Ok(())
}

/// The inbox with each note's `images`: those its note file links, in order, from the top level.
/// `file_text` reads a note file, from the top level, wherever the caller reads files.
pub fn with_images(mut inbox: Inbox, file_text: impl Fn(&str) -> Option<String>) -> Inbox {
    for note in inbox.categories.iter_mut().flat_map(|c| &mut c.notes) {
        let Some(file) = &note.file else { continue };
        let Some(text) = file_text(file) else {
            continue;
        };
        let folder = file.rsplit_once('/').map_or("", |(folder, _)| folder);
        note.images = Document::parse(&text)
            .links
            .iter()
            .filter(|link| link.image && !link.wiki)
            .filter_map(|link| resolve(folder, &link.target))
            .collect();
    }
    inbox
}
