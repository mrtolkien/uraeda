//! The relinker: every markdown file under a folder of a checkout rewritten for a list of moves,
//! and put back when the move does not land.

use std::fs;
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};

use super::ActionError;
use crate::files::retarget;
use crate::git::Git;
use crate::moves::{Move, Went};

/// The folder an Undo without memory relinks back.
const SPECS: &str = "specs";

/// A file the relinker rewrote: its path from the top level, its text before and after, the
/// links it changed, and whether it is `edited`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Relinked {
    pub path: String,
    pub before: String,
    pub after: String,
    pub links: usize,
    /// Kept out of a move's commit: a file with uncommitted edits, or a file no commit has,
    /// untracked or ignored, which `git add` would take as new or refuse.
    pub edited: bool,
}

/// The move of the file or folder `from` to `to`, both from the top level, with no anchor of its
/// own: a link keeps its anchor.
pub fn moved(from: &str, to: &str) -> Move {
    Move {
        from: from.to_string(),
        went: Went::Moved {
            path: to.to_string(),
            anchor: None,
        },
    }
}

/// The paths of `relinked` a move commits: the files that are not `edited`.
pub fn committed(relinked: &[Relinked]) -> Vec<String> {
    relinked
        .iter()
        .filter(|file| !file.edited)
        .map(|file| file.path.clone())
        .collect()
}

/// Rewrites every markdown file under `under` (a folder or a file of a `specs/` folder, from the
/// top level of `root`, a trailing `/` allowed) but `skip`, for `moves`: all written, or none and
/// the error. Files are visited in path order, never through a dot-folder or a symbolic link, and
/// a file that is not UTF-8 is left alone. Refused when `under` is empty, absolute, holds a `.` or
/// `..` segment, or names no `specs` folder.
pub fn relink(
    root: &Path,
    under: &str,
    moves: &[Move],
    skip: &[&str],
) -> Result<Vec<Relinked>, ActionError> {
    let under = clean(under)?;
    let git = Git::open(root).ok();
    let relinked = rewrites(root, under, moves, skip, git.as_ref(), |_, _| true)?;
    write_all(root, &relinked)?;
    Ok(relinked)
}

/// Puts back each file still holding what the relinker wrote: the paths left, changed since or
/// that could not be written.
pub fn put_back(root: &Path, relinked: &[Relinked]) -> Vec<String> {
    relinked
        .iter()
        .filter(|file| {
            let path = root.join(&file.path);
            let unchanged = fs::read_to_string(&path).is_ok_and(|now| now == file.after);
            !(unchanged && replace(&path, &file.before).is_ok())
        })
        .map(|file| file.path.clone())
        .collect()
}

/// `under` without its trailing `/`, or refused when it is empty, absolute, holds a `.` or `..`
/// segment, or names no `specs` folder.
fn clean(under: &str) -> Result<&str, ActionError> {
    let path = under.trim_end_matches('/');
    let segments: Vec<&str> = path.split('/').collect();
    let plain = segments
        .iter()
        .all(|segment| !matches!(*segment, "" | "." | ".."));
    if plain && segments.contains(&SPECS) {
        Ok(path)
    } else {
        Err(ActionError::Refused(format!(
            "cannot relink under {under:?}: not a path under a specs/ folder"
        )))
    }
}

/// The rewrite of each markdown file under `under` but `skip` that `moves` change and `wanted`
/// takes, given its path and text, without writing them. `edited` is false without `git`.
fn rewrites(
    root: &Path,
    under: &str,
    moves: &[Move],
    skip: &[&str],
    git: Option<&Git>,
    wanted: impl Fn(&str, &str) -> bool,
) -> Result<Vec<Relinked>, ActionError> {
    let mut files = Vec::new();
    markdown_files(root, under, &mut files);
    files.sort();
    let mut relinked = Vec::new();
    for path in files {
        if skip.contains(&path.as_str()) {
            continue;
        }
        let Ok(before) = fs::read_to_string(root.join(&path)) else {
            continue;
        };
        let folder = path.rsplit_once('/').map_or("", |(folder, _)| folder);
        let (after, links) = retarget::relink(&before, folder, moves);
        if after == before || !wanted(&path, &before) {
            continue;
        }
        let edited = match git {
            Some(git) => {
                let held = git
                    .head()
                    .is_some_and(|head| git.entry_id(head, &path).is_some());
                !held || git.differs_from_head(&path)?
            }
            None => false,
        };
        relinked.push(Relinked {
            path,
            before,
            after,
            links,
            edited,
        });
    }
    Ok(relinked)
}

/// Every markdown file at or under `path`, never through a symbolic link nor a dot-folder.
fn markdown_files(root: &Path, path: &str, files: &mut Vec<String>) {
    let Ok(kind) = fs::symlink_metadata(root.join(path)).map(|meta| meta.file_type()) else {
        return;
    };
    if kind.is_file() && path.ends_with(".md") {
        files.push(path.to_string());
    }
    if !kind.is_dir() {
        return;
    }
    let Ok(entries) = fs::read_dir(root.join(path)) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !name.starts_with('.') {
            markdown_files(root, &format!("{path}/{name}"), files);
        }
    }
}

/// Writes each file's rewrite, or, when a write fails, puts back the ones written and returns
/// the error, naming any of them that could not be put back. The file whose write failed is as it
/// was: [`replace`] never leaves a file half written.
fn write_all(root: &Path, relinked: &[Relinked]) -> Result<(), ActionError> {
    for (done, file) in relinked.iter().enumerate() {
        if let Err(error) = replace(&root.join(&file.path), &file.after) {
            let left = put_back(root, &relinked[..done]);
            let mut message = format!("cannot write {}: {error}", file.path);
            if !left.is_empty() {
                message.push_str(&format!(", and cannot put back {}", left.join(", ")));
            }
            return Err(ActionError::Io(message));
        }
    }
    Ok(())
}

/// Writes `text` over the file at `path` at once: into a new file beside it, given the file's
/// permissions, then renamed over it, so a failed write leaves the file as it was.
fn replace(path: &Path, text: &str) -> std::io::Result<()> {
    static COUNT: AtomicUsize = AtomicUsize::new(0);
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    let count = COUNT.fetch_add(1, Ordering::Relaxed);
    let temporary = path.with_file_name(format!(".{name}.relink-{}-{count}", std::process::id()));
    let written = (|| {
        let permissions = fs::metadata(path)?.permissions();
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(text.as_bytes())?;
        file.set_permissions(permissions)?;
        fs::rename(&temporary, path)
    })();
    if written.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    written
}
