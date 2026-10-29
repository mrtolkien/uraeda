//! The priorities: their lines' edits, outlines, and drops, each written on the default branch over
//! the priorities read at `previous`, and the commit page's Commit and Discard.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::files::priorities::Priorities;

use super::{Job, job};

/// Adds a line at the end of a section of the priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn add_proposal(
    repo: String,
    section: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::add_proposal(Path::new(&repo), &section, &text, &previous))
}

/// Takes back a committed add: the proposal, `lines` as written, leaves the priorities, and the
/// removal is committed alone.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn undo_committed_proposal(
    repo: String,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::undo_committed_proposal(Path::new(&repo), &lines, &previous))
}

/// Inserts a proposal with its nested lines, as written, before the line at `index` of a
/// section, or at its end: Undo of a removal.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn insert_proposal(
    repo: String,
    section: String,
    index: u32,
    lines: Vec<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::insert_proposal(Path::new(&repo), &section, index, &lines, &previous))
}

/// Moves a proposal before the line at `index` of a section, or to its end.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn move_proposal(
    repo: String,
    id: String,
    section: String,
    index: u32,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::move_proposal(Path::new(&repo), &id, &section, index, &previous))
}

/// Replaces a proposal's text.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn edit_proposal(
    repo: String,
    id: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::edit_proposal(Path::new(&repo), &id, &text, &previous))
}

/// Edits a proposal's outline: the line, or with `at`, its nested item at `at` in the order
/// of the file. `kind` is `edit`, `insert-below`, `insert-above`, `append-child`, `remove`,
/// `indent`, `outdent`, `up`, or `down`; `text` is the line those that write one write.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn outline_proposal(
    repo: String,
    id: String,
    at: Option<u32>,
    kind: String,
    text: Option<String>,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::outline_proposal(Path::new(&repo), &id, at, &kind, text.as_deref(), &previous))
}

/// Moves a proposal, or with `at` its nested item at `at`, its own items with it, to `to`:
/// what a drop writes. Under a line, or else a line of `to`'s list, a section.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn drop_proposal(
    repo: String,
    id: String,
    at: Option<u32>,
    to: api::DropAt,
    previous: String,
) -> AsyncTask<Job<Priorities>> {
    job(move || api::drop_proposal(Path::new(&repo), &id, at, &to, &previous))
}

/// Removes a proposal and its nested lines.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn remove_proposal(repo: String, id: String, previous: String) -> AsyncTask<Job<Priorities>> {
    job(move || api::remove_proposal(Path::new(&repo), &id, &previous))
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
