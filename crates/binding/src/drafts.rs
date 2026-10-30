//! Every feature's branch changes, read in one call for the sidebar's cards.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::changes::{self, FeatureChanges};

use super::{Job, job};

/// Every feature's branch changes outside its folder, by its folder: a feature without any is left
/// out.
#[napi(ts_return_type = "Promise<Array<FeatureChanges>>")]
pub fn all_branch_changes(repo: String) -> AsyncTask<Job<Vec<FeatureChanges>>> {
    job(move || changes::all_branch_changes(Path::new(&repo)))
}
