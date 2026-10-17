//! The operations the binding exposes, by repository path: each reads the workspace, reaches the
//! branch it writes on through a worktree, acts, and returns what the UI shows next.

use std::path::{Path, PathBuf};

use crate::actions::review;
use crate::actions::{ActionError, answer, place, priorities as edits};
use crate::check;
use crate::files::document::{self, hash};
use crate::files::items::items;
use crate::files::priorities;
use crate::files::review::Verdict;
use crate::gates::{AWAITING_HUMAN, Gate, gate_of};
use crate::git::{Git, GitError};
use crate::repositories::ListError;
use crate::view::{
    CommitView, FeatureView, FileView, NextView, PriorityLink, StepView, VersionView, WaitingFile,
    WorkspaceView,
};
use crate::workspace::{Feature, FileKind, Problem, Severity, Source, Workspace, WorkspaceError};

mod answers;
mod default_branch;
mod drafts;
mod files;
mod inbox_edits;
mod ledger;
mod preview;
mod priority_edits;
mod pulls;
mod repository_list;
mod reviews;
mod start;

pub use answers::*;
use default_branch::{default_checkout, on_default, reach_default, reach_default_from};
pub use default_branch::{default_root, on_default_branch};
pub use drafts::{
    commit_text, create_draft, proposal_hints, read_draft, read_text, save_text, set_discovery,
};
pub use files::{attach_image, encode_image, read_image, read_raw};
pub use inbox_edits::*;
pub(crate) use ledger::ledger_hash;
pub use ledger::{Constitution, Decision, Ledger, Principle, read_ledger};
pub use preview::{checkout_commit, preview};
pub(crate) use priority_edits::joined_priorities;
pub use priority_edits::{
    add_priority, add_priority_and_commit, commit_priorities, discard_priorities, edit_priority,
    insert_priority, move_priority, read_priorities, remove_priority, undo_committed_priority,
};
pub use pulls::refresh_pull_requests;
pub use repository_list::{
    add_repository, data_dir, open_repository, read_repositories, remove_repository,
    set_item_settings,
};
pub use reviews::{
    add_comment, approve, edit_comment, remove_comment, request_changes, start_over,
};
pub use start::{propose_slug, start_change, start_feature, start_kind};

/// An operation refused or failed: `code` is `refused`, `conflict` for a change made elsewhere,
/// or `hook` for a commit a hook refused, with its whole `output`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiError {
    pub code: &'static str,
    pub message: String,
    pub output: Option<String>,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

fn refused(message: impl Into<String>) -> ApiError {
    ApiError {
        code: "refused",
        message: message.into(),
        output: None,
    }
}

impl From<ActionError> for ApiError {
    fn from(error: ActionError) -> ApiError {
        match error {
            error if error.is_stale() => ApiError {
                code: "conflict",
                message: error.to_string(),
                output: None,
            },
            ActionError::Hook { message, output } => ApiError {
                code: "hook",
                message: format!("git commit failed: {message}"),
                output: Some(output),
            },
            error => refused(error.to_string()),
        }
    }
}

impl From<ListError> for ApiError {
    fn from(error: ListError) -> ApiError {
        refused(error.to_string())
    }
}

impl From<GitError> for ApiError {
    fn from(error: GitError) -> ApiError {
        refused(error.to_string())
    }
}

impl From<place::PlaceError> for ApiError {
    fn from(error: place::PlaceError) -> ApiError {
        refused(error.to_string())
    }
}

type Result<T> = std::result::Result<T, ApiError>;

/// One write at a time, whatever the repository: reaching a branch creates its worktree, and an
/// action reads, edits, and writes a file, which two calls at once would interleave.
static WRITES: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub(crate) fn write_lock() -> std::sync::MutexGuard<'static, ()> {
    WRITES
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

