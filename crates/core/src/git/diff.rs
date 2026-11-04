//! A file's diff, from `HEAD` to the working tree or across a commit, and the files a commit
//! changed: blobs read through gix, lines compared with gix's diff (imara-diff, git's Myers with
//! its slider heuristics), written in the unified format with 3 lines of context.

use std::fmt::Write as _;
use std::io::Read as _;
use std::path::Path;

use gix::diff::blob::unified_diff::{ConsumeHunk, ContextSize, DiffLineKind, HunkHeader};
use gix::diff::blob::{Algorithm, Diff, InternedInput, UnifiedDiff, diff_with_slider_heuristics};
use gix::object::tree::diff::ChangeDetached;

use super::checkout::COUNT_CAP;
use super::{Git, GitError, ObjectId, read_error};
use crate::changes::ChangedFile;

/// The most lines a diff shows until the whole is asked for: its added and removed lines.
pub const DIFF_CAP: usize = 1_000;

/// What a file's diff compares.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DiffOf {
    /// `HEAD` to the file on disk, its staged and unstaged changes together.
    Worktree,
    /// A commit's first parent, or nothing for a root commit, to the commit.
    Commit(ObjectId),
}

/// A file's diff.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileDiff {
    /// From the repository's top level.
    pub path: String,
    /// The unified diff, `--- a/` and `+++ b/` headers first (`/dev/null` for a side without the
    /// file), each hunk with 3 lines of context: `None` for a binary file, or a capped one.
    pub text: Option<String>,
    /// A binary file's sizes before and after, in bytes, 0 for a side without the file.
    pub binary: Option<(u64, u64)>,
    pub added: u32,
    pub removed: u32,
    /// More than [`DIFF_CAP`] lines added and removed, or a side of text past 1 MiB, its lines
    /// then not counted, and the whole was not asked for.
    pub is_capped: bool,
}

/// A commit and the files it changed from its first parent, each with its counts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitFiles {
    pub id: ObjectId,
    /// The first line of its message.
    pub subject: String,
    /// The rest of its message, trimmed.
    pub body: String,
    /// When it was written, in Unix seconds.
    pub authored: i64,
    /// Sorted by path.
    pub files: Vec<ChangedFile>,
}

impl Git {
    /// The diff of the file at `path`: capped past [`DIFF_CAP`] lines, or a side past 1 MiB, unless
    /// `whole`.
    pub fn file_diff(&self, of: DiffOf, path: &str, whole: bool) -> Result<FileDiff, GitError> {
        let (before, after) = match of {
            DiffOf::Worktree => {
                let path = self.checked(path)?;
                (self.at_head(path)?, on_disk(&self.root, path)?)
            }
            DiffOf::Commit(id) => {
                let parent = self.first_parent(id)?;
                let before = parent.map(|parent| self.read_file(parent, path));
                (before.transpose()?.flatten(), self.read_file(id, path)?)
            }
        };
        let (old, new) = (before.as_deref(), after.as_deref());
        let mut diff = FileDiff {
            path: path.to_string(),
            text: None,
            binary: None,
            added: 0,
            removed: 0,
            is_capped: false,
        };
        let (old_bytes, new_bytes) = (old.unwrap_or_default(), new.unwrap_or_default());
        // A text side past `COUNT_CAP` is capped before its lines are counted, as the page's list
        // leaves its counts out; a binary one still gives its sizes.
        let big = old_bytes.len().max(new_bytes.len()) > COUNT_CAP;
        if !whole && big && !is_binary(old_bytes) && !is_binary(new_bytes) {
            diff.is_capped = true;
            return Ok(diff);
        }
        let Some((added, removed)) = line_counts(old_bytes, new_bytes) else {
            let size = |side: Option<&[u8]>| side.map_or(0, |bytes| bytes.len() as u64);
            diff.binary = Some((size(old), size(new)));
            return Ok(diff);
        };
        (diff.added, diff.removed) = (added, removed);
        diff.is_capped = !whole && (added + removed) as usize > DIFF_CAP;
        if !diff.is_capped {
            diff.text = Some(unified(path, old, new));
        }
        Ok(diff)
    }

