//! The operations the binding exposes, by repository path: each reads the workspace, reaches the
//! branch it writes on through a worktree, acts, and returns what the UI shows next.

use std::path::{Path, PathBuf};

use crate::actions::review::{self, Tier};
use crate::actions::{ActionError, answer, draft, place, priorities as edits, start, text};
use crate::check;
use crate::files::document::{self, hash};
use crate::files::items::items;
use crate::files::priorities::{self, Priorities, Section};
use crate::git::{Git, GitError};
use crate::today;
use crate::view::{
    CommitView, DraftView, FeatureView, FileView, PriorityView, StartedView, VersionView,
    WorkspaceView, title,
};
use crate::workspace::{Feature, FileKind, Problem, Source, Workspace, WorkspaceError};

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

fn open(repo: &Path) -> Result<(Git, Workspace)> {
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
    let mut problems = check::check(&root, &root.join(&feature.path)).unwrap_or_default();
    problems.retain(|problem| {
        !feature
            .problems
            .iter()
            .any(|known| known.file == problem.file && known.rule == problem.rule)
    });
    problems
}

/// Every feature, bug, and priority, with each feature's step and problems.
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
                drafts: Vec::new(),
                no_specs: Some(root),
            });
        }
        Err(error) => return Err(refused(error.to_string())),
    };
    Ok(WorkspaceView::new(&workspace, |feature| {
        checked(&git, feature)
    }))
}

/// One feature.
pub fn read_feature(repo: &Path, folder: &str) -> Result<FeatureView> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    Ok(FeatureView::new(feature, &checked(&git, feature)))
}

fn find<'a>(workspace: &'a Workspace, folder: &str) -> Result<&'a Feature> {
    workspace
        .feature(folder)
        .ok_or_else(|| refused(format!("no feature {folder}")))
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
    file_view(&git, find(&workspace, folder)?, name)
}

fn file_view(git: &Git, feature: &Feature, name: &str) -> Result<FileView> {
    let text = feature
        .text(name)
        .ok_or_else(|| refused(format!("{} has no {name}", feature.folder)))?
        .to_string();
    let path = format!("{}/{name}", feature.path);
    let tip = feature.branch.as_deref().and_then(|branch| git.tip(branch));
    let committed = tip
        .and_then(|tip| git.read_file(tip, &path).ok().flatten())
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .filter(|committed| *committed != text)
        .map(|committed| version(name, committed, &feature.path));
    let review = ["spec.md", "plan.md", "assessment.md"]
        .contains(&name)
        .then(|| review::review_name(name))
        .and_then(|review_name| {
            let review_text = feature.text(&review_name)?;
            let doc = document::parse(review_text, &feature.path);
            Some(items(&review_name, review_text, &doc))
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

fn round_name(feature: &Feature) -> Result<String> {
    let path = answer::round_path(feature)?;
    Ok(path.rsplit('/').next().unwrap_or_default().to_string())
}

/// Saves one answer, from the letters picked and a comment, over the answer last read.
pub fn save_answer(
    repo: &Path,
    folder: &str,
    question: &str,
    letters: &[String],
    comment: &str,
    previous: &str,
) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    answer::save(&place, &feature, question, letters, comment, previous)?;
    read_file(repo, folder, &round_name(&feature)?)
}

/// Saves the notes on the settled points, over the notes last read.
pub fn save_notes(repo: &Path, folder: &str, notes: &str, previous: &str) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    answer::save_notes(&place, &feature, notes, previous)?;
    read_file(repo, folder, &round_name(&feature)?)
}

/// Submits the latest round and commits it.
pub fn submit_answers(repo: &Path, folder: &str) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    answer::submit_and_commit(&place, &feature, today::today())?;
    read_file(repo, folder, &round_name(&feature)?)
}

