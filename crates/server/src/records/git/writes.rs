//! The Git page's writes. Each runs in its repository's turn, after the writes made before it,
//! and is refused while an agent works in a checkout it writes. After each, landed or refused,
//! what the page shows is said to have changed.

use std::path::Path;

use uraeda_core::api::{self, ApiError};
use uraeda_protocol::{
    ConflictFile, GitAbort, GitClean, GitCommitStaged, GitContinue, GitDiscard, GitFetch, GitMerge,
    GitPull, GitPush, GitRemoveWorktree, GitResolve, GitSaveConflict, GitStage, GitUnstage,
};

use super::working::{self, Touches};
use super::{changed, fetcher, queue, repository, views};
use crate::live::{Call, Fault, Registry};

/// Git's output as it comes, which nothing shows yet.
// JOIN(wave 6): write queue, which shows a landing write's output
fn unheard(_line: &str) {}

pub(super) fn register(registry: &Registry) {
    sync(registry);
    index(registry);
    conflicts(registry);
    worktrees(registry);
}

/// The writes that sync the main checkout's branch: with `origin`, and with another branch.
fn sync(registry: &Registry) {
    registry.action::<GitFetch>(|call, input| fetch(call, &input));
    registry.action::<GitPull>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_pull(repo, unheard)
        })
    });
    registry.action::<GitPush>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_push(repo, unheard)
        })
    });
    registry.action::<GitMerge>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_merge(repo, &input.branch, unheard)
        })
    });
}

/// The writes of a group's index and working tree, and its commit.
fn index(registry: &Registry) {
    registry.action::<GitStage>(|call, input| {
        let folder = input.folder.as_deref();
        write(call, &input.repo, &Touches::group(folder), |repo| {
            api::git_stage(repo, folder, &input.paths)
        })
    });
    registry.action::<GitUnstage>(|call, input| {
        let folder = input.folder.as_deref();
        write(call, &input.repo, &Touches::group(folder), |repo| {
            api::git_unstage(repo, folder, &input.paths)
        })
    });
    registry.action::<GitDiscard>(|call, input| {
        let folder = input.folder.as_deref();
        write(call, &input.repo, &Touches::group(folder), |repo| {
            api::git_discard(repo, folder, &input.path)
        })
    });
    registry.action::<GitCommitStaged>(|call, input| {
        let folder = input.folder.as_deref();
        write(call, &input.repo, &Touches::group(folder), |repo| {
            api::git_commit_staged(repo, folder, &input.message, unheard).map(drop)
        })
    });
}

/// The writes of a stopped pull or merge of the main checkout.
fn conflicts(registry: &Registry) {
    registry.action::<GitResolve>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_resolve(repo, &input.path, &input.resolution)
        })
    });
    registry.action::<GitSaveConflict>(|call, input| save_conflict(call, &input));
    registry.action::<GitContinue>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_continue(repo, unheard)
        })
    });
    registry.action::<GitAbort>(|call, input| {
        write(call, &input.repo, &Touches::main(), |repo| {
            api::git_abort(repo, unheard)
        })
    });
}

/// The writes that remove a worktree: both write the main checkout's git folder too.
fn worktrees(registry: &Registry) {
    registry.action::<GitRemoveWorktree>(|call, input| remove_worktree(call, &input));
    registry.action::<GitClean>(|call, input| {
        let touches = Touches::both(Some(&input.folder));
        write(call, &input.repo, &touches, |repo| {
            api::clean_feature(repo, &input.folder)
        })
    });
}

/// Runs a write of the page on the repository named `repo`: in the repository's turn, and
/// unless an agent works in a checkout it touches, checked as it lands. Then says what the page
/// shows changed, landed or not: a refused write may have written a part.
fn write<T>(
    call: &Call,
    repo: &str,
    touches: &Touches,
    land: impl FnOnce(&Path) -> Result<T, ApiError>,
) -> Result<T, Fault> {
    let shared = call.shared();
    let path = repository::path(shared, repo)?;
    // JOIN(wave 6): write queue
    let landed = queue::in_turn(shared, &path, || {
        working::writable(shared, &path, touches)?;
        Ok(land(&path)?)
    });
    changed(call.bus(), repo);
    landed
}

/// A person's fetch fails as git does. The page's own, as it opens, never does: the page says
/// why it brought nothing. Neither writes a file of a checkout, so no agent refuses it.
fn fetch(call: &Call, input: &GitFetch) -> Result<(), Fault> {
    let path = repository::path(call.shared(), &input.repo)?;
    let fetched = fetcher::fetch(call.shared(), call.bus(), &input.repo, &path);
    if input.quiet { Ok(()) } else { fetched }
}

/// A save of the editor's text answers the file with its new hash, which the next save names.
fn save_conflict(call: &Call, input: &GitSaveConflict) -> Result<ConflictFile, Fault> {
    let saved = write(call, &input.repo, &Touches::main(), |repo| {
        api::save_conflict_file(repo, &input.path, &input.text, &input.hash)
    })?;
    Ok(views::conflict_file(saved))
}

/// A worktree's removal writes the main checkout's git folder, and the worktree of the feature
/// on its branch, if any: an agent that works in either refuses it.
fn remove_worktree(call: &Call, input: &GitRemoveWorktree) -> Result<(), Fault> {
    let path = repository::path(call.shared(), &input.repo)?;
    let mut listed = api::git_page(&path)?.worktrees.into_iter();
    let folder = listed
        .find(|worktree| worktree.path == input.path)
        .and_then(|worktree| worktree.folder);
    let touches = Touches::both(folder.as_deref());
    write(call, &input.repo, &touches, |repo| {
        api::git_remove_worktree(repo, &input.path)
    })
}
