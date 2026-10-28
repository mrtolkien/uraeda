//! Where a link of a workflow file points, from the repository's top level, and the feature or
//! the proposal file a proposal of the priorities links.

use std::path::{Path, PathBuf};

use super::{Feature, Kind, LinkedProposal, Workspace};
use crate::files::lines;
use crate::files::priorities::{self, Priorities};
use crate::steps::StepName;
use crate::view::StepView;

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

/// A link's file, from the top level, relative to the folder `dir` holding the linking file.
/// `None` for an anchor in the page, a URI with a scheme (`https:`, `data:`, `mailto:`), or a
/// protocol-relative URL (`//host/x`). A `?query` is left out, and a percent-encoded path is
/// decoded: `my%20shot.webp`.
pub fn resolve(dir: &str, target: &str) -> Option<String> {
    let path = target.split('#').next()?.split('?').next()?;
    if path.is_empty() || has_scheme(path) || path.starts_with("//") {
        return None;
    }
    let path = percent_decode(path);
    let joined = match path.strip_prefix('/') {
        Some(rooted) => PathBuf::from(rooted),
        None => Path::new(dir).join(path),
    };
    let mut parts: Vec<String> = Vec::new();
    for part in joined.components() {
        match part {
            std::path::Component::ParentDir => {
                parts.pop()?;
            }
            std::path::Component::Normal(name) => parts.push(name.to_str()?.to_string()),
            _ => {}
        }
    }
    Some(parts.join("/"))
}

/// Whether a target starts with a URI scheme, `[A-Za-z][A-Za-z0-9+.-]*:`.
fn has_scheme(target: &str) -> bool {
    let Some((scheme, _)) = target.split_once(':') else {
        return false;
    };
    let mut chars = scheme.chars();
    chars.next().is_some_and(|c| c.is_ascii_alphabetic())
        && chars.all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
}

/// A path with its `%XX` sequences decoded as UTF-8. A `%` not followed by two hexadecimal digits
/// stays as it is, and so does the whole path when the decoded bytes are not UTF-8.
fn percent_decode(path: &str) -> String {
    if !path.contains('%') {
        return path.to_string();
    }
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        let hex = bytes
            .get(i + 1..i + 3)
            .and_then(|pair| std::str::from_utf8(pair).ok())
            .filter(|_| bytes[i] == b'%')
            .and_then(|pair| u8::from_str_radix(pair, 16).ok());
        match hex {
            Some(byte) => {
                decoded.push(byte);
                i += 3;
            }
            None => {
                decoded.push(bytes[i]);
                i += 1;
            }
        }
    }
    String::from_utf8(decoded).unwrap_or_else(|_| path.to_string())
}

/// What a proposal's link points to in a workspace: its feature or change, and its proposal file.
/// The one join of the priorities to the workspace: the web's priorities, the workspace's
/// proposals, and the language server's hints read it.
pub struct Linked<'a> {
    /// The feature or change it links, whatever its step.
    pub feature: Option<&'a Feature>,
    /// The proposal file it links, when the default branch has it.
    pub file: Option<LinkedFile>,
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
        }
    }

    /// The priorities with each proposal's file and running feature, from this workspace.
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
