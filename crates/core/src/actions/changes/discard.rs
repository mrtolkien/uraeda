//! Discard: the default branch's pane put back as its last commit has it.

use std::fs;

use crate::files::proposal;
use crate::git::Git;

use super::files::{Undo, unmerge};
use super::place;
use super::{ActionError, INBOX, PRIORITIES, Place, edits, gather, images_folders};

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, staged edits included, deleting one that
/// no commit has. A file is never lost: one a move wrote and nobody committed is deleted only while
/// it holds what the move wrote, with at most a note's images, which go with it, one a note was
/// added to loses that note's lines only, a note file a move put among the proposals moves back,
/// a committed one a removal deleted comes back, and a link repair is restored from `HEAD`. A
/// file a buffer edited is restored from `HEAD` too, or deleted when no commit has it (ruling R3).
pub fn discard(place: &Place) -> Result<(), ActionError> {
    let listed = gather(place);
    let git = Git::open(&place.root)?;
    // Nothing discarded stays staged, as a refused commit or the human left it: a deleted file's
    // entry would block the next commit, or bring the file back.
    let mut staged: Vec<&str> = vec![INBOX, PRIORITIES];
    let folders = images_folders(&listed.paths);
    staged.extend(listed.paths.iter().chain(&folders).map(String::as_str));
    git.unstage(&staged)?;
    for path in [INBOX, PRIORITIES] {
        if place::committed(place, path).is_some() {
            git.restore(path)?;
        } else if place.root.join(path).is_file() {
            fs::remove_file(place.root.join(path))?;
        }
    }
    for path in &listed.repairs {
        git.restore(path)?;
    }
    edits::restore(place, &git, &listed.edits)?;
    for undo in listed.undo {
        match undo {
            Undo::Created { path, written } => {
                crate::actions::expand::remove_written(place, &path, &written)?;
            }
            Undo::Converted { old, path } => {
                let Some(written) = place::committed(place, &old) else {
                    continue;
                };
                if crate::actions::expand::remove_written(place, &path, &[written])? {
                    git.restore(&old)?;
                } else {
                    crate::actions::attach::retarget(place, &old, &path)?;
                }
            }
            Undo::Grown { path, markdown } => {
                let file = place.root.join(&path);
                let text = fs::read_to_string(&file)?;
                if let Some(without) = proposal::without_item(&text, &markdown) {
                    fs::write(file, without)?;
                }
            }
            Undo::Merged {
                path,
                title,
                drop_notes,
            } => unmerge(place, &path, &title, drop_notes)?,
            Undo::Moved { path, note } => {
                crate::actions::inbox::back_to_notes(place, &path, &note)?
            }
            Undo::Uncategorized { path } => git.restore(&path)?,
            Undo::Removed { note, paths } => {
                if !crate::actions::inbox::restore_note_file(place, &note)? {
                    for path in paths {
                        git.restore(&path)?;
                    }
                }
            }
        }
    }
    Ok(())
}