pub(crate) fn open(repo: &Path) -> Result<(Git, Workspace)> {
    let git = Git::discover(repo)?;
    let workspace = Workspace::read(&git).map_err(|error| refused(error.to_string()))?;
    Ok((git, workspace))
}

/// Where a feature's files are on disk, when they were read from a working tree.
fn feature_dir(git: &Git, feature: &Feature) -> Option<PathBuf> {
    if feature.source != Source::WorkingTree {
        return None;
    }
    Some(match feature.worktree.as_deref() {
        None | Some(".") => git.root().to_path_buf(),
        Some(path) if Path::new(path).is_absolute() => PathBuf::from(path),
        Some(path) => git.main_root().join(path),
    })
}

/// The errors `ura check` finds in a feature read from disk: its warnings stay out of the
/// feature's problems (R1).
fn checked(git: &Git, feature: &Feature) -> Vec<Problem> {
    let Some(root) = feature_dir(git, feature) else {
        return Vec::new();
    };
    let mut problems = check::check(&root, &root.join(feature.checked_path())).unwrap_or_default();
    problems.retain(|problem| {
        problem.severity == Severity::Error
            && !feature
                .problems
                .iter()
                .any(|known| known.file == problem.file && known.rule == problem.rule)
    });
    problems
}

/// Every feature, change, and priority, with each feature's step and problems.
pub fn read_workspace(repo: &Path) -> Result<WorkspaceView> {
    let git = Git::discover(repo)?;
    let workspace = match Workspace::read(&git) {
        Ok(workspace) => workspace,
        Err(WorkspaceError::NoSpecs(root)) => {
            let root = root.to_string_lossy().into_owned();
            return Ok(WorkspaceView {
                root: root.clone(),
                default_branch: git.default_branch(),
                current_branch: git.current_branch(),
                features: Vec::new(),
                priorities: Vec::new(),
                priorities_hash: String::new(),
                drafts: Vec::new(),
                no_specs: Some(root),
            });
        }
        Err(error) => return Err(refused(error.to_string())),
    };
    let (priorities, _) = on_default(&git, &workspace, edits::PATH);
    Ok(WorkspaceView {
        priorities_hash: hash(&priorities.unwrap_or_default()),
        ..WorkspaceView::new(&workspace, |feature| checked(&git, feature))
    })
}

/// One feature.
pub fn read_feature(repo: &Path, folder: &str) -> Result<FeatureView> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    Ok(FeatureView::new(feature, &checked(&git, feature)))
}

/// Every file waiting for the human, `status: awaiting-human`, of every feature and change read from a
/// checkout, with its path in that checkout. A branch checked out nowhere has no file to open.
pub fn waiting(repo: &Path) -> Result<Vec<WaitingFile>> {
    let (git, workspace) = open(repo)?;
    let mut waiting = Vec::new();
    for feature in &workspace.features {
        let Some(dir) = feature_dir(&git, feature) else {
            continue;
        };
        for file in &feature.files {
            if file.status.as_deref() != Some(AWAITING_HUMAN) {
                continue;
            }
            let callout = feature
                .text(&file.name)
                .and_then(|text| crate::files::markdown::Document::parse(text).callout)
                .filter(|callout| callout.kind == crate::files::markdown::CalloutKind::Important);
            waiting.push(WaitingFile {
                feature: feature.slug.clone(),
                folder: feature.folder.clone(),
                file: file.name.clone(),
                path: dir
                    .join(&feature.path)
                    .join(&file.name)
                    .to_string_lossy()
                    .into_owned(),
                line: callout.as_ref().map_or(1, |callout| callout.start as u32),
                text: callout
                    .map(|callout| callout.first_line)
                    .unwrap_or_default(),
            });
        }
    }
    Ok(waiting)
}

