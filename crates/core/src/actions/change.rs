//! A write recorded as a change: the bytes each file under its scope held before and after it,
//! whatever their kind, and the replay that writes one side back while every file holds the
//! other. A deferred commit's undo puts its files back the same way, from what it kept.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::Path;

/// The folder whose files a change can hold.
const SPECS: &str = "specs";

/// The files a write changed, with what each held on both sides, and the commit its checkout was
/// at when it ran, `None` before the first commit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Change {
    pub commit: Option<String>,
    pub files: Vec<ChangedFile>,
}

/// A file a write changed, by its path from the checkout's top level: its bytes before and after
/// the write, `None` on the side where it did not exist.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangedFile {
    pub path: String,
    pub before: Option<Vec<u8>>,
    pub after: Option<Vec<u8>>,
}

/// Which way a change is replayed: an undo writes its `before` side back, a redo its `after` side.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Undo,
    Redo,
}

impl ChangedFile {
    /// What the file must hold for the replay to run.
    fn expected(&self, direction: Direction) -> Option<&[u8]> {
        match direction {
            Direction::Undo => self.after.as_deref(),
            Direction::Redo => self.before.as_deref(),
        }
    }

    /// What the replay writes.
    fn written(&self, direction: Direction) -> Option<&[u8]> {
        match direction {
            Direction::Undo => self.before.as_deref(),
            Direction::Redo => self.after.as_deref(),
        }
    }
}

/// A scope's entry for every Markdown file of `specs/`, at any depth: the files a relink may
/// write, without the images and other files beside them.
pub const MARKDOWN: &str = "specs/**/*.md";

/// The bytes of every file under each of `scope`'s entries, from `root`: a file or a folder,
/// [`MARKDOWN`], or a folder's path and the start of a name followed by `*`, every file or folder
/// of that folder whose name starts so, as `specs/proposals/look*`.
pub(crate) fn snapshot(root: &Path, scope: &[&str]) -> BTreeMap<String, Vec<u8>> {
    scope
        .iter()
        .flat_map(|entry| scoped(root, entry.trim_end_matches('/')))
        .filter_map(|file| Some((file.clone(), fs::read(root.join(&file)).ok()?)))
        .collect()
}

/// The files of one scope's `entry`, as [`snapshot`] reads them.
fn scoped(root: &Path, entry: &str) -> Vec<String> {
    if entry == MARKDOWN {
        let mut files = files_under(root, SPECS);
        files.retain(|file| file.ends_with(".md"));
        return files;
    }
    let Some((folder, start)) = entry.strip_suffix('*').and_then(|it| it.rsplit_once('/')) else {
        return files_under(root, entry);
    };
    let Ok(entries) = fs::read_dir(root.join(folder)) else {
        return Vec::new();
    };
    entries
        .flatten()
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| name.starts_with(start))
        .flat_map(|name| files_under(root, &format!("{folder}/{name}")))
        .collect()
}

/// The files whose bytes differ between two snapshots of one scope.
pub(crate) fn diff(
    mut before: BTreeMap<String, Vec<u8>>,
    mut after: BTreeMap<String, Vec<u8>>,
    commit: Option<String>,
) -> Change {
    let paths: BTreeSet<String> = before.keys().chain(after.keys()).cloned().collect();
    let files = paths
        .into_iter()
        .filter_map(|path| {
            let (before, after) = (before.remove(&path), after.remove(&path));
            (before != after).then_some(ChangedFile {
                path,
                before,
                after,
            })
        })
        .collect();
    Change { commit, files }
}

/// The first file that no longer holds what the replay in `direction` expects: changed since.
pub(crate) fn changed_since<'a>(
    root: &Path,
    files: &'a [ChangedFile],
    direction: Direction,
) -> Option<&'a ChangedFile> {
    files
        .iter()
        .find(|file| fs::read(root.join(&file.path)).ok().as_deref() != file.expected(direction))
}

