//! The texts the change list compares: `INBOX.md` joined with the agents' notes, now and at `HEAD`,
//! so an agent's note removed or moved counts as a change of the inbox, and `PRIORITIES.md`.

use std::fs;

use crate::files::inbox::{self, NoteFile};
use crate::git::Git;

use super::super::place::Place;
use super::{INBOX, PRIORITIES, versions};

/// The texts of `INBOX.md` and `PRIORITIES.md`, now and at `HEAD`: `INBOX.md` joined with the
/// agents' notes of each.
pub(super) struct Texts {
    pub inbox: (Option<String>, Option<String>),
    pub priorities: (Option<String>, Option<String>),
    /// Whether `INBOX.md` itself changed.
    pub inbox_changed: bool,
}

/// The texts of the two lists, now and at `HEAD`; a list among `edits`, the files a buffer edited,
/// reads its text now as its text at `HEAD` too, its edit one change of its own.
pub(super) fn texts(place: &Place, edits: &[String]) -> Texts {
    let texts_of = |path: &str| {
        if edits.iter().any(|edit| edit == path) {
            let now = fs::read_to_string(place.root.join(path)).ok();
            (now.clone(), now)
        } else {
            versions(place, path)
        }
    };
    let (now, then) = texts_of(INBOX);
    Texts {
        inbox_changed: now != then,
        inbox: joined(place, now, then),
        priorities: texts_of(PRIORITIES),
    }
}

/// `INBOX.md`'s text joined with the agents' notes among `files` (see [`inbox::joined`]); `None`
/// when there is neither.
fn joined_with(text: Option<String>, files: &[NoteFile]) -> Option<String> {
    if text.is_none() && files.is_empty() {
        return None;
    }
    Some(inbox::joined(&text.unwrap_or_default(), files))
}

/// The note files of `specs/notes/` at `HEAD`.
fn committed_notes(place: &Place) -> Vec<NoteFile> {
    let Ok(git) = Git::open(&place.root) else {
        return Vec::new();
    };
    let Some(head) = git.head() else {
        return Vec::new();
    };
    let paths = git
        .list_files(head, crate::target::NOTES)
        .unwrap_or_default();
    inbox::note_files(&paths, |path| {
        let bytes = git.read_file(head, path).ok()??;
        String::from_utf8(bytes).ok()
    })
}

/// `INBOX.md`'s texts `now` and `then`, at `HEAD`, joined with the agents' notes of the checkout
/// and of `HEAD`.
fn joined(
    place: &Place,
    now: Option<String>,
    then: Option<String>,
) -> (Option<String>, Option<String>) {
    let on_disk = inbox::note_files(&inbox::note_paths_on_disk(&place.root), |path| {
        fs::read_to_string(place.root.join(path)).ok()
    });
    (
        joined_with(now, &on_disk),
        joined_with(then, &committed_notes(place)),
    )
}
