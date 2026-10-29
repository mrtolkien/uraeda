//! The inbox's categories: adding, renaming, and deleting one, each written on the default branch
//! over the inbox read at `previous`, and taking a delete back.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::files::inbox::Inbox;

use super::{Job, job};

/// A deleted category's answer: the inbox, and the file as it was, which `restoreCategory` writes
/// back.
#[napi(object)]
pub struct CategoryRemoved {
    pub inbox: Inbox,
    pub before: String,
}

/// Adds a category at the end of the inbox.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn add_category(repo: String, name: String, previous: String) -> AsyncTask<Job<Inbox>> {
    job(move || api::add_category(Path::new(&repo), &name, &previous))
}

/// Renames a category, every heading of its name.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn rename_category(
    repo: String,
    from: String,
    to: String,
    previous: String,
) -> AsyncTask<Job<Inbox>> {
    job(move || api::rename_category(Path::new(&repo), &from, &to, &previous))
}

/// Deletes a category: its notes stay without a category with `keepNotes`, and go with it
/// otherwise.
#[napi(ts_return_type = "Promise<CategoryRemoved>")]
pub fn remove_category(
    repo: String,
    name: String,
    keep_notes: bool,
    previous: String,
) -> AsyncTask<Job<CategoryRemoved>> {
    job(move || {
        let (inbox, before) = api::remove_category(Path::new(&repo), &name, keep_notes, &previous)?;
        Ok(CategoryRemoved { inbox, before })
    })
}

/// Takes back a delete: writes `before` back over the inbox read at `previous`.
#[napi(ts_return_type = "Promise<Inbox>")]
pub fn restore_category(repo: String, before: String, previous: String) -> AsyncTask<Job<Inbox>> {
    job(move || api::restore_category(Path::new(&repo), &before, &previous))
}
