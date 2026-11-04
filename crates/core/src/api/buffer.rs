//! A buffer: any Markdown file under `specs/`, read whole and saved as typed, never committed. A
//! feature's or a change's file, at any depth of its folder, is written on its branch; any other on
//! the default branch. Each save is recorded beside the checkout it wrote, for the Git page.

use std::path::{Component, Path, PathBuf};

use serde::Serialize;

use super::{Result, default_checkout, feature_of, open, plain, refused, write_lock};
use crate::actions::{edited, place, text};
use crate::files::document::hash;
use crate::git::Git;
use crate::workspace::Workspace;

/// A buffer's file as read: its whole text, frontmatter included, and the branch it is written on.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferView {
    pub path: String,
    pub text: String,
    pub hash: String,
    pub branch: String,
}

fn not_a_buffer(path: &str) -> super::ApiError {
    refused(format!("{path} is not a Markdown file of specs/"))
}

/// Refuses a path that is not a Markdown file under `specs/`, that climbs out of it, or that holds
/// a control character, which would split it in the record of edits, one path per line.
fn markdown_of_specs(path: &str) -> Result<()> {
    if path.starts_with("specs/")
        && path.ends_with(".md")
        && plain(path)
        && !path.contains(char::is_control)
    {
        Ok(())
    } else {
        Err(not_a_buffer(path))
    }
}

/// Refuses a path of the checkout at `root` that a symlink takes outside its `specs/`: the nearest
/// part of it on disk, a link to a missing file included, resolves inside `specs/`, and the rest is
/// plain names.
fn inside(root: &Path, path: &str) -> Result<()> {
    let refuse = || not_a_buffer(path);
    let specs = std::fs::canonicalize(root)
        .map_err(|_| refuse())?
        .join("specs");
    let full = root.join(path);
    let on_disk = full
        .ancestors()
        .find(|ancestor| ancestor.symlink_metadata().is_ok())
        .ok_or_else(refuse)?;
    // A link to a missing file does not resolve: it is refused, as a write would follow it.
    let resolved = std::fs::canonicalize(on_disk).map_err(|_| refuse())?;
    let rest = full.strip_prefix(on_disk).map_err(|_| refuse())?;
    let resolved: PathBuf = resolved.join(rest);
    let plain_rest = rest
        .components()
        .all(|part| matches!(part, Component::Normal(_)));
    if plain_rest && resolved.starts_with(&specs) {
        Ok(())
    } else {
        Err(refuse())
    }
}

/// The feature or change whose branch is `branch`, finished or not: the one a buffer's file of its
/// folder is written for, and whose group on the Git page commits it.
pub(super) fn branch_owner<'a>(
    workspace: &'a Workspace,
    branch: &str,
) -> Option<&'a crate::workspace::Feature> {
    workspace
        .features
        .iter()
        .find(|feature| feature.branch.as_deref() == Some(branch))
}

/// The feature or change a buffer's file is written for, on its branch: none for a file of the
/// default branch, a merged feature's included.
fn owner<'a>(workspace: &'a Workspace, path: &str) -> Option<&'a crate::workspace::Feature> {
    branch_owner(workspace, feature_of(workspace, path)?.branch.as_deref()?)
}

/// The folder of the feature or change whose branch a buffer's file is written on, as an agent's
/// session names it: none for a file of the default branch.
pub fn buffer_folder(repo: &Path, path: &str) -> Result<Option<String>> {
    markdown_of_specs(path)?;
    let (_, workspace) = open(repo)?;
    Ok(owner(&workspace, path).map(|feature| feature.folder.clone()))
}

/// The branch a buffer's file is written on: its feature's or its change's, when it has one, else
/// the default branch.
fn branch_of(workspace: &Workspace, path: &str) -> Result<String> {
    if let Some(branch) = owner(workspace, path).and_then(|feature| feature.branch.clone()) {
        return Ok(branch);
    }
    workspace
        .default_branch
        .clone()
        .ok_or_else(|| refused("no default branch: commit on main first"))
}

/// A file's text from the checkout that has its branch, else from the branch's tip.
fn read_on(git: &Git, branch: &str, path: &str) -> Result<String> {
    let missing = || refused(format!("{path}: no such file"));
    if let Some(root) = default_checkout(git, branch) {
        inside(&root, path)?;
        return std::fs::read_to_string(root.join(path)).map_err(|_| missing());
    }
    let bytes = git
        .tip(branch)
        .and_then(|tip| git.read_file(tip, path).ok().flatten())
        .ok_or_else(missing)?;
    String::from_utf8(bytes).map_err(|_| missing())
}

/// A Markdown file under `specs/`, whole, as its branch has it: from the checkout with the branch,
/// else from its tip, without creating a worktree.
pub fn read_buffer(repo: &Path, path: &str) -> Result<BufferView> {
    markdown_of_specs(path)?;
    let (git, workspace) = open(repo)?;
    let branch = branch_of(&workspace, path)?;
    let text = read_on(&git, &branch, path)?;
    Ok(BufferView {
        path: path.to_string(),
        hash: hash(&text),
        text,
        branch,
    })
}

/// Saves a Markdown file under `specs/` as typed, over the version read at `previous`, on its
/// branch, and records it as a buffer's edit of that checkout. Never commits. Returns the new
/// hash. The path is checked in the checkout that has the branch before reaching it, so a refused
/// path makes no worktree; one made for it is removed.
pub fn save_buffer(repo: &Path, path: &str, text: &str, previous: &str) -> Result<String> {
    markdown_of_specs(path)?;
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let branch = branch_of(&workspace, path)?;
    if let Some(root) = default_checkout(&git, &branch) {
        inside(&root, path)?;
    }
    let place = place::reach(&git, &branch)?;
    if let Err(error) = inside(&place.root, path) {
        if place.created {
            // Just made from the branch, it holds nothing of the human's.
            let _ = git.remove_worktree(&place.root);
        }
        return Err(error);
    }
    record_and_save(&place, path, text, previous)
}

/// Records the edit, then writes it: a write that fails takes its new record back, and a record
/// that fails writes nothing, so the record names every file a buffer changed.
fn record_and_save(place: &place::Place, path: &str, text: &str, previous: &str) -> Result<String> {
    let recorded = edited::list(place).iter().any(|edited| edited == path);
    edited::record(place, path)?;
    let saved = text::save(place, path, text, previous).inspect_err(|_| {
        if !recorded {
            let _ = edited::clear(place, &[path.to_string()]);
        }
    })?;
    Ok(saved)
}
