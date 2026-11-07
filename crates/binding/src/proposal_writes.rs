//! The priorities: their lines' edits, outlines, and drops, each written on the default branch over
//! the priorities read at `previous`, and the commit bar's Commit and Discard.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::api::undo;
use uraeda_core::files::priorities::Priorities;

use super::undo::{recording, scope};
use super::{Job, job};

/// Adds a line at the end of a section of the priorities.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn add_proposal(
    repo: String,
    section: String,
    text: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::add_proposal(repo, &section, &text, &previous)
    })
}

/// Moves a proposal before the line at `index` of a section, or to its end.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn move_proposal(
    repo: String,
    id: String,
    section: String,
    index: u32,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::move_proposal(repo, &id, &section, index, &previous)
    })
}

/// Replaces a proposal's text.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn edit_proposal(
    repo: String,
    id: String,
    text: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::edit_proposal(repo, &id, &text, &previous)
    })
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
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::outline_proposal(repo, &id, at, &kind, text.as_deref(), &previous)
    })
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
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::drop_proposal(repo, &id, at, &to, &previous)
    })
}

/// Removes a proposal and its nested lines.
#[napi(ts_return_type = "Promise<Priorities>")]
pub fn remove_proposal(
    repo: String,
    id: String,
    previous: String,
    undo: Option<String>,
) -> AsyncTask<Job<Priorities>> {
    recording(repo, undo, scope(undo::PRIORITIES), move |repo: &Path| {
        api::remove_proposal(repo, &id, &previous)
    })
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
