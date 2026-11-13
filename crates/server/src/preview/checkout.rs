//! The checkout a folder's preview runs in, and the folders whose previews are kept up.

use std::path::{Path, PathBuf};

use uraeda_core::api;
use uraeda_core::files::stories::StoryLink;

use super::Previews;
use super::runner::Checkout;
use crate::http::segment;
use crate::records::repositories;
use crate::shared::Shared;

/// The folder of the main checkout's preview: dated feature folders cannot clash with it.
pub(crate) const MAIN: &str = "main";

/// The main checkout of the repository named `name` in the server's list: none when it is not
/// listed, or its folder is gone.
fn main_checkout(shared: &Shared, name: &str) -> Option<PathBuf> {
    repositories::path(shared, name).ok()
}

/// The checkout a folder's preview runs in: the main checkout for `main`, else the feature's
/// worktree. None for a feature without one, or a folder that is no feature's: a feature is
/// never given a checkout here, since the git decision leaves worktrees to the workflow.
fn checkout_dir(root: &Path, folder: &str) -> Option<PathBuf> {
    if folder == MAIN {
        return Some(root.to_owned());
    }
    let feature = api::read_feature(root, folder).ok()?;
    Some(root.join(feature.worktree?))
}

/// Whether a folder still has a checkout a preview could start in: its repository is listed,
/// and its checkout's folder is there.
pub(super) fn exists(shared: &Shared, repository: &str, folder: &str) -> bool {
    let dir = main_checkout(shared, repository).and_then(|root| checkout_dir(&root, folder));
    dir.is_some_and(|dir| dir.is_dir())
}

/// A folder's checkout to run, under its base, `/r/<name>/preview/<secret>/<folder>/`, with the
/// current frame secret, at its current code version: none without a checkout, or without an
/// active preview decision in it.
pub(crate) fn runnable(
    shared: &Shared,
    previews: &Previews,
    repository: &str,
    folder: &str,
) -> Option<Checkout> {
    let dir = checkout_dir(&main_checkout(shared, repository)?, folder)?;
    let read = previews.runner.read();
    let found = api::preview(&dir).ok()??;
    let (name, secret) = (segment(repository), previews.frames.current());
    Some(Checkout {
        base: format!("/r/{name}/preview/{secret}/{}/", segment(folder)),
        command: found.command,
        folder: found.folder,
        read,
        version: api::code_version(&dir).ok().flatten(),
        dir,
    })
}

/// Whether a folder's preview is kept up while nobody views it: its file waits for the human,
/// and embeds a story, which shows at once when the human arrives. Never the main checkout's,
/// nor a folder the core cannot read.
pub(super) fn waits_with_a_story(shared: &Shared, repository: &str, folder: &str) -> bool {
    !waiting_stories(shared, repository, folder).is_empty()
}

/// The stories the folder's file waiting for the human embeds, as their links name them: none
/// when its step does not wait on the human with a file, for the main checkout, and for a folder
/// the core cannot read.
pub(super) fn waiting_stories(shared: &Shared, repository: &str, folder: &str) -> Vec<StoryLink> {
    let waiting = || {
        let root = main_checkout(shared, repository).filter(|_| folder != MAIN)?;
        let step = api::read_feature(&root, folder).ok()?.step;
        let file = step.file.filter(|_| step.waits_on == "human")?;
        let file = api::read_file(&root, folder, &file).ok()?;
        Some(file.current.stories)
    };
    waiting().unwrap_or_default()
}
