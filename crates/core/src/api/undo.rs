//! The undo and redo of the web UI's writes: each undoable write runs through [`recorded`], which
//! keeps what the files under its scope held before and after it, and [`apply_change`] writes one
//! side back while every file holds the other. Neither commits, nor runs any git command to undo.
//! A file's checkout is found as a buffer's is: a feature's or a change's file on its branch, any
//! other on the default branch.

use std::path::Path;
use std::sync::Arc;

use super::buffer::{branch_of, inside};
use super::{ApiError, Result, default_checkout, open, refused, write_lock};
use crate::actions::change;
pub use crate::actions::change::{Change, ChangedFile, Direction, MARKDOWN};
use crate::actions::{attach, place, review};
use crate::cache;
use crate::git::Git;
use crate::workspace::Workspace;

/// The inbox alone: a note's add, edit, and move, and a category's add and rename.
pub const INBOX: &[&str] = &["specs/INBOX.md"];
/// The inbox and the note files: a note's removal, a category's, and a note's added with images.
pub const NOTES: &[&str] = &["specs/INBOX.md", "specs/notes"];
/// The inbox, the note files, and every Markdown file of `specs/`: a note's images, which make a
/// single note file a folder and point the links of every file at where it went.
pub const NOTE_IMAGES: &[&str] = &["specs/INBOX.md", "specs/notes", MARKDOWN];
/// The priorities alone: a proposal's add, edit, move, and removal.
pub const PRIORITIES: &[&str] = &["specs/PRIORITIES.md"];
/// Both lists and the files they link: a note's promotion.
pub const PROMOTION: &[&str] = &[
    "specs/INBOX.md",
    "specs/PRIORITIES.md",
    "specs/notes",
    "specs/proposals",
];
/// Both lists, the files they link, and every Markdown file of `specs/`: a promotion that moves a
/// note file, to a level or into a proposal file, or takes it into a proposal, and points the links of every file at where it went.
pub const RELINKING_PROMOTION: &[&str] = &[
    "specs/INBOX.md",
    "specs/PRIORITIES.md",
    "specs/notes",
    "specs/proposals",
    MARKDOWN,
];
/// The priorities and the proposal files: a proposal's expansion into a file.
pub const EXPAND: &[&str] = &["specs/PRIORITIES.md", "specs/proposals"];

/// The review file of a feature's or a change's `file`, `spec.md` or `plan.md`: what a comment,
/// its edit and removal, and Start over write.
pub fn review(repo: &Path, folder: &str, file: &str) -> Result<Vec<String>> {
    let (_, workspace) = open(repo)?;
    let feature = super::find(&workspace, folder)?;
    Ok(vec![format!(
        "{}/{}",
        feature.path,
        review::review_name(file)
    )])
}

/// The latest round of questions of a feature or a change: what a comment on one of its settled
/// points, and that comment's removal, write.
pub fn round(repo: &Path, folder: &str) -> Result<Vec<String>> {
    let (_, workspace) = open(repo)?;
    let feature = super::find(&workspace, folder)?;
    Ok(vec![crate::actions::answer::round_path(feature)?])
}

/// What an image's removal from the note file or proposal file `file` writes: the inbox, and the
/// file's folder.
pub fn note_image(file: &str) -> Vec<String> {
    let folder = file.rsplit_once('/').map_or(file, |(folder, _)| folder);
    vec![INBOX[0].to_string(), folder.to_string()]
}

/// What attaching an image to the Markdown file `path` writes: the file and its folder, or, for a
/// single proposal file or note file, which becomes a folder named after it and has its links
/// followed, the file, the folders named after it, and every Markdown file of `specs/`.
pub fn attached(path: &str) -> Vec<String> {
    match path.rsplit_once('/') {
        Some((folder, name)) if attach::is_single(path) => {
            let slug = name.strip_suffix(".md").unwrap_or(name);
            vec![
                path.to_string(),
                format!("{folder}/{slug}*"),
                MARKDOWN.to_string(),
            ]
        }
        Some((folder, _)) => vec![path.to_string(), folder.to_string()],
        None => vec![path.to_string()],
    }
}

/// Runs `write` under the repository's write lock, and returns what it answers with the change it
/// made to the files under `scope`, files or folders of `specs/`, in the checkout of `scope[0]`. A
/// failing `write` returns its error, and no change. `write` takes the lock again on this thread,
/// so no other write lands between the snapshots.
pub fn recorded<T, S: AsRef<str>>(
    repo: &Path,
    scope: &[S],
    write: impl FnOnce() -> Result<T>,
) -> Result<(T, Change)> {
    recorded_keeping(repo, scope, &[], write)
}

