//! The outline writes of the inbox's notes and the priorities' lines: an edit of an item or of one
//! of its nested items, and a drop, each written on the default branch over the file as read.
//! An item that links a draft never nests: its draft is found by its link, a list's item's.

use std::path::Path;

use super::drop_at::Target;
use super::{DropAt, Result, reach_default, reach_default_from, refused, write_lock};
use crate::actions::inbox as inbox_edits;
use crate::actions::place::Place;
use crate::actions::priorities as priority_edits;
use crate::files::document::hash;
use crate::files::inbox::{self, Inbox};
use crate::files::nested::OutlineEdit;
use crate::files::priorities::{self, Priorities, Section};
use crate::workspace::Workspace;

fn outline_edit(kind: &str, text: Option<&str>) -> Result<OutlineEdit> {
    OutlineEdit::from_kind(kind, text)
        .ok_or_else(|| refused(format!("no outline edit {kind}, or an empty text")))
}

/// Whether a write nests the item itself, not one of its nested items: an indent, or a drop under
/// another item.
fn nests(at: Option<u32>, nesting: bool) -> bool {
    at.is_none() && nesting
}

/// The file at `path` as it is, when it is still as read at `previous`: over a changed one, the
/// write itself is refused as a conflict.
fn as_read(place: &Place, path: &str, previous: &str) -> Option<String> {
    std::fs::read_to_string(place.root.join(path))
        .ok()
        .filter(|text| hash(text) == previous)
}

/// Refuses to nest the note `id` when it links a draft.
fn note_stays(place: &Place, id: &str, previous: &str) -> Result<()> {
    let Some(text) = as_read(place, inbox_edits::PATH, previous) else {
        return Ok(());
    };
    let has_draft = inbox::read(&text)
        .categories
        .iter()
        .flat_map(|category| &category.notes)
        .any(|note| note.id == id && note.draft.is_some());
    if has_draft {
        return Err(refused(
            "A note with a draft stays a note: nested, its draft would no longer be found by its link.",
        ));
    }
    Ok(())
}

/// Refuses to nest the line `id` when it links a draft of `workspace`.
fn line_stays(place: &Place, workspace: &Workspace, id: &str, previous: &str) -> Result<()> {
    let Some(text) = as_read(place, priority_edits::PATH, previous) else {
        return Ok(());
    };
    let has_draft = workspace
        .join_priorities(priorities::read(&text, None))
        .sections
        .iter()
        .flat_map(|section| &section.entries)
        .any(|entry| entry.id == id && entry.draft.is_some());
    if has_draft {
        return Err(refused(
            "A line with a draft stays a line: nested, its draft would no longer be found by its link.",
        ));
    }
    Ok(())
}

/// Edits a note's outline: the note, or with `at`, its nested item at `at`, in the order of the
/// file. `kind` and `text` name the edit (see [`OutlineEdit::from_kind`]).
pub fn outline_note(
    repo: &Path,
    id: &str,
    at: Option<u32>,
    kind: &str,
    text: Option<&str>,
    previous: &str,
) -> Result<Inbox> {
    let change = outline_edit(kind, text)?;
    let _lock = write_lock();
    let place = reach_default(repo)?;
    if nests(at, change == OutlineEdit::Indent) {
        note_stays(&place, id, previous)?;
    }
    Ok(inbox_edits::outline(
        &place,
        id,
        at.map(|at| at as usize),
        &change,
        Some(previous),
    )?)
}

/// Moves a note, or with `at` its nested item at `at`, its own items with it, to `to`: what a drop
/// writes. Under a note, or else a note of `to`'s list, a category, or of the notes without one.
pub fn drop_note(
    repo: &Path,
    id: &str,
    at: Option<u32>,
    to: &DropAt,
    previous: &str,
) -> Result<Inbox> {
    let target = to.target()?;
    let to = match target {
        Target::Under { item, at, index } => inbox::Drop::Under {
            note: item.to_string(),
            at,
            index,
        },
        Target::List { list, index } => inbox::Drop::Note {
            category: list.map(String::from),
            index,
        },
    };
    let _lock = write_lock();
    let place = reach_default(repo)?;
    if nests(at, matches!(target, Target::Under { .. })) {
        note_stays(&place, id, previous)?;
    }
    Ok(inbox_edits::drop_item(
        &place,
        id,
        at.map(|at| at as usize),
        &to,
        Some(previous),
    )?)
}

/// Edits a line's outline: the line, or with `at`, its nested item at `at`, in the order of the
/// file. `kind` and `text` name the edit (see [`OutlineEdit::from_kind`]).
pub fn outline_priority(
    repo: &Path,
    id: &str,
    at: Option<u32>,
    kind: &str,
    text: Option<&str>,
    previous: &str,
) -> Result<Priorities> {
    let edit = outline_edit(kind, text)?;
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    if nests(at, edit == OutlineEdit::Indent) {
        line_stays(&place, &workspace, id, previous)?;
    }
    Ok(workspace.join_priorities(priority_edits::outline(
        &place,
        id,
        at.map(|at| at as usize),
        &edit,
        previous,
    )?))
}

/// Moves a line, or with `at` its nested item at `at`, its own items with it, to `to`: what a drop
/// writes. Under a line, or else a line of `to`'s list, a section.
pub fn drop_priority(
    repo: &Path,
    id: &str,
    at: Option<u32>,
    to: &DropAt,
    previous: &str,
) -> Result<Priorities> {
    let target = to.target()?;
    let to = match target {
        Target::Under { item, at, index } => priorities::Drop::Under {
            entry: item.to_string(),
            at,
            index,
        },
        Target::List { list, index } => priorities::Drop::Entry {
            section: list
                .and_then(Section::from_id)
                .ok_or_else(|| refused("a drop needs a section or a line to go under"))?,
            index,
        },
    };
    let _lock = write_lock();
    let (place, workspace) = reach_default_from(repo)?;
    if nests(at, matches!(target, Target::Under { .. })) {
        line_stays(&place, &workspace, id, previous)?;
    }
    Ok(workspace.join_priorities(priority_edits::drop_item(
        &place,
        id,
        at.map(|at| at as usize),
        &to,
        previous,
    )?))
}
