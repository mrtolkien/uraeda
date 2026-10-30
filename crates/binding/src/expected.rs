//! The step a feature is expected to have once its uncommitted workflow files are committed, for
//! the composer's message while its commits are queued.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::view::NextView;

use super::{Job, job};

/// The step the feature or change of `folder` will have once its uncommitted workflow files are
/// committed, read from its files on disk: a prediction for the composer's message only, while its
/// commits are queued, never the branch's step, which `nextStep` reads from its latest commit.
#[napi(ts_return_type = "Promise<NextView>")]
pub fn expected_step(repo: String, folder: String) -> AsyncTask<Job<NextView>> {
    job(move || api::expected_step(Path::new(&repo), &folder))
}
