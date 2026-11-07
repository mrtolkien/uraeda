//! A note with a note file added to a proposal file: the note file's text goes into the proposal
//! file's `## Notes`, as a subsection titled by the note, its images beside the proposal file, then
//! the note file and the note's row leave, the relinked files held for Discard, which puts them
//! back. A proposal of the priorities without a file gets its file first.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::files::inbox;
use crate::files::markdown::Document;
use crate::files::priorities::Proposal;
use crate::files::proposal;
use crate::files::retarget;
use crate::moves::{Move, Went};

use super::super::ActionError;
use super::super::attach::{self, LISTS, SPECS};
use super::super::expand::{self, INBOX_FOLDER, PROPOSALS};
use super::super::images::folder_of;
use super::super::place::Place;
use super::super::priorities::PATH as PRIORITIES;
use super::super::relink::{self, Relinked};
use super::{PATH, no_note, note_file, write_both};
use images::{copy_images, images_of, remove_copies};

mod images;

/// An add of a note file to a proposal file, what Discard puts back: the repository's root, the
/// note file, the proposal file as it is now, and the files of `specs/` whose links the add
/// pointed at the note's subsection and the images' copies.
struct Merged {
    root: PathBuf,
    note: String,
    proposal: String,
    relinked: Vec<Relinked>,
}

/// The adds of note files to proposal files, newest last, for Discard. Only the latest few are
/// kept.
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

/// The anchor, numbered as GitHub numbers it, of the subsection the add inserted in the proposal
/// file, `before` then `after`: the first `###` heading from the first heading `before` lacks, past
/// a `## Notes` the add wrote.
fn inserted_anchor(before: &str, after: &str) -> Option<String> {
    let before = Document::parse(before).anchor_list();
    let after = Document::parse(after);
    let anchors = after.anchor_list();
    let new = (0..anchors.len()).find(|&at| before.get(at) != Some(&anchors[at]))?;
    after
        .headings
        .iter()
        .zip(anchors)
        .skip(new)
        .find(|(heading, _)| heading.level == 3)
        .map(|(_, anchor)| anchor)
}

/// Points the links of every file of `specs/` but the lists, the note file `file`, and the
/// proposal file `target` at where the add
/// put them: the note file, and its folder when it has one, at its subsection, `anchor`, of
/// `target`, and each image of `copied` at its copy. Then the note file leaves, held for Discard;
/// when it cannot, the links go back.
fn relink_and_remove(
    place: &Place,
    file: &str,
    target: &str,
    anchor: Option<String>,
    copied: &[(String, String)],
) -> Result<Vec<Relinked>, ActionError> {
    let to_subsection = |from: &str| Move {
        from: from.to_string(),
        went: Went::Moved {
            path: target.to_string(),
            anchor: anchor.clone(),
        },
    };
    let mut moves = vec![to_subsection(file)];
    moves.extend(copied.iter().map(|(from, to)| relink::moved(from, to)));
    moves.extend(folder_of(file).map(to_subsection));
    let skip = [LISTS[0], LISTS[1], file, target];
    let relinked = relink::relink(&place.root, SPECS, &moves, &skip)?;
    if let Err(error) = note_file::remove(place, file) {
        relink::put_back(&place.root, &relinked);
        return Err(error);
    }
    Ok(relinked)
}

