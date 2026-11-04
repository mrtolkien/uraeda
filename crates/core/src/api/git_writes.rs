//! The Git page's writes, by repository path, each under the repository's write lock. A group's
//! writes act on its checkout, found from its folder, so the web never names a path to act on; the
//! remote writes, the merge, and a conflict's writes act on the main checkout. Each writes only a
//! file or a worktree the page lists, and none forces (see `specs/decisions/git.md`).

use std::path::Path;

use super::error::commit_error;
use super::git_page::group_root;
use super::{ConflictFileView, Result, find, open, refused, write_lock};
use crate::actions::ActionError;
use crate::actions::clean::{self, Left, Leftover, WhyLeft, relative};
use crate::files::document::hash;
use crate::git::{Git, Resolution};
use crate::view::CommitView;

/// The checkout of the group `folder`, opened: the workspace is read only for a feature's.
fn group(repo: &Path, folder: Option<&str>) -> Result<Git> {
    let root = match folder {
        None => Git::discover(repo)?.main_root(),
        Some(_) => {
            let (git, workspace) = open(repo)?;
            group_root(&git, &workspace, folder)?
        }
    };
    Ok(Git::open(&root)?)
}

/// The main checkout, opened.
fn main_checkout(repo: &Path) -> Result<Git> {
    group(repo, None)
}

/// Fetches `origin` in the main checkout, `on_output` given git's output as it comes.
pub fn git_fetch(repo: &Path, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.fetch(Some(&on_output))?)
}

/// Pulls the main checkout's branch from `origin`: see [`Git::pull`].
pub fn git_pull(repo: &Path, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.pull(Some(&on_output))?)
}

/// Pushes the main checkout's branch to `origin`, never forced: see [`Git::push`].
pub fn git_push(repo: &Path, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.push(Some(&on_output))?)
}

/// Merges `branch`, local or on `origin`, into the main checkout's branch.
pub fn git_merge(repo: &Path, branch: &str, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.merge_branch(branch, Some(&on_output))?)
}

/// Continues the main checkout's stopped pull or merge once its conflicts are resolved.
pub fn git_continue(repo: &Path, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.continue_stopped(Some(&on_output))?)
}

/// Aborts the main checkout's stopped pull or merge. The page asks first.
pub fn git_abort(repo: &Path, on_output: impl Fn(&str)) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.abort_stopped(Some(&on_output))?)
}

/// Stages `paths`, files or folders of the group `folder`'s checkout.
pub fn git_stage(repo: &Path, folder: Option<&str>, paths: &[String]) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(group(repo, folder)?.stage_paths(paths)?)
}

/// Unstages `paths`, files or folders of the group `folder`'s checkout.
pub fn git_unstage(repo: &Path, folder: Option<&str>, paths: &[String]) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(group(repo, folder)?.unstage_paths(paths)?)
}

/// Discards the changes to the file at `path` of the group `folder`'s checkout: see
/// [`Git::discard_path`]. The page asks first.
pub fn git_discard(repo: &Path, folder: Option<&str>, path: &str) -> Result<()> {
    let _lock = write_lock(repo);
    Ok(group(repo, folder)?.discard_path(path)?)
}

/// Commits what is staged in the group `folder`'s checkout with `message` as typed, through the
/// hooks, `on_output` given their output as it comes. A hook's refusal is `hook`, with the whole
/// output, and leaves the files staged.
pub fn git_commit_staged(
    repo: &Path,
    folder: Option<&str>,
    message: &str,
    on_output: impl Fn(&str),
) -> Result<CommitView> {
    let _lock = write_lock(repo);
    let commit = group(repo, folder)?
        .commit_index(message, Some(&on_output))
        .map_err(commit_error)?;
    Ok(CommitView {
        subject: message
            .trim()
            .lines()
            .next()
            .unwrap_or_default()
            .to_string(),
        commit: commit.to_hex_with_len(7).to_string(),
    })
}

