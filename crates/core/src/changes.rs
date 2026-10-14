//! The files a feature's branch changed, from the default branch's merge base to its tip, for the
//! session's column. Only committed changes count: the diff is between two commits.

use std::path::Path;

#[cfg(feature = "napi")]
use napi_derive::napi;
use serde::Serialize;

use crate::api::{self, ApiError};
use crate::git::{Git, GitError};

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
    // branch only on `origin`, or named `fix/...`, needs no ref name on the command line.
    let (Some(tip), Some(base)) = (git.tip(branch), git.tip(default)) else {
        return Ok(None);
    };
    let own = format!("{}/", feature.path);
    let mut files: Vec<ChangedFile> = numstat(&git, &base.to_string(), &tip.to_string())?
        .into_iter()
        .filter(|file| !file.path.starts_with(&own))
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

/// `git diff --numstat` from the merge base of `base` and `tip` to `tip`, renames followed.
fn numstat(git: &Git, base: &str, tip: &str) -> Result<Vec<ChangedFile>, GitError> {
    let range = format!("{base}...{tip}");
    let output = git.output(
        "diff",
        &["diff", "--numstat", "-z", "-M", "--no-ext-diff", &range],
    )?;
    Ok(parse(&output))
}

/// NUL-separated records: `added\tremoved\tpath`, or, for a rename, `added\tremoved\t` followed by
/// the old and the new path. A binary file counts `-` lines.
fn parse(output: &str) -> Vec<ChangedFile> {
    let mut fields = output.split('\0');
    let mut files = Vec::new();
    while let Some(record) = fields.next() {
        let mut parts = record.splitn(3, '\t');
        let (Some(added), Some(removed), Some(path)) = (parts.next(), parts.next(), parts.next())
        else {
            continue;
        };
        let path = if path.is_empty() {
            // A rename: the old path, then the new one.
            fields.next();
            fields.next().unwrap_or_default()
        } else {
            path
        };
        files.push(ChangedFile {
            path: path.to_string(),
            added: added.parse().ok(),
            removed: removed.parse().ok(),
        });
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_reads_plain_binary_and_renamed_records() {
        let output = concat!(
            "3\t1\tsrc/a.rs\0",
            "-\t-\tshot.png\0",
            "0\t0\t\0old.txt\0new.txt\0",
        );
        assert_eq!(
            parse(output),
            vec![
                ChangedFile {
                    path: "src/a.rs".into(),
                    added: Some(3),
                    removed: Some(1)
                },
                ChangedFile {
                    path: "shot.png".into(),
                    added: None,
                    removed: None
                },
                ChangedFile {
                    path: "new.txt".into(),
                    added: Some(0),
                    removed: Some(0)
                },
            ]
        );
    }
}