/// Commits again what a hook refused to commit, its files left written: a submitted round, or a
/// verdict on a spec, a plan, or an assessment, with its review file.
pub fn retry_commit(repo: &Path, folder: &str, name: &str) -> Result<CommitView> {
    let (_, feature, place) = reach(repo, folder)?;
    let path = format!("{}/{name}", feature.path);
    let text = std::fs::read_to_string(place.root.join(&path))
        .map_err(|_| refused(format!("{folder} has no {name}")))?;
    let status = crate::files::frontmatter::parse(&text)
        .ok()
        .and_then(|front| front.text("status").map(String::from));
    let kind = name.strip_suffix(".md").unwrap_or(name);
    let (subject, mut paths) = match (FileKind::of(name), status.as_deref()) {
        (Some((FileKind::Clarifications, Some(round))), Some("answered")) => (
            format!("discovery({}): answer round {round:02}", feature.slug),
            vec![path],
        ),
        (Some((FileKind::Spec | FileKind::Plan | FileKind::Assessment, _)), Some(verdict))
            if verdict == "approved" || verdict == "changes-requested" =>
        {
            let action = if verdict == "approved" {
                "approve"
            } else {
                "request changes"
            };
            let review_path = format!("{}/{}", feature.path, review::review_name(name));
            let mut paths = vec![path];
            if place.root.join(&review_path).exists() {
                paths.push(review_path);
            }
            (format!("{kind}({}): {action}", feature.slug), paths)
        }
        _ => return Err(refused(format!("{name} has nothing to commit again"))),
    };
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
    let (_, feature, place) = reach(repo, folder)?;
    review::edit(&place, &feature, file, number, text)?;
    read_file(repo, folder, file)
}

/// Removes a pending comment.
pub fn remove_comment(repo: &Path, folder: &str, file: &str, number: u32) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    review::remove(&place, &feature, file, number)?;
    read_file(repo, folder, file)
}

/// Deletes the pending review, to review the new version from scratch.
pub fn start_over(repo: &Path, folder: &str, file: &str) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    review::start_over(&place, &feature, file)?;
    read_file(repo, folder, file)
}

/// Approves a spec, a plan, or an assessment, and commits it.
pub fn approve(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
    risk_tier: Option<String>,
    plan_review: Option<bool>,
) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
    let tier = Tier {
        risk_tier,
        plan_review,
    };
    let summary = summary.filter(|s| !s.trim().is_empty());
    review::approve_and_commit(&place, &feature, file, summary, &tier, today::today())?;
    read_file(repo, folder, file)
}

/// Requests changes on a spec, a plan, or an assessment, and commits it.
pub fn request_changes(
    repo: &Path,
    folder: &str,
    file: &str,
    summary: Option<&str>,
) -> Result<FileView> {
    let (_, feature, place) = reach(repo, folder)?;
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
    let checked_out = if git.current_branch().as_deref() == Some(default) {
        Some(git.root().to_path_buf())
    } else {
        git.worktrees()
            .unwrap_or_default()
            .into_iter()
            .find(|worktree| worktree.branch.as_deref() == Some(default))
            .map(|worktree| worktree.path)
    };
    match checked_out {
        Some(root) => (std::fs::read_to_string(root.join(path)).ok(), committed),
        None => (committed.clone(), committed),
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
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, path);
    let text = text.ok_or_else(|| refused(format!("no draft {path}")))?;
    let view = WorkspaceView::new(&workspace, |_| Vec::new());
    let entry: Option<PriorityView> = view
        .priorities
        .into_iter()
        .find(|entry| entry.draft.as_deref() == Some(path));
    let priorities = read_priorities(repo)?;
    Ok(DraftView {
        path: path.to_string(),
        title: title(&text).unwrap_or_else(|| path.to_string()),
        hash: hash(&text),
        document: document::parse(&text, path.rsplit_once('/').map_or("specs", |(dir, _)| dir)),
        committed: committed.as_deref() == Some(text.as_str()),
        entry,
        priority_changes: priorities.changes,
        text,
    })
}

fn reach_default(repo: &Path) -> Result<place::Place> {
    let (git, workspace) = open(repo)?;
    let default = workspace
        .default_branch
        .ok_or_else(|| refused("no default branch: commit on main first"))?;
    Ok(place::reach(&git, &default)?)
}

/// Drafts a priority line by its id, like `next-2`.
pub fn create_draft(repo: &Path, id: &str) -> Result<DraftView> {
    let place = reach_default(repo)?;
    let drafted = draft::create(&place, id)?;
    read_draft(repo, &drafted.path)
}

/// The place a text file is written in: the default branch for drafts, else the feature's branch.
fn text_place(repo: &Path, path: &str) -> Result<place::Place> {
    if path.starts_with("specs/drafts/") || path.starts_with("specs/backlog/") {
        return reach_default(repo);
    }
    let folder = path
        .strip_prefix("specs/")
        .and_then(|rest| rest.split_once('/'))
        .map(|(folder, _)| folder)
        .ok_or_else(|| refused(format!("{path} is not a file of specs/")))?;
    Ok(reach(repo, folder)?.2)
}

/// Saves a draft or a proposal as typed, over the version read at `previous`. Returns the new
/// hash.
pub fn save_text(repo: &Path, path: &str, content: &str, previous: &str) -> Result<String> {
    let place = text_place(repo, path)?;
    Ok(text::save(&place, path, content, previous)?)
}

