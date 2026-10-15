//! The operations the binding exposes, by repository path: each reads the workspace, reaches the
//! branch it writes on through a worktree, acts, and returns what the UI shows next.

use std::path::{Path, PathBuf};

use crate::actions::review::{self, Tier};
use crate::actions::{ActionError, answer, draft, place, priorities as edits, text};
use crate::check;
use crate::files::document::{self, hash};
use crate::files::items::items;
use crate::files::priorities::{self, Priorities};
use crate::files::proposal;
use crate::files::review::Verdict;
use crate::gates::{AWAITING_HUMAN, Gate, gate_of};
use crate::git::{Git, GitError};
use crate::repositories::ListError;
use crate::view::{
    CommitView, DraftView, FeatureView, FileView, NextView, PriorityLink, PriorityView,
    ProposalHint, StepView, VersionView, WaitingFile, WorkspaceView, title,
};
use crate::workspace::{
    Feature, FileKind, Problem, Source, Workspace, WorkspaceError, linked_draft,
};
use crate::{steps, target, today};

mod answers;
mod files;
mod priority_edits;
mod repository_list;
mod start;

pub use answers::*;
pub use files::{attach_image, encode_image, read_image, read_raw};

pub use priority_edits::{
    add_priority, commit_priorities, discard_priorities, edit_priority, insert_priority,
    move_priority, remove_priority,
};
pub use repository_list::{
    add_repository, data_dir, open_repository, read_repositories, remove_repository,
};
pub use start::{propose_slug, start_change, start_feature, start_kind};

use start::draft_path;

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
            ActionError::Changed { .. } => ApiError {
                code: "conflict",
                message: error.to_string(),
                output: None,
            },
            ActionError::Hook { message, output } => ApiError {
                code: "hook",
                message: format!("git commit failed: {message}"),
                output: Some(output),
            },
            ActionError::Refused(message) if message.starts_with("PRIORITIES.md changed") => {
                ApiError {
                    code: "conflict",
                    message,
                    output: None,
                }
            }
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

