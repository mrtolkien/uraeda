//! Proposal files, note files, and proposals as their editor reads and writes them: a proposal file
//! or a note file on the default branch, a proposal on its feature's or change's branch.

use std::path::Path;

use super::start::linked_path;
use super::{
    ApiError, Result, feature_of, on_default, open, plain, reach_default, read_priorities, refused,
    write_lock,
};
use crate::actions::{expand, place, priorities as edits, text};
use crate::files::document::{self, hash};
use crate::files::proposal;
use crate::files::stories::{mockup_embeds, story_links};
use crate::target;
use crate::view::{CommitView, ProposalFileView, ProposalHint, ProposalView, WorkspaceView, title};
use crate::workspace::{Feature, Workspace};

/// The feature or change of a workflow file, `specs/<folder>/<name>` or
/// `specs/changes/<folder>/<name>`, and the file's name.
fn feature_file<'a, 'p>(workspace: &'a Workspace, path: &'p str) -> Result<(&'a Feature, &'p str)> {
    feature_of(workspace, path)
        .and_then(|feature| Some((feature, feature.owns(path)?)))
        .filter(|(_, name)| plain(path) && !name.contains('/'))
        .ok_or_else(|| refused(format!("{path} is not a file of a feature")))
}

/// A proposal file or a note file, for its editor.
pub fn read_proposal_file(repo: &Path, path: &str) -> Result<ProposalFileView> {
    linked_path(path)?;
    let (git, workspace) = open(repo)?;
    let (text, committed) = on_default(&git, &workspace, path);
    let text = text.ok_or_else(|| refused(format!("no proposal file {path}")))?;
    let view = WorkspaceView::new(&workspace, |_| Vec::new());
    let proposal: Option<ProposalView> = view
        .priorities
        .into_iter()
        .find(|proposal| proposal.file.as_deref() == Some(path));
    let priorities = read_priorities(repo)?;
    let committed = committed.as_deref() == Some(text.as_str());
    let dir = path.rsplit_once('/').map_or("specs", |(dir, _)| dir);
    Ok(ProposalFileView {
        proposal,
        priority_changes: priorities.changes,
        ..text_view(path, text, dir, committed, None)
    })
}

/// The view of a proposal file's, a note file's, or a proposal's text, read from `dir`, outside the
/// priorities.
fn text_view(
    path: &str,
    text: String,
    dir: &str,
    committed: bool,
    folder: Option<String>,
) -> ProposalFileView {
    let kind = if target::is_proposal_file(path) {
        "proposal-file"
    } else if target::is_note_file(path) {
        "note-file"
    } else {
        "proposal"
    };
    let document = document::parse(&text, dir);
    ProposalFileView {
        path: path.to_string(),
        title: title(&text).unwrap_or_else(|| path.to_string()),
        hash: hash(&text),
        stories: story_links(&document),
        mockups: mockup_embeds(&document),
        document,
        committed,
        proposal: None,
        priority_changes: 0,
        kind: kind.to_string(),
        folder,
        slug: target::proposal_to_start(path)
            .map(|proposal| crate::slug::short(target::proposal_name(&proposal))),
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

/// Expands a proposal into a file by its id, like `next-2`, over the priorities read at
/// `previous`: an id names another proposal once proposals are added or moved.
pub fn expand_proposal(repo: &Path, id: &str, previous: &str) -> Result<ProposalFileView> {
    let _lock = write_lock();
    let place = reach_default(repo)?;
    if edits::read(&place).hash != previous {
        return Err(ApiError {
            code: "conflict",
            message: "PRIORITIES.md changed on disk. Nothing was expanded.".to_string(),
            output: None,
        });
    }
    let expanded = expand::create(&place, id)?;
    read_proposal_file(repo, &expanded.path)
}

/// The place a text file is written in: the default branch for proposal files and note files, else
/// the feature's branch.
pub(super) fn text_place(repo: &Path, path: &str) -> Result<place::Place> {
    if target::is_linked_file(path) {
        linked_path(path)?;
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

/// Saves a proposal file, a note file, or a proposal as typed, over the version read at `previous`.
/// Returns the new hash.
pub fn save_text(repo: &Path, path: &str, content: &str, previous: &str) -> Result<String> {
    let _lock = write_lock();
    let place = text_place(repo, path)?;
    Ok(text::save(&place, path, content, previous)?)
}

/// Sets the discovery effort of a proposal file or a proposal, over the version read at `previous`.
pub fn set_discovery(
    repo: &Path,
    path: &str,
    level: &str,
    previous: &str,
) -> Result<ProposalFileView> {
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

/// Commits a proposal file or a note file, with the priorities and the inbox when they changed, or
/// a proposal.
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

/// A proposal file, a note file, or a proposal, for its editor: a proposal file or a note file from
/// the default branch, a proposal from its feature.
pub fn read_text(repo: &Path, path: &str) -> Result<ProposalFileView> {
    if target::is_linked_file(path) {
        return read_proposal_file(repo, path);
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
