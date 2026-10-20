//! The inbox: its notes' edits, each written on the default branch over the inbox read at
//! `previous`; the moves of notes into the priorities and drafts; the commit bar's Commit and
//! Discard; and the answers of the default branch's rounds. A category or `about` left out is none,
//! so they come last.

use std::path::Path;

use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi_derive::napi;
use uraeda_core::actions::commit::InboxAdded;
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
/// feature or change folder `about`.
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

/// Adds a note as `addNote` does, then commits `INBOX.md` alone when it had no other change: "Add
/// and commit".
#[napi(ts_return_type = "Promise<InboxAdded>")]
pub fn add_note_and_commit(
    repo: String,
    text: String,
    previous: String,
    category: Option<String>,
    about: Option<String>,
) -> AsyncTask<Job<InboxAdded>> {
    job(move || {
        let (inbox, added) =
            api::add_note_and_commit(Path::new(&repo), category, about, &text, &previous)?;
        Ok(InboxAdded { inbox, added })
    })
}

/// Takes back a committed add: the note, `lines` as written, leaves the inbox, and the removal is
/// committed alone.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_committed_note(
    repo: String,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::undo_committed_note(Path::new(&repo), &lines, &previous))
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

/// Moves a note before the note at `index` of a category, or of the notes without one, or to its
/// end, `index` counting the category's notes once the note has left it.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn place_note(
    repo: String,
    id: String,
    index: u32,
    previous: String,
    category: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::place_note(Path::new(&repo), &id, category, index, &previous))
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

/// The images of a call, as the core takes them: each one's bytes, and its file name, `names` holding
/// an empty one for a pasted image.
fn note_images(images: Vec<Buffer>, names: Vec<String>) -> Vec<api::NoteImage> {
    images
        .into_iter()
        .zip(names)
        .map(|(bytes, name)| {
            (
                Vec::<u8>::from(bytes),
                Some(name).filter(|name| !name.is_empty()),
            )
        })
        .collect()
}

/// Adds a note as a new draft folder holding its text and the `images`, linked from the end of a
/// category, all written or none. `names` holds each image's file name, empty for a pasted one.
/// Returns the draft's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn add_note_with_images(
    repo: String,
    text: String,
    previous: String,
    images: Vec<Buffer>,
    names: Vec<String>,
    category: Option<String>,
    about: Option<String>,
) -> AsyncTask<Job<String>> {
    let images = note_images(images, names);
    job(move || {
        let (_, draft) = api::add_note_with_images(
            Path::new(&repo),
            category,
            about,
            &text,
            &images,
            &previous,
        )?;
        Ok(draft)
    })
}

/// Adds `images` to the note `id`, into the draft it links or into the draft it becomes. `names`
/// holds each image's file name, empty for a pasted one. Returns the draft's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn attach_note_images(
    repo: String,
    id: String,
    previous: String,
    images: Vec<Buffer>,
    names: Vec<String>,
) -> AsyncTask<Job<String>> {
    let images = note_images(images, names);
    job(move || {
        let (_, draft) = api::attach_note_images(Path::new(&repo), &id, &images, &previous)?;
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

/// A round of questions on the default branch, `inbox-triage` or `decisions-check`, read as a round
/// of questions, or null when there is none. An unknown id is refused.
#[napi(ts_return_type = "Promise<FileView | null>")]
pub fn read_round(repo: String, id: String) -> AsyncTask<Job<Option<FileView>>> {
    job(move || api::read_round(Path::new(&repo), api::default_round(&id)?))
}

/// Saves one answer of the round `id`, from the letters picked and a comment, over the answer last
/// read, in the round read with the hash `base`.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_round_answer(
    repo: String,
    id: String,
    question: String,
    letters: Vec<String>,
    comment: String,
    previous: String,
    base: String,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::save_round_answer(
            Path::new(&repo),
            api::default_round(&id)?,
            &question,
            &letters,
            &comment,
            &previous,
            &base,
        )
    })
}

/// Saves the notes of the round `id`, over the notes last read, in the round read with the hash
/// `base`.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn save_round_notes(
    repo: String,
    id: String,
    notes: String,
    previous: String,
    base: String,
) -> AsyncTask<Job<FileView>> {
    job(move || {
        api::save_round_notes(
            Path::new(&repo),
            api::default_round(&id)?,
            &notes,
            &previous,
            &base,
        )
    })
}

/// Commits the answered round `id` again, after a hook refused its submit.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn retry_round(repo: String, id: String) -> AsyncTask<Job<FileView>> {
    job(move || api::retry_round(Path::new(&repo), api::default_round(&id)?))
}

/// Submits the round `id`, every question answered, and commits it, over the round read with the
/// hash `previous`.
#[napi(ts_return_type = "Promise<FileView>")]
pub fn submit_round(repo: String, id: String, previous: String) -> AsyncTask<Job<FileView>> {
    job(move || api::submit_round(Path::new(&repo), api::default_round(&id)?, &previous))
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

/// Takes back a note's add: the note, found by its lines, leaves the inbox wherever it is now.
/// Refused once it changed or left, or when two notes hold its lines.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn undo_note_add(repo: String, lines: Vec<String>) -> AsyncTask<Job<Inbox>> {
    job(move || api::undo_note_add(Path::new(&repo), &lines))
}
