//! Deferred commits, for the server's write queue: deferral turned on for a repository, its
//! writes return once their files are written, and the queue lands their commits one after
//! another, the hooks' output streamed as it comes.

use std::path::Path;

use napi::Status;
use napi::bindgen_prelude::AsyncTask;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use uraeda_core::api::{self, DeferredView};
use uraeda_core::view::CommitView;

use super::{Job, job};

/// Turns deferral of commits on or off for the repository at `repo`. Turned off, the commits not
/// landed are forgotten, their files left written. It reads no workflow file, so it returns at
/// once.
#[napi]
pub fn defer_commits(repo: String, on: bool) {
    api::defer_commits(Path::new(&repo), on);
}

/// The commits the writes to the repository at `repo` deferred since the last call, each handed
/// out once. It reads no workflow file, so it returns at once.
#[napi(ts_return_type = "Array<Deferred>")]
pub fn take_deferred(repo: String) -> Vec<DeferredView> {
    api::take_deferred(Path::new(&repo))
}

/// Lands the deferred commit `id` with the hooks, calling `onOutput` with each line git and its
/// hooks print. A hook's refusal puts back what the write left, and rejects with `hook: `.
#[napi(
    ts_args_type = "repo: string, id: string, onOutput: (line: string) => void",
    ts_return_type = "Promise<CommitView>"
)]
pub fn land(
    repo: String,
    id: String,
    on_output: ThreadsafeFunction<String, (), String, Status, false, true>,
) -> AsyncTask<Job<CommitView>> {
    job(move || {
        api::land(Path::new(&repo), &id, |line| {
            on_output.call(line.to_string(), ThreadsafeFunctionCallMode::NonBlocking);
        })
    })
}