    /// The commit `id`, and the files it changed from its first parent, or from nothing for a
    /// root commit.
    pub fn commit_files(&self, id: ObjectId) -> Result<CommitFiles, GitError> {
        let what = id.to_hex_with_len(7).to_string();
        let commit = self
            .repo
            .find_commit(id)
            .map_err(read_error(what.as_str()))?;
        let message = String::from_utf8_lossy(commit.message_raw_sloppy()).into_owned();
        let (subject, body) = message.split_once('\n').unwrap_or((&message, ""));
        let authored = commit
            .author()
            .map_err(read_error(what.as_str()))?
            .seconds();
        let tree = commit.tree().map_err(read_error(what.as_str()))?;
        let parent = self.first_parent(id)?.map(|parent| self.tree(parent));
        let parent = parent.transpose()?;
        let changes = self
            .repo
            .diff_tree_to_tree(parent.as_ref(), &tree, gix::diff::Options::default())
            .map_err(read_error(what.as_str()))?;
        let mut files = Vec::new();
        for change in &changes {
            if let Some(file) = self.changed_file(change)? {
                files.push(file);
            }
        }
        files.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(CommitFiles {
            id,
            subject: subject.trim().to_string(),
            body: body.trim().to_string(),
            authored,
            files,
        })
    }

    /// A file of a tree's change with its counts, `None` for a folder or a submodule.
    fn changed_file(&self, change: &ChangeDetached) -> Result<Option<ChangedFile>, GitError> {
        if !change.entry_mode().is_blob_or_symlink() {
            return Ok(None);
        }
        let path = change.location().to_string();
        let (before, after) = match change {
            ChangeDetached::Addition { id, .. } => (None, Some(*id)),
            ChangeDetached::Deletion { id, .. } => (Some(*id), None),
            ChangeDetached::Modification {
                previous_id,
                previous_entry_mode,
                id,
                ..
            } => (
                previous_entry_mode
                    .is_blob_or_symlink()
                    .then_some(*previous_id),
                Some(*id),
            ),
            ChangeDetached::Rewrite { source_id, id, .. } => (Some(*source_id), Some(*id)),
        };
        let (before, after) = (self.blob(before, &path)?, self.blob(after, &path)?);
        let counts = line_counts(&before, &after);
        Ok(Some(ChangedFile {
            path,
            added: counts.map(|(added, _)| added),
            removed: counts.map(|(_, removed)| removed),
        }))
    }

    /// A blob's bytes, empty for none.
    fn blob(&self, id: Option<ObjectId>, path: &str) -> Result<Vec<u8>, GitError> {
        let Some(id) = id else {
            return Ok(Vec::new());
        };
        let blob = self.repo.find_blob(id).map_err(read_error(path))?;
        Ok(blob.data.clone())
    }

    /// The file at `path` in `HEAD`, `None` when it has none, or `HEAD` is unborn.
    pub(super) fn at_head(&self, path: &str) -> Result<Option<Vec<u8>>, GitError> {
        match self.head() {
            Some(head) => self.read_file(head, path),
            None => Ok(None),
        }
    }

    fn first_parent(&self, id: ObjectId) -> Result<Option<ObjectId>, GitError> {
        let what = id.to_hex_with_len(7).to_string();
        let commit = self.repo.find_commit(id).map_err(read_error(what))?;
        Ok(commit.parent_ids().next().map(|parent| parent.detach()))
    }
}