/// What each entry of a priorities text links to, by its first line: a feature or a change with its
/// step, or a draft. Entries that link neither are left out. `text` is read as given, so an
/// editor's unsaved lines are linked too.
pub fn priority_links(repo: &Path, text: &str) -> Result<Vec<PriorityLink>> {
    let (_, workspace) = open(repo)?;
    Ok(priorities::parse(text)
        .into_iter()
        .filter_map(|entry| {
            let linked = workspace.link(entry.link.as_deref()?);
            let feature = linked.feature;
            (feature.is_some() || linked.file.is_some()).then(|| PriorityLink {
                line: entry.line as u32,
                feature: feature.map(|feature| feature.folder.clone()),
                step: feature.map(|feature| StepView::from(&feature.step)),
                draft: linked.file.map(|file| file.path),
            })
        })
        .collect())
}

pub(crate) fn find<'a>(workspace: &'a Workspace, folder: &str) -> Result<&'a Feature> {
    workspace
        .feature(folder)
        .ok_or_else(|| refused(format!("no feature {folder}")))
}

/// Whether a path from the top level is plain: relative, without `.`, `..`, or hidden parts, and
/// without `\\` or `:`, which Windows reads as separators.
fn plain(path: &str) -> bool {
    path.split('/')
        .all(|part| !part.is_empty() && !part.starts_with('.') && !part.contains(['\\', ':']))
}

/// The feature or change whose folder holds `path`.
fn feature_of<'a>(workspace: &'a Workspace, path: &str) -> Option<&'a Feature> {
    workspace
        .features
        .iter()
        .find(|feature| feature.owns(path).is_some())
}

/// A file of a feature: its version as read, the version at its branch's tip when it differs, and
/// its pending review.
pub fn read_file(repo: &Path, folder: &str, name: &str) -> Result<FileView> {
    let (git, workspace) = open(repo)?;
    file_view(&git, find(&workspace, folder)?, name, None)
}

/// A file's view, with `written` as its text when a save just wrote it: a change made elsewhere
/// right after the save is not taken for it, and the next save over it is refused.
fn file_view(
    git: &Git,
    feature: &Feature,
    name: &str,
    written: Option<String>,
) -> Result<FileView> {
    let text = match written {
        Some(text) => text,
        None => feature
            .text(name)
            .ok_or_else(|| refused(format!("{} has no {name}", feature.folder)))?
            .to_string(),
    };
    let path = format!("{}/{name}", feature.path);
    let tip = feature.branch.as_deref().and_then(|branch| git.tip(branch));
    let committed = tip
        .and_then(|tip| git.read_file(tip, &path).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .filter(|committed| *committed != text)
        .map(|committed| VersionView::new(name, committed, &feature.path));
    let review = (gate_of(name) == Some(Gate::Review))
        .then(|| review::review_name(name))
        .and_then(|review_name| {
            let review_text = feature.text(&review_name)?;
            let doc = document::parse(review_text, &feature.path);
            Some(items(&review_name, review_text, &doc))
        });
    // A pending review is stale when the file at its commit differs from the file at the tip.
    let review_stale = review
        .as_ref()
        .and_then(|items| items.review.as_ref())
        .filter(|review| review.verdict == "pending")
        .is_some_and(|review| {
            let at = |commit| {
                git.read_file(commit, &path)
                    .ok()
                    .flatten()
                    .and_then(|bytes| String::from_utf8(bytes).ok())
            };
            let reviewed = git.resolve(&review.commit).and_then(at);
            let latest = tip.and_then(at);
            reviewed != latest
        });
    let status = feature
        .files
        .iter()
        .find(|file| file.name == name)
        .and_then(|file| file.status.clone());
    let kind = crate::view::kind_name(FileKind::of(name).map(|(kind, _)| kind));
    Ok(FileView {
        id: format!("{}/{name}", feature.folder),
        folder: feature.folder.clone(),
        name: name.to_string(),
        path,
        kind,
        status,
        current: VersionView::new(name, text, &feature.path),
        tip: tip.map(|tip| tip.to_hex_with_len(7).to_string()),
        committed,
        review,
        review_stale,
        takes_images: true,
    })
}

/// Reaches a feature's branch, through a worktree when it is checked out nowhere.
fn reach(repo: &Path, folder: &str) -> Result<(Git, Feature, place::Place)> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?.clone();
    let branch = feature
        .branch
        .clone()
        .ok_or_else(|| refused(format!("{folder} is merged: it has no branch to write on")))?;
    let place = place::reach(&git, &branch)?;
    Ok((git, feature, place))
}

