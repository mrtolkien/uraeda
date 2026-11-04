//! The Git page's writes: the remote writes, the merge, and a stop's end on the main checkout, git's
//! output streamed to `onOutput` as it comes; the index's writes on a group's checkout, `folder`
//! `null` for the main checkout's; a conflict's writes; and the worktrees' removal and cleaning.

use std::path::Path;

use napi::Status;
use napi::bindgen_prelude::AsyncTask;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use uraeda_core::api::{self, ConflictFileView};
use uraeda_core::view::CommitView;

use super::{Job, job};

/// A callback given each line of git's output.
type OnOutput = ThreadsafeFunction<String, (), String, Status, false, true>;

/// A line of output, handed to `onOutput` without waiting for it.
fn line(on_output: &OnOutput) -> impl Fn(&str) + '_ {
    move |line| {
        on_output.call(line.to_string(), ThreadsafeFunctionCallMode::NonBlocking);
    }
}

/// Fetches `origin` in the main checkout.
#[napi(
    ts_args_type = "repo: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_fetch(repo: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_fetch(Path::new(&repo), line(&on_output)))
}

/// Pulls the main checkout's branch from `origin`, rebasing unless the configuration says how to
/// pull. A pull that stops on a conflict resolves: the page's view shows the stop.
#[napi(
    ts_args_type = "repo: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_pull(repo: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_pull(Path::new(&repo), line(&on_output)))
}

/// Pushes the main checkout's branch to `origin`, never forced.
#[napi(
    ts_args_type = "repo: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_push(repo: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_push(Path::new(&repo), line(&on_output)))
}

/// Merges `branch`, local or on `origin`, into the main checkout's branch.
#[napi(
    ts_args_type = "repo: string, branch: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_merge(repo: String, branch: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_merge(Path::new(&repo), &branch, line(&on_output)))
}

/// Continues the main checkout's stopped pull or merge once its conflicts are resolved.
#[napi(
    ts_args_type = "repo: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_continue(repo: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_continue(Path::new(&repo), line(&on_output)))
}

/// Aborts the main checkout's stopped pull or merge.
#[napi(
    ts_args_type = "repo: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<void>"
)]
pub fn git_abort(repo: String, on_output: OnOutput) -> AsyncTask<Job<()>> {
    job(move || api::git_abort(Path::new(&repo), line(&on_output)))
}

/// Stages `paths`, files or folders, in the group `folder`'s checkout.
#[napi(
    ts_args_type = "repo: string, folder: string | null, paths: Array<string>",
    ts_return_type = "Promise<void>"
)]
pub fn git_stage(repo: String, folder: Option<String>, paths: Vec<String>) -> AsyncTask<Job<()>> {
    job(move || api::git_stage(Path::new(&repo), folder.as_deref(), &paths))
}

/// Unstages `paths`, files or folders, in the group `folder`'s checkout.
#[napi(
    ts_args_type = "repo: string, folder: string | null, paths: Array<string>",
    ts_return_type = "Promise<void>"
)]
pub fn git_unstage(repo: String, folder: Option<String>, paths: Vec<String>) -> AsyncTask<Job<()>> {
    job(move || api::git_unstage(Path::new(&repo), folder.as_deref(), &paths))
}

/// Discards the changes to the file at `path` in the group `folder`'s checkout.
#[napi(
    ts_args_type = "repo: string, folder: string | null, path: string",
    ts_return_type = "Promise<void>"
)]
pub fn git_discard(repo: String, folder: Option<String>, path: String) -> AsyncTask<Job<()>> {
    job(move || api::git_discard(Path::new(&repo), folder.as_deref(), &path))
}

/// Commits what is staged in the group `folder`'s checkout with `message` as typed, through the
/// hooks. A hook's refusal rejects with `hook: `, its output after a blank line.
#[napi(
    ts_args_type = "repo: string, folder: string | null, message: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<CommitView>"
)]
pub fn git_commit_staged(
    repo: String,
    folder: Option<String>,
    message: String,
    on_output: OnOutput,
) -> AsyncTask<Job<CommitView>> {
    job(move || {
        api::git_commit_staged(
            Path::new(&repo),
            folder.as_deref(),
            &message,
            line(&on_output),
        )
    })
}

/// Resolves the main checkout's conflicted file at `path` with git's `ours` or `theirs` whole, or
/// by deleting it, and stages it.
#[napi(
    ts_args_type = "repo: string, path: string, resolution: \"ours\" | \"theirs\" | \"delete\"",
    ts_return_type = "Promise<void>"
)]
pub fn git_resolve(repo: String, path: String, resolution: String) -> AsyncTask<Job<()>> {
    job(move || api::git_resolve(Path::new(&repo), &path, &resolution))
}

/// Saves `text` over the main checkout's conflicted file at `path`, read at `hash`. Rejects with
/// `conflict: ` when the file changed since.
#[napi(ts_return_type = "Promise<ConflictFileView>")]
pub fn save_conflict_file(
    repo: String,
    path: String,
    text: String,
    hash: String,
) -> AsyncTask<Job<ConflictFileView>> {
    job(move || api::save_conflict_file(Path::new(&repo), &path, &text, &hash))
}

/// Removes the linked worktree at `path`, from the main checkout's root, never forced; prunes a
/// missing one's record. Its branch stays.
#[napi(ts_return_type = "Promise<void>")]
pub fn git_remove_worktree(repo: String, path: String) -> AsyncTask<Job<()>> {
    job(move || api::git_remove_worktree(Path::new(&repo), &path))
}

/// Cleans the merged feature of `folder` as `ura clean` does.
#[napi(ts_return_type = "Promise<void>")]
pub fn clean_feature(repo: String, folder: String) -> AsyncTask<Job<()>> {
    job(move || api::clean_feature(Path::new(&repo), &folder))
}
