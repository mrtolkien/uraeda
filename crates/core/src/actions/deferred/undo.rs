//! What a deferred commit wrote, file by file, and how a hook's refusal puts it back.

use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::Path;

use crate::git::Git;

/// The folder whose files a deferred commit can put back.
const SPECS: &str = "specs";

/// What a file under `specs/` held.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum Held {
    /// A Markdown file's bytes.
    Markdown(Vec<u8>),
    /// Another kind of file, like an image, whose bytes are not kept: undo leaves it alone, unless
    /// the write deleted it, when it comes back from `HEAD`.
    Other,
}

/// The files under a working tree's `specs/`, by path from its top level.
pub(super) type Before = HashMap<String, Held>;

/// What undo puts back at a file's path.
#[derive(Clone, Debug)]
enum Undone {
    /// The bytes it held before the write.
    Bytes(Vec<u8>),
    /// No file: it did not exist before the write.
    Absent,
    /// Its version at `HEAD`, when it is tracked: a file the write deleted, whose bytes were not
    /// kept, like an image.
    Head,
}

/// A file a deferred commit holds: what undo puts back at its path, and its bytes after the write,
/// `None` when the write deleted it.
#[derive(Clone)]
pub(super) struct Written {
    pub(super) path: String,
    before: Undone,
    pub(super) after: Option<Vec<u8>>,
}

/// What the files under the `specs/` of `root` hold.
pub(super) fn held(root: &Path) -> Before {
    files_under(root, SPECS)
        .into_iter()
        .filter_map(|file| {
            let held = if file.ends_with(".md") {
                Held::Markdown(fs::read(root.join(&file)).ok()?)
            } else {
                Held::Other
            };
            Some((file, held))
        })
        .collect()
}

/// Puts back what each file held before the write while it holds what the write left, and
/// returns the files left as they are: changed since, or failing to write. A file the write
/// deleted and whose bytes were not kept comes back as `HEAD` has it, when tracked.
pub(super) fn undo(root: &Path, written: &[Written]) -> Vec<String> {
    let mut left = Vec::new();
    let git = Git::open(root).ok();
    for file in written {
        let path = root.join(&file.path);
        let now = fs::read(&path).ok();
        if now != file.after {
            left.push(file.path.clone());
            continue;
        }
        let write = |bytes: &[u8]| {
            path.parent()
                .map_or(Ok(()), fs::create_dir_all)
                .and_then(|()| fs::write(&path, bytes))
        };
        let put_back = match &file.before {
            Undone::Bytes(bytes) if now.as_ref() == Some(bytes) => Ok(()),
            Undone::Bytes(bytes) => write(bytes),
            Undone::Absent if now.is_none() => Ok(()),
            Undone::Absent => fs::remove_file(&path).map(|()| remove_empty_folders(root, &path)),
            Undone::Head => match committed(git.as_ref(), &file.path) {
                Ok(Some(bytes)) => write(&bytes),
                // Never committed: nothing holds it to bring back.
                Ok(None) => Ok(()),
                Err(()) => Err(std::io::ErrorKind::NotFound.into()),
            },
        };
        if put_back.is_err() {
            left.push(file.path.clone());
        }
    }
    left
}

/// The bytes `HEAD` holds at `path`, `None` when it does not track it; an error when git cannot
/// be read.
fn committed(git: Option<&Git>, path: &str) -> Result<Option<Vec<u8>>, ()> {
    let git = git.ok_or(())?;
    match git.head() {
        Some(head) => git.read_file(head, path).map_err(drop),
        None => Ok(None),
    }
}

/// Removes the folders holding `path` that its removal left empty, up to `specs/`.
fn remove_empty_folders(root: &Path, path: &Path) {
    let specs = root.join(SPECS);
    let mut folder = path.parent();
    while let Some(dir) = folder.filter(|dir| dir.starts_with(&specs) && *dir != specs) {
        if fs::remove_dir(dir).is_err() {
            return;
        }
        folder = dir.parent();
    }
}

/// The files under `specs/` a change of `paths`, files or folders, holds: those of `before` and
/// those on disk now, with what each held before the write and holds after it. A file that was
/// not Markdown before is left out, undo leaving it alone, unless the write deleted it: it then
/// comes back from `HEAD`.
pub(super) fn written(root: &Path, before: &Before, paths: &[String]) -> Vec<Written> {
    let mut files = BTreeSet::new();
    for path in paths {
        let path = path.trim_end_matches('/');
        let folder = format!("{path}/");
        files.extend(
            before
                .keys()
                .filter(|file| *file == path || file.starts_with(&folder))
                .cloned(),
        );
        files.extend(files_under(root, path));
    }
    files
        .into_iter()
        .filter(|file| file.starts_with(&format!("{SPECS}/")))
        .filter_map(|file| {
            let after = fs::read(root.join(&file)).ok();
            let before = match before.get(&file) {
                Some(Held::Markdown(bytes)) => Undone::Bytes(bytes.clone()),
                Some(Held::Other) if after.is_none() => Undone::Head,
                Some(Held::Other) => return None,
                None => Undone::Absent,
            };
            Some(Written {
                path: file,
                before,
                after,
            })
        })
        .collect()
}

/// The files at `path` from `root`: itself, or every file under the folder, symbolic links not
/// followed; none when it does not exist.
fn files_under(root: &Path, path: &str) -> Vec<String> {
    let Ok(metadata) = fs::symlink_metadata(root.join(path)) else {
        return Vec::new();
    };
    if !metadata.is_dir() {
        return vec![path.to_string()];
    }
    let Ok(entries) = fs::read_dir(root.join(path)) else {
        return Vec::new();
    };
    entries
        .flatten()
        .flat_map(|entry| {
            files_under(
                root,
                &format!("{path}/{}", entry.file_name().to_string_lossy()),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Undo deletes a file the write created, with the folders it leaves empty, and leaves an
    /// image that was there before as the write left it.
    #[test]
    fn undo_deletes_what_the_write_created_and_leaves_images() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let write = |path: &str, bytes: &[u8]| {
            let path = root.join(path);
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, bytes).unwrap();
        };
        write("specs/README.md", b"# Specs\n");
        write("specs/images/shot.png", b"before");
        let before = held(root);

        write("specs/new/deep/note.md", b"# Note\n");
        write("specs/images/shot.png", b"after");
        let paths = ["specs/new".to_string(), "specs/images".to_string()];
        let written = written(root, &before, &paths);
        let left = undo(root, &written);

        assert!(left.is_empty(), "{left:?}");
        assert!(!root.join("specs/new").exists());
        assert!(root.join("specs/README.md").exists());
        assert_eq!(
            fs::read(root.join("specs/images/shot.png")).unwrap(),
            b"after"
        );
    }
}
