//! The Git page's writes. Each lands in its repository's write queue, after the writes made
//! before it, named by its `write`, with what git prints, and is refused while an agent works
//! in a checkout it writes. It answers once it landed: a refusal stays in the queue's record
//! until dismissed, and answers the call too.

use std::path::Path;

use uraeda_core::api::{self, ApiError};
use uraeda_protocol::{
    ConflictFile, GitAbort, GitClean, GitCommitStaged, GitContinue, GitDiscard, GitFetch, GitMerge,
    GitPull, GitPush, GitRemoveWorktree, GitResolve, GitSaveConflict, GitStage, GitUnstage,
    WriteName,
};

use super::working::{self, Touches};
use super::{fetcher, views};
use crate::live::{Call, Fault, Registry};
use crate::records::repositories;
use crate::records::writing::{self, Landing, Queued, Write};

/// The page a write of the Git page opens, when the client names none.
const PAGE: &str = "/git";

pub(super) fn register(registry: &Registry) {
    sync(registry);
    index(registry);
    conflicts(registry);
    worktrees(registry);
}

/// A write of the main checkout, as the queue names it: by the client's name, or by `label`.
fn main(name: Option<WriteName>, label: impl Into<String>) -> Write {
    Write::of_main().named(name).or_named(label, PAGE)
}

/// A write of a group's checkout: the main one for no folder, else the feature's worktree.
fn group(folder: Option<&str>, name: Option<WriteName>, label: impl Into<String>) -> Write {
    let write = match folder {
        None => Write::of_main(),
        Some(folder) => Write::of_feature(folder),
    };
    write.named(name).or_named(label, PAGE)
}

/// The writes that sync the main checkout's branch: with `origin`, and with another branch.
fn sync(registry: &Registry) {
    registry.action::<GitFetch>(fetch);
    registry.action::<GitPull>(|call, input| {
        let write = main(input.write, "Pulling");
        landed(
            call,
            &input.repo,
            write,
            Touches::main(),
            |repo, landing| api::git_pull(repo, |line| landing.printed(line)),
        )
    });
    registry.action::<GitPush>(|call, input| {
        let write = main(input.write, "Pushing");
        landed(
            call,
            &input.repo,
            write,
            Touches::main(),
            |repo, landing| api::git_push(repo, |line| landing.printed(line)),
        )
    });
    registry.action::<GitMerge>(|call, input| {
        let write = main(input.write, format!("Merging {}", input.branch));
        let branch = input.branch;
        landed(
            call,
            &input.repo,
            write,
            Touches::main(),
            move |repo, landing| api::git_merge(repo, &branch, |line| landing.printed(line)),
        )
    });
}

/// The writes of a group's index and working tree, and its commit.
fn index(registry: &Registry) {
    registry.action::<GitStage>(|call, input| {
        let (folder, paths) = (input.folder, input.paths);
        let write = group(folder.as_deref(), input.write, "Staging");
        let touches = Touches::group(folder.as_deref());
        landed(call, &input.repo, write, touches, move |repo, _| {
            api::git_stage(repo, folder.as_deref(), &paths)
        })
    });
    registry.action::<GitUnstage>(|call, input| {
        let (folder, paths) = (input.folder, input.paths);
        let write = group(folder.as_deref(), input.write, "Unstaging");
        let touches = Touches::group(folder.as_deref());
        landed(call, &input.repo, write, touches, move |repo, _| {
            api::git_unstage(repo, folder.as_deref(), &paths)
        })
    });
    registry.action::<GitDiscard>(|call, input| {
        let (folder, path) = (input.folder, input.path);
        let label = format!("Discarding {path}");
        let write = group(folder.as_deref(), input.write, label);
        let touches = Touches::group(folder.as_deref());
        landed(call, &input.repo, write, touches, move |repo, _| {
            api::git_discard(repo, folder.as_deref(), &path)
        })
    });
    registry.action::<GitCommitStaged>(|call, input| {
        let (folder, message) = (input.folder, input.message);
        let write = group(folder.as_deref(), input.write, "Committing");
        let touches = Touches::group(folder.as_deref());
        landed(call, &input.repo, write, touches, move |repo, landing| {
            let printed = |line: &str| landing.printed(line);
            api::git_commit_staged(repo, folder.as_deref(), &message, printed).map(drop)
        })
    });
}

