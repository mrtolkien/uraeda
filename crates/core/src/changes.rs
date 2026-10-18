//! The files a feature's branch changed, from the default branch's merge base to its tip, for the
//! session's column. Only committed changes count: the diff is between two commits.

use std::path::Path;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::api::{self, ApiError};
use crate::git::Range;
use crate::workspace::{Feature, folder_path, record_path};

/// The most files listed; the counts and totals still cover every file.
const LISTED: usize = 50;

/// A file changed on a feature's branch, from the default branch's merge base to its tip.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    /// From the repository's top level; the new path of a renamed file.
    pub path: String,
    /// Lines added and removed; `None` for a binary file.
    pub added: Option<u32>,
    pub removed: Option<u32>,
}

/// The changes of a feature's branch, outside the feature's own folder.
#[cfg_attr(feature = "napi", napi(object))]
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchChanges {
    /// The first 50 files, sorted by path, outside `specs/<folder>/`.
    pub files: Vec<ChangedFile>,
    /// Every changed file outside the feature's folder, listed or not.
    pub count: u32,
    pub added: u32,
    pub removed: u32,
}

/// The files a feature's branch changed outside its folder: `None` when the feature has no
/// branch, is merged, or the default branch is unknown.
pub fn branch_changes(repo: &Path, folder: &str) -> Result<Option<BranchChanges>, ApiError> {
    let (git, workspace) = api::open(repo)?;
    let feature = api::find(&workspace, folder)?;
    let (Some(branch), Some(default)) = (&feature.branch, &workspace.default_branch) else {
        return Ok(None);
    };
    // The commits themselves, as `Git::tip` resolves them, local first, then `origin`'s: a
    // branch only on `origin`, or named `change/...`, needs no ref name on the command line.
    let (Some(tip), Some(base)) = (git.tip(branch), git.tip(default)) else {
        return Ok(None);
    };
    let mut files: Vec<ChangedFile> = git
        .numstat(base, tip, Range::ThreeDot)?
        .into_iter()
        .filter(|file| outside(feature, &file.path))
        .collect();
    files.sort_by(|a, b| a.path.cmp(&b.path));
    let changes = BranchChanges {
        count: files.len() as u32,
        added: files.iter().filter_map(|file| file.added).sum(),
        removed: files.iter().filter_map(|file| file.removed).sum(),
        files: files.into_iter().take(LISTED).collect(),
    };
    Ok(Some(changes))
}

/// Whether a path is outside a feature's own files: what it owns, its folder or its record once
/// finished, its folder's files a finished feature's branch deleted, and the record a finishing
/// one's branch adds.
pub(crate) fn outside(feature: &Feature, path: &str) -> bool {
    let folder = folder_path(feature.kind, &feature.folder);
    let in_folder = path
        .strip_prefix(folder.as_str())
        .is_some_and(|rest| rest.starts_with('/'));
    feature.owns(path).is_none() && !in_folder && path != record_path(&feature.folder)
}