/// Commits a draft, with the priorities when they changed, or a proposal.
pub fn commit_text(repo: &Path, path: &str) -> Result<CommitView> {
    let place = text_place(repo, path)?;
    let committed = text::commit(&place, path)?;
    Ok(CommitView {
        subject: committed.change.subject,
        commit: committed.commit,
    })
}

/// Starts a drafted feature in its own worktree.
pub fn start_feature(repo: &Path, draft: &str, slug: Option<&str>) -> Result<StartedView> {
    let (git, workspace) = open(repo)?;
    match start::run(&git, &workspace, draft, slug, today::today(), false) {
        Ok(started) => Ok(StartedView {
            folder: started.branch.clone(),
            branch: started.branch,
            worktree: started.worktree,
        }),
        Err(start::StartError::Partial { done, left, cause }) => Err(refused(format!(
            "{cause}. Done: {}. Left: {}.",
            done.join(", "),
            left.join(", then ")
        ))),
        Err(error) => Err(refused(error.to_string())),
    }
}

fn section(id: &str) -> Result<Section> {
    Section::from_id(id).ok_or_else(|| refused(format!("no section {id}")))
}

/// Adds a line at the end of a section.
pub fn add_priority(
    repo: &Path,
    section_id: &str,
    line: &str,
    previous: &str,
) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::add(&place, section(section_id)?, line, previous)?;
    Ok(edits::read(&place))
}

/// Moves a line before the line at `index` of a section, or to its end.
pub fn move_priority(
    repo: &Path,
    id: &str,
    section_id: &str,
    index: u32,
    previous: &str,
) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::move_entry(&place, id, section(section_id)?, index as usize, previous)?;
    Ok(edits::read(&place))
}

/// Replaces a line's text.
pub fn edit_priority(repo: &Path, id: &str, line: &str, previous: &str) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::edit(&place, id, line, previous)?;
    Ok(edits::read(&place))
}

/// Removes a line and its nested lines.
pub fn remove_priority(repo: &Path, id: &str, previous: &str) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::remove(&place, id, previous)?;
    Ok(edits::read(&place))
}

/// Commits the priorities alone.
pub fn commit_priorities(repo: &Path) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::commit(&place)?;
    Ok(edits::read(&place))
}

/// Restores the committed priorities.
pub fn discard_priorities(repo: &Path) -> Result<Priorities> {
    let place = reach_default(repo)?;
    edits::discard(&place)?;
    Ok(edits::read(&place))
}

/// A draft or a proposal, for its editor: a draft from the default branch, a proposal from its
/// feature.
pub fn read_text(repo: &Path, path: &str) -> Result<DraftView> {
    if path.starts_with("specs/drafts/") || path.starts_with("specs/backlog/") {
        return read_draft(repo, path);
    }
    let (git, workspace) = open(repo)?;
    let (folder, name) = path
        .strip_prefix("specs/")
        .and_then(|rest| rest.split_once('/'))
        .ok_or_else(|| refused(format!("{path} is not a file of specs/")))?;
    let feature = find(&workspace, folder)?;
    let text = feature
        .text(name)
        .ok_or_else(|| refused(format!("{folder} has no {name}")))?
        .to_string();
    let committed = feature
        .branch
        .as_deref()
        .and_then(|branch| git.tip(branch))
        .and_then(|tip| git.read_file(tip, path).ok().flatten())
        .is_some_and(|bytes| bytes == text.as_bytes());
    Ok(DraftView {
        path: path.to_string(),
        title: title(&text).unwrap_or_else(|| path.to_string()),
        hash: hash(&text),
        document: document::parse(&text, &feature.path),
        committed,
        entry: None,
        priority_changes: 0,
        text,
    })
}

/// A file of the repository as text, for links to code and mockups: a feature's file from where
/// its feature is read, any other from the checkout.
pub fn read_raw(repo: &Path, path: &str) -> Result<String> {
    if path.split('/').any(|part| part == ".." || part.is_empty()) || path.starts_with('/') {
        return Err(refused(format!("{path}: no such file")));
    }
    let (git, workspace) = open(repo)?;
    let feature = path
        .strip_prefix("specs/")
        .and_then(|rest| rest.split_once('/'))
        .and_then(|(folder, _)| workspace.feature(folder));
    let bytes = match feature {
        Some(feature) => match feature_dir(&git, feature) {
            Some(dir) => std::fs::read(dir.join(path)).ok(),
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
        None => std::fs::read(git.root().join(path)).ok(),
    };
    bytes
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .ok_or_else(|| refused(format!("{path}: no such file")))
}