/// [`recorded`], keeping with the change each file of `kept`, under `scope`, that the write left as
/// it was: a later commit may delete it, as the image an image's removal unlinked, and the undo
/// writes it back once gone.
pub fn recorded_keeping<T, S: AsRef<str>>(
    repo: &Path,
    scope: &[S],
    kept: &[S],
    write: impl FnOnce() -> Result<T>,
) -> Result<(T, Change)> {
    let scope: Vec<&str> = scope.iter().map(AsRef::as_ref).collect();
    let kept: Vec<&str> = kept.iter().map(AsRef::as_ref).collect();
    let first = *scope
        .first()
        .ok_or_else(|| refused("an undoable write needs a scope"))?;
    if let Some(path) = scope.iter().find(|path| !of_specs(path)) {
        return Err(refused(format!("{path} is not a path of specs/")));
    }
    let _lock = write_lock(repo);
    let git = Git::discover(repo)?;
    let workspace = workspace(&git, repo)?;
    let root = place::reach(&git, &branch_of(&workspace, first)?)?.root;
    let commit = head(&root)?;
    let before = change::snapshot(&root, &scope);
    let value = write()?;
    let after = change::snapshot(&root, &scope);
    Ok((value, change::diff(before, after, commit, &kept)))
}

/// Replays `change` in `direction` once every file holds the side it expects: `after` for an undo,
/// `before` for a redo. Refused as a conflict, naming the first file that holds something else,
/// with nothing written. Answers the commit its checkout is at now. Writes files only: no git
/// command runs.
pub fn apply_change(
    repo: &Path,
    change: &Change,
    direction: Direction,
    subject: &str,
) -> Result<Option<String>> {
    let Some(first) = change.files.first() else {
        return Ok(change.commit.clone());
    };
    if let Some(file) = change.files.iter().find(|file| !of_specs(&file.path)) {
        return Err(refused(format!("{} is not a file of specs/", file.path)));
    }
    let _lock = write_lock(repo);
    let (git, workspace) = open(repo)?;
    let branch = branch_of(&workspace, &first.path)?;
    for file in &change.files {
        if branch_of(&workspace, &file.path)? != branch {
            return Err(refused(format!("{} is not on {branch}", file.path)));
        }
    }
    let root = default_checkout(&git, &branch)
        .ok_or_else(|| changed_since(direction, subject, &first.path))?;
    for file in &change.files {
        inside(&root, &file.path)
            .map_err(|_| refused(format!("{} is not a file of specs/", file.path)))?;
    }
    if let Some(file) = change::changed_since(&root, &change.files, direction) {
        return Err(changed_since(direction, subject, &file.path));
    }
    change::replay(&root, &change.files, direction)
        .map_err(|error| refused(format!("Could not write the files back: {error}")))?;
    head(&root)
}

/// Whether a commit since `change` holds any of its files otherwise than its commit did: what the
/// checkout of its files is at now, or its branch's tip without one.
pub fn committed_since(repo: &Path, change: &Change) -> Result<bool> {
    let Some(first) = change.files.first() else {
        return Ok(false);
    };
    let (git, workspace) = open(repo)?;
    let branch = branch_of(&workspace, &first.path)?;
    let now = match default_checkout(&git, &branch) {
        Some(root) => Git::open(&root)?.head(),
        None => git.tip(&branch),
    };
    let then = change
        .commit
        .as_deref()
        .and_then(|commit| git.resolve(commit));
    if now == then {
        return Ok(false);
    }
    let entry = |commit: Option<gix::ObjectId>, path: &str| {
        commit.and_then(|commit| git.entry_id(commit, path))
    };
    Ok(change
        .files
        .iter()
        .any(|file| entry(then, &file.path) != entry(now, &file.path)))
}

/// Whether `path` is `specs/` or a path under it whose parts are names: a hidden file, as a
/// folder's `.DS_Store`, is one, unlike `.` and `..`. Symbolic links are refused by `inside`.
fn of_specs(path: &str) -> bool {
    let path = path.trim_end_matches('/');
    let named = path
        .split('/')
        .all(|part| !part.is_empty() && part != "." && part != ".." && !part.contains(['\\', ':']));
    named && (path == "specs" || path.starts_with("specs/"))
}

/// The refusal of a replay over a file that changed since: "Could not undo: “Color themes” changed
/// since in PRIORITIES.md."
fn changed_since(direction: Direction, subject: &str, path: &str) -> ApiError {
    let verb = match direction {
        Direction::Undo => "undo",
        Direction::Redo => "redo",
    };
    let name = path.rsplit('/').next().unwrap_or(path);
    ApiError {
        code: "conflict",
        message: format!("Could not {verb}: “{subject}” changed since in {name}."),
        output: None,
    }
}

/// The commit the checkout at `root` is at, as a full hash.
fn head(root: &Path) -> Result<Option<String>> {
    Ok(Git::open(root)?.head().map(|id| id.to_string()))
}

/// The workspace, from memory when a read since the last change kept it: the write holds the lock
/// and has written nothing yet.
fn workspace(git: &Git, repo: &Path) -> Result<Arc<Workspace>> {
    match cache::kept_read(git) {
        Some(read) => Ok(Arc::clone(&read.workspace)),
        None => Ok(open(repo)?.1),
    }
}