/// Writes each file's side for `direction`, deleting a file absent on it with the folders it
/// leaves empty. A failing write puts back the files already written, and the one it failed on,
/// which it may have cut short, and fails.
pub(crate) fn replay(root: &Path, files: &[ChangedFile], direction: Direction) -> io::Result<()> {
    replay_with(root, files, direction, &|path, bytes| {
        fs::write(path, bytes)
    })
}

/// Writes a file's bytes: `fs::write`, or a test's write that fails halfway.
type Write<'a> = dyn Fn(&Path, &[u8]) -> io::Result<()> + 'a;

/// [`replay`], writing each file through `write`.
fn replay_with(
    root: &Path,
    files: &[ChangedFile],
    direction: Direction,
    write: &Write,
) -> io::Result<()> {
    for (done, file) in files.iter().enumerate() {
        if let Err(error) = put(root, &file.path, file.written(direction), write) {
            for file in &files[..=done] {
                let _ = put(root, &file.path, file.expected(direction), write);
            }
            return Err(error);
        }
    }
    Ok(())
}

/// Makes the file at `path` hold `bytes`, or not exist.
fn put(root: &Path, path: &str, bytes: Option<&[u8]>, write: &Write) -> io::Result<()> {
    let full = root.join(path);
    match bytes {
        Some(bytes) => {
            if let Some(parent) = full.parent() {
                fs::create_dir_all(parent)?;
            }
            write(&full, bytes)
        }
        None => match fs::remove_file(&full) {
            Ok(()) => {
                remove_empty_folders(root, &full);
                Ok(())
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        },
    }
}

/// Removes the folders holding `path` that its removal left empty, up to `specs/`.
pub(crate) fn remove_empty_folders(root: &Path, path: &Path) {
    let specs = root.join(SPECS);
    let mut folder = path.parent();
    while let Some(dir) = folder.filter(|dir| dir.starts_with(&specs) && *dir != specs) {
        if fs::remove_dir(dir).is_err() {
            return;
        }
        folder = dir.parent();
    }
}

/// The files at `path` from `root`: itself, or every file under the folder, symbolic links not
/// followed; none when it does not exist.
pub(crate) fn files_under(root: &Path, path: &str) -> Vec<String> {
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

    /// A replay that cannot write a file puts back those it wrote before it.
    #[test]
    fn a_failing_replay_puts_back_what_it_wrote() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("specs/blocked")).unwrap();
        fs::write(root.join("specs/a.md"), b"after").unwrap();
        let files = [
            ChangedFile {
                path: "specs/a.md".to_string(),
                before: Some(b"before".to_vec()),
                after: Some(b"after".to_vec()),
            },
            // A folder stands where the file goes: writing it fails.
            ChangedFile {
                path: "specs/blocked".to_string(),
                before: Some(b"file".to_vec()),
                after: None,
            },
        ];

        assert!(replay(root, &files, Direction::Undo).is_err());
        assert_eq!(fs::read(root.join("specs/a.md")).unwrap(), b"after");
    }

    /// A write that fails halfway, leaving its file cut short, puts that file back too.
    #[test]
    fn a_write_failing_halfway_puts_its_own_file_back() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("specs")).unwrap();
        fs::write(root.join("specs/a.md"), b"after a").unwrap();
        fs::write(root.join("specs/b.md"), b"after b").unwrap();
        let file = |name: &str| ChangedFile {
            path: format!("specs/{name}.md"),
            before: Some(format!("before {name}").into_bytes()),
            after: Some(format!("after {name}").into_bytes()),
        };
        let failed = std::cell::Cell::new(false);
        // The first write of `b.md` truncates it, then fails, as a full disk does.
        let write = |path: &Path, bytes: &[u8]| {
            if path.ends_with("b.md") && !failed.replace(true) {
                fs::write(path, &bytes[..2])?;
                return Err(io::Error::other("no space left"));
            }
            fs::write(path, bytes)
        };

        assert!(replay_with(root, &[file("a"), file("b")], Direction::Undo, &write).is_err());
        assert_eq!(fs::read(root.join("specs/a.md")).unwrap(), b"after a");
        assert_eq!(fs::read(root.join("specs/b.md")).unwrap(), b"after b");
    }
}
