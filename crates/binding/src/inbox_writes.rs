//! The inbox: its notes' edits, each written on the default branch over the inbox read at
//! `previous`; the moves of notes into the priorities and drafts; the commit bar's Commit and
//! Discard; and the triage's answers. A category or `about` left out is none, so they come last.

use std::path::Path;

use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;
use uraeda_core::view::FileView;

use super::{Job, job};

/// The inbox, with the count of the commit bar's changes and the triage's status.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn read_inbox(repo: String) -> AsyncTask<Job<Inbox>> {
    job(move || api::read_inbox(Path::new(&repo)))
}

/// Adds a note at the end of a category, or of the notes without one, marked with the slug of the
/// feature or bug folder `about`.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn add_note(
    repo: String,
    text: String,
    previous: String,
    category: Option<String>,
    about: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::add_note(Path::new(&repo), category, about, &text, &previous))
}

/// Replaces a note's text, its marks kept.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn edit_note(
    repo: String,
    id: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::edit_note(Path::new(&repo), &id, &text, &previous))
}

/// Removes a note, sub-items included.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn remove_note(repo: String, id: String, previous: String) -> AsyncTask<Job<Inbox>> {
    job(move || api::remove_note(Path::new(&repo), &id, &previous))
}

/// Moves a note to the end of a category, or of the notes without one.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn move_note_to_category(
    repo: String,
    id: String,
    previous: String,
    category: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::move_note_to_category(Path::new(&repo), &id, category, &previous))
}

/// Inserts a note's lines, as written, before the note at `index` of a category, or at its end:
/// Undo of a removal.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn insert_note(
    repo: String,
    index: u32,
    lines: Vec<String>,
    previous: String,
    category: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::insert_note(Path::new(&repo), category, index, &lines, &previous))
}

/// Moves a note to the end of a section of the priorities, over both files as read.
#[napi(ts_return_type = "Promise<void>")]
pub fn note_to_priorities(
    repo: String,
    id: String,
    section: String,
    previous: String,
    priorities_previous: String,
) -> AsyncTask<Job<()>> {
    job(move || {
        api::note_to_priorities(
            Path::new(&repo),
            &id,
            &section,
            &previous,
            &priorities_previous,
        )
    })
}

/// Makes a note a new draft, linked from the end of a section of the priorities. Returns the
/// draft's path, from the top level.
#[napi(ts_return_type = "Promise<string>")]
pub fn note_to_new_draft(
    repo: String,
    id: String,
    section: String,
    previous: String,
    priorities_previous: String,
) -> AsyncTask<Job<String>> {
    job(move || {
        api::note_to_new_draft(
            Path::new(&repo),
            &id,
            &section,
            &previous,
            &priorities_previous,
        )
    })
}

/// Adds a note at the end of the `## What` of the draft at `draft`, from the top level.
#[napi(ts_return_type = "Promise<void>")]
pub fn note_to_draft(
    repo: String,
    id: String,
    draft: String,
    previous: String,
) -> AsyncTask<Job<()>> {
    job(move || api::note_to_draft(Path::new(&repo), &id, &draft, &previous))
}

/// Adds a note as a new draft folder holding its text and the image `bytes`, linked from the end
/// of a category, all written or none. `name` is the image's file name. Returns the draft's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn add_note_with_image(
    repo: String,
    text: String,
    previous: String,
    bytes: Buffer,
    name: Option<String>,
    category: Option<String>,
    about: Option<String>,
) -> AsyncTask<Job<String>> {
    let bytes = Vec::<u8>::from(bytes);
    job(move || {
        let (_, draft) = api::add_note_with_image(
            Path::new(&repo),
            category,
            about,
            &text,
            &bytes,
            name.as_deref(),
            &previous,
        )?;
        Ok(draft)
    })
}

/// Commits the commit bar's changes: `INBOX.md`, `PRIORITIES.md`, and the drafts notes went into.
#[napi(ts_return_type = "Promise<void>")]
pub fn commit_changes(repo: String) -> AsyncTask<Job<()>> {
    job(move || api::commit_changes(Path::new(&repo)))
}

/// Restores the committed `INBOX.md` and `PRIORITIES.md`, and takes the notes back out of drafts,
/// keeping any text the human typed.
#[napi(ts_return_type = "Promise<void>")]
pub fn discard_changes(repo: String) -> AsyncTask<Job<()>> {
    job(move || api::discard_changes(Path::new(&repo)))
}

/// The inbox's triage, read as a round of questions, or null when there is none.
#[napi(ts_return_type = "Promise<FileView | null>")]
pub fn read_triage(repo: String) -> AsyncTask<Job<Option<FileView>>> {
    job(move || api::read_triage(Path::new(&repo)))
}

/// Saves one answer of the triage, from the letters picked and a comment, over the answer last
/// read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_triage_answer(
    repo: String,
    question: String,
    letters: Vec<String>,
    comment: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || api::save_triage_answer(Path::new(&repo), &question, &letters, &comment, &previous))
}

/// Saves the triage's notes, over the notes last read.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_triage_notes(
    repo: String,
    notes: String,
    previous: String,
) -> AsyncTask<Job<FileView>> {
    job(move || api::save_triage_notes(Path::new(&repo), &notes, &previous))
}

/// Submits the triage, every question answered, and commits it, over the triage read with the
/// hash `previous`.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn submit_triage(repo: String, previous: String) -> AsyncTask<Job<FileView>> {
    job(move || api::submit_triage(Path::new(&repo), &previous))
}

/// Takes back a note's move to a section of the priorities, in one write of both files or none:
/// the line the move wrote leaves the section, found by the note's lines and, among several, by
/// `entryKey`, its key once moved; the note goes back before the note at `index` of its category.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_note_to_priorities(
    repo: String,
    lines: Vec<String>,
    index: u32,
    section: String,
    category: Option<String>,
    entry_key: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || {
        api::undo_note_to_priorities(
            Path::new(&repo),
            &lines,
            category,
            index,
            &section,
            entry_key,
        )
    })
}

/// Takes back a note's add to a draft, in one write of both files or none: the note's lines leave
/// the draft, every other edit kept, and the note goes back to its place.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_note_to_draft(
    repo: String,
    draft: String,
    lines: Vec<String>,
    index: u32,
    category: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::undo_note_to_draft(Path::new(&repo), &draft, &lines, category, index))
}

/// Takes back a note's move to another category, in one write: the note, found by its lines,
/// goes back before the note at `index` of `category`, or of the notes without one.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_note_category(
    repo: String,
    lines: Vec<String>,
    index: u32,
    category: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::undo_note_category(Path::new(&repo), &lines, category, index))
}

/// Takes back a note added as a draft: the note, found by its lines, leaves the inbox, and its
/// draft goes with it, images included, unless a commit has it or the human typed in it.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_note_as_draft(repo: String, lines: Vec<String>) -> AsyncTask<Job<Inbox>> {
    job(move || api::undo_note_as_draft(Path::new(&repo), &lines))
}
