//! What `ura check` finds in a feature, for the workspace and for the feature's page, and the fix of
//! a done feature's moved links from its page.

use std::path::Path;

use super::{
    Result, default_checkout, feature_dir, find, reach_default_from, read_feature, refused,
    write_lock,
};
use crate::cache;
use crate::check;
use crate::git::Git;
use crate::view::FeatureView;
use crate::workspace::{Feature, Problem, Severity, Source};

/// The errors `ura check` finds in a feature read from disk: its warnings stay out of the
/// feature's problems (R1). The rules reading the branch's history give warnings only, and are not
/// run (R65). A done feature's record is checked only for its own page, `page` (R4): the workspace's
/// read leaves it unchecked, and keeps nothing for it.
pub(super) fn checked(
    git: &Git,
    read: &cache::Read,
    feature: &Feature,
    page: bool,
) -> Vec<Problem> {
    if feature.source == Source::DefaultBranch && !page {
        return Vec::new();
    }
    read.checked(&feature.folder, || check_feature(git, feature))
}

/// The errors of [`checked`], read in the feature's working tree: for a done feature, the one that
/// has the default branch checked out, never one created for it.
fn check_feature(git: &Git, feature: &Feature) -> Vec<Problem> {
    let root = if feature.source == Source::DefaultBranch {
        git.default_branch()
            .and_then(|default| default_checkout(git, &default))
    } else {
        feature_dir(git, feature)
    };
    let Some(root) = root else {
        return Vec::new();
    };
    let mut problems =
        check::check_files(&root, &root.join(feature.checked_path())).unwrap_or_default();
    problems.retain(|problem| {
        problem.severity == Severity::Error
            && !feature
                .problems
                .iter()
                .any(|known| known.file == problem.file && known.rule == problem.rule)
    });
    problems
}

/// Repairs the links of a done feature's record whose file moved or was deleted since, as
/// `ura check --fix` does, in the checkout that has the default branch, without committing: the
/// commit page lists the repair. Returns the feature read again. Refused for a feature not read
/// from the default branch.
pub fn fix_links(repo: &Path, folder: &str) -> Result<FeatureView> {
    {
        let _lock = write_lock(repo);
        let (place, workspace) = reach_default_from(repo)?;
        let feature = find(&workspace, folder)?;
        if feature.source != Source::DefaultBranch {
            return Err(refused(format!(
                "{folder} is not on the default branch: only its files are fixed here"
            )));
        }
        let target = place.root.join(feature.checked_path());
        check::fix(&place.root, &target).map_err(|error| refused(error.to_string()))?;
    }
    // The lock's release moved the read cache's generation: the feature is read as fixed.
    read_feature(repo, folder)
}
