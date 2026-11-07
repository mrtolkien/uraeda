//! A write recorded as a change: the bytes each regular file under its scope held before and after
//! it, whatever their kind, and the replay that writes one side back while every file holds the
//! other. A file the write left as it was may be kept with it, for a later commit to delete: its
//! undo writes it back once gone. A deferred commit's undo puts its files back the same way, from
//! what it kept.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io;
use std::path::Path;

use super::attach::SPECS;

/// The files a write changed, with what each held on both sides, and the commit its checkout was
/// at when it ran, `None` before the first commit.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Change {
    pub commit: Option<String>,
    pub files: Vec<ChangedFile>,
}

/// A file a write changed, by its path from the checkout's top level: its bytes before and after
/// the write, `None` on the side where it did not exist. A file whose two sides are the same bytes
/// is one the write left as it was, kept with the change because a commit may delete it since, as
/// an image the write unlinked: either side expects it absent or holding those bytes, an undo
/// writes it back when absent, and a redo leaves it as it is.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChangedFile {
    pub path: String,
    pub before: Option<Vec<u8>>,
    pub after: Option<Vec<u8>>,
}

/// What a replay writes to a file, and what puts it back should a later file fail: its bytes, or
/// `None` for no file.
type Step<'a> = (Option<&'a [u8]>, Option<&'a [u8]>);

/// Which way a change is replayed: an undo writes its `before` side back, a redo its `after` side.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Undo,
    Redo,
}

impl ChangedFile {
    /// Whether the write left the file as it was, kept with the change: see [`ChangedFile`].
    fn is_kept(&self) -> bool {
        self.before.is_some() && self.before == self.after
    }

    /// Whether the file holds what the replay in `direction` expects, `now` what stands there:
    /// a kept file may be absent.
    fn holds_expected(&self, now: Option<Option<&[u8]>>, direction: Direction) -> bool {
        let expected = Some(self.expected(direction));
        now == expected || (self.is_kept() && now == Some(None))
    }

    /// What the replay writes over `now`, and what puts it back: `None` for a file it leaves, a
    /// kept file present, or any kept file on a redo.
    fn step(&self, now: Option<Option<&[u8]>>, direction: Direction) -> Option<Step<'_>> {
        if !self.is_kept() {
            return Some((self.written(direction), self.expected(direction)));
        }
        (direction == Direction::Undo && now == Some(None))
            .then_some((self.written(direction), None))
    }

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

/// The bytes of every regular file under each of `scope`'s entries, from `root`: a file or a
/// folder, [`MARKDOWN`], or a folder's path and the start of a name followed by `*`, every file or
/// folder of that folder whose name starts so, as `specs/proposals/look*`. A symbolic link or a
/// special file stays out, never read nor written back: a link to a secret would put its bytes in
/// the change, and a pipe would block the read under the write lock.
pub(crate) fn snapshot(root: &Path, scope: &[&str]) -> BTreeMap<String, Vec<u8>> {
    scope
        .iter()
        .flat_map(|entry| scoped(root, entry.trim_end_matches('/')))
        .filter_map(|file| Some((file.clone(), regular(root, &file)??)))
        .collect()
}

/// What the regular file at `path` from `root` holds: `Some(None)` when nothing stands there,
/// `None` when something other than a regular file does, a symbolic link or a special file.
fn regular(root: &Path, path: &str) -> Option<Option<Vec<u8>>> {
    let full = root.join(path);
    match fs::symlink_metadata(&full) {
        Ok(metadata) if metadata.is_file() => Some(fs::read(&full).ok()),
        Ok(_) => None,
        Err(_) => Some(None),
    }
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

/// The files whose bytes differ between two snapshots of one scope, and each of `kept` the write
/// left as it was, kept with them: see [`ChangedFile`].
pub(crate) fn diff(
    mut before: BTreeMap<String, Vec<u8>>,
    mut after: BTreeMap<String, Vec<u8>>,
    commit: Option<String>,
    kept: &[&str],
) -> Change {
    let left: Vec<ChangedFile> = kept
        .iter()
        .filter_map(|path| {
            let bytes = before
                .get(*path)
                .filter(|bytes| after.get(*path) == Some(*bytes))?;
            Some(ChangedFile {
                path: (*path).to_string(),
                before: Some(bytes.clone()),
                after: Some(bytes.clone()),
            })
        })
        .collect();
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
        .chain(left)
        .collect();
    Change { commit, files }
}

/// The first file that no longer holds what the replay in `direction` expects: changed since, as
/// is one where a symbolic link or a special file stands now.
pub(crate) fn changed_since<'a>(
    root: &Path,
    files: &'a [ChangedFile],
    direction: Direction,
) -> Option<&'a ChangedFile> {
    files.iter().find(|file| {
        let now = regular(root, &file.path);
        !file.holds_expected(now.as_ref().map(Option::as_deref), direction)
    })
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
    let held: Vec<_> = files.iter().map(|file| regular(root, &file.path)).collect();
    let steps: Vec<_> = files
        .iter()
        .zip(&held)
        .filter_map(|(file, now)| {
            let (written, back) = file.step(now.as_ref().map(Option::as_deref), direction)?;
            Some((file.path.as_str(), written, back))
        })
        .collect();
    for (done, (path, written, _)) in steps.iter().enumerate() {
        if let Err(error) = put(root, path, *written, write) {
            for (path, _, back) in &steps[..=done] {
                let _ = put(root, path, *back, write);
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

    /// A file kept with a change may be gone, or hold its bytes, but not other bytes: then the
    /// undo is refused, as for any file changed since. A failing undo deletes the kept file it
    /// wrote back.
    #[test]
    fn a_kept_file_is_absent_or_the_same_and_its_failed_undo_removes_it() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("specs/blocked")).unwrap();
        let kept = ChangedFile {
            path: "specs/images/shot.png".to_string(),
            before: Some(b"shot".to_vec()),
            after: Some(b"shot".to_vec()),
        };
        let files = [
            kept.clone(),
            ChangedFile {
                path: "specs/blocked".to_string(),
                before: Some(b"file".to_vec()),
                after: None,
            },
        ];
        assert!(changed_since(root, &files[..1], Direction::Undo).is_none());

        assert!(replay(root, &files, Direction::Undo).is_err());
        assert!(!root.join(&kept.path).exists());

        fs::create_dir_all(root.join("specs/images")).unwrap();
        fs::write(root.join(&kept.path), b"other").unwrap();
        assert_eq!(
            changed_since(root, &files[..1], Direction::Undo),
            Some(&kept)
        );
        assert_eq!(
            changed_since(root, &files[..1], Direction::Redo),
            Some(&kept)
        );
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