/// The problems `ura check` finds in a feature read from disk.
fn checked(git: &Git, feature: &Feature) -> Vec<Problem> {
    let Some(root) = feature_dir(git, feature) else {
        return Vec::new();
    };
    let mut problems = check::check(&root, &root.join(feature.checked_path())).unwrap_or_default();
    problems.retain(|problem| {
        !feature
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
            let link = entry.link.as_deref()?;
            let feature = workspace.linked_feature(link);
            let draft = linked_draft(link);
            (feature.is_some() || draft.is_some()).then(|| PriorityLink {
                line: entry.line as u32,
                feature: feature.map(|feature| feature.folder.clone()),
                step: feature.map(|feature| StepView::from(&feature.step)),
                draft,
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

/// The feature or change of a workflow file, `specs/<folder>/<name>` or
/// `specs/changes/<folder>/<name>`, and the file's name.
fn feature_file<'a, 'p>(workspace: &'a Workspace, path: &'p str) -> Result<(&'a Feature, &'p str)> {
    feature_of(workspace, path)
        .and_then(|feature| Some((feature, feature.owns(path)?)))
        .filter(|(_, name)| plain(path) && !name.contains('/'))
        .ok_or_else(|| refused(format!("{path} is not a file of a feature")))
}

fn version(name: &str, text: String, dir: &str) -> VersionView {
    let document = document::parse(&text, dir);
    let items = items(name, &text, &document);
    VersionView {
        text,
        document,
        items,
    }
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
        .map(|committed| version(name, committed, &feature.path));
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
    let kind = FileKind::of(name)
        .and_then(|(kind, _)| serde_json::to_value(kind).ok())
        .and_then(|value| value.as_str().map(String::from))
        .unwrap_or_default();
    Ok(FileView {
        id: format!("{}/{name}", feature.folder),
        folder: feature.folder.clone(),
        name: name.to_string(),
        path,
        kind,
        status,
        current: version(name, text, &feature.path),
        tip: tip.map(|tip| tip.to_hex_with_len(7).to_string()),
        committed,
        review,
        review_stale,
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

/// A feature's next step, as `ura next` gives it, with the pull request's state from `gh`.
pub fn next_step(repo: &Path, folder: &str) -> Result<NextView> {
    let (git, workspace) = open(repo)?;
    let mut feature = find(&workspace, folder)?.clone();
    steps::refresh_pull_request(&mut feature, |branch| {
        steps::pull_request(git.root(), branch)
    });
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

/// Adds a comment on lines of the committed file, or on all of it.
pub fn add_comment(
    repo: &Path,
    folder: &str,
    file: &str,
    lines: Option<(u32, u32)>,
    text: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    let lines = lines.map(|(start, end)| (start as usize, end as usize));
    review::comment(&git, &place, &feature, file, lines, text)?;
    read_file(repo, folder, file)
}

/// Replaces a pending comment's text.
pub fn edit_comment(
    repo: &Path,
    folder: &str,
    file: &str,
    number: u32,
    text: &str,
) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::edit(&place, &feature, file, number, text)?;
    read_file(repo, folder, file)
}

/// Removes a pending comment.
pub fn remove_comment(repo: &Path, folder: &str, file: &str, number: u32) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::remove(&place, &feature, file, number)?;
    read_file(repo, folder, file)
}

/// Deletes the pending review, to review the new version from scratch.
pub fn start_over(repo: &Path, folder: &str, file: &str) -> Result<FileView> {
    let _lock = write_lock();
    let (_, feature, place) = reach(repo, folder)?;
    review::start_over(&place, &feature, file)?;
    read_file(repo, folder, file)
}

/// Refuses a verdict on a file whose text on disk differs from its branch's tip: the page shows the
/// committed version, and the verdict must not commit another.
fn as_committed(git: &Git, feature: &Feature, place: &place::Place, file: &str) -> Result<()> {
    let path = format!("{}/{file}", feature.path);
    let on_disk = std::fs::read(place.root.join(&path)).ok();
    let at_tip = feature
        .branch
        .as_deref()
        .and_then(|branch| git.tip(branch))
        .and_then(|tip| git.read_file(tip, &path).ok().flatten());
    if on_disk != at_tip {
        return Err(refused(format!(
            "{file} has changes not committed: the review is of the committed version"
        )));
    }
    Ok(())
}

/// Approves a spec or a plan, and commits it.
pub fn approve(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
    risk_tier: Option<String>,
    plan_review: Option<bool>,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    as_committed(&git, &feature, &place, file)?;
    let tier = Tier {
        risk_tier,
        plan_review,
    };
    let summary = summary.filter(|s| !s.trim().is_empty());
    review::approve_and_commit(&place, &feature, file, summary, &tier, today::today())?;
    read_file(repo, folder, file)
}

/// Requests changes on a spec or a plan, and commits it.
pub fn request_changes(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
) -> Result<FileView> {
    let _lock = write_lock();
    let (git, feature, place) = reach(repo, folder)?;
    as_committed(&git, &feature, &place, file)?;
    let summary = summary.filter(|s| !s.trim().is_empty());
    review::request_changes_and_commit(&place, &feature, file, summary, today::today())?;
    read_file(repo, folder, file)
}

/// A file of the default branch, from the working tree that has it, else from its tip; and its
/// committed text.
fn on_default(git: &Git, workspace: &Workspace, path: &str) -> (Option<String>, Option<String>) {
    let Some(default) = workspace.default_branch.as_deref() else {
        return (None, None);
    };
    let committed = git
        .tip(default)
        .and_then(|tip| git.read_file(tip, path).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok());
    match default_checkout(git, default) {
        Some(root) => (std::fs::read_to_string(root.join(path)).ok(), committed),
        None => (committed.clone(), committed),
    }
}

/// The working tree that has the default branch checked out, if any.
fn default_checkout(git: &Git, default: &str) -> Option<PathBuf> {
    if git.current_branch().as_deref() == Some(default) {
        Some(git.root().to_path_buf())
    } else {
        git.worktrees()
            .unwrap_or_default()
            .into_iter()
            .find(|worktree| worktree.branch.as_deref() == Some(default))
            .map(|worktree| worktree.path)
    }
}

/// The priorities, with their changes since the last commit, without creating a worktree.
pub fn read_priorities(repo: &Path) -> Result<Priorities> {
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, edits::PATH);
    Ok(priorities::read(
        &text.unwrap_or_default(),
        committed.as_deref(),
    ))
}

/// A draft, for its editor.
pub fn read_draft(repo: &Path, path: &str) -> Result<DraftView> {
    draft_path(path)?;
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, path);
    let text = text.ok_or_else(|| refused(format!("no draft {path}")))?;
    let view = WorkspaceView::new(&workspace, |_| Vec::new());
    let entry: Option<PriorityView> = view
        .priorities
        .into_iter()
        .find(|entry| entry.draft.as_deref() == Some(path));
    let priorities = read_priorities(repo)?;
    let committed = committed.as_deref() == Some(text.as_str());
    let dir = path.rsplit_once('/').map_or("specs", |(dir, _)| dir);
    Ok(DraftView {
        entry,
        priority_changes: priorities.changes,
        ..text_view(path, text, dir, committed, None)
    })
}

/// The view of a draft or a proposal's text, read from `dir`, outside the priorities.
fn text_view(
    path: &str,
    text: String,
    dir: &str,
    committed: bool,
    folder: Option<String>,
) -> DraftView {
    let kind = if target::is_draft(path) {
        "draft"
    } else {
        "proposal"
    };
    DraftView {
        path: path.to_string(),
        title: title(&text).unwrap_or_else(|| path.to_string()),
        hash: hash(&text),
        document: document::parse(&text, dir),
        committed,
        entry: None,
        priority_changes: 0,
        kind: kind.to_string(),
        folder,
        slug: target::draft_to_start(path)
            .map(|draft| crate::slug::short(target::draft_name(&draft))),
        discovery: Some(proposal::discovery(&text).to_string()),
        discovery_levels: proposal::discovery_levels()
            .iter()
            .map(|level| level.to_string())
            .collect(),
        written: proposal::is_written(&text),
        empty_sections: proposal::empty_sections(&text),
        text,
    }
}

/// Lets a tool act on a draft, a backlog file, or the priorities, at `path` from the root, open
/// with `text` in the checkout at `repo`. They are written on the default branch, from its checkout:
/// another branch's copy stands for it only while it holds the default branch's text, read from the
/// checkout that has it, or else from the branch. Names that checkout when they differ, without
/// creating one.
pub fn on_default_branch(repo: &Path, path: &str, text: &str) -> Result<()> {
    let git = Git::discover(repo)?;
    // Without a default branch, writing refuses on its own.
    let Some(default) = git.default_branch() else {
        return Ok(());
    };
    if git.current_branch().as_deref() == Some(default.as_str()) {
        return Ok(());
    }
    let checkout = default_checkout(&git, &default);
    let theirs = match &checkout {
        Some(checkout) => std::fs::read_to_string(checkout.join(path)).ok(),
        None => git
            .tip(&default)
            .and_then(|tip| git.read_file(tip, path).ok().flatten())
            .and_then(|bytes| String::from_utf8(bytes).ok()),
    };
    if theirs.as_deref() == Some(text) {
        return Ok(());
    }
    let name = path.rsplit('/').next().unwrap_or(path);
    Err(refused(match checkout {
        Some(checkout) => format!(
            "{name} here differs from {default}'s: open it from {default}'s checkout, {}.",
            checkout.display()
        ),
        None => {
            format!("{name} here differs from {default}'s: open it from a checkout of {default}.")
        }
    }))
}

fn reach_default(repo: &Path) -> Result<place::Place> {
    let (git, workspace) = open(repo)?;
    let default = workspace
        .default_branch
        .ok_or_else(|| refused("no default branch: commit on main first"))?;
    Ok(place::reach(&git, &default)?)
}

/// The checkout holding the default branch, where drafts and the priorities are written: this one,
/// another that has it, or a worktree created for it, as [`create_draft`] reaches it.
pub fn default_root(repo: &Path) -> Result<PathBuf> {
    let _lock = write_lock();
    Ok(reach_default(repo)?.root)
}

/// Drafts a priority line by its id, like `next-2`, over the priorities read at `previous`: an id
/// names another line once lines are added or moved.
pub fn create_draft(repo: &Path, id: &str, previous: &str) -> Result<DraftView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    if edits::read(&place).hash != previous {
        return Err(ApiError {
            code: "conflict",
            message: "PRIORITIES.md changed on disk. Nothing was drafted.".to_string(),
            output: None,
        });
    }
    let drafted = draft::create(&place, id)?;
    read_draft(repo, &drafted.path)
}

/// The place a text file is written in: the default branch for drafts, else the feature's branch.
fn text_place(repo: &Path, path: &str) -> Result<place::Place> {
    if target::is_draft(path) {
        draft_path(path)?;
        return reach_default(repo);
    }
    let (git, workspace) = open(repo)?;
    let (feature, _) = feature_file(&workspace, path)?;
    let branch = feature.branch.as_deref().ok_or_else(|| {
        refused(format!(
            "{} is merged: it has no branch to write on",
            feature.folder
        ))
    })?;
    Ok(place::reach(&git, branch)?)
}

/// Saves a draft or a proposal as typed, over the version read at `previous`. Returns the new
/// hash.
pub fn save_text(repo: &Path, path: &str, content: &str, previous: &str) -> Result<String> {
    let _lock = write_lock();
    let place = text_place(repo, path)?;
    Ok(text::save(&place, path, content, previous)?)
}

/// Sets the discovery effort of a draft or a proposal, over the version read at `previous`.
pub fn set_discovery(repo: &Path, path: &str, level: &str, previous: &str) -> Result<DraftView> {
    {
        let _lock = write_lock();
        let place = text_place(repo, path)?;
        let text = std::fs::read_to_string(place.root.join(path))
            .map_err(|_| refused(format!("{path}: no such file")))?;
        let edited = proposal::set_discovery(&text, level).map_err(refused)?;
        text::save(&place, path, &edited, previous)?;
    }
    read_text(repo, path)
}

/// Commits a draft, with the priorities when they changed, or a proposal.
pub fn commit_text(repo: &Path, path: &str) -> Result<CommitView> {
    let _lock = write_lock();
    let place = text_place(repo, path)?;
    let committed = text::commit(&place, path)?;
    Ok(CommitView {
        subject: committed.change.subject,
        commit: committed.commit,
    })
}

/// Each section of the proposal template, with its guidance, in order.
pub fn proposal_hints() -> Result<Vec<ProposalHint>> {
    Ok(crate::embedded::proposal_hints()
        .into_iter()
        .map(|(heading, hint)| ProposalHint { heading, hint })
        .collect())
}

/// A draft or a proposal, for its editor: a draft from the default branch, a proposal from its
/// feature.
pub fn read_text(repo: &Path, path: &str) -> Result<DraftView> {
    if target::is_draft(path) {
        return read_draft(repo, path);
    }
    let (git, workspace) = open(repo)?;
    let (feature, name) = feature_file(&workspace, path)?;
    let text = feature
        .text(name)
        .ok_or_else(|| refused(format!("{} has no {name}", feature.folder)))?
        .to_string();
    let committed = feature
        .branch
        .as_deref()
        .and_then(|branch| git.tip(branch))
        .and_then(|tip| git.read_file(tip, path).ok().flatten())
        .is_some_and(|bytes| bytes == text.as_bytes());
    Ok(text_view(
        path,
        text,
        &feature.path,
        committed,
        Some(feature.folder.clone()),
    ))
}
