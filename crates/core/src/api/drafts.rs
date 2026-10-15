//! Drafts and proposals as their editor reads and writes them: a draft on the default branch, a
//! proposal on its feature's or change's branch.

use std::path::Path;

use super::start::draft_path;
use super::{
    ApiError, Result, feature_of, on_default, open, plain, reach_default, read_priorities, refused,
    write_lock,
};
use crate::actions::{draft, place, priorities as edits, text};
use crate::files::document::{self, hash};
use crate::files::proposal;
use crate::target;
use crate::view::{CommitView, DraftView, PriorityView, ProposalHint, WorkspaceView, title};
use crate::workspace::{Feature, Workspace};

/// The feature or change of a workflow file, `specs/<folder>/<name>` or
/// `specs/changes/<folder>/<name>`, and the file's name.
fn feature_file<'a, 'p>(workspace: &'a Workspace, path: &'p str) -> Result<(&'a Feature, &'p str)> {
    feature_of(workspace, path)
        .and_then(|feature| Some((feature, feature.owns(path)?)))
        .filter(|(_, name)| plain(path) && !name.contains('/'))
        .ok_or_else(|| refused(format!("{path} is not a file of a feature")))
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
pub(super) fn text_place(repo: &Path, path: &str) -> Result<place::Place> {
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