/// Adds the note `id` of the inbox text `inbox`, whose note file is `file`, to the proposal file at
/// `proposal`, whose text is `text`: the note file's text, as [`proposal::note_subsection`] gives
/// it, at the end of the proposal file's `## Notes`, its images copied beside it, a single proposal
/// file made a folder for them first; then the links of every file of `specs/` follow, and the
/// note's row and its note file leave, held for Discard. Returns the proposal file's path, its
/// folder's main file when it became one. Nothing is left half written when a step fails.
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
    let (target, foldered) = match &single {
        Some(single) => attach::to_folder(place, single)?,
        None => (proposal.to_string(), Vec::new()),
    };
    // The inbox as the lists' links to a single proposal file made a folder left it.
    let linked = match &single {
        Some(single) => retarget::retarget(inbox, single, &target),
        None => inbox.to_string(),
    };
    // Takes back what was done so far when a later step fails: the copies, then the folder, and
    // the links it relinked, a file edited before included.
    let back = |copied: &[(String, String)]| {
        remove_copies(place, copied);
        if let Some(single) = &single
            && let Ok(true) = attach::to_file(place, &target, single)
        {
            relink::put_back(&place.root, &foldered);
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
    let anchor = inserted_anchor(text, &edited);
    let relinked = match relink_and_remove(place, file, &target, anchor, &copied) {
        Ok(relinked) => relinked,
        Err(error) => {
            let _ = fs::write(place.root.join(&target), text);
            let _ = fs::write(place.root.join(PATH), &linked);
            back(&copied);
            return Err(error);
        }
    };
    let root = root_of(place);
    let mut held = merged();
    held.retain(|kept| !(kept.root == root && kept.note == file));
    held.push(Merged {
        root,
        note: file.to_string(),
        proposal: target.clone(),
        relinked,
    });
    let over = held.len().saturating_sub(KEPT);
    held.drain(..over);
    Ok(target)
}

/// Adds the note `id` of the inbox text `inbox`, whose note file is `file`, to the proposal `line`
/// of the priorities text `priorities`, which links no file: the line gets its proposal file
/// first, as expanding it writes one (see [`expand::expanded`]), under a free name in
/// `specs/proposals/`, a folder's `proposal.md` when the note file has images for it, and links
/// it; then the note goes into it, as [`merge`] adds it to any proposal file. Returns the proposal file's path. Nothing is
/// left half written when a step fails.
pub(super) fn into_new(
    place: &Place,
    inbox: &str,
    priorities: &str,
    id: &str,
    file: &str,
    line: &Proposal,
) -> Result<String, ActionError> {
    let images = images_of(place, file)?;
    let name = expand::free_name(place, PROPOSALS, &line.text);
    let path = if images.is_empty() {
        format!("{PROPOSALS}/{name}.md")
    } else {
        format!("{PROPOSALS}/{name}/proposal.md")
    };
    let (written, linked) = expand::expanded(priorities, line, &path)?;
    let full = place.root.join(&path);
    fs::create_dir_all(full.parent().unwrap_or(&place.root))?;
    // `create_new` claims the name, even when another process claims it at the same time.
    let made = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&full)
        .and_then(|mut new| std::io::Write::write_all(&mut new, written.as_bytes()));
    // Takes back the file, and its folder once empty.
    let remove = || {
        let _ = fs::remove_file(&full);
        if let Some(folder) = folder_of(&path) {
            let _ = fs::remove_dir(place.root.join(folder));
        }
    };
    if let Err(error) = made {
        remove();
        return Err(error.into());
    }
    if let Err(error) = fs::write(place.root.join(PRIORITIES), &linked) {
        let _ = fs::write(place.root.join(PRIORITIES), priorities);
        remove();
        return Err(error.into());
    }
    let target = match merge(place, inbox, id, file, &path, &written) {
        Ok(target) => target,
        Err(error) => {
            let _ = fs::write(place.root.join(PRIORITIES), priorities);
            remove();
            return Err(error);
        }
    };
    Ok(target)
}

/// Discard's end of the held adds to the proposal file at `proposal`: the files of `specs/` they
/// relinked to the note's subsection and the images' copies are put back, each while it holds what
/// the add wrote, newest add first, and the adds are no longer held. Discard takes the note's text
/// out of the proposal file and brings the note file back, so their links go back to it.
pub(crate) fn put_back_links(place: &Place, proposal: &str) {
    let root = root_of(place);
    let ended: Vec<Merged> = {
        let mut held = merged();
        let (ended, kept) = held
            .drain(..)
            .partition(|kept| kept.root == root && kept.proposal == proposal);
        *held = kept;
        ended
    };
    for add in ended.iter().rev() {
        relink::put_back(&place.root, &add.relinked);
    }
}