/// Resolves the main checkout's conflicted file at `path` with a side whole, `ours` or `theirs`
/// as git names them, or by deleting it, and stages it.
pub fn git_resolve(repo: &Path, path: &str, resolution: &str) -> Result<()> {
    let resolution = match resolution {
        "ours" => Resolution::Ours,
        "theirs" => Resolution::Theirs,
        "delete" => Resolution::Delete,
        other => return Err(refused(format!("no resolution {other}"))),
    };
    let _lock = write_lock(repo);
    Ok(main_checkout(repo)?.resolve_conflict(path, resolution)?)
}

/// Saves `text` over the main checkout's conflicted file at `path`, read at `previous`, its hash
/// then. Refused for a file that is not conflicted, or binary, and as `conflict` when the file
/// changed since. Never stages: Continue does.
pub fn save_conflict_file(
    repo: &Path,
    path: &str,
    text: &str,
    previous: &str,
) -> Result<ConflictFileView> {
    let _lock = write_lock(repo);
    let git = main_checkout(repo)?;
    let path = git.checked(path)?;
    let conflict = git
        .checkout_state()?
        .conflicts
        .into_iter()
        .find(|conflict| conflict.path == path)
        .ok_or_else(|| refused(format!("{path} has no conflict.")))?;
    if conflict.is_binary {
        return Err(refused(format!("{path} is binary: take a side whole.")));
    }
    let file = git.root().join(path);
    if file.symlink_metadata().is_ok_and(|meta| meta.is_symlink()) {
        return Err(refused(format!("{path} is not in this checkout.")));
    }
    let current = std::fs::read_to_string(&file).unwrap_or_default();
    if hash(&current) != previous {
        return Err(ActionError::changed(path).into());
    }
    std::fs::write(&file, text)
        .map_err(|error| refused(format!("cannot write {path}: {error}")))?;
    Ok(ConflictFileView {
        id: path.to_string(),
        path: path.to_string(),
        text: text.to_string(),
        hash: hash(text),
    })
}

/// Removes the linked worktree at `path`, from the main checkout's root, as git lists it: never
/// forced, so one with changes is refused; a missing one has its record pruned. Its branch stays.
/// The page asks first.
pub fn git_remove_worktree(repo: &Path, path: &str) -> Result<()> {
    let _lock = write_lock(repo);
    let git = main_checkout(repo)?;
    let main = git.root();
    let record = git
        .worktree_records()?
        .into_iter()
        .find(|record| !path.is_empty() && relative(main, &record.path) == path)
        .ok_or_else(|| refused(format!("{path} is not a worktree.")))?;
    if record.missing {
        return Ok(git.prune_worktrees()?);
    }
    if Git::open(&record.path)?.has_local_changes()? {
        return Err(refused(format!(
            "{path} has changes: commit or discard them first."
        )));
    }
    Ok(git.remove_worktree(&record.path)?)
}

/// Cleans the merged feature of `folder` as `ura clean` does: its worktree, its branch, and its
/// line of the priorities. Refused, after what it could do, when something stays.
pub fn clean_feature(repo: &Path, folder: &str) -> Result<()> {
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let cleaned = clean::clean(&git, &workspace, find(&workspace, folder)?, false)?;
    if cleaned.left.is_empty() {
        return Ok(());
    }
    let stays: Vec<String> = cleaned.left.iter().map(stays).collect();
    Err(refused(stays.join(" ")))
}

/// Why a part of a cleaned feature stays, as the page says it.
fn stays(left: &Left) -> String {
    match (&left.what, &left.why) {
        (Leftover::Worktree(path), WhyLeft::Changes) => format!("{path} stays: it has changes."),
        (Leftover::Worktree(path), WhyLeft::Locked) => format!("{path} stays: it is locked."),
        (Leftover::Worktree(path), _) => format!("{path} stays."),
        (Leftover::Branch(branch), WhyLeft::Unmerged { bases, .. }) => format!(
            "The branch {branch} stays: it has commits {} lacks.",
            bases.join(" and ")
        ),
        (Leftover::Branch(branch), _) => format!("The branch {branch} stays."),
    }
}
