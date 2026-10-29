//! A note with a note file added to a proposal file: the note file's text goes into the proposal
//! file's `## Notes`, as a subsection titled by the note, its images beside the proposal file, then
//! the note file and the note's row leave, all held for the add's Undo, which puts each back.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::files::inbox;
use crate::files::proposal;
use crate::files::retarget;

use super::super::ActionError;
use super::super::attach;
use super::super::expand::INBOX_FOLDER;
use super::super::images::{folder_of, in_place};
use super::super::place::Place;
use super::{PATH, no_note, note_file, write_both};

/// An add of a note file to a proposal file, what its Undo takes back: the repository's root, the
/// note file, the proposal file as it is now, the single file it was when the add made it a folder
/// for the images, the text the add inserted, and each image's path in the note file's folder and
/// beside the proposal file.
struct Merged {
    root: PathBuf,
    note: String,
    proposal: String,
    single: Option<String>,
    inserted: String,
    images: Vec<(String, String)>,
}

/// The adds of note files to proposal files, newest last. Only the latest few are kept: an Undo
/// comes right after its add.
static MERGED: Mutex<Vec<Merged>> = Mutex::new(Vec::new());

/// How many adds [`MERGED`] keeps.
const KEPT: usize = 16;

fn merged() -> std::sync::MutexGuard<'static, Vec<Merged>> {
    MERGED
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The root an add is held under: the same for every path to the checkout.
fn root_of(place: &Place) -> PathBuf {
    fs::canonicalize(&place.root).unwrap_or_else(|_| place.root.clone())
}

/// The folder of a path from the top level.
fn parent(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(folder, _)| folder)
}

