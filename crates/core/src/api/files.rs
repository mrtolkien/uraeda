//! The repository's files as they are read and written whole: a file's text, for links to code
//! and mockups, and the images attached to workflow files and chat messages.

use std::path::Path;

use super::{
    Result, default_checkout, feature_dir, feature_of, open, plain, refused, text_place, write_lock,
};
use crate::actions::attach;
use crate::git::Git;
use crate::images::{self, Encoded};
use crate::target;
use crate::today;
use crate::view::AttachedView;
use crate::workspace::Workspace;

/// A file of the repository as text, for links to code and mockups: a feature's file from where
/// its feature is read, any other from the checkout.
pub fn read_raw(repo: &Path, path: &str) -> Result<String> {
    // Hidden files and folders, like `.env` and `.git/`, are never served.
    if path
        .split('/')
        .any(|part| part.is_empty() || part.starts_with('.'))
    {
        return Err(refused(format!("{path}: no such file")));
    }
    let (git, workspace) = open(repo)?;
    raw_bytes(&git, &workspace, path)
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| refused(format!("{path}: no such file")))
}

/// A file's bytes, read as [`read_raw`] reads it.
fn raw_bytes(git: &Git, workspace: &Workspace, path: &str) -> Option<Vec<u8>> {
    match feature_of(workspace, path) {
        Some(feature) => match feature_dir(git, feature) {
            Some(dir) => read_plain(&dir, path),
            None => feature
                .branch
                .as_deref()
                .and_then(|branch| git.tip(branch))
                .or_else(|| {
                    workspace
                        .default_branch
                        .as_deref()
                        .and_then(|branch| git.tip(branch))
                })
                .and_then(|tip| git.read_file(tip, path).ok().flatten()),
        },
        // Any other file: only when it is tracked, read as it is in the checkout.
        None => git
            .head()
            .and_then(|head| git.read_file(head, path).ok().flatten())
            .and_then(|_| read_plain(git.root(), path)),
    }
}

/// Attaches an image to a draft, a proposal, or another markdown file of a feature's or a
/// change's folder: re-encoded, saved in the `images/` folder next to it, a single-file draft
/// becoming a folder first. `name` is the image's original file name, `None` for a pasted image.
/// The image is checked and encoded before the write lock is taken: encoding a large photo takes
/// seconds, which no other write waits for.
pub fn attach_image(
    repo: &Path,
    path: &str,
    bytes: &[u8],
    name: Option<&str>,
) -> Result<AttachedView> {
    if !plain(path) {
        return Err(refused(format!(
            "{path} is not a markdown file of a feature, a change, or a draft"
        )));
    }
    let encoded = encode_image(bytes, name.unwrap_or("pasted image"))?;
    let _lock = write_lock();
    let place = text_place(repo, path)?;
    let attached = attach::attach(&place, path, &encoded, name, today::stamp)?;
    Ok(AttachedView {
        path: attached.path,
        link: attached.link,
        moved: attached.moved,
    })
}

/// Checks and re-encodes an image, for a chat message or [`attach_image`]. `name` is its file name, for refusals.
pub fn encode_image(bytes: &[u8], name: &str) -> Result<Encoded> {
    images::encode(bytes, name).map_err(|error| refused(error.to_string()))
}

/// The bytes and the MIME type of a PNG, JPEG, GIF, or WebP file under `specs/`: a draft's from the
/// default branch's checkout, else read as [`read_raw`] reads it. Anything else is no such file.
pub fn read_image(repo: &Path, path: &str) -> Result<(Vec<u8>, &'static str)> {
    let missing = || refused(format!("{path}: no such file"));
    if !plain(path) || !path.starts_with("specs/") {
        return Err(missing());
    }
    let (git, workspace) = open(repo)?;
    let bytes = if target::is_draft(path) {
        let default = workspace.default_branch.as_deref();
        match default.and_then(|default| default_checkout(&git, default)) {
            Some(root) => read_plain(&root, path),
            None => default
                .and_then(|default| git.tip(default))
                .and_then(|tip| git.read_file(tip, path).ok().flatten()),
        }
    } else {
        raw_bytes(&git, &workspace, path)
    };
    let bytes = bytes.ok_or_else(missing)?;
    let mime = images::mime(&bytes).ok_or_else(missing)?;
    Ok((bytes, mime))
}

/// A file under `root`, when neither it nor a folder on its way is a symlink: a committed link
/// could point at any file the process can read.
fn read_plain(root: &Path, path: &str) -> Option<Vec<u8>> {
    let mut at = root.to_path_buf();
    for part in path.split('/') {
        at.push(part);
        if std::fs::symlink_metadata(&at)
            .ok()?
            .file_type()
            .is_symlink()
        {
            return None;
        }
    }
    std::fs::read(at).ok()
}
