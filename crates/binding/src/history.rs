//! A feature's or a change's history, read from git, for its page.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::history::HistoryView;

use super::{Job, job};

/// A feature's or a change's stages, each with its start, read from its commits.
#[napi(ts_return_type = "Promise<HistoryView>")]
pub fn read_history(repo: String, folder: String) -> AsyncTask<Job<HistoryView>> {
    job(move || api::read_history(Path::new(&repo), &folder))
}
