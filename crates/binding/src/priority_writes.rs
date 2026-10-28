//! The priorities: their lines' edits, outlines, and drops, each written on the default branch over
//! the priorities read at `previous`, and the commit bar's Commit and Discard.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::actions::commit::PrioritiesAdded;
use uraeda_core::api;
use uraeda_core::files::priorities::Priorities;

use super::{Job, job};

/// Adds a line at the end of a section of the priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn add_priority(
    repo: String,
    section: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::add_priority(Path::new(&repo), &section, &text, &previous))
}

/// Adds a line at the end of a section of the priorities, then commits `PRIORITIES.md` alone when
/// it had no other change: "Add and commit".
#[napi(ts_return_type = "Promise<PrioritiesAdded>")]
pub fn add_priority_and_commit(
    repo: String,
    section: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<PrioritiesAdded>> {
    job(move || {
        let (priorities, added) =
            api::add_priority_and_commit(Path::new(&repo), &section, &text, &previous)?;
        Ok(PrioritiesAdded { priorities, added })
    })
}

/// Takes back a committed add: the entry, `lines` as written, leaves the priorities, and the
/// removal is committed alone.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn undo_committed_priority(
    repo: String,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::undo_committed_priority(Path::new(&repo), &lines, &previous))
}

/// Inserts a priority line with its nested lines, as written, before the line at `index` of a
/// section, or at its end: Undo of a removal.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn insert_priority(
    repo: String,
    section: String,
    index: u32,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::insert_priority(Path::new(&repo), &section, index, &lines, &previous))
}

/// Moves a priority line before the line at `index` of a section, or to its end.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn move_priority(
    repo: String,
    id: String,
    section: String,
    index: u32,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::move_priority(Path::new(&repo), &id, &section, index, &previous))
}

/// Replaces a priority line's text.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn edit_priority(
    repo: String,
    id: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::edit_priority(Path::new(&repo), &id, &text, &previous))
}

/// Edits a priority line's outline: the line, or with `at`, its nested item at `at` in the order
/// of the file. `kind` is `edit`, `insert-below`, `insert-above`, `append-child`, `remove`,
/// `indent`, `outdent`, `up`, or `down`; `text` is the line those that write one write.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn outline_priority(
    repo: String,
    id: String,
    at: Option<u32>,
    kind: String,
    text: Option<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::outline_priority(Path::new(&repo), &id, at, &kind, text.as_deref(), &previous))
}

/// Moves a priority line, or with `at` its nested item at `at`, its own items with it, to `to`:
/// what a drop writes. Under a line, or else a line of `to`'s list, a section.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn drop_priority(
    repo: String,
    id: String,
    at: Option<u32>,
    to: api::DropAt,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::drop_priority(Path::new(&repo), &id, at, &to, &previous))
}

/// Removes a priority line and its nested lines.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn remove_priority(repo: String, id: String, previous: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::remove_priority(Path::new(&repo), &id, &previous))
}

/// Commits the priorities alone.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn commit_priorities(repo: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::commit_priorities(Path::new(&repo)))
}

/// Restores the committed priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn discard_priorities(repo: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::discard_priorities(Path::new(&repo)))
}
