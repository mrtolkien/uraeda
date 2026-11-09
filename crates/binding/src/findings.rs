//! A review's findings, written and committed in the folder of the feature's worktree.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api::{self, Findings};

use super::{Job, job};

/// Writes the next `findings-NN.md` in the folder of the feature's worktree, and commits it alone,
/// as `review(<slug>): findings NN`: other changes of the worktree stay out of the commit. Resolves
/// to its path from the repository's top level. Rejects with `refused: ` findings without a
/// section, a `reviewed` not `branch` or `wave <N>`, or `commits` not two commit IDs. A hook's
/// refusal leaves the file written, to be committed with `retryCommit(repo, folder, name)`.
#[napi(ts_return_type = "Promise<string>")]
pub fn write_findings(repo: String, folder: String, findings: Findings) -> AsyncTask<Job<String>> {
    job(move || api::write_findings(Path::new(&repo), &folder, &findings))
}
