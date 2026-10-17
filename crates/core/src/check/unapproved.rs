//! `decision.unapproved`: a decision whose text changed on the branch after its spec's approval.
//! The approval commit is the branch's first-parent commit whose spec first reads
//! `status: approved`; the decision there is compared with the checkout, beyond the two fields the
//! approval step sets, `status` and `approved-by`. A decision the branch had not touched at the
//! approval, and that reads as the default branch's now, is the default branch's change, merged in.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::{parse_frontmatter, relative};
use crate::files::frontmatter;
use crate::git::{Git, ObjectId};
use crate::workspace::{Problem, Severity, folder_slug};

/// The warnings for the feature folders of `target`: `target` itself, or the folders directly in
/// it. Nothing without git, on the default branch, or when no spec there is approved.
pub(super) fn check_unapproved(root: &Path, target: &Path, problems: &mut Vec<Problem>) {
    let features = feature_folders(target);
    if features.is_empty() {
        return;
    }
    let Ok(git) = Git::open(root) else {
        return;
    };
    let Some(base) = branch_base(&git) else {
        return;
    };
    let mut changed = BTreeSet::new();
    for feature in features {
        if !approved(&fs::read_to_string(feature.join("spec.md")).unwrap_or_default()) {
            continue;
        }
        let (Some(spec), Some(decisions)) = (
            from_top(&git, &feature.join("spec.md")),
            feature.parent().map(|specs| specs.join("decisions")),
        ) else {
            continue;
        };
        let Ok(Some(approval)) = git.approval_commit(base.tip, base.base, &spec) else {
            continue;
        };
        let Ok(Some(forked)) = git.merge_base(approval, base.default) else {
            continue;
        };
        changed.extend(changed_decisions(
            &git,
            [approval, forked, base.base],
            &decisions,
        ));
    }
    for path in changed {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        problems.push(Problem {
            file: relative(root, &path),
            line: None,
            rule: "decision.unapproved".into(),
            message: format!("{name} changed after the spec's approval"),
            severity: Severity::Warning,
        });
    }
}

/// The feature folders a target holds: itself when it is one, else the ones directly in it.
fn feature_folders(target: &Path) -> Vec<PathBuf> {
    let is_feature = |dir: &Path| {
        dir.file_name()
            .is_some_and(|name| folder_slug(&name.to_string_lossy()).is_some())
            && dir.join("spec.md").is_file()
    };
    if is_feature(target) {
        return vec![target.to_path_buf()];
    }
    let mut folders: Vec<PathBuf> = fs::read_dir(target)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| is_feature(path))
        .collect();
    folders.sort();
    folders
}

/// The checkout's tip, the default branch's tip, and their merge base.
struct BranchBase {
    tip: ObjectId,
    default: ObjectId,
    base: ObjectId,
}

/// The checkout's tip and its merge base with the default branch's tip. On the default branch, the
/// base is the tip: no commit is the branch's own.
fn branch_base(git: &Git) -> Option<BranchBase> {
    let tip = git.head()?;
    let default = git.tip(&git.default_branch()?)?;
    let base = git.merge_base(tip, default).ok()??;
    Some(BranchBase { tip, default, base })
}

fn approved(text: &str) -> bool {
    parse_frontmatter(text).is_some_and(|front| front.text("status") == Some("approved"))
}

/// A path on disk as git names it, from the working tree's top level.
fn from_top(git: &Git, path: &Path) -> Option<String> {
    let path = path.strip_prefix(git.root()).ok()?;
    Some(path.to_string_lossy().replace('\\', "/"))
}

/// The decisions of `dir` whose text in the checkout differs from the approval commit's, a decision
/// added or deleted since included. One the branch had not touched at the approval (the same at the
/// approval as at `forked`, where the approval left the default branch) and the same now as at the
/// checkout's merge base `base` is the default branch's change, merged in, not the branch's.
fn changed_decisions(
    git: &Git,
    [approval, forked, base]: [ObjectId; 3],
    dir: &Path,
) -> Vec<PathBuf> {
    let Some(top) = from_top(git, dir) else {
        return Vec::new();
    };
    let mut names: BTreeSet<String> = git
        .list_files(approval, &top)
        .unwrap_or_default()
        .iter()
        .filter_map(|path| path.strip_prefix(&format!("{top}/")))
        .filter(|name| !name.contains('/') && name.ends_with(".md"))
        .map(String::from)
        .collect();
    names.extend(
        fs::read_dir(dir)
            .into_iter()
            .flatten()
            .flatten()
            .filter(|entry| entry.file_type().is_ok_and(|t| t.is_file()))
            .filter_map(|entry| entry.file_name().into_string().ok())
            .filter(|name| name.ends_with(".md")),
    );
    names
        .into_iter()
        .filter(|name| {
            let path = format!("{top}/{name}");
            let after = fs::read_to_string(dir.join(name)).ok();
            let after = after.as_deref().map(approved_text);
            let approved = text_at(git, approval, &path);
            if approved == after {
                return false;
            }
            let untouched = approved == text_at(git, forked, &path);
            !(untouched && text_at(git, base, &path) == after)
        })
        .map(|name| dir.join(name))
        .collect()
}

/// A decision's text at a commit, as `approved_text` gives it.
fn text_at(git: &Git, commit: ObjectId, path: &str) -> Option<String> {
    let bytes = git.read_file(commit, path).ok()??;
    Some(approved_text(&String::from_utf8_lossy(&bytes)))
}

/// A decision's text without the frontmatter's `status` and `approved-by` lines, which the
/// approval step sets.
fn approved_text(text: &str) -> String {
    let end = frontmatter::block(text).map_or(0, |(_, end)| end);
    text.split_inclusive('\n')
        .enumerate()
        .filter(|(index, line)| {
            !(*index > 0
                && *index + 1 < end
                && (line.starts_with("status:") || line.starts_with("approved-by:")))
        })
        .map(|(_, line)| line)
        .collect()
}
