//! A feature's decisions as its branch has them: the changes its spec's view carries, and one
//! decision with its change, for a link from the feature's files.

use std::path::Path;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use super::{Result, feature_dir, find, open, refused};
use crate::decisions::{BranchSides, DecisionChange, branch_changes, branch_decision};
use crate::files::document::{self, Document};
use crate::files::items::SpecItems;
use crate::git::{Git, ObjectId};
use crate::workspace::Feature;

/// A decision as a feature's branch has it, and its change against the merge base of the branch
/// and the default branch.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchDecision {
    /// The file's name, without `.md`.
    pub name: String,
    /// The feature's folder.
    pub folder: String,
    pub change: DecisionChange,
    /// The branch's version of the file.
    pub document: Document,
}

/// The names of the decisions a spec's `## Decisions` lists, in order.
pub(super) fn listed(spec: &SpecItems) -> Vec<String> {
    spec.decisions
        .iter()
        .map(|decision| decision.name.clone())
        .collect()
}

fn sides<'a>(git: &'a Git, tip: Option<ObjectId>, disk: Option<&'a Path>) -> BranchSides<'a> {
    BranchSides {
        git,
        disk,
        tip,
        default: git.default_branch().and_then(|branch| git.tip(&branch)),
    }
}

/// The decisions a feature's branch changed, and the listed ones: none for a feature without a
/// branch, merged.
pub(super) fn changes(
    git: &Git,
    feature: &Feature,
    tip: Option<ObjectId>,
    listed: &[String],
) -> Vec<DecisionChange> {
    if feature.branch.is_none() {
        return Vec::new();
    }
    let disk = feature_dir(git, feature);
    branch_changes(&sides(git, tip, disk.as_deref()), listed)
}

/// The decision `name` of `specs/decisions/` as the feature's branch has it, with its change.
pub fn read_decision(repo: &Path, folder: &str, name: &str) -> Result<BranchDecision> {
    let (git, workspace) = open(repo)?;
    let feature = find(&workspace, folder)?;
    let missing = || refused(format!("{folder} has no decision {name}"));
    if feature.branch.is_none()
        || name.is_empty()
        || name.starts_with('.')
        || name.contains(['/', '\\', ':'])
    {
        return Err(missing());
    }
    let listed = feature.text("spec.md").is_some_and(|spec| {
        let spec = crate::files::spec::items(&document::parse(spec, &feature.path));
        listed(&spec).iter().any(|listed| listed == name)
    });
    let tip = feature.branch.as_deref().and_then(|branch| git.tip(branch));
    let disk = feature_dir(&git, feature);
    let sides = sides(&git, tip, disk.as_deref());
    let (text, change) = branch_decision(&sides, name, listed).ok_or_else(missing)?;
    Ok(BranchDecision {
        name: name.to_string(),
        folder: feature.folder.clone(),
        change,
        document: document::parse(&text, "specs/decisions"),
    })
}