/// The writes of a stopped pull or merge of the main checkout.
fn conflicts(registry: &Registry) {
    registry.action::<GitResolve>(|call, input| {
        let write = main(input.write, format!("Resolving {}", input.path));
        let (path, resolution) = (input.path, input.resolution);
        landed(call, &input.repo, write, Touches::main(), move |repo, _| {
            api::git_resolve(repo, &path, &resolution)
        })
    });
    registry.action::<GitSaveConflict>(save_conflict);
    registry.action::<GitContinue>(|call, input| {
        let write = main(input.write, "Continuing");
        landed(
            call,
            &input.repo,
            write,
            Touches::main(),
            |repo, landing| api::git_continue(repo, |line| landing.printed(line)),
        )
    });
    registry.action::<GitAbort>(|call, input| {
        let write = main(input.write, "Aborting");
        landed(
            call,
            &input.repo,
            write,
            Touches::main(),
            |repo, landing| api::git_abort(repo, |line| landing.printed(line)),
        )
    });
}

/// The writes that remove a worktree: both write the main checkout's git folder too.
fn worktrees(registry: &Registry) {
    registry.action::<GitRemoveWorktree>(remove_worktree);
    registry.action::<GitClean>(|call, input| {
        let write = main(input.write, "Cleaning").and_feature(&input.folder);
        let touches = Touches::both(Some(&input.folder));
        let folder = input.folder;
        landed(call, &input.repo, write, touches, move |repo, _| {
            api::clean_feature(repo, &folder)
        })
    });
}

/// Queues a write of the page on the repository named `repo`, unless an agent works in a
/// checkout it touches: checked as it is queued, and again as it lands, since an agent may have
/// started meanwhile. `land` runs on the queue's thread, with the main checkout and the write
/// as it lands, for git's output.
fn queued<T: Send + 'static>(
    call: &Call,
    repo: &str,
    write: Write,
    touches: Touches,
    land: impl FnOnce(&Path, &Landing<'_>) -> Result<T, ApiError> + Send + 'static,
) -> Result<Queued<T>, Fault> {
    let shared = call.shared().clone();
    let path = repositories::path(&shared, repo)?;
    working::writable(&shared, &path, &touches)?;
    writing::land(call.shared(), repo, write, move |path, landing| {
        working::writable(&shared, path, &touches)?;
        Ok(land(path, landing)?)
    })
}

/// [`queued`], answered once it landed: a refusal stays in the queue's record.
fn landed<T: Send + 'static>(
    call: &Call,
    repo: &str,
    write: Write,
    touches: Touches,
    land: impl FnOnce(&Path, &Landing<'_>) -> Result<T, ApiError> + Send + 'static,
) -> Result<T, Fault> {
    queued(call, repo, write, touches, land)?.landed()
}

/// A person's fetch is a write of the queue, and fails as git does. The page's own, as it
/// opens, lands unseen and never fails: the page says why it brought nothing. Neither writes a
/// file of a checkout, so no agent refuses it.
fn fetch(call: &Call, input: GitFetch) -> Result<(), Fault> {
    if input.quiet {
        let _ = fetcher::fetch(call.shared(), &input.repo, Write::unseen());
        return Ok(());
    }
    fetcher::fetch(call.shared(), &input.repo, main(input.write, "Fetching"))
}

/// A save of the editor's text answers the file with its new hash, which the next save names.
/// A stale one is the call's refusal alone, and leaves the queue's record.
fn save_conflict(call: &Call, input: GitSaveConflict) -> Result<ConflictFile, Fault> {
    let write = main(input.write, format!("Saving {}", input.path));
    let (path, text, hash) = (input.path, input.text, input.hash);
    let saving = queued(call, &input.repo, write, Touches::main(), move |repo, _| {
        api::save_conflict_file(repo, &path, &text, &hash)
    })?;
    Ok(views::conflict_file(saving.answered()?))
}

/// A worktree's removal writes the main checkout's git folder, and the worktree of the feature
/// on its branch, if any: an agent that works in either refuses it.
fn remove_worktree(call: &Call, input: GitRemoveWorktree) -> Result<(), Fault> {
    let root = repositories::path(call.shared(), &input.repo)?;
    let mut listed = api::git_page(&root)?.worktrees.into_iter();
    let folder = listed
        .find(|worktree| worktree.path == input.path)
        .and_then(|worktree| worktree.folder);
    let write = main(input.write, format!("Removing {}", input.path));
    let write = match &folder {
        Some(folder) => write.and_feature(folder),
        None => write,
    };
    let touches = Touches::both(folder.as_deref());
    let path = input.path;
    landed(call, &input.repo, write, touches, move |repo, _| {
        api::git_remove_worktree(repo, &path)
    })
}
