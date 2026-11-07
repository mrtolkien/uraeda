//! The inbox: its notes' edits, each written on the default branch over the inbox read at
//! `previous`; the moves of notes into the priorities and proposal files; and the answers of the
//! default branch's rounds. A category or `about`
//! left out is none, so they come last.

use std::path::Path;

use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi_derive::napi;
use uraeda_core::actions::commit::InboxAdded;
use uraeda_core::api;
use uraeda_core::api::undo;
use uraeda_core::files::inbox::Inbox;
use uraeda_core::view::FileView;

use super::undo::{recording, scope};
use super::{Job, job};

/// The inbox, with the count of the changes waiting for a commit and the triage's status.
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
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(repo, undo, scope(undo::INBOX), move |repo: &Path| {
        api::add_note(repo, category, about, &text, &previous)
    })
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

/// Edits a note's outline: the note, or with `at`, its nested item at `at` in the order of the
/// file. `kind` is `edit`, `insert-below`, `insert-above`, `append-child`, `remove`, `indent`,
/// `outdent`, `up`, or `down`; `text` is the line those that write one write.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn outline_note(
    repo: String,
    id: String,
    at: Option<u32>,
    kind: String,
    text: Option<String>,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(
        repo,
        undo,
        scope(if kind == "remove" {
            undo::NOTES
        } else {
            undo::INBOX
        }),
        move |repo: &Path| api::outline_note(repo, &id, at, &kind, text.as_deref(), &previous),
    )
}

/// Moves a note, or with `at` its nested item at `at`, its own items with it, to `to`: what a drop
/// writes. Under a note, or else a note of `to`'s list, a category, or of the notes without one.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn drop_note(
    repo: String,
    id: String,
    at: Option<u32>,
    to: api::DropAt,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(repo, undo, scope(undo::INBOX), move |repo: &Path| {
        api::drop_note(repo, &id, at, &to, &previous)
    })
}

/// Removes a note, sub-items included, and its note file.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn remove_note(
    repo: String,
    id: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(repo, undo, scope(undo::NOTES), move |repo: &Path| {
        api::remove_note(repo, &id, &previous)
    })
}

/// Removes a note as `removeNote` does, then commits `INBOX.md` alone when it had no other change:
/// a note started as a change.
#[napi(ts_return_type = "Promise<InboxAdded>")]
pub fn remove_note_and_commit(
    repo: String,
    id: String,
    previous: String,
) -> AsyncTask<Job<InboxAdded>> {
    job(move || {
        let (inbox, added) = api::remove_note_and_commit(Path::new(&repo), &id, &previous)?;
        Ok(InboxAdded { inbox, added })
    })
}

/// Moves a note to the end of a category, or of the notes without one.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn move_note_to_category(
    repo: String,
    id: String,
    previous: String,
    category: Option<String>,
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(repo, undo, scope(undo::INBOX), move |repo: &Path| {
        api::move_note_to_category(repo, &id, category, &previous)
    })
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
    undo: Option<String>,
) -> AsyncTask<Job<Inbox>> {
    recording(repo, undo, scope(undo::INBOX), move |repo: &Path| {
        api::place_note(repo, &id, category, index, &previous)
    })
}

/// Moves a note to the end of a section of the priorities, over both files as read.
#[napi(ts_return_type = "Promise<void>")]
pub fn note_to_proposal(
    repo: String,
    id: String,
    section: String,
    previous: String,
    priorities_previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<()>> {
    recording(repo, undo, scope(undo::PROMOTION), move |repo: &Path| {
        api::note_to_proposal(repo, &id, &section, &previous, &priorities_previous)
    })
}

/// Moves a note under the proposal `proposal` of the priorities, `now-2`, as its last item, over
/// both files as read.
#[napi(ts_return_type = "Promise<void>")]
pub fn note_under_proposal(
    repo: String,
    id: String,
    proposal: String,
    previous: String,
    priorities_previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<()>> {
    recording(repo, undo, scope(undo::PROMOTION), move |repo: &Path| {
        api::note_under_proposal(repo, &id, &proposal, &previous, &priorities_previous)
    })
}

/// Makes a note a new proposal file, linked from the end of a section of the priorities, or moves
/// its note file among the proposals. Returns the proposal file's path, from the top level.
#[napi(ts_return_type = "Promise<string>")]
pub fn note_to_proposal_file(
    repo: String,
    id: String,
    section: String,
    previous: String,
    priorities_previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<String>> {
    recording(
        repo,
        undo,
        scope(undo::RELINKING_PROMOTION),
        move |repo: &Path| {
            api::note_to_proposal_file(repo, &id, &section, &previous, &priorities_previous)
        },
    )
}

/// Adds a note to the proposal file at `proposal`, from the top level: its lines at the end of the
/// file's `## What`, or, for a note with a note file, the note file's text at the end of its
/// `## Notes`, its images beside it. Returns the proposal file's path, which a single proposal file
/// made a folder for the images changes.
#[napi(ts_return_type = "Promise<string>")]
pub fn note_into_proposal(
    repo: String,
    id: String,
    proposal: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<String>> {
    recording(
        repo,
        undo,
        scope(undo::RELINKING_PROMOTION),
        move |repo: &Path| api::note_into_proposal(repo, &id, &proposal, &previous),
    )
}

/// Adds a note with a note file to the proposal of `PRIORITIES.md` with the id `proposal`, like
/// `later-2`, which has no file yet: the proposal gets its file, from the template, linked from its
/// line, and the note file's text goes into its `## Notes`, over both lists as read. Returns the new
/// proposal file's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn note_into_proposal_line(
    repo: String,
    id: String,
    proposal: String,
    previous: String,
    priorities_previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<String>> {
    recording(
        repo,
        undo,
        scope(undo::RELINKING_PROMOTION),
        move |repo: &Path| {
            api::note_into_proposal_line(repo, &id, &proposal, &previous, &priorities_previous)
        },
    )
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

/// Where a new note goes, a category, or the notes without one, and the feature or change folder
/// it is `about`.
#[napi(object)]
pub struct NewNote {
    pub category: Option<String>,
    pub about: Option<String>,
}

/// Adds a note as a new note file's folder holding its text and the `images`, linked from the end
/// of a category, all written or none. `names` holds each image's file name, empty for a pasted
/// one. Returns the note file's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn add_note_with_images(
    repo: String,
    text: String,
    previous: String,
    images: Vec<Buffer>,
    names: Vec<String>,
    note: Option<NewNote>,
    undo: Option<String>,
) -> AsyncTask<Job<String>> {
    let images = note_images(images, names);
    let NewNote { category, about } = note.unwrap_or(NewNote {
        category: None,
        about: None,
    });
    recording(repo, undo, scope(undo::NOTES), move |repo: &Path| {
        let (_, file) =
            api::add_note_with_images(repo, category, about, &text, &images, &previous)?;
        Ok(file)
    })
}

/// Adds `images` to the note `id`, into its note file or into the note file it gets. `names` holds
/// each image's file name, empty for a pasted one. Returns the note file's path.
#[napi(ts_return_type = "Promise<string>")]
pub fn attach_note_images(
    repo: String,
    id: String,
    previous: String,
    images: Vec<Buffer>,
    names: Vec<String>,
    undo: Option<String>,
) -> AsyncTask<Job<String>> {
    let images = note_images(images, names);
    recording(repo, undo, scope(undo::NOTES), move |repo: &Path| {
        let (_, file) = api::attach_note_images(repo, &id, &images, &previous)?;
        Ok(file)
    })
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
