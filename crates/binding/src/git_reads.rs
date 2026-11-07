//! The Git page's reads: the page, the sidebar's count, a file's diff, a commit, a page of the
//! history, and a conflicted file.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api::{
    self, ConflictFileView, GitAt, GitCommitView, GitDiffView, GitHistoryPageView, GitPageView,
    GitSummaryView,
};

use super::{Job, job};

/// The Git page: the main checkout's sync, changes, conflicts, and history's first page, each
/// feature's worktree with changes, and every worktree.
#[napi(ts_return_type = "Promise<GitPageView>")]
pub fn git_page(repo: String) -> AsyncTask<Job<GitPageView>> {
    job(move || api::git_page(Path::new(&repo)))
}

/// The sidebar's count: the files to commit in the main checkout, and the commits to pull.
#[napi(ts_return_type = "Promise<GitSummaryView>")]
pub fn git_summary(repo: String) -> AsyncTask<Job<GitSummaryView>> {
    job(move || api::git_summary(Path::new(&repo)))
}

/// The diff of a file, of a commit or of a group's working tree, capped past 1,000 lines unless
/// `whole`.
#[napi(ts_return_type = "Promise<GitDiffView>")]
pub fn git_diff(repo: String, at: GitAt, path: String, whole: bool) -> AsyncTask<Job<GitDiffView>> {
    job(move || api::git_diff(Path::new(&repo), &at, &path, whole))
}

/// A commit of the main checkout's history, by its id, with the files it changed.
#[napi(ts_return_type = "Promise<GitCommitView>")]
pub fn git_commit(repo: String, id: String) -> AsyncTask<Job<GitCommitView>> {
    job(move || api::git_commit(Path::new(&repo), &id))
}

/// The page of the main checkout's history after the commit `after`.
#[napi(ts_return_type = "Promise<GitHistoryPageView>")]
pub fn git_history(repo: String, after: String) -> AsyncTask<Job<GitHistoryPageView>> {
    job(move || api::git_history(Path::new(&repo), &after))
}

/// A conflicted text file of the main checkout, for the editor, with its hash.
#[napi(ts_return_type = "Promise<ConflictFileView>")]
pub fn conflict_file(repo: String, path: String) -> AsyncTask<Job<ConflictFileView>> {
    job(move || api::conflict_file(Path::new(&repo), &path))
}