/// The file at `path` on disk, as git stores it: a symbolic link's target, `None` when missing.
pub(super) fn on_disk(root: &Path, path: &str) -> Result<Option<Vec<u8>>, GitError> {
    let file = root.join(path);
    let read = match std::fs::symlink_metadata(&file) {
        Ok(meta) if meta.is_symlink() => std::fs::read_link(&file)
            .map(|target| target.to_string_lossy().into_owned().into_bytes()),
        Ok(meta) if meta.is_file() => std::fs::read(&file),
        Ok(_) => return Ok(None),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => Err(error),
    };
    read.map(Some).map_err(read_error(path))
}

/// How many first bytes git looks in for a NUL, which makes a file binary.
const BINARY_PREFIX: usize = 8_000;

/// Whether git takes `bytes` as binary: a NUL in its first 8,000 bytes.
pub(super) fn is_binary(bytes: &[u8]) -> bool {
    bytes[..bytes.len().min(BINARY_PREFIX)].contains(&0)
}

/// Whether the regular file at `path` on disk is binary, from its first 8,000 bytes alone: a
/// symbolic link, a missing file, or one that cannot be read is not.
pub(super) fn starts_binary(root: &Path, path: &str) -> bool {
    let file = root.join(path);
    if !std::fs::symlink_metadata(&file).is_ok_and(|meta| meta.is_file()) {
        return false;
    }
    let mut prefix = Vec::with_capacity(BINARY_PREFIX);
    std::fs::File::open(&file)
        .and_then(|file| file.take(BINARY_PREFIX as u64).read_to_end(&mut prefix))
        .is_ok_and(|_| is_binary(&prefix))
}

/// The lines added and removed from `before` to `after`, `None` when either is binary.
pub(super) fn line_counts(before: &[u8], after: &[u8]) -> Option<(u32, u32)> {
    if is_binary(before) || is_binary(after) {
        return None;
    }
    let input = InternedInput::new(before, after);
    let diff = line_diff(&input);
    Some((diff.count_additions(), diff.count_removals()))
}

fn line_diff(input: &InternedInput<&[u8]>) -> Diff {
    diff_with_slider_heuristics(Algorithm::Myers, input)
}

/// The unified diff of two texts, `None` a side without the file.
fn unified(path: &str, before: Option<&[u8]>, after: Option<&[u8]>) -> String {
    let side = |prefix: &str, side: Option<&[u8]>| match side {
        Some(_) => format!("{prefix}/{path}"),
        None => "/dev/null".to_string(),
    };
    let mut text = format!("--- {}\n+++ {}\n", side("a", before), side("b", after));
    let input = InternedInput::new(before.unwrap_or_default(), after.unwrap_or_default());
    let diff = line_diff(&input);
    let hunks = UnifiedDiff::new(
        &diff,
        &input,
        Hunks(String::new()),
        ContextSize::symmetrical(3),
    )
    .consume()
    .unwrap_or_default();
    text.push_str(&hunks);
    text
}

/// Writes each hunk as git does: its header, an empty side starting at the line before, so a
/// whole file added reads `@@ -0,0 +1,2 @@`, then each line with its prefix, a last line without
/// a newline marked "\ No newline at end of file".
struct Hunks(String);

impl ConsumeHunk for Hunks {
    type Out = String;

    fn consume_hunk(
        &mut self,
        mut header: HunkHeader,
        lines: &[(DiffLineKind, &[u8])],
    ) -> std::io::Result<()> {
        if header.before_hunk_len == 0 {
            header.before_hunk_start = header.before_hunk_start.saturating_sub(1);
        }
        if header.after_hunk_len == 0 {
            header.after_hunk_start = header.after_hunk_start.saturating_sub(1);
        }
        writeln!(self.0, "{header}").map_err(std::io::Error::other)?;
        for (kind, line) in lines {
            self.0.push(kind.to_prefix());
            self.0.push_str(&String::from_utf8_lossy(line));
            if !line.ends_with(b"\n") {
                self.0.push_str("\n\\ No newline at end of file\n");
            }
        }
        Ok(())
    }

    fn finish(self) -> String {
        self.0
    }
}
