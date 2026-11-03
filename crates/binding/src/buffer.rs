//! A buffer: any Markdown file under `specs/`, read whole and saved as typed on its branch, never
//! committed.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api::{self, BufferView};

use super::{Job, job};

/// A Markdown file under `specs/`, whole, frontmatter included, with the branch it is written on.
#[napi(ts_return_type = "Promise<BufferView>")]
pub fn read_buffer(repo: String, path: String) -> AsyncTask<Job<BufferView>> {
    job(move || api::read_buffer(Path::new(&repo), &path))
}

/// Saves a Markdown file under `specs/` as typed, over the version read at `previous`, on its
/// feature's branch or the default branch, without committing; resolves with the new hash.
#[napi(ts_return_type = "Promise<string>")]
pub fn save_buffer(
    repo: String,
    path: String,
    text: String,
    previous: String,
) -> AsyncTask<Job<String>> {
    job(move || api::save_buffer(Path::new(&repo), &path, &text, &previous))
}