/// The images of the note file at `path`, from the top level: the files of its folder's `images/`.
/// Refused when its folder holds anything else than the note and its images, which the add would
/// take away, or goes through a symbolic link.
fn images_of(place: &Place, path: &str) -> Result<Vec<String>, ActionError> {
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
fn copy_images(
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
fn remove_copies(place: &Place, copied: &[(String, String)]) {
    for (_, copy) in copied {
        let _ = fs::remove_file(place.root.join(copy));
    }
    if let Some((_, copy)) = copied.first() {
        let _ = fs::remove_dir(place.root.join(parent(copy)));
    }
}

/// The text the add inserted: what `after` holds that `before` does not, `before` being `after`
/// without one run of it.
fn inserted(before: &str, after: &str) -> String {
    let mut start = before
        .bytes()
        .zip(after.bytes())
        .take_while(|(a, b)| a == b)
        .count();
    while !after.is_char_boundary(start) {
        start -= 1;
    }
    let most = before.len().min(after.len()) - start;
    let mut end = before
        .bytes()
        .rev()
        .zip(after.bytes().rev())
        .take(most)
        .take_while(|(a, b)| a == b)
        .count();
    while !after.is_char_boundary(after.len() - end) {
        end -= 1;
    }
    after[start..after.len() - end].to_string()
}

/// Adds the note `id` of the inbox text `inbox`, whose note file is `file`, to the proposal file at
/// `proposal`, whose text is `text`: the note file's text, as [`proposal::note_subsection`] gives
/// it, at the end of the proposal file's `## Notes`, its images copied beside it, a single proposal
/// file made a folder for them first; then the note's row and its note file leave, held for
/// [`undo`]. Returns the proposal file's path, its folder's main file when it became one. Nothing
/// is left half written when a step fails.
pub(super) fn merge(
    place: &Place,
    inbox: &str,
    id: &str,
    file: &str,
    proposal: &str,
    text: &str,
) -> Result<String, ActionError> {
    let unit = note_file::unit(file);
    if proposal == file || proposal.starts_with(&format!("{unit}/")) {
        return Err(ActionError::Refused(format!(
            "A note cannot go into its own note file, {proposal}."
        )));
    }
    let title = inbox::link_title(inbox, id).ok_or_else(|| no_note(id))?;
    let (_, nested) = inbox::note_file_parts(inbox, id).ok_or_else(|| no_note(id))?;
    let without = inbox::remove(inbox, id).ok_or_else(|| no_note(id))?;
    let note = fs::read_to_string(place.root.join(file))?;
    let images = images_of(place, file)?;

    let single = (!images.is_empty() && attach::is_single(proposal)).then(|| proposal.to_string());
    let target = match &single {
        Some(single) => attach::to_folder(place, single)?,
        None => proposal.to_string(),
    };
    // The inbox as the lists' links to a single proposal file made a folder left it.
    let linked = match &single {
        Some(single) => retarget::retarget(inbox, single, &target),
        None => inbox.to_string(),
    };
    // Takes back what was done so far when a later step fails: the copies, then the folder.
    let back = |copied: &[(String, String)]| {
        remove_copies(place, copied);
        if let Some(single) = &single {
            let _ = attach::to_file(place, &target, single);
        }
    };
    let folder = parent(&target);
    let copied = match copy_images(place, &images, folder) {
        Ok(copied) => copied,
        Err(error) => {
            back(&[]);
            return Err(error);
        }
    };

    let subsection = proposal::note_subsection(&note, &title).join("\n");
    let mut lines: Vec<String> = retarget::relocated(&subsection, parent(file), folder, &copied)
        .split('\n')
        .map(String::from)
        .collect();
    if !nested.is_empty() {
        lines.push(String::new());
        let nested = retarget::rebase(&nested.join("\n"), INBOX_FOLDER, folder);
        lines.extend(nested.split('\n').map(String::from));
    }
    let edited = proposal::append_to_notes(text, &lines);
    let without = match &single {
        Some(single) => retarget::retarget(&without, single, &target),
        None => without,
    };
    if let Err(error) = write_both(place, &target, &edited, &without) {
        back(&copied);
        return Err(error);
    }
    if let Err(error) = note_file::remove(place, file) {
        let _ = fs::write(place.root.join(&target), text);
        let _ = fs::write(place.root.join(PATH), &linked);
        back(&copied);
        return Err(error);
    }
    let root = root_of(place);
    let mut held = merged();
    held.retain(|kept| !(kept.root == root && kept.note == file));
    held.push(Merged {
        root,
        note: file.to_string(),
        proposal: target.clone(),
        single,
        inserted: inserted(text, &edited),
        images: copied,
    });
    let over = held.len().saturating_sub(KEPT);
    held.drain(..over);
    Ok(target)
}

/// Whether an add of the note file `note_file` to the proposal file `proposal`, by its path then
/// or now, is held.
pub(super) fn is_held(place: &Place, note_file: &str, proposal: &str) -> bool {
    let root = root_of(place);
    merged().iter().any(|kept| {
        kept.root == root
            && kept.note == note_file
            && (kept.proposal == proposal || kept.single.as_deref() == Some(proposal))
    })
}

/// Takes back the held add of the note file `note_file`: the text it inserted leaves the proposal
/// file, every other edit kept, the note file comes back with its images, and the inbox becomes
/// `back`, the note's row back at its place, in one write of both files or none. Then the images'
/// copies leave, unchanged ones only, and a proposal file the add made a folder becomes a single
/// file again while nothing else was added to it. `gone` is the refusal when the inserted text is
/// no longer in the proposal file.
pub(super) fn undo(
    place: &Place,
    note_file: &str,
    back: &str,
    gone: impl Fn() -> ActionError,
) -> Result<(), ActionError> {
    let root = root_of(place);
    let (proposal, inserted, single, images) = {
        let held = merged();
        let kept = held
            .iter()
            .rfind(|kept| kept.root == root && kept.note == note_file)
            .ok_or_else(|| ActionError::Refused("Nothing to put back.".to_string()))?;
        (
            kept.proposal.clone(),
            kept.inserted.clone(),
            kept.single.clone(),
            kept.images.clone(),
        )
    };
    let written = fs::read_to_string(place.root.join(&proposal)).map_err(|_| gone())?;
    let at = written.rfind(&inserted).ok_or_else(&gone)?;
    let without = format!("{}{}", &written[..at], &written[at + inserted.len()..]);
    let unit = note_file::unit(note_file);
    if place.root.join(unit).exists() {
        return Err(ActionError::Refused(format!(
            "Could not undo: something stands at {unit} now."
        )));
    }
    if !note_file::is_held(place, note_file) {
        return Err(ActionError::Refused(format!(
            "Could not undo: the deleted {unit} can no longer be brought back."
        )));
    }
    note_file::restore(place, note_file)?;
    if let Err(error) = write_both(place, &proposal, &without, back) {
        let _ = note_file::remove(place, note_file);
        return Err(error);
    }
    merged().retain(|kept| !(kept.root == root && kept.note == note_file));
    let unchanged: Vec<(String, String)> = images
        .into_iter()
        .filter(|(from, to)| {
            let original = fs::read(place.root.join(from)).ok();
            original.is_some() && original == fs::read(place.root.join(to)).ok()
        })
        .collect();
    remove_copies(place, &unchanged);
    // The Undo is whole once both files are written: a folder that cannot become a single file
    // again stays a folder, which loses nothing.
    if let Some(single) = single {
        let _ = attach::to_file(place, &proposal, &single);
    }
    Ok(())
}
