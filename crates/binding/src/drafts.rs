//! The New page's proposal, drafted in one call, and every feature's branch changes, read in one
//! for the sidebar's cards.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api;
use uraeda_core::changes::{self, FeatureChanges};
use uraeda_core::view::ProposalFileView;

use super::{Job, job};

/// Writes `title` as the first proposal of a section that has not started, expands it into a
/// proposal file, and writes `body` under its heading: the file, for its editor.
#[napi(ts_return_type = "Promise<ProposalFileView>")]
pub fn draft_proposal(
    repo: String,
    section: String,
    title: String,
    body: String,
) -> AsyncTask<Job<ProposalFileView>> {
    job(move || api::draft_proposal(Path::new(&repo), &section, &title, &body))
}

/// Every feature's branch changes outside its folder, by its folder: a feature without any is left
/// out.
#[napi(ts_return_type = "Promise<Array<FeatureChanges>>")]
pub fn all_branch_changes(repo: String) -> AsyncTask<Job<Vec<FeatureChanges>>> {
    job(move || changes::all_branch_changes(Path::new(&repo)))
}
