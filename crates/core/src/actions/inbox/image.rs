//! A note with an image, added in one call: a draft folder holding the note and the image, linked
//! from the inbox, all written or none, as the attachments decision keeps an image with the file
//! that links it.

use std::fs;

use crate::files::{inbox, proposal};
use crate::images::Encoded;

use super::super::place::Place;
use super::super::{ActionError, attach, draft};
use super::{Marks, PATH, checked_note, current};

/// Adds a note as a new draft folder, `specs/drafts/<slug>/proposal.md` or the next free name,
/// over the inbox read at `previous`: the draft holds the note as its title and What, then the
/// image's link; the image, `(encoded, its original name)`, is in its `images/`; and the note links
/// the draft at the end of its category. A failed write takes back what was written. Returns the
/// draft's path.
pub fn add_with_image(
    place: &Place,
    category: Option<&str>,
    marks: &Marks,
    text: &str,
    image: (&Encoded, Option<&str>),
    previous: &str,
) -> Result<String, ActionError> {
    checked_note(marks, text)?;
    let current = current(place, PATH, previous)?;
    let title = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let free = draft::free_path(place, &title);
    let folder = free.strip_suffix(".md").unwrap_or(&free).to_string();
    let path = format!("{folder}/proposal.md");
    fs::create_dir_all(place.root.join("specs/drafts"))?;
    // `create_dir` claims the name, even when another process claims it at the same time.
    fs::create_dir(place.root.join(&folder))?;
    let written = write_draft(place, &folder, &path, &title, image).and_then(|()| {
        let link = inbox::link_to(&title, path.trim_start_matches("specs/"));
        let line = inbox::note_line(marks.agent, marks.about.as_deref(), &link);
        let (edited, _) = inbox::add(&current, category, &line);
        fs::write(place.root.join(PATH), edited).map_err(|error| {
            let _ = fs::write(place.root.join(PATH), &current);
            ActionError::from(error)
        })
    });
    if let Err(error) = written {
        let _ = fs::remove_dir_all(place.root.join(&folder));
        return Err(error);
    }
    Ok(path)
}

/// Writes the draft at `path` in its new `folder`: the image first, then the proposal with the
/// image's link at the end of its What.
fn write_draft(
    place: &Place,
    folder: &str,
    path: &str,
    title: &str,
    (encoded, name): (&Encoded, Option<&str>),
) -> Result<(), ActionError> {
    let link = attach::save_in(place, folder, encoded, name, crate::today::stamp)?;
    let text = proposal::append_to_what(&draft::from_note(path, title, &[]), &[link])
        .ok_or_else(|| ActionError::Refused("no proposal template".to_string()))?;
    fs::write(place.root.join(path), text)?;
    Ok(())
}
