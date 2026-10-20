//! Moving a feature or a change through its life: a change to a feature, in place, and dropping
//! either.

use std::path::Path;

use napi::bindgen_prelude::AsyncTask;
use napi_derive::napi;
use uraeda_core::api::{self, DroppedView};
use uraeda_core::view::PromotedView;

use super::{Job, job};

/// Makes the change in `folder` a feature, in place: its branch loses its `change/` prefix, its
/// folder moves to `specs/`, and **Now** links it. Rejects a change with a pull request, with
/// uncommitted changes, or whose feature's name is taken.
#[napi(ts_return_type = "Promise<PromotedView>")]
pub fn promote_change(repo: String, folder: String) -> AsyncTask<Job<PromotedView>> {
    job(move || api::promote_change(Path::new(&repo), &folder))
}

/// Drops a started feature or change: its entry leaves the priorities, its worktree is removed
/// unless it has uncommitted changes, never forced, and its branch stays.
#[napi(ts_return_type = "Promise<DroppedView>")]
pub fn drop_item(repo: String, folder: String) -> AsyncTask<Job<DroppedView>> {
    job(move || api::drop_item(Path::new(&repo), &folder))
}