/// A feature's next step, as `ura next` gives it, with the latest pull requests the repository's
/// refresh read from `gh`.
pub fn next_step(repo: &Path, folder: &str) -> Result<NextView> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    Ok(NextView {
        folder: feature.folder.clone(),
        branch: feature.branch.clone(),
        main_root: git.main_root().to_string_lossy().into_owned(),
        step: (&feature.step).into(),
    })
}

/// The directory an agent works on a feature in: the checkout that has its branch, or else a new
/// worktree for it.
pub fn work_dir(repo: &Path, folder: &str) -> Result<String> {
    let _lock = write_lock();
    let (_, workspace) = open(repo)?;
    if find(&workspace, folder)?.branch.is_none() {
        return Err(refused(format!("{folder} has no branch")));
    }
    let (_, _, place) = reach(repo, folder)?;
    Ok(place.root.to_string_lossy().into_owned())
}

/// The main checkout's path, from any of the repository's working trees: git alone, so a
/// repository without `specs/` has one too.
pub fn main_root(repo: &Path) -> Result<String> {
    Ok(Git::discover(repo)?
        .main_root()
        .to_string_lossy()
        .into_owned())
}

/// Commits again what a hook refused to commit, its files left written: a submitted round, or a
/// verdict on a spec or a plan, with its review file; with the images the
/// feature's folder links.
pub fn retry_commit(repo: &Path, folder: &str, name: &str) -> Result<CommitView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    let path = format!("{}/{name}", feature.path);
    let text = std::fs::read_to_string(place.root.join(&path))
        .map_err(|_| refused(format!("{folder} has no {name}")))?;
    let status = crate::files::frontmatter::parse(&text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let (subject, mut paths) = match (FileKind::of(name), status.as_deref()) {
        (Some((FileKind::Clarifications, Some(round))), Some("answered")) => {
            (answer::subject(&feature.slug, round), vec![path])
        }
        (Some((FileKind::Spec | FileKind::Plan, _)), Some(verdict))
            if verdict == "approved" || verdict == "changes-requested" =>
        {
            let verdict = if verdict == "approved" {
                Verdict::Approved
            } else {
                Verdict::ChangesRequested
            };
            let review_path = format!("{}/{}", feature.path, review::review_name(name));
            let mut paths = vec![path];
            // The review file, written or deleted by the verdict.
            let tracked = Git::open(&place.root).ok().is_some_and(|git| {
                git.head()
                    .is_some_and(|head| git.read_file(head, &review_path).ok().flatten().is_some())
            });
            if place.root.join(&review_path).exists() || tracked {
                paths.push(review_path);
            }
            (review::subject(&feature.slug, name, verdict), paths)
        }
        _ => return Err(refused(format!("{name} has nothing to commit again"))),
    };
    // The staged files are checked before any image is deleted, as the first try did.
    let mut candidates = paths.clone();
    candidates.push(crate::actions::images::images_folder(&feature.path));
    crate::actions::place::ensure_only_staged(&place, &candidates)?;
    paths.extend(crate::actions::images::linked_images(
        &place,
        &feature.path,
    )?);
    paths.sort();
    let change = crate::actions::Change {
        paths,
        subject,
        body: None,
    };
    let committed = crate::actions::commit::commit(&place, &change)?;
    Ok(CommitView {
        subject: committed.change.subject,
        commit: committed.commit,
    })
}
