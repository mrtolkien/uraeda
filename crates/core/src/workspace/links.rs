//! Where a link of a workflow file points, from the repository's top level, and the feature or
//! the proposal file a proposal of the priorities links.

use super::{Feature, Kind, LinkedProposal, Workspace};
use crate::files::lines;
use crate::files::priorities::{self, Priorities};
use crate::pulls::PullRequestView;
use crate::steps::StepName;
use crate::view::{StepView, recorded_pull_request};
// The link resolver reads a text alone: the app's web build takes it without the core.
pub use uraeda_text::links::resolve;

/// The proposal file a proposal of the priorities links, as it is on the default branch.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedFile {
    /// From the top level: `specs/proposals/x.md`, `specs/proposals/y/proposal.md`.
    pub path: String,
}

/// The feature or change a proposal of the priorities links, while its step is not `done`.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningFeature {
    pub folder: String,
    /// Whether it is a change.
    pub change: bool,
    pub step: StepView,
}

/// The feature or change a proposal of the priorities links, once its step is `done`: merged, its
/// line left for `ura clean` to remove.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MergedFeature {
    pub folder: String,
    /// Whether it is a change.
    pub change: bool,
    /// Its pull request, from its record's `pull-request`.
    pub pull_request: Option<PullRequestView>,
}

/// Whether `path`, a link's target from the top level, is the line of the feature or change in
/// `folder`, a folder from the top level: a link to the folder itself, or to its `proposal.md`, as a
/// started line has. The one test of a feature's line: the priorities' join, `ura clean`, and its
/// removal of the line read it.
pub fn links_folder(path: &str, folder: &str) -> bool {
    path == folder || path.strip_prefix(folder) == Some("/proposal.md")
}

/// What a proposal's link points to in a workspace: its feature or change, and its proposal file.
/// The one join of the priorities to the workspace: the web's priorities, the workspace's
/// proposals, and the language server's hints read it.
pub struct Linked<'a> {
    /// The feature or change it links, whatever its step.
    pub feature: Option<&'a Feature>,
    /// The proposal file it links, when the default branch has it.
    pub file: Option<LinkedFile>,
    /// The file it links, from the top level.
    pub path: Option<String>,
}

impl Linked<'_> {
    /// Its feature or change, while its step is not `done`.
    pub fn running(&self) -> Option<RunningFeature> {
        let feature = self.feature?;
        (feature.step.name != StepName::Done).then(|| RunningFeature {
            folder: feature.folder.clone(),
            change: feature.kind == Kind::Change,
            step: StepView::from(&feature.step),
        })
    }

    /// Its feature or change, once its step is `done`, when it links the folder's proposal, as a
    /// started line does: a link to its record, or to a proposal file named alike, is no merged
    /// line.
    pub fn merged(&self) -> Option<MergedFeature> {
        let feature = self.feature?;
        let folder = super::paths::folder_path(feature.kind, &feature.folder);
        let own = self
            .path
            .as_deref()
            .is_some_and(|path| links_folder(path, &folder));
        (own && feature.step.name == StepName::Done).then(|| MergedFeature {
            folder: feature.folder.clone(),
            change: feature.kind == Kind::Change,
            pull_request: feature
                .pull_request
                .clone()
                .or_else(|| recorded_pull_request(feature)),
        })
    }
}

/// The proposal file a link points to, when `proposals`, as [`Workspace::proposals`] lists them,
/// holds it: a folder's `proposal.md` counts as its folder, which they list only when it holds
/// that file.
fn linked_file(link: &str, proposals: &[String]) -> Option<LinkedFile> {
    let path = resolve("specs", link)?;
    let folder = path.strip_suffix("/proposal.md").unwrap_or(&path);
    if !proposals
        .iter()
        .any(|proposal| proposal == &path || proposal == folder)
    {
        return None;
    }
    Some(LinkedFile { path })
}

impl Workspace {
    /// What a proposal's link points to.
    pub fn link(&self, link: &str) -> Linked<'_> {
        Linked {
            feature: match_feature(link, &self.features).and_then(|folder| self.feature(&folder)),
            file: linked_file(link, &self.proposals),
            path: resolve("specs", link),
        }
    }

    /// The priorities with each proposal's file and running or merged feature, from this workspace.
    pub fn join_priorities(&self, mut priorities: Priorities) -> Priorities {
        for proposal in priorities
            .sections
            .iter_mut()
            .flat_map(|s| &mut s.proposals)
        {
            let (_, link) = lines::plain(&proposal.text);
            let linked = link.as_deref().map(|link| self.link(link));
            proposal.file = linked.as_ref().and_then(|linked| linked.file.clone());
            proposal.running = linked.as_ref().and_then(Linked::running);
            proposal.merged = linked.as_ref().and_then(Linked::merged);
        }
        priorities
    }
}

/// The feature a proposal's link points to: a path component or file name equal to its folder or
/// its slug.
fn match_feature(link: &str, features: &[Feature]) -> Option<String> {
    let path = link.split('#').next().unwrap_or(link);
    let names: Vec<&str> = path
        .split('/')
        .map(|part| part.strip_suffix(".md").unwrap_or(part))
        .filter(|part| !part.is_empty() && *part != "proposal")
        .collect();
    features
        .iter()
        .find(|feature| {
            names
                .iter()
                .any(|name| *name == feature.folder || *name == feature.slug)
        })
        .map(|feature| feature.folder.clone())
}

/// The priorities' proposals, each with the feature or the proposal file it links to in
/// `workspace`.
pub(super) fn linked_proposals(text: &str, workspace: &Workspace) -> Vec<LinkedProposal> {
    let proposals = priorities::parse(text);
    let keys = priorities::keys(&proposals);
    proposals
        .into_iter()
        .zip(keys)
        .map(|(proposal, key)| {
            let linked = proposal.link.as_deref().map(|link| workspace.link(link));
            let linked = linked.as_ref();
            LinkedProposal {
                section: proposal.section,
                position: proposal.position,
                key,
                text: proposal.text,
                feature: linked
                    .and_then(|linked| linked.feature)
                    .map(|feature| feature.folder.clone()),
                file: linked
                    .and_then(|linked| linked.file.as_ref())
                    .map(|file| file.path.clone()),
                link: proposal.link,
            }
        })
        .collect()
}
