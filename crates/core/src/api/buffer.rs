//! A buffer: any Markdown file under `specs/`, read whole and saved as typed, never committed. A
//! feature's or a change's file, at any depth of its folder, is written on its branch; any other on
//! the default branch. Each save is recorded beside the checkout it wrote, for the Commit page.

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

/// Refuses a path that is not a Markdown file under `specs/`, or that climbs out of it.
fn markdown_of_specs(path: &str) -> Result<()> {
    if path.starts_with("specs/") && path.ends_with(".md") && plain(path) {
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

/// The branch a buffer's file is written on: its feature's or its change's, when it has one, else
/// the default branch.
fn branch_of(workspace: &Workspace, path: &str) -> Result<String> {
    if let Some(branch) = feature_of(workspace, path).and_then(|feature| feature.branch.clone()) {
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
/// hash.
pub fn save_buffer(repo: &Path, path: &str, text: &str, previous: &str) -> Result<String> {
    markdown_of_specs(path)?;
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let branch = branch_of(&workspace, path)?;
    let place = place::reach(&git, &branch)?;
    inside(&place.root, path)?;
    let saved = text::save(&place, path, text, previous)?;
    edited::record(&place, path)?;
    Ok(saved)
}
