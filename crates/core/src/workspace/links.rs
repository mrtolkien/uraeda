//! Where a link of a workflow file points, from the repository's top level, and the feature or
//! the draft a priorities entry links.

use std::path::{Path, PathBuf};

use super::{Feature, Kind, PriorityEntry, Workspace};
use crate::files::lines;
use crate::files::priorities::{self, Priorities};
use crate::steps::StepName;
use crate::view::StepView;

/// The draft or backlog file a priorities entry links, as it is on the default branch.
#[cfg_attr(feature = "napi", napi_derive::napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedFile {
    /// From the top level: `specs/drafts/x.md`, `specs/backlog/y/proposal.md`.
    pub path: String,
    /// Whether it is under `specs/backlog/`.
    pub backlog: bool,
}

/// The feature or change a priorities entry links, while its step is not `done`.
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

/// The draft a priorities entry's link points to, from the top level, when it links a file of
/// `specs/drafts/`.
pub fn linked_draft(link: &str) -> Option<String> {
    resolve("specs", link).filter(|path| path.starts_with("specs/drafts/"))
}

/// The draft or backlog file a link points to, when `drafts`, as [`Workspace::drafts`] lists them,
/// holds it: a folder's `proposal.md` counts as its folder.
pub fn linked_file(link: &str, drafts: &[String]) -> Option<LinkedFile> {
    let path = resolve("specs", link)?;
    let folder = path.strip_suffix("/proposal.md").unwrap_or(&path);
    if !drafts.iter().any(|draft| draft == &path || draft == folder) {
        return None;
    }
    Some(LinkedFile {
        backlog: path.starts_with("specs/backlog/"),
        path,
    })
}

impl Workspace {
    /// The feature or change a link points to, while its step is not `done`.
    pub fn running(&self, link: &str) -> Option<RunningFeature> {
        let folder = match_feature(link, &self.features)?;
        let feature = self.features.iter().find(|f| f.folder == folder)?;
        (feature.step.name != StepName::Done).then(|| RunningFeature {
            folder,
            change: feature.kind == Kind::Change,
            step: StepView::from(&feature.step),
        })
    }

    /// The priorities with each entry's draft or backlog file and running feature, from this
    /// workspace.
    pub fn join_priorities(&self, mut priorities: Priorities) -> Priorities {
        for entry in priorities.sections.iter_mut().flat_map(|s| &mut s.entries) {
            let (_, link) = lines::plain(&entry.text);
            entry.draft = link.as_deref().and_then(|l| linked_file(l, &self.drafts));
            entry.running = link.as_deref().and_then(|l| self.running(l));
        }
        priorities
    }
}

/// The feature an entry's link points to: a path component or file name equal to its folder or
/// its slug.
pub(super) fn match_feature(link: &str, features: &[Feature]) -> Option<String> {
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

/// The priorities' entries, each with the feature or the draft it links to.
pub(super) fn priority_entries(text: &str, features: &[Feature]) -> Vec<PriorityEntry> {
    let entries = priorities::parse(text);
    let keys = priorities::keys(&entries);
    entries
        .into_iter()
        .zip(keys)
        .map(|(entry, key)| {
            let feature = entry
                .link
                .as_deref()
                .and_then(|link| match_feature(link, features));
            let draft = entry.link.as_deref().and_then(linked_draft);
            PriorityEntry {
                section: entry.section,
                position: entry.position,
                key,
                text: entry.text,
                link: entry.link,
                feature,
                draft,
            }
        })
        .collect()
}
