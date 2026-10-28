//! A note's file, in `specs/notes/`: moved among the proposals as its note becomes a proposal, and
//! back by the move's Undo; and taken away with its note, its bytes held for the removal's Undo,
//! which writes them back as they were.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::files::inbox;
use crate::git::Git;

use super::super::ActionError;
use super::super::expand::{self, PROPOSALS};
use super::super::images::{folder_of, in_place};
use super::super::place::Place;

/// What a move or a removal of the note file at `path` acts on, from the top level: its folder,
/// or the file itself when it is a single file.
fn unit(path: &str) -> &str {
    folder_of(path).unwrap_or(path)
}

/// The name of a file or a folder, without `.md`.
fn stem(unit: &str) -> &str {
    let name = unit.rsplit('/').next().unwrap_or(unit);
    name.strip_suffix(".md").unwrap_or(name)
}

/// Renames `from` to `to`, both from the top level, its folder made when missing, refused when
/// `to` exists: a rename would replace it.
fn rename(place: &Place, from: &str, to: &str) -> Result<(), ActionError> {
    let target = place.root.join(to);
    if target.exists() {
        return Err(ActionError::Refused(format!("{to} exists")));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(place.root.join(from), target)?;
    Ok(())
}

/// Moves `from`, a file or a folder, to `to`, renaming the folder's main file `main` as
/// `renamed`: all of it, or none.
fn move_unit(
    place: &Place,
    from: &str,
    to: &str,
    names: Option<(&str, &str)>,
) -> Result<(), ActionError> {
    let Some((main, renamed)) = names.filter(|(main, renamed)| main != renamed) else {
        return rename(place, from, to);
    };
    if place.root.join(from).join(renamed).exists() {
        return Err(ActionError::Refused(format!("{from}/{renamed} exists")));
    }
    rename(place, from, to)?;
    if let Err(error) = rename(place, &format!("{to}/{main}"), &format!("{to}/{renamed}")) {
        let _ = fs::rename(place.root.join(to), place.root.join(from));
        return Err(error);
    }
    Ok(())
}

/// The name of a path's last part.
fn base(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

/// Moves the file at `from` to `to`, both main files from the top level, as their kinds have them:
/// a folder's main file with its whole folder, renamed, or a single file.
pub(super) fn relocate(place: &Place, from: &str, to: &str) -> Result<(), ActionError> {
    match (folder_of(from), folder_of(to)) {
        (Some(from_folder), Some(to_folder)) => {
            move_unit(place, from_folder, to_folder, Some((base(from), base(to))))?;
        }
        (None, None) => {
            move_unit(place, from, to, None)?;
        }
        _ => {
            return Err(ActionError::Refused(format!("{from} cannot move to {to}")));
        }
    }
    Ok(())
}

/// Moves the note file at `path`, from the top level, among the proposals, under a free name: its
/// folder with its images, `note.md` becoming `proposal.md`, or its single file. Returns the
/// proposal file's path.
pub(super) fn to_proposals(place: &Place, path: &str) -> Result<String, ActionError> {
    if !place.root.join(path).is_file() {
        return Err(ActionError::Refused(format!("no note file {path}")));
    }
    let name = expand::free_name(place, PROPOSALS, stem(unit(path)));
    fs::create_dir_all(place.root.join(PROPOSALS))?;
    let to = match folder_of(path) {
        Some(_) => format!("{PROPOSALS}/{name}/proposal.md"),
        None => format!("{PROPOSALS}/{name}.md"),
    };
    relocate(place, path, &to)?;
    Ok(to)
}

/// Moves the proposal file at `proposal` back to the note file it was, `note`, both from the top
/// level: the Undo of [`to_proposals`]. Refused when the proposal file is gone, or a file stands at
/// the note file's place.
pub(crate) fn back_to_notes(place: &Place, proposal: &str, note: &str) -> Result<(), ActionError> {
    if !place.root.join(proposal).is_file() {
        return Err(ActionError::Refused(format!(
            "Could not undo: {} is no longer in specs/proposals/.",
            base(unit(proposal))
        )));
    }
    relocate(place, proposal, note)
}

/// A file's path from the top level, and its bytes.
type Bytes = (String, Vec<u8>);

/// A note file a removal took away: its repository's root, its path from the top level, and its
/// files with their bytes, what the removal's Undo writes back.
struct Held {
    root: PathBuf,
    path: String,
    files: Vec<Bytes>,
}

/// The note files removals took away, newest last. Only the latest few are kept: an Undo comes
/// right after its removal.
static HELD: Mutex<Vec<Held>> = Mutex::new(Vec::new());

/// How many removed note files [`HELD`] keeps.
const KEPT: usize = 16;

fn held() -> std::sync::MutexGuard<'static, Vec<Held>> {
    HELD.lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The root a removal is held under: the same for every path to the checkout.
fn root_of(place: &Place) -> PathBuf {
    fs::canonicalize(&place.root).unwrap_or_else(|_| place.root.clone())
}

/// Every file under `dir`, from the top level, with its bytes, never through a symbolic link.
fn read_all(root: &Path, dir: &str, files: &mut Vec<Bytes>) -> Result<(), ActionError> {
    for entry in fs::read_dir(root.join(dir))?.flatten() {
        let path = format!("{dir}/{}", entry.file_name().to_string_lossy());
        let kind = entry.file_type()?;
        if kind.is_dir() {
            read_all(root, &path, files)?;
        } else if kind.is_file() {
            files.push((path.clone(), fs::read(root.join(&path))?));
        }
    }
    Ok(())
}

/// The files of the note file at `path`, with their bytes: its single file, or every file of its
/// folder.
fn files_of(place: &Place, path: &str) -> Result<Vec<Bytes>, ActionError> {
    let from = unit(path);
    if from == path {
        return Ok(vec![(path.to_string(), fs::read(place.root.join(path))?)]);
    }
    let mut files = Vec::new();
    read_all(&place.root, from, &mut files)?;
    files.sort();
    Ok(files)
}

/// The paths of the note file at `path` that `HEAD` has, from the top level: what a commit of its
/// removal holds.
pub(crate) fn committed(place: &Place, path: &str) -> Vec<String> {
    let Ok(git) = Git::open(&place.root) else {
        return Vec::new();
    };
    let Some(head) = git.head() else {
        return Vec::new();
    };
    let from = unit(path);
    if from == path {
        let tracked = git.read_file(head, path).ok().flatten().is_some();
        return if tracked {
            vec![path.to_string()]
        } else {
            Vec::new()
        };
    }
    git.list_files(head, from).unwrap_or_default()
}

/// Deletes the note file at `path`, from the top level, with its folder and images, holding their
/// bytes for [`restore`]. A folder reached through a symbolic link is never deleted.
pub(super) fn remove(place: &Place, path: &str) -> Result<(), ActionError> {
    if !place.root.join(path).is_file() {
        return Ok(());
    }
    let from = unit(path);
    if !in_place(&place.root, from) {
        return Err(ActionError::Refused(format!(
            "{from} is a symbolic link: it was not deleted"
        )));
    }
    let files = files_of(place, path)?;
    let root = root_of(place);
    {
        let mut held = held();
        held.retain(|kept| !(kept.root == root && kept.path == path));
        held.push(Held {
            root,
            path: path.to_string(),
            files,
        });
        let over = held.len().saturating_sub(KEPT);
        held.drain(..over);
    }
    if from == path {
        fs::remove_file(place.root.join(path))?;
    } else {
        fs::remove_dir_all(place.root.join(from))?;
    }
    Ok(())
}

/// Whether the files of `unit` on disk are those `HEAD` has, byte for byte, and only those: git
/// keeps them, and Discard brings them back.
fn as_committed(place: &Place, path: &str) -> bool {
    let (Ok(git), Ok(files)) = (Git::open(&place.root), files_of(place, path)) else {
        return false;
    };
    let Some(head) = git.head() else {
        return false;
    };
    let committed = committed(place, path);
    committed.len() == files.len()
        && files
            .iter()
            .all(|(file, bytes)| git.read_file(head, file).ok().flatten().as_ref() == Some(bytes))
}

/// Whether the note file at `path` holds only what a tool wrote for its note, titled `title`: its
/// file as written, with at most the note's images, and nothing else in its folder.
fn as_written(place: &Place, path: &str, title: &str) -> bool {
    let Ok(text) = fs::read_to_string(place.root.join(path)) else {
        return false;
    };
    let written = expand::from_note(path, title, &[]);
    if !crate::files::proposal::holds_written(&text, &written) {
        return false;
    }
    let Some(folder) = folder_of(path) else {
        return text == written;
    };
    fs::read_dir(place.root.join(folder))
        .into_iter()
        .flatten()
        .flatten()
        .all(|entry| entry.file_name() == "note.md" || entry.file_name() == "images")
}

/// When a removal may delete a note file: nothing is lost.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum Lost {
    /// The file holds only what its note wrote, or is as the default branch committed it.
    Nothing,
    /// As [`Lost::Nothing`], or the file is committed at all: the removal's own commit keeps it in
    /// the history.
    NothingCommitted,
}

/// Deletes, holding them for [`restore`], the note files the notes of the inbox text `before` had
/// that no note of the text `after` links, when `lost` allows it: the files of the notes an edit
/// took out. A file typed in since its note wrote it, and not committed so, stays, unlinked.
/// Returns whether it deleted any.
pub(super) fn remove_left(
    place: &Place,
    before: &str,
    after: &str,
    lost: Lost,
) -> Result<bool, ActionError> {
    let kept: Vec<String> = inbox::parse(after)
        .iter()
        .filter_map(inbox::Note::file)
        .collect();
    let mut removed = false;
    for note in inbox::parse(before) {
        let Some(file) = note.file() else { continue };
        if kept.contains(&file) || !place.root.join(&file).is_file() {
            continue;
        }
        let title = inbox::link_title(before, &note.id);
        let safe = title.is_some_and(|title| as_written(place, &file, &title))
            || as_committed(place, &file)
            || (lost == Lost::NothingCommitted && !committed(place, &file).is_empty());
        if safe {
            remove(place, &file)?;
            removed = true;
        }
    }
    Ok(removed)
}

/// Writes back the note files the notes of the inbox text `text` link that a removal took away, as
/// [`restore`] does. Returns whether it wrote any.
pub(super) fn restore_all(place: &Place, text: &str) -> Result<bool, ActionError> {
    let mut restored = false;
    for file in inbox::parse(text).iter().filter_map(inbox::Note::file) {
        restored |= restore(place, &file)?;
    }
    Ok(restored)
}

/// Writes back the note file at `path` a removal took away, byte for byte, images included, while
/// nothing stands at its place. Returns whether it wrote it.
pub(crate) fn restore(place: &Place, path: &str) -> Result<bool, ActionError> {
    if place.root.join(unit(path)).exists() {
        return Ok(false);
    }
    let root = root_of(place);
    let files = {
        let mut held = held();
        let Some(at) = held
            .iter()
            .rposition(|kept| kept.root == root && kept.path == path)
        else {
            return Ok(false);
        };
        held.remove(at).files
    };
    for (file, bytes) in &files {
        let full = place.root.join(file);
        if let Some(parent) = full.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(full, bytes)?;
    }
    Ok(true)
}
